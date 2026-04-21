"use client";

import Link from "next/link";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Archive,
  Trash2,
  Users,
  CheckSquare,
  Clock,
  FolderTree,
  Check,
  Plus,
} from "lucide-react";
import { getRoleBadgeClasses, getRoleLabel } from "../../lib/role-colors";
import { t } from "@/lib/i18n";
import { formatRelativeDate } from "@/lib/date-format";

export interface BoardCardData {
  id: string;
  name: string;
  description?: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt?: string | null;
  ownerId: string;
  role: "owner" | "admin" | "member" | "viewer";
  memberCount?: number;
  taskCount?: number;
  groupId?: string | null;
}

export type BoardCardGroupOption = {
  id: string;
  name: string;
  color?: string | null;
};

interface BoardCardProps {
  board: BoardCardData;
  viewMode?: "grid" | "list";
  onEdit?: () => void;
  onArchive?: () => void | Promise<void>;
  onDelete?: () => void | Promise<void>;
  /** Visible groups the user can move this board into. */
  groupOptions?: BoardCardGroupOption[];
  onAssignGroup?: (groupId: string | null) => void;
  onCreateGroup?: () => void;
}

export function BoardCard({
  board,
  viewMode = "grid",
  onEdit,
  onArchive,
  onDelete,
  groupOptions,
  onAssignGroup,
  onCreateGroup,
}: BoardCardProps) {
  const canEdit = board.role === "owner" || board.role === "admin";
  const canDelete = board.role === "owner";
  const canAssignGroup = canEdit && !!onAssignGroup;

  const actionsMenu =
    canEdit || canDelete ? (
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
          {canEdit && (
            <>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onEdit?.();
                }}
              >
                <Edit className="mr-2 h-4 w-4" />
                {t("board.editBoard")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onArchive?.();
                }}
              >
                <Archive className="mr-2 h-4 w-4" />
                {board.isArchived ? t("board.unarchive") : t("board.archive")}
              </DropdownMenuItem>
              {canAssignGroup && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <FolderTree className="mr-2 h-4 w-4" />
                    {t("boardGroups.moveToGroup")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.preventDefault();
                        onAssignGroup?.(null);
                      }}
                    >
                      {board.groupId == null ? (
                        <Check className="mr-2 h-4 w-4" />
                      ) : (
                        <span className="mr-2 inline-block h-4 w-4" />
                      )}
                      {t("boardGroups.moveNoGroup")}
                    </DropdownMenuItem>
                    {(groupOptions ?? []).length > 0 && (
                      <DropdownMenuSeparator />
                    )}
                    {(groupOptions ?? []).map((g) => (
                      <DropdownMenuItem
                        key={g.id}
                        onClick={(e) => {
                          e.preventDefault();
                          onAssignGroup?.(g.id);
                        }}
                      >
                        {board.groupId === g.id ? (
                          <Check className="mr-2 h-4 w-4" />
                        ) : (
                          <span className="mr-2 inline-block h-4 w-4" />
                        )}
                        <span
                          className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: g.color ?? "#9ca3af" }}
                          aria-hidden
                        />
                        <span className="truncate">{g.name}</span>
                      </DropdownMenuItem>
                    ))}
                    {onCreateGroup && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.preventDefault();
                            onCreateGroup();
                          }}
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          {t("boardGroups.moveNewGroup")}
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onDelete?.();
                }}
                className="text-red-600"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("board.deleteBoard")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    ) : null;

  if (viewMode === "list") {
    return (
      <Card
        className={`transition-shadow hover:shadow-md ${board.isArchived ? "opacity-60" : ""}`}
      >
        <div className="flex items-center gap-4 p-4">
          <Link href={`/boards/${board.id}`} className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-gray-900 truncate hover:text-blue-600 transition-colors">
                    {board.name}
                  </span>
                  <Badge
                    className={`${getRoleBadgeClasses(board.role)} shrink-0`}
                  >
                    {getRoleLabel(board.role)}
                  </Badge>
                  {board.isArchived && (
                    <Badge variant="secondary" className="shrink-0">
                      {t("board.archived")}
                    </Badge>
                  )}
                </div>
                {board.description && (
                  <p className="text-sm text-gray-500 truncate">
                    {board.description}
                  </p>
                )}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-4 text-xs text-gray-500 shrink-0">
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {board.memberCount ?? 1}
            </span>
            <span className="flex items-center gap-1">
              <CheckSquare className="h-3.5 w-3.5" />
              {board.taskCount ?? 0}
            </span>
            {board.updatedAt && (
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {formatRelativeDate(board.updatedAt)}
              </span>
            )}
          </div>
          <div className="shrink-0">{actionsMenu}</div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`flex flex-col h-full transition-shadow hover:shadow-md ${board.isArchived ? "opacity-60" : ""}`}
    >
      {/* Header: badges + menu */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-3">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Badge className={getRoleBadgeClasses(board.role)}>
            {getRoleLabel(board.role)}
          </Badge>
          {board.isArchived && (
            <Badge variant="secondary">{t("board.archived")}</Badge>
          )}
        </div>
        {actionsMenu}
      </div>

      {/* Content: name + description */}
      <Link
        href={`/boards/${board.id}`}
        className="flex-1 px-4 pb-3 hover:text-blue-600 transition-colors group"
      >
        <h3 className="text-base font-semibold text-gray-900 group-hover:text-blue-600 line-clamp-2 leading-snug mb-1.5">
          {board.name}
        </h3>
        {board.description ? (
          <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed">
            {board.description}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic line-clamp-1">
            {t("boardsPage.noDescription")}
          </p>
        )}
      </Link>

      {/* Footer: member count, task count, last modified */}
      <div className="flex items-center gap-3 px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <Users className="h-3.5 w-3.5" />
          {board.memberCount ?? 1}
        </span>
        <span className="flex items-center gap-1">
          <CheckSquare className="h-3.5 w-3.5" />
          {board.taskCount ?? 0}
        </span>
        {board.updatedAt && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3.5 w-3.5" />
            {formatRelativeDate(board.updatedAt)}
          </span>
        )}
      </div>
    </Card>
  );
}
