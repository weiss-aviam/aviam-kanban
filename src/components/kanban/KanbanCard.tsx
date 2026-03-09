"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import { Card } from "@/components/ui/card";
// import { Badge } from '@/components/ui/badge'; // Removed for now since labels aren't implemented
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Calendar, GripVertical } from "lucide-react";
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
import type { BoardPresenceMember } from "@/hooks/useBoardPresence";
import { CardEditorsIndicator } from "@/components/boards/board-presence-ui";

type KanbanCardData = CardType & {
  assignee?: User | null;
};

interface KanbanCardProps {
  card: KanbanCardData;
  boardMembers?: User[];
  boardLabels?: Label[];
  allColumns?: Column[];
  currentUser: { id: string; name?: string | null; email?: string } | null;
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

  // Determine if currently dragging
  const isCurrentlyDragging = sortableIsDragging;

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderColor: priorityConfig.borderColor,
    backgroundColor: priorityConfig.bgColor,
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

  const cardIsOverdue = isOverdue(card.dueDate);
  const cardIsDueSoon = isDueSoon(card.dueDate);
  const formattedDueDate = formatDueDate(card.dueDate);

  // Prefer assignee data from the board payload, then fall back to board members.
  const assignee =
    card.assignee ??
    boardMembers.find((member) => member.id === card.assigneeId) ??
    null;

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
        className={`cursor-default border p-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${isCurrentlyDragging ? "opacity-50 rotate-3 shadow-lg" : ""}`}
        onClick={handleCardClick}
        onDoubleClick={handleCardDoubleClick}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            {!isViewer && (
              <div
                {...listeners}
                className="mt-0.5 -ml-1 flex-shrink-0 cursor-grab p-0.5 text-gray-400 hover:text-gray-600 active:cursor-grabbing"
                onClick={(e) => e.stopPropagation()}
              >
                <GripVertical className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <PriorityBadge priority={priority} size="md" />
              </div>
              <h4 className="line-clamp-2 text-base font-semibold text-gray-900">
                {card.title}
              </h4>
            </div>
          </div>
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

        <CardEditorsIndicator
          currentUserId={currentUser?.id ?? null}
          members={editingMembers}
        />

        {/* Due Date */}
        {card.dueDate && (
          <div
            className={`mb-3 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium ${cardIsOverdue ? "border-red-200 bg-red-50 text-red-700" : cardIsDueSoon ? "border-amber-200 bg-amber-50 text-amber-700" : "border-gray-200 bg-white/80 text-gray-600"}`}
          >
            <Calendar className="w-3 h-3" />
            <span>
              {formattedDueDate}
              {cardIsOverdue && ` (${t("card.overdue")})`}
              {cardIsDueSoon && ` (${t("card.dueSoon")})`}
            </span>
          </div>
        )}

        {/* Card Footer */}
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs font-medium uppercase tracking-[0.12em] text-gray-500">
            {t("editCard.assigneeLabel")}
          </div>

          {assignee ? (
            <div className="ml-auto flex min-w-0 items-center gap-2 rounded-full border border-white/70 bg-white/90 px-2.5 py-1 shadow-sm">
              <Avatar className="h-7 w-7 shrink-0">
                {(assignee as { avatarUrl?: string | null }).avatarUrl ? (
                  <AvatarImage
                    src={(assignee as { avatarUrl?: string | null }).avatarUrl!}
                    alt={assignee.name || assignee.email || ""}
                  />
                ) : null}
                <AvatarFallback
                  className={`${getUserAvatarColor()} text-xs font-semibold text-white`}
                >
                  {getUserInitials(assignee.name || "", assignee.email || "")}
                </AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium text-gray-700">
                {assignee.name || assignee.email || t("editCard.noAssignee")}
              </span>
            </div>
          ) : (
            <div className="ml-auto rounded-full border border-dashed border-gray-300 px-2.5 py-1 text-sm text-gray-500">
              {t("editCard.noAssignee")}
            </div>
          )}
        </div>
      </Card>
    </AutoCardContextMenu>
  );
}
