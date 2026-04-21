"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Kanban,
  Plus,
  Users,
  ListTodo,
  FolderKanban,
  FolderPlus,
} from "lucide-react";
import { CreateBoardDialog } from "@/components/boards/CreateBoardDialog";
import { EditBoardDialog } from "@/components/boards/EditBoardDialog";
import { BoardCard } from "@/components/boards/BoardCard";
import { CreateGroupDialog } from "@/components/board-groups/CreateGroupDialog";
import { EditGroupDialog } from "@/components/board-groups/EditGroupDialog";
import { DeleteGroupDialog } from "@/components/board-groups/DeleteGroupDialog";
import { GroupSection } from "@/components/board-groups/GroupSection";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { UpcomingDeadlinesCard } from "@/components/dashboard/UpcomingDeadlinesCard";
import { RecentActivityCard } from "@/components/dashboard/RecentActivityCard";
import { t } from "@/lib/i18n";
import { useAppStore, useBoards, useBoardGroups, useAppActions } from "@/store";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { BoardWithDetails } from "@/types/database";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";
import type { DashboardStats } from "@/lib/data/dashboard";

type Board = BoardWithDetails;

interface DashboardContentProps {
  initialBoards: BoardWithDetails[];
  initialStats: DashboardStats;
  initialBoardGroups: DashboardBoardGroup[];
}

export function DashboardContent({
  initialBoards,
  initialStats,
  initialBoardGroups,
}: DashboardContentProps) {
  // Hydrate the Zustand store from server data once per mount, in the same
  // component that subscribes. useState's lazy initializer fires before any
  // useSyncExternalStore subscription is registered in this render, so the
  // setState notification has no listeners to schedule — avoiding React 19's
  // "Cannot update a component while rendering a different component" error.
  useState(() => {
    useAppStore.setState({
      boards: initialBoards,
      activeTaskCount: initialStats.activeTaskCount,
      boardGroups: initialBoardGroups,
      boardsFetchedAt: new Date(),
    });
  });

  const boards = useBoards();
  const boardGroups = useBoardGroups();
  const { user } = useCurrentUser();
  const {
    addBoard,
    removeBoard,
    updateBoardInList,
    addBoardGroup,
    updateBoardGroup,
    removeBoardGroup,
    setBoardGroup,
  } = useAppActions();

  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DashboardBoardGroup | null>(
    null,
  );
  const [deletingGroup, setDeletingGroup] =
    useState<DashboardBoardGroup | null>(null);

  const groupOptions = useMemo(
    () =>
      boardGroups.map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color,
      })),
    [boardGroups],
  );

  // Bucket boards by group, preserving the existing dashboard order
  const { grouped, ungrouped } = useMemo(() => {
    const buckets = new Map<string, Board[]>();
    const loose: Board[] = [];
    for (const b of boards) {
      const gid = (b as Board & { groupId?: string | null }).groupId ?? null;
      if (gid) {
        const arr = buckets.get(gid) ?? [];
        arr.push(b);
        buckets.set(gid, arr);
      } else {
        loose.push(b);
      }
    }
    return { grouped: buckets, ungrouped: loose };
  }, [boards]);

  const handleBoardCreated = (newBoard: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => {
    addBoard(newBoard as unknown as Board);
  };

  const handleBoardUpdated = (updated: {
    id: string;
    name: string;
    description?: string | null;
  }) => {
    updateBoardInList({
      id: updated.id,
      name: updated.name,
      description: updated.description ?? null,
    });
  };

  const handleEditBoard = (board: Board) => {
    setEditingBoard(board);
    setEditDialogOpen(true);
  };

  const handleArchiveBoard = async (board: Board) => {
    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !board.isArchived }),
      });
      if (response.ok) {
        const { board: updatedBoard } = await response.json();
        updateBoardInList(updatedBoard);
      }
    } catch (error) {
      console.error("Error archiving board:", error);
    }
  };

  const handleDeleteBoard = async (board: Board) => {
    if (!confirm(t("dashboard.deleteBoardConfirm", { name: board.name }))) {
      return;
    }
    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "DELETE",
      });
      if (response.ok) removeBoard(board.id);
    } catch (error) {
      console.error("Error deleting board:", error);
    }
  };

  const handleAssignGroup = async (boardId: string, groupId: string | null) => {
    // Optimistic
    setBoardGroup(boardId, groupId);
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) {
        console.error("Failed to assign group:", await res.text());
        // Revert by refetching board groups would be heavier; for now log + leave UI
      }
    } catch (err) {
      console.error("Failed to assign group:", err);
    }
  };

  const renderBoardGrid = (items: Board[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((board) => (
        <BoardCard
          key={board.id}
          board={board as unknown as Parameters<typeof BoardCard>[0]["board"]}
          groupOptions={groupOptions}
          onEdit={() => handleEditBoard(board)}
          onArchive={() => handleArchiveBoard(board)}
          onDelete={() => handleDeleteBoard(board)}
          onAssignGroup={(gid) => handleAssignGroup(board.id, gid)}
        />
      ))}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {boards.length === 0 && (
          <div className="mb-8">
            <div className="bg-linear-to-r from-primary to-primary/80 rounded-xl p-6 text-primary-foreground">
              <h2 className="text-2xl font-bold mb-2">
                {t("dashboard.welcomeTitle")}
              </h2>
              <p className="text-primary-foreground/70 mb-4">
                {t("dashboard.welcomeSubtitle")}
              </p>
              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button
                    variant="secondary"
                    className="bg-white text-primary hover:bg-white/90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    {t("dashboard.createFirstBoard")}
                  </Button>
                }
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <UpcomingDeadlinesCard deadlines={initialStats.upcomingDeadlines} />
          <RecentActivityCard activities={initialStats.recentActivities} />

          <div className="grid grid-cols-2 gap-4">
            <KpiCard
              label={t("dashboard.totalBoards")}
              value={boards.length}
              icon={<Kanban className="h-4 w-4 text-muted-foreground" />}
            />
            <KpiCard
              label={t("dashboard.totalTasks")}
              value={initialStats.totalTaskCount}
              icon={<ListTodo className="h-4 w-4 text-muted-foreground" />}
            />
            <KpiCard
              label={t("dashboard.teamMembers")}
              value={initialStats.teamMemberCount}
              icon={<Users className="h-4 w-4 text-muted-foreground" />}
            />
            <KpiCard
              label={t("dashboard.totalGroups")}
              value={boardGroups.length}
              icon={<FolderKanban className="h-4 w-4 text-muted-foreground" />}
            />
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-between mb-4 gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {t("dashboard.yourBoards")}
            </h3>
            <div className="flex items-center gap-2">
              <CreateGroupDialog
                onGroupCreated={addBoardGroup}
                trigger={
                  <Button variant="outline" size="sm">
                    <FolderPlus className="w-4 h-4 mr-2" />
                    {t("boardGroups.newGroup")}
                  </Button>
                }
              />
              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-2" />
                    {t("dashboard.newBoard")}
                  </Button>
                }
              />
            </div>
          </div>

          {boards.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Kanban className="h-12 w-12 text-muted-foreground mb-4" />
                <h4 className="text-lg font-medium text-foreground mb-2">
                  {t("dashboard.noBoardsYet")}
                </h4>
                <p className="text-muted-foreground text-center mb-6 max-w-sm">
                  {t("dashboard.noBoardsDescription")}
                </p>
                <CreateBoardDialog
                  onBoardCreated={handleBoardCreated}
                  trigger={
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      {t("boards.createBoard")}
                    </Button>
                  }
                />
              </CardContent>
            </Card>
          ) : (
            <>
              {boardGroups.map((group) => {
                const items = grouped.get(group.id) ?? [];
                if (items.length === 0 && group.createdBy !== user?.id) {
                  // Hide empty groups the user didn't create — they only exist
                  // because the user used to be a member of a board that was
                  // moved out. Avoid clutter.
                  return null;
                }
                return (
                  <GroupSection
                    key={group.id}
                    group={group}
                    boardCount={items.length}
                    canManage={group.createdBy === user?.id}
                    onEdit={() => setEditingGroup(group)}
                    onDelete={() => setDeletingGroup(group)}
                  >
                    {items.length > 0 ? (
                      renderBoardGrid(items)
                    ) : (
                      <p className="text-sm text-muted-foreground italic">
                        {t("boardGroups.boardCount", { count: 0 })}
                      </p>
                    )}
                  </GroupSection>
                );
              })}

              <GroupSection group={null} boardCount={ungrouped.length}>
                {ungrouped.length > 0 ? (
                  renderBoardGrid(ungrouped)
                ) : (
                  <p className="text-sm text-muted-foreground italic">
                    {t("boardGroups.boardCount", { count: 0 })}
                  </p>
                )}
              </GroupSection>
            </>
          )}
        </div>
      </main>

      <EditBoardDialog
        board={editingBoard}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onBoardUpdated={handleBoardUpdated}
      />

      <EditGroupDialog
        group={editingGroup}
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
        onGroupUpdated={(g) => {
          updateBoardGroup(g);
          setEditingGroup(null);
        }}
      />

      <DeleteGroupDialog
        group={deletingGroup}
        open={!!deletingGroup}
        onOpenChange={(open) => !open && setDeletingGroup(null)}
        onConfirmed={(id) => {
          removeBoardGroup(id);
          setDeletingGroup(null);
        }}
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}
