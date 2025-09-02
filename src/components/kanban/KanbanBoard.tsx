'use client';

import { useState, useEffect } from 'react';
import { DndContext, DragEndEvent, DragOverEvent, DragStartEvent, PointerSensor, useSensor, useSensors, DragOverlay } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { KanbanCard } from './KanbanCard';
import { EditCardDialog } from './EditCardDialog';
import { CardDetailsModal } from './CardDetailsModal';
import { BoardFilters } from './BoardFilters';
import { EmptyBoard, EmptyFilterResults } from './EmptyStates';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { calculateCardMove, applyDragUpdatesOptimistically, getDropTarget, validateDragOperation } from '@/lib/dnd-utils';
import { filterCards } from '@/lib/filter-utils';
import { subscribeToBoardChanges, unsubscribeFromBoardChanges } from '@/lib/realtime';
import type { BoardWithDetails, Card, Column, CardFilters } from '@/types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface KanbanBoardProps {
  initialData: BoardWithDetails;
}

export function KanbanBoard({ initialData }: KanbanBoardProps) {
  const [boardData, setBoardData] = useState(initialData);
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [detailsCard, setDetailsCard] = useState<Card | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [filters, setFilters] = useState<CardFilters>({});
  const [realtimeChannel, setRealtimeChannel] = useState<RealtimeChannel | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Set up Realtime subscriptions
  useEffect(() => {
    const channel = subscribeToBoardChanges(boardData.id, {
      onCardChange: (payload) => {
        console.log('Card changed:', payload);
        // Refresh board data or update optimistically
        // For now, we'll just log the change
      },
      onColumnChange: (payload) => {
        console.log('Column changed:', payload);
        // Handle column changes
      },
      onCommentChange: (payload) => {
        console.log('Comment changed:', payload);
        // Handle comment changes
      },
      onLabelChange: (payload) => {
        console.log('Label changed:', payload);
        // Handle label changes
      },
      onCardLabelChange: (payload) => {
        console.log('Card label changed:', payload);
        // Handle card label changes
      },
      onBoardMemberChange: (payload) => {
        console.log('Board member changed:', payload);
        // Handle board member changes
      },
    });

    setRealtimeChannel(channel);

    return () => {
      if (channel) {
        unsubscribeFromBoardChanges(channel);
      }
    };
  }, [boardData.id]);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    
    // Find the card being dragged
    const card = findCardById(active.id as number);
    setActiveCard(card);
  };

  // Handle drag over (for visual feedback)
  const handleDragOver = (event: DragOverEvent) => {
    // This can be used for visual feedback during drag
  };

  // Handle drag end
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const cardId = active.id as number;
    const dropTarget = getDropTarget(over.id, boardData.columns);

    if (!dropTarget) return;

    const { columnId: targetColumnId, position: targetPosition } = dropTarget;

    // Validate the drag operation
    if (!validateDragOperation(cardId, targetColumnId, boardData.columns)) {
      console.warn('Invalid drag operation');
      return;
    }

    // Calculate the move and required updates
    const moveResult = calculateCardMove(cardId, targetColumnId, targetPosition, boardData.columns);

    if (!moveResult) return;

    // Apply updates optimistically
    const updatedColumns = applyDragUpdatesOptimistically(boardData.columns, moveResult.updates);
    setBoardData(prev => ({ ...prev, columns: updatedColumns }));

    // Send bulk update to server
    try {
      setIsLoading(true);
      await bulkUpdateCardPositions(moveResult.updates);
    } catch (error) {
      console.error('Failed to update card positions:', error);
      // Revert optimistic update
      setBoardData(initialData);
    } finally {
      setIsLoading(false);
    }
  };

  // Helper function to find a card by ID
  const findCardById = (cardId: number): Card | null => {
    for (const column of boardData.columns) {
      const card = column.cards.find(c => c.id === cardId);
      if (card) return card;
    }
    return null;
  };

  // API call to bulk update card positions
  const bulkUpdateCardPositions = async (updates: Array<{ id: number; columnId: number; position: number }>) => {
    const response = await fetch('/api/cards/bulk-reorder', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        updates,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to update card positions');
    }

    return response.json();
  };

  // Handle card creation
  const handleCardCreated = (newCard: Card) => {
    setBoardData(prev => {
      const newColumns = prev.columns.map(column => {
        if (column.id === newCard.columnId) {
          return {
            ...column,
            cards: [...column.cards, newCard].sort((a, b) => a.position - b.position),
          };
        }
        return column;
      });
      return { ...prev, columns: newColumns };
    });
  };

  // Handle card click (open details modal)
  const handleCardClick = (card: Card) => {
    setDetailsCard(card);
    setShowDetailsModal(true);
  };

  // Handle card update
  const handleCardUpdated = (updatedCard: Card) => {
    setBoardData(prev => {
      const newColumns = prev.columns.map(column => ({
        ...column,
        cards: column.cards.map(card =>
          card.id === updatedCard.id ? updatedCard : card
        ),
      }));
      return { ...prev, columns: newColumns };
    });
  };

  // Handle card deletion
  const handleCardDeleted = (cardId: number) => {
    setBoardData(prev => {
      const newColumns = prev.columns.map(column => ({
        ...column,
        cards: column.cards.filter(card => card.id !== cardId),
      }));
      return { ...prev, columns: newColumns };
    });
  };

  // Handle filter changes
  const handleFiltersChange = (newFilters: CardFilters) => {
    setFilters(newFilters);
  };

  // Apply filters to board data
  const getFilteredBoardData = () => {
    const filteredColumns = boardData.columns.map(column => ({
      ...column,
      cards: filterCards(column.cards, filters),
    }));

    return {
      ...boardData,
      columns: filteredColumns,
    };
  };

  // Add new column
  const handleAddColumn = async () => {
    // This would open a dialog to create a new column
    console.log('Add column clicked');
  };

  const filteredBoardData = getFilteredBoardData();

  // Check for empty states
  const hasNoColumns = boardData.columns.length === 0;
  const hasNoVisibleCards = filteredBoardData.columns.every(col => col.cards.length === 0);
  const hasActiveFilters = !!(filters.assigneeId ||
    (filters.labelIds && filters.labelIds.length > 0) ||
    filters.dueDate);
  const activeFilterCount = [
    filters.assigneeId,
    filters.labelIds && filters.labelIds.length > 0,
    filters.dueDate,
  ].filter(Boolean).length;

  return (
    <div className="h-full flex flex-col">
      {/* Filters Bar */}
      {!hasNoColumns && (
        <div className="border-b bg-white px-6 py-3">
          <BoardFilters
            boardMembers={boardData.members.map(m => m.user)}
            boardLabels={boardData.labels}
            filters={filters}
            onFiltersChange={handleFiltersChange}
          />
        </div>
      )}

      {/* Main Content */}
      {hasNoColumns ? (
        /* Empty Board State */
        <div className="flex-1">
          <EmptyBoard onCreateColumn={handleAddColumn} />
        </div>
      ) : hasNoVisibleCards && hasActiveFilters ? (
        /* Empty Filter Results State */
        <div className="flex-1">
          <EmptyFilterResults
            onClearFilters={() => setFilters({})}
            filterCount={activeFilterCount}
          />
        </div>
      ) : (
        /* Normal Board View */
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full gap-6 p-6 min-w-max">
              <SortableContext
                items={filteredBoardData.columns.map(col => `column-${col.id}`)}
                strategy={horizontalListSortingStrategy}
              >
                {filteredBoardData.columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    cards={column.cards}
                    boardId={boardData.id}
                    boardMembers={boardData.members.map(m => m.user)}
                    boardLabels={boardData.labels}
                    allColumns={boardData.columns}
                    isLoading={isLoading}
                    onCardCreated={handleCardCreated}
                    onCardClick={handleCardClick}
                  />
                ))}
              </SortableContext>

              {/* Add Column Button */}
              <div className="flex-shrink-0">
                <Button
                  variant="outline"
                  onClick={handleAddColumn}
                  className="h-12 px-4 border-dashed border-2 hover:border-solid"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Column
                </Button>
              </div>
            </div>
          </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeCard ? (
            <div className="rotate-3 opacity-90">
              <KanbanCard card={activeCard} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Card Details Modal */}
      <CardDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        card={detailsCard}
        onCardUpdated={handleCardUpdated}
      />

      {/* Edit Card Dialog */}
      <EditCardDialog
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        card={editingCard}
        columns={boardData.columns}
        boardMembers={boardData.members.map(m => m.user)}
        boardLabels={boardData.labels}
        onCardUpdated={handleCardUpdated}
        onCardDeleted={handleCardDeleted}
      />
    </div>
  );
}
