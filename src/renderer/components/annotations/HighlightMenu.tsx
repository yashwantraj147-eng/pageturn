import React from 'react';
import { Highlighter, StickyNote, Copy, BookOpen, Volume2 } from 'lucide-react';
import type { HighlightColor } from '../../../shared/types';
import { HIGHLIGHT_COLORS } from '../../../shared/constants';

interface HighlightMenuProps {
  position: { x: number; y: number } | null;
  selectedText: string;
  onHighlight: (color: HighlightColor) => void;
  onAddNote: () => void;
  onLookup: (word: string) => void;
  onSpeak: (text: string) => void;
  onClose: () => void;
}

export const HighlightMenu: React.FC<HighlightMenuProps> = ({
  position,
  selectedText,
  onHighlight,
  onAddNote,
  onLookup,
  onSpeak,
  onClose,
}) => {
  if (!position) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(selectedText);
    onClose();
  };

  const colors: HighlightColor[] = ['yellow', 'green', 'blue', 'pink', 'orange'];

  return (
    <div
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        transform: 'translate(-50%, -100%) translateY(-10px)',
      }}
      className="z-50 flex items-center space-x-1.5 rounded-full border border-border bg-popover/95 px-3 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Color circles */}
      <div className="flex items-center space-x-1 pr-1.5 border-r border-border">
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => onHighlight(c)}
            style={{ backgroundColor: HIGHLIGHT_COLORS[c] }}
            className="h-5 w-5 rounded-full border border-black/10 shadow-sm transition-transform hover:scale-125 focus:outline-none"
            title={`Highlight in ${c}`}
          />
        ))}
      </div>

      {/* Note button */}
      <button
        onClick={onAddNote}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
        title="Add note"
      >
        <StickyNote className="h-4 w-4" />
      </button>

      {/* Dictionary lookup */}
      <button
        onClick={() => onLookup(selectedText.trim())}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
        title="Look up in dictionary"
      >
        <BookOpen className="h-4 w-4" />
      </button>

      {/* Text-to-speech */}
      <button
        onClick={() => onSpeak(selectedText)}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
        title="Read aloud"
      >
        <Volume2 className="h-4 w-4" />
      </button>

      {/* Copy */}
      <button
        onClick={handleCopy}
        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition-colors"
        title="Copy text"
      >
        <Copy className="h-4 w-4" />
      </button>
    </div>
  );
};

