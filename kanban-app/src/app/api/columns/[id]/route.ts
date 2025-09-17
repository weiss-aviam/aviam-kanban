import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { z } from 'zod';

const updateColumnSchema = z.object({
  title: z.string().min(1, 'Column title is required').max(120, 'Column title too long').optional(),
  position: z.number().int().positive('Position must be a positive integer').optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const columnId = parseInt(id);
    
    if (isNaN(columnId)) {
      return NextResponse.json(
        { error: 'Invalid column ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateColumnSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { title, position } = validation.data;

    // Verify the column exists and user has access (using Supabase RLS)
    const { data: existingColumn, error: columnError } = await supabase
      .from('columns')
      .select('id, board_id')
      .eq('id', columnId)
      .single();

    if (columnError || !existingColumn) {
      return NextResponse.json(
        { error: 'Column not found or access denied' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (position !== undefined) updateData.position = position;

    // Update the column using Supabase (respects RLS)
    const { data: updatedColumn, error: updateError } = await supabase
      .from('columns')
      .update(updateData)
      .eq('id', columnId)
      .select()
      .single();

    if (updateError) {
      console.error('Update column error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update column' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedColumn = {
      id: updatedColumn.id,
      boardId: updatedColumn.board_id,
      title: updatedColumn.title,
      position: updatedColumn.position,
      createdAt: updatedColumn.created_at,
    };

    return NextResponse.json(transformedColumn);
  } catch (error) {
    console.error('Update column error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
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

    const { id } = await params;
    const columnId = parseInt(id);

    if (isNaN(columnId)) {
      return NextResponse.json(
        { error: 'Invalid column ID' },
        { status: 400 }
      );
    }

    // Verify the column exists and user has access (using Supabase RLS)
    const { data: existingColumn, error: columnError } = await supabase
      .from('columns')
      .select('id, board_id')
      .eq('id', columnId)
      .single();

    if (columnError || !existingColumn) {
      return NextResponse.json(
        { error: 'Column not found or access denied' },
        { status: 404 }
      );
    }

    // Check if column has any cards (only allow deletion of empty columns)
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id')
      .eq('column_id', columnId)
      .limit(1);

    if (cardsError) {
      console.error('Error checking cards:', cardsError);
      return NextResponse.json(
        { error: 'Failed to check column contents' },
        { status: 500 }
      );
    }

    if (cards && cards.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete column with cards. Please move or delete all cards first.' },
        { status: 400 }
      );
    }

    // Delete the column using Supabase (respects RLS)
    const { error: deleteError } = await supabase
      .from('columns')
      .delete()
      .eq('id', columnId);

    if (deleteError) {
      console.error('Delete column error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete column' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
