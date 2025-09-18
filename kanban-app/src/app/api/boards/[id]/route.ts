import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';

// GET /api/boards/[id] - Get a specific board
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(boardId)) {
      return NextResponse.json({ error: 'Invalid board ID format' }, { status: 400 });
    }

    // Get board with user's role using Supabase (respects RLS)
    const { data: boardData, error: boardError } = await supabase
      .from('boards')
      .select(`
        id,
        name,
        is_archived,
        created_at,
        owner_id,
        board_members!inner(role)
      `)
      .eq('id', boardId)
      .single();

    if (boardError || !boardData) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 404 });
    }

    // Get columns for this board
    const { data: columnsData, error: columnsError } = await supabase
      .from('columns')
      .select(`
        id,
        title,
        position,
        created_at,
        cards (
          id,
          board_id,
          title,
          description,
          position,
          due_date,
          priority,
          created_at,
          assignee_id,
          users:assignee_id (
            id,
            email,
            name
          )
        )
      `)
      .eq('board_id', boardId)
      .order('position', { ascending: true });

    if (columnsError) {
      console.error('Error fetching columns:', columnsError);
      return NextResponse.json({ error: 'Failed to fetch board data' }, { status: 500 });
    }

    // Transform columns data to match expected format
    const columns = (columnsData || []).map(column => ({
      id: column.id,
      title: column.title,
      position: column.position,
      createdAt: column.created_at,
      cards: (column.cards || []).map(card => ({
        id: card.id,
        boardId: card.board_id,
        columnId: column.id,
        title: card.title,
        description: card.description,
        position: card.position,
        dueDate: card.due_date,
        priority: card.priority || 'medium',
        createdAt: card.created_at,
        assigneeId: card.assignee_id,
        assignee: (() => {
          const u = (card as any).users;
          if (!u) return null;
          return {
            id: Array.isArray(u) ? u[0]?.id : u?.id,
            email: Array.isArray(u) ? u[0]?.email : u?.email,
            name: Array.isArray(u) ? u[0]?.name : u?.name,
          };
        })()
      }))
    }));

    const board = {
      id: boardData.id,
      name: boardData.name,
      isArchived: boardData.is_archived,
      createdAt: boardData.created_at,
      ownerId: boardData.owner_id,
      role: (boardData as any).board_members?.[0]?.role || 'viewer',
      columns: columns
    };

    return NextResponse.json({ board });
  } catch (error) {
    console.error('Error fetching board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/boards/[id] - Update a board
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: boardId } = await params;
    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(boardId)) {
      return NextResponse.json({ error: 'Invalid board ID format' }, { status: 400 });
    }

    const body = await request.json();
    const { name, isArchived } = body;

    // First, get the user's role for this board
    const { data: memberData, error: memberError } = await supabase
      .from('board_members')
      .select('role')
      .eq('board_id', boardId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 404 });
    }

    const userRole = memberData.role;
    if (userRole !== 'owner' && userRole !== 'admin') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
      }
      updateData.name = name.trim();
    }
    if (isArchived !== undefined) {
      updateData.is_archived = Boolean(isArchived);
    }

    // Update the board using Supabase (respects RLS)
    const { data: updatedBoard, error: updateError } = await supabase
      .from('boards')
      .update(updateData)
      .eq('id', boardId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating board:', updateError);
      return NextResponse.json({ error: 'Failed to update board' }, { status: 500 });
    }

    return NextResponse.json({
      board: {
        id: updatedBoard.id,
        name: updatedBoard.name,
        isArchived: updatedBoard.is_archived,
        createdAt: updatedBoard.created_at,
        ownerId: updatedBoard.owner_id,
        role: userRole
      }
    });
  } catch (error) {
    console.error('Error updating board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/boards/[id] - Delete a board
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return NextResponse.json({ error: 'Invalid board ID format' }, { status: 400 });
    }

    // Check if user is the owner of this board
    const { data: memberData, error: memberError } = await supabase
      .from('board_members')
      .select('role')
      .eq('board_id', id)
      .eq('user_id', user.id)
      .single();

    if (memberError || !memberData) {
      return NextResponse.json({ error: 'Board not found or access denied' }, { status: 404 });
    }

    if (memberData.role !== 'owner') {
      return NextResponse.json({ error: 'Only board owners can delete boards' }, { status: 403 });
    }

    // Delete the board using Supabase (respects RLS and cascade)
    const { error: deleteError } = await supabase
      .from('boards')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting board:', deleteError);
      return NextResponse.json({ error: 'Failed to delete board' }, { status: 500 });
    }

    return NextResponse.json({ message: 'Board deleted successfully' });
  } catch (error) {
    console.error('Error deleting board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
