"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// import { Badge } from '@/components/ui/badge';
import { Kanban, Plus, Users, Calendar } from "lucide-react";
import { CreateBoardDialog } from "@/components/boards/CreateBoardDialog";
import { EditBoardDialog } from "@/components/boards/EditBoardDialog";
import { BoardCard } from "@/components/boards/BoardCard";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { t } from "@/lib/i18n";
import { useBoards, useActiveTaskCount, useAppActions } from "@/store";
import type { BoardWithDetails } from "@/types/database";

type Board = BoardWithDetails;

export default function DashboardPage() {
  const boards = useBoards();
  const activeTaskCount = useActiveTaskCount();
  const {
    fetchBoards,
    fetchDashboardStats,
    setBoards,
    addBoard,
    removeBoard,
    updateBoardInList,
  } = useAppActions();
  const [isFetching, setIsFetching] = useState(boards.length === 0);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchBoards(), fetchDashboardStats()]);
      setIsFetching(false);
    };
    void load();
    // fetchBoards/fetchDashboardStats are stable Zustand actions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  void setBoards; // available for force-refresh if needed

  if (isFetching) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <Kanban className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p className="text-muted-foreground">{t("dashboard.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
      />

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section — only shown when user has no boards */}
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

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard.totalBoards")}
              </CardTitle>
              <Kanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{boards.length}</div>
              <p className="text-xs text-muted-foreground">
                {boards.length === 0
                  ? t("dashboard.noBoardsCreated")
                  : boards.length === 1
                    ? t("dashboard.oneBoardCreated")
                    : t("dashboard.nBoardsCreated", { count: boards.length })}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard.teamMembers")}
              </CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-muted-foreground">
                {t("dashboard.justYou")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {t("dashboard.activeTasks")}
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {activeTaskCount ?? (
                  <span className="inline-block h-7 w-8 animate-pulse rounded bg-muted" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {activeTaskCount === 0
                  ? t("dashboard.noTasksYet")
                  : t("dashboard.assignedTasks", {
                      count: activeTaskCount ?? 0,
                    })}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Boards Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-foreground">
              {t("dashboard.yourBoards")}
            </h3>
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

          {boards.length === 0 ? (
            /* Empty State */
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
            /* Boards Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {boards.map((board) => (
                <BoardCard
                  key={board.id}
                  board={
                    board as unknown as Parameters<typeof BoardCard>[0]["board"]
                  }
                  onEdit={() => handleEditBoard(board)}
                  onArchive={() => handleArchiveBoard(board)}
                  onDelete={() => handleDeleteBoard(board)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Edit Board Dialog */}
      <EditBoardDialog
        board={editingBoard}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onBoardUpdated={handleBoardUpdated}
      />
    </div>
  );
}
