import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/db';
import { comments, cards, users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { checkBoardAccess } from '@/db/utils';
import { z } from 'zod';

const createCommentSchema = z.object({
  cardId: z.number().int().positive('Card ID must be a positive integer'),
  body: z.string().min(1, 'Comment body is required').max(1000, 'Comment too long'),
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
    const validation = createCommentSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { cardId, body: commentBody } = validation.data;

    // Get the card to check board access
    const card = await db
      .select()
      .from(cards)
      .where(eq(cards.id, cardId))
      .limit(1);

    if (card.length === 0) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this board (member level required)
    const hasAccess = await checkBoardAccess(user.id, card[0].boardId, 'member');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Create the comment
    const [newComment] = await db
      .insert(comments)
      .values({
        cardId,
        authorId: user.id,
        body: commentBody,
      })
      .returning();

    // Get the comment with author info
    const commentWithAuthor = await db
      .select({
        id: comments.id,
        cardId: comments.cardId,
        authorId: comments.authorId,
        body: comments.body,
        createdAt: comments.createdAt,
        author: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.id, newComment.id))
      .limit(1);

    return NextResponse.json(commentWithAuthor[0], { status: 201 });
  } catch (error) {
    console.error('Create comment error:', error);
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
    const cardId = searchParams.get('cardId');

    if (!cardId || isNaN(parseInt(cardId))) {
      return NextResponse.json(
        { error: 'Valid card ID is required' },
        { status: 400 }
      );
    }

    const cardIdInt = parseInt(cardId);

    // Get the card to check board access
    const card = await db
      .select()
      .from(cards)
      .where(eq(cards.id, cardIdInt))
      .limit(1);

    if (card.length === 0) {
      return NextResponse.json(
        { error: 'Card not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this board
    const hasAccess = await checkBoardAccess(user.id, card[0].boardId, 'viewer');
    
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Board not found or insufficient permissions' },
        { status: 404 }
      );
    }

    // Get all comments for the card with author info
    const cardComments = await db
      .select({
        id: comments.id,
        cardId: comments.cardId,
        authorId: comments.authorId,
        body: comments.body,
        createdAt: comments.createdAt,
        author: {
          id: users.id,
          email: users.email,
          name: users.name,
        },
      })
      .from(comments)
      .innerJoin(users, eq(comments.authorId, users.id))
      .where(eq(comments.cardId, cardIdInt))
      .orderBy(comments.createdAt);

    return NextResponse.json(cardComments);
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
