import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useReaderStore } from '../../stores/reader-store';
import { Slider } from '../ui/slider';
import { Button } from '../ui/button';

interface BottomBarProps {
  onPrevPage: () => void;
  onNextPage: () => void;
  onSeekProgress?: (progress: number) => void;
}

export const BottomBar: React.FC<BottomBarProps> = ({
  onPrevPage,
  onNextPage,
  onSeekProgress,
}) => {
  const { progress, currentPage, totalPages, currentChapter, setProgress } =
    useReaderStore();

  const percent = Math.round((progress || 0) * 100);

  // Estimate time left: assuming 250 words per minute / 1 page per 1.5 min
  const pagesLeft = Math.max(0, totalPages - currentPage);
  const estMinutesLeft = Math.round(pagesLeft * 1.5);
  const timeEstimateStr =
    estMinutesLeft > 60
      ? `${Math.floor(estMinutesLeft / 60)}h ${estMinutesLeft % 60}m left`
      : `${estMinutesLeft}m left`;

  const handleSliderChange = (vals: number[]) => {
    const val = vals[0] / 100;
    setProgress(val);
    if (onSeekProgress) {
      onSeekProgress(val);
    }
  };

  return (
    <footer className="h-12 border-t border-border bg-background/95 backdrop-blur px-6 flex items-center justify-between z-20 shrink-0 select-none">
      {/* Page navigation */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={onPrevPage}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Previous Page (Left Arrow)"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground min-w-[70px] text-center">
          {totalPages > 1 ? `${currentPage} / ${totalPages}` : `${percent}%`}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onNextPage}
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          title="Next Page (Right Arrow / Space)"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Chapter & Progress slider */}
      <div className="flex-1 max-w-xl mx-8 flex items-center space-x-4">
        {currentChapter && (
          <span className="text-xs text-muted-foreground truncate max-w-[160px] hidden md:inline">
            {currentChapter}
          </span>
        )}
        <Slider
          value={[percent]}
          max={100}
          step={1}
          onValueChange={handleSliderChange}
          className="w-full cursor-pointer"
        />
        <span className="text-xs font-mono text-muted-foreground w-10 text-right">
          {percent}%
        </span>
      </div>

      {/* Reading Time left */}
      <div className="text-xs text-muted-foreground hidden sm:block">
        {totalPages > 1 && pagesLeft > 0 ? timeEstimateStr : 'Reading'}
      </div>
    </footer>
  );
};

