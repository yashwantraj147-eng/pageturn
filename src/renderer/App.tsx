import React, { useEffect, useState } from 'react';
import { useReaderStore } from './stores/reader-store';
import { useLibraryStore } from './stores/library-store';
import { Library } from './components/library/Library';
import { Reader } from './components/reader/Reader';
import { Toaster, toast } from './components/ui/toast';
import { UploadCloud } from 'lucide-react';

export const App: React.FC = () => {
  const { isReading, openBook, settings, loadSettings } = useReaderStore();
  const { importFile, books } = useLibraryStore();
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Apply theme to html root
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark', 'sepia', 'night');

    if (settings.theme === 'night') {
      root.classList.add('night');
    } else if (settings.theme === 'dark') {
      root.classList.add('dark');
    } else if (settings.theme === 'sepia') {
      root.classList.add('sepia');
    } else if (settings.autoTheme) {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      }
    }
  }, [settings.theme, settings.autoTheme]);

  // Listen for open-file from OS file association / command line
  useEffect(() => {
    window.api.onOpenFile(async (filePath: string) => {
      try {
        const book = await importFile(filePath);
        if (book) {
          await openBook(book);
        }
      } catch (err: any) {
        toast({
          title: 'Failed to open book',
          description: err?.message || 'Could not import the selected file.',
          variant: 'destructive',
        });
      }
    });

    // Native menu events
    window.api.on('menu:open-file', async () => {
      try {
        const book = await importFile();
        if (book) {
          toast({
            title: 'Imported',
            description: `Imported "${book.title}" successfully.`,
          });
        }
      } catch (err: any) {
        toast({
          title: 'Import failed',
          description: err?.message,
          variant: 'destructive',
        });
      }
    });
  }, []);

  // Global Drag & Drop handling for book files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        const filePath = (file as any).path;
        if (filePath) {
          try {
            const book = await importFile(filePath);
            if (book) {
              toast({
                title: 'Book Imported',
                description: `"${book.title}" added to your library!`,
              });
            }
          } catch (err: any) {
            toast({
              title: 'Import error',
              description: err?.message || 'Failed to import book.',
              variant: 'destructive',
            });
          }
        }
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative h-screen w-screen overflow-hidden bg-background text-foreground"
    >
      {/* View routing: Library or Reader */}
      {isReading ? <Reader /> : <Library />}

      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="drop-overlay">
          <div className="flex flex-col items-center justify-center p-8 bg-background/90 rounded-2xl border-2 border-dashed border-primary shadow-2xl">
            <UploadCloud className="h-16 w-16 text-primary animate-bounce mb-4" />
            <h2 className="text-xl font-bold">Drop e-books here</h2>
            <p className="text-sm text-muted-foreground mt-1">
              PageTurn will automatically import them into your library
            </p>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <Toaster />
    </div>
  );
};
