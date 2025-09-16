'use client';

import { useState } from 'react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Loader2, Trash2, AlertTriangle } from 'lucide-react';

interface DeleteColumnDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: {
    id: number;
    title: string;
    cards?: any[];
  };
  onColumnDeleted: (columnId: number) => void;
}

export function DeleteColumnDialog({ 
  open, 
  onOpenChange, 
  column, 
  onColumnDeleted 
}: DeleteColumnDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hasCards = column.cards && column.cards.length > 0;

  const handleDelete = async () => {
    if (hasCards) {
      setError('Cannot delete column with cards. Please move or delete all cards first.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/columns/${column.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete column');
      }

      // Notify parent component
      onColumnDeleted(column.id);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-600" />
            Delete Column
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete the column "{column.title}"? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {hasCards && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertTitle className="text-yellow-800">
                Column contains {column.cards?.length} card{column.cards?.length !== 1 ? 's' : ''}
              </AlertTitle>
              <AlertDescription className="text-yellow-700">
                You must move or delete all cards before deleting this column.
              </AlertDescription>
            </Alert>
          )}

          {!hasCards && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>This will permanently delete the column</AlertTitle>
              <AlertDescription>
                This action cannot be undone.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading || hasCards}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Column
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
