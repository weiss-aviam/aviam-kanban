import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { z } from 'zod';

const updateLabelSchema = z.object({
  name: z.string().min(1, 'Label name is required').max(50, 'Label name too long').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Color must be a valid hex color').optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
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

    const labelId = parseInt(params.id);
    
    if (isNaN(labelId)) {
      return NextResponse.json(
        { error: 'Invalid label ID' },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateLabelSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { name, color } = validation.data;

    // Prepare update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (color !== undefined) updateData.color = color;

    // Update the label using Supabase (respects RLS)
    const { data: updatedLabel, error: updateError } = await supabase
      .from('labels')
      .update(updateData)
      .eq('id', labelId)
      .select()
      .single();

    if (updateError) {
      console.error('Update label error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update label or access denied' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedLabel = {
      id: updatedLabel.id,
      boardId: updatedLabel.board_id,
      name: updatedLabel.name,
      color: updatedLabel.color,
      createdAt: updatedLabel.created_at,
    };

    return NextResponse.json(transformedLabel);
  } catch (error) {
    console.error('Update label error:', error);
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
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const labelId = parseInt(params.id);
    
    if (isNaN(labelId)) {
      return NextResponse.json(
        { error: 'Invalid label ID' },
        { status: 400 }
      );
    }

    // Delete the label using Supabase (respects RLS and cascade)
    const { error: deleteError } = await supabase
      .from('labels')
      .delete()
      .eq('id', labelId);

    if (deleteError) {
      console.error('Delete label error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete label or access denied' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Label deleted successfully' });
  } catch (error) {
    console.error('Delete label error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
