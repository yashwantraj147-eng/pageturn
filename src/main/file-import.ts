import path from 'path';
import fsp from 'fs/promises';
import { app } from 'electron';
import { detectFormat } from './format-detect';
import { extractMetadata } from './metadata';
import { addBook, getBookByPath } from './database';
import { COVERS_DIR, SUPPORTED_EXTENSIONS } from '../shared/constants';
import type { BookMeta } from '../shared/types';

export function getCoversDir(): string {
  return path.join(app.getPath('userData'), COVERS_DIR);
}

/**
 * Import a single file into the library database.
 */
export async function importFile(filePath: string): Promise<BookMeta> {
  const existing = getBookByPath(filePath);
  if (existing) {
    return existing;
  }

  const detection = await detectFormat(filePath);
  if (!detection) {
    throw new Error(`Unsupported file format for "${path.basename(filePath)}"`);
  }

  if (detection.drm) {
    throw new Error(
      `File "${path.basename(filePath)}" is protected by DRM and cannot be opened.`
    );
  }

  const coversDir = getCoversDir();
  const meta = await extractMetadata(filePath, detection.format, coversDir);

  const newBook = addBook({
    filePath,
    format: detection.format,
    title: meta.title || path.basename(filePath, path.extname(filePath)),
    author: meta.author || 'Unknown',
    publisher: meta.publisher,
    language: meta.language,
    isbn: meta.isbn,
    description: meta.description,
    coverPath: meta.coverPath,
    fileSize: meta.fileSize || 0,
    pageCount: meta.pageCount || 0,
    dateAdded: Date.now(),
    progress: 0,
    tags: meta.tags || [],
    collectionIds: meta.collectionIds || [],
  });

  return newBook;
}

/**
 * Scan a directory recursively for supported e-book files.
 */
export async function scanFolder(folderPath: string): Promise<string[]> {
  const results: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        const base = entry.name.toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext) || base.endsWith('.fb2.zip')) {
          results.push(fullPath);
        }
      }
    }
  }

  await walk(folderPath);
  return results;
}

/**
 * Bulk import multiple files.
 */
export async function bulkImport(
  filePaths: string[]
): Promise<{ imported: BookMeta[]; failed: { path: string; error: string }[] }> {
  const imported: BookMeta[] = [];
  const failed: { path: string; error: string }[] = [];

  for (const fp of filePaths) {
    try {
      const book = await importFile(fp);
      imported.push(book);
    } catch (err: any) {
      failed.push({ path: fp, error: err?.message || 'Import failed' });
    }
  }

  return { imported, failed };
}

