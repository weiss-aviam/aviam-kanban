import type { Card, Column } from '@/types/database';

/**
 * Utility functions for drag and drop operations
 */

export interface DragEndResult {
  cardId: number;
  sourceColumnId: number;
  targetColumnId: number;
  newPosition: number;
  updates: Array<{ id: number; columnId: number; position: number }>;
}

/**
 * Calculate the new position and required updates when a card is moved
 */
export function calculateCardMove(
  cardId: number,
  targetColumnId: number,
  targetPosition: number,
  columns: Column[]
): DragEndResult | null {
  // Find the card being moved
  let sourceCard: Card | null = null;
  let sourceColumnId: number | null = null;

  for (const column of columns) {
    const card = column.cards.find(c => c.id === cardId);
    if (card) {
      sourceCard = card;
      sourceColumnId = column.id;
      break;
    }
  }

  if (!sourceCard || sourceColumnId === null) {
    return null;
  }

  const targetColumn = columns.find(col => col.id === targetColumnId);
  if (!targetColumn) {
    return null;
  }

  // Calculate all the position updates needed
  const updates: Array<{ id: number; columnId: number; position: number }> = [];

  if (sourceColumnId === targetColumnId) {
    // Moving within the same column
    const columnCards = targetColumn.cards
      .filter(card => card.id !== cardId)
      .sort((a, b) => a.position - b.position);

    // Insert the moved card at the target position
    columnCards.splice(targetPosition - 1, 0, sourceCard);

    // Update positions for all cards in the column
    columnCards.forEach((card, index) => {
      const newPosition = index + 1;
      if (card.position !== newPosition) {
        updates.push({
          id: card.id,
          columnId: targetColumnId,
          position: newPosition,
        });
      }
    });
  } else {
    // Moving between different columns
    const sourceColumn = columns.find(col => col.id === sourceColumnId);
    if (!sourceColumn) return null;

    // Update positions in source column (remove the card)
    const sourceCards = sourceColumn.cards
      .filter(card => card.id !== cardId)
      .sort((a, b) => a.position - b.position);

    sourceCards.forEach((card, index) => {
      const newPosition = index + 1;
      if (card.position !== newPosition) {
        updates.push({
          id: card.id,
          columnId: sourceColumnId,
          position: newPosition,
        });
      }
    });

    // Update positions in target column (add the card)
    const targetCards = targetColumn.cards
      .sort((a, b) => a.position - b.position);

    // Insert the moved card at the target position
    const cardWithNewColumn = { ...sourceCard, columnId: targetColumnId };
    targetCards.splice(targetPosition - 1, 0, cardWithNewColumn);

    // Update positions for all cards in the target column
    targetCards.forEach((card, index) => {
      const newPosition = index + 1;
      updates.push({
        id: card.id,
        columnId: targetColumnId,
        position: newPosition,
      });
    });
  }

  return {
    cardId,
    sourceColumnId,
    targetColumnId,
    newPosition: targetPosition,
    updates,
  };
}

/**
 * Apply drag and drop updates optimistically to the local state
 */
export function applyDragUpdatesOptimistically(
  columns: Column[],
  updates: Array<{ id: number; columnId: number; position: number }>
): Column[] {
  const newColumns = columns.map(column => ({ ...column, cards: [...column.cards] }));

  // Apply all updates
  for (const update of updates) {
    // Find the card and update it
    for (const column of newColumns) {
      const cardIndex = column.cards.findIndex(card => card.id === update.id);
      if (cardIndex !== -1) {
        const card = column.cards[cardIndex];
        
        // If the card is moving to a different column
        if (card.columnId !== update.columnId) {
          // Remove from current column
          column.cards.splice(cardIndex, 1);
          
          // Add to target column
          const targetColumn = newColumns.find(col => col.id === update.columnId);
          if (targetColumn) {
            targetColumn.cards.push({
              ...card,
              columnId: update.columnId,
              position: update.position,
            });
          }
        } else {
          // Update position in the same column
          card.position = update.position;
        }
        break;
      }
    }
  }

  // Sort cards by position in each column
  newColumns.forEach(column => {
    column.cards.sort((a, b) => a.position - b.position);
  });

  return newColumns;
}

/**
 * Find the drop target information from a drag event
 */
export function getDropTarget(
  overId: string | number,
  columns: Column[]
): { columnId: number; position: number } | null {
  if (typeof overId === 'string' && overId.startsWith('column-')) {
    // Dropping over a column (append to end)
    const columnId = parseInt(overId.replace('column-', ''));
    const column = columns.find(col => col.id === columnId);
    return {
      columnId,
      position: column ? column.cards.length + 1 : 1,
    };
  } else if (typeof overId === 'number') {
    // Dropping over a card
    for (const column of columns) {
      const cardIndex = column.cards.findIndex(card => card.id === overId);
      if (cardIndex !== -1) {
        return {
          columnId: column.id,
          position: cardIndex + 1,
        };
      }
    }
  }

  return null;
}

/**
 * Validate that a drag operation is allowed
 */
export function validateDragOperation(
  cardId: number,
  targetColumnId: number,
  columns: Column[]
): boolean {
  // Find the card
  const sourceCard = columns
    .flatMap(col => col.cards)
    .find(card => card.id === cardId);

  if (!sourceCard) return false;

  // Find the target column
  const targetColumn = columns.find(col => col.id === targetColumnId);
  if (!targetColumn) return false;

  // Add any business logic validation here
  // For example, you might want to prevent moving cards to certain columns
  // based on user permissions or card state

  return true;
}
