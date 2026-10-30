import React, { useState } from 'react';
import { useReaderStore } from '../../stores/reader-store';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useKeyboard } from '../../hooks/use-keyboard';
import { useTTS } from '../../hooks/use-tts';
import { useDictionary } from '../../hooks/use-dictionary';
import { Toolbar } from './Toolbar';
import { BottomBar } from './BottomBar';
import { TocSidebar } from './TocSidebar';
import { AnnotationPanel } from './AnnotationPanel';
import { SettingsPanel } from './SettingsPanel';
import { SearchPanel } from './SearchPanel';
import { BookRenderer } from './BookRenderer';
import { TTSPlayerBar } from './TTSPlayerBar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export const Reader: React.FC = () => {
  const {
    currentBook,
    settings,
    isTocOpen,
    isAnnotationPanelOpen,
    isSettingsOpen,
    isSearchOpen,
    setProgress,
    setCurrentPage,
    setCurrentChapter,
    setToc,
    setSearchResults,
    updateSettings,
    toggleFullscreen,
    toggleSearch,
    toggleToc,
    closeBook,
  } = useReaderStore();

  const { addHighlight, addNote } = useAnnotationStore();
  const {
    isSpeaking,
    isPaused,
    voices,
    currentVoice,
    rate,
    sentences,
    currentSentenceIndex,
    currentSentence,
    currentWordCharIndex,
    startPlayback,
    pause,
    resume,
    stop,
    nextSentence,
    prevSentence,
    setVoice,
    setRate,
  } = useTTS();
  const { result: dictResult, isLoading: dictLoading, lookup, clear: clearDict } = useDictionary();

  const [showTTSBar, setShowTTSBar] = useState(false);

  // Dialog for adding a note
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [noteQuote, setNoteQuote] = useState('');
  const [noteContent, setNoteContent] = useState('');

  // Dictionary dialog
  const [dictDialogOpen, setDictDialogOpen] = useState(false);

  // Search state
  const [isSearching, setIsSearching] = useState(false);

  // Keyboard navigation handlers
  const handleNextPage = () => {
    (window as any).__readerNavigate?.next();
  };

  const handlePrevPage = () => {
    (window as any).__readerNavigate?.prev();
  };

  useKeyboard({
    ArrowRight: handleNextPage,
    ArrowLeft: handlePrevPage,
    space: handleNextPage,
    F11: toggleFullscreen,
    'ctrl+f': () => toggleSearch(),
    'ctrl+t': () => toggleToc(),
    'ctrl+l': () => handleCloseBook(),
    'ctrl+=': () => updateSettings({ fontSize: Math.min(40, settings.fontSize + 1) }),
    'ctrl+-': () => updateSettings({ fontSize: Math.max(12, settings.fontSize - 1) }),
  });

  if (!currentBook) return null;

  const handleHighlight = async (color: any, text: string) => {
    await addHighlight({
      bookId: currentBook.id,
      text,
      color,
    });
  };

  const handleAddNoteRequest = (text: string) => {
    setNoteQuote(text);
    setNoteContent('');
    setNoteDialogOpen(true);
  };

  const handleSaveNote = async () => {
    if (!noteContent.trim()) return;
    await addNote({
      bookId: currentBook.id,
      note: noteContent.trim(),
      text: noteQuote,
    });
    setNoteDialogOpen(false);
  };

  const handleLookupRequest = async (word: string) => {
    setDictDialogOpen(true);
    await lookup(word);
  };

  const handleCloseBook = async () => {
    stop();
    setShowTTSBar(false);
    await closeBook();
  };

  const handleToggleSpeech = () => {
    if (showTTSBar && isSpeaking) {
      pause();
    } else if (showTTSBar && isPaused) {
      resume();
    } else {
      const contentEl = document.querySelector('.prose');
      const textToSpeak = contentEl?.textContent || currentBook.title;
      startPlayback(textToSpeak);
      setShowTTSBar(true);
    }
  };

  const handleInBookSearch = async (query: string) => {
    if (!query.trim()) return;
    setIsSearching(true);
    try {
      const results: { text: string; chapter?: string }[] = [];
      const contentEl = document.querySelector('.prose');
      if (contentEl) {
        const text = contentEl.textContent || '';
        const regex = new RegExp(`([^.?!]*?${query}[^.?!]*?[.?!])`, 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          results.push({
            text: match[1].trim(),
            chapter: 'Current Section',
          });
          if (results.length >= 50) break;
        }
      }
      setSearchResults(results);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-background overflow-hidden">
      {/* ─── Top Toolbar ─── */}
      <Toolbar
        isSpeaking={isSpeaking}
        onToggleSpeech={handleToggleSpeech}
      />

      {/* ─── Center Body Area (TOC / Book Content / Panels) ─── */}
      <div className="relative flex flex-1 h-[calc(100vh-6.5rem)] overflow-hidden">
        {/* Table of contents sidebar */}
        {isTocOpen && (
          <TocSidebar
            onNavigate={(href) => {
              (window as any).__readerNavigate?.navigateToHref(href);
            }}
          />
        )}

        {/* The Core Book Renderer */}
        <BookRenderer
          book={currentBook}
          settings={settings}
          ttsActiveSentence={isSpeaking ? currentSentence : undefined}
          onProgressChange={setProgress}
          onPageChange={setCurrentPage}
          onChapterChange={setCurrentChapter}
          onTocLoaded={setToc}
          onHighlightCreated={handleHighlight}
          onAddNoteRequested={handleAddNoteRequest}
          onLookupRequested={handleLookupRequest}
          onSpeakRequested={(text) => {
            startPlayback(text);
            setShowTTSBar(true);
          }}
        />

        {/* Annotations panel */}
        {isAnnotationPanelOpen && (
          <AnnotationPanel
            onNavigateToPosition={(_cfi, page) => {
              if (page) {
                (window as any).__readerNavigate?.seek(page / 100);
              }
            }}
          />
        )}

        {/* Settings panel */}
        {isSettingsOpen && <SettingsPanel />}

        {/* Search panel */}
        {isSearchOpen && (
          <SearchPanel
            isSearching={isSearching}
            onSearch={handleInBookSearch}
            onNavigateToResult={() => {}}
          />
        )}
      </div>

      {/* ─── Bottom Navigation Bar ─── */}
      <BottomBar
        onPrevPage={handlePrevPage}
        onNextPage={handleNextPage}
        onSeekProgress={(val) => {
          (window as any).__readerNavigate?.seek(val);
        }}
      />

      {/* ─── Floating Advanced TTS Player Bar ─── */}
      {showTTSBar && (
        <TTSPlayerBar
          isSpeaking={isSpeaking}
          isPaused={isPaused}
          currentSentence={currentSentence}
          currentWordCharIndex={currentWordCharIndex}
          currentSentenceIndex={currentSentenceIndex}
          totalSentences={sentences.length}
          rate={rate}
          voices={voices}
          currentVoice={currentVoice}
          onPlay={() => {
            if (sentences.length > 0) resume();
            else handleToggleSpeech();
          }}
          onPause={pause}
          onResume={resume}
          onNext={nextSentence}
          onPrev={prevSentence}
          onChangeRate={setRate}
          onChangeVoice={setVoice}
          onClose={() => {
            stop();
            setShowTTSBar(false);
          }}
        />
      )}

      {/* ─── Note Input Dialog ─── */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Note</DialogTitle>
            <DialogDescription className="italic font-serif line-clamp-2 mt-1">
              "{noteQuote}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <textarea
              value={noteContent}
              onChange={(e) => setNoteContent(e.target.value)}
              placeholder="Write your note or thoughts here..."
              className="w-full min-h-[100px] rounded-md border border-input bg-transparent p-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
            />
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveNote}>Save Note</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── Dictionary Lookup Dialog ─── */}
      <Dialog
        open={dictDialogOpen}
        onOpenChange={(open) => {
          setDictDialogOpen(open);
          if (!open) clearDict();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="capitalize">{dictResult?.word || 'Definition'}</span>
              {dictResult?.phonetic && (
                <span className="text-xs font-mono font-normal text-muted-foreground">
                  {dictResult.phonetic}
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 max-h-72 overflow-y-auto space-y-3 text-sm">
            {dictLoading ? (
              <p className="text-muted-foreground text-center py-4">Looking up word...</p>
            ) : dictResult ? (
              dictResult.meanings.map((m, idx) => (
                <div key={idx} className="border-b border-border/50 pb-2 last:border-0">
                  <span className="text-xs font-bold uppercase text-primary tracking-wider">
                    {m.partOfSpeech}
                  </span>
                  <ul className="list-disc pl-5 mt-1 space-y-1 text-xs">
                    {m.definitions.map((d, dIdx) => (
                      <li key={dIdx}>
                        <span>{d.definition}</span>
                        {d.example && (
                          <p className="italic text-muted-foreground mt-0.5">
                            "{d.example}"
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground text-center">No definition found.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

