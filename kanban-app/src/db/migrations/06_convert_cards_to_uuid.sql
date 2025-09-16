-- Convert cards, labels, and related tables to use UUID instead of serial ID
-- This migration changes card and label IDs from integers to UUIDs for better security and scalability

-- Step 1: Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create new cards table with UUID
CREATE TABLE cards_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 3: Create new labels table with UUID
CREATE TABLE labels_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6b7280',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 4: Create mapping tables to track old ID -> new UUID mappings
CREATE TABLE card_id_mapping (
    old_id INTEGER,
    new_id UUID
);

CREATE TABLE label_id_mapping (
    old_id INTEGER,
    new_id UUID
);

-- Step 5: Migrate existing cards data (if any exists)
DO $$
DECLARE
    card_record RECORD;
    new_card_id UUID;
BEGIN
    -- Only proceed if the old cards table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cards') THEN
        FOR card_record IN SELECT * FROM cards LOOP
            -- Generate new UUID for this card
            new_card_id := uuid_generate_v4();
            
            -- Insert into new table
            INSERT INTO cards_new (id, board_id, column_id, title, description, assignee_id, due_date, position, created_at)
            VALUES (new_card_id, card_record.board_id, card_record.column_id, card_record.title, 
                   card_record.description, card_record.assignee_id, card_record.due_date, 
                   card_record.position, card_record.created_at);
            
            -- Store mapping
            INSERT INTO card_id_mapping (old_id, new_id) VALUES (card_record.id, new_card_id);
        END LOOP;
    END IF;
END $$;

-- Step 6: Migrate existing labels data (if any exists)
DO $$
DECLARE
    label_record RECORD;
    new_label_id UUID;
BEGIN
    -- Only proceed if the old labels table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'labels') THEN
        FOR label_record IN SELECT * FROM labels LOOP
            -- Generate new UUID for this label
            new_label_id := uuid_generate_v4();
            
            -- Insert into new table
            INSERT INTO labels_new (id, board_id, name, color, created_at)
            VALUES (new_label_id, label_record.board_id, label_record.name, 
                   label_record.color, label_record.created_at);
            
            -- Store mapping
            INSERT INTO label_id_mapping (old_id, new_id) VALUES (label_record.id, new_label_id);
        END LOOP;
    END IF;
END $$;

-- Step 7: Create new card_labels table with UUID references
CREATE TABLE card_labels_new (
    card_id UUID NOT NULL REFERENCES cards_new(id) ON DELETE CASCADE,
    label_id UUID NOT NULL REFERENCES labels_new(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, label_id)
);

-- Step 8: Migrate card_labels data using the mappings (if any exists)
DO $$
DECLARE
    card_label_record RECORD;
    new_card_id UUID;
    new_label_id UUID;
BEGIN
    -- Only proceed if the old card_labels table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'card_labels') THEN
        FOR card_label_record IN SELECT * FROM card_labels LOOP
            -- Get new UUIDs from mappings
            SELECT new_id INTO new_card_id FROM card_id_mapping WHERE old_id = card_label_record.card_id;
            SELECT new_id INTO new_label_id FROM label_id_mapping WHERE old_id = card_label_record.label_id;
            
            -- Only insert if both mappings exist
            IF new_card_id IS NOT NULL AND new_label_id IS NOT NULL THEN
                INSERT INTO card_labels_new (card_id, label_id, created_at)
                VALUES (new_card_id, new_label_id, card_label_record.created_at);
            END IF;
        END LOOP;
    END IF;
END $$;

-- Step 9: Create new comments table with UUID references
CREATE TABLE comments_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    card_id UUID NOT NULL REFERENCES cards_new(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 10: Migrate comments data using the card mappings (if any exists)
DO $$
DECLARE
    comment_record RECORD;
    new_card_id UUID;
BEGIN
    -- Only proceed if the old comments table exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comments') THEN
        FOR comment_record IN SELECT * FROM comments LOOP
            -- Get new card UUID from mapping
            SELECT new_id INTO new_card_id FROM card_id_mapping WHERE old_id = comment_record.card_id;
            
            -- Only insert if mapping exists
            IF new_card_id IS NOT NULL THEN
                INSERT INTO comments_new (id, card_id, author_id, body, created_at)
                VALUES (uuid_generate_v4(), new_card_id, comment_record.author_id, 
                       comment_record.body, comment_record.created_at);
            END IF;
        END LOOP;
    END IF;
END $$;

-- Step 11: Drop old tables and rename new ones
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS card_labels CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS labels CASCADE;

-- Rename new tables
ALTER TABLE cards_new RENAME TO cards;
ALTER TABLE labels_new RENAME TO labels;
ALTER TABLE card_labels_new RENAME TO card_labels;
ALTER TABLE comments_new RENAME TO comments;

-- Step 12: Clean up mapping tables
DROP TABLE card_id_mapping;
DROP TABLE label_id_mapping;

-- Step 13: Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id);
CREATE INDEX IF NOT EXISTS idx_cards_assignee_id ON cards(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cards_position ON cards(column_id, position);
CREATE INDEX IF NOT EXISTS idx_labels_board_id ON labels(board_id);
CREATE INDEX IF NOT EXISTS idx_card_labels_card_id ON card_labels(card_id);
CREATE INDEX IF NOT EXISTS idx_card_labels_label_id ON card_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_comments_card_id ON comments(card_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);

-- Step 14: Update column templates to use UUIDs
CREATE TABLE column_templates_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE template_columns_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES column_templates_new(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Migrate template data if exists
DO $$
DECLARE
    template_record RECORD;
    template_column_record RECORD;
    new_template_id UUID;
    template_mapping RECORD;
BEGIN
    -- Create temporary mapping table
    CREATE TEMP TABLE temp_template_mapping (old_id INTEGER, new_id UUID);
    
    -- Migrate column templates
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'column_templates') THEN
        FOR template_record IN SELECT * FROM column_templates LOOP
            new_template_id := uuid_generate_v4();
            
            INSERT INTO column_templates_new (id, name, description, owner_id, is_default, is_public, created_at)
            VALUES (new_template_id, template_record.name, template_record.description, 
                   template_record.owner_id, template_record.is_default, template_record.is_public, 
                   template_record.created_at);
            
            INSERT INTO temp_template_mapping (old_id, new_id) VALUES (template_record.id, new_template_id);
        END LOOP;
    END IF;
    
    -- Migrate template columns
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'template_columns') THEN
        FOR template_column_record IN SELECT * FROM template_columns LOOP
            SELECT new_id INTO new_template_id FROM temp_template_mapping WHERE old_id = template_column_record.template_id;
            
            IF new_template_id IS NOT NULL THEN
                INSERT INTO template_columns_new (id, template_id, title, position, created_at)
                VALUES (uuid_generate_v4(), new_template_id, template_column_record.title, 
                       template_column_record.position, template_column_record.created_at);
            END IF;
        END LOOP;
    END IF;
END $$;

-- Drop old template tables and rename new ones
DROP TABLE IF EXISTS template_columns CASCADE;
DROP TABLE IF EXISTS column_templates CASCADE;

ALTER TABLE column_templates_new RENAME TO column_templates;
ALTER TABLE template_columns_new RENAME TO template_columns;

-- Create template indexes
CREATE INDEX IF NOT EXISTS idx_column_templates_owner_id ON column_templates(owner_id);
CREATE INDEX IF NOT EXISTS idx_template_columns_template_id ON template_columns(template_id);
CREATE INDEX IF NOT EXISTS idx_template_columns_position ON template_columns(template_id, position);
