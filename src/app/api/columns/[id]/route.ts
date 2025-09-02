import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { columns } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const updateColumnSchema = z.object({
  title: z.string().min(1, 'Column title is required').max(120, 'Column title too long').optional(),
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

    const columnId = parseInt(params.id);
    
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
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updates = validation.data;

    // Get the column to check board access
    const existingColumn = await db
      .select()
      .from(columns)
      .where(eq(columns.id, columnId))
      .limit(1);

    if (existingColumn.length === 0) {
      return NextResponse.json(
        { error: 'Column not found' },
        { status: 404 }
      );
    }

    const column = existingColumn[0];

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, column.boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Update the column
    const [updatedColumn] = await db
      .update(columns)
      .set(updates)
      .where(eq(columns.id, columnId))
      .returning();

    return NextResponse.json(updatedColumn);
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

    const columnId = parseInt(params.id);
    
    if (isNaN(columnId)) {
      return NextResponse.json(
        { error: 'Invalid column ID' },
        { status: 400 }
      );
    }

    // Get the column to check board access
    const existingColumn = await db
      .select()
      .from(columns)
      .where(eq(columns.id, columnId))
      .limit(1);

    if (existingColumn.length === 0) {
      return NextResponse.json(
        { error: 'Column not found' },
        { status: 404 }
      );
    }

    const column = existingColumn[0];

    // Check if user has access to this board (admin level required for deletion)
    const hasAccess = await checkBoardAccess(user.id, column.boardId, 'admin');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Delete the column (cards will be cascade deleted)
    await db
      .delete(columns)
      .where(eq(columns.id, columnId));

    return NextResponse.json({ message: 'Column deleted successfully' });
  } catch (error) {
    console.error('Delete column error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
