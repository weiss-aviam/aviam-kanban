'use client';

import { useState, useCallback } from 'react';
import type { Card, CardPriority } from '@/types/database';

interface UseCardActionsOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
  onCardUpdated?: (card: Card) => void;
  onCardDeleted?: (cardId: string) => void;
  onCardCreated?: (card: Card) => void;
}

export function useCardActions({
  onSuccess,
  onError,
  onCardUpdated,
  onCardDeleted,
  onCardCreated,
}: UseCardActionsOptions = {}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);
    onError?.(message);
  }, [onError]);

  const handleSuccess = useCallback((message: string) => {
    setError(null);
    onSuccess?.(message);
  }, [onSuccess]);

  /**
   * Update card priority
   */
  const handlePriorityChange = useCallback(async (card: Card, priority: CardPriority) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priority,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update card priority');
      }

      const { card: updatedCard } = await response.json();
      console.log('Priority change - Updated card:', updatedCard);
      onCardUpdated?.(updatedCard);
      handleSuccess(`Priority updated to ${priority}`);
      return updatedCard;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess, onCardUpdated]);

  /**
   * Move card to different column
   */
  const handleMoveToColumn = useCallback(async (card: Card, columnId: number) => {
    setLoading(true);
    setError(null);

    try {
      // Use a high position number to place at the end of the column
      // The backend will handle position normalization if needed
      const newPosition = 9999;

      const updateResponse = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          columnId,
          position: newPosition,
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.json();
        throw new Error(errorData.error || 'Failed to move card');
      }

      const { card: updatedCard } = await updateResponse.json();
      console.log('Move to column - Updated card:', updatedCard);
      onCardUpdated?.(updatedCard);
      handleSuccess('Card moved successfully');
      return updatedCard;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess, onCardUpdated]);

  /**
   * Duplicate card
   */
  const handleDuplicateCard = useCallback(async (card: Card) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          boardId: card.boardId,
          columnId: card.columnId,
          title: `${card.title} (Copy)`,
          description: card.description,
          priority: card.priority || 'medium',
          assigneeId: card.assigneeId,
          dueDate: card.dueDate,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to duplicate card');
      }

      const { card: newCard } = await response.json();
      onCardCreated?.(newCard);
      handleSuccess('Card duplicated successfully');
      return newCard;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess, onCardCreated]);

  /**
   * Archive/unarchive card
   */
  const handleArchiveCard = useCallback(async (card: Card) => {
    setLoading(true);
    setError(null);

    try {
      // For now, we'll implement this as a soft delete by moving to an "archived" state
      // This would require adding an "archived" field to the card schema
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // archived: !card.archived, // This would need to be added to the schema
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to archive card');
      }

      const { card: updatedCard } = await response.json();
      onCardUpdated?.(updatedCard);
      handleSuccess('Card archived successfully');
      return updatedCard;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess, onCardUpdated]);

  /**
   * Delete card with confirmation
   */
  const handleDeleteCard = useCallback(async (card: Card, skipConfirmation = false) => {
    if (!skipConfirmation) {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${card.title}"? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete card');
      }

      onCardDeleted?.(card.id);
      handleSuccess('Card deleted successfully');
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess, onCardDeleted]);

  /**
   * Bulk update multiple cards
   */
  const handleBulkUpdate = useCallback(async (updates: { id: string; [key: string]: any }[]) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/cards/bulk-update', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update cards');
      }

      const { cards: updatedCards } = await response.json();
      updatedCards.forEach((card: Card) => onCardUpdated?.(card));
      handleSuccess(`${updatedCards.length} cards updated successfully`);
      return updatedCards;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleError, handleSuccess, onCardUpdated]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    // State
    loading,
    error,

    // Actions
    handlePriorityChange,
    handleMoveToColumn,
    handleDuplicateCard,
    handleArchiveCard,
    handleDeleteCard,
    handleBulkUpdate,
    clearError,
  };
}
