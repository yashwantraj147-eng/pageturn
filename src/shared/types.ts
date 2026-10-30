/* ─── Book Formats ─── */
export type BookFormat =
  | 'epub'
  | 'pdf'
  | 'mobi'
  | 'azw3'
  | 'kf8'
  | 'fb2'
  | 'cbz'
  | 'cbr'
  | 'txt'
  | 'html'
  | 'markdown'
  | 'docx';

/* ─── Book ─── */
export interface BookMeta {
  id: string;
  filePath: string;
  format: BookFormat;
  title: string;
  author: string;
  publisher?: string;
  language?: string;
  isbn?: string;
  description?: string;
  coverPath?: string; // path to extracted cover image on disk
  fileSize: number;
  pageCount?: number;
  dateAdded: number; // unix ms
  lastRead?: number; // unix ms
  progress: number; // 0–1
  lastPosition?: string; // serialised CFI / page number / scroll offset
  tags: string[];
  collectionIds: string[];
}

/* ─── Collection / Shelf ─── */
export interface Collection {
  id: string;
  name: string;
  color?: string;
  createdAt: number;
}

/* ─── Annotations ─── */
export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'orange';

export interface Annotation {
  id: string;
  bookId: string;
  type: 'highlight' | 'note' | 'bookmark';
  cfi?: string; // EPUB CFI or custom position
  page?: number;
  color?: HighlightColor;
  text?: string; // highlighted text
  note?: string; // user note
  chapter?: string;
  createdAt: number;
  updatedAt: number;
}

/* ─── Reading Statistics ─── */
export interface ReadingSession {
  id: string;
  bookId: string;
  startTime: number;
  endTime: number;
  pagesRead: number;
  startProgress: number;
  endProgress: number;
}

/* ─── Settings ─── */
export type ThemeName = 'light' | 'dark' | 'sepia' | 'night' | 'custom';

export interface ReaderSettings {
  fontFamily: string;
  fontSize: number; // px
  lineSpacing: number; // multiplier
  margins: number; // px
  textAlign: 'left' | 'center' | 'right' | 'justify';
  theme: ThemeName;
  customBg?: string;
  customFg?: string;
  viewMode: 'paginated' | 'scroll';
  spread: 'single' | 'double' | 'auto';
  zoom: number; // percentage
  fitMode: 'width' | 'page' | 'custom';
  rightToLeft: boolean;
  autoTheme: boolean; // follow system
}

export interface AppSettings {
  reader: ReaderSettings;
  libraryView: 'grid' | 'list';
  librarySortBy: 'title' | 'author' | 'lastRead' | 'dateAdded';
  librarySortOrder: 'asc' | 'desc';
  libraryFilterFormat?: BookFormat;
  libraryFilterTag?: string;
  scanFolders: string[];
  windowBounds?: { x: number; y: number; width: number; height: number };
}

/* ─── IPC Channel Map ─── */
export interface IpcChannels {
  // File operations
  'file:open-dialog': { args: []; result: string | null };
  'file:open-path': { args: [string]; result: Buffer };
  'file:read': { args: [string]; result: Uint8Array };
  'file:scan-folder': { args: [string?]; result: string[] };
  'file:detect-format': { args: [string]; result: { format: BookFormat; drm: boolean } | null };
  'file:extract-cover': { args: [string, string?]; result: string | null }; // filePath, destDir

  // Database – Books
  'db:get-books': { args: []; result: BookMeta[] };
  'db:get-book': { args: [string]; result: BookMeta | null };
  'db:add-book': { args: [Omit<BookMeta, 'id'>]; result: BookMeta };
  'db:update-book': { args: [string, Partial<BookMeta>]; result: void };
  'db:delete-book': { args: [string]; result: void };
  'db:import-file': { args: [string]; result: BookMeta };

  // Database – Collections
  'db:get-collections': { args: []; result: Collection[] };
  'db:add-collection': { args: [string, string?]; result: Collection };
  'db:delete-collection': { args: [string]; result: void };
  'db:update-collection': { args: [string, Partial<Collection>]; result: void };

  // Database – Annotations
  'db:get-annotations': { args: [string]; result: Annotation[] };
  'db:add-annotation': { args: [Omit<Annotation, 'id'>]; result: Annotation };
  'db:update-annotation': { args: [string, Partial<Annotation>]; result: void };
  'db:delete-annotation': { args: [string]; result: void };
  'db:export-annotations': { args: [string, 'markdown' | 'json']; result: string };

  // Database – Stats
  'db:add-reading-session': { args: [Omit<ReadingSession, 'id'>]; result: void };
  'db:get-reading-sessions': { args: [string]; result: ReadingSession[] };
  'db:get-stats': { args: []; result: { totalBooks: number; totalTime: number; booksRead: number } };

  // Settings
  'settings:get': { args: []; result: AppSettings };
  'settings:set': { args: [Partial<AppSettings>]; result: void };

  // Backup
  'backup:export': { args: [string?]; result: void };
  'backup:import': { args: [string?]; result: void };

  // Sample Books
  'sample:load-defaults': { args: []; result: number };

  // App
  'app:get-version': { args: []; result: string };
  'app:toggle-fullscreen': { args: []; result: void };
  'app:get-path': { args: ['userData' | 'temp' | 'downloads']; result: string };
}

/* ─── TOC ─── */
export interface TocItem {
  label: string;
  href: string;
  subitems?: TocItem[];
}

/* ─── Dictionary ─── */
export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; example?: string }[];
  }[];
}

