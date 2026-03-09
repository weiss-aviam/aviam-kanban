"use client";

import Link from "next/link";
import { Card, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  MoreHorizontal,
  Edit,
  Archive,
  Trash2,
  Users,
  Calendar,
  Kanban,
} from "lucide-react";
import { getRoleBadgeClasses, getRoleLabel } from "../../lib/role-colors";
import { t } from "@/lib/i18n";
import { formatDisplayDate } from "@/lib/date-format";

interface BoardCardProps {
  board: {
    id: string;
    name: string;
    isArchived: boolean;
    createdAt: string;
    ownerId: string;
    role: "owner" | "admin" | "member" | "viewer";
  };
  onEdit?: (board: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => void;
  onArchive?: (board: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => Promise<void>;
  onDelete?: (board: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => Promise<void>;
}

export function BoardCard({
  board,
  onEdit,
  onArchive,
  onDelete,
}: BoardCardProps) {
  const canEdit = board.role === "owner" || board.role === "admin";
  const canDelete = board.role === "owner";

  return (
    <Card
      className={`flex flex-col h-full hover:shadow-md transition-shadow ${board.isArchived ? "opacity-60" : ""}`}
    >
      {/* Top: icon + title + badges/menu — grows to fill available height */}
      <div className="flex flex-row items-start justify-between gap-2 p-6 pb-3 flex-1">
        <div className="flex items-start space-x-2 min-w-0">
          <Kanban className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <CardTitle className="text-base font-medium leading-snug">
            <Link
              href={`/boards/${board.id}`}
              className="hover:text-blue-600 transition-colors"
            >
              {board.name}
            </Link>
          </CardTitle>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Badge className={getRoleBadgeClasses(board.role)}>
            {getRoleLabel(board.role)}
          </Badge>
          {(board.role === "owner" || board.role === "admin") && (
            <Badge
              variant="outline"
              className="text-xs bg-blue-50 text-blue-700 border-blue-200"
            >
              <Users className="w-3 h-3 mr-1" />
              Admin
            </Badge>
          )}
          {board.isArchived && (
            <Badge variant="secondary">{t("board.archived")}</Badge>
          )}
          {(canEdit || canDelete) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <>
                    <DropdownMenuItem
                      onClick={() =>
                        onEdit?.({
                          ...board,
                          createdAt: new Date(board.createdAt),
                        })
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      {t("board.editBoard")}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() =>
                        onArchive?.({
                          ...board,
                          createdAt: new Date(board.createdAt),
                        })
                      }
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {board.isArchived
                        ? t("board.unarchive")
                        : t("board.archive")}
                    </DropdownMenuItem>
                  </>
                )}
                {canDelete && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        onDelete?.({
                          ...board,
                          createdAt: new Date(board.createdAt),
                        })
                      }
                      className="text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("board.deleteBoard")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bottom: metadata — always pinned to bottom */}
      <div className="px-6 pb-5 pt-0">
        <div className="flex items-center space-x-4 text-sm text-gray-500">
          <div className="flex items-center">
            <Users className="mr-1 h-3 w-3" />
            <span>{t("board.team")}</span>
          </div>
          <div className="flex items-center">
            <Calendar className="mr-1 h-3 w-3" />
            <span>
              {t("board.created", {
                date: formatDisplayDate(board.createdAt),
              })}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}
