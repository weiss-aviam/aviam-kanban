import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { z } from 'zod';

const createCommentSchema = z.object({
  cardId: z.string().uuid('Card ID must be a valid UUID'),
  body: z.string().min(1, 'Comment body is required').max(1000, 'Comment too long'),
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
    const validation = createCommentSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { cardId, body: commentBody } = validation.data;

    // Verify the card exists and user has access (using Supabase RLS)
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
        { status: 404 }
      );
    }

    // Create the comment using Supabase (respects RLS)
    const { data: newComment, error: commentError } = await supabase
      .from('comments')
      .insert({
        card_id: cardId,
        author_id: user.id,
        body: commentBody,
      })
      .select(`
        id,
        card_id,
        author_id,
        body,
        created_at,
        users!inner(id, email, name)
      `)
      .single();

    if (commentError) {
      console.error('Create comment error:', commentError);
      return NextResponse.json(
        { error: 'Failed to create comment' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedComment = {
      id: newComment.id,
      cardId: newComment.card_id,
      authorId: newComment.author_id,
      body: newComment.body,
      createdAt: newComment.created_at,
      author: {
        id: Array.isArray(newComment.users) ? newComment.users[0]?.id : newComment.users?.id,
        email: Array.isArray(newComment.users) ? newComment.users[0]?.email : newComment.users?.email,
        name: Array.isArray(newComment.users) ? newComment.users[0]?.name : newComment.users?.name,
      },
    };

    return NextResponse.json(transformedComment, { status: 201 });
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
    const supabase = await createClient();
    
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

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!cardId || !uuidRegex.test(cardId)) {
      return NextResponse.json(
        { error: 'Valid card UUID is required' },
        { status: 400 }
      );
    }

    // Verify the card exists and user has access (using Supabase RLS)
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, board_id')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: 'Card not found or access denied' },
        { status: 404 }
      );
    }

    // Get comments for the card using Supabase (respects RLS)
    const { data: comments, error: commentsError } = await supabase
      .from('comments')
      .select(`
        id,
        card_id,
        author_id,
        body,
        created_at,
        users!inner(id, email, name)
      `)
      .eq('card_id', cardId)
      .order('created_at', { ascending: true });

    if (commentsError) {
      console.error('Get comments error:', commentsError);
      return NextResponse.json(
        { error: 'Failed to fetch comments' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedComments = comments.map(comment => ({
      id: comment.id,
      cardId: comment.card_id,
      authorId: comment.author_id,
      body: comment.body,
      createdAt: comment.created_at,
      author: {
        id: Array.isArray(comment.users) ? comment.users[0]?.id : comment.users?.id,
        email: Array.isArray(comment.users) ? comment.users[0]?.email : comment.users?.email,
        name: Array.isArray(comment.users) ? comment.users[0]?.name : comment.users?.name,
      },
    }));

    return NextResponse.json({ comments: transformedComments });
  } catch (error) {
    console.error('Get comments error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
