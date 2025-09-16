'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import {
  Kanban,
  Plus,
  Users,
  Calendar,
  LogOut,
  Settings,
  User,
  Archive,
  Trash2
} from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { CreateBoardDialog } from '../../components/boards/CreateBoardDialog';
import { EditBoardDialog } from '../../components/boards/EditBoardDialog';
import { BoardCard } from '../../components/boards/BoardCard';
import type { User as UserType } from '@supabase/supabase-js';

interface Board {
  id: number;
  name: string;
  isArchived: boolean;
  createdAt: string;
  ownerId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
}

export default function DashboardPage() {
  const [user, setUser] = useState<UserType | null>(null);
  const [boards, setBoards] = useState<Board[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isBoardsLoading, setIsBoardsLoading] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const fetchBoards = async () => {
    setIsBoardsLoading(true);
    try {
      const response = await fetch('/api/boards');
      if (response.ok) {
        const { boards } = await response.json();
        setBoards(boards);
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
    } finally {
      setIsBoardsLoading(false);
    }
  };

  useEffect(() => {
    const getUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        router.push('/auth/login');
        return;
      }
      setUser(user);
      setIsLoading(false);

      // Fetch boards after user is loaded
      await fetchBoards();
    };

    getUser();
  }, [router, supabase.auth]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleBoardCreated = (newBoard: Board) => {
    setBoards(prev => [newBoard, ...prev]);
  };

  const handleBoardUpdated = (updatedBoard: Board) => {
    setBoards(prev => prev.map(board =>
      board.id === updatedBoard.id ? updatedBoard : board
    ));
  };

  const handleEditBoard = (board: Board) => {
    setEditingBoard(board);
    setEditDialogOpen(true);
  };

  const handleArchiveBoard = async (board: Board) => {
    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ isArchived: !board.isArchived }),
      });

      if (response.ok) {
        const { board: updatedBoard } = await response.json();
        handleBoardUpdated(updatedBoard);
      }
    } catch (error) {
      console.error('Error archiving board:', error);
    }
  };

  const handleDeleteBoard = async (board: Board) => {
    if (!confirm(`Are you sure you want to delete "${board.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/boards/${board.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setBoards(prev => prev.filter(b => b.id !== board.id));
      }
    } catch (error) {
      console.error('Error deleting board:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Kanban className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-600">Loading dashboard...</p>
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
              <Kanban className="h-8 w-8 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
                <p className="text-gray-600">Welcome back, {user?.user_metadata?.name || user?.email}</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button variant="outline" size="sm" onClick={() => router.push('/boards')}>
                <Kanban className="w-4 h-4 mr-2" />
                All Boards
              </Button>
              <Button variant="outline" size="sm">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </Button>
              <Button variant="outline" size="sm" onClick={handleSignOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
            <h2 className="text-2xl font-bold mb-2">Welcome to Aviam Kanban! 🎉</h2>
            <p className="text-blue-100 mb-4">
              You've successfully set up your account. Now you can create boards and start organizing your projects.
            </p>
            <CreateBoardDialog
              onBoardCreated={handleBoardCreated}
              trigger={
                <Button variant="secondary" className="bg-white text-blue-600 hover:bg-gray-100">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Board
                </Button>
              }
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Boards</CardTitle>
              <Kanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{boards.length}</div>
              <p className="text-xs text-muted-foreground">
                {boards.length === 0 ? 'No boards created yet' :
                 boards.length === 1 ? '1 board created' :
                 `${boards.length} boards created`}
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">1</div>
              <p className="text-xs text-muted-foreground">
                Just you for now
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
              <p className="text-xs text-muted-foreground">
                No tasks yet
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Boards Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Your Boards</h3>
            <CreateBoardDialog
              onBoardCreated={handleBoardCreated}
              trigger={
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  New Board
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
                <h4 className="text-lg font-medium text-gray-900 mb-2">No boards yet</h4>
                <p className="text-gray-600 text-center mb-6 max-w-sm">
                  Create your first Kanban board to start organizing your projects and tasks.
                </p>
                <CreateBoardDialog
                  onBoardCreated={handleBoardCreated}
                  trigger={
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Create Board
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

        {/* Getting Started Section */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Getting Started</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Create a Board</CardTitle>
                <CardDescription>
                  Set up your first Kanban board to organize your project
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateBoardDialog
                  onBoardCreated={handleBoardCreated}
                  trigger={
                    <Button variant="outline" className="w-full">
                      <Plus className="w-4 h-4 mr-2" />
                      New Board
                    </Button>
                  }
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invite Team Members</CardTitle>
                <CardDescription>
                  Collaborate with your team by inviting members to your boards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <Users className="w-4 h-4 mr-2" />
                  Invite Members
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Customize Profile</CardTitle>
                <CardDescription>
                  Update your profile information and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" className="w-full">
                  <User className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              </CardContent>
            </Card>
          </div>
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
