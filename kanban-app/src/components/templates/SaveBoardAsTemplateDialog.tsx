'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Save, Loader2 } from 'lucide-react';

interface Column {
  id: number;
  title: string;
  position: number;
}

interface SaveBoardAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  boardName: string;
  columns: Column[];
  onTemplateSaved?: (template: any) => void;
}

export function SaveBoardAsTemplateDialog({
  open,
  onOpenChange,
  boardId,
  boardName,
  columns,
  onTemplateSaved,
}: SaveBoardAsTemplateDialogProps) {
  const [name, setName] = useState(`${boardName} Template`);
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      setError('Template name is required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // Create the template
      const templateResponse = await fetch('/api/templates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          isPublic,
          columns: columns.map(col => ({
            title: col.title,
            position: col.position,
          })),
        }),
      });

      if (!templateResponse.ok) {
        const errorData = await templateResponse.json();
        throw new Error(errorData.error || 'Failed to save template');
      }

      const newTemplate = await templateResponse.json();
      onTemplateSaved?.(newTemplate);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save template');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName(`${boardName} Template`);
    setDescription('');
    setIsPublic(false);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="w-5 h-5" />
            Save Board as Template
          </DialogTitle>
          <DialogDescription>
            Save the current column structure of `${boardName}` as a reusable template for future boards.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter template name"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="template-description">Description (Optional)</Label>
            <Textarea
              id="template-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe when to use this template"
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-3">
            <Label>Column Preview</Label>
            <div className="bg-gray-50 p-3 rounded-md">
              <div className="flex flex-wrap gap-2">
                {columns?.map((column) => (
                  <div
                    key={column.id}
                    className="bg-white px-3 py-1 rounded border text-sm"
                  >
                    {column.title}
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {columns?.length} column{columns?.length !== 1 ? 's' : ''} will be included in this template
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="is-public"
              checked={isPublic}
              onCheckedChange={(checked) => setIsPublic(checked as boolean)}
              disabled={isLoading}
            />
            <Label htmlFor="is-public" className="text-sm">
              Make this template public (visible to all users)
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Template
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
