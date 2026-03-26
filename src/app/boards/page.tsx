"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Plus,
  Users,
  Search,
  Grid,
  List,
  Archive,
  Star,
  SlidersHorizontal,
  Check,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { CreateBoardDialog } from "../../components/boards/CreateBoardDialog";
import { EditBoardDialog } from "../../components/boards/EditBoardDialog";
import { DeleteBoardDialog } from "../../components/boards/DeleteBoardDialog";
import { BoardCard, BoardCardData } from "../../components/boards/BoardCard";
import type { Board, BoardWithDetails } from "../../types/database";
import { AppHeader } from "../../components/layout/AppHeader";
import { HeaderActions } from "../../components/layout/HeaderActions";
import { t } from "../../lib/i18n";
import { useBoards, useAppActions } from "../../store";

export default function BoardsPage() {
  const boards = useBoards();
  const { fetchBoards, addBoard, removeBoard, updateBoardInList } =
    useAppActions();
  const [isFetching, setIsFetching] = useState(boards.length === 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [filterBy, setFilterBy] = useState<
    "all" | "owned" | "member" | "archived"
  >("all");
  const [_showCreateBoard, setShowCreateBoard] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardWithDetails | null>(
    null,
  );
  const [deletingBoard, setDeletingBoard] = useState<BoardWithDetails | null>(
    null,
  );

  useEffect(() => {
    fetchBoards().then(() => setIsFetching(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredBoards = useMemo(() => {
    let filtered = [...boards];
    if (searchQuery) {
      filtered = filtered.filter(
        (board) =>
          board.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          board.description?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }
    switch (filterBy) {
      case "owned":
        filtered = filtered.filter((board) => board.role === "owner");
        break;
      case "member":
        filtered = filtered.filter(
          (board) => board.role === "member" || board.role === "admin",
        );
        break;
      case "archived":
        filtered = filtered.filter((board) => board.isArchived);
        break;
    }
    return filtered;
  }, [boards, searchQuery, filterBy]);

  const handleBoardCreated = (newBoard: Board) => {
    addBoard(newBoard as BoardWithDetails);
    setShowCreateBoard(false);
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
    setEditingBoard(null);
  };

  const handleArchiveBoard = async (board: BoardWithDetails) => {
    try {
      const res = await fetch(`/api/boards/${board.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !board.isArchived }),
      });
      if (!res.ok) throw new Error("Failed to archive board");
      const { board: updated } = await res.json();
      updateBoardInList({ id: updated.id, isArchived: updated.isArchived });
    } catch (err) {
      console.error("Archive board failed:", err);
    }
  };

  const handleDeleteBoard = (board: BoardWithDetails) => {
    setDeletingBoard(board);
  };

  const handleDeleteConfirmed = async () => {
    if (!deletingBoard) return;
    try {
      const res = await fetch(`/api/boards/${deletingBoard.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete board");
      removeBoard(deletingBoard.id);
      setDeletingBoard(null);
    } catch (err) {
      console.error("Delete board failed:", err);
      window.alert(t("boardsPage.deleteFailed"));
    }
  };

  const getFilterCount = (filter: string) => {
    switch (filter) {
      case "owned":
        return boards.filter((b) => b.role === "owner").length;
      case "member":
        return boards.filter((b) => b.role === "member" || b.role === "admin")
          .length;
      case "archived":
        return boards.filter((b) => b.isArchived).length;
      default:
        return boards.length;
    }
  };

  if (isFetching) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">{t("boardsPage.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AppHeader
        title={t("boardsPage.title")}
        subtitle={t("boardsPage.subtitle")}
        navActions={<HeaderActions />}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters */}
        <div className="mb-8">
          {/* Search — full width on all screen sizes */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder={t("boardsPage.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* ── Mobile: filter dropdown ──────────────────────────────── */}
            {(() => {
              const FILTERS = [
                {
                  key: "all",
                  label: t("boardsPage.filterAll"),
                  Icon: SlidersHorizontal,
                },
                {
                  key: "owned",
                  label: t("boardsPage.filterOwned"),
                  Icon: Star,
                },
                {
                  key: "member",
                  label: t("boardsPage.filterMember"),
                  Icon: Users,
                },
                {
                  key: "archived",
                  label: t("boardsPage.filterArchived"),
                  Icon: Archive,
                },
              ] as const;
              const active = FILTERS.find((f) => f.key === filterBy)!;
              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant={filterBy !== "all" ? "default" : "outline"}
                      size="sm"
                      className="h-8 gap-1.5 sm:hidden"
                    >
                      <active.Icon className="w-4 h-4" />
                      <span className="text-xs">{active.label}</span>
                      <span className="text-xs opacity-70">
                        ({getFilterCount(filterBy)})
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {FILTERS.map(({ key, label, Icon }) => (
                      <DropdownMenuItem
                        key={key}
                        onClick={() => setFilterBy(key)}
                        className="gap-2"
                      >
                        {filterBy === key ? (
                          <Check className="w-4 h-4 shrink-0" />
                        ) : (
                          <span className="w-4 h-4 shrink-0" />
                        )}
                        <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />
                        {label}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {getFilterCount(key)}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}

            {/* ── Desktop: filter pill bar ─────────────────────────────── */}
            <div className="hidden sm:flex items-center space-x-1 bg-white rounded-lg border p-1">
              {[
                { key: "all", label: t("boardsPage.filterAll"), icon: null },
                {
                  key: "owned",
                  label: t("boardsPage.filterOwned"),
                  icon: Star,
                },
                {
                  key: "member",
                  label: t("boardsPage.filterMember"),
                  icon: Users,
                },
                {
                  key: "archived",
                  label: t("boardsPage.filterArchived"),
                  icon: Archive,
                },
              ].map(({ key, label, icon: Icon }) => (
                <Button
                  key={key}
                  variant={filterBy === key ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilterBy(key as typeof filterBy)}
                  className="text-xs"
                >
                  {Icon && <Icon className="w-3 h-3 mr-1" />}
                  {label} ({getFilterCount(key)})
                </Button>
              ))}
            </div>

            {/* View toggle + Create — right side, all screen sizes */}
            <div className="flex items-center gap-1.5 ml-auto">
              <div className="flex items-center space-x-1 bg-white rounded-lg border p-1">
                <Button
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  aria-label="Rasteransicht"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  aria-label="Listenansicht"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button>
                    <Plus className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">
                      {t("boardsPage.newBoard")}
                    </span>
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {/* Boards Content */}
        {filteredBoards.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {searchQuery || filterBy !== "all" ? (
                <Search className="w-12 h-12 text-gray-400" />
              ) : (
                <Plus className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery || filterBy !== "all"
                ? t("boardsPage.noBoardsFound")
                : t("boardsPage.noBoardsYet")}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || filterBy !== "all"
                ? t("boardsPage.tryFilters")
                : t("boardsPage.getStarted")}
            </p>
            {!searchQuery && filterBy === "all" && (
              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    {t("boardsPage.createFirstBoard")}
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <div
            className={
              viewMode === "grid"
                ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                : "space-y-4"
            }
          >
            {filteredBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board as unknown as BoardCardData}
                viewMode={viewMode}
                onEdit={() => setEditingBoard(board)}
                onArchive={() => handleArchiveBoard(board)}
                onDelete={() => handleDeleteBoard(board)}
              />
            ))}
          </div>
        )}

        {/* Edit Board Dialog */}
        {editingBoard && (
          <EditBoardDialog
            board={editingBoard}
            open={!!editingBoard}
            onOpenChange={(open) => !open && setEditingBoard(null)}
            onBoardUpdated={handleBoardUpdated}
          />
        )}

        {/* Delete Board Dialog */}
        <DeleteBoardDialog
          open={!!deletingBoard}
          onOpenChange={(open) => !open && setDeletingBoard(null)}
          board={deletingBoard}
          onConfirm={handleDeleteConfirmed}
        />
      </main>
    </div>
  );
}
