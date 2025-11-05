-- Add column templates functionality
-- This migration adds support for column templates that can be used when creating boards

-- Column templates table
CREATE TABLE column_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Template columns table - stores the column configuration for each template
CREATE TABLE template_columns (
    id SERIAL PRIMARY KEY,
    template_id INTEGER NOT NULL REFERENCES column_templates(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_column_templates_owner_id ON column_templates(owner_id);
CREATE INDEX idx_column_templates_is_default ON column_templates(is_default);
CREATE INDEX idx_column_templates_is_public ON column_templates(is_public);
CREATE INDEX idx_template_columns_template_id ON template_columns(template_id);
CREATE INDEX idx_template_columns_position ON template_columns(template_id, position);

-- Enable RLS on new tables
ALTER TABLE column_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_columns ENABLE ROW LEVEL SECURITY;

-- RLS policies for column_templates
-- Users can read their own templates and public templates
CREATE POLICY "Users can read own and public templates" ON column_templates
    FOR SELECT USING (
        owner_id = auth.uid()::text OR is_public = true
    );

-- Users can create their own templates
CREATE POLICY "Users can create templates" ON column_templates
    FOR INSERT WITH CHECK (auth.uid()::text = owner_id);

-- Users can update their own templates
CREATE POLICY "Users can update own templates" ON column_templates
    FOR UPDATE USING (auth.uid()::text = owner_id);

-- Users can delete their own templates
CREATE POLICY "Users can delete own templates" ON column_templates
    FOR DELETE USING (auth.uid()::text = owner_id);

-- RLS policies for template_columns
-- Users can read template columns if they can read the template
CREATE POLICY "Users can read template columns" ON template_columns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM column_templates 
            WHERE column_templates.id = template_columns.template_id 
            AND (column_templates.owner_id = auth.uid()::text OR column_templates.is_public = true)
        )
    );

-- Users can manage template columns for their own templates
CREATE POLICY "Users can manage own template columns" ON template_columns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM column_templates 
            WHERE column_templates.id = template_columns.template_id 
            AND column_templates.owner_id = auth.uid()::text
        )
    );

-- Create some default templates
INSERT INTO column_templates (name, description, owner_id, is_default, is_public) VALUES
('Basic Kanban', 'Simple three-column kanban board', (SELECT id FROM users LIMIT 1), true, true),
('Software Development', 'Columns for software development workflow', (SELECT id FROM users LIMIT 1), false, true),
('Project Management', 'Comprehensive project management columns', (SELECT id FROM users LIMIT 1), false, true);

-- Insert template columns for Basic Kanban
INSERT INTO template_columns (template_id, title, position) VALUES
((SELECT id FROM column_templates WHERE name = 'Basic Kanban'), 'To Do', 1),
((SELECT id FROM column_templates WHERE name = 'Basic Kanban'), 'In Progress', 2),
((SELECT id FROM column_templates WHERE name = 'Basic Kanban'), 'Done', 3);

-- Insert template columns for Software Development
INSERT INTO template_columns (template_id, title, position) VALUES
((SELECT id FROM column_templates WHERE name = 'Software Development'), 'Backlog', 1),
((SELECT id FROM column_templates WHERE name = 'Software Development'), 'To Do', 2),
((SELECT id FROM column_templates WHERE name = 'Software Development'), 'In Progress', 3),
((SELECT id FROM column_templates WHERE name = 'Software Development'), 'Code Review', 4),
((SELECT id FROM column_templates WHERE name = 'Software Development'), 'Testing', 5),
((SELECT id FROM column_templates WHERE name = 'Software Development'), 'Done', 6);

-- Insert template columns for Project Management
INSERT INTO template_columns (template_id, title, position) VALUES
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'Ideas', 1),
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'Planning', 2),
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'In Progress', 3),
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'Review', 4),
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'Testing', 5),
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'Completed', 6),
((SELECT id FROM column_templates WHERE name = 'Project Management'), 'Archive', 7);

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE column_templates;
ALTER PUBLICATION supabase_realtime ADD TABLE template_columns;
