import React from 'react';
import { MoreVertical, BookOpen, Edit, Trash2, CheckCircle2, Play } from 'lucide-react';
import type { BookMeta } from '../../../shared/types';
import { Progress } from '../ui/progress';
import { Badge } from '../ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

interface BookCardProps {
  book: BookMeta;
  onOpen: (book: BookMeta) => void;
  onEdit: (book: BookMeta) => void;
  onDelete: (id: string) => void;
}

// 5 elegant procedural cover themes for books without dedicated artwork
const COVER_THEMES = [
  {
    bg: 'from-slate-900 via-indigo-950 to-blue-950',
    border: 'border-indigo-400/30',
    title: 'text-indigo-100',
    author: 'text-indigo-300/80',
    accent: 'bg-indigo-500/20 text-indigo-200',
  },
  {
    bg: 'from-stone-950 via-emerald-950 to-teal-950',
    border: 'border-emerald-400/30',
    title: 'text-emerald-100',
    author: 'text-emerald-300/80',
    accent: 'bg-emerald-500/20 text-emerald-200',
  },
  {
    bg: 'from-neutral-950 via-rose-950 to-amber-950',
    border: 'border-rose-400/30',
    title: 'text-rose-100',
    author: 'text-rose-300/80',
    accent: 'bg-rose-500/20 text-rose-200',
  },
  {
    bg: 'from-amber-950 via-stone-900 to-amber-900',
    border: 'border-amber-400/30',
    title: 'text-amber-100',
    author: 'text-amber-300/80',
    accent: 'bg-amber-500/20 text-amber-200',
  },
  {
    bg: 'from-zinc-950 via-purple-950 to-slate-900',
    border: 'border-purple-400/30',
    title: 'text-purple-100',
    author: 'text-purple-300/80',
    accent: 'bg-purple-500/20 text-purple-200',
  },
];

function getThemeIndex(title: string): number {
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash << 5) - hash + title.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % COVER_THEMES.length;
}

function getFormatBadgeStyle(format: string): string {
  switch (format) {
    case 'epub':
      return 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white';
    case 'pdf':
      return 'bg-gradient-to-r from-rose-600 to-red-600 text-white';
    case 'mobi':
    case 'azw3':
    case 'kf8':
      return 'bg-gradient-to-r from-amber-600 to-orange-600 text-white';
    case 'cbz':
    case 'cbr':
      return 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white';
    default:
      return 'bg-gradient-to-r from-violet-600 to-purple-600 text-white';
  }
}

export const BookCard: React.FC<BookCardProps> = ({
  book,
  onOpen,
  onEdit,
  onDelete,
}) => {
  const percent = Math.round((book.progress || 0) * 100);
  const isFinished = percent >= 98;
  const theme = COVER_THEMES[getThemeIndex(book.title)];

  return (
    <div
      onClick={() => onOpen(book)}
      className="group relative flex flex-col rounded-2xl border border-border/80 bg-card p-3.5 book-card-shadow transition-all duration-300 hover:-translate-y-2 hover:border-primary/40 cursor-pointer select-none overflow-hidden"
    >
      {/* ─── 3D Realistic Book Cover ─── */}
      <div className="relative aspect-[2/3] w-full overflow-hidden rounded-xl bg-muted shadow-md group-hover:shadow-xl transition-all duration-300">
        {/* Realistic 3D spine lighting crease overlay */}
        <div className="book-spine-crease" />

        {book.coverPath ? (
          <img
            src={`file://${book.coverPath}`}
            alt={book.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          /* Procedural Ornamental Book Jacket */
          <div
            className={`flex h-full w-full flex-col justify-between bg-gradient-to-b ${theme.bg} p-4 text-center relative overflow-hidden`}
          >
            {/* Elegant outer & inner borders */}
            <div
              className={`absolute inset-2.5 rounded-lg border ${theme.border} pointer-events-none`}
            />
            <div
              className={`absolute inset-3.5 rounded border ${theme.border} opacity-50 pointer-events-none`}
            />

            {/* Top ornament / branding */}
            <div className="z-10 pt-2">
              <span className="text-[9px] font-mono uppercase tracking-[0.25em] text-white/50">
                PageTurn Classic
              </span>
            </div>

            {/* Center: Book Initial & Title */}
            <div className="z-10 my-auto px-2">
              <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                <span className="font-serif text-lg font-bold text-white">
                  {book.title.charAt(0).toUpperCase()}
                </span>
              </div>
              <h4
                className={`line-clamp-3 font-serif text-sm font-bold leading-snug tracking-tight ${theme.title}`}
              >
                {book.title}
              </h4>
              <p
                className={`line-clamp-1 text-[11px] font-sans mt-1.5 font-medium tracking-wider uppercase opacity-80 ${theme.author}`}
              >
                {book.author}
              </p>
            </div>

            {/* Bottom: subtle divider */}
            <div className="z-10 pb-1">
              <div className="mx-auto h-0.5 w-8 bg-white/25 rounded-full" />
            </div>
          </div>
        )}

        {/* Format Badge */}
        <Badge
          className={`absolute top-2.5 left-2.5 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm border-0 ${getFormatBadgeStyle(
            book.format
          )}`}
        >
          {book.format}
        </Badge>

        {/* Progress Pill / Completed Ribbon */}
        {isFinished ? (
          <div className="absolute bottom-2 left-2 z-10 flex items-center space-x-1 rounded-full bg-emerald-600/90 backdrop-blur-md px-2 py-0.5 text-[10px] font-semibold text-white shadow">
            <CheckCircle2 className="h-3 w-3" />
            <span>Finished</span>
          </div>
        ) : percent > 0 ? (
          <div className="absolute bottom-2 left-2 z-10 rounded-full bg-black/65 backdrop-blur-md px-2 py-0.5 text-[10px] font-medium text-white shadow">
            <span>{percent}% read</span>
          </div>
        ) : null}

        {/* Hover "Read Now" Quick Button Overlay */}
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="flex items-center space-x-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform duration-200">
            <Play className="h-3.5 w-3.5 fill-current" />
            <span>Read Now</span>
          </div>
        </div>

        {/* Context Menu Button */}
        <div
          className="absolute top-2.5 right-2.5 z-30 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7 rounded-full bg-background/85 backdrop-blur-md shadow hover:bg-background"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(book)}>
                <BookOpen className="mr-2 h-4 w-4" /> Open Reader
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(book)}>
                <Edit className="mr-2 h-4 w-4" /> Edit Details
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDelete(book.id)}
              >
                <Trash2 className="mr-2 h-4 w-4" /> Remove Book
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ─── Book Title, Author & Progress Bar ─── */}
      <div className="mt-3 flex flex-1 flex-col justify-between">
        <div>
          <h3
            className="line-clamp-1 font-semibold text-sm text-foreground group-hover:text-primary transition-colors"
            title={book.title}
          >
            {book.title}
          </h3>
          <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5 font-medium">
            {book.author}
          </p>
        </div>

        {/* Micro progress bar */}
        <div className="mt-2.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isFinished ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
