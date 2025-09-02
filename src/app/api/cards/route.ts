import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { cards, columns } from '@/db/schema';
import { eq, max, and } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const createCardSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  columnId: z.number().int().positive('Column ID must be a positive integer'),
  title: z.string().min(1, 'Card title is required').max(160, 'Card title too long'),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
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
    const validation = createCardSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { boardId, columnId, title, description, assigneeId, dueDate, position } = validation.data;

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Verify the column belongs to the board
    const column = await db
      .select()
      .from(columns)
      .where(and(eq(columns.id, columnId), eq(columns.boardId, boardId)))
      .limit(1);

    if (column.length === 0) {
      return NextResponse.json(
        { error: 'Column not found or does not belong to this board' },
        { status: 400 }
      );
    }

    // If no position provided, get the next position in the column
    let finalPosition = position;
    if (!finalPosition) {
      const result = await db
        .select({ maxPosition: max(cards.position) })
        .from(cards)
        .where(eq(cards.columnId, columnId));
      
      finalPosition = (result[0]?.maxPosition || 0) + 1;
    }

    // Create the card
    const [newCard] = await db
      .insert(cards)
      .values({
        boardId,
        columnId,
        title,
        description: description || null,
        assigneeId: assigneeId || null,
        dueDate: dueDate ? new Date(dueDate) : null,
        position: finalPosition,
      })
      .returning();

    return NextResponse.json(newCard, { status: 201 });
  } catch (error) {
    console.error('Create card error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
