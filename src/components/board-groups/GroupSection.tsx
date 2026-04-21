"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRight, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { t } from "@/lib/i18n";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";

interface GroupSectionProps {
  /** null = ungrouped section (no link, no actions). */
  group: DashboardBoardGroup | null;
  boardCount: number;
  /** Whether the current user can edit/delete this group (creator). */
  canManage?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  children: ReactNode;
}

export function GroupSection({
  group,
  boardCount,
  canManage = false,
  onEdit,
  onDelete,
  children,
}: GroupSectionProps) {
  const title = group?.name ?? t("boardGroups.sectionUngrouped");
  const dotColor = group?.color ?? "#9ca3af";

  return (
    <section className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
            aria-hidden
          />
          {group ? (
            <Link
              href={`/groups/${group.id}`}
              className="flex items-center gap-1 group min-w-0"
            >
              <h3 className="text-base font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                {title}
              </h3>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </Link>
          ) : (
            <h3 className="text-base font-semibold text-foreground truncate">
              {title}
            </h3>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {t("boardGroups.boardCount", { count: boardCount })}
          </span>
        </div>

        {group && canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
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
      {children}
    </section>
  );
}
