"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "../ui/button";
// Removed unused Card imports
import { Badge } from "../ui/badge";
import {
  ChevronLeft,
  Plus,
  Users,
  Trash2,
  MoreHorizontal,
  Edit,
  Archive,
} from "lucide-react";

import { CreateColumnDialog } from "../columns/CreateColumnDialog";
import {
  useAppActions,
  useCurrentBoard,
  useUserRole,
  useIsLoading,
  useError,
} from "@/store";
import {
  useBoardPresence,
  type BoardPresenceEditingTarget,
} from "@/hooks/useBoardPresence";
import { useBoardRealtime } from "@/hooks/useBoardRealtime";
import { KanbanBoard } from "../kanban/KanbanBoard";
import { DeleteBoardDialog } from "./DeleteBoardDialog";
import { EditBoardDialog } from "./EditBoardDialog";
import { UserManagementModal } from "../admin/UserManagementModal";
import { BoardPresenceSummary } from "./board-presence-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { ContentTopBar } from "../layout/ContentTopBar";

import type { BoardWithDetails, Column } from "../../types/database";
import { canEditBoard, canManageBoardMembers } from "@/lib/board-permissions";
import { getRoleBadgeClasses, getRoleLabel } from "../../lib/role-colors";
import { t } from "@/lib/i18n";

interface BoardDetailPageProps {
  boardId: string;
  initialBoard?: BoardWithDetails;
  currentUser?: {
    id: string;
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } | null;
}

export function BoardDetailPage({
  boardId,
  initialBoard,
  currentUser,
}: BoardDetailPageProps) {
  const [board, setBoard] = useState<BoardWithDetails | null>(
    initialBoard || null,
  );
  const boardRef = useRef(board);
  boardRef.current = board;
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [showDeleteBoard, setShowDeleteBoard] = useState(false);
  const [showEditBoard, setShowEditBoard] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCardId = searchParams.get("cardId");

  // Zustand store state and actions
  const _storeBoard = useCurrentBoard();
  const storeUserRole = useUserRole();
  const storeIsLoading = useIsLoading();
  const storeError = useError();
  const {
    setCurrentBoard,
    setUserRole,
    setLoading,
    setError,
    clearError,
    addColumn,
  } = useAppActions();

  // Use store state if available, otherwise fall back to local state
  const isLoading = storeIsLoading;
  const error = storeError || "";
  const userRole = storeUserRole || board?.role || "member";
  const {
    members: presenceMembers,
    setViewingBoardActivity,
    setEditingCardActivity,
  } = useBoardPresence({
    boardId,
    currentUser: currentUser || null,
    currentUserRole: board?.role ?? null,
  });

  const handleEditingCardChange = useCallback(
    (card: BoardPresenceEditingTarget | null) => {
      if (card) {
        void setEditingCardActivity(card);
        return;
      }

      void setViewingBoardActivity();
    },
    [setEditingCardActivity, setViewingBoardActivity],
  );

  const handleRealtimeBoardChange = useCallback(
    (updater: (prev: BoardWithDetails) => BoardWithDetails) => {
      const prev = boardRef.current;
      if (!prev) return;
      const updated = updater(prev);
      setBoard(updated);
      setCurrentBoard(updated);
    },
    [setCurrentBoard],
  );

  useBoardRealtime({ boardId, onBoardChange: handleRealtimeBoardChange });

  useEffect(() => {
    if (!initialBoard) {
      void fetchBoard();
    } else {
      const normalizedInitialBoard = {
        ...initialBoard,
        labels: initialBoard.labels ?? [],
        members: initialBoard.members ?? [],
        memberCount:
          initialBoard.memberCount ?? initialBoard.members?.length ?? 0,
      };

      // Initialize store with initial board data
      setCurrentBoard(normalizedInitialBoard);
      setBoard(normalizedInitialBoard);
      setUserRole(normalizedInitialBoard.role);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId, initialBoard, setCurrentBoard, currentUser?.id, setUserRole]);

  const fetchBoard = async () => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch(`/api/boards/${boardId}`);

      if (!response.ok) {
        const errorMessage =
          response.status === 404
            ? t("boardDetail.notFoundError")
            : t("boardDetail.loadError");
        setError(errorMessage);
        return;
      }

      const { board } = await response.json();
      const normalizedBoard = {
        ...board,
        labels: board.labels ?? [],
        members: board.members ?? [],
        memberCount: board.memberCount ?? board.members?.length ?? 0,
      } as BoardWithDetails;

      // Update both local state and Zustand store
      setBoard(normalizedBoard);
      setCurrentBoard(normalizedBoard);
      setUserRole(normalizedBoard.role);
    } catch (_err) {
      setError(t("boardDetail.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const handleMembersModalChange = (open: boolean) => {
    setShowMembersModal(open);

    if (!open) {
      void fetchBoard();
    }
  };

  const handleArchiveBoard = async () => {
    if (!board) return;
    try {
      const res = await fetch(`/api/boards/${boardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isArchived: !board.isArchived }),
      });
      if (!res.ok) return;
      const { board: updated } = await res.json();
      const updatedBoard = { ...board, isArchived: updated.isArchived };
      setBoard(updatedBoard);
      setCurrentBoard(updatedBoard);
    } catch (err) {
      console.error("Archive board failed:", err);
    }
  };

  const handleBoardUpdated = (updated: { id: string; name: string }) => {
    if (!board) return;
    const updatedBoard = { ...board, name: updated.name };
    setBoard(updatedBoard);
    setCurrentBoard(updatedBoard);
  };

  const handleColumnCreated = (newColumn: Column) => {
    const columnWithCards = { ...newColumn, cards: [] };

    // Update Zustand store
    addColumn(columnWithCards);

    // Update local state for backward compatibility
    if (board) {
      setBoard({
        ...board,
        columns: [...(board.columns || []), columnWithCards],
      });
    }
  };

  // Removed test function

  const boardRole = board?.role;
  const canManageBoard = canManageBoardMembers(boardRole);
  const canAddColumns = canEditBoard(boardRole);
  const canDeleteBoard = boardRole === "owner"; // Only owners can delete boards
  const memberCount = board?.memberCount ?? board?.members?.length ?? 0;

  const getTotalCards = () => {
    return (
      board?.columns?.reduce(
        (total, column) => total + (column.cards?.length || 0),
        0,
      ) || 0
    );
  };

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">
            {t("boardDetail.loading")}
          </p>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t("boardDetail.notFoundTitle")}
          </h1>
          <p className="text-muted-foreground mb-4">
            {error || t("boardDetail.notFoundMessage")}
          </p>
          <Button onClick={() => router.push("/boards")} variant="outline">
            <ChevronLeft className="w-4 h-4 mr-1" />
            {t("boardDetail.backToBoards")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <ContentTopBar
        title={board.name}
        subtitle={
          <>
            <Badge
              className={getRoleBadgeClasses(board.role)}
              variant="outline"
            >
              {getRoleLabel(board.role)}
            </Badge>
            {board.isArchived && (
              <Badge variant="secondary">{t("board.archived")}</Badge>
            )}
            <span className="hidden sm:inline">
              {t("boardDetail.columnCount", {
                count: board.columns?.length || 0,
              })}{" "}
              • {t("boardDetail.cardCount", { count: getTotalCards() })} •{" "}
              {t("boardDetail.memberCount", {
                count: memberCount,
              })}
            </span>
            <span className="sm:hidden">
              {t("boardDetail.cardCount", { count: getTotalCards() })}
            </span>
            {presenceMembers.length > 0 ? (
              <span className="hidden sm:inline-flex">
                <BoardPresenceSummary
                  currentUserId={currentUser?.id ?? null}
                  members={presenceMembers}
                />
              </span>
            ) : null}
          </>
        }
        actionsStart={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/boards")}
            title={t("boardDetail.backToBoards")}
            className="h-8 gap-0.5 px-1.5 text-primary hover:bg-primary/5 hover:text-primary"
          >
            <ChevronLeft className="size-4" strokeWidth={2.25} />
            <span className="hidden sm:inline text-[13px] font-medium">
              {t("sidebar.boards")}
            </span>
          </Button>
        }
        actions={
          <>
            {canAddColumns && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateColumn(true)}
                title={t("boardDetail.addColumn")}
                className="h-8 gap-1 px-2 text-primary hover:bg-primary/5 hover:text-primary"
              >
                <Plus className="size-4" strokeWidth={2.25} />
                <span className="hidden sm:inline text-[13px] font-medium">
                  {t("boardDetail.addColumn")}
                </span>
              </Button>
            )}

            {canManageBoard && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowMembersModal(true)}
                title={t("boardDetail.manageUsers")}
                className="size-8 text-muted-foreground hover:text-foreground"
              >
                <Users className="size-4" />
                <span className="sr-only">{t("boardDetail.manageUsers")}</span>
              </Button>
            )}

            {canManageBoard && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-muted-foreground hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48 rounded-xl">
                  <DropdownMenuItem onClick={() => setShowEditBoard(true)}>
                    <Edit className="mr-2 h-4 w-4" />
                    {t("board.editBoard")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchiveBoard}>
                    <Archive className="mr-2 h-4 w-4" />
                    {board.isArchived
                      ? t("board.unarchive")
                      : t("board.archive")}
                  </DropdownMenuItem>
                  {canDeleteBoard && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setShowDeleteBoard(true)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("board.deleteBoard")}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </>
        }
      />

      {/* Main Content */}
      <main className="flex-1 min-h-0">
        <KanbanBoard
          boardData={board}
          onBoardDataChange={(updatedBoard) => {
            setBoard(updatedBoard);
            setCurrentBoard(updatedBoard);
          }}
          currentUser={currentUser || null}
          presenceMembers={presenceMembers}
          onEditingCardChange={handleEditingCardChange}
          userRole={userRole}
          initialCardId={initialCardId}
          onInitialCardOpened={() => {
            router.replace(`/boards/${boardId}`);
          }}
        />
      </main>

      {/* Dialogs */}
      <CreateColumnDialog
        open={showCreateColumn}
        onOpenChange={setShowCreateColumn}
        boardId={boardId}
        onColumnCreated={handleColumnCreated}
      />

      <DeleteBoardDialog
        open={showDeleteBoard}
        onOpenChange={setShowDeleteBoard}
        board={board}
      />

      <EditBoardDialog
        board={board}
        open={showEditBoard}
        onOpenChange={setShowEditBoard}
        onBoardUpdated={handleBoardUpdated}
      />

      <UserManagementModal
        open={showMembersModal}
        onOpenChange={handleMembersModalChange}
        boardId={boardId}
        boardName={board.name}
        currentUserRole={userRole as "owner" | "admin" | "member" | "viewer"}
      />
    </div>
  );
}
