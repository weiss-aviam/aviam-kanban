'use client';

import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { KanbanCard } from './KanbanCard';
import { CreateCardDialog } from './CreateCardDialog';
import { EmptyColumn } from './EmptyStates';
import { Button } from '@/components/ui/button';
import { Plus, MoreHorizontal } from 'lucide-react';
import { Card } from '@/components/ui/card';
import type { Column, Card as CardType, User, Label } from '@/types/database';

interface KanbanColumnProps {
  column: Column;
  cards: CardType[];
  boardId: number;
  boardMembers: User[];
  boardLabels: Label[];
  allColumns: Column[];
  isLoading?: boolean;
  onCardCreated: (card: CardType) => void;
  onCardClick: (card: CardType) => void;
}

export function KanbanColumn({
  column,
  cards,
  boardId,
  boardMembers,
  boardLabels,
  allColumns,
  isLoading = false,
  onCardCreated,
  onCardClick,
}: KanbanColumnProps) {
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: `column-${column.id}`,
  });

  const handleAddCard = () => {
    setShowCreateDialog(true);
  };

  const handleColumnOptions = () => {
    // This would open a menu for column options (edit, delete, etc.)
    console.log('Column options for:', column.id);
  };

  return (
    <div className="flex flex-col w-80 flex-shrink-0">
      {/* Column Header */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-t-lg border border-b-0">
        <div className="flex items-center space-x-2">
          <h3 className="font-semibold text-gray-900">{column.title}</h3>
          <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
            {cards.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleColumnOptions}
          className="h-8 w-8 p-0"
        >
          <MoreHorizontal className="w-4 h-4" />
        </Button>
      </div>

      {/* Cards Container */}
      <Card
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] p-4 rounded-t-none border-t-0 transition-colors ${
          isOver ? 'bg-blue-50 border-blue-200' : 'bg-white'
        } ${isLoading ? 'opacity-50' : ''}`}
      >
        <SortableContext
          items={cards.map(card => card.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-3">
            {cards.length > 0 ? (
              <>
                {cards
                  .sort((a, b) => a.position - b.position)
                  .map((card) => (
                    <KanbanCard
                      key={card.id}
                      card={card}
                      onClick={() => onCardClick(card)}
                    />
                  ))}

                {/* Add Card Button */}
                <Button
                  variant="ghost"
                  onClick={handleAddCard}
                  className="w-full justify-start text-gray-500 hover:text-gray-700 border-dashed border-2 border-gray-200 hover:border-gray-300"
                  disabled={isLoading}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add a card
                </Button>
              </>
            ) : (
              /* Empty Column State */
              <EmptyColumn
                columnTitle={column.title}
                onCreateCard={handleAddCard}
              />
            )}
          </div>
        </SortableContext>
      </Card>

      {/* Create Card Dialog */}
      <CreateCardDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        columnId={column.id}
        boardId={boardId}
        columns={allColumns}
        boardMembers={boardMembers}
        boardLabels={boardLabels}
        onCardCreated={onCardCreated}
      />
    </div>
  );
}
