import React from 'react';
import { X, ChevronRight } from 'lucide-react';
import type { TocItem } from '../../../shared/types';
import { useReaderStore } from '../../stores/reader-store';
import { Button } from '../ui/button';

interface TocSidebarProps {
  onNavigate: (href: string) => void;
}

export const TocSidebar: React.FC<TocSidebarProps> = ({ onNavigate }) => {
  const { toc, currentChapter, toggleToc } = useReaderStore();

  const renderItem = (item: TocItem, level = 0) => {
    const isCurrent = currentChapter === item.label;

    return (
      <div key={item.href || item.label} className="flex flex-col">
        <button
          onClick={() => {
            onNavigate(item.href);
            toggleToc(false);
          }}
          style={{ paddingLeft: `${16 + level * 16}px` }}
          className={`flex items-center text-left py-2 pr-4 text-xs rounded-md transition-colors ${
            isCurrent
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-foreground/80 hover:bg-muted hover:text-foreground'
          }`}
        >
          <ChevronRight className="h-3 w-3 mr-1.5 opacity-40 flex-shrink-0" />
          <span className="truncate">{item.label}</span>
        </button>

        {item.subitems && item.subitems.length > 0 && (
          <div className="flex flex-col">
            {item.subitems.map((sub) => renderItem(sub, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="w-72 border-r border-border bg-card/95 backdrop-blur flex flex-col h-full z-20 shrink-0 select-none animate-in slide-in-from-left-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">Table of Contents</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleToc(false)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {toc.length === 0 ? (
          <div className="p-4 text-center text-xs text-muted-foreground">
            No table of contents available for this book.
          </div>
        ) : (
          toc.map((item) => renderItem(item))
        )}
      </div>
    </aside>
  );
};

