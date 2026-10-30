import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import JSZip from 'jszip';
import type { BookFormat, BookMeta } from '../shared/types';

/**
 * Extract metadata and cover for any supported format.
 */
export async function extractMetadata(
  filePath: string,
  format: BookFormat,
  coversDir: string
): Promise<Partial<BookMeta>> {
  await fsp.mkdir(coversDir, { recursive: true });
  const stat = await fsp.stat(filePath);
  const fileSize = stat.size;
  const basename = path.basename(filePath, path.extname(filePath));

  const baseResult: Partial<BookMeta> = {
    filePath,
    format,
    title: basename,
    author: 'Unknown',
    fileSize,
    dateAdded: Date.now(),
    progress: 0,
    tags: [],
    collectionIds: [],
  };

  try {
    switch (format) {
      case 'epub':
        return await extractEpubMetadata(filePath, coversDir, baseResult);
      case 'pdf':
        return await extractPdfMetadata(filePath, coversDir, baseResult);
      case 'mobi':
      case 'azw3':
      case 'kf8':
        return await extractMobiMetadata(filePath, coversDir, baseResult);
      case 'fb2':
        return await extractFb2Metadata(filePath, coversDir, baseResult);
      case 'cbz':
        return await extractCbzMetadata(filePath, coversDir, baseResult);
      case 'cbr':
        return baseResult;
      case 'docx':
        return await extractDocxMetadata(filePath, coversDir, baseResult);
      case 'html':
        return await extractHtmlMetadata(filePath, baseResult);
      case 'markdown':
      case 'txt':
      default:
        return await extractTextMetadata(filePath, baseResult);
    }
  } catch (err) {
    console.warn(`[metadata] Failed to extract rich metadata for ${filePath}:`, err);
    return baseResult;
  }
}

/**
 * Helper to save buffer to coversDir and return relative or absolute file path
 */
async function saveCoverImage(coversDir: string, data: Buffer | Uint8Array, ext = 'jpg'): Promise<string> {
  const hash = crypto.randomUUID();
  const filename = `cover_${hash}.${ext}`;
  const coverPath = path.join(coversDir, filename);
  await fsp.writeFile(coverPath, data);
  return coverPath;
}

/**
 * EPUB metadata extractor
 */
async function extractEpubMetadata(
  filePath: string,
  coversDir: string,
  base: Partial<BookMeta>
): Promise<Partial<BookMeta>> {
  const data = await fsp.readFile(filePath);
  const zip = await JSZip.loadAsync(data);

  // 1. Find rootfile from META-INF/container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) return base;

  const containerXml = await containerFile.async('text');
  const opfPathMatch = containerXml.match(/full-path\s*=\s*["']([^"']+)["']/i);
  if (!opfPathMatch) return base;

  const opfPath = opfPathMatch[1];
  const opfDir = path.posix.dirname(opfPath);
  const opfFile = zip.file(opfPath);
  if (!opfFile) return base;

  const opfText = await opfFile.async('text');

  // Extract Dublin Core fields
  const titleMatch = opfText.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const authorMatch = opfText.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);
  const publisherMatch = opfText.match(/<dc:publisher[^>]*>([^<]+)<\/dc:publisher>/i);
  const langMatch = opfText.match(/<dc:language[^>]*>([^<]+)<\/dc:language>/i);
  const descMatch = opfText.match(/<dc:description[^>]*>([\s\S]*?)<\/dc:description>/i);
  const isbnMatch = opfText.match(/<dc:identifier[^>]*>(?:urn:isbn:)?([^<]+)<\/dc:identifier>/i);

  let coverPath: string | undefined = undefined;

  // Try finding cover in manifest
  // Pattern A: manifest item with properties="cover-image"
  let coverHref: string | null = null;
  const coverPropMatch = opfText.match(/<item[^>]+properties\s*=\s*["'][^"']*cover-image[^"']*["'][^>]*href\s*=\s*["']([^"']+)["']/i);
  if (coverPropMatch) {
    coverHref = coverPropMatch[1];
  } else {
    // Pattern B: meta name="cover" content="cover-id"
    const metaCoverMatch = opfText.match(/<meta\s+name\s*=\s*["']cover["']\s+content\s*=\s*["']([^"']+)["']/i);
    if (metaCoverMatch) {
      const coverId = metaCoverMatch[1];
      const itemMatch = opfText.match(new RegExp(`<item[^>]+id\\s*=\\s*["']${coverId}["'][^>]+href\\s*=\\s*["']([^"']+)["']`, 'i'));
      if (itemMatch) {
        coverHref = itemMatch[1];
      }
    }
  }

  // Pattern C: any item with id="cover" or id="cover-image"
  if (!coverHref) {
    const fallbackItem = opfText.match(/<item[^>]+id\s*=\s*["'](?:cover|cover-image)["'][^>]+href\s*=\s*["']([^"']+)["']/i);
    if (fallbackItem) {
      coverHref = fallbackItem[1];
    }
  }

  if (coverHref) {
    const fullCoverHref = opfDir === '.' ? coverHref : path.posix.join(opfDir, coverHref);
    const coverFile = zip.file(fullCoverHref) || zip.file(decodeURIComponent(fullCoverHref));
    if (coverFile) {
      const coverBuf = await coverFile.async('nodebuffer');
      const ext = path.extname(coverHref).replace('.', '') || 'jpg';
      coverPath = await saveCoverImage(coversDir, coverBuf, ext);
    }
  }

  return {
    ...base,
    title: titleMatch ? decodeXml(titleMatch[1].trim()) : base.title,
    author: authorMatch ? decodeXml(authorMatch[1].trim()) : 'Unknown',
    publisher: publisherMatch ? decodeXml(publisherMatch[1].trim()) : undefined,
    language: langMatch ? langMatch[1].trim() : undefined,
    description: descMatch ? stripTags(decodeXml(descMatch[1].trim())) : undefined,
    isbn: isbnMatch ? isbnMatch[1].trim() : undefined,
    coverPath,
  };
}

/**
 * Simple PDF metadata extraction from header / info dictionary
 */
async function extractPdfMetadata(
  filePath: string,
  _coversDir: string,
  base: Partial<BookMeta>
): Promise<Partial<BookMeta>> {
  const handle = await fsp.open(filePath, 'r');
  const buffer = Buffer.alloc(65536);
  await handle.read(buffer, 0, 65536, 0);
  await handle.close();

  const text = buffer.toString('latin1');
  const titleMatch = text.match(/\/Title\s*\(([^)]+)\)/i);
  const authorMatch = text.match(/\/Author\s*\(([^)]+)\)/i);

  return {
    ...base,
    title: titleMatch ? cleanPdfString(titleMatch[1]) : base.title,
    author: authorMatch ? cleanPdfString(authorMatch[1]) : 'Unknown',
  };
}

/**
 * MOBI / AZW3 metadata extraction from PalmDOC/MOBI header
 */
async function extractMobiMetadata(
  filePath: string,
  _coversDir: string,
  base: Partial<BookMeta>
): Promise<Partial<BookMeta>> {
  const handle = await fsp.open(filePath, 'r');
  const header = Buffer.alloc(4096);
  await handle.read(header, 0, 4096, 0);
  await handle.close();

  let title = base.title;

  // The title in MOBI can often be found at offset specified in MOBI header
  // PalmDB header is 78 bytes. First record starts at offset read from record offset table.
  if (header.length > 86) {
    const firstRecordOffset = header.readUInt32BE(78);
    if (header.length >= firstRecordOffset + 100) {
      const mobiMagic = header.toString('ascii', firstRecordOffset + 16, firstRecordOffset + 24);
      if (mobiMagic === 'BOOKMOBI') {
        const fullTitleOffset = header.readUInt32BE(firstRecordOffset + 84);
        const fullTitleLength = header.readUInt32BE(firstRecordOffset + 88);
        const absTitleOffset = firstRecordOffset + fullTitleOffset;
        if (absTitleOffset + fullTitleLength <= header.length) {
          title = header.toString('utf8', absTitleOffset, absTitleOffset + fullTitleLength);
        }
      }
    }
  }

  return {
    ...base,
    title: title || base.title,
  };
}

/**
 * FB2 XML metadata extraction
 */
async function extractFb2Metadata(
  filePath: string,
  coversDir: string,
  base: Partial<BookMeta>
): Promise<Partial<BookMeta>> {
  let xmlText = '';
  if (filePath.endsWith('.zip')) {
    const data = await fsp.readFile(filePath);
    const zip = await JSZip.loadAsync(data);
    const fb2FileName = Object.keys(zip.files).find((f) => f.endsWith('.fb2'));
    if (fb2FileName) {
      xmlText = await zip.file(fb2FileName)!.async('text');
    }
  } else {
    // Read first 256KB of XML
    const handle = await fsp.open(filePath, 'r');
    const buf = Buffer.alloc(262144);
    const { bytesRead } = await handle.read(buf, 0, 262144, 0);
    await handle.close();
    xmlText = buf.subarray(0, bytesRead).toString('utf8');
  }

  const titleMatch = xmlText.match(/<book-title[^>]*>([^<]+)<\/book-title>/i);
  const firstMatch = xmlText.match(/<first-name[^>]*>([^<]+)<\/first-name>/i);
  const lastMatch = xmlText.match(/<last-name[^>]*>([^<]+)<\/last-name>/i);
  const author = [firstMatch?.[1], lastMatch?.[1]].filter(Boolean).join(' ') || 'Unknown';

  let coverPath: string | undefined;
  // Look for cover image binary block
  const coverImageMatch = xmlText.match(/<coverpage>[\s\S]*?<image[^>]+href=["']#([^"']+)["']/i);
  if (coverImageMatch) {
    const coverId = coverImageMatch[1];
    const binaryMatch = xmlText.match(new RegExp(`<binary[^>]+id=["']${coverId}["'][^>]*>([A-Za-z0-9+/=\\s]+)<\\/binary>`, 'i'));
    if (binaryMatch) {
      const base64Data = binaryMatch[1].replace(/\s/g, '');
      const coverBuf = Buffer.from(base64Data, 'base64');
      coverPath = await saveCoverImage(coversDir, coverBuf, 'jpg');
    }
  }

  return {
    ...base,
    title: titleMatch ? decodeXml(titleMatch[1].trim()) : base.title,
    author: author !== 'Unknown' ? decodeXml(author) : 'Unknown',
    coverPath,
  };
}

/**
 * CBZ metadata extraction (First image as cover)
 */
async function extractCbzMetadata(
  filePath: string,
  coversDir: string,
  base: Partial<BookMeta>
): Promise<Partial<BookMeta>> {
  const data = await fsp.readFile(filePath);
  const zip = await JSZip.loadAsync(data);

  // Find first image sorted alphabetically
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
  const imageFiles = Object.keys(zip.files)
    .filter((name) => !zip.files[name].dir && imageExtensions.some((ext) => name.toLowerCase().endsWith(ext)))
    .sort();

  let coverPath: string | undefined;
  if (imageFiles.length > 0) {
    const firstImg = zip.file(imageFiles[0]);
    if (firstImg) {
      const imgBuf = await firstImg.async('nodebuffer');
      const ext = path.extname(imageFiles[0]).replace('.', '') || 'jpg';
      coverPath = await saveCoverImage(coversDir, imgBuf, ext);
    }
  }

  return {
    ...base,
    pageCount: imageFiles.length,
    coverPath,
  };
}

/**
 * DOCX metadata extraction
 */
async function extractDocxMetadata(
  filePath: string,
  _coversDir: string,
  base: Partial<BookMeta>
): Promise<Partial<BookMeta>> {
  const data = await fsp.readFile(filePath);
  const zip = await JSZip.loadAsync(data);
  const coreFile = zip.file('docProps/core.xml');
  if (!coreFile) return base;

  const coreXml = await coreFile.async('text');
  const titleMatch = coreXml.match(/<dc:title[^>]*>([^<]+)<\/dc:title>/i);
  const authorMatch = coreXml.match(/<dc:creator[^>]*>([^<]+)<\/dc:creator>/i);

  return {
    ...base,
    title: titleMatch ? decodeXml(titleMatch[1].trim()) : base.title,
    author: authorMatch ? decodeXml(authorMatch[1].trim()) : 'Unknown',
  };
}

/**
 * HTML metadata extraction
 */
async function extractHtmlMetadata(filePath: string, base: Partial<BookMeta>): Promise<Partial<BookMeta>> {
  const handle = await fsp.open(filePath, 'r');
  const buf = Buffer.alloc(16384);
  const { bytesRead } = await handle.read(buf, 0, 16384, 0);
  await handle.close();

  const text = buf.subarray(0, bytesRead).toString('utf8');
  const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
  const authorMatch = text.match(/<meta[^>]+name=["']author["'][^>]+content=["']([^"']+)["']/i);

  return {
    ...base,
    title: titleMatch ? decodeXml(titleMatch[1].trim()) : base.title,
    author: authorMatch ? decodeXml(authorMatch[1].trim()) : 'Unknown',
  };
}

/**
 * TXT / Markdown metadata extraction
 */
async function extractTextMetadata(filePath: string, base: Partial<BookMeta>): Promise<Partial<BookMeta>> {
  const handle = await fsp.open(filePath, 'r');
  const buf = Buffer.alloc(4096);
  const { bytesRead } = await handle.read(buf, 0, 4096, 0);
  await handle.close();

  const text = buf.subarray(0, bytesRead).toString('utf8');
  const firstLine = text.split(/\r?\n/).map((l) => l.trim()).find((l) => l.length > 0);

  if (firstLine && firstLine.startsWith('# ')) {
    return {
      ...base,
      title: firstLine.replace(/^#\s+/, '').trim() || base.title,
    };
  }

  return base;
}

function decodeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '').trim();
}

function cleanPdfString(str: string): string {
  return str.replace(/\\([()\\])/g, '$1').trim();
}

