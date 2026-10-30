import type { ReaderSettings, AppSettings } from './types';

export const APP_NAME = 'PageTurn';
export const DB_FILENAME = 'pageturn.db';
export const COVERS_DIR = 'covers';

/* ─── Format Detection Magic Bytes ─── */
export const FORMAT_SIGNATURES: Record<string, { offset: number; bytes: number[] | string }[]> = {
  // PK zip header (EPUB, DOCX, CBZ, FB2.zip)
  zip: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  pdf: [{ offset: 0, bytes: '%PDF' }],
  // MOBI/PRC Palm DB
  mobi: [{ offset: 60, bytes: 'BOOKMOBI' }],
  // PDB header for mobi
  pdb: [{ offset: 60, bytes: 'TEXtREAd' }],
};

/* ─── EPUB MIME type inside the zip ─── */
export const EPUB_MIMETYPE = 'application/epub+zip';

/* ─── Supported Extensions ─── */
export const SUPPORTED_EXTENSIONS = [
  '.epub',
  '.pdf',
  '.mobi',
  '.azw3',
  '.kf8',
  '.fb2',
  '.fb2.zip',
  '.cbz',
  '.cbr',
  '.txt',
  '.html',
  '.htm',
  '.md',
  '.markdown',
  '.docx',
];

export const DIALOG_FILTERS = [
  {
    name: 'E-Books',
    extensions: ['epub', 'pdf', 'mobi', 'azw3', 'kf8', 'fb2', 'cbz', 'cbr', 'txt', 'html', 'htm', 'md', 'markdown', 'docx'],
  },
  { name: 'EPUB', extensions: ['epub'] },
  { name: 'PDF', extensions: ['pdf'] },
  { name: 'Kindle', extensions: ['mobi', 'azw3', 'kf8'] },
  { name: 'FictionBook', extensions: ['fb2'] },
  { name: 'Comics', extensions: ['cbz', 'cbr'] },
  { name: 'Documents', extensions: ['txt', 'html', 'htm', 'md', 'markdown', 'docx'] },
  { name: 'All Files', extensions: ['*'] },
];

/* ─── Default Reader Settings ─── */
export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  fontFamily: 'Georgia, serif',
  fontSize: 18,
  lineSpacing: 1.6,
  margins: 40,
  textAlign: 'justify',
  theme: 'light',
  viewMode: 'paginated',
  spread: 'auto',
  zoom: 100,
  fitMode: 'width',
  rightToLeft: false,
  autoTheme: true,
};

export const DEFAULT_APP_SETTINGS: AppSettings = {
  reader: DEFAULT_READER_SETTINGS,
  libraryView: 'grid',
  librarySortBy: 'dateAdded',
  librarySortOrder: 'desc',
  scanFolders: [],
};

/* ─── Theme CSS Variables ─── */
export const THEMES = {
  light: {
    '--background': '0 0% 100%',
    '--foreground': '224 71.4% 4.1%',
    '--card': '0 0% 100%',
    '--card-foreground': '224 71.4% 4.1%',
    '--popover': '0 0% 100%',
    '--popover-foreground': '224 71.4% 4.1%',
    '--primary': '220.9 39.3% 11%',
    '--primary-foreground': '210 20% 98%',
    '--secondary': '220 14.3% 95.9%',
    '--secondary-foreground': '220.9 39.3% 11%',
    '--muted': '220 14.3% 95.9%',
    '--muted-foreground': '220 8.9% 46.1%',
    '--accent': '220 14.3% 95.9%',
    '--accent-foreground': '220.9 39.3% 11%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '210 20% 98%',
    '--border': '220 13% 91%',
    '--input': '220 13% 91%',
    '--ring': '224 71.4% 4.1%',
    '--radius': '0.5rem',
  },
  dark: {
    '--background': '224 71.4% 4.1%',
    '--foreground': '210 20% 98%',
    '--card': '224 71.4% 4.1%',
    '--card-foreground': '210 20% 98%',
    '--popover': '224 71.4% 4.1%',
    '--popover-foreground': '210 20% 98%',
    '--primary': '210 20% 98%',
    '--primary-foreground': '220.9 39.3% 11%',
    '--secondary': '215 27.9% 16.9%',
    '--secondary-foreground': '210 20% 98%',
    '--muted': '215 27.9% 16.9%',
    '--muted-foreground': '217.9 10.6% 64.9%',
    '--accent': '215 27.9% 16.9%',
    '--accent-foreground': '210 20% 98%',
    '--destructive': '0 62.8% 30.6%',
    '--destructive-foreground': '210 20% 98%',
    '--border': '215 27.9% 16.9%',
    '--input': '215 27.9% 16.9%',
    '--ring': '216 12.2% 83.9%',
    '--radius': '0.5rem',
  },
  sepia: {
    '--background': '39 70% 95%',
    '--foreground': '24 30% 15%',
    '--card': '39 70% 95%',
    '--card-foreground': '24 30% 15%',
    '--popover': '39 60% 92%',
    '--popover-foreground': '24 30% 15%',
    '--primary': '24 60% 25%',
    '--primary-foreground': '39 70% 95%',
    '--secondary': '39 40% 88%',
    '--secondary-foreground': '24 30% 15%',
    '--muted': '39 40% 88%',
    '--muted-foreground': '24 15% 50%',
    '--accent': '39 40% 88%',
    '--accent-foreground': '24 30% 15%',
    '--destructive': '0 84.2% 60.2%',
    '--destructive-foreground': '39 70% 95%',
    '--border': '39 30% 82%',
    '--input': '39 30% 82%',
    '--ring': '24 60% 25%',
    '--radius': '0.5rem',
  },
  night: {
    '--background': '0 0% 0%',
    '--foreground': '0 0% 94%',
    '--card': '0 0% 6%',
    '--card-foreground': '0 0% 94%',
    '--popover': '0 0% 8%',
    '--popover-foreground': '0 0% 94%',
    '--primary': '152 76% 50%',
    '--primary-foreground': '0 0% 0%',
    '--secondary': '0 0% 12%',
    '--secondary-foreground': '0 0% 94%',
    '--muted': '0 0% 12%',
    '--muted-foreground': '0 0% 60%',
    '--accent': '0 0% 14%',
    '--accent-foreground': '152 76% 50%',
    '--destructive': '0 84% 60%',
    '--destructive-foreground': '0 0% 98%',
    '--border': '0 0% 16%',
    '--input': '0 0% 16%',
    '--ring': '152 76% 50%',
    '--radius': '0.5rem',
  },
} as const;

/* ─── Highlight Colors ─── */
export const HIGHLIGHT_COLORS = {
  yellow: '#fef08a',
  green: '#bbf7d0',
  blue: '#bfdbfe',
  pink: '#fbcfe8',
  orange: '#fed7aa',
} as const;

/* ─── Keyboard Shortcuts ─── */
export const SHORTCUTS = {
  nextPage: ['ArrowRight', ' '],
  prevPage: ['ArrowLeft'],
  search: 'ctrl+f',
  bookmark: 'ctrl+b',
  fullscreen: 'F11',
  fontSizeUp: 'ctrl+=',
  fontSizeDown: 'ctrl+-',
  toc: 'ctrl+t',
  library: 'ctrl+l',
  openFile: 'ctrl+o',
} as const;

