/**
 * Phase 10 Acceptance Tests:
 * Automated Script File Synchronization, Change Tracking & Export Fallback.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import praatWorkerApi from './workers/praatWorker';
import { createZipArchive, crc32 } from './utils/zip';
import { writeHostFile, writeBackFile } from './utils/vfs';
import { en } from './config/locales/en';
import { ko } from './config/locales/ko';

/**
 * In-memory Mock FileSystemDirectoryHandle conforming to File System Access API
 */
class MockFileHandle {
  readonly kind = 'file';
  constructor(public name: string, private store: Map<string, Uint8Array>) {}

  async createWritable() {
    const chunks: Uint8Array[] = [];
    return {
      write: async (data: Uint8Array) => {
        chunks.push(data);
      },
      close: async () => {
        const totalLen = chunks.reduce((acc, c) => acc + c.byteLength, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.byteLength;
        }
        this.store.set(this.name, merged);
      },
    };
  }

  async getFile() {
    const data = this.store.get(this.name) || new Uint8Array();
    return {
      arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
      size: data.byteLength,
      name: this.name,
    };
  }
}

class MockDirectoryHandle {
  readonly kind = 'directory';
  public files = new Map<string, Uint8Array>();
  public directories = new Map<string, MockDirectoryHandle>();

  constructor(public name: string = 'root') {}

  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    let dir = this.directories.get(name);
    if (!dir) {
      if (options?.create) {
        dir = new MockDirectoryHandle(name);
        this.directories.set(name, dir);
      } else {
        throw new Error(`Directory not found: ${name}`);
      }
    }
    return dir;
  }

  async getFileHandle(name: string, options?: { create?: boolean }) {
    if (!this.files.has(name)) {
      if (options?.create) {
        this.files.set(name, new Uint8Array());
      } else {
        throw new Error(`File not found: ${name}`);
      }
    }
    return new MockFileHandle(name, this.files);
  }

  async *entries(): AsyncIterableIterator<[string, MockFileHandle | MockDirectoryHandle]> {
    for (const [name] of this.files) {
      yield [name, new MockFileHandle(name, this.files)];
    }
    for (const [name, dir] of this.directories) {
      yield [name, dir];
    }
  }
}

describe('Phase 10: Automated Script File Synchronization, Change Tracking & Export Fallback', () => {
  beforeAll(async () => {
    const ok = await praatWorkerApi.init();
    expect(ok).toBe(true);
  });

  describe('1. VFS Change Tracking & Manifest Diffing', () => {
    it('detects newly created files and modified files against initial baseline', async () => {
      const baseDir = '/workspace/test_p10_diff';
      // Initialize folder with one baseline file
      await praatWorkerApi.writeVfsFile(`${baseDir}/initial.txt`, 'original content');
      await praatWorkerApi.setCurrentDirectory(baseDir);
      await praatWorkerApi.resetVfsSnapshot(baseDir);

      // Verify no changes initially
      let modified = await praatWorkerApi.getModifiedVfsFiles(baseDir);
      expect(modified.length).toBe(0);

      // 1. Create a new file
      await praatWorkerApi.writeVfsFile(`${baseDir}/new_file.txt`, 'brand new content');

      // 2. Modify existing file
      await praatWorkerApi.writeVfsFile(`${baseDir}/initial.txt`, 'modified content updated');

      modified = await praatWorkerApi.getModifiedVfsFiles(baseDir);
      expect(modified.length).toBe(2);

      const newEntry = modified.find((f) => f.path === 'new_file.txt');
      expect(newEntry).toBeDefined();
      expect(newEntry?.isNew).toBe(true);
      expect(new TextDecoder().decode(newEntry?.data)).toBe('brand new content');

      const modEntry = modified.find((f) => f.path === 'initial.txt');
      expect(modEntry).toBeDefined();
      expect(modEntry?.isNew).toBe(false);
      expect(new TextDecoder().decode(modEntry?.data)).toBe('modified content updated');

      // Reset baseline snapshot
      await praatWorkerApi.resetVfsSnapshot(baseDir);
      const afterReset = await praatWorkerApi.getModifiedVfsFiles(baseDir);
      expect(afterReset.length).toBe(0);
    });
  });

  describe('2. Script File Writing & Appending (writeFileLine: & appendFileLine:)', () => {
    it('tracks file writes and appends executed from a Praat batch script', async () => {
      const baseDir = '/workspace/test_p10_script_io';
      await praatWorkerApi.setCurrentDirectory(baseDir);
      await praatWorkerApi.resetVfsSnapshot(baseDir);

      const script = `
writeFileLine: "summary.csv", "id,f0_mean,duration"
appendFileLine: "summary.csv", "token_1,220.5,0.45"
appendFileLine: "summary.csv", "token_2,185.0,0.62"
writeInfoLine: "CSV generated"
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 3 error:', res.error, 'info:', res.info);
      }
      expect(res.status).toBe('COMPLETED');
      expect(res.info).toContain('CSV generated');

      // Read directly via readVfsFile
      const fileBytes = await praatWorkerApi.readVfsFile(`${baseDir}/summary.csv`);
      expect(fileBytes).not.toBeNull();
      const text = new TextDecoder().decode(fileBytes!);
      expect(text).toContain('id,f0_mean,duration');
      expect(text).toContain('token_1,220.5,0.45');
      expect(text).toContain('token_2,185.0,0.62');

      // Verify diff detection
      const diff = await praatWorkerApi.getModifiedVfsFiles(baseDir);
      expect(diff.some((f) => f.path === 'summary.csv')).toBe(true);
    });
  });

  describe('3. Object Save Actions to Relative & Nested Paths', () => {
    it('tracks objects saved directly to nested directories by Praat scripts', async () => {
      const baseDir = '/workspace/test_p10_save_objects';
      await praatWorkerApi.setCurrentDirectory(baseDir);

      // Create destination subdirectories (typical project folder structure)
      await praatWorkerApi.writeVfsFile(`${baseDir}/wavs/.keep`, '');
      await praatWorkerApi.writeVfsFile(`${baseDir}/textgrids/.keep`, '');
      await praatWorkerApi.resetVfsSnapshot(baseDir);

      // Create a sound and a textgrid
      const soundId = await praatWorkerApi.createSound(new Float64Array(800), 800, 1, 8000, 'audio_obj');
      const tgId = await praatWorkerApi.soundToTextGrid(soundId, 'tier1', '');
      await praatWorkerApi.textgridInsertBoundary(tgId, 1, 0.05);
      await praatWorkerApi.textgridSetIntervalText(tgId, 1, 1, 'vowel_a');

      // Script that saves objects into nested relative folders
      const script = `
selectObject: ${soundId}
Save as WAV file: "wavs/test_sound.wav"

selectObject: ${tgId}
Save as text file: "textgrids/test_grid.TextGrid"

writeInfoLine: "Objects saved to disk"
`;
      const res = await praatWorkerApi.executeScriptWithArgs(script, '{}');
      if (res.status !== 'COMPLETED') {
        console.error('Test 3 error:', res.error, 'info:', res.info);
      }
      expect(res.status).toBe('COMPLETED');

      // Clean up WASM objects
      await praatWorkerApi.destroyObject(soundId);
      await praatWorkerApi.destroyObject(tgId);

      const modified = await praatWorkerApi.getModifiedVfsFiles(baseDir);
      const wavEntry = modified.find((f) => f.path === 'wavs/test_sound.wav');
      const tgEntry = modified.find((f) => f.path === 'textgrids/test_grid.TextGrid');

      expect(wavEntry).toBeDefined();
      expect(tgEntry).toBeDefined();
      expect(wavEntry?.data.length).toBeGreaterThan(44); // Valid WAV header
      const tgContent = new TextDecoder().decode(tgEntry?.data);
      expect(tgContent).toContain('vowel_a');
    });
  });

  describe('4. Host Handle Two-Way Disk Synchronization', () => {
    it('persists files to mock host directory handle creating nested subdirectories', async () => {
      const mockRoot = new MockDirectoryHandle('host_project');

      const testContent = new TextEncoder().encode('Speaker,F1,F2\nspk1,500,1500\n');
      const ok = await writeHostFile(mockRoot, 'output/reports/stats.csv', testContent);
      expect(ok).toBe(true);

      // Verify directory structure was created
      expect(mockRoot.directories.has('output')).toBe(true);
      const outputDir = mockRoot.directories.get('output')!;
      expect(outputDir.directories.has('reports')).toBe(true);
      const reportsDir = outputDir.directories.get('reports')!;
      expect(reportsDir.files.has('stats.csv')).toBe(true);

      const savedBytes = reportsDir.files.get('stats.csv')!;
      expect(new TextDecoder().decode(savedBytes)).toBe('Speaker,F1,F2\nspk1,500,1500\n');
    });

    it('synchronizes through writeBackFile with MountedDirectory handle', async () => {
      const mockRoot = new MockDirectoryHandle('mounted_dir');
      const mountedDir = {
        name: 'mounted_dir',
        path: '/workspace/mounted_dir',
        handle: mockRoot,
        readOnly: false,
      };

      const ok = await writeBackFile(
        praatWorkerApi,
        mountedDir,
        'textgrids/recording01.TextGrid',
        'File type = "ooTextFile"\nObject class = "TextGrid"'
      );
      expect(ok).toBe(true);

      // Verify written to mock host disk handle
      const tgDir = mockRoot.directories.get('textgrids');
      expect(tgDir).toBeDefined();
      expect(tgDir?.files.has('recording01.TextGrid')).toBe(true);

      // Verify also present in worker VFS
      const vfsBytes = await praatWorkerApi.readVfsFile(
        '/workspace/mounted_dir/textgrids/recording01.TextGrid'
      );
      expect(vfsBytes).not.toBeNull();
      expect(new TextDecoder().decode(vfsBytes!)).toContain('ooTextFile');
    });
  });

  describe('5. Standalone Pure TypeScript ZIP Archive Generator', () => {
    it('calculates correct IEEE 802.3 CRC-32 checksums', () => {
      const encoder = new TextEncoder();
      // Known standard vector: "123456789" -> 0xCBF43926 (3421760294)
      const data = encoder.encode('123456789');
      expect(crc32(data)).toBe(0xcbf43926);

      // Empty buffer CRC32 is 0
      expect(crc32(new Uint8Array(0))).toBe(0);
    });

    it('generates a valid PKWARE ZIP binary containing multiple files', () => {
      const files = [
        { name: 'report.txt', data: new TextEncoder().encode('Hello World') },
        { name: 'data/values.csv', data: new TextEncoder().encode('a,b,c\n1,2,3') },
        { name: 'nested/deep/note.md', data: new TextEncoder().encode('# Title') },
      ];

      const zipBytes = createZipArchive(files);
      expect(zipBytes.length).toBeGreaterThan(100);

      const view = new DataView(zipBytes.buffer, zipBytes.byteOffset, zipBytes.byteLength);

      // Check first local file header signature (0x04034b50)
      expect(view.getUint32(0, true)).toBe(0x04034b50);

      // Check End of Central Directory signature (0x06054b50) at offset: zipBytes.length - 22
      const eocdOffset = zipBytes.length - 22;
      expect(view.getUint32(eocdOffset, true)).toBe(0x06054b50);

      // Total records in EOCD
      expect(view.getUint16(eocdOffset + 10, true)).toBe(3);
    });
  });

  describe('6. Localization Key Parity (en vs ko)', () => {
    it('ensures all Phase 10 keys exist and match across English and Korean locales', () => {
      const phase10Keys = [
        'fileSavedToDisk',
        'filesSavedToDisk',
        'fileDownloaded',
        'filesReadyForDownload',
        'scriptExportTitle',
        'scriptExportPrompt',
        'downloadZip',
        'downloadFile',
        'newBadge',
        'modifiedBadge',
        'close',
        'autoSaveStep',
      ] as const;

      for (const key of phase10Keys) {
        expect(en.script[key]).toBeDefined();
        expect(ko.script[key]).toBeDefined();
        expect(typeof en.script[key]).toBe('string');
        expect(typeof ko.script[key]).toBe('string');
        expect(en.script[key].length).toBeGreaterThan(0);
        expect(ko.script[key].length).toBeGreaterThan(0);
      }
    });
  });
});
