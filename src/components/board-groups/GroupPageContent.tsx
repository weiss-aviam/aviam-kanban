"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { BoardCard, type BoardCardData } from "@/components/boards/BoardCard";
import { EditGroupDialog } from "@/components/board-groups/EditGroupDialog";
import { DeleteGroupDialog } from "@/components/board-groups/DeleteGroupDialog";
import { t } from "@/lib/i18n";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";
import type { DashboardBoard } from "@/lib/data/dashboard";

interface GroupPageContentProps {
  initialGroup: DashboardBoardGroup;
  initialBoards: DashboardBoard[];
}

export function GroupPageContent({
  initialGroup,
  initialBoards,
}: GroupPageContentProps) {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [group, setGroup] = useState<DashboardBoardGroup>(initialGroup);
  const [boards, setBoards] = useState<DashboardBoard[]>(initialBoards);
  const [editingGroup, setEditingGroup] = useState<DashboardBoardGroup | null>(
    null,
  );
  const [deletingGroup, setDeletingGroup] =
    useState<DashboardBoardGroup | null>(null);

  const canManage = group.createdBy === user?.id;

  const handleAssignGroup = async (
    boardId: string,
    nextGroupId: string | null,
  ) => {
    if (nextGroupId === group.id) return;
    // Optimistic: remove the board from this view if moved out.
    setBoards((prev) => prev.filter((b) => b.id !== boardId));
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: nextGroupId }),
      });
      if (!res.ok) console.error("Assign group failed:", await res.text());
    } catch (err) {
      console.error("Assign group failed:", err);
    }
  };

  const handleArchive = async (board: DashboardBoard) => {
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !board.isArchived }),
      });
      if (!res.ok) return;
      const { board: updated } = await res.json();
      setBoards((prev) =>
        prev.map((b) =>
          b.id === board.id ? { ...b, isArchived: updated.isArchived } : b,
        ),
      );
    } catch (err) {
      console.error("Archive board failed:", err);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        actionsStart={
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              <span className="hidden sm:inline">
                {t("boardGroups.backToBoards")}
              </span>
            </Link>
          </Button>
        }
        title={
          <span className="flex items-center gap-2 min-w-0">
            <span
              className="inline-block h-3 w-3 rounded-full shrink-0"
              style={{ backgroundColor: group.color ?? "#9ca3af" }}
              aria-hidden
            />
            <span className="truncate">{group.name}</span>
          </span>
        }
        subtitle={t("boardGroups.boardCount", { count: boards.length })}
        actions={
          canManage ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setEditingGroup(group);
                  }}
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  {t("boardGroups.editTitle")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    setDeletingGroup(group);
                  }}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t("boardGroups.delete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null
        }
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            {t("boardGroups.boardCount", { count: 0 })}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {boards.map((board) => (
              <BoardCard
                key={board.id}
                board={board as unknown as BoardCardData}
                onArchive={() => handleArchive(board)}
                onAssignGroup={(gid) => handleAssignGroup(board.id, gid)}
              />
            ))}
          </div>
        )}
      </main>

      <EditGroupDialog
        group={editingGroup}
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
        onGroupUpdated={(g) => {
          setGroup(g);
          setEditingGroup(null);
        }}
      />

      <DeleteGroupDialog
        group={deletingGroup}
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
        onConfirmed={() => {
          setDeletingGroup(null);
          router.push("/dashboard");
        }}
      />
    </div>
  );
}
