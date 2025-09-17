import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { z } from 'zod';

const updateCommentSchema = z.object({
  body: z.string().min(1, 'Comment body is required').max(1000, 'Comment too long'),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    const commentId = parseInt(id);
    
    if (isNaN(commentId)) {
      return NextResponse.json(
        { error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateCommentSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { body: commentBody } = validation.data;

    // Update the comment using Supabase (respects RLS)
    const { data: updatedComment, error: updateError } = await supabase
      .from('comments')
      .update({ body: commentBody })
      .eq('id', commentId)
      .select(`
        id,
        card_id,
        author_id,
        body,
        created_at,
        users!inner(id, email, name)
      `)
      .single();

    if (updateError) {
      console.error('Update comment error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update comment or access denied' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedComment = {
      id: updatedComment.id,
      cardId: updatedComment.card_id,
      authorId: updatedComment.author_id,
      body: updatedComment.body,
      createdAt: updatedComment.created_at,
      author: {
        id: Array.isArray(updatedComment.users) ? updatedComment.users[0]?.id : updatedComment.users?.id,
        email: Array.isArray(updatedComment.users) ? updatedComment.users[0]?.email : updatedComment.users?.email,
        name: Array.isArray(updatedComment.users) ? updatedComment.users[0]?.name : updatedComment.users?.name,
      },
    };

    return NextResponse.json(transformedComment);
  } catch (error) {
    console.error('Update comment error:', error);
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
  const { id } = await params;
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

    const commentId = parseInt(id);
    
    if (isNaN(commentId)) {
      return NextResponse.json(
        { error: 'Invalid comment ID' },
        { status: 400 }
      );
    }

    // Delete the comment using Supabase (respects RLS)
    const { error: deleteError } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (deleteError) {
      console.error('Delete comment error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete comment or access denied' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Delete comment error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
