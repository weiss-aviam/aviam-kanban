import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { cards, columns } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const updateCardSchema = z.object({
  title: z.string().min(1, 'Card title is required').max(160, 'Card title too long').optional(),
  description: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  columnId: z.number().int().positive('Column ID must be a positive integer').optional(),
  position: z.number().int().positive('Position must be a positive integer').optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const cardId = parseInt(params.id);
    
    if (isNaN(cardId)) {
      return NextResponse.json(
        { error: 'Invalid card ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateCardSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Get the card to check board access
    const existingCard = await db
      .select()
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);

    if (existingCard.length === 0) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    const card = existingCard[0];

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, card.boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // If columnId is being updated, verify it belongs to the same board
    if (updates.columnId && updates.columnId !== card.columnId) {
      const targetColumn = await db
        .select()
        .from(columns)
        .where(and(eq(columns.id, updates.columnId), eq(columns.boardId, card.boardId)))
        .limit(1);

      if (targetColumn.length === 0) {
        return NextResponse.json(
          { error: 'Target column not found or does not belong to this board' },
          { status: 400 }
        );
      }
    }

    // Prepare the update data
    const updateData: any = {};
    
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.assigneeId !== undefined) updateData.assigneeId = updates.assigneeId;
    if (updates.dueDate !== undefined) {
      updateData.dueDate = updates.dueDate ? new Date(updates.dueDate) : null;
    }
    if (updates.columnId !== undefined) updateData.columnId = updates.columnId;
    if (updates.position !== undefined) updateData.position = updates.position;

    // Update the card
    const [updatedCard] = await db
      .update(cards)
      .set(updateData)
      .where(eq(cards.id, cardId))
      .returning();

    return NextResponse.json(updatedCard);
  } catch (error) {
    console.error('Update card error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const cardId = parseInt(params.id);
    
    if (isNaN(cardId)) {
      return NextResponse.json(
        { error: 'Invalid card ID' },
        { status: 400 }
      );
    }

    // Get the card to check board access
    const existingCard = await db
      .select()
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);

    if (existingCard.length === 0) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    const card = existingCard[0];

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, card.boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Delete the card (related data will be cascade deleted)
    await db
      .delete(cards)
      .where(eq(cards.id, cardId));

    return NextResponse.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete card error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
