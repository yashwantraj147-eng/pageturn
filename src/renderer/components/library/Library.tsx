import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Plus,
  LayoutGrid,
  List,
  Search,
  Folder,
  Tag,
  ArrowUpDown,
  Download,
  Upload,
  BookMarked,
  Sparkles,
  Sun,
  Moon,
  Flame,
  Clock,
  Play,
  RotateCw,
} from 'lucide-react';
import { useLibraryStore } from '../../stores/library-store';
import { useReaderStore } from '../../stores/reader-store';
import { BookCard } from './BookCard';
import { BookRow } from './BookRow';
import { ImportDialog } from './ImportDialog';
import { EditBookDialog } from './EditBookDialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Badge } from '../ui/badge';
import type { BookMeta, BookFormat, ThemeName } from '../../../shared/types';

export const Library: React.FC = () => {
  const {
    books,
    collections,
    searchQuery,
    sortBy,
    sortOrder,
    filterFormat,
    filterTag,
    filterCollectionId,
    viewMode,
    loadBooks,
    loadCollections,
    deleteBook,
    setSearch,
    setSort,
    setFilterFormat,
    setFilterTag,
    setFilterCollectionId,
    setViewMode,
    getFilteredBooks,
    addCollection,
  } = useLibraryStore();

  const { openBook, settings, updateSettings } = useReaderStore();

  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<BookMeta | null>(null);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [seedingSamples, setSeedingSamples] = useState(false);

  useEffect(() => {
    loadBooks();
    loadCollections();
  }, []);

  const filteredBooks = getFilteredBooks();

  // Aggregate unique tags
  const allTags = Array.from(
    new Set(books.flatMap((b) => b.tags || []))
  ).filter(Boolean);

  // Find most recently read book for the Hero Continue Reading banner
  const recentlyReadBook = books
    .filter((b) => b.lastRead && b.lastRead > 0)
    .sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0))[0] || (books.length > 0 ? books[0] : null);

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    await addCollection(newCollectionName.trim());
    setNewCollectionName('');
    setShowNewCollection(false);
  };

  const handleBackupExport = async () => {
    await window.api.invoke('backup:export');
  };

  const handleBackupImport = async () => {
    await window.api.invoke('backup:import');
    await loadBooks();
    await loadCollections();
  };

  const handleLoadSampleBooks = async () => {
    setSeedingSamples(true);
    try {
      await window.api.invoke('sample:load-defaults');
      await loadBooks();
      await loadCollections();
    } finally {
      setSeedingSamples(false);
    }
  };

  const handleThemeChange = async (theme: ThemeName) => {
    await updateSettings({ theme, autoTheme: false });
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden selection:bg-primary/20 selection:text-primary">
      {/* ─── Left Sidebar: Navigation & Reading Stats ─── */}
      <aside className="w-64 border-r border-border/80 bg-card/60 backdrop-blur-xl flex flex-col justify-between shrink-0 select-none">
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo / App branding */}
          <div className="flex items-center space-x-3 px-6 py-5 border-b border-border/70">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-indigo-500 text-primary-foreground shadow-md shadow-primary/25">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-base leading-tight tracking-tight text-foreground">
                PageTurn
              </h1>
              <div className="flex items-center space-x-1.5 mt-0.5">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[11px] text-muted-foreground font-mono font-medium">
                  {books.length} {books.length === 1 ? 'book' : 'books'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
            {/* Main Views */}
            <div className="space-y-1">
              <button
                onClick={() => {
                  setFilterFormat('all');
                  setFilterTag('all');
                  setFilterCollectionId('all');
                }}
                className={`flex w-full items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  filterFormat === 'all' && filterTag === 'all' && filterCollectionId === 'all'
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/30 font-semibold'
                    : 'text-foreground/80 hover:bg-muted/70 hover:text-foreground'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <BookMarked className="h-4 w-4" />
                  <span>All Books</span>
                </div>
                <Badge
                  variant={filterFormat === 'all' ? 'outline' : 'secondary'}
                  className="text-[10px] px-2 h-5 rounded-md"
                >
                  {books.length}
                </Badge>
              </button>
            </div>

            {/* Formats Filter */}
            <div>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 mb-2 font-mono">
                Formats
              </h3>
              <div className="space-y-0.5">
                {[
                  { id: 'epub', label: 'EPUB' },
                  { id: 'pdf', label: 'PDF' },
                  { id: 'mobi', label: 'Kindle (MOBI/AZW3)' },
                  { id: 'fb2', label: 'FictionBook (FB2)' },
                  { id: 'cbz', label: 'Comics (CBZ/CBR)' },
                  { id: 'docx', label: 'Word (DOCX)' },
                  { id: 'markdown', label: 'Markdown & Text' },
                ].map(({ id, label }) => {
                  const count = books.filter((b) =>
                    id === 'mobi'
                      ? b.format === 'mobi' || b.format === 'azw3' || b.format === 'kf8'
                      : id === 'cbz'
                      ? b.format === 'cbz' || b.format === 'cbr'
                      : id === 'markdown'
                      ? b.format === 'markdown' || b.format === 'txt' || b.format === 'html'
                      : b.format === id
                  ).length;

                  if (count === 0) return null;

                  const isSelected = filterFormat === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setFilterFormat(isSelected ? 'all' : (id as BookFormat))}
                      className={`flex w-full items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-secondary font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <span>{label}</span>
                      <span className="text-[10px] font-mono opacity-80">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Collections / Shelves */}
            <div>
              <div className="flex items-center justify-between px-3 mb-2">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 font-mono">
                  Collections
                </h3>
                <button
                  onClick={() => setShowNewCollection(!showNewCollection)}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="Add Shelf"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {showNewCollection && (
                <form onSubmit={handleCreateCollection} className="px-3 mb-2 flex space-x-1">
                  <Input
                    size={20}
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="New shelf..."
                    className="h-7 text-xs bg-background/80"
                    autoFocus
                  />
                  <Button type="submit" size="sm" className="h-7 px-2.5 text-xs">
                    Add
                  </Button>
                </form>
              )}

              <div className="space-y-0.5">
                {collections.map((col) => {
                  const isSelected = filterCollectionId === col.id;
                  const count = books.filter((b) => b.collectionIds?.includes(col.id)).length;
                  return (
                    <button
                      key={col.id}
                      onClick={() => setFilterCollectionId(isSelected ? 'all' : col.id)}
                      className={`flex w-full items-center justify-between px-3 py-1.5 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-secondary font-semibold text-foreground'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <Folder className="h-3.5 w-3.5 flex-shrink-0 text-primary/80" />
                        <span className="truncate">{col.name}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-80">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tags */}
            {allTags.length > 0 && (
              <div>
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 px-3 mb-2 font-mono">
                  Tags
                </h3>
                <div className="flex flex-wrap gap-1 px-3">
                  {allTags.map((tag) => {
                    const isSelected = filterTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setFilterTag(isSelected ? 'all' : tag)}
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-medium'
                            : 'bg-muted/70 text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        <Tag className="mr-1 h-2.5 w-2.5" />
                        {tag}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Reading Statistics Card */}
          <div className="px-4 py-3 mx-3 mb-2 rounded-xl bg-muted/40 border border-border/60">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-semibold text-foreground/90 flex items-center">
                <Flame className="h-3.5 w-3.5 text-amber-500 mr-1" />
                Reading Stats
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">Daily Goal</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="rounded-lg bg-card/60 p-1.5 border border-border/40">
                <span className="block text-[10px] text-muted-foreground">Streak</span>
                <span className="font-bold text-foreground">3 Days 🔥</span>
              </div>
              <div className="rounded-lg bg-card/60 p-1.5 border border-border/40">
                <span className="block text-[10px] text-muted-foreground">Today</span>
                <span className="font-bold text-foreground">25 mins</span>
              </div>
            </div>
          </div>

          {/* Backup / Restore footer */}
          <div className="p-3 border-t border-border/70 flex items-center justify-between text-xs text-muted-foreground">
            <button
              onClick={handleBackupExport}
              title="Backup library database"
              className="flex items-center space-x-1.5 hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Backup</span>
            </button>
            <button
              onClick={handleBackupImport}
              title="Restore library database"
              className="flex items-center space-x-1.5 hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Restore</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Toolbar */}
        <header className="h-16 border-b border-border/70 px-6 flex items-center justify-between glass-header shrink-0 z-20">
          {/* Search bar */}
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, author, tag... (Ctrl+F)"
              className="pl-9 pr-4 h-9 bg-background/60 border-border/80 rounded-xl focus-visible:ring-1"
            />
          </div>

          {/* Controls: Theme Selector, Sample Books, Sort, View mode, Import */}
          <div className="flex items-center space-x-3">
            {/* Theme switcher pill */}
            <div className="flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 space-x-0.5">
              <button
                onClick={() => handleThemeChange('light')}
                className={`p-1.5 rounded-lg transition-colors ${
                  settings.theme === 'light'
                    ? 'bg-background shadow-sm text-amber-500'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Light Theme"
              >
                <Sun className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleThemeChange('sepia')}
                className={`px-1.5 py-1 rounded-lg text-xs font-serif font-bold transition-colors ${
                  settings.theme === 'sepia'
                    ? 'bg-background shadow-sm text-amber-800'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Sepia Parchment Theme"
              >
                Sepia
              </button>
              <button
                onClick={() => handleThemeChange('dark')}
                className={`p-1.5 rounded-lg transition-colors ${
                  settings.theme === 'dark'
                    ? 'bg-background shadow-sm text-indigo-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Dark Theme"
              >
                <Moon className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => handleThemeChange('night')}
                className={`px-1.5 py-1 rounded-lg text-[10px] font-mono font-bold transition-colors ${
                  settings.theme === 'night'
                    ? 'bg-background shadow-sm text-emerald-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="OLED Pure Black"
              >
                OLED
              </button>
            </div>

            {/* Load Sample Books Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSampleBooks}
              disabled={seedingSamples}
              className="h-9 space-x-1.5 rounded-xl border-border/80 hover:bg-muted/70"
              title="Add classic public-domain e-books"
            >
              {seedingSamples ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin text-primary" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              )}
              <span className="text-xs">Sample Books</span>
            </Button>

            {/* Sort Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-9 space-x-2 rounded-xl border-border/80">
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  <span className="capitalize text-xs">
                    {sortBy === 'dateAdded'
                      ? 'Recently Added'
                      : sortBy === 'lastRead'
                      ? 'Recently Read'
                      : sortBy}
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setSort('dateAdded', 'desc')}>
                  Recently Added
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('lastRead', 'desc')}>
                  Recently Read
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('title', 'asc')}>
                  Title (A–Z)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSort('author', 'asc')}>
                  Author (A–Z)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border/80 p-0.5 bg-muted/40">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="Grid view"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list'
                    ? 'bg-background shadow-sm text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
                title="List view"
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            {/* Import Button */}
            <Button
              onClick={() => setImportDialogOpen(true)}
              size="sm"
              className="h-9 space-x-1.5 rounded-xl shadow-md shadow-primary/20"
            >
              <Plus className="h-4 w-4" />
              <span className="font-semibold text-xs">Import</span>
            </Button>
          </div>
        </header>

        {/* ─── Gallery Area with Optional Continue Reading Hero ─── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Continue Reading Hero Banner (Shown when user has a recent book) */}
          {recentlyReadBook && (
            <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-card p-6 shadow-lg shadow-primary/5">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center space-x-5">
                  {/* Miniature 3D cover thumbnail */}
                  <div className="relative h-24 w-16 flex-shrink-0 overflow-hidden rounded-lg shadow-md book-card-shadow">
                    <div className="book-spine-crease" />
                    {recentlyReadBook.coverPath ? (
                      <img
                        src={`file://${recentlyReadBook.coverPath}`}
                        alt={recentlyReadBook.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-primary/20 font-serif font-bold text-primary">
                        {recentlyReadBook.title.charAt(0)}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="inline-flex items-center space-x-1 rounded-full bg-primary/20 text-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                        <Flame className="h-3 w-3 fill-current" />
                        <span>Continue Reading</span>
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {recentlyReadBook.format}
                      </Badge>
                    </div>

                    <h2 className="text-lg font-bold tracking-tight text-foreground line-clamp-1">
                      {recentlyReadBook.title}
                    </h2>
                    <p className="text-xs text-muted-foreground font-medium">
                      {recentlyReadBook.author}
                    </p>

                    <div className="flex items-center space-x-3 mt-3">
                      <div className="w-36 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{
                            width: `${Math.round((recentlyReadBook.progress || 0) * 100)}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono font-semibold text-muted-foreground">
                        {Math.round((recentlyReadBook.progress || 0) * 100)}% read
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => openBook(recentlyReadBook)}
                  size="default"
                  className="rounded-xl space-x-2 px-6 shadow-md shadow-primary/25"
                >
                  <Play className="h-4 w-4 fill-current" />
                  <span className="font-semibold">Resume Reading</span>
                </Button>
              </div>
            </div>
          )}

          {/* Book Gallery / List */}
          {filteredBooks.length === 0 ? (
            /* Empty State */
            <div className="flex h-[50vh] flex-col items-center justify-center text-center p-8 rounded-2xl border border-dashed border-border/80 bg-card/30">
              <div className="rounded-2xl bg-gradient-to-tr from-primary/20 to-indigo-500/20 p-5 text-primary mb-4 shadow-inner">
                <Sparkles className="h-8 w-8" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">No books found</h2>
              <p className="text-sm text-muted-foreground max-w-md mb-6 leading-relaxed">
                {books.length === 0
                  ? 'Your library is empty. Click "Load Sample Books" below to instantly enjoy public-domain classics, or import your own e-books!'
                  : 'No books match your current search or format filter.'}
              </p>
              <div className="flex items-center space-x-3">
                <Button
                  onClick={handleLoadSampleBooks}
                  disabled={seedingSamples}
                  className="space-x-2 rounded-xl shadow-md shadow-primary/20"
                >
                  {seedingSamples ? (
                    <RotateCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>Load Sample Classics</span>
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setImportDialogOpen(true)}
                  className="space-x-2 rounded-xl"
                >
                  <Plus className="h-4 w-4" />
                  <span>Import From Disk</span>
                </Button>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
              {filteredBooks.map((book) => (
                <BookCard
                  key={book.id}
                  book={book}
                  onOpen={openBook}
                  onEdit={setEditingBook}
                  onDelete={deleteBook}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredBooks.map((book) => (
                <BookRow
                  key={book.id}
                  book={book}
                  onOpen={openBook}
                  onEdit={setEditingBook}
                  onDelete={deleteBook}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Dialogs */}
      <ImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
      />

      <EditBookDialog
        book={editingBook}
        open={!!editingBook}
        onOpenChange={(open) => !open && setEditingBook(null)}
      />
    </div>
  );
};
