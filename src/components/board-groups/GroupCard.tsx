"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckSquare,
  Kanban,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { t } from "@/lib/i18n";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";

interface GroupCardProps {
  group: DashboardBoardGroup;
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
}

export function GroupCard({
  group,
  canManage = false,
  onEdit,
  onDelete,
}: GroupCardProps) {
  const dotColor = group.color ?? "#9ca3af";
  const boardCount = group.boardCount ?? 0;
  const taskCount = group.taskCount ?? 0;
  const memberCount = group.memberCount ?? 0;

  return (
    <Card className="flex flex-col h-full transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <span
          className="inline-block h-3 w-3 rounded-full shrink-0 mt-1"
          style={{ backgroundColor: dotColor }}
          aria-hidden
        />
        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 shrink-0"
                onClick={(e) => e.preventDefault()}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onEdit?.();
                }}
              >
                <Pencil className="mr-2 h-4 w-4" />
                {t("boardGroups.editTitle")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onDelete?.();
                }}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("boardGroups.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <Link
        href={`/groups/${group.id}`}
        className="flex-1 px-4 pb-3 hover:text-blue-600 transition-colors group"
        aria-label={t("boardGroups.cardOpen")}
      >
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 leading-snug">
          {group.name}
        </h3>
      </Link>

      <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span
          className="flex items-center gap-1"
          title={t("boardGroups.cardBoards")}
        >
          <Kanban className="h-3.5 w-3.5" />
          {boardCount}
        </span>
        <span
          className="flex items-center gap-1"
          title={t("boardGroups.cardTasks")}
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {taskCount}
        </span>
        <span
          className="flex items-center gap-1"
          title={t("boardGroups.cardMembers")}
        >
          <Users className="h-3.5 w-3.5" />
          {memberCount}
        </span>
      </div>
    </Card>
  );
}
