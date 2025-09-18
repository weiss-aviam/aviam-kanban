'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Edit, Loader2 } from 'lucide-react';
import type { BoardWithDetails } from '@/types/database';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';


interface EditBoardDialogProps {
  board: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBoardUpdated?: (board: any) => void;
}

export function EditBoardDialog({
  board,
  open,
  onOpenChange,
  onBoardUpdated
}: EditBoardDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const schema = z.object({ name: z.string().min(1, 'Board name is required') });
  type FormValues = z.infer<typeof schema>;
  const { register, handleSubmit: rhfHandleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '' },
  });

  useEffect(() => {
    reset({ name: board?.name ?? '' });
  }, [board, reset]);

  const onSubmit = async ({ name }: FormValues) => {
    if (!board) return;

    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update board');
      }

      const { board: updatedBoard } = await response.json();

      // Close dialog
      onOpenChange(false);

      // Notify parent component
      if (onBoardUpdated) {
        onBoardUpdated(updatedBoard);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-[90vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Board</DialogTitle>
          <DialogDescription>
            Update the board name and settings.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={rhfHandleSubmit(onSubmit)} className="space-y-6">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-4 rounded-md border border-red-200">
              {error}
            </div>
          )}

          <div className="space-y-3">
            <Label htmlFor="name" className="text-base font-medium">Board Name</Label>
            <Input
              id="name"
              placeholder="Enter board name..."
              disabled={isLoading}
              autoFocus
              className="h-11"
              {...register('name')}
            />
          </div>

          <DialogFooter className="pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Edit className="w-4 h-4 mr-2" />
                  Update Board
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
