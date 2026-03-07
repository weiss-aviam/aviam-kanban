"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
// Removed unused Card imports
import { Badge } from "../ui/badge";
import { ArrowLeft, Plus, Users, Trash2, MoreHorizontal } from "lucide-react";

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
import { KanbanBoard } from "../kanban/KanbanBoard";
import { HeaderMenu } from "../layout/HeaderMenu";
import { DeleteBoardDialog } from "./DeleteBoardDialog";
import { UserManagementModal } from "../admin/UserManagementModal";
import { BoardPresenceSummary } from "./board-presence-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  // DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { AppHeader } from "../layout/AppHeader";

import type { BoardWithDetails, Column } from "../../types/database";
import { getRoleBadgeClasses, getRoleLabel } from "../../lib/role-colors";
import { t } from "@/lib/i18n";

interface BoardDetailPageProps {
  boardId: string;
  initialBoard?: BoardWithDetails;
  currentUser?: { id: string; name?: string | null; email?: string } | null;
}

export function BoardDetailPage({
  boardId,
  initialBoard,
  currentUser,
}: BoardDetailPageProps) {
  const [board, setBoard] = useState<BoardWithDetails | null>(
    initialBoard || null,
  );
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [showDeleteBoard, setShowDeleteBoard] = useState(false);
  const [showMembersModal, setShowMembersModal] = useState(false);

  const router = useRouter();

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
  const userRole = storeUserRole || "member";
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

  useEffect(() => {
    if (!initialBoard) {
      fetchBoard();
    } else {
      // Initialize store with initial board data
      setCurrentBoard(initialBoard);
      setBoard(initialBoard);

      // Set user role from initial board data
      const membership = initialBoard.members?.find((m: unknown) => {
        const member = m as {
          user: { id: string };
          role: "owner" | "admin" | "member" | "viewer";
        };
        return member.user.id === currentUser?.id;
      });
      if (membership) {
        const m = membership as {
          role: "owner" | "admin" | "member" | "viewer";
        };
        setUserRole(m.role);
      }
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

      // Update both local state and Zustand store
      setBoard(board);
      setCurrentBoard(board);

      // Determine user role from board membership
      const membership = board.members?.find((m: unknown) => {
        const member = m as {
          user: { id: string };
          role: "owner" | "admin" | "member" | "viewer";
        };
        return member.user.id === currentUser?.id;
      });
      if (membership) {
        const m = membership as {
          role: "owner" | "admin" | "member" | "viewer";
        };
        setUserRole(m.role);
      }
    } catch (_err) {
      setError(t("boardDetail.loadError"));
    } finally {
      setLoading(false);
    }
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

  const canManageBoard = board && ["owner", "admin"].includes(board.role);
  const canAddColumns =
    board && ["owner", "admin", "member"].includes(board.role);
  const canDeleteBoard = board && board.role === "owner"; // Only owners can delete boards

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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">{t("boardDetail.loading")}</p>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {t("boardDetail.notFoundTitle")}
          </h1>
          <p className="text-gray-600 mb-4">
            {error || t("boardDetail.notFoundMessage")}
          </p>
          <Button onClick={() => router.push("/boards")} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t("boardDetail.backToBoards")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <AppHeader
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
            <span>
              {t("boardDetail.columnCount", {
                count: board.columns?.length || 0,
              })}{" "}
              • {t("boardDetail.cardCount", { count: getTotalCards() })} •{" "}
              {t("boardDetail.memberCount", {
                count: board.members?.length || 0,
              })}
            </span>
            {presenceMembers.length > 0 ? (
              <BoardPresenceSummary
                currentUserId={currentUser?.id ?? null}
                members={presenceMembers}
              />
            ) : null}
          </>
        }
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push("/boards")}
            >
              <ArrowLeft className="w-4 h-4" />
              {t("boardDetail.backToBoards")}
            </Button>

            {canAddColumns && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCreateColumn(true)}
              >
                <Plus className="w-4 h-4" />
                {t("boardDetail.addColumn")}
              </Button>
            )}

            {canManageBoard && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMembersModal(true)}
              >
                <Users className="w-4 h-4" />
                {t("boardDetail.manageUsers")}
              </Button>
            )}

            {canManageBoard && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  {canDeleteBoard && (
                    <DropdownMenuItem
                      onClick={() => setShowDeleteBoard(true)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {t("board.deleteBoard")}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <HeaderMenu />
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

      <UserManagementModal
        open={showMembersModal}
        onOpenChange={setShowMembersModal}
        boardId={boardId}
        boardName={board.name}
        currentUserRole={userRole as "owner" | "admin" | "member" | "viewer"}
      />
    </div>
  );
}
