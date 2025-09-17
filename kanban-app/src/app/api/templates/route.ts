import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '../../../lib/supabase/server';
import { z } from 'zod';

const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100, 'Template name too long'),
  description: z.string().optional(),
  isPublic: z.boolean().default(false),
  columns: z.array(z.object({
    title: z.string().min(1, 'Column title is required').max(120, 'Column title too long'),
    position: z.number().int().positive(),
  })).min(1, 'At least one column is required'),
});

// GET /api/templates - Get all available templates for the current user
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get templates (user's own templates + public templates) with their columns
    const { data: templates, error: templatesError } = await supabase
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
      .order('is_default', { ascending: false })
      .order('name');

    if (templatesError) {
      console.error('Get templates error:', templatesError);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    // Transform the response to match expected format
    const transformedTemplates = templates.map(template => ({
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
    }));

    return NextResponse.json({ templates: transformedTemplates });
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST /api/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createTemplateSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, description, isPublic, columns } = validation.data;

    // Create the template
    const { data: newTemplate, error: templateError } = await supabase
      .from('column_templates')
      .insert({
        name,
        description: description || null,
        owner_id: user.id,
        is_public: isPublic,
        is_default: false, // Only admins can set default templates
      })
      .select()
      .single();

    if (templateError) {
      console.error('Create template error:', templateError);
      return NextResponse.json(
        { error: 'Failed to create template' },
        { status: 500 }
      );
    }

    // Create the template columns
    const templateColumns = columns.map(col => ({
      template_id: newTemplate.id,
      title: col.title,
      position: col.position,
    }));

    const { data: newColumns, error: columnsError } = await supabase
      .from('template_columns')
      .insert(templateColumns)
      .select();

    if (columnsError) {
      console.error('Create template columns error:', columnsError);
      // Clean up the template if columns creation failed
      await supabase.from('column_templates').delete().eq('id', newTemplate.id);
      return NextResponse.json(
        { error: 'Failed to create template columns' },
        { status: 500 }
      );
    }

    // Transform response to match expected format
    const transformedTemplate = {
      id: newTemplate.id,
      name: newTemplate.name,
      description: newTemplate.description,
      isDefault: newTemplate.is_default,
      isPublic: newTemplate.is_public,
      isOwner: true,
      createdAt: newTemplate.created_at,
      columns: newColumns
        .sort((a, b) => a.position - b.position)
        .map(col => ({
          id: col.id,
          title: col.title,
          position: col.position,
        })),
    };

    return NextResponse.json({ template: transformedTemplate }, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
