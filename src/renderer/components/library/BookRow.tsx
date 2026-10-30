import React from 'react';
import { MoreVertical, BookOpen, Edit, Trash2, CheckCircle2 } from 'lucide-react';
import type { BookMeta } from '../../../shared/types';
import { Badge } from '../ui/badge';
import { formatFileSize } from '../../lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Button } from '../ui/button';

interface BookRowProps {
  book: BookMeta;
  onOpen: (book: BookMeta) => void;
  onEdit: (book: BookMeta) => void;
  onDelete: (id: string) => void;
}

export const BookRow: React.FC<BookRowProps> = ({
  book,
  onOpen,
  onEdit,
  onDelete,
}) => {
  const percent = Math.round((book.progress || 0) * 100);
  const isFinished = percent >= 98;
  const dateStr = new Date(book.dateAdded).toLocaleDateString();

  return (
    <div
      onClick={() => onOpen(book)}
      className="group flex items-center justify-between rounded-xl border border-border/80 bg-card p-3 shadow-sm hover:border-primary/40 hover:bg-muted/30 transition-all duration-200 cursor-pointer select-none"
    >
      <div className="flex items-center space-x-4 min-w-0 flex-1">
        {/* Cover thumbnail with spine effect */}
        <div className="relative h-14 w-10 flex-shrink-0 overflow-hidden rounded-md bg-muted shadow-sm flex items-center justify-center">
          <div className="book-spine-crease" />
          {book.coverPath ? (
            <img
              src={`file://${book.coverPath}`}
              alt={book.title}
              className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary/10 font-serif font-bold text-sm text-primary">
              {book.title.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        {/* Title & Author */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center space-x-2">
            <h3 className="line-clamp-1 font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
              {book.title}
            </h3>
            <Badge variant="outline" className="text-[10px] uppercase font-mono h-4 px-1.5 font-bold">
              {book.format}
            </Badge>
          </div>
          <p className="line-clamp-1 text-xs text-muted-foreground mt-0.5 font-medium">
            {book.author}
          </p>
        </div>
      </div>

      {/* Progress & Meta info */}
      <div className="flex items-center space-x-6 ml-4 flex-shrink-0">
        <div className="w-32 hidden sm:block">
          <div className="flex justify-between text-[11px] text-muted-foreground mb-1 font-mono">
            <span>Progress</span>
            <span className="font-semibold text-foreground">
              {isFinished ? 'Finished' : `${percent}%`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isFinished ? 'bg-emerald-500' : 'bg-primary'
              }`}
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>

        <div className="text-right hidden md:block text-xs text-muted-foreground min-w-[70px] font-mono">
          <div>{formatFileSize(book.fileSize)}</div>
          <div className="text-[10px] opacity-75">{dateStr}</div>
        </div>

        {/* Menu */}
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onOpen(book)}>
                <BookOpen className="mr-2 h-4 w-4" /> Read
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
    </div>
  );
};
