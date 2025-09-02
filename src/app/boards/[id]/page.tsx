import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';
import type { BoardWithDetails } from '@/types/database';

interface BoardPageProps {
  params: { id: string };
}

async function getBoardData(boardId: number, userId: string): Promise<BoardWithDetails | null> {
  try {
    const response = await fetch(`${process.env.APP_URL || 'http://localhost:3000'}/api/boards/${boardId}`, {
      headers: {
        'Authorization': `Bearer ${userId}`, // This would need proper JWT token in production
      },
      cache: 'no-store', // Ensure fresh data for real-time updates
    });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching board data:', error);
    return null;
  }
}

export default async function BoardPage({ params }: BoardPageProps) {
  // Ensure user is authenticated
  const user = await requireAuth();
  
  const boardId = parseInt(params.id);
  
  if (isNaN(boardId)) {
    notFound();
  }

  // Fetch board data
  const boardData = await getBoardData(boardId, user.id);
  
  if (!boardData) {
    notFound();
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Board Header */}
      <header className="border-b bg-white px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{boardData.name}</h1>
            <p className="text-sm text-gray-600">
              {boardData.members.length} member{boardData.members.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center space-x-4">
            {/* Board actions will go here */}
            <div className="flex -space-x-2">
              {boardData.members.slice(0, 5).map((member) => (
                <div
                  key={member.userId}
                  className="w-8 h-8 rounded-full bg-blue-500 border-2 border-white flex items-center justify-center text-white text-xs font-medium"
                  title={member.user.name || member.user.email}
                >
                  {(member.user.name || member.user.email).charAt(0).toUpperCase()}
                </div>
              ))}
              {boardData.members.length > 5 && (
                <div className="w-8 h-8 rounded-full bg-gray-400 border-2 border-white flex items-center justify-center text-white text-xs font-medium">
                  +{boardData.members.length - 5}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Kanban Board */}
      <main className="flex-1 overflow-hidden">
        <KanbanBoard initialData={boardData} />
      </main>
    </div>
  );
}

// Generate metadata for the page
export async function generateMetadata({ params }: BoardPageProps) {
  const boardId = parseInt(params.id);
  
  if (isNaN(boardId)) {
    return {
      title: 'Board Not Found',
    };
  }

  try {
    // In a real app, you might want to fetch just the board name for metadata
    return {
      title: `Board ${boardId} | Kanban`,
      description: 'Kanban board for project management',
    };
  } catch {
    return {
      title: 'Board | Kanban',
    };
  }
}
