'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DeleteConfirmationDialog } from '../ui/delete-confirmation-dialog';
import { useAppActions } from '@/store';
import type { BoardWithDetails } from '@/types/database';

interface DeleteBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: BoardWithDetails | null;
  onConfirm?: () => Promise<void>;
}

export function DeleteBoardDialog({
  open,
  onOpenChange,
  board,
  onConfirm,
}: DeleteBoardDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { removeBoard, setError } = useAppActions();
  const router = useRouter();

  const handleDelete = async () => {
    if (!board) return;

    setIsLoading(true);
    try {
      if (onConfirm) {
        // Use custom confirmation handler (for boards page)
        await onConfirm();
      } else {
        // Default behavior (for board detail page)
        const response = await fetch(`/api/boards/${board.id}`, {
          method: 'DELETE',
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to delete board');
        }

        // Update the store
        removeBoard(board.id);

        // Redirect to boards list
        router.push('/boards');
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error deleting board:', error);
      setError(error instanceof Error ? error.message : 'Failed to delete board');
    } finally {
      setIsLoading(false);
    }
  };

  if (!board) return null;

  const totalCards = board.columns?.reduce((total, column) => total + (column.cards?.length || 0), 0) || 0;
  const columnCount = board.columns?.length || 0;

  return (
    <DeleteConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Delete Board"
      description={
        `This will permanently delete the board "${board.name}" along with all ${columnCount} column${columnCount === 1 ? '' : 's'} and ${totalCards} card${totalCards === 1 ? '' : 's'}. This action cannot be undone.`
      }
      confirmationText={board.name}
      destructiveAction="Delete Board"
      onConfirm={handleDelete}
      isLoading={isLoading}
    />
  );
}
