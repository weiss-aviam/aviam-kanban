"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FolderPlus,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateBoardDialog } from "@/components/boards/CreateBoardDialog";
import { EditBoardDialog } from "@/components/boards/EditBoardDialog";
import { DeleteBoardDialog } from "@/components/boards/DeleteBoardDialog";
import { BoardCard, BoardCardData } from "@/components/boards/BoardCard";
import type { Board, BoardWithDetails } from "@/types/database";
import { ContentTopBar } from "@/components/layout/ContentTopBar";
import { CreateGroupDialog } from "@/components/board-groups/CreateGroupDialog";
import { EditGroupDialog } from "@/components/board-groups/EditGroupDialog";
import { DeleteGroupDialog } from "@/components/board-groups/DeleteGroupDialog";
import { GroupCard } from "@/components/board-groups/GroupCard";
import { t } from "@/lib/i18n";
import { useAppStore, useBoards, useBoardGroups, useAppActions } from "@/store";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import type { DashboardBoardGroup } from "@/lib/data/board-groups";

function BoardsActions({
  onBoardCreated,
  onGroupCreated,
}: {
  onBoardCreated: (b: Board) => void;
  onGroupCreated: (g: DashboardBoardGroup) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <CreateGroupDialog
        onGroupCreated={onGroupCreated}
        trigger={
          <Button variant="outline" size="sm">
            <FolderPlus className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">
              {t("boardGroups.newGroup")}
            </span>
          </Button>
        }
      />
      <CreateBoardDialog
        onBoardCreated={onBoardCreated}
        trigger={
          <Button size="sm">
            <Plus className="w-4 h-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("boardsPage.newBoard")}</span>
          </Button>
        }
      />
    </div>
  );
}

interface BoardsContentProps {
  initialBoards: BoardWithDetails[];
  initialBoardGroups: DashboardBoardGroup[];
}

export function BoardsContent({
  initialBoards,
  initialBoardGroups,
}: BoardsContentProps) {
  // Hydrate the Zustand store from server data once per mount, in the same
  // component that subscribes. useState's lazy initializer fires before any
  // useSyncExternalStore subscription is registered in this render, so the
  // setState notification has no listeners to schedule — avoiding React 19's
  // "Cannot update a component while rendering a different component" error.
  useState(() => {
    useAppStore.setState({
      boards: initialBoards,
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
  const [editingGroup, setEditingGroup] = useState<DashboardBoardGroup | null>(
    null,
  );
  const [deletingGroup, setDeletingGroup] =
    useState<DashboardBoardGroup | null>(null);

  const groupOptions = useMemo(
    () => boardGroups.map((g) => ({ id: g.id, name: g.name, color: g.color })),
    [boardGroups],
  );

  const visibleGroups = useMemo(
    () =>
      boardGroups.filter(
        (g) => (g.boardCount ?? 0) > 0 || g.createdBy === user?.id,
      ),
    [boardGroups, user?.id],
  );

  const handleAssignGroup = async (boardId: string, groupId: string | null) => {
    setBoardGroup(boardId, groupId);
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId }),
      });
      if (!res.ok) console.error("Assign group failed:", await res.text());
    } catch (err) {
      console.error("Assign group failed:", err);
    }
  };

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

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={t("boardsPage.title")}
        subtitle={t("boardsPage.subtitle")}
        actions={
          <BoardsActions
            onBoardCreated={handleBoardCreated}
            onGroupCreated={addBoardGroup}
          />
        }
      />

      <main className="flex-1 px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder={t("boardsPage.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
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

            <div className="hidden sm:flex items-center space-x-1 rounded-lg border bg-card p-1">
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

            <div className="flex items-center gap-1.5 ml-auto">
              <div className="flex items-center space-x-1 rounded-lg border bg-card p-1">
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
            </div>
          </div>
        </div>

        {filteredBoards.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center mb-4">
              {searchQuery || filterBy !== "all" ? (
                <Search className="w-12 h-12 text-muted-foreground" />
              ) : (
                <Plus className="w-12 h-12 text-muted-foreground" />
              )}
            </div>
            <h3 className="text-lg font-medium text-foreground mb-2">
              {searchQuery || filterBy !== "all"
                ? t("boardsPage.noBoardsFound")
                : t("boardsPage.noBoardsYet")}
            </h3>
            <p className="text-muted-foreground mb-6">
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
          <>
            {visibleGroups.length > 0 && (
              <section className="mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  {t("boardGroups.sectionTitle")}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  {visibleGroups.map((group) => (
                    <GroupCard
                      key={group.id}
                      group={group}
                      canManage={group.createdBy === user?.id}
                      onEdit={() => setEditingGroup(group)}
                      onDelete={() => setDeletingGroup(group)}
                    />
                  ))}
                </div>
              </section>
            )}

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
                  groupOptions={groupOptions}
                  onEdit={() => setEditingBoard(board)}
                  onArchive={() => handleArchiveBoard(board)}
                  onDelete={() => handleDeleteBoard(board)}
                  onAssignGroup={(gid) => handleAssignGroup(board.id, gid)}
                />
              ))}
            </div>
          </>
        )}

        {editingBoard && (
          <EditBoardDialog
            board={editingBoard}
            open={!!editingBoard}
            onOpenChange={(open) => !open && setEditingBoard(null)}
            onBoardUpdated={handleBoardUpdated}
          />
        )}

        <DeleteBoardDialog
          open={!!deletingBoard}
          onOpenChange={(open) => !open && setDeletingBoard(null)}
          board={deletingBoard}
          onConfirm={handleDeleteConfirmed}
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
      </main>
    </div>
  );
}
