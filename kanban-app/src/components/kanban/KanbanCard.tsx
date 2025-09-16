'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { Calendar, MessageSquare, Paperclip } from 'lucide-react';
import { format } from 'date-fns';
import type { Card as CardType } from '@/types/database';
import { getUserAvatarColor, getUserInitials } from '../../lib/role-colors';

interface KanbanCardProps {
  card: CardType;
  onClick?: () => void;
}

export function KanbanCard({ card, onClick }: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: card.id,
  });







  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent click when dragging
    if (isDragging) return;

    // Call the onClick handler if provided
    onClick?.();
  };

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
  const isDueSoon = card.dueDate && 
    new Date(card.dueDate) > new Date() && 
    new Date(card.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000); // Due within 24 hours

  return (
    <Card
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow ${
        isDragging ? 'opacity-50 rotate-3 shadow-lg cursor-grabbing' : ''
      }`}
      onClick={handleCardClick}
    >
      {/* Card Title */}
      <h4 className="font-medium text-gray-900 mb-2 line-clamp-2">
        {card.title}
      </h4>

      {/* Card Description (if exists) */}
      {card.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
          {card.description}
        </p>
      )}

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {card.labels.slice(0, 3).map((label) => (
            <Badge
              key={label.id}
              variant="secondary"
              className="text-xs"
              style={{ backgroundColor: label.color + '20', color: label.color }}
            >
              {label.name}
            </Badge>
          ))}
          {card.labels.length > 3 && (
            <Badge variant="secondary" className="text-xs">
              +{card.labels.length - 3}
            </Badge>
          )}
        </div>
      )}

      {/* Due Date */}
      {card.dueDate && (
        <div className={`flex items-center space-x-1 mb-2 text-xs ${
          isOverdue ? 'text-red-600' : isDueSoon ? 'text-orange-600' : 'text-gray-500'
        }`}>
          <Calendar className="w-3 h-3" />
          <span>
            {format(new Date(card.dueDate), 'MMM d')}
            {isOverdue && ' (Overdue)'}
            {isDueSoon && ' (Due Soon)'}
          </span>
        </div>
      )}

      {/* Card Footer */}
      <div className="flex items-center justify-between">
        {/* Card Stats */}
        <div className="flex items-center space-x-3 text-gray-500">
          {/* Comments count (if we have comments) */}
          {card.comments && card.comments.length > 0 && (
            <div className="flex items-center space-x-1 text-xs">
              <MessageSquare className="w-3 h-3" />
              <span>{card.comments.length}</span>
            </div>
          )}
          
          {/* Attachments count (placeholder for future feature) */}
          {/* <div className="flex items-center space-x-1 text-xs">
            <Paperclip className="w-3 h-3" />
            <span>2</span>
          </div> */}
        </div>

        {/* Assignee Avatar */}
        {card.assignee && (
          <Avatar className="w-6 h-6">
            <div className={`w-full h-full ${getUserAvatarColor()} flex items-center justify-center text-white text-xs font-medium`}>
              {getUserInitials(card.assignee.name, card.assignee.email)}
            </div>
          </Avatar>
        )}
      </div>
    </Card>
  );
}
