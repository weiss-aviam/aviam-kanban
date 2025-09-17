'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/button';
// Removed unused Card imports
import { Badge } from '../ui/badge';
import {
  ArrowLeft,
  Plus,
  Settings,
  Save,
  MoreHorizontal,
  Users
} from 'lucide-react';

import { CreateColumnDialog } from '../columns/CreateColumnDialog';
import { useAppActions, useCurrentBoard, useUserRole, useIsLoading, useError } from '@/store';
import { SaveBoardAsTemplateDialog } from '../templates/SaveBoardAsTemplateDialog';
import { KanbanBoard } from '../kanban/KanbanBoard';

import type { BoardWithDetails, Column, User } from '../../types/database';
import { getRoleBadgeClasses, getRoleLabel } from '../../lib/role-colors';

interface BoardDetailPageProps {
  boardId: string;
  initialBoard?: BoardWithDetails;
  currentUser?: User;
}

export function BoardDetailPage({ boardId, initialBoard, currentUser }: BoardDetailPageProps) {
  const [board, setBoard] = useState<BoardWithDetails | null>(initialBoard || null);
  const [showCreateColumn, setShowCreateColumn] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const router = useRouter();

  // Zustand store state and actions
  const storeBoard = useCurrentBoard();
  const storeUserRole = useUserRole();
  const storeIsLoading = useIsLoading();
  const storeError = useError();
  const {
    setCurrentBoard,
    setUserRole,
    setLoading,
    setError,
    clearError,
    addColumn
  } = useAppActions();

  // Use store state if available, otherwise fall back to local state
  const isLoading = storeIsLoading;
  const error = storeError || '';
  const userRole = storeUserRole || 'member';

  useEffect(() => {
    if (!initialBoard) {
      fetchBoard();
    } else {
      // Initialize store with initial board data
      setCurrentBoard(initialBoard);
      setBoard(initialBoard);
    }
  }, [boardId, initialBoard, setCurrentBoard]);

  const fetchBoard = async () => {
    try {
      setLoading(true);
      clearError();

      const response = await fetch(`/api/boards/${boardId}`);

      if (!response.ok) {
        const errorMessage = response.status === 404
          ? 'Board not found or you do not have access to it.'
          : 'Failed to load board.';
        setError(errorMessage);
        return;
      }

      const { board } = await response.json();

      // Update both local state and Zustand store
      setBoard(board);
      setCurrentBoard(board);

      // Determine user role from board membership
      const membership = board.members?.find((m: any) => m.user.id === currentUser?.id);
      if (membership) {
        setUserRole(membership.role);
      }
    } catch (err) {
      setError('Failed to load board.');
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
        columns: [...(board.columns || []), columnWithCards]
      });
    }
  };

  const handleTemplateSaved = (template: any) => {
    // Could show a success message or redirect to templates page
    console.log('Template saved:', template);
  };

// Removed test function



  const canManageBoard = board && ['owner', 'admin'].includes(board.role);
  const canAddColumns = board && ['owner', 'admin', 'member'].includes(board.role);


  const getTotalCards = () => {
    return board?.columns?.reduce((total, column) => total + (column.cards?.length || 0), 0) || 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading board...</p>
        </div>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Board Not Found</h1>
          <p className="text-gray-600 mb-4">{error || 'The board you are looking for does not exist.'}</p>
          <Button onClick={() => router.push('/boards')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Boards
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push('/boards')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Boards
              </Button>
              <div className="hidden md:block h-6 w-px bg-gray-300"></div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{board.name}</h1>
                <div className="flex items-center space-x-2 mt-1">
                  <Badge className={getRoleBadgeClasses(board.role)} variant="outline">
                    {getRoleLabel(board.role)}
                  </Badge>
                  {board.isArchived && (
                    <Badge variant="secondary">Archived</Badge>
                  )}
                  <span className="text-sm text-gray-500">
                    {board.columns?.length || 0} columns • {getTotalCards()} cards • {board.members?.length || 0} members
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {canAddColumns && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCreateColumn(true)}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Column
                </Button>
              )}

              {canManageBoard && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveTemplate(true)}
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save as Template
                </Button>
              )}

              {canManageBoard && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => router.push(`/admin/users?boardId=${boardId}`)}
                >
                  <Users className="w-4 h-4 mr-2" />
                  Manage Users
                </Button>
              )}

              {canManageBoard && (
                <Button variant="outline" size="sm">
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              )}

              {/* Test button removed */}

              <Button variant="outline" size="sm">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <div className="h-[calc(100vh-120px)]">
          <KanbanBoard
            boardData={board}
            onBoardDataChange={(updatedBoard) => {
              setBoard(updatedBoard);
              setCurrentBoard(updatedBoard);
            }}
            currentUser={currentUser || null}
            userRole={userRole}
          />
        </div>
      </main>

      {/* Dialogs */}
      <CreateColumnDialog
        open={showCreateColumn}
        onOpenChange={setShowCreateColumn}
        boardId={boardId}
        onColumnCreated={handleColumnCreated}
      />

      <SaveBoardAsTemplateDialog
        open={showSaveTemplate}
        onOpenChange={setShowSaveTemplate}
        boardId={boardId}
        boardName={board.name}
        columns={board.columns}
        onTemplateSaved={handleTemplateSaved}
      />


    </div>
  );
}
