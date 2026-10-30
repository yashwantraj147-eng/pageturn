import { create } from 'zustand';
import type { BookMeta, BookFormat, Collection } from '../../shared/types';

interface LibraryState {
  books: BookMeta[];
  collections: Collection[];
  searchQuery: string;
  sortBy: 'title' | 'author' | 'lastRead' | 'dateAdded';
  sortOrder: 'asc' | 'desc';
  filterFormat: BookFormat | 'all';
  filterTag: string | 'all';
  filterCollectionId: string | 'all';
  viewMode: 'grid' | 'list';
  selectedBookId: string | null;
  isLoading: boolean;
  error: string | null;

  loadBooks: () => Promise<void>;
  loadCollections: () => Promise<void>;
  addBook: (book: Omit<BookMeta, 'id'>) => Promise<BookMeta>;
  updateBook: (id: string, updates: Partial<BookMeta>) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  importFile: (filePath?: string) => Promise<BookMeta | null>;
  scanFolder: (folderPath?: string) => Promise<number>;
  addCollection: (name: string, color?: string) => Promise<Collection>;
  deleteCollection: (id: string) => Promise<void>;
  setSearch: (query: string) => void;
  setSort: (by: LibraryState['sortBy'], order?: 'asc' | 'desc') => void;
  setFilterFormat: (format: BookFormat | 'all') => void;
  setFilterTag: (tag: string | 'all') => void;
  setFilterCollectionId: (collectionId: string | 'all') => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  selectBook: (id: string | null) => void;
  getFilteredBooks: () => BookMeta[];
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  books: [],
  collections: [],
  searchQuery: '',
  sortBy: 'dateAdded',
  sortOrder: 'desc',
  filterFormat: 'all',
  filterTag: 'all',
  filterCollectionId: 'all',
  viewMode: 'grid',
  selectedBookId: null,
  isLoading: false,
  error: null,

  loadBooks: async () => {
    set({ isLoading: true, error: null });
    try {
      const books = await window.api.invoke('db:get-books');
      set({ books: books || [] });
    } catch (err: any) {
      set({ error: err?.message || 'Failed to load books' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadCollections: async () => {
    try {
      const collections = await window.api.invoke('db:get-collections');
      set({ collections: collections || [] });
    } catch (err) {
      console.error('Failed to load collections:', err);
    }
  },

  addBook: async (bookData) => {
    const newBook = await window.api.invoke('db:add-book', bookData);
    set((state) => ({ books: [newBook, ...state.books] }));
    return newBook;
  },

  updateBook: async (id, updates) => {
    await window.api.invoke('db:update-book', id, updates);
    set((state) => ({
      books: state.books.map((b) => (b.id === id ? { ...b, ...updates } : b)),
    }));
  },

  deleteBook: async (id) => {
    await window.api.invoke('db:delete-book', id);
    set((state) => ({
      books: state.books.filter((b) => b.id !== id),
      selectedBookId: state.selectedBookId === id ? null : state.selectedBookId,
    }));
  },

  importFile: async (filePath) => {
    try {
      let targetPath = filePath;
      if (!targetPath) {
        targetPath = (await window.api.invoke('file:open-dialog')) || undefined;
      }
      if (!targetPath) return null;

      const imported = await window.api.invoke('db:import-file', targetPath);
      set((state) => {
        const exists = state.books.some((b) => b.id === imported.id);
        return {
          books: exists
            ? state.books.map((b) => (b.id === imported.id ? imported : b))
            : [imported, ...state.books],
        };
      });
      return imported;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to import file' });
      throw err;
    }
  },

  scanFolder: async (folderPath) => {
    try {
      const files = await window.api.invoke('file:scan-folder', folderPath || '');
      let count = 0;
      for (const fp of files) {
        try {
          const imported = await window.api.invoke('db:import-file', fp);
          set((state) => {
            const exists = state.books.some((b) => b.id === imported.id);
            return {
              books: exists
                ? state.books.map((b) => (b.id === imported.id ? imported : b))
                : [imported, ...state.books],
            };
          });
          count++;
        } catch (e) {
          console.warn('Failed to import file during scan:', fp, e);
        }
      }
      return count;
    } catch (err: any) {
      set({ error: err?.message || 'Failed to scan folder' });
      return 0;
    }
  },

  addCollection: async (name, color) => {
    const col = await window.api.invoke('db:add-collection', name, color);
    set((state) => ({ collections: [col, ...state.collections] }));
    return col;
  },

  deleteCollection: async (id) => {
    await window.api.invoke('db:delete-collection', id);
    set((state) => ({
      collections: state.collections.filter((c) => c.id !== id),
      filterCollectionId: state.filterCollectionId === id ? 'all' : state.filterCollectionId,
    }));
  },

  setSearch: (query) => set({ searchQuery: query }),
  setSort: (by, order) =>
    set((state) => ({
      sortBy: by,
      sortOrder: order || (state.sortBy === by && state.sortOrder === 'asc' ? 'desc' : 'asc'),
    })),
  setFilterFormat: (format) => set({ filterFormat: format }),
  setFilterTag: (tag) => set({ filterTag: tag }),
  setFilterCollectionId: (id) => set({ filterCollectionId: id }),
  setViewMode: (mode) => set({ viewMode: mode }),
  selectBook: (id) => set({ selectedBookId: id }),

  getFilteredBooks: () => {
    const { books, searchQuery, sortBy, sortOrder, filterFormat, filterTag, filterCollectionId } =
      get();

    return books
      .filter((b) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = b.title.toLowerCase().includes(q);
          const matchAuthor = b.author.toLowerCase().includes(q);
          const matchTags = b.tags?.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchAuthor && !matchTags) return false;
        }

        // Format
        if (filterFormat !== 'all' && b.format !== filterFormat) {
          return false;
        }

        // Tag
        if (filterTag !== 'all' && !b.tags?.includes(filterTag)) {
          return false;
        }

        // Collection
        if (filterCollectionId !== 'all' && !b.collectionIds?.includes(filterCollectionId)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'title') {
          cmp = a.title.localeCompare(b.title);
        } else if (sortBy === 'author') {
          cmp = a.author.localeCompare(b.author);
        } else if (sortBy === 'lastRead') {
          cmp = (a.lastRead || 0) - (b.lastRead || 0);
        } else if (sortBy === 'dateAdded') {
          cmp = a.dateAdded - b.dateAdded;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  },
}));

