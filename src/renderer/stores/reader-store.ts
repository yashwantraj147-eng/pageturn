import { create } from 'zustand';
import type { BookMeta, ReaderSettings, TocItem } from '../../shared/types';
import { DEFAULT_READER_SETTINGS } from '../../shared/constants';

interface ReaderState {
  currentBook: BookMeta | null;
  isReading: boolean;
  toc: TocItem[];
  currentChapter: string;
  progress: number;
  totalPages: number;
  currentPage: number;
  settings: ReaderSettings;
  isFullscreen: boolean;
  searchQuery: string;
  searchResults: { cfi?: string; page?: number; text: string; chapter?: string }[];
  isTocOpen: boolean;
  isAnnotationPanelOpen: boolean;
  isSearchOpen: boolean;
  isSettingsOpen: boolean;
  sessionStartTime: number | null;

  openBook: (book: BookMeta) => Promise<void>;
  closeBook: () => Promise<void>;
  setProgress: (progress: number, lastPosition?: string) => void;
  setCurrentPage: (page: number, total?: number) => void;
  setToc: (items: TocItem[]) => void;
  setCurrentChapter: (chapter: string) => void;
  updateSettings: (updates: Partial<ReaderSettings>) => Promise<void>;
  toggleFullscreen: () => void;
  toggleToc: (force?: boolean) => void;
  toggleAnnotationPanel: (force?: boolean) => void;
  toggleSearch: (force?: boolean) => void;
  toggleSettings: (force?: boolean) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: { cfi?: string; page?: number; text: string; chapter?: string }[]) => void;
  loadSettings: () => Promise<void>;
}

export const useReaderStore = create<ReaderState>((set, get) => ({
  currentBook: null,
  isReading: false,
  toc: [],
  currentChapter: '',
  progress: 0,
  totalPages: 1,
  currentPage: 1,
  settings: DEFAULT_READER_SETTINGS,
  isFullscreen: false,
  searchQuery: '',
  searchResults: [],
  isTocOpen: false,
  isAnnotationPanelOpen: false,
  isSearchOpen: false,
  isSettingsOpen: false,
  sessionStartTime: null,

  loadSettings: async () => {
    try {
      const appSettings = await window.api.invoke('settings:get');
      if (appSettings?.reader) {
        set({ settings: { ...DEFAULT_READER_SETTINGS, ...appSettings.reader } });
      }
    } catch (e) {
      console.warn('Failed to load settings:', e);
    }
  },

  openBook: async (book) => {
    await get().loadSettings();
    set({
      currentBook: book,
      isReading: true,
      progress: book.progress || 0,
      currentChapter: '',
      isTocOpen: false,
      isAnnotationPanelOpen: false,
      isSearchOpen: false,
      isSettingsOpen: false,
      sessionStartTime: Date.now(),
    });

    // Update lastRead timestamp in database
    await window.api.invoke('db:update-book', book.id, {
      lastRead: Date.now(),
    });
  },

  closeBook: async () => {
    const { currentBook, progress, sessionStartTime, currentPage } = get();
    if (currentBook) {
      // Record reading session
      if (sessionStartTime) {
        const endTime = Date.now();
        await window.api.invoke('db:add-reading-session', {
          bookId: currentBook.id,
          startTime: sessionStartTime,
          endTime,
          pagesRead: Math.max(1, currentPage),
          startProgress: currentBook.progress || 0,
          endProgress: progress,
        });
      }

      // Save final progress
      await window.api.invoke('db:update-book', currentBook.id, {
        progress,
        lastRead: Date.now(),
      });
    }

    set({
      currentBook: null,
      isReading: false,
      sessionStartTime: null,
    });
  },

  setProgress: (progress, lastPosition) => {
    const { currentBook } = get();
    const clamped = Math.max(0, Math.min(1, progress));
    set({ progress: clamped });

    if (currentBook) {
      window.api.invoke('db:update-book', currentBook.id, {
        progress: clamped,
        ...(lastPosition ? { lastPosition } : {}),
      });
    }
  },

  setCurrentPage: (page, total) => {
    set((state) => ({
      currentPage: page,
      totalPages: total !== undefined ? total : state.totalPages,
    }));
  },

  setToc: (items) => set({ toc: items }),
  setCurrentChapter: (chapter) => set({ currentChapter: chapter }),

  updateSettings: async (updates) => {
    const newSettings = { ...get().settings, ...updates };
    set({ settings: newSettings });
    try {
      await window.api.invoke('settings:set', { reader: newSettings });
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  },

  toggleFullscreen: () => {
    window.api.invoke('app:toggle-fullscreen');
    set((state) => ({ isFullscreen: !state.isFullscreen }));
  },

  toggleToc: (force) =>
    set((state) => ({
      isTocOpen: force !== undefined ? force : !state.isTocOpen,
      isAnnotationPanelOpen: false,
      isSearchOpen: false,
      isSettingsOpen: false,
    })),

  toggleAnnotationPanel: (force) =>
    set((state) => ({
      isAnnotationPanelOpen: force !== undefined ? force : !state.isAnnotationPanelOpen,
      isTocOpen: false,
      isSearchOpen: false,
      isSettingsOpen: false,
    })),

  toggleSearch: (force) =>
    set((state) => ({
      isSearchOpen: force !== undefined ? force : !state.isSearchOpen,
      isTocOpen: false,
      isAnnotationPanelOpen: false,
      isSettingsOpen: false,
    })),

  toggleSettings: (force) =>
    set((state) => ({
      isSettingsOpen: force !== undefined ? force : !state.isSettingsOpen,
      isTocOpen: false,
      isAnnotationPanelOpen: false,
      isSearchOpen: false,
    })),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setSearchResults: (results) => set({ searchResults: results }),
}));

