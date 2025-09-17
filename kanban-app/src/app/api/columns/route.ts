import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { z } from 'zod';

const createColumnSchema = z.object({
  boardId: z.string().uuid('Board ID must be a valid UUID'),
  title: z.string().min(1, 'Column title is required').max(120, 'Column title too long'),
  position: z.number().int().optional(),
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
    const validation = createColumnSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { boardId, title, position } = validation.data;

    // Verify user has access to the board (using Supabase RLS)
    const { data: board, error: boardError } = await supabase
      .from('boards')
      .select('id')
      .eq('id', boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // If no position provided, get the next position
    let finalPosition = position;
    if (!finalPosition) {
      const { data: maxPositionResult } = await supabase
        .from('columns')
        .select('position')
        .eq('board_id', boardId)
        .order('position', { ascending: false })
        .limit(1);
      
      finalPosition = (maxPositionResult?.[0]?.position || 0) + 1;
    }

    // Create the column using Supabase (respects RLS)
    const { data: newColumn, error: columnError } = await supabase
      .from('columns')
      .insert({
        board_id: boardId,
        title,
        position: finalPosition,
      })
      .select()
      .single();

    if (columnError) {
      console.error('Create column error:', columnError);
      return NextResponse.json(
        { error: 'Failed to create column' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedColumn = {
      id: newColumn.id,
      boardId: newColumn.board_id,
      title: newColumn.title,
      position: newColumn.position,
      createdAt: newColumn.created_at,
    };

    return NextResponse.json(transformedColumn, { status: 201 });
  } catch (error) {
    console.error('Create column error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
