import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
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
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cardId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cardId)) {
      return NextResponse.json(
        { error: 'Invalid card ID format' },
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

    const { title, description, assigneeId, dueDate, columnId, position } = validation.data;

    // Get the existing card to verify access (using Supabase RLS)
    const { data: existingCard, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id, column_id')
      .eq('id', cardId)
      .single();

    if (cardError || !existingCard) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
        { status: 404 }
      );
    }

    // If changing column, verify the new column belongs to the same board
    if (columnId && columnId !== existingCard.column_id) {
      const { data: newColumn, error: columnError } = await supabase
        .from('columns')
        .select('id, board_id')
        .eq('id', columnId)
        .eq('board_id', existingCard.board_id)
        .single();

      if (columnError || !newColumn) {
        return NextResponse.json(
          { error: 'Invalid column or column does not belong to this board' },
          { status: 400 }
        );
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigneeId !== undefined) updateData.assignee_id = assigneeId;
    if (dueDate !== undefined) updateData.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    if (columnId !== undefined) updateData.column_id = columnId;
    if (position !== undefined) updateData.position = position;

    // Update the card using Supabase (respects RLS)
    const { data: updatedCard, error: updateError } = await supabase
      .from('cards')
      .update(updateData)
      .eq('id', cardId)
      .select()
      .single();

    if (updateError) {
      console.error('Update card error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update card' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedCard = {
      id: updatedCard.id,
      boardId: updatedCard.board_id,
      columnId: updatedCard.column_id,
      title: updatedCard.title,
      description: updatedCard.description,
      assigneeId: updatedCard.assignee_id,
      dueDate: updatedCard.due_date,
      position: updatedCard.position,
      createdAt: updatedCard.created_at,
    };

    return NextResponse.json(transformedCard);
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
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const cardId = params.id;

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cardId)) {
      return NextResponse.json(
        { error: 'Invalid card ID format' },
        { status: 400 }
      );
    }

    // Delete the card using Supabase (respects RLS)
    const { error: deleteError } = await supabase
      .from('cards')
      .delete()
      .eq('id', cardId);

    if (deleteError) {
      console.error('Delete card error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete card' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Card deleted successfully' });
  } catch (error) {
    console.error('Delete card error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
