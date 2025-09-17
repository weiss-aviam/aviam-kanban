'use client';

import { useCallback } from 'react';
import { useAppActions } from '@/store';
import type { Card, CardPriority } from '@/types/database';

interface UseCardActionsWithStoreOptions {
  onSuccess?: (message: string) => void;
  onError?: (error: string) => void;
}

export function useCardActionsWithStore({
  onSuccess,
  onError,
}: UseCardActionsWithStoreOptions = {}) {
  const {
    updateCard,
    deleteCard,
    addCard,
    setError,
    clearError
  } = useAppActions();

  const handleError = useCallback((err: unknown) => {
    const message = err instanceof Error ? err.message : 'An error occurred';
    setError(message);
    onError?.(message);
  }, [onError, setError]);

  const handleSuccess = useCallback((message: string) => {
    clearError();
    onSuccess?.(message);
  }, [onSuccess, clearError]);

  /**
   * Update card priority with optimistic updates
   */
  const handlePriorityChange = useCallback(async (card: Card, priority: CardPriority) => {
    // Use local UI feedback instead of global page loading
    clearError();

    // Optimistic update - convert to store format
    const optimisticCard = {
      ...card,
      priority,
      labels: [],
      comments: []
    };
    updateCard(optimisticCard as any);

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
      console.log('Priority change - Updated card from API:', updatedCard);
      
      // Update with actual server response - convert to store format
      const storeCard = {
        ...updatedCard,
        labels: [],
        comments: []
      };
      updateCard(storeCard as any);
      handleSuccess(`Priority updated to ${priority}`);
      return updatedCard;
    } catch (err) {
      // Revert optimistic update on error - convert to store format
      const revertCard = {
        ...card,
        labels: [],
        comments: []
      };
      updateCard(revertCard as any);
      handleError(err);
      throw err;
    } finally {
      // no global loading toggle
    }
  }, [handleError, handleSuccess, updateCard, clearError]);

  /**
   * Move card to different column with optimistic updates
   */
  const handleMoveToColumn = useCallback(async (card: Card, columnId: number) => {
    // Use local UI feedback instead of global page loading
    clearError();

    // Optimistic update - convert to store format
    const optimisticCard = {
      ...card,
      columnId,
      position: 9999,
      labels: [],
      comments: []
    };
    updateCard(optimisticCard as any);

    try {
      const newPosition = 9999; // High number to place at end

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
      console.log('Move to column - Updated card from API:', updatedCard);
      
      // Update with actual server response - convert to store format
      const storeCard = {
        ...updatedCard,
        labels: [],
        comments: []
      };
      updateCard(storeCard as any);
      handleSuccess('Card moved successfully');
      return updatedCard;
    } catch (err) {
      // Revert optimistic update on error - convert to store format
      const revertCard = {
        ...card,
        labels: [],
        comments: []
      };
      updateCard(revertCard as any);
      handleError(err);
      throw err;
    } finally {
      // no global loading toggle
    }
  }, [handleError, handleSuccess, updateCard, clearError]);

  /**
   * Duplicate card with optimistic updates
   */
  const handleDuplicateCard = useCallback(async (card: Card) => {
    // Use local UI feedback instead of global page loading
    clearError();

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
      console.log('Duplicate card - New card from API:', newCard);
      
      // Add the new card to the store - convert to store format
      const storeCard = {
        ...newCard,
        labels: [],
        comments: []
      };
      addCard(storeCard as any);
      handleSuccess('Card duplicated successfully');
      return newCard;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      // no global loading toggle
    }
  }, [handleError, handleSuccess, addCard, clearError]);

  /**
   * Archive card (placeholder - implement based on your archive logic)
   */
  const handleDeleteCard = useCallback(async (card: Card, skipConfirmation = false) => {
    if (!skipConfirmation) {
      const confirmed = window.confirm(
        `Are you sure you want to delete "${card.title}"? This action cannot be undone.`
      );
      if (!confirmed) return;
    }

    // Use local UI feedback instead of global page loading
    clearError();

    // Optimistic update - remove card immediately
    deleteCard(card.id);

    try {
      const response = await fetch(`/api/cards/${card.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete card');
      }

      handleSuccess('Card deleted successfully');
    } catch (err) {
      // Revert optimistic update on error - add card back with store format
      const storeCard = {
        ...card,
        labels: [],
        comments: []
      };
      addCard(storeCard as any);
      handleError(err);
      throw err;
    } finally {
      // no global loading toggle
    }
  }, [handleError, handleSuccess, deleteCard, addCard, clearError]);

  /**
   * Delete card with confirmation and optimistic updates
   */
  const handleArchiveCard = useCallback(async (card: Card) => {
    // Use local UI feedback instead of global page loading
    clearError();

    try {
      // For now, we'll just delete the card
      // You can implement proper archiving logic here
      await handleDeleteCard(card, true);
      handleSuccess('Card archived successfully');
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      // no global loading toggle
    }
  }, [handleDeleteCard, handleError, handleSuccess, clearError]);

  /**
   * Bulk update multiple cards
   */
  const handleBulkUpdate = useCallback(async (updates: { id: string; [key: string]: any }[]) => {
    // Use local UI feedback instead of global page loading
    clearError();

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
      
      // Update all cards in the store - convert to store format
      updatedCards.forEach((card: Card) => {
        const storeCard = {
          ...card,
          labels: [],
          comments: []
        };
        updateCard(storeCard as any);
      });
      
      handleSuccess(`${updatedCards.length} cards updated successfully`);
      return updatedCards;
    } catch (err) {
      handleError(err);
      throw err;
    } finally {
      // no global loading toggle
    }
  }, [handleError, handleSuccess, updateCard, clearError]);

  return {
    // Actions
    handlePriorityChange,
    handleMoveToColumn,
    handleDuplicateCard,
    handleArchiveCard,
    handleDeleteCard,
    handleBulkUpdate,
  };
}
