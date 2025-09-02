import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { labels } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const createLabelSchema = z.object({
  boardId: z.number().int().positive('Board ID must be a positive integer'),
  name: z.string().min(1, 'Label name is required').max(50, 'Label name too long'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a valid hex color').optional(),
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
    const validation = createLabelSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { boardId, name, color } = validation.data;

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Create the label
    const [newLabel] = await db
      .insert(labels)
      .values({
        boardId,
        name,
        color: color || '#6b7280',
      })
      .returning();

    return NextResponse.json(newLabel, { status: 201 });
  } catch (error) {
    console.error('Create label error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');

    if (!boardId || isNaN(parseInt(boardId))) {
      return NextResponse.json(
        { error: 'Valid board ID is required' },
        { status: 400 }
      );
    }

    const boardIdInt = parseInt(boardId);

    // Check if user has access to this board
    const hasAccess = await checkBoardAccess(user.id, boardIdInt, 'viewer');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Get all labels for the board
    const boardLabels = await db
      .select()
      .from(labels)
      .where(eq(labels.boardId, boardIdInt))
      .orderBy(labels.name);

    return NextResponse.json(boardLabels);
  } catch (error) {
    console.error('Get labels error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
