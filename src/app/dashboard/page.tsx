"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
// import { Badge } from '../../components/ui/badge';
import { Kanban, Plus, Users, Calendar } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { CreateBoardDialog } from "../../components/boards/CreateBoardDialog";
import { EditBoardDialog } from "../../components/boards/EditBoardDialog";
import { BoardCard } from "../../components/boards/BoardCard";
import { AppHeader } from "../../components/layout/AppHeader";
import { HeaderMenu } from "../../components/layout/HeaderMenu";
import { t } from "../../lib/i18n";

interface Board {
  id: string;
  name: string;
  isArchived: boolean;
  createdAt: string;
  ownerId: string;
  role: "owner" | "admin" | "member" | "viewer";
}

export default function DashboardPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBoardsLoading, setIsBoardsLoading] = useState(false);
  const [activeTaskCount, setActiveTaskCount] = useState<number | null>(null);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchBoards = async () => {
    setIsBoardsLoading(true);
    try {
      const [boardsRes, statsRes] = await Promise.all([
        fetch("/api/boards"),
        fetch("/api/dashboard/stats"),
      ]);
      if (boardsRes.ok) {
        const { boards } = await boardsRes.json();
        setBoards(boards);
      }
      if (statsRes.ok) {
        const { activeTaskCount } = await statsRes.json();
        setActiveTaskCount(activeTaskCount);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsBoardsLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();
      if (error || !user) {
        router.push("/auth/login");
        return;
      }
      setIsLoading(false);

      // Fetch boards after user is loaded
      await fetchBoards();
    };

    getUser();
  }, [router, supabase.auth]);

  const _handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  const handleBoardCreated = (newBoard: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => {
    setBoards((prev) => [newBoard as unknown as Board, ...prev]);
  };

  const handleBoardUpdated = (updated: { id: string; name: string }) => {
    setBoards((prev) =>
      prev.map((board) =>
        board.id === updated.id ? { ...board, name: updated.name } : board,
      ),
    );
  };

  const handleEditBoard = (board: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => {
    setEditingBoard(board as unknown as Board);
    setEditDialogOpen(true);
  };

  const handleArchiveBoard = async (board: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => {
    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isArchived: !board.isArchived }),
      });

      if (response.ok) {
        const { board: updatedBoard } = await response.json();
        handleBoardUpdated(updatedBoard);
      }
    } catch (error) {
      console.error("Error archiving board:", error);
    }
  };

  const handleDeleteBoard = async (board: {
    id: string;
    name: string;
    createdAt: Date;
    ownerId: string;
    isArchived: boolean;
  }) => {
    if (!confirm(t("dashboard.deleteBoardConfirm", { name: board.name }))) {
      return;
    }

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setBoards((prev) => prev.filter((b) => b.id !== board.id));
      }
    } catch (error) {
      console.error("Error deleting board:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Kanban className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">{t("dashboard.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={t("dashboard.title")}
        subtitle={t("dashboard.subtitle")}
        actions={<HeaderMenu />}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section — only shown when user has no boards */}
        {!isBoardsLoading && boards.length === 0 && (
          <div className="mb-8">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
              <h2 className="text-2xl font-bold mb-2">
                {t("dashboard.welcomeTitle")}
              </h2>
              <p className="text-blue-100 mb-4">
                {t("dashboard.welcomeSubtitle")}
              </p>
              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button
                    variant="secondary"
                    className="bg-white text-blue-600 hover:bg-gray-100"
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
                  <span className="inline-block h-7 w-8 animate-pulse rounded bg-gray-200" />
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
            <h3 className="text-lg font-semibold text-gray-900">
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

          {isBoardsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader>
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : boards.length === 0 ? (
            /* Empty State */
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Kanban className="h-12 w-12 text-gray-400 mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  {t("dashboard.noBoardsYet")}
                </h4>
                <p className="text-gray-600 text-center mb-6 max-w-sm">
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
                  board={board}
                  onEdit={handleEditBoard}
                  onArchive={handleArchiveBoard}
                  onDelete={handleDeleteBoard}
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
