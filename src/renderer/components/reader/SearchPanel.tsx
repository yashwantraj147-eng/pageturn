import React from 'react';
import { X, Search as SearchIcon, Loader2 } from 'lucide-react';
import { useReaderStore } from '../../stores/reader-store';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface SearchPanelProps {
  onSearch: (query: string) => void;
  onNavigateToResult: (cfi?: string, page?: number) => void;
  isSearching?: boolean;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  onSearch,
  onNavigateToResult,
  isSearching,
}) => {
  const { searchQuery, searchResults, setSearchQuery, toggleSearch } =
    useReaderStore();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onSearch(searchQuery);
    }
  };

  return (
    <aside className="w-80 border-l border-border bg-card/95 backdrop-blur flex flex-col h-full z-20 shrink-0 select-none animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">Search in Book</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSearch(false)}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-border">
        <div className="relative">
          <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type text and press Enter..."
            className="pl-8 h-8 text-xs"
            autoFocus
          />
        </div>
        <div className="flex justify-between items-center mt-2 text-[11px] text-muted-foreground px-1">
          <span>
            {isSearching ? 'Searching book...' : `${searchResults.length} results found`}
          </span>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onSearch(searchQuery)}
            disabled={!searchQuery.trim() || isSearching}
            className="h-6 text-[10px] px-2"
          >
            Search
          </Button>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isSearching ? (
          <div className="flex items-center justify-center p-8 text-xs text-muted-foreground space-x-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span>Searching text...</span>
          </div>
        ) : searchResults.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted-foreground">
            {searchQuery ? 'No occurrences found.' : 'Enter a word or phrase to find in this book.'}
          </div>
        ) : (
          searchResults.map((res, i) => (
            <div
              key={i}
              onClick={() => onNavigateToResult(res.cfi, res.page)}
              className="rounded-lg border border-border bg-background p-2.5 text-xs shadow-sm hover:border-primary/50 transition-colors cursor-pointer"
            >
              {res.chapter && (
                <div className="text-[10px] font-semibold text-primary mb-1 truncate">
                  {res.chapter}
                </div>
              )}
              <p className="line-clamp-2 text-foreground font-serif leading-relaxed">
                {res.text}
              </p>
              {res.page && (
                <div className="text-[10px] text-muted-foreground/60 text-right mt-1">
                  Page {res.page}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  );
};

