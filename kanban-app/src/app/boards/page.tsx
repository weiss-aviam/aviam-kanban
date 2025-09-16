'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Kanban,
  Plus,
  Users,
  Calendar,
  LogOut,
  Settings,
  Search,
  Filter,
  Grid,
  List,
  Archive,
  Star,
  MoreHorizontal
} from 'lucide-react';
import { createClient } from '../../lib/supabase/client';
import { CreateBoardDialog } from '../../components/boards/CreateBoardDialog';
import { EditBoardDialog } from '../../components/boards/EditBoardDialog';
import type { User as UserType } from '@supabase/supabase-js';
import type { BoardWithDetails } from '../../types/database';
import { format } from 'date-fns';
import { getRoleBadgeClasses, getRoleLabel } from '../../lib/role-colors';

interface BoardsPageState {
  boards: BoardWithDetails[];
  filteredBoards: BoardWithDetails[];
  isLoading: boolean;
  user: UserType | null;
  searchQuery: string;
  viewMode: 'grid' | 'list';
  filterBy: 'all' | 'owned' | 'member' | 'archived';
}

export default function BoardsPage() {
  const router = useRouter();
  const [state, setState] = useState<BoardsPageState>({
    boards: [],
    filteredBoards: [],
    isLoading: true,
    user: null,
    searchQuery: '',
    viewMode: 'grid',
    filterBy: 'all'
  });

  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [editingBoard, setEditingBoard] = useState<BoardWithDetails | null>(null);

  useEffect(() => {
    checkAuth();
    fetchBoards();
  }, []);

  useEffect(() => {
    filterBoards();
  }, [state.boards, state.searchQuery, state.filterBy]);

  const checkAuth = async () => {
    const supabase = createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
      router.push('/auth/login');
      return;
    }

    setState(prev => ({ ...prev, user }));
  };

  const fetchBoards = async () => {
    try {
      const response = await fetch('/api/boards');
      if (response.ok) {
        const boards = await response.json();
        setState(prev => ({ 
          ...prev, 
          ...boards, 
          isLoading: false 
        }));
      }
    } catch (error) {
      console.error('Error fetching boards:', error);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const filterBoards = () => {
    let filtered = [...state.boards];

    // Apply search filter
    if (state.searchQuery) {
      filtered = filtered.filter(board =>
        board.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        board.description?.toLowerCase().includes(state.searchQuery.toLowerCase())
      );
    }

    // Apply role filter
    switch (state.filterBy) {
      case 'owned':
        filtered = filtered.filter(board => board.role === 'owner');
        break;
      case 'member':
        filtered = filtered.filter(board => board.role === 'member' || board.role === 'admin');
        break;
      case 'archived':
        filtered = filtered.filter(board => board.isArchived);
        break;
      default:
        // 'all' - no additional filtering
        break;
    }

    setState(prev => ({ ...prev, filteredBoards: filtered }));
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleBoardCreated = (newBoard: BoardWithDetails) => {
    setState(prev => ({
      ...prev,
      boards: [newBoard, ...prev.boards]
    }));
    setShowCreateBoard(false);
  };

  const handleBoardUpdated = (updatedBoard: BoardWithDetails) => {
    setState(prev => ({
      ...prev,
      boards: prev.boards.map(board => 
        board.id === updatedBoard.id ? updatedBoard : board
      )
    }));
    setEditingBoard(null);
  };



  const getFilterCount = (filter: string) => {
    console.log(state)
    switch (filter) {
      case 'owned': return state.boards?.filter(b => b.role === 'owner').length;
      case 'member': return state.boards?.filter(b => b.role === 'member' || b.role === 'admin').length;
      case 'archived': return state.boards?.filter(b => b.isArchived).length;
      default: return state.boards?.length;
    }
  };

  if (state.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading boards...</p>
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
              <Link href="/dashboard" className="flex items-center space-x-2">
                <Kanban className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">Aviam Kanban</span>
              </Link>
              <div className="hidden md:block h-6 w-px bg-gray-300"></div>
              <div className="hidden md:block">
                <h1 className="text-2xl font-bold text-gray-900">All Boards</h1>
                <p className="text-gray-600">Manage and organize your projects</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
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
        {/* Search and Filters */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search boards..."
                  value={state.searchQuery}
                  onChange={(e) => setState(prev => ({ ...prev, searchQuery: e.target.value }))}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Filter Buttons */}
              <div className="flex items-center space-x-1 bg-white rounded-lg border p-1">
                {[
                  { key: 'all', label: 'All', icon: null },
                  { key: 'owned', label: 'Owned', icon: Star },
                  { key: 'member', label: 'Member', icon: Users },
                  { key: 'archived', label: 'Archived', icon: Archive }
                ].map(({ key, label, icon: Icon }) => (
                  <Button
                    key={key}
                    variant={state.filterBy === key ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setState(prev => ({ ...prev, filterBy: key as any }))}
                    className="text-xs"
                  >
                    {Icon && <Icon className="w-3 h-3 mr-1" />}
                    {label} ({getFilterCount(key)})
                  </Button>
                ))}
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center space-x-1 bg-white rounded-lg border p-1">
                <Button
                  variant={state.viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setState(prev => ({ ...prev, viewMode: 'grid' }))}
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={state.viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setState(prev => ({ ...prev, viewMode: 'list' }))}
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {/* Create Board Button */}
              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    New Board
                  </Button>
                }
              />
            </div>
          </div>
        </div>

        {/* Boards Content */}
        {state.filteredBoards.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              {state.searchQuery || state.filterBy !== 'all' ? (
                <Search className="w-12 h-12 text-gray-400" />
              ) : (
                <Plus className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {state.searchQuery || state.filterBy !== 'all' ? 'No boards found' : 'No boards yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {state.searchQuery || state.filterBy !== 'all' 
                ? 'Try adjusting your search or filters'
                : 'Get started by creating your first Kanban board'
              }
            </p>
            {(!state.searchQuery && state.filterBy === 'all') && (
              <CreateBoardDialog
                onBoardCreated={handleBoardCreated}
                trigger={
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Your First Board
                  </Button>
                }
              />
            )}
          </div>
        ) : (
          <div className={
            state.viewMode === 'grid' 
              ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              : "space-y-4"
          }>
            {state.filteredBoards.map((board) => (
              <BoardCard
                key={board.id}
                board={board}
                viewMode={state.viewMode}
                onEdit={() => setEditingBoard(board)}

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
      </main>
    </div>
  );
}

// Board Card Component
interface BoardCardProps {
  board: BoardWithDetails;
  viewMode: 'grid' | 'list';
  onEdit: () => void;
}

function BoardCard({ board, viewMode, onEdit }: BoardCardProps) {
  if (viewMode === 'list') {
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <Link href={`/boards/${board.id}`} className="flex-1">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <Kanban className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                      {board.name}
                    </h3>
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {board.description || 'No description'}
                    </p>
                  </div>
                </div>
              </Link>
              <div className="flex items-center space-x-4 text-sm text-gray-500">
                <Badge className={getRoleBadgeClasses(board.role)} variant="outline">
                  {getRoleLabel(board.role)}
                </Badge>
                <span className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{format(new Date(board.createdAt), 'MMM d, yyyy')}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span>{board.memberCount || 1}</span>
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={onEdit}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Link href={`/boards/${board.id}`}>
      <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="line-clamp-2 text-base">{board.name}</CardTitle>
              <CardDescription className="mt-2 line-clamp-2">
                {board.description || 'No description'}
              </CardDescription>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.preventDefault();
                onEdit();
              }}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-xs text-gray-500">
            <div className="flex items-center space-x-3">
              <Badge className={getRoleBadgeClasses(board.role)} variant="outline">
                {getRoleLabel(board.role)}
              </Badge>
              {board.isArchived && (
                <Badge variant="secondary">Archived</Badge>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <Users className="w-3 h-3" />
                <span>{board.memberCount || 1}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>{format(new Date(board.createdAt), 'MMM d')}</span>
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
