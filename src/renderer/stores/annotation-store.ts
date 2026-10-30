import { create } from 'zustand';
import type { Annotation, HighlightColor } from '../../shared/types';

interface AnnotationState {
  annotations: Annotation[];
  isLoading: boolean;

  loadAnnotations: (bookId: string) => Promise<void>;
  addHighlight: (params: {
    bookId: string;
    text: string;
    color: HighlightColor;
    chapter?: string;
    cfi?: string;
    page?: number;
  }) => Promise<Annotation>;
  addNote: (params: {
    bookId: string;
    note: string;
    text?: string;
    color?: HighlightColor;
    chapter?: string;
    cfi?: string;
    page?: number;
  }) => Promise<Annotation>;
  addBookmark: (params: {
    bookId: string;
    chapter?: string;
    cfi?: string;
    page?: number;
    note?: string;
  }) => Promise<Annotation>;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => Promise<void>;
  deleteAnnotation: (id: string) => Promise<void>;
  exportAnnotations: (bookId: string, format: 'markdown' | 'json') => Promise<string>;
}

export const useAnnotationStore = create<AnnotationState>((set) => ({
  annotations: [],
  isLoading: false,

  loadAnnotations: async (bookId) => {
    set({ isLoading: true });
    try {
      const data = await window.api.invoke('db:get-annotations', bookId);
      set({ annotations: data || [] });
    } catch (e) {
      console.warn('Failed to load annotations:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  addHighlight: async ({ bookId, text, color, chapter, cfi, page }) => {
    const ann = await window.api.invoke('db:add-annotation', {
      bookId,
      type: 'highlight',
      text,
      color,
      chapter: chapter || '',
      cfi: cfi || '',
      page,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    set((state) => ({ annotations: [ann, ...state.annotations] }));
    return ann;
  },

  addNote: async ({ bookId, note, text, color, chapter, cfi, page }) => {
    const ann = await window.api.invoke('db:add-annotation', {
      bookId,
      type: 'note',
      note,
      text,
      color: color || 'yellow',
      chapter: chapter || '',
      cfi: cfi || '',
      page,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    set((state) => ({ annotations: [ann, ...state.annotations] }));
    return ann;
  },

  addBookmark: async ({ bookId, chapter, cfi, page, note }) => {
    const ann = await window.api.invoke('db:add-annotation', {
      bookId,
      type: 'bookmark',
      chapter: chapter || '',
      cfi: cfi || '',
      page,
      note,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    set((state) => ({ annotations: [ann, ...state.annotations] }));
    return ann;
  },

  updateAnnotation: async (id, updates) => {
    await window.api.invoke('db:update-annotation', id, updates);
    set((state) => ({
      annotations: state.annotations.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    }));
  },

  deleteAnnotation: async (id) => {
    await window.api.invoke('db:delete-annotation', id);
    set((state) => ({
      annotations: state.annotations.filter((a) => a.id !== id),
    }));
  },

  exportAnnotations: async (bookId, format) => {
    return await window.api.invoke('db:export-annotations', bookId, format);
  },
}));

