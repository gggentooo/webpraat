/**
 * Zero-dependency pure TypeScript uncompressed ZIP archive generator (PKWARE spec).
 * Creates valid .zip archives containing multiple files, readable by standard tools
 * (macOS Finder/Archive Utility, Windows Explorer, unzip, Python zipfile).
 */

// Precompute CRC32 lookup table (IEEE 802.3 polynomial: 0xEDB88320)
const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  CRC_TABLE[i] = c >>> 0;
}

/**
 * Computes 32-bit CRC checksum of byte array.
 */
export function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export interface ZipFileInput {
  name: string;
  data: Uint8Array;
}

/**
 * Generates an uncompressed (Store, method 0) ZIP archive binary from a list of files.
 */
export function createZipArchive(files: ZipFileInput[]): Uint8Array {
  const encoder = new TextEncoder();
  const fileEntries = files.map((file) => {
    // Normalize slashes and remove leading slash for archive entries
    const normalizedName = file.name.replace(/\\/g, '/').replace(/^\/+/, '');
    const nameBytes = encoder.encode(normalizedName);
    const checksum = crc32(file.data);
    return {
      nameBytes,
      data: file.data,
      crc: checksum,
      size: file.data.length,
    };
  });

  // Calculate total buffer size required
  let totalLocalHeadersSize = 0;
  for (const entry of fileEntries) {
    // 30 bytes fixed local header + name length + file data length
    totalLocalHeadersSize += 30 + entry.nameBytes.length + entry.size;
  }

  let centralDirSize = 0;
  for (const entry of fileEntries) {
    // 46 bytes fixed central directory header + name length
    centralDirSize += 46 + entry.nameBytes.length;
  }

  // 22 bytes fixed End of Central Directory record (EOCD)
  const totalZipSize = totalLocalHeadersSize + centralDirSize + 22;
  const buffer = new Uint8Array(totalZipSize);
  const view = new DataView(buffer.buffer);

  let offset = 0;
  const localOffsets: number[] = [];

  // 1. Write Local File Headers and Data
  for (const entry of fileEntries) {
    localOffsets.push(offset);

    // Local file header signature: 0x04034b50
    view.setUint32(offset, 0x04034b50, true);
    // Version needed to extract: 2.0 (20)
    view.setUint16(offset + 4, 20, true);
    // General purpose bit flag: 0x0800 (bit 11 = UTF-8 filename encoding)
    view.setUint16(offset + 6, 0x0800, true);
    // Compression method: 0 (Store / uncompressed)
    view.setUint16(offset + 8, 0, true);
    // Last mod file time (DOS format: 00:00:00)
    view.setUint16(offset + 10, 0, true);
    // Last mod file date (DOS format: 1980-01-01)
    view.setUint16(offset + 12, 0x0021, true);
    // CRC-32
    view.setUint32(offset + 14, entry.crc, true);
    // Compressed size
    view.setUint32(offset + 18, entry.size, true);
    // Uncompressed size
    view.setUint32(offset + 22, entry.size, true);
    // File name length
    view.setUint16(offset + 26, entry.nameBytes.length, true);
    // Extra field length: 0
    view.setUint16(offset + 28, 0, true);

    offset += 30;

    // File name bytes
    buffer.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;

    // File data
    buffer.set(entry.data, offset);
    offset += entry.size;
  }

  const centralDirStartOffset = offset;

  // 2. Write Central Directory Headers
  for (let i = 0; i < fileEntries.length; i++) {
    const entry = fileEntries[i];
    const localHeaderOffset = localOffsets[i];

    // Central directory header signature: 0x02014b50
    view.setUint32(offset, 0x02014b50, true);
    // Version made by: 20
    view.setUint16(offset + 4, 20, true);
    // Version needed to extract: 20
    view.setUint16(offset + 6, 20, true);
    // General purpose bit flag: 0x0800 (UTF-8)
    view.setUint16(offset + 8, 0x0800, true);
    // Compression method: 0
    view.setUint16(offset + 10, 0, true);
    // Last mod file time: 0
    view.setUint16(offset + 12, 0, true);
    // Last mod file date: 0x0021
    view.setUint16(offset + 14, 0x0021, true);
    // CRC-32
    view.setUint32(offset + 16, entry.crc, true);
    // Compressed size
    view.setUint32(offset + 20, entry.size, true);
    // Uncompressed size
    view.setUint32(offset + 24, entry.size, true);
    // File name length
    view.setUint16(offset + 28, entry.nameBytes.length, true);
    // Extra field length: 0
    view.setUint16(offset + 30, 0, true);
    // File comment length: 0
    view.setUint16(offset + 32, 0, true);
    // Disk number start: 0
    view.setUint16(offset + 34, 0, true);
    // Internal file attributes: 0
    view.setUint16(offset + 36, 0, true);
    // External file attributes: 0
    view.setUint32(offset + 38, 0, true);
    // Relative offset of local header
    view.setUint32(offset + 42, localHeaderOffset, true);

    offset += 46;

    // File name bytes
    buffer.set(entry.nameBytes, offset);
    offset += entry.nameBytes.length;
  }

  // 3. Write End of Central Directory Record (EOCD)
  // EOCD signature: 0x06054b50
  view.setUint32(offset, 0x06054b50, true);
  // Number of this disk: 0
  view.setUint16(offset + 4, 0, true);
  // Disk where central directory starts: 0
  view.setUint16(offset + 6, 0, true);
  // Number of central directory records on this disk
  view.setUint16(offset + 8, fileEntries.length, true);
  // Total number of central directory records
  view.setUint16(offset + 10, fileEntries.length, true);
  // Size of central directory (bytes)
  view.setUint32(offset + 12, centralDirSize, true);
  // Offset of start of central directory
  view.setUint32(offset + 16, centralDirStartOffset, true);
  // ZIP file comment length: 0
  view.setUint16(offset + 20, 0, true);

  return buffer;
}
