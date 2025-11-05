"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
// import { Badge } from '@/components/ui/badge'; // Removed for now since labels aren't implemented
import { Avatar } from "@/components/ui/avatar";
import { Calendar } from "lucide-react";
import { format } from "date-fns";
import type {
  Card as CardType,
  Column,
  BoardMemberRole,
  CardPriority,
  User,
  Label,
} from "@/types/database";
import { getUserAvatarColor, getUserInitials } from "../../lib/role-colors";
import { getPriorityBorderColor } from "@/lib/priority-colors";
import { CompactMarkdownViewer } from "@/components/ui/markdown-viewer";
import { PriorityBadge } from "@/components/ui/priority-selector";
import { AutoCardContextMenu } from "./CardContextMenu";
import { useCardActionsWithStore } from "@/hooks/useCardActionsWithStore";

interface KanbanCardProps {
  card: CardType;
  boardMembers?: User[];
  boardLabels?: Label[];
  allColumns?: Column[];
  currentUser: { id: string; name?: string | null; email?: string } | null;
  userRole?: BoardMemberRole;
  onClick?: () => void;
  onEdit?: (card: CardType) => void;
  onCardUpdated?: (card: CardType) => void;
  onCardDeleted?: (cardId: string) => void;
  onCardCreated?: (card: CardType) => void;
}

export function KanbanCard({
  card,
  boardMembers = [],
  boardLabels: _boardLabels = [], // Unused for now
  allColumns = [],
  currentUser: _currentUser, // Unused for now
  userRole = "member",
  onClick,
  onEdit,
  onCardUpdated,
  onCardDeleted: _onCardDeleted,
  onCardCreated: _onCardCreated,
}: KanbanCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({
    id: card.id,
  });

  // Card actions hook with Zustand store integration
  const {
    handlePriorityChange,
    handleMoveToColumn,
    handleDuplicateCard,
    handleArchiveCard,
    handleDeleteCard,
  } = useCardActionsWithStore({
    onSuccess: (message: string) => {
      // You can add toast notifications here
      console.log(message);
    },
    onError: (error: string) => {
      // You can add error notifications here
      console.error(error);
    },
  });

  // Get priority configuration
  const priority = (card.priority || "medium") as CardPriority;
  const priorityBorderColor = getPriorityBorderColor(priority);

  // Handle context menu actions
  const handleEdit = () => {
    onEdit?.(card);
  };

  const handleDelete = () => {
    handleDeleteCard(card);
  };

  const handleDuplicate = () => {
    handleDuplicateCard(card);
  };

  const handleArchive = () => {
    handleArchiveCard(card);
  };

  const handlePriorityChangeAction = async (
    cardParam: CardType,
    newPriority: CardPriority,
  ) => {
    try {
      const updated = await handlePriorityChange(cardParam, newPriority);
      if (updated) {
        onCardUpdated?.(updated as CardType);
      }
    } catch (_e) {
      // errors are handled in the hook; no-op here
    }
  };

  const handleMoveToColumnAction = (cardParam: CardType, columnId: number) => {
    handleMoveToColumn(cardParam, columnId);
  };

  // Determine if currently dragging
  const isCurrentlyDragging = sortableIsDragging;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: priorityBorderColor,
    borderLeftWidth: "3px",
    borderLeftStyle: "solid" as const,
  };

  const handleCardClick = () => {
    // Prevent click when dragging
    if (isCurrentlyDragging) return;

    // Call the onClick handler if provided
    onClick?.();
  };

  const handleCardDoubleClick = () => {
    // Prevent double-click when dragging
    if (isCurrentlyDragging) return;

    // Call the onEdit handler if provided
    onEdit?.(card);
  };

  const isOverdue = card.dueDate && new Date(card.dueDate) < new Date();
  const isDueSoon =
    card.dueDate &&
    new Date(card.dueDate) > new Date() &&
    new Date(card.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000); // Due within 24 hours

  // Find assignee from board members
  const assignee = boardMembers.find((member) => member.id === card.assigneeId);

  return (
    <AutoCardContextMenu
      card={card}
      columns={allColumns}
      userRole={userRole}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onDuplicate={handleDuplicate}
      onArchive={handleArchive}
      onPriorityChange={handlePriorityChangeAction}
      onMoveToColumn={handleMoveToColumnAction}
      disabled={isCurrentlyDragging}
    >
      <Card
        ref={setNodeRef}
        style={style}
        {...attributes}
        {...listeners}
        className={`p-3 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow border-l-4 ${
          isCurrentlyDragging
            ? "opacity-50 rotate-3 shadow-lg cursor-grabbing"
            : ""
        }`}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
      >
        {/* Card Header with Title and Priority */}
        <div className="flex items-start justify-between mb-2">
          <h4 className="font-medium text-gray-900 line-clamp-2 flex-1 mr-2">
            {card.title}
          </h4>
          <PriorityBadge priority={priority} size="sm" />
        </div>

        {/* Card Description (if exists) */}
        {card.description && (
          <div className="mb-3">
            <CompactMarkdownViewer
              content={card.description}
              maxLines={2}
              className="text-sm"
            />
          </div>
        )}

        {/* Labels - Note: Labels would need to be fetched separately or passed as props */}
        {/* For now, we'll skip labels since they're not in the basic Card type */}

        {/* Due Date */}
        {card.dueDate && (
          <div
            className={`flex items-center space-x-1 mb-2 text-xs ${
              isOverdue
                ? "text-red-600"
                : isDueSoon
                  ? "text-orange-600"
                  : "text-gray-500"
            }`}
          >
            <Calendar className="w-3 h-3" />
            <span>
              {format(new Date(card.dueDate), "MMM d")}
              {isOverdue && " (Overdue)"}
              {isDueSoon && " (Due Soon)"}
            </span>
          </div>
        )}

        {/* Card Footer */}
        <div className="flex items-center justify-between">
          {/* Card Stats */}
          <div className="flex items-center space-x-3 text-gray-500">
            {/* Due date */}
            {card.dueDate && (
              <div
                className={`flex items-center space-x-1 text-xs ${
                  isOverdue
                    ? "text-red-600"
                    : isDueSoon
                      ? "text-orange-600"
                      : ""
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(card.dueDate), "MMM d")}</span>
              </div>
            )}

            {/* Attachments count (placeholder for future feature) */}
            {/* <div className="flex items-center space-x-1 text-xs">
            <Paperclip className="w-3 h-3" />
            <span>2</span>
          </div> */}
          </div>

          {/* Assignee Avatar */}
          {assignee && (
            <Avatar className="w-6 h-6">
              <div
                className={`w-full h-full ${getUserAvatarColor()} flex items-center justify-center text-white text-xs font-medium`}
              >
                {getUserInitials(assignee.name || "", assignee.email || "")}
              </div>
            </Avatar>
          )}
        </div>
      </Card>
    </AutoCardContextMenu>
  );
}
