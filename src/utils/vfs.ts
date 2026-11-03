/**
 * Virtual Filesystem (VFS) and Local Directory Mounting Utilities for WebPraat.
 * Integrates the browser File System Access API and fallback input with
 * Emscripten MEMFS (/workspace/...) and Praat runtime working directory.
 */

import type { PraatWorkerApi } from '../types/wasm';
import type { MountedDirectory } from '../store';

export interface FileEntry {
  path: string; // relative to mounted root, e.g. "recording.wav" or "textgrids/recording.TextGrid"
  data: Uint8Array;
}

/**
 * Traverses a FileSystemDirectoryHandle recursively to collect all files.
 */
async function scanDirectoryHandle(
  dirHandle: any,
  subPath = ''
): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  for await (const [name, handle] of dirHandle.entries()) {
    const relPath = subPath ? `${subPath}/${name}` : name;
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      const buf = await file.arrayBuffer();
      entries.push({
        path: relPath,
        data: new Uint8Array(buf),
      });
    } else if (handle.kind === 'directory') {
      const subEntries = await scanDirectoryHandle(handle, relPath);
      entries.push(...subEntries);
    }
  }
  return entries;
}

/**
 * Mount a local directory into Praat's VFS using File System Access API or fallback.
 */
export async function mountLocalFolder(
  worker: PraatWorkerApi,
  fallbackInput?: HTMLInputElement | null
): Promise<MountedDirectory | null> {
  // 1. Try File System Access API
  if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
    try {
      const dirHandle = await (window as any).showDirectoryPicker({
        mode: 'readwrite',
      });
      const folderName = dirHandle.name || 'mounted';
      const baseDir = `/workspace/${folderName}`;

      const files = await scanDirectoryHandle(dirHandle);
      await worker.mountFiles(baseDir, files);
      await worker.setCurrentDirectory(baseDir);

      return {
        name: folderName,
        path: baseDir,
        handle: dirHandle,
        readOnly: false,
      };
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return null;
      }
      console.warn('showDirectoryPicker failed or was blocked, falling back to input:', err);
    }
  }

  // 2. Fallback: HTML input with webkitdirectory
  return new Promise((resolve) => {
    let input = fallbackInput;
    let created = false;
    if (!input) {
      input = document.createElement('input');
      input.type = 'file';
      input.setAttribute('webkitdirectory', '');
      input.setAttribute('directory', '');
      input.multiple = true;
      input.style.display = 'none';
      document.body.appendChild(input);
      created = true;
    }

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const fileList = target.files;
      if (!fileList || fileList.length === 0) {
        if (created && input) document.body.removeChild(input);
        resolve(null);
        return;
      }

      const files: FileEntry[] = [];
      let rootFolderName = '';

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const relPath = file.webkitRelativePath || file.name;
        const slashIdx = relPath.indexOf('/');
        if (slashIdx !== -1) {
          if (!rootFolderName) {
            rootFolderName = relPath.slice(0, slashIdx);
          }
          files.push({
            path: relPath.slice(slashIdx + 1),
            data: new Uint8Array(await file.arrayBuffer()),
          });
        } else {
          if (!rootFolderName) rootFolderName = 'workspace';
          files.push({
            path: relPath,
            data: new Uint8Array(await file.arrayBuffer()),
          });
        }
      }

      rootFolderName = rootFolderName || 'mounted';
      const baseDir = `/workspace/${rootFolderName}`;

      await worker.mountFiles(baseDir, files);
      await worker.setCurrentDirectory(baseDir);

      if (created && input) document.body.removeChild(input);
      resolve({
        name: rootFolderName,
        path: baseDir,
        readOnly: true,
      });
    };

    input.click();
  });
}

/**
 * Writes raw bytes directly to a host FileSystemDirectoryHandle at a relative path.
 * Automatically creates intermediate subdirectories as needed.
 */
export async function writeHostFile(
  dirHandle: any,
  relativePath: string,
  bytes: Uint8Array
): Promise<boolean> {
  if (!dirHandle) return false;
  try {
    const cleanRel = relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = cleanRel.split('/').filter(Boolean);
    if (parts.length === 0) return false;

    let currentDir = dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
    }

    const fileName = parts[parts.length - 1];
    const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(bytes);
    await writable.close();
    return true;
  } catch (err) {
    console.error(`Failed to write host file (${relativePath}):`, err);
    return false;
  }
}

/**
 * Saves a file back to both Praat's worker VFS and host filesystem handle (if mounted).
 */
export async function writeBackFile(
  worker: PraatWorkerApi,
  mountedDir: MountedDirectory | null,
  filePath: string,
  content: string | Uint8Array
): Promise<boolean> {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;

  // 1. Write to worker VFS
  let vfsPath = filePath;
  if (!vfsPath.startsWith('/')) {
    vfsPath = mountedDir ? `${mountedDir.path}/${filePath}` : `/workspace/${filePath}`;
  }
  await worker.writeVfsFile(vfsPath, bytes);

  // 2. If host directory handle is available, write directly to host file
  if (mountedDir?.handle && !mountedDir.readOnly) {
    let relativePath = filePath;
    if (relativePath.startsWith(mountedDir.path)) {
      relativePath = relativePath.slice(mountedDir.path.length);
    }
    return writeHostFile(mountedDir.handle, relativePath, bytes);
  }

  return true;
}
