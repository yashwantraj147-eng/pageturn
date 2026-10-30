import React, { useState } from 'react';
import { X, Trash2, Download, Highlighter, StickyNote, Bookmark } from 'lucide-react';
import { useAnnotationStore } from '../../stores/annotation-store';
import { useReaderStore } from '../../stores/reader-store';
import { Button } from '../ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { HIGHLIGHT_COLORS } from '../../../shared/constants';

interface AnnotationPanelProps {
  onNavigateToPosition: (cfi?: string, page?: number) => void;
}

export const AnnotationPanel: React.FC<AnnotationPanelProps> = ({
  onNavigateToPosition,
}) => {
  const { currentBook, toggleAnnotationPanel } = useReaderStore();
  const { annotations, deleteAnnotation, exportAnnotations } = useAnnotationStore();
  const [activeTab, setActiveTab] = useState<'all' | 'highlights' | 'notes' | 'bookmarks'>('all');

  if (!currentBook) return null;

  const highlights = annotations.filter((a) => a.type === 'highlight');
  const notes = annotations.filter((a) => a.type === 'note');
  const bookmarks = annotations.filter((a) => a.type === 'bookmark');

  const filtered =
    activeTab === 'all'
      ? annotations
      : activeTab === 'highlights'
      ? highlights
      : activeTab === 'notes'
      ? notes
      : bookmarks;

  const handleExport = async (format: 'markdown' | 'json') => {
    const text = await exportAnnotations(currentBook.id, format);
    const blob = new Blob([text], {
      type: format === 'json' ? 'application/json' : 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentBook.title}-annotations.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <aside className="w-80 border-l border-border bg-card/95 backdrop-blur flex flex-col h-full z-20 shrink-0 select-none animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-sm font-semibold">Annotations</h2>
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('markdown')}
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            title="Export as Markdown"
          >
            <Download className="h-3.5 w-3.5 mr-1" /> MD
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport('json')}
            className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
            title="Export as JSON"
          >
            <Download className="h-3.5 w-3.5 mr-1" /> JSON
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => toggleAnnotationPanel(false)}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 pt-2">
          <TabsList className="w-full grid grid-cols-4 h-8">
            <TabsTrigger value="all" className="text-xs">
              All ({annotations.length})
            </TabsTrigger>
            <TabsTrigger value="highlights" className="text-xs">
              Hlt ({highlights.length})
            </TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">
              Notes ({notes.length})
            </TabsTrigger>
            <TabsTrigger value="bookmarks" className="text-xs">
              Bkm ({bookmarks.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={activeTab} className="flex-1 overflow-y-auto p-3 space-y-2 mt-0">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No annotations yet. Select text to highlight or add notes, or press Ctrl+B to bookmark!
            </div>
          ) : (
            filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => onNavigateToPosition(item.cfi, item.page)}
                className="group relative rounded-lg border border-border bg-background p-3 text-xs shadow-sm hover:border-primary/40 transition-colors cursor-pointer"
              >
                {/* Header: Type icon & Chapter */}
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <div className="flex items-center space-x-1.5 truncate">
                    {item.type === 'highlight' && (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{
                          backgroundColor:
                            HIGHLIGHT_COLORS[item.color || 'yellow'],
                        }}
                      />
                    )}
                    {item.type === 'note' && <StickyNote className="h-3 w-3 text-primary" />}
                    {item.type === 'bookmark' && <Bookmark className="h-3 w-3 text-amber-500" />}
                    <span className="truncate">
                      {item.chapter || (item.page ? `Page ${item.page}` : 'Section')}
                    </span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteAnnotation(item.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    title="Delete annotation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Text quote */}
                {item.text && (
                  <p className="line-clamp-3 text-foreground font-serif italic mb-1 border-l-2 pl-2 border-primary/30">
                    "{item.text}"
                  </p>
                )}

                {/* Note */}
                {item.note && (
                  <p className="text-foreground/90 font-sans mt-1 bg-muted/40 p-1.5 rounded">
                    {item.note}
                  </p>
                )}

                <div className="text-[10px] text-muted-foreground/60 text-right mt-1">
                  {new Date(item.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </aside>
  );
};

