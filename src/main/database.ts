import path from 'path';
import { app } from 'electron';
import Database from 'better-sqlite3';
import { DB_FILENAME } from '../shared/constants';
import type {
  BookMeta,
  Collection,
  Annotation,
  ReadingSession,
  AppSettings,
} from '../shared/types';
import { DEFAULT_APP_SETTINGS } from '../shared/constants';

let db: Database.Database;

/* ─────────────────────────── Initialisation ─────────────────────────── */

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), DB_FILENAME);
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id TEXT PRIMARY KEY,
      filePath TEXT NOT NULL UNIQUE,
      format TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT '',
      author TEXT NOT NULL DEFAULT '',
      publisher TEXT DEFAULT '',
      language TEXT DEFAULT '',
      isbn TEXT DEFAULT '',
      description TEXT DEFAULT '',
      coverPath TEXT DEFAULT '',
      fileSize INTEGER NOT NULL DEFAULT 0,
      pageCount INTEGER DEFAULT 0,
      dateAdded INTEGER NOT NULL,
      lastRead INTEGER,
      progress REAL NOT NULL DEFAULT 0,
      lastPosition TEXT DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      color TEXT DEFAULT '',
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS book_collections (
      bookId TEXT NOT NULL,
      collectionId TEXT NOT NULL,
      PRIMARY KEY (bookId, collectionId),
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE,
      FOREIGN KEY (collectionId) REFERENCES collections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS annotations (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      type TEXT NOT NULL,
      cfi TEXT DEFAULT '',
      page INTEGER,
      color TEXT DEFAULT '',
      text TEXT DEFAULT '',
      note TEXT DEFAULT '',
      chapter TEXT DEFAULT '',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reading_sessions (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      startTime INTEGER NOT NULL,
      endTime INTEGER NOT NULL,
      pagesRead INTEGER NOT NULL DEFAULT 0,
      startProgress REAL NOT NULL DEFAULT 0,
      endProgress REAL NOT NULL DEFAULT 0,
      FOREIGN KEY (bookId) REFERENCES books(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

/* ─────────────────────────── Helpers ─────────────────────────── */

function parseTags(raw: string): string[] {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function rowToBookMeta(row: any): BookMeta {
  const collectionRows = stmts.getBookCollections.all(row.id) as { collectionId: string }[];
  return {
    id: row.id,
    filePath: row.filePath,
    format: row.format,
    title: row.title,
    author: row.author,
    publisher: row.publisher || undefined,
    language: row.language || undefined,
    isbn: row.isbn || undefined,
    description: row.description || undefined,
    coverPath: row.coverPath || undefined,
    fileSize: row.fileSize,
    pageCount: row.pageCount || undefined,
    dateAdded: row.dateAdded,
    lastRead: row.lastRead || undefined,
    progress: row.progress,
    lastPosition: row.lastPosition || undefined,
    tags: parseTags(row.tags),
    collectionIds: collectionRows.map((r) => r.collectionId),
  };
}

/* ─────────────────────────── Prepared Statements (lazy init) ─────────────────────────── */

interface Stmts {
  insertBook: Database.Statement;
  getBooks: Database.Statement;
  getBook: Database.Statement;
  updateBook: Database.Statement;
  deleteBook: Database.Statement;
  getBookByPath: Database.Statement;
  getBookCollections: Database.Statement;
  insertBookCollection: Database.Statement;
  deleteBookCollections: Database.Statement;
  insertCollection: Database.Statement;
  getCollections: Database.Statement;
  getCollection: Database.Statement;
  deleteCollection: Database.Statement;
  updateCollection: Database.Statement;
  insertAnnotation: Database.Statement;
  getAnnotations: Database.Statement;
  getAnnotation: Database.Statement;
  updateAnnotation: Database.Statement;
  deleteAnnotation: Database.Statement;
  insertSession: Database.Statement;
  getSessions: Database.Statement;
  getSetting: Database.Statement;
  setSetting: Database.Statement;
  totalBooks: Database.Statement;
  totalTime: Database.Statement;
  booksRead: Database.Statement;
}

let _stmts: Stmts | null = null;

function getStmts(): Stmts {
  if (_stmts) return _stmts;
  _stmts = {
    insertBook: db.prepare(`
      INSERT INTO books (id, filePath, format, title, author, publisher, language, isbn, description, coverPath, fileSize, pageCount, dateAdded, lastRead, progress, lastPosition, tags)
      VALUES (@id, @filePath, @format, @title, @author, @publisher, @language, @isbn, @description, @coverPath, @fileSize, @pageCount, @dateAdded, @lastRead, @progress, @lastPosition, @tags)
    `),
    getBooks: db.prepare('SELECT * FROM books ORDER BY dateAdded DESC'),
    getBook: db.prepare('SELECT * FROM books WHERE id = ?'),
    updateBook: null as any,
    deleteBook: db.prepare('DELETE FROM books WHERE id = ?'),
    getBookByPath: db.prepare('SELECT * FROM books WHERE filePath = ?'),
    getBookCollections: db.prepare('SELECT collectionId FROM book_collections WHERE bookId = ?'),
    insertBookCollection: db.prepare('INSERT OR IGNORE INTO book_collections (bookId, collectionId) VALUES (?, ?)'),
    deleteBookCollections: db.prepare('DELETE FROM book_collections WHERE bookId = ?'),
    insertCollection: db.prepare('INSERT INTO collections (id, name, color, createdAt) VALUES (@id, @name, @color, @createdAt)'),
    getCollections: db.prepare('SELECT * FROM collections ORDER BY createdAt DESC'),
    getCollection: db.prepare('SELECT * FROM collections WHERE id = ?'),
    deleteCollection: db.prepare('DELETE FROM collections WHERE id = ?'),
    updateCollection: null as any,
    insertAnnotation: db.prepare(`
      INSERT INTO annotations (id, bookId, type, cfi, page, color, text, note, chapter, createdAt, updatedAt)
      VALUES (@id, @bookId, @type, @cfi, @page, @color, @text, @note, @chapter, @createdAt, @updatedAt)
    `),
    getAnnotations: db.prepare('SELECT * FROM annotations WHERE bookId = ? ORDER BY createdAt DESC'),
    getAnnotation: db.prepare('SELECT * FROM annotations WHERE id = ?'),
    updateAnnotation: null as any,
    deleteAnnotation: db.prepare('DELETE FROM annotations WHERE id = ?'),
    insertSession: db.prepare(`
      INSERT INTO reading_sessions (id, bookId, startTime, endTime, pagesRead, startProgress, endProgress)
      VALUES (@id, @bookId, @startTime, @endTime, @pagesRead, @startProgress, @endProgress)
    `),
    getSessions: db.prepare('SELECT * FROM reading_sessions WHERE bookId = ? ORDER BY startTime DESC'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'),
    totalBooks: db.prepare('SELECT COUNT(*) as count FROM books'),
    totalTime: db.prepare('SELECT COALESCE(SUM(endTime - startTime), 0) as total FROM reading_sessions'),
    booksRead: db.prepare('SELECT COUNT(*) as count FROM books WHERE progress >= 0.95'),
  };
  return _stmts;
}

const stmts: Stmts = new Proxy({} as Stmts, {
  get: (_, prop: string) => (getStmts() as any)[prop],
});

/* ─────────────────────────── Books CRUD ─────────────────────────── */

export function getBooks(): BookMeta[] {
  const rows = stmts.getBooks.all() as any[];
  return rows.map(rowToBookMeta);
}

export function getBook(id: string): BookMeta | null {
  const row = stmts.getBook.get(id) as any | undefined;
  return row ? rowToBookMeta(row) : null;
}

export function getBookByPath(filePath: string): BookMeta | null {
  const row = stmts.getBookByPath.get(filePath) as any | undefined;
  return row ? rowToBookMeta(row) : null;
}

export function addBook(data: Omit<BookMeta, 'id'>): BookMeta {
  const id = crypto.randomUUID();
  stmts.insertBook.run({
    id,
    filePath: data.filePath,
    format: data.format,
    title: data.title,
    author: data.author,
    publisher: data.publisher ?? '',
    language: data.language ?? '',
    isbn: data.isbn ?? '',
    description: data.description ?? '',
    coverPath: data.coverPath ?? '',
    fileSize: data.fileSize,
    pageCount: data.pageCount ?? 0,
    dateAdded: data.dateAdded,
    lastRead: data.lastRead ?? null,
    progress: data.progress,
    lastPosition: data.lastPosition ?? '',
    tags: JSON.stringify(data.tags ?? []),
  });

  // Insert collection associations
  if (data.collectionIds && data.collectionIds.length > 0) {
    for (const collectionId of data.collectionIds) {
      stmts.insertBookCollection.run(id, collectionId);
    }
  }

  return getBook(id)!;
}

export function updateBook(id: string, updates: Partial<BookMeta>): void {
  const allowedFields = [
    'filePath', 'format', 'title', 'author', 'publisher', 'language', 'isbn',
    'description', 'coverPath', 'fileSize', 'pageCount', 'dateAdded', 'lastRead',
    'progress', 'lastPosition', 'tags',
  ];
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (key === 'collectionIds') continue;
    if (!allowedFields.includes(key)) continue;
    setClauses.push(`${key} = ?`);
    if (key === 'tags') {
      values.push(JSON.stringify(value));
    } else {
      values.push(value ?? null);
    }
  }

  if (setClauses.length > 0) {
    values.push(id);
    db.prepare(`UPDATE books SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }

  // Handle collection associations
  if (updates.collectionIds !== undefined) {
    stmts.deleteBookCollections.run(id);
    for (const collectionId of updates.collectionIds) {
      stmts.insertBookCollection.run(id, collectionId);
    }
  }
}

export function deleteBook(id: string): void {
  stmts.deleteBookCollections.run(id);
  stmts.deleteBook.run(id);
}

/* ─────────────────────────── Collections CRUD ─────────────────────────── */

export function getCollections(): Collection[] {
  return stmts.getCollections.all() as Collection[];
}

export function addCollection(name: string, color?: string): Collection {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  stmts.insertCollection.run({ id, name, color: color ?? '', createdAt });
  return { id, name, color: color ?? undefined, createdAt };
}

export function deleteCollection(id: string): void {
  stmts.deleteCollection.run(id);
}

export function updateCollection(id: string, updates: Partial<Collection>): void {
  const setClauses: string[] = [];
  const values: any[] = [];
  if (updates.name !== undefined) {
    setClauses.push('name = ?');
    values.push(updates.name);
  }
  if (updates.color !== undefined) {
    setClauses.push('color = ?');
    values.push(updates.color);
  }
  if (setClauses.length > 0) {
    values.push(id);
    db.prepare(`UPDATE collections SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }
}

/* ─────────────────────────── Annotations CRUD ─────────────────────────── */

export function getAnnotations(bookId: string): Annotation[] {
  return stmts.getAnnotations.all(bookId) as Annotation[];
}

export function addAnnotation(data: Omit<Annotation, 'id'>): Annotation {
  const id = crypto.randomUUID();
  stmts.insertAnnotation.run({
    id,
    bookId: data.bookId,
    type: data.type,
    cfi: data.cfi ?? '',
    page: data.page ?? null,
    color: data.color ?? '',
    text: data.text ?? '',
    note: data.note ?? '',
    chapter: data.chapter ?? '',
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  });
  return { id, ...data };
}

export function updateAnnotation(id: string, updates: Partial<Annotation>): void {
  const allowedFields = ['type', 'cfi', 'page', 'color', 'text', 'note', 'chapter', 'updatedAt'];
  const setClauses: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    if (!allowedFields.includes(key)) continue;
    setClauses.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (setClauses.length > 0) {
    // Always update updatedAt
    if (!updates.updatedAt) {
      setClauses.push('updatedAt = ?');
      values.push(Date.now());
    }
    values.push(id);
    db.prepare(`UPDATE annotations SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
  }
}

export function deleteAnnotation(id: string): void {
  stmts.deleteAnnotation.run(id);
}

export function exportAnnotations(bookId: string, format: 'markdown' | 'json'): string {
  const annotations = getAnnotations(bookId);
  const book = getBook(bookId);
  const bookTitle = book?.title ?? 'Unknown';

  if (format === 'json') {
    return JSON.stringify({ book: bookTitle, annotations }, null, 2);
  }

  // Markdown format
  const lines: string[] = [];
  lines.push(`# Annotations: ${bookTitle}`);
  lines.push('');
  lines.push(`**Author:** ${book?.author ?? 'Unknown'}`);
  lines.push(`**Total annotations:** ${annotations.length}`);
  lines.push('');

  // Group by chapter
  const byChapter = new Map<string, Annotation[]>();
  for (const a of annotations) {
    const ch = a.chapter || 'Uncategorized';
    if (!byChapter.has(ch)) byChapter.set(ch, []);
    byChapter.get(ch)!.push(a);
  }

  for (const [chapter, anns] of byChapter) {
    lines.push(`## ${chapter}`);
    lines.push('');
    for (const a of anns) {
      const date = new Date(a.createdAt).toLocaleDateString();
      if (a.type === 'highlight' && a.text) {
        const colorTag = a.color ? ` [${a.color}]` : '';
        lines.push(`> ${a.text}${colorTag}`);
        if (a.note) {
          lines.push('');
          lines.push(`**Note:** ${a.note}`);
        }
        lines.push(`*— ${date}*`);
        lines.push('');
      } else if (a.type === 'note') {
        lines.push(`📝 **Note:** ${a.note ?? ''}`);
        if (a.text) {
          lines.push(`> ${a.text}`);
        }
        lines.push(`*— ${date}*`);
        lines.push('');
      } else if (a.type === 'bookmark') {
        const pageStr = a.page ? ` (p. ${a.page})` : '';
        lines.push(`🔖 **Bookmark**${pageStr}`);
        if (a.note) lines.push(`**Note:** ${a.note}`);
        lines.push(`*— ${date}*`);
        lines.push('');
      }
    }
  }

  return lines.join('\n');
}

/* ─────────────────────────── Reading Sessions ─────────────────────────── */

export function addReadingSession(data: Omit<ReadingSession, 'id'>): void {
  const id = crypto.randomUUID();
  stmts.insertSession.run({
    id,
    bookId: data.bookId,
    startTime: data.startTime,
    endTime: data.endTime,
    pagesRead: data.pagesRead,
    startProgress: data.startProgress,
    endProgress: data.endProgress,
  });
}

export function getReadingSessions(bookId: string): ReadingSession[] {
  return stmts.getSessions.all(bookId) as ReadingSession[];
}

export function getStats(): { totalBooks: number; totalTime: number; booksRead: number } {
  const totalBooks = (stmts.totalBooks.get() as any).count;
  const totalTime = (stmts.totalTime.get() as any).total;
  const booksRead = (stmts.booksRead.get() as any).count;
  return { totalBooks, totalTime, booksRead };
}

/* ─────────────────────────── Settings ─────────────────────────── */

export function getSettings(): AppSettings {
  const row = stmts.getSetting.get('appSettings') as { value: string } | undefined;
  if (row) {
    try {
      const saved = JSON.parse(row.value) as Partial<AppSettings>;
      return { ...DEFAULT_APP_SETTINGS, ...saved, reader: { ...DEFAULT_APP_SETTINGS.reader, ...(saved.reader ?? {}) } };
    } catch {
      return { ...DEFAULT_APP_SETTINGS };
    }
  }
  return { ...DEFAULT_APP_SETTINGS };
}

export function setSettings(updates: Partial<AppSettings>): void {
  const current = getSettings();
  const merged: AppSettings = {
    ...current,
    ...updates,
    reader: { ...current.reader, ...(updates.reader ?? {}) },
  };
  stmts.setSetting.run('appSettings', JSON.stringify(merged));
}

/* ─────────────────────────── Close ─────────────────────────── */

export function closeDatabase(): void {
  if (db) {
    db.close();
  }
}
