import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { z } from 'zod';

const createCardSchema = z.object({
  boardId: z.string().uuid('Board ID must be a valid UUID'),
  columnId: z.number().int().positive('Column ID must be a positive integer'),
  title: z.string().min(1, 'Card title is required').max(160, 'Card title too long'),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
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
    const validation = createCardSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { boardId, columnId, title, description, assigneeId, dueDate, position } = validation.data;

    // Verify the column belongs to the board and user has access (using Supabase RLS)
    const { data: column, error: columnError } = await supabase
      .from('columns')
      .select('id, board_id')
      .eq('id', columnId)
      .eq('board_id', boardId)
      .single();

    if (columnError || !column) {
      return NextResponse.json(
        { error: 'Column not found or does not belong to this board' },
        { status: 400 }
      );
    }

    // If no position provided, get the next position in the column
    let finalPosition = position;
    if (!finalPosition) {
      const { data: maxPositionResult } = await supabase
        .from('cards')
        .select('position')
        .eq('column_id', columnId)
        .order('position', { ascending: false })
        .limit(1);
      
      finalPosition = (maxPositionResult?.[0]?.position || 0) + 1;
    }

    // Create the card using Supabase (respects RLS)
    const { data: newCard, error: cardError } = await supabase
      .from('cards')
      .insert({
        board_id: boardId,
        column_id: columnId,
        title,
        description: description || null,
        assignee_id: assigneeId || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        position: finalPosition,
      })
      .select('*')
      .single();

    if (cardError) {
      console.error('Create card error:', cardError);
      return NextResponse.json(
        { error: 'Failed to create card' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedCard = {
      id: newCard.id,
      boardId: newCard.board_id,
      columnId: newCard.column_id,
      title: newCard.title,
      description: newCard.description,
      assigneeId: newCard.assignee_id,
      dueDate: newCard.due_date,
      position: newCard.position,
      createdAt: newCard.created_at,
      labels: [],
      comments: [],
    };

    return NextResponse.json({ card: transformedCard }, { status: 201 });
  } catch (error) {
    console.error('Create card error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
