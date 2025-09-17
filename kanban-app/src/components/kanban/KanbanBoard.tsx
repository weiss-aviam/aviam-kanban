'use client';

import { useState } from 'react';
import { DndContext, DragEndEvent, DragStartEvent, PointerSensor, MouseSensor, TouchSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { EditCardDialog } from './EditCardDialog';
import { EmptyBoard } from './EmptyStates';
import { Button } from '../ui/button';


import { calculateColumnMove, bulkUpdateColumnPositions } from '../../lib/dnd-utils';
import type { BoardWithDetails, User, Card as CardType, BoardMemberRole } from '../../types/database';
import { BoardFilters } from './BoardFilters';
import { useBoardFilters } from '@/hooks/useBoardFilters';
import { useAppActions, useCurrentBoard } from '@/store';


interface KanbanBoardProps {
  boardData: BoardWithDetails;
  onBoardDataChange?: (data: BoardWithDetails) => void;
  currentUser: User | null;
  userRole?: BoardMemberRole;
}

export function KanbanBoard({ boardData, onBoardDataChange, currentUser, userRole = 'member' }: KanbanBoardProps) {
  const [activeCard, setActiveCard] = useState<CardType | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingCard, setEditingCard] = useState<CardType | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Zustand store actions
  const { addCard, updateCard, deleteCard } = useAppActions();


  // Get all cards for filtering
  const allCards = boardData.columns.flatMap(col => col.cards || []);

  // Board filters hook
  const {
    filters,
    setFilters,
    cardsByColumn,
    availableAssignees,
    stats,
    hasActiveFilters,
  } = useBoardFilters(allCards);

  // Drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(MouseSensor),
    useSensor(TouchSensor)
  );

  // Drag and drop handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    console.log('Drag start:', active.id, typeof active.id);

    // Check if it's a column being dragged
    if (typeof active.id === 'string' && active.id.startsWith('column-')) {
      console.log('Column drag detected');
      return;
    }

    // Find the card being dragged
    const card = boardData.columns
      .flatMap(col => col.cards)
      .find(card => card.id === active.id);

    if (card) {
      console.log('Found card:', card.title);
      setActiveCard(card);
    } else {
      console.log('No card found for ID:', active.id);
    }
  };

  const handleDragOver = () => {
    // Optional: Add visual feedback during drag over
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) {
      console.log('No drop target');
      return;
    }

    console.log('Drag end event:', {
      activeId: active.id,
      activeType: typeof active.id,
      overId: over.id,
      overType: typeof over.id
    });

    // Check if we're dragging a column
    if (typeof active.id === 'string' && active.id.startsWith('column-')) {
      console.log('Processing column drag');
      const columnId = parseInt(active.id.replace('column-', ''));
      const overColumnId = typeof over.id === 'string' && over.id.startsWith('column-')
        ? parseInt(over.id.replace('column-', ''))
        : null;

      if (!overColumnId || columnId === overColumnId) return;

      // Find the positions
      const activeColumn = boardData.columns.find(col => col.id === columnId);
      const overColumn = boardData.columns.find(col => col.id === overColumnId);

      if (!activeColumn || !overColumn) return;

      // Calculate column position updates
      const updates = calculateColumnMove(columnId, overColumn.position, boardData.columns);

      if (updates.length === 0) return;

      console.log('Column drag result:', {
        columnId,
        newPosition: overColumn.position,
        updates
      });

      // Apply optimistic updates for columns
      const updatedColumns = boardData.columns.map(column => {
        const update = updates.find(u => u.id === column.id);
        return update ? { ...column, position: update.position } : column;
      }).sort((a, b) => a.position - b.position);

      if (onBoardDataChange) {
        onBoardDataChange({ ...boardData, columns: updatedColumns as any });
      }

      // Send bulk update to server
      try {
        setIsLoading(true);
        await bulkUpdateColumnPositions(updates);
        console.log('Column positions updated successfully');
      } catch (error) {
        console.error('Failed to update column positions:', error);
        // Revert optimistic update on error
        if (onBoardDataChange) {
          onBoardDataChange(boardData);
        }
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // Handle card drag and drop
    const cardId = active.id as string;

    // Find the card
    const draggedCard = boardData.columns
      .flatMap(col => col.cards)
      .find(card => card.id === cardId);

    if (!draggedCard) {
      return;
    }



    // Determine target column and position
    let targetColumnId: number;
    let targetPosition: number;

    if (typeof over.id === 'string' && over.id.startsWith('column-drop-')) {
      // Dropped on empty column
      targetColumnId = parseInt(over.id.replace('column-drop-', ''));
      const targetColumn = boardData.columns.find(col => col.id === targetColumnId);
      const maxPosition = targetColumn?.cards.length ? Math.max(...targetColumn.cards.map(c => c.position)) : 0;
      targetPosition = maxPosition + 1; // Add to end

    } else {
      // Dropped on another card
      const targetCard = boardData.columns
        .flatMap(col => col.cards)
        .find(card => card.id === over.id);

      if (!targetCard) {
        console.log('Target card not found!');
        return;
      }

      targetColumnId = targetCard.columnId;
      // Insert before the target card
      targetPosition = targetCard.position;

    }

    // Don't do anything if dropped in same position
    if (draggedCard.columnId === targetColumnId && draggedCard.position === targetPosition) {
      return;
    }

    setIsLoading(true);
    try {
      const requestBody = {
        updates: [{
          id: cardId, // Use the UUID from the drag event
          columnId: targetColumnId,
          position: targetPosition
        }]
      };



      const response = await fetch('/api/cards/bulk-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${JSON.stringify(errorData)}`);
      }

      // Update local state - remove from all columns first, then add to target
      const newColumns = boardData.columns.map(col => {
        // Remove the card from all columns first
        const filteredCards = col.cards.filter(card => card.id !== cardId);

        if (col.id === targetColumnId) {
          // Add to target column
          const updatedCard = {
            ...draggedCard,
            columnId: targetColumnId,
            position: targetPosition
          };
          return {
            ...col,
            cards: [...filteredCards, updatedCard].sort((a, b) => a.position - b.position)
          };
        }

        // Return column without the moved card
        return {
          ...col,
          cards: filteredCards
        };
      });

      if (onBoardDataChange) {
        onBoardDataChange({ ...boardData, columns: newColumns });
      }

    } catch (error) {
      console.error('Failed to update card position:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Card handlers
  const handleCardCreated = (newCard: CardType) => {
    if (!newCard || !newCard.columnId) {
      console.error('Invalid card data:', newCard);
      return;
    }

    // Ensure the new card has all required properties
    const cardWithDefaults = {
      ...newCard,
      labels: [],
      comments: [],
      assignee: newCard.assigneeId ? boardData.members?.find(m => m.user.id === newCard.assigneeId)?.user : undefined,
    };

    // Use Zustand store action
    addCard(cardWithDefaults as any);

    // Also update the prop-based callback for backward compatibility
    if (onBoardDataChange) {
      const updatedColumns = boardData.columns.map(column => {
        if (column.id === newCard.columnId) {
          return {
            ...column,
            cards: [...column.cards, cardWithDefaults as any]
          };
        }
        return column;
      });

      onBoardDataChange({
        ...boardData,
        columns: updatedColumns as any
      });
    }
  };

  const handleCardClick = (card: CardType) => {
    setEditingCard(card);
    setShowEditDialog(true);
  };

  const handleCardUpdated = (updatedCard: CardType) => {
    console.log('KanbanBoard - handleCardUpdated called with:', updatedCard);

    // Convert card to store format and use Zustand store action first
    const storeCard = {
      ...updatedCard,
      labels: (updatedCard as any).labels || [],
      comments: (updatedCard as any).comments || [],
    };
    updateCard(storeCard as any);

    // Also update the prop-based callback for backward compatibility
    if (onBoardDataChange) {
      // Find the current column of the card
      const currentColumn = boardData.columns.find(col =>
        col.cards.some(card => card.id === updatedCard.id)
      );

      console.log('Current column:', currentColumn?.title, 'Updated card column ID:', updatedCard.columnId);

      // Check if the card moved to a different column
      const cardMovedColumns = currentColumn && currentColumn.id !== updatedCard.columnId;

      let updatedColumns;

      if (cardMovedColumns) {
        console.log('Card moved from column', currentColumn.id, 'to column', updatedCard.columnId);
        // Handle column change: remove from old column and add to new column
        updatedColumns = boardData.columns.map(column => {
          if (column.id === currentColumn.id) {
            // Remove from current column
            return {
              ...column,
              cards: column.cards.filter(card => card.id !== updatedCard.id)
            };
          } else if (column.id === updatedCard.columnId) {
            // Add to new column
            return {
              ...column,
              cards: [...column.cards, updatedCard]
            };
          }
          return column;
        });
      } else {
        console.log('Card updated in same column');
        // Handle in-place update (same column)
        updatedColumns = boardData.columns.map(column => ({
          ...column,
          cards: column.cards.map(card =>
            card.id === updatedCard.id ? updatedCard : card
          )
        }));
      }

      console.log('Updating board data with new columns');
      onBoardDataChange({
        ...boardData,
        columns: updatedColumns as any
      });
    }
  };

  const handleCardDeleted = (cardId: string) => {
    // Use Zustand store action first
    deleteCard(cardId);

    // Also update the prop-based callback for backward compatibility
    if (onBoardDataChange) {
      const updatedColumns = boardData.columns.map(column => ({
        ...column,
        cards: column.cards.filter(card => card.id !== cardId)
      }));

      onBoardDataChange({
        ...boardData,
        columns: updatedColumns
      });
    }
  };



  // Check if board has no columns
  const hasNoColumns = !boardData.columns || boardData.columns.length === 0;

  if (hasNoColumns) {
    return (
      <div className="flex-1">
        <EmptyBoard />
      </div>
    );
  }



  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Board Filters */}
      <div className="border-b bg-white px-6 py-4">
        <BoardFilters
          filters={filters}
          onFiltersChange={setFilters}
          availableAssignees={availableAssignees}
          className="mb-2"
        />
        {hasActiveFilters && (
          <div className="text-sm text-gray-600">
            Showing {stats.filtered} of {stats.total} cards
            {stats.hidden > 0 && ` (${stats.hidden} hidden)`}
          </div>
        )}
      </div>

      {/* Main Content */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 overflow-x-auto overflow-y-hidden">
          <div className="flex h-full gap-6 p-6 min-w-max">
            {/* Column Sorting Context */}
            <SortableContext
              items={boardData.columns.map(col => `column-${col.id}`)}
              strategy={horizontalListSortingStrategy}
            >
              {boardData.columns.map((column) => (
                <KanbanColumn
                  key={column.id}
                  column={column}
                  cards={cardsByColumn[column.id] || []}
                  boardId={boardData.id}
                  boardMembers={boardData.members?.map(m => m.user) || []}
                  boardLabels={boardData.labels}
                  allColumns={boardData.columns}
                  isLoading={isLoading}
                  onCardCreated={handleCardCreated}
                  onCardClick={handleCardClick}
                  onCardEdit={handleCardClick}
                  onCardUpdated={handleCardUpdated}
                  currentUser={currentUser}
                  userRole={userRole}
                />
              ))}
            </SortableContext>


          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard ? (
            <div className="rotate-3 opacity-90">
              <KanbanCard
                card={activeCard}
                boardMembers={boardData.members?.map(m => m.user) || []}
                boardLabels={boardData.labels}
                allColumns={boardData.columns}
                currentUser={currentUser || null}
                userRole={userRole}
              />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Edit Card Dialog */}
      <EditCardDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        card={editingCard}
        columns={boardData.columns}
        boardMembers={boardData.members?.map(m => m.user) || []}
        boardLabels={boardData.labels}
        currentUser={currentUser}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
      />


    </div>
  );
}
