import React, { useState } from 'react';
import { UploadCloud, FolderSearch, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { useLibraryStore } from '../../stores/library-store';

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ImportDialog: React.FC<ImportDialogProps> = ({
  open,
  onOpenChange,
}) => {
  const { importFile, scanFolder } = useLibraryStore();
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const handleChooseFiles = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    setIsError(false);
    try {
      const book = await importFile();
      if (book) {
        setStatusMessage(`Successfully imported "${book.title}"`);
        setTimeout(() => onOpenChange(false), 1200);
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err?.message || 'Failed to import file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleScanFolder = async () => {
    setIsLoading(true);
    setStatusMessage(null);
    setIsError(false);
    try {
      const count = await scanFolder();
      if (count > 0) {
        setStatusMessage(`Scanned and imported ${count} book(s)!`);
        setTimeout(() => onOpenChange(false), 1500);
      } else {
        setStatusMessage('No new supported books found in the selected folder.');
      }
    } catch (err: any) {
      setIsError(true);
      setStatusMessage(err?.message || 'Failed to scan folder');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Import Books</DialogTitle>
          <DialogDescription>
            Add e-books to your PageTurn library. Supports EPUB, PDF, Kindle (MOBI, AZW3), Comics (CBZ, CBR), and Documents.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Main dropzone / button */}
          <div
            onClick={handleChooseFiles}
            className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-xl p-8 hover:border-primary/50 hover:bg-muted/30 transition-all cursor-pointer text-center"
          >
            <div className="rounded-full bg-primary/10 p-3 text-primary mb-3">
              <UploadCloud className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-semibold mb-1">Choose Files to Import</h4>
            <p className="text-xs text-muted-foreground mb-4">
              EPUB, PDF, MOBI, AZW3, FB2, CBZ, DOCX, TXT, MD
            </p>
            <Button size="sm" disabled={isLoading}>
              Browse Files...
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Or</span>
            </div>
          </div>

          {/* Scan folder button */}
          <Button
            variant="outline"
            className="w-full flex items-center justify-center space-x-2"
            onClick={handleScanFolder}
            disabled={isLoading}
          >
            <FolderSearch className="h-4 w-4" />
            <span>Scan Entire Folder for Books</span>
          </Button>

          {/* Status Message */}
          {isLoading && (
            <div className="flex items-center justify-center space-x-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>Importing books and extracting metadata...</span>
            </div>
          )}

          {statusMessage && (
            <div
              className={`flex items-center space-x-2 rounded-lg p-3 text-xs ${
                isError
                  ? 'bg-destructive/10 text-destructive'
                  : 'bg-green-500/10 text-green-700 dark:text-green-400'
              }`}
            >
              {isError ? (
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
              ) : (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{statusMessage}</span>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

