import React, { useState, useEffect } from 'react';
import type { BookMeta } from '../../../shared/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { useLibraryStore } from '../../stores/library-store';

interface EditBookDialogProps {
  book: BookMeta | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const EditBookDialog: React.FC<EditBookDialogProps> = ({
  book,
  open,
  onOpenChange,
}) => {
  const { updateBook } = useLibraryStore();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [publisher, setPublisher] = useState('');
  const [tags, setTags] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (book) {
      setTitle(book.title || '');
      setAuthor(book.author || '');
      setPublisher(book.publisher || '');
      setTags((book.tags || []).join(', '));
      setDescription(book.description || '');
    }
  }, [book]);

  const handleSave = async () => {
    if (!book) return;
    const tagList = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    await updateBook(book.id, {
      title: title.trim() || book.title,
      author: author.trim() || 'Unknown',
      publisher: publisher.trim() || undefined,
      tags: tagList,
      description: description.trim() || undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Book Details</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3 py-3 text-sm">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Title
            </label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Book Title"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Author
            </label>
            <Input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              placeholder="Author Name"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Publisher
            </label>
            <Input
              value={publisher}
              onChange={(e) => setPublisher(e.target.value)}
              placeholder="Publisher"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Tags (comma separated)
            </label>
            <Input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="Fiction, Sci-Fi, Favorites"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">
              Description
            </label>
            <textarea
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Book description or synopsis"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

