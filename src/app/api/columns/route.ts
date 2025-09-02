import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { columns } from '@/db/schema';
import { eq, max } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const createColumnSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  title: z.string().min(1, 'Column title is required').max(120, 'Column title too long'),
  position: z.number().int().optional(),
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
    const validation = createColumnSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { boardId, title, position } = validation.data;

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // If no position provided, get the next position
    let finalPosition = position;
    if (!finalPosition) {
      const result = await db
        .select({ maxPosition: max(columns.position) })
        .from(columns)
        .where(eq(columns.boardId, boardId));
      
      finalPosition = (result[0]?.maxPosition || 0) + 1;
    }

    // Create the column
    const [newColumn] = await db
      .insert(columns)
      .values({
        boardId,
        title,
        position: finalPosition,
      })
      .returning();

    return NextResponse.json(newColumn, { status: 201 });
  } catch (error) {
    console.error('Create column error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
