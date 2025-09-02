import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { boards, boardMembers, columns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const createBoardSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(160, 'Board name too long'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createBoardSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name } = validation.data;

    // Create the board
    const [newBoard] = await db
      .insert(boards)
      .values({
        name,
        ownerId: user.id,
        isArchived: false,
      })
      .returning();

    // Add the creator as board owner
    await db.insert(boardMembers).values({
      boardId: newBoard.id,
      userId: user.id,
      role: 'owner',
    });

    // Create default columns
    const defaultColumns = [
      { title: 'To Do', position: 1 },
      { title: 'In Progress', position: 2 },
      { title: 'Done', position: 3 },
    ];

    await db.insert(columns).values(
      defaultColumns.map(col => ({
        boardId: newBoard.id,
        title: col.title,
        position: col.position,
      }))
    );

    return NextResponse.json(newBoard, { status: 201 });
  } catch (error) {
    console.error('Create board error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get all boards the user has access to
    const userBoards = await db
      .select({
        id: boards.id,
        name: boards.name,
        ownerId: boards.ownerId,
        isArchived: boards.isArchived,
        createdAt: boards.createdAt,
        role: boardMembers.role,
      })
      .from(boards)
      .innerJoin(boardMembers, eq(boards.id, boardMembers.boardId))
      .where(eq(boardMembers.userId, user.id))
      .orderBy(boards.createdAt);

    return NextResponse.json(userBoards);
  } catch (error) {
    console.error('Get boards error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
