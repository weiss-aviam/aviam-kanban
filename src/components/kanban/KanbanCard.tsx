"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
// import { Badge } from '@/components/ui/badge'; // Removed for now since labels aren't implemented
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Calendar,
  GripVertical,
  Pencil,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type {
  Card as CardType,
  Column,
  BoardMemberRole,
  CardPriority,
  User,
  Label,
} from "@/types/database";
import { getUserAvatarColor, getUserInitials } from "../../lib/role-colors";
import { getPriorityConfig } from "@/lib/priority-colors";
import { formatDueDate, isOverdue, isDueSoon } from "@/lib/board-permissions";
import { CompactMarkdownViewer } from "@/components/ui/markdown-viewer";
import { PriorityBadge } from "@/components/ui/priority-selector";
import { AutoCardContextMenu } from "./CardContextMenu";
import { useCardActionsWithStore } from "@/hooks/useCardActionsWithStore";
import { useState } from "react";
import type { BoardPresenceMember } from "@/hooks/useBoardPresence";

type KanbanCardData = CardType & {
  assignee?: User | null;
};

interface KanbanCardProps {
  card: KanbanCardData;
  boardMembers?: User[];
  boardLabels?: Label[];
  allColumns?: Column[];
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
  editingMembers?: BoardPresenceMember[];
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
  currentUser,
  editingMembers = [],
  userRole = "member",
  onClick,
  onEdit,
  onCardUpdated,
  onCardDeleted: _onCardDeleted,
  onCardCreated: _onCardCreated,
}: KanbanCardProps) {
  const isViewer = userRole === "viewer";

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: sortableIsDragging,
  } = useSortable({
    id: card.id,
    disabled: isViewer,
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
  const priorityConfig = getPriorityConfig(priority);

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

  // Local completion state for instant visual feedback
  const [localCompletedAt, setLocalCompletedAt] = useState<
    Date | string | null | undefined
  >(card.completedAt);
  const isCompleted = Boolean(localCompletedAt);

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isViewer) return;
    const newCompletedAt = isCompleted ? null : new Date().toISOString();
    setLocalCompletedAt(newCompletedAt); // optimistic
    try {
      const res = await fetch(`/api/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completedAt: newCompletedAt }),
      });
      if (res.ok) {
        const json = (await res.json()) as {
          card: CardType & { completedAt?: string | null };
        };
        onCardUpdated?.(json.card as CardType);
      } else {
        setLocalCompletedAt(card.completedAt); // revert
      }
    } catch {
      setLocalCompletedAt(card.completedAt); // revert
    }
  };

  // Determine if currently dragging
  const isCurrentlyDragging = sortableIsDragging;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderColor: isCompleted ? "#86efac" : priorityConfig.borderColor,
    backgroundColor: isCompleted ? "#f0fdf4" : priorityConfig.bgColor,
  };

  const handleCardClick = () => {
    // Prevent click when dragging
    if (isCurrentlyDragging) return;

    // Call the onClick handler if provided
    onClick?.();
  };

  const handleCardDoubleClick = () => {
    // Prevent double-click when dragging or viewing as read-only
    if (isCurrentlyDragging || isViewer) return;

    // Call the onEdit handler if provided
    onEdit?.(card);
  };

  const cardIsOverdue = isOverdue(card.dueDate, card.completedAt);
  const cardIsDueSoon = isDueSoon(card.dueDate, card.completedAt);
  const formattedDueDate = formatDueDate(card.dueDate);

  // Prefer assignee data from the board payload, then fall back to board members.
  const assignee =
    card.assignee ??
    boardMembers.find((member) => member.id === card.assigneeId) ??
    null;

  // Presence: exclude the current user (they know they're editing)
  const otherEditors = editingMembers.filter(
    (m) => m.userId !== currentUser?.id,
  );
  const isAssigneeEditing = assignee
    ? otherEditors.some((m) => m.userId === assignee.id)
    : false;
  const nonAssigneeEditors = otherEditors.filter(
    (m) => m.userId !== assignee?.id,
  );

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
        className={`cursor-default border shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md flex flex-col gap-2 p-3 ${isCurrentlyDragging ? "opacity-50 rotate-3 shadow-lg" : ""}`}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
      >
        {/* Header: drag handle ↔ complete toggle ↔ priority */}
        <div className="flex items-center justify-between gap-2">
          {!isViewer ? (
            <div
              {...listeners}
              className="-ml-0.5 cursor-grab p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4" />
            </div>
          ) : (
            <div />
          )}
          <div className="flex items-center gap-1.5 ml-auto">
            {!isViewer && (
              <button
                onClick={handleToggleComplete}
                title={t(
                  isCompleted ? "card.markIncomplete" : "card.markComplete",
                )}
                className={`shrink-0 transition-colors ${isCompleted ? "text-green-500 hover:text-gray-400" : "text-gray-300 hover:text-green-500"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>
            )}
            <PriorityBadge priority={priority} size="md" />
          </div>
        </div>

        {/* Content: title + description + due date */}
        <div className="flex flex-col gap-1.5">
          <h4
            className={`line-clamp-2 text-sm font-semibold leading-snug ${isCompleted ? "line-through text-gray-400" : "text-gray-900"}`}
          >
            {card.title}
          </h4>

          {card.description && (
            <CompactMarkdownViewer
              content={card.description}
              maxLines={2}
              className="text-xs text-gray-500"
            />
          )}

          {isCompleted ? (
            <div className="mt-0.5 inline-flex w-fit items-center gap-1 rounded-md border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
              <CheckCircle2 className="h-3 w-3 shrink-0" />
              <span>{t("card.completed")}</span>
            </div>
          ) : card.dueDate ? (
            <div
              className={`mt-0.5 inline-flex w-fit items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                cardIsOverdue
                  ? "border-red-200 bg-red-50 text-red-700"
                  : cardIsDueSoon
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-gray-200 bg-white/80 text-gray-500"
              }`}
            >
              <Calendar className="h-3 w-3 shrink-0" />
              <span>
                {formattedDueDate}
                {cardIsOverdue && ` · ${t("card.overdue")}`}
                {cardIsDueSoon && ` · ${t("card.dueSoon")}`}
              </span>
            </div>
          ) : null}
        </div>

        {/* Footer: presence editors (left) + assignee (right) */}
        {(assignee || nonAssigneeEditors.length > 0) && (
          <div className="flex items-center gap-2 pt-0.5">
            {/* Left: editors who are not the assignee */}
            {nonAssigneeEditors.length > 0 &&
              (() => {
                const editor = nonAssigneeEditors[0]!;
                return (
                  <div className="flex items-center gap-1 min-w-0">
                    <Pencil className="h-3 w-3 shrink-0 text-amber-500" />
                    <Avatar className="h-5 w-5 shrink-0 border border-amber-300">
                      <AvatarFallback className="bg-amber-500 text-[9px] font-semibold text-white">
                        {getUserInitials(editor.name || "", editor.email || "")}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-xs text-amber-700 font-medium max-w-[72px]">
                      {editor.name || editor.email}
                      {nonAssigneeEditors.length > 1 &&
                        ` +${nonAssigneeEditors.length - 1}`}
                    </span>
                  </div>
                );
              })()}

            {/* Right: assignee avatar + name */}
            {assignee && (
              <div className="flex items-center gap-2 ml-auto min-w-0">
                <Avatar
                  className={`h-7 w-7 shrink-0 ${isAssigneeEditing ? "presence-editing-ring border-2" : "border border-gray-200"}`}
                >
                  <AvatarImage
                    src={assignee.avatarUrl ?? ""}
                    alt={assignee.name || assignee.email || ""}
                  />
                  <AvatarFallback
                    className={`${getUserAvatarColor()} text-[10px] font-semibold text-white`}
                  >
                    {getUserInitials(assignee.name || "", assignee.email || "")}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate text-xs text-gray-600 font-medium">
                  {assignee.name || assignee.email}
                </span>
              </div>
            )}
          </div>
        )}
      </Card>
    </AutoCardContextMenu>
  );
}
