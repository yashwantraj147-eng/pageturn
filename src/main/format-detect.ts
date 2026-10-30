import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { FORMAT_SIGNATURES, EPUB_MIMETYPE } from '../shared/constants';
import type { BookFormat } from '../shared/types';

interface FormatResult {
  format: BookFormat;
  drm: boolean;
}

/**
 * Read the first `n` bytes of a file.
 */
async function readHead(filePath: string, n: number): Promise<Buffer> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(n);
    const { bytesRead } = await handle.read(buf, 0, n, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

/**
 * Check whether the header buffer matches a signature entry.
 */
function matchesSignature(
  header: Buffer,
  sigs: { offset: number; bytes: number[] | string }[],
): boolean {
  for (const sig of sigs) {
    if (typeof sig.bytes === 'string') {
      const str = header.toString('ascii', sig.offset, sig.offset + sig.bytes.length);
      if (str !== sig.bytes) return false;
    } else {
      for (let i = 0; i < sig.bytes.length; i++) {
        if (header[sig.offset + i] !== sig.bytes[i]) return false;
      }
    }
  }
  return true;
}

/**
 * Minimal zip central-directory reader that lists file names inside a zip.
 * We only read the local file headers sequentially (faster for small look-ups).
 */
async function listZipEntries(filePath: string, maxEntries = 500): Promise<string[]> {
  const handle = await fsp.open(filePath, 'r');
  const entries: string[] = [];
  try {
    const stat = await handle.stat();
    const fileSize = stat.size;
    let offset = 0;
    const sigBuf = Buffer.alloc(4);
    const headerBuf = Buffer.alloc(30);

    while (offset < fileSize && entries.length < maxEntries) {
      await handle.read(sigBuf, 0, 4, offset);
      // Check for local file header signature PK\x03\x04
      if (sigBuf[0] !== 0x50 || sigBuf[1] !== 0x4b || sigBuf[2] !== 0x03 || sigBuf[3] !== 0x04) {
        break;
      }
      await handle.read(headerBuf, 0, 30, offset);
      const nameLen = headerBuf.readUInt16LE(26);
      const extraLen = headerBuf.readUInt16LE(28);
      const compressedSize = headerBuf.readUInt32LE(18);
      const nameBuf = Buffer.alloc(nameLen);
      await handle.read(nameBuf, 0, nameLen, offset + 30);
      entries.push(nameBuf.toString('utf8'));

      // Check for data descriptor flag (bit 3 of general purpose bit flag)
      const flags = headerBuf.readUInt16LE(6);
      const hasDataDescriptor = (flags & 0x08) !== 0;

      offset += 30 + nameLen + extraLen + compressedSize;

      if (hasDataDescriptor) {
        // Skip data descriptor (12 or 16 bytes)
        const ddSig = Buffer.alloc(4);
        await handle.read(ddSig, 0, 4, offset);
        if (ddSig[0] === 0x50 && ddSig[1] === 0x4b && ddSig[2] === 0x07 && ddSig[3] === 0x08) {
          offset += 16; // signature + crc32 + compressed + uncompressed
        } else {
          offset += 12; // crc32 + compressed + uncompressed
        }
      }
    }
  } finally {
    await handle.close();
  }
  return entries;
}

/**
 * Read a small file entry from a zip (e.g. the "mimetype" entry at offset 0).
 */
async function readZipEntry(filePath: string, entryName: string): Promise<Buffer | null> {
  const handle = await fsp.open(filePath, 'r');
  try {
    const stat = await handle.stat();
    const fileSize = stat.size;
    let offset = 0;
    const headerBuf = Buffer.alloc(30);

    while (offset < fileSize) {
      await handle.read(headerBuf, 0, 30, offset);
      if (headerBuf[0] !== 0x50 || headerBuf[1] !== 0x4b || headerBuf[2] !== 0x03 || headerBuf[3] !== 0x04) {
        break;
      }
      const compressionMethod = headerBuf.readUInt16LE(8);
      const compressedSize = headerBuf.readUInt32LE(18);
      const uncompressedSize = headerBuf.readUInt32LE(22);
      const nameLen = headerBuf.readUInt16LE(26);
      const extraLen = headerBuf.readUInt16LE(28);
      const nameBuf = Buffer.alloc(nameLen);
      await handle.read(nameBuf, 0, nameLen, offset + 30);
      const name = nameBuf.toString('utf8');

      const dataOffset = offset + 30 + nameLen + extraLen;

      if (name === entryName && compressionMethod === 0 && uncompressedSize > 0) {
        const dataBuf = Buffer.alloc(uncompressedSize);
        await handle.read(dataBuf, 0, uncompressedSize, dataOffset);
        return dataBuf;
      }

      const flags = headerBuf.readUInt16LE(6);
      const hasDataDescriptor = (flags & 0x08) !== 0;
      offset = dataOffset + compressedSize;

      if (hasDataDescriptor) {
        const ddSig = Buffer.alloc(4);
        await handle.read(ddSig, 0, 4, offset);
        if (ddSig[0] === 0x50 && ddSig[1] === 0x4b && ddSig[2] === 0x07 && ddSig[3] === 0x08) {
          offset += 16;
        } else {
          offset += 12;
        }
      }
    }
  } finally {
    await handle.close();
  }
  return null;
}

/**
 * Check EPUB DRM by looking for encryption.xml with non-font encryption.
 */
async function checkEpubDrm(filePath: string, entries: string[]): Promise<boolean> {
  if (!entries.includes('META-INF/encryption.xml')) return false;
  try {
    const data = await readZipEntry(filePath, 'META-INF/encryption.xml');
    if (!data) return false;
    const xml = data.toString('utf8');
    // Font obfuscation uses idpf or adobe font URIs — those are NOT DRM
    const lines = xml.split('\n');
    for (const line of lines) {
      if (line.includes('EncryptedData')) {
        if (
          !line.includes('http://www.idpf.org/2008/embedding') &&
          !line.includes('http://ns.adobe.com/pdf/enc')
        ) {
          // Check the overall content more broadly
          if (
            xml.includes('http://www.w3.org/2001/04/xmlenc') &&
            !xml.match(/Algorithm="[^"]*font[^"]*"/i) &&
            !xml.includes('http://www.idpf.org/2008/embedding') &&
            !xml.includes('http://ns.adobe.com/pdf/enc#RC')
          ) {
            return true;
          }
        }
      }
    }
    // Simpler heuristic: if encryption.xml exists and has EncryptedData referencing
    // non-font resources, it's DRM
    const hasAdobe = xml.includes('http://ns.adobe.com/adept');
    const hasMarlin = xml.includes('http://marlin-drm.com');
    const hasReadium = xml.includes('http://readium.org/2014/01/lcp');
    return hasAdobe || hasMarlin || hasReadium;
  } catch {
    return false;
  }
}

/**
 * Identify the specific zip-based format.
 */
async function identifyZipFormat(filePath: string): Promise<FormatResult | null> {
  const entries = await listZipEntries(filePath);

  // Check EPUB: has "mimetype" file containing application/epub+zip
  const mimetypeData = await readZipEntry(filePath, 'mimetype');
  if (mimetypeData && mimetypeData.toString('utf8').trim() === EPUB_MIMETYPE) {
    const drm = await checkEpubDrm(filePath, entries);
    return { format: 'epub', drm };
  }

  // Check DOCX: has [Content_Types].xml with word-related content types
  if (entries.includes('[Content_Types].xml')) {
    const hasWordDir = entries.some(
      (e) => e.startsWith('word/') || e.includes('word/document.xml'),
    );
    if (hasWordDir) {
      return { format: 'docx', drm: false };
    }
  }

  // Check FB2.zip: contains a .fb2 file inside
  const hasFb2 = entries.some((e) => e.toLowerCase().endsWith('.fb2'));
  if (hasFb2) {
    return { format: 'fb2', drm: false };
  }

  // Check CBZ: contains image files
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
  const hasImages = entries.some((e) => {
    const ext = path.extname(e).toLowerCase();
    return imageExtensions.includes(ext);
  });
  if (hasImages) {
    return { format: 'cbz', drm: false };
  }

  return null;
}

/**
 * Check if a MOBI/AZW3 file has DRM by inspecting the MOBI header.
 * DRM flag is at the MOBI header's encryption type field.
 */
async function checkMobiDrm(filePath: string): Promise<boolean> {
  try {
    const handle = await fsp.open(filePath, 'r');
    try {
      // Read enough of the PalmDOC header
      const buf = Buffer.alloc(256);
      const { bytesRead } = await handle.read(buf, 0, 256, 0);
      if (bytesRead < 256) return false;

      // PalmDOC header: record 0 starts after the PDB header
      // Number of records at offset 76 (2 bytes)
      const numRecords = buf.readUInt16BE(76);
      if (numRecords < 1) return false;

      // First record offset at position 78 (4 bytes)
      const firstRecordOffset = buf.readUInt32BE(78);
      // Read the PalmDOC/MOBI header from the first record
      const mobiHeader = Buffer.alloc(128);
      await handle.read(mobiHeader, 0, 128, firstRecordOffset);

      // Encryption type at offset 12 in PalmDOC header (2 bytes)
      const encryption = mobiHeader.readUInt16BE(12);
      // 0 = no DRM, 1 = old Mobipocket, 2 = Mobipocket DRM
      return encryption !== 0;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

/**
 * Check if MOBI is actually KF8/AZW3 format.
 */
async function isMobiKf8(filePath: string): Promise<boolean> {
  try {
    const handle = await fsp.open(filePath, 'r');
    try {
      const buf = Buffer.alloc(256);
      await handle.read(buf, 0, 256, 0);
      const numRecords = buf.readUInt16BE(76);
      if (numRecords < 1) return false;
      const firstRecordOffset = buf.readUInt32BE(78);
      const mobiHeader = Buffer.alloc(256);
      const { bytesRead } = await handle.read(mobiHeader, 0, 256, firstRecordOffset);
      if (bytesRead < 132) return false;

      // MOBI header identifier at offset 16: "MOBI"
      const mobiId = mobiHeader.toString('ascii', 16, 20);
      if (mobiId !== 'MOBI') return false;

      // MOBI header version at offset 36 (4 bytes)
      const version = mobiHeader.readUInt32BE(36);
      // KF8 has version 8 (AZW3)
      return version >= 8;
    } finally {
      await handle.close();
    }
  } catch {
    return false;
  }
}

/**
 * Check if content is mostly text (no binary bytes other than whitespace).
 */
function isTextContent(buf: Buffer): boolean {
  let binaryCount = 0;
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0) return false; // null byte means binary
    if (b < 0x09 || (b > 0x0d && b < 0x20 && b !== 0x1b)) {
      binaryCount++;
    }
  }
  return binaryCount / buf.length < 0.05;
}

/**
 * Detect the format of a file by examining magic bytes and file structure.
 */
export async function detectFormat(filePath: string): Promise<FormatResult | null> {
  try {
    await fsp.access(filePath, fs.constants.R_OK);
  } catch {
    return null;
  }

  const header = await readHead(filePath, 256);
  if (header.length === 0) return null;

  const ext = path.extname(filePath).toLowerCase();
  const basename = path.basename(filePath).toLowerCase();

  // Check PDF
  if (matchesSignature(header, FORMAT_SIGNATURES.pdf)) {
    return { format: 'pdf', drm: false };
  }

  // Check MOBI/PDB
  if (header.length >= 68 && matchesSignature(header, FORMAT_SIGNATURES.mobi)) {
    const drm = await checkMobiDrm(filePath);
    const kf8 = await isMobiKf8(filePath);
    if (kf8) {
      return { format: 'azw3', drm };
    }
    return { format: 'mobi', drm };
  }

  // Check PDB (TEXtREAd) — older PalmDoc reader
  if (header.length >= 68 && matchesSignature(header, FORMAT_SIGNATURES.pdb)) {
    const drm = await checkMobiDrm(filePath);
    return { format: 'mobi', drm };
  }

  // Check ZIP-based formats (EPUB, DOCX, CBZ, FB2.zip)
  if (matchesSignature(header, FORMAT_SIGNATURES.zip)) {
    const result = await identifyZipFormat(filePath);
    if (result) return result;
  }

  // CBR: RAR archive (check Rar! signature)
  if (
    header.length >= 7 &&
    header[0] === 0x52 &&
    header[1] === 0x61 &&
    header[2] === 0x72 &&
    header[3] === 0x21 &&
    header[4] === 0x1a &&
    header[5] === 0x07
  ) {
    return { format: 'cbr', drm: false };
  }

  // AZW3/KF8 by extension (if magic bytes didn't catch it)
  if (ext === '.azw3' || ext === '.kf8') {
    const drm = await checkMobiDrm(filePath);
    return { format: ext === '.azw3' ? 'azw3' : 'kf8', drm };
  }

  // Check for FB2 (XML with <FictionBook)
  if (ext === '.fb2') {
    const text = header.toString('utf8');
    if (text.includes('<FictionBook') || text.includes('<?xml')) {
      return { format: 'fb2', drm: false };
    }
  }

  // Check for FB2.zip by double extension
  if (basename.endsWith('.fb2.zip')) {
    if (matchesSignature(header, FORMAT_SIGNATURES.zip)) {
      return { format: 'fb2', drm: false };
    }
  }

  // Markdown by extension
  if (ext === '.md' || ext === '.markdown') {
    return { format: 'markdown', drm: false };
  }

  // HTML detection
  if (ext === '.html' || ext === '.htm') {
    return { format: 'html', drm: false };
  }
  // Also check content for HTML
  if (isTextContent(header)) {
    const text = header.toString('utf8').trim().toLowerCase();
    if (text.startsWith('<!doctype html') || text.startsWith('<html') || text.includes('<html')) {
      return { format: 'html', drm: false };
    }
  }

  // TXT detection: fallback if text content and .txt extension
  if (ext === '.txt') {
    return { format: 'txt', drm: false };
  }
  if (isTextContent(header)) {
    return { format: 'txt', drm: false };
  }

  return null;
}
