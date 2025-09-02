import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Users, Calendar } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

interface BoardSummary {
  id: number;
  name: string;
  ownerId: string;
  isArchived: boolean;
  createdAt: string;
  role: string;
}

async function getUserBoards(userId: string): Promise<BoardSummary[]> {
  try {
    const response = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/boards`, {
      headers: {
        'Authorization': `Bearer ${userId}`, // This would need proper JWT token in production
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return [];
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching boards:', error);
    return [];
  }
}

export default async function DashboardPage() {
  // Ensure user is authenticated
  const user = await requireAuth();
  
  // Fetch user's boards
  const boards = await getUserBoards(user.id);

  const handleCreateBoard = () => {
    // This would open a dialog to create a new board
    console.log('Create board clicked');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="text-gray-600">Manage your Kanban boards</p>
            </div>
            <Button onClick={handleCreateBoard}>
              <Plus className="w-4 h-4 mr-2" />
              Create Board
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {boards.length === 0 ? (
          /* Empty State */
          <div className="text-center py-12">
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <Plus className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No boards yet</h3>
            <p className="text-gray-600 mb-6">Get started by creating your first Kanban board</p>
            <Button onClick={handleCreateBoard}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Board
            </Button>
          </div>
        ) : (
          /* Boards Grid */
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Your Boards</h2>
              <p className="text-gray-600">{boards.length} board{boards.length !== 1 ? 's' : ''}</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {boards.map((board) => (
                <Link key={board.id} href={`/boards/${board.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="line-clamp-1">{board.name}</CardTitle>
                      <CardDescription className="flex items-center space-x-4 text-xs">
                        <span className="flex items-center space-x-1">
                          <Users className="w-3 h-3" />
                          <span className="capitalize">{board.role}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{format(new Date(board.createdAt), 'MMM d, yyyy')}</span>
                        </span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          board.isArchived 
                            ? 'bg-gray-100 text-gray-800' 
                            : 'bg-green-100 text-green-800'
                        }`}>
                          {board.isArchived ? 'Archived' : 'Active'}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
              
              {/* Create Board Card */}
              <Card 
                className="border-dashed border-2 hover:border-solid hover:shadow-lg transition-all cursor-pointer"
                onClick={handleCreateBoard}
              >
                <CardContent className="flex flex-col items-center justify-center h-full py-12">
                  <Plus className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-gray-600 font-medium">Create New Board</span>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
