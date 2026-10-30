import React from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  X,
  Volume2,
  Gauge,
  UserCheck,
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';

interface TTSPlayerBarProps {
  isSpeaking: boolean;
  isPaused: boolean;
  currentSentence: string;
  currentWordCharIndex: number;
  currentSentenceIndex: number;
  totalSentences: number;
  rate: number;
  voices: SpeechSynthesisVoice[];
  currentVoice: SpeechSynthesisVoice | null;
  onPlay: () => void;
  onPause: () => void;
  onResume: () => void;
  onNext: () => void;
  onPrev: () => void;
  onChangeRate: (rate: number) => void;
  onChangeVoice: (voice: SpeechSynthesisVoice) => void;
  onClose: () => void;
}

export const TTSPlayerBar: React.FC<TTSPlayerBarProps> = ({
  isSpeaking,
  isPaused,
  currentSentence,
  currentWordCharIndex,
  currentSentenceIndex,
  totalSentences,
  rate,
  voices,
  currentVoice,
  onPlay,
  onPause,
  onResume,
  onNext,
  onPrev,
  onChangeRate,
  onChangeVoice,
  onClose,
}) => {
  const speedPresets = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

  // Karaoke word rendering: split sentence into words and highlight word at currentWordCharIndex
  const renderKaraokeSentence = () => {
    if (!currentSentence) return null;

    // Split sentence into words and find the word containing currentWordCharIndex
    let accumulated = 0;
    const words = currentSentence.split(/(\s+)/);

    return words.map((chunk, i) => {
      const start = accumulated;
      const end = accumulated + chunk.length;
      accumulated = end;

      const isCurrentWord =
        isSpeaking &&
        !isPaused &&
        currentWordCharIndex >= start &&
        currentWordCharIndex <= end &&
        chunk.trim().length > 0;

      return (
        <span
          key={i}
          className={`transition-colors duration-150 ${
            isCurrentWord
              ? 'bg-amber-300 dark:bg-amber-500/40 text-black dark:text-white rounded px-0.5 font-semibold shadow-sm'
              : ''
          }`}
        >
          {chunk}
        </span>
      );
    });
  };

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-[92%] max-w-3xl z-40 animate-in slide-in-from-bottom-6 duration-300">
      <div className="flex flex-col rounded-2xl border border-border/80 bg-background/95 backdrop-blur-xl shadow-2xl p-4 text-xs select-none">
        {/* Top: Progress & Voice Info */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-muted-foreground">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1.5 text-primary font-medium">
              <Volume2 className="h-4 w-4 animate-pulse" />
              <span>Read Aloud</span>
            </div>
            {totalSentences > 0 && (
              <span className="text-[11px] font-mono opacity-80">
                Sentence {currentSentenceIndex + 1} of {totalSentences}
              </span>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Voice Dropdown */}
            {voices.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-[11px] px-2 space-x-1.5 text-muted-foreground hover:text-foreground"
                  >
                    <UserCheck className="h-3.5 w-3.5" />
                    <span className="truncate max-w-[130px]">
                      {currentVoice?.name || 'Voice'}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-60 overflow-y-auto w-64">
                  {voices.map((v) => (
                    <DropdownMenuItem
                      key={v.name}
                      onClick={() => onChangeVoice(v)}
                      className="text-xs flex items-center justify-between"
                    >
                      <span className="truncate">{v.name}</span>
                      <span className="text-[10px] opacity-60 ml-2 font-mono">
                        {v.lang}
                      </span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {/* Close audio bar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-6 w-6 text-muted-foreground hover:text-foreground rounded-full"
              title="Close player"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Center: Live Sentence Karaoke Text */}
        <div className="min-h-[44px] flex items-center justify-center text-center px-4 py-2 my-1 rounded-xl bg-muted/40 font-serif text-sm leading-relaxed text-foreground/90">
          <p className="line-clamp-2">
            {currentSentence ? renderKaraokeSentence() : 'Ready to read aloud'}
          </p>
        </div>

        {/* Bottom: Playback Controls */}
        <div className="flex items-center justify-between pt-2">
          {/* Speed Preset Selector */}
          <div className="flex items-center space-x-1">
            <Gauge className="h-3.5 w-3.5 text-muted-foreground mr-1" />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs font-mono"
                >
                  {rate}x
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-[80px]">
                {speedPresets.map((speed) => (
                  <DropdownMenuItem
                    key={speed}
                    onClick={() => onChangeRate(speed)}
                    className={`text-xs font-mono justify-center ${
                      rate === speed ? 'bg-primary/10 text-primary font-bold' : ''
                    }`}
                  >
                    {speed}x
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Main Audio Buttons: Prev, Play/Pause, Next */}
          <div className="flex items-center space-x-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrev}
              disabled={currentSentenceIndex <= 0}
              className="h-8 w-8 rounded-full text-foreground/80 hover:text-foreground"
              title="Previous sentence"
            >
              <SkipBack className="h-4 w-4" />
            </Button>

            <Button
              variant="default"
              size="icon"
              onClick={() => {
                if (isSpeaking && !isPaused) {
                  onPause();
                } else if (isPaused) {
                  onResume();
                } else {
                  onPlay();
                }
              }}
              className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-md hover:scale-105 transition-transform"
              title={isSpeaking && !isPaused ? 'Pause' : 'Play'}
            >
              {isSpeaking && !isPaused ? (
                <Pause className="h-5 w-5" />
              ) : (
                <Play className="h-5 w-5 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              disabled={currentSentenceIndex >= totalSentences - 1}
              className="h-8 w-8 rounded-full text-foreground/80 hover:text-foreground"
              title="Next sentence"
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </div>

          {/* Progress % */}
          <div className="text-right text-[11px] font-mono text-muted-foreground min-w-[50px]">
            {totalSentences > 0
              ? `${Math.round(((currentSentenceIndex + 1) / totalSentences) * 100)}%`
              : '0%'}
          </div>
        </div>
      </div>
    </div>
  );
};

