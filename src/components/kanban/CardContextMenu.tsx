"use client";

import React from "react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import {
  Edit,
  Copy,
  Archive,
  Trash2,
  Flag,
  ArrowRight,
  AlertTriangle,
  Minus,
} from "lucide-react";
import type {
  Card,
  Column,
  BoardMemberRole,
  CardPriority,
} from "@/types/database";
import { getPriorityConfig } from "@/lib/priority-colors";
import { t } from "@/lib/i18n";

interface CardContextMenuProps {
  card: Card;
  columns: Column[];
  userRole: BoardMemberRole;
  onEdit: (card: Card) => void;
  onDelete: (card: Card) => void;
  onDuplicate: (card: Card) => void;
  onArchive: (card: Card) => void;
  onPriorityChange: (card: Card, priority: CardPriority) => void;
  onMoveToColumn: (card: Card, columnId: number) => void;
  children: React.ReactNode;
  disabled?: boolean;
}

const PRIORITY_ICONS = {
  high: AlertTriangle,
  medium: Flag,
  low: Minus,
};

export function CardContextMenu({
  card,
  columns,
  userRole,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  onPriorityChange,
  onMoveToColumn,
  children,
  disabled = false,
}: CardContextMenuProps) {
  // Permission checks
  const canEdit = ["owner", "admin", "member"].includes(userRole);
  const canDelete = ["owner", "admin"].includes(userRole);
  const canArchive = ["owner", "admin"].includes(userRole);

  // Get other columns (excluding current column)
  const otherColumns = columns.filter((col) => col.id !== card.columnId);

  // Priority options
  const priorities: { value: CardPriority; label: string }[] = [
    { value: "high", label: t("priority.high") },
    { value: "medium", label: t("priority.medium") },
    { value: "low", label: t("priority.low") },
  ];

  if (disabled) {
    return <>{children}</>;
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        {/* Edit Card */}
        {canEdit && (
          <ContextMenuItem onClick={() => onEdit(card)}>
            <Edit className="mr-2 h-4 w-4" />
            {t("cardMenu.edit")}
            <ContextMenuShortcut>⌘E</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Change Priority */}
        {canEdit && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Flag className="mr-2 h-4 w-4" />
              {t("cardMenu.changePriority")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {priorities.map(({ value, label }) => {
                const config = getPriorityConfig(value);
                const Icon = PRIORITY_ICONS[value];
                const isCurrentPriority = (card.priority || "medium") === value;

                return (
                  <ContextMenuItem
                    key={value}
                    onClick={() => onPriorityChange(card, value)}
                    disabled={isCurrentPriority}
                  >
                    <Icon
                      className="mr-2 h-4 w-4"
                      style={{ color: config.color }}
                    />
                    {label}
                    {isCurrentPriority && (
                      <ContextMenuShortcut>
                        {t("cardMenu.current")}
                      </ContextMenuShortcut>
                    )}
                  </ContextMenuItem>
                );
              })}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {/* Move to Column */}
        {canEdit && otherColumns.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <ArrowRight className="mr-2 h-4 w-4" />
              {t("cardMenu.moveToColumn")}
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {otherColumns.map((column) => (
                <ContextMenuItem
                  key={column.id}
                  onClick={() => onMoveToColumn(card, column.id)}
                >
                  <span className="truncate">{column.title}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}

        {canEdit && <ContextMenuSeparator />}

        {/* Duplicate Card */}
        {canEdit && (
          <ContextMenuItem onClick={() => onDuplicate(card)}>
            <Copy className="mr-2 h-4 w-4" />
            {t("cardMenu.duplicate")}
            <ContextMenuShortcut>⌘D</ContextMenuShortcut>
          </ContextMenuItem>
        )}

        {/* Archive Card */}
        {canArchive && (
          <ContextMenuItem onClick={() => onArchive(card)}>
            <Archive className="mr-2 h-4 w-4" />
            {t("cardMenu.archive")}
          </ContextMenuItem>
        )}

        {(canDelete || canArchive) && <ContextMenuSeparator />}

        {/* Delete Card */}
        {canDelete && (
          <ContextMenuItem
            onClick={() => onDelete(card)}
            className="text-red-600 focus:text-red-600 focus:bg-red-50"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("cardMenu.delete")}
            <ContextMenuShortcut>⌘⌫</ContextMenuShortcut>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Simplified context menu for read-only users
export function ReadOnlyCardContextMenu({
  card: _card,
  children,
}: {
  card: Card;
  children: React.ReactNode;
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-56">
        <ContextMenuItem disabled>
          <Edit className="mr-2 h-4 w-4" />
          {t("cardMenu.viewOnly")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

// Context menu wrapper that automatically chooses the right menu based on permissions
export function AutoCardContextMenu({
  card,
  columns,
  userRole,
  onEdit,
  onDelete,
  onDuplicate,
  onArchive,
  onPriorityChange,
  onMoveToColumn,
  children,
  disabled = false,
}: CardContextMenuProps) {
  const hasEditPermissions = ["owner", "admin", "member"].includes(userRole);

  if (!hasEditPermissions || disabled) {
    return (
      <ReadOnlyCardContextMenu card={card}>{children}</ReadOnlyCardContextMenu>
    );
  }

  return (
    <CardContextMenu
      card={card}
      columns={columns}
      userRole={userRole}
      onEdit={onEdit}
      onDelete={onDelete}
      onDuplicate={onDuplicate}
      onArchive={onArchive}
      onPriorityChange={onPriorityChange}
      onMoveToColumn={onMoveToColumn}
      disabled={disabled}
    >
      {children}
    </CardContextMenu>
  );
}
