import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { cards, columns } from '@/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const bulkReorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number().int().positive('Card ID must be a positive integer'),
      columnId: z.number().int().positive('Column ID must be a positive integer'),
      position: z.number().int().positive('Position must be a positive integer'),
    })
  ).min(1, 'At least one card update is required'),
});

export async function PATCH(request: NextRequest) {
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
    const validation = bulkReorderSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { updates } = validation.data;

    // Get all cards to be updated
    const cardIds = updates.map(update => update.id);
    const existingCards = await db
      .select()
      .from(cards)
      .where(inArray(cards.id, cardIds));

    if (existingCards.length !== cardIds.length) {
      return NextResponse.json(
        { error: 'One or more cards not found' },
        { status: 404 }
      );
    }

    // Check that all cards belong to the same board
    const boardIds = [...new Set(existingCards.map(card => card.boardId))];
    if (boardIds.length !== 1) {
      return NextResponse.json(
        { error: 'All cards must belong to the same board' },
        { status: 400 }
      );
    }

    const boardId = boardIds[0];

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Get all target columns to verify they belong to the same board
    const targetColumnIds = [...new Set(updates.map(update => update.columnId))];
    const targetColumns = await db
      .select()
      .from(columns)
      .where(inArray(columns.id, targetColumnIds));

    // Verify all target columns belong to the same board
    const columnBoardIds = [...new Set(targetColumns.map(col => col.boardId))];
    if (columnBoardIds.length !== 1 || columnBoardIds[0] !== boardId) {
      return NextResponse.json(
        { error: 'All target columns must belong to the same board as the cards' },
        { status: 400 }
      );
    }

    // Perform bulk update in a transaction-like manner
    const updatedCards = [];
    
    for (const update of updates) {
      const [updatedCard] = await db
        .update(cards)
        .set({
          columnId: update.columnId,
          position: update.position,
        })
        .where(eq(cards.id, update.id))
        .returning();
      
      updatedCards.push(updatedCard);
    }

    return NextResponse.json({
      message: 'Cards reordered successfully',
      updatedCards,
    });
  } catch (error) {
    console.error('Bulk reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
