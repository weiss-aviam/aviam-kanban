import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';

// GET /api/boards - Get all boards for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get boards where user is a member using Supabase (respects RLS)
    const { data: userBoards, error: boardsError } = await supabase
      .from('boards')
      .select(`
        id,
        name,
        is_archived,
        created_at,
        owner_id,
        board_members!inner(role)
      `)
      .order('created_at', { ascending: false });

    if (boardsError) {
      console.error('Error fetching boards:', boardsError);
      return NextResponse.json({ error: 'Failed to fetch boards' }, { status: 500 });
    }

    // Transform the data to match our expected format
    const boards = userBoards.map(board => ({
      id: board.id,
      name: board.name,
      isArchived: board.is_archived,
      createdAt: board.created_at,
      ownerId: board.owner_id,
      role: board.board_members[0]?.role || 'viewer'
    }));

    return NextResponse.json({ boards });
  } catch (error) {
    console.error('Error fetching boards:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/boards - Create a new board
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, templateId } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Board name is required' }, { status: 400 });
    }

    // Get template columns if templateId is provided
    let templateColumns = [];
    if (templateId) {
      const { data: template, error: templateError } = await supabase
        .from('column_templates')
        .select(`
          id,
          template_columns (
            title,
            position
          )
        `)
        .eq('id', templateId)
        .single();

      if (templateError || !template) {
        return NextResponse.json({ error: 'Template not found' }, { status: 404 });
      }

      templateColumns = template.template_columns.sort((a, b) => a.position - b.position);
    } else {
      // Get default template if no template specified
      const { data: defaultTemplate, error: defaultError } = await supabase
        .from('column_templates')
        .select(`
          id,
          template_columns (
            title,
            position
          )
        `)
        .eq('is_default', true)
        .single();

      if (defaultTemplate && !defaultError) {
        templateColumns = defaultTemplate.template_columns.sort((a, b) => a.position - b.position);
      } else {
        // Fallback to basic columns if no default template
        templateColumns = [
          { title: 'To Do', position: 1 },
          { title: 'In Progress', position: 2 },
          { title: 'Done', position: 3 },
        ];
      }
    }

    // Create the board using Supabase (respects RLS)
    const { data: newBoard, error: boardError } = await supabase
      .from('boards')
      .insert({
        name: name.trim(),
        owner_id: user.id,
      })
      .select()
      .single();

    if (boardError) {
      console.error('Error creating board:', boardError);
      return NextResponse.json({ error: 'Failed to create board' }, { status: 500 });
    }

    // Add the creator as owner to board_members using Supabase (respects RLS)
    const { error: memberError } = await supabase
      .from('board_members')
      .insert({
        board_id: newBoard.id,
        user_id: user.id,
        role: 'owner',
      });

    if (memberError) {
      console.error('Error adding board member:', memberError);
      return NextResponse.json({ error: 'Failed to add board member' }, { status: 500 });
    }

    // Create columns from template
    if (templateColumns.length > 0) {
      const columnsToInsert = templateColumns.map(col => ({
        board_id: newBoard.id,
        title: col.title,
        position: col.position,
      }));

      const { error: columnsError } = await supabase
        .from('columns')
        .insert(columnsToInsert);

      if (columnsError) {
        console.error('Error creating columns:', columnsError);
        // Don't fail the board creation if columns fail, but log the error
      }
    }

    return NextResponse.json({
      board: {
        id: newBoard.id,
        name: newBoard.name,
        isArchived: newBoard.is_archived,
        createdAt: newBoard.created_at,
        ownerId: newBoard.owner_id,
        role: 'owner'
      }
    }, { status: 201 });
  } catch (error) {
    console.error('Error creating board:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
