import type { Card, Column } from '@/types/database';

type ColumnWithCards = Column & { cards: Card[] };

/**
 * Utility functions for drag and drop operations
 */

export interface DragEndResult {
  cardId: string;
  sourceColumnId: number;
  targetColumnId: number;
  newPosition: number;
  updates: Array<{ id: string; columnId: number; position: number }>;
}

/**
 * Calculate the new position and required updates when a card is moved
 */
export function calculateCardMove(
  cardId: string,
  targetColumnId: number,
  targetPosition: number,
  columns: ColumnWithCards[]
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
  const updates: Array<{ id: string; columnId: number; position: number }> = [];

  if (sourceColumnId === targetColumnId) {
    // Moving within the same column
    const columnCards = targetColumn.cards
      .sort((a, b) => a.position - b.position);

    // Remove the card being moved
    const filteredCards = columnCards.filter(card => card.id !== cardId);

    // Find the correct insertion index
    let insertIndex = targetPosition - 1;
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > filteredCards.length) insertIndex = filteredCards.length;

    // Insert the moved card at the target position
    filteredCards.splice(insertIndex, 0, sourceCard);

    // Update positions for all cards in the column
    filteredCards.forEach((card, index) => {
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

    // Find the correct insertion index
    let insertIndex = targetPosition - 1;
    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > targetCards.length) insertIndex = targetCards.length;

    // Insert the moved card at the target position
    const cardWithNewColumn = { ...sourceCard, columnId: targetColumnId };
    targetCards.splice(insertIndex, 0, cardWithNewColumn);

    // Update positions for all cards in the target column
    targetCards.forEach((card, index) => {
      const newPosition = index + 1;
      // Only add to updates if position actually changed or it's the moved card
      if (card.id === cardId || card.position !== newPosition) {
        updates.push({
          id: card.id,
          columnId: targetColumnId,
          position: newPosition,
        });
      }
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
  columns: ColumnWithCards[],
  updates: Array<{ id: string; columnId: number; position: number }>
): ColumnWithCards[] {
  // Create a deep copy of columns
  const newColumns = columns.map(column => ({
    ...column,
    cards: [...column.cards]
  }));

  // Apply each update
  for (const update of updates) {
    // Find the card in its current column
    let sourceColumn: any = null;
    let cardIndex = -1;
    let card: any = null;

    for (const column of newColumns) {
      cardIndex = column.cards.findIndex(c => c.id === update.id);
      if (cardIndex !== -1) {
        sourceColumn = column;
        card = column.cards[cardIndex];
        break;
      }
    }

    if (!card || !sourceColumn) continue;

    // Remove card from source column
    sourceColumn.cards.splice(cardIndex, 1);

    // Find target column and add card with updated position
    const targetColumn = newColumns.find(col => col.id === update.columnId);
    if (targetColumn) {
      const updatedCard = {
        ...card,
        columnId: update.columnId,
        position: update.position,
      };
      targetColumn.cards.push(updatedCard);
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
  columns: ColumnWithCards[]
): { columnId: number; position: number } | null {
  if (typeof overId === 'string' && (overId.startsWith('column-') || overId.startsWith('column-drop-'))) {
    // Dropping over a column (append to end)
    const columnId = parseInt(overId.replace('column-', '').replace('column-drop-', ''));
    const column = columns.find(col => col.id === columnId);
    return {
      columnId,
      position: column ? column.cards.length + 1 : 1,
    };
  } else if (typeof overId === 'string') {
    // Dropping over a card - insert at the card's position (before the card)
    for (const column of columns) {
      const card = column.cards.find(c => c.id === overId);
      if (card) {
        return {
          columnId: column.id,
          position: card.position,
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
  cardId: string,
  targetColumnId: number,
  columns: ColumnWithCards[]
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

/**
 * Calculate column reordering updates
 */
export function calculateColumnMove(
  columnId: number,
  newPosition: number,
  columns: Column[]
): Array<{ id: number; position: number }> {
  const updates: Array<{ id: number; position: number }> = [];

  // Find the column being moved
  const movingColumn = columns.find(col => col.id === columnId);
  if (!movingColumn) return updates;

  const oldPosition = movingColumn.position;

  // If position hasn't changed, no updates needed
  if (oldPosition === newPosition) return updates;

  // Sort columns by position
  const sortedColumns = [...columns].sort((a, b) => a.position - b.position);

  // Remove the moving column from its current position
  const filteredColumns = sortedColumns.filter(col => col.id !== columnId);

  // Insert the moving column at the new position
  filteredColumns.splice(newPosition - 1, 0, movingColumn);

  // Update positions for all affected columns
  filteredColumns.forEach((column, index) => {
    const newPos = index + 1;
    if (column.position !== newPos) {
      updates.push({
        id: column.id,
        position: newPos,
      });
    }
  });

  return updates;
}

/**
 * API function to bulk update card positions
 */
export async function bulkUpdateCardPositions(
  updates: Array<{ id: string; columnId: number; position: number }>
): Promise<void> {
  const response = await fetch('/api/cards/bulk-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    throw new Error('Failed to update card positions');
  }
}

/**
 * API function to bulk update column positions
 */
export async function bulkUpdateColumnPositions(
  updates: Array<{ id: number; position: number }>
): Promise<void> {
  const response = await fetch('/api/columns/bulk-update', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ updates }),
  });

  if (!response.ok) {
    throw new Error('Failed to update column positions');
  }
}
