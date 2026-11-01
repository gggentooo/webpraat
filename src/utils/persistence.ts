/**
 * Origin Private File System (OPFS) Workspace Persistence (Phase 7).
 * Serializes and restores Praat C++ objects (in lossless ooBinaryFile format)
 * and active Praat scripts across browser reloads.
 */

import type { PraatObject } from '../types/praat';
import type { PraatWorkerApi } from '../types/wasm';

const WORKSPACE_DIR_NAME = 'webpraat-workspace';
const MANIFEST_FILENAME = 'manifest.json';

export interface WorkspaceManifestEntry {
  file: string;
  className: string;
  name: string;
}

export interface WorkspaceManifest {
  version: 1;
  savedAt: number;
  scriptText?: string;
  entries: WorkspaceManifestEntry[];
}

export interface RestoredWorkspace {
  objects: PraatObject[];
  scriptText?: string;
  savedAt: number;
}

export interface StorageDirectoryAdapter {
  writeFile(name: string, data: Uint8Array): Promise<void>;
  readFile(name: string): Promise<Uint8Array | null>;
  removeFile(name: string): Promise<void>;
  listFiles(): Promise<string[]>;
}

/**
 * Browser OPFS adapter backed by `navigator.storage.getDirectory()`.
 */
export class BrowserOpfsDirectoryAdapter implements StorageDirectoryAdapter {
  private dirPromise: Promise<FileSystemDirectoryHandle> | null = null;

  private async getDir(): Promise<FileSystemDirectoryHandle> {
    if (!this.dirPromise) {
      this.dirPromise = (async () => {
        const root = await navigator.storage.getDirectory();
        return root.getDirectoryHandle(WORKSPACE_DIR_NAME, { create: true });
      })();
    }
    return this.dirPromise;
  }

  async writeFile(name: string, data: Uint8Array): Promise<void> {
    const dir = await this.getDir();
    const handle = await dir.getFileHandle(name, { create: true });
    const writable = await handle.createWritable();
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    await writable.write(copy);
    await writable.close();
  }

  async readFile(name: string): Promise<Uint8Array | null> {
    try {
      const dir = await this.getDir();
      const handle = await dir.getFileHandle(name);
      const file = await handle.getFile();
      const ab = await file.arrayBuffer();
      return new Uint8Array(ab);
    } catch {
      return null;
    }
  }

  async removeFile(name: string): Promise<void> {
    try {
      const dir = await this.getDir();
      await dir.removeEntry(name);
    } catch {}
  }

  async listFiles(): Promise<string[]> {
    const out: string[] = [];
    try {
      const dir = await this.getDir();
      const asyncEntries = (dir as unknown as { keys?: () => AsyncIterable<string> }).keys;
      if (typeof asyncEntries === 'function') {
        for await (const key of asyncEntries.call(dir)) {
          out.push(key);
        }
      }
    } catch {}
    return out;
  }
}

/**
 * Deterministic in-memory adapter matching the OPFS directory contract
 * (used for headless unit testing and environments where OPFS is disabled).
 */
export class InMemoryDirectoryAdapter implements StorageDirectoryAdapter {
  private readonly store = new Map<string, Uint8Array>();

  async writeFile(name: string, data: Uint8Array): Promise<void> {
    const copy = new Uint8Array(data.byteLength);
    copy.set(data);
    this.store.set(name, copy);
  }

  async readFile(name: string): Promise<Uint8Array | null> {
    const existing = this.store.get(name);
    if (!existing) return null;
    const copy = new Uint8Array(existing.byteLength);
    copy.set(existing);
    return copy;
  }

  async removeFile(name: string): Promise<void> {
    this.store.delete(name);
  }

  async listFiles(): Promise<string[]> {
    return Array.from(this.store.keys());
  }
}

let defaultAdapter: StorageDirectoryAdapter | null = null;

export function isOpfsSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    typeof navigator.storage !== 'undefined' &&
    typeof navigator.storage.getDirectory === 'function'
  );
}

function getDefaultAdapter(): StorageDirectoryAdapter {
  if (!defaultAdapter) {
    defaultAdapter = isOpfsSupported()
      ? new BrowserOpfsDirectoryAdapter()
      : new InMemoryDirectoryAdapter();
  }
  return defaultAdapter;
}

/**
 * Serializes all loaded Praat objects from WASM into OPFS binary files + `manifest.json`.
 */
export async function saveWorkspaceToOpfs(
  worker: Pick<PraatWorkerApi, 'exportObjectBinary'>,
  objects: PraatObject[],
  scriptText?: string,
  adapter: StorageDirectoryAdapter = getDefaultAdapter()
): Promise<WorkspaceManifest> {
  const existingFiles = await adapter.listFiles();
  const keptFiles = new Set<string>([MANIFEST_FILENAME]);
  const entries: WorkspaceManifestEntry[] = [];

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    try {
      const binary = await worker.exportObjectBinary(obj.id);
      const filename = `obj_${i}_${obj.id}.praatbin`;
      await adapter.writeFile(filename, binary);
      keptFiles.add(filename);
      entries.push({
        file: filename,
        className: obj.className,
        name: obj.name,
      });
    } catch (err) {
      console.warn(`Skipping OPFS serialization for ${obj.className} ${obj.name}:`, err);
    }
  }

  // Prune stale binary object files
  for (const oldFile of existingFiles) {
    if (!keptFiles.has(oldFile)) {
      await adapter.removeFile(oldFile);
    }
  }

  const manifest: WorkspaceManifest = {
    version: 1,
    savedAt: Date.now(),
    scriptText,
    entries,
  };

  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest, null, 2));
  await adapter.writeFile(MANIFEST_FILENAME, manifestBytes);
  return manifest;
}

/**
 * Restores a previously saved workspace from OPFS into the WASM worker.
 */
export async function loadWorkspaceFromOpfs(
  worker: Pick<PraatWorkerApi, 'importObjectBinary'>,
  adapter: StorageDirectoryAdapter = getDefaultAdapter()
): Promise<RestoredWorkspace | null> {
  const manifestBytes = await adapter.readFile(MANIFEST_FILENAME);
  if (!manifestBytes || manifestBytes.byteLength === 0) {
    return null;
  }

  let manifest: WorkspaceManifest;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes)) as WorkspaceManifest;
  } catch {
    return null;
  }

  if (!manifest || manifest.version !== 1 || !Array.isArray(manifest.entries)) {
    return null;
  }

  const restoredObjects: PraatObject[] = [];
  for (const entry of manifest.entries) {
    const bin = await adapter.readFile(entry.file);
    if (!bin) continue;
    try {
      const imported = await worker.importObjectBinary(bin, entry.name);
      restoredObjects.push({
        id: imported.id,
        className: imported.className,
        name: imported.name,
        duration: imported.duration,
        sampleRate: imported.sampleRate,
        numChannels: imported.numChannels,
        numSamples: imported.numSamples,
        createdAt: manifest.savedAt,
      });
    } catch (err) {
      console.warn(`Failed to restore ${entry.className} ${entry.name} from OPFS:`, err);
    }
  }

  return {
    objects: restoredObjects,
    scriptText: manifest.scriptText,
    savedAt: manifest.savedAt,
  };
}

/**
 * Clears all saved workspace files in OPFS.
 */
export async function clearWorkspaceFromOpfs(
  adapter: StorageDirectoryAdapter = getDefaultAdapter()
): Promise<void> {
  const files = await adapter.listFiles();
  for (const f of files) {
    await adapter.removeFile(f);
  }
}
