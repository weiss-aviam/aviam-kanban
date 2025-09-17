import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../../lib/supabase/server';
import { z } from 'zod';

const updateTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Template name too long').optional(),
  description: z.string().optional(),
  isPublic: z.boolean().optional(),
  isDefault: z.boolean().optional(),
  columns: z.array(z.object({
    id: z.number().optional(), // For existing columns
    title: z.string().min(1, 'Column title is required').max(120, 'Column title too long'),
    position: z.number().int().positive(),
  })).min(1, 'At least one column is required').optional(),
});

// GET /api/templates/[id] - Get a specific template
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

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    // Get the template with its columns
    const { data: template, error: templateError } = await supabase
      .from('column_templates')
      .select(`
        id,
        name,
        description,
        is_default,
        is_public,
        owner_id,
        created_at,
        template_columns (
          id,
          title,
          position
        )
      `)
      .eq('id', templateId)
      .single();

    if (templateError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    // Transform the response to match expected format
    const transformedTemplate = {
      id: template.id,
      name: template.name,
      description: template.description,
      isDefault: template.is_default,
      isPublic: template.is_public,
      isOwner: template.owner_id === user.id,
      createdAt: template.created_at,
      columns: template.template_columns
        .sort((a, b) => a.position - b.position)
        .map(col => ({
          id: col.id,
          title: col.title,
          position: col.position,
        })),
    };

    return NextResponse.json({ template: transformedTemplate });
  } catch (error) {
    console.error('Get template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH /api/templates/[id] - Update a template
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, isPublic, isDefault, columns } = validation.data;

    // Check if template exists and user owns it
    const { data: existingTemplate, error: checkError } = await supabase
      .from('column_templates')
      .select('id, owner_id')
      .eq('id', templateId)
      .single();

    if (checkError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (existingTemplate.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Update template metadata
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isPublic !== undefined) updateData.is_public = isPublic;
    if (isDefault !== undefined) updateData.is_default = isDefault;

    if (Object.keys(updateData).length > 0) {
      const { error: updateError } = await supabase
        .from('column_templates')
        .update(updateData)
        .eq('id', templateId);

      if (updateError) {
        console.error('Update template error:', updateError);
        return NextResponse.json(
          { error: 'Failed to update template' },
          { status: 500 }
        );
      }
    }

    // Update columns if provided
    if (columns) {
      // Delete existing columns
      const { error: deleteError } = await supabase
        .from('template_columns')
        .delete()
        .eq('template_id', templateId);

      if (deleteError) {
        console.error('Delete template columns error:', deleteError);
        return NextResponse.json(
          { error: 'Failed to update template columns' },
          { status: 500 }
        );
      }

      // Insert new columns
      const templateColumns = columns.map(col => ({
        template_id: templateId,
        title: col.title,
        position: col.position,
      }));

      const { error: insertError } = await supabase
        .from('template_columns')
        .insert(templateColumns);

      if (insertError) {
        console.error('Insert template columns error:', insertError);
        return NextResponse.json(
          { error: 'Failed to update template columns' },
          { status: 500 }
        );
      }
    }

    // Get the updated template
    const { data: updatedTemplate, error: getError } = await supabase
      .from('column_templates')
      .select(`
        id,
        name,
        description,
        is_default,
        is_public,
        owner_id,
        created_at,
        template_columns (
          id,
          title,
          position
        )
      `)
      .eq('id', templateId)
      .single();

    if (getError || !updatedTemplate) {
      return NextResponse.json(
        { error: 'Failed to fetch updated template' },
        { status: 500 }
      );
    }

    // Transform the response
    const transformedTemplate = {
      id: updatedTemplate.id,
      name: updatedTemplate.name,
      description: updatedTemplate.description,
      isDefault: updatedTemplate.is_default,
      isPublic: updatedTemplate.is_public,
      isOwner: true,
      createdAt: updatedTemplate.created_at,
      columns: updatedTemplate.template_columns
        .sort((a, b) => a.position - b.position)
        .map(col => ({
          id: col.id,
          title: col.title,
          position: col.position,
        })),
    };

    return NextResponse.json({ template: transformedTemplate });
  } catch (error) {
    console.error('Update template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE /api/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const templateId = parseInt(id);
    if (isNaN(templateId)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    // Check if template exists and user owns it
    const { data: existingTemplate, error: checkError } = await supabase
      .from('column_templates')
      .select('id, owner_id, is_default')
      .eq('id', templateId)
      .single();

    if (checkError || !existingTemplate) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (existingTemplate.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // Prevent deletion of default templates
    if (existingTemplate.is_default) {
      return NextResponse.json(
        { error: 'Cannot delete default template' },
        { status: 400 }
      );
    }

    // Delete the template (columns will be deleted automatically due to CASCADE)
    const { error: deleteError } = await supabase
      .from('column_templates')
      .delete()
      .eq('id', templateId);

    if (deleteError) {
      console.error('Delete template error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ message: 'Template deleted successfully' });
  } catch (error) {
    console.error('Delete template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
