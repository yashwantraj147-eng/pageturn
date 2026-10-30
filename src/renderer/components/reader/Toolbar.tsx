import React from 'react';
import {
  ArrowLeft,
  List,
  Search,
  Bookmark,
  Highlighter,
  Settings,
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useReaderStore } from '../../stores/reader-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { Button } from '../ui/button';
import { truncateText } from '../../lib/utils';

interface ToolbarProps {
  isSpeaking?: boolean;
  onToggleSpeech?: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  isSpeaking,
  onToggleSpeech,
}) => {
  const {
    currentBook,
    closeBook,
    isFullscreen,
    toggleFullscreen,
    isTocOpen,
    toggleToc,
    isSearchOpen,
    toggleSearch,
    isAnnotationPanelOpen,
    toggleAnnotationPanel,
    isSettingsOpen,
    toggleSettings,
    currentPage,
    currentChapter,
  } = useReaderStore();

  const { addBookmark, annotations } = useAnnotationStore();

  if (!currentBook) return null;

  const isBookmarked = annotations.some(
    (a) => a.type === 'bookmark' && a.page === currentPage
  );

  const handleBookmark = async () => {
    if (!currentBook) return;
    await addBookmark({
      bookId: currentBook.id,
      page: currentPage,
      chapter: currentChapter,
    });
  };

  return (
    <header className="h-14 border-b border-border bg-background/95 backdrop-blur px-4 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Left: Back button & Book title */}
      <div className="flex items-center space-x-3 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={closeBook}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Back to Library (Ctrl+L)"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="min-w-0 flex flex-col">
          <span
            className="text-sm font-semibold truncate leading-tight text-foreground"
            title={currentBook.title}
          >
            {truncateText(currentBook.title, 40)}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {currentBook.author}
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center space-x-1">
        {onToggleSpeech && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSpeech}
            className={`h-8 w-8 rounded-lg transition-all ${
              isSpeaking
                ? 'text-primary bg-primary/15 shadow-sm ring-1 ring-primary/30'
                : 'text-muted-foreground hover:text-foreground'
            }`}
            title={isSpeaking ? 'Pause reading aloud' : 'Read aloud with text-to-speech'}
          >
            {isSpeaking ? (
              <div className="flex items-center space-x-0.5 h-3.5 px-0.5">
                <span className="audio-wave-bar w-0.5 bg-primary rounded-full inline-block" />
                <span className="audio-wave-bar w-0.5 bg-primary rounded-full inline-block" />
                <span className="audio-wave-bar w-0.5 bg-primary rounded-full inline-block" />
                <span className="audio-wave-bar w-0.5 bg-primary rounded-full inline-block" />
              </div>
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </Button>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleToc()}
          className={`h-8 w-8 rounded-lg ${
            isTocOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Table of Contents (Ctrl+T)"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSearch()}
          className={`h-8 w-8 rounded-lg ${
            isSearchOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Search in Book (Ctrl+F)"
        >
          <Search className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={handleBookmark}
          className={`h-8 w-8 rounded-lg ${
            isBookmarked ? 'text-amber-500' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Bookmark this page (Ctrl+B)"
        >
          <Bookmark className={`h-4 w-4 ${isBookmarked ? 'fill-amber-500 text-amber-500' : ''}`} />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleAnnotationPanel()}
          className={`h-8 w-8 ${
            isAnnotationPanelOpen
              ? 'bg-accent text-accent-foreground'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Highlights & Notes"
        >
          <Highlighter className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={() => toggleSettings()}
          className={`h-8 w-8 ${
            isSettingsOpen ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
          title="Display Settings"
        >
          <Settings className="h-4 w-4" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          onClick={toggleFullscreen}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          title="Toggle Fullscreen (F11)"
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>
    </header>
  );
};

