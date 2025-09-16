import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { z } from 'zod';

const bulkReorderSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid('Card ID must be a valid UUID'),
      columnId: z.number().int().positive('Column ID must be a positive integer'),
      position: z.number().int().positive('Position must be a positive integer'),
    })
  ).min(1, 'At least one card update is required'),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
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

    // Get all card IDs to verify they exist and user has access
    const cardIds = updates.map(update => update.id);
    
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, board_id')
      .in('id', cardIds);

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
      return NextResponse.json(
        { error: 'Failed to verify cards' },
        { status: 500 }
      );
    }

    if (cards.length !== cardIds.length) {
      return NextResponse.json(
        { error: 'Some cards not found or access denied' },
        { status: 404 }
      );
    }

    // Verify all cards belong to the same board
    const boardIds = [...new Set(cards.map(card => card.board_id))];
    if (boardIds.length !== 1) {
      return NextResponse.json(
        { error: 'All cards must belong to the same board' },
        { status: 400 }
      );
    }

    const boardId = boardIds[0];

    // Get all column IDs to verify they belong to the same board
    const columnIds = [...new Set(updates.map(update => update.columnId))];
    
    const { data: columns, error: columnsError } = await supabase
      .from('columns')
      .select('id, board_id')
      .in('id', columnIds)
      .eq('board_id', boardId);

    if (columnsError) {
      console.error('Error fetching columns:', columnsError);
      return NextResponse.json(
        { error: 'Failed to verify columns' },
        { status: 500 }
      );
    }

    if (columns.length !== columnIds.length) {
      return NextResponse.json(
        { error: 'Some columns not found or do not belong to this board' },
        { status: 400 }
      );
    }

    // Perform bulk updates using Supabase (respects RLS)
    const updatePromises = updates.map(update => 
      supabase
        .from('cards')
        .update({
          column_id: update.columnId,
          position: update.position,
        })
        .eq('id', update.id)
    );

    const results = await Promise.all(updatePromises);

    // Check for any errors
    const errors = results.filter(result => result.error);
    if (errors.length > 0) {
      console.error('Bulk update errors:', errors);
      return NextResponse.json(
        { error: 'Some card updates failed' },
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      message: 'Cards reordered successfully',
      updatedCount: updates.length 
    });
  } catch (error) {
    console.error('Bulk reorder error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
