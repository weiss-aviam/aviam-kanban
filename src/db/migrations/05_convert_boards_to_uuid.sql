-- Convert boards table to use UUID instead of serial ID
-- This migration changes board IDs from integers to UUIDs for better security and scalability

-- Step 1: Add UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 2: Create new boards table with UUID
CREATE TABLE boards_new (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(160) NOT NULL,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 3: Create new columns table with UUID board reference
CREATE TABLE columns_new (
    id SERIAL PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES boards_new(id) ON DELETE CASCADE,
    title VARCHAR(120) NOT NULL,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 4: Create new cards table with UUID board reference
CREATE TABLE cards_new (
    id SERIAL PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES boards_new(id) ON DELETE CASCADE,
    column_id INTEGER NOT NULL REFERENCES columns_new(id) ON DELETE CASCADE,
    title VARCHAR(160) NOT NULL,
    description TEXT,
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    due_date TIMESTAMP WITH TIME ZONE,
    position INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 5: Create new board_members table with UUID board reference
CREATE TABLE board_members_new (
    board_id UUID NOT NULL REFERENCES boards_new(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR CHECK (role IN ('owner', 'admin', 'member', 'viewer')) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (board_id, user_id)
);

-- Step 6: Create new labels table with UUID board reference
CREATE TABLE labels_new (
    id SERIAL PRIMARY KEY,
    board_id UUID NOT NULL REFERENCES boards_new(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL,
    color VARCHAR(7) DEFAULT '#6b7280',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 7: Create new card_labels table
CREATE TABLE card_labels_new (
    card_id INTEGER NOT NULL REFERENCES cards_new(id) ON DELETE CASCADE,
    label_id INTEGER NOT NULL REFERENCES labels_new(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (card_id, label_id)
);

-- Step 8: Create new comments table
CREATE TABLE comments_new (
    id SERIAL PRIMARY KEY,
    card_id INTEGER NOT NULL REFERENCES cards_new(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Step 9: Migrate data from old tables to new tables
-- First, migrate boards and create UUID mapping
INSERT INTO boards_new (id, name, owner_id, is_archived, created_at)
SELECT uuid_generate_v4(), name, owner_id, is_archived, created_at
FROM boards;

-- Create a temporary mapping table for old ID to new UUID
CREATE TEMPORARY TABLE board_id_mapping AS
SELECT 
    old_boards.id as old_id,
    new_boards.id as new_id
FROM boards old_boards
JOIN boards_new new_boards ON (
    old_boards.name = new_boards.name 
    AND old_boards.owner_id = new_boards.owner_id 
    AND old_boards.created_at = new_boards.created_at
);

-- Migrate board_members
INSERT INTO board_members_new (board_id, user_id, role, created_at)
SELECT mapping.new_id, bm.user_id, bm.role, bm.created_at
FROM board_members bm
JOIN board_id_mapping mapping ON bm.board_id = mapping.old_id;

-- Migrate columns
INSERT INTO columns_new (id, board_id, title, position, created_at)
SELECT c.id, mapping.new_id, c.title, c.position, c.created_at
FROM columns c
JOIN board_id_mapping mapping ON c.board_id = mapping.old_id;

-- Migrate labels
INSERT INTO labels_new (id, board_id, name, color, created_at)
SELECT l.id, mapping.new_id, l.name, l.color, l.created_at
FROM labels l
JOIN board_id_mapping mapping ON l.board_id = mapping.old_id;

-- Migrate cards
INSERT INTO cards_new (id, board_id, column_id, title, description, assignee_id, due_date, position, created_at)
SELECT c.id, mapping.new_id, c.column_id, c.title, c.description, c.assignee_id, c.due_date, c.position, c.created_at
FROM cards c
JOIN board_id_mapping mapping ON c.board_id = mapping.old_id;

-- Migrate card_labels
INSERT INTO card_labels_new (card_id, label_id, created_at)
SELECT card_id, label_id, created_at
FROM card_labels;

-- Migrate comments
INSERT INTO comments_new (id, card_id, author_id, body, created_at)
SELECT id, card_id, author_id, body, created_at
FROM comments;

-- Step 10: Drop old tables and rename new ones
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS card_labels CASCADE;
DROP TABLE IF EXISTS cards CASCADE;
DROP TABLE IF EXISTS labels CASCADE;
DROP TABLE IF EXISTS columns CASCADE;
DROP TABLE IF EXISTS board_members CASCADE;
DROP TABLE IF EXISTS boards CASCADE;

-- Rename new tables
ALTER TABLE boards_new RENAME TO boards;
ALTER TABLE columns_new RENAME TO columns;
ALTER TABLE cards_new RENAME TO cards;
ALTER TABLE board_members_new RENAME TO board_members;
ALTER TABLE labels_new RENAME TO labels;
ALTER TABLE card_labels_new RENAME TO card_labels;
ALTER TABLE comments_new RENAME TO comments;

-- Step 11: Recreate indexes
CREATE INDEX idx_boards_owner_id ON boards(owner_id);
CREATE INDEX idx_boards_created_at ON boards(created_at);
CREATE INDEX idx_columns_board_id ON columns(board_id);
CREATE INDEX idx_columns_position ON columns(board_id, position);
CREATE INDEX idx_cards_board_id ON cards(board_id);
CREATE INDEX idx_cards_column_id ON cards(column_id);
CREATE INDEX idx_cards_position ON cards(column_id, position);
CREATE INDEX idx_cards_assignee_id ON cards(assignee_id);
CREATE INDEX idx_board_members_board_id ON board_members(board_id);
CREATE INDEX idx_board_members_user_id ON board_members(user_id);
CREATE INDEX idx_labels_board_id ON labels(board_id);
CREATE INDEX idx_card_labels_card_id ON card_labels(card_id);
CREATE INDEX idx_card_labels_label_id ON card_labels(label_id);
CREATE INDEX idx_comments_card_id ON comments(card_id);
CREATE INDEX idx_comments_author_id ON comments(author_id);

-- Step 12: Enable RLS on all tables
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
-- columns RLS is already enabled
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Step 13: Recreate RLS policies for new UUID structure
-- Boards policies
CREATE POLICY "Users can read boards they are members of" ON boards
    FOR SELECT USING (
        owner_id = auth.uid()::text OR
        is_board_member(auth.uid()::text, id::text, 'viewer')
    );

CREATE POLICY "Users can create boards" ON boards
    FOR INSERT WITH CHECK (auth.uid()::text = owner_id);

CREATE POLICY "Board owners can update boards" ON boards
    FOR UPDATE USING (owner_id = auth.uid()::text);

CREATE POLICY "Board owners can delete boards" ON boards
    FOR DELETE USING (owner_id = auth.uid()::text);

-- Board members policies
CREATE POLICY "Users can read board memberships" ON board_members
    FOR SELECT USING (
        user_id = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM boards
            WHERE boards.id = board_members.board_id
            AND boards.owner_id = auth.uid()::text
        )
    );

CREATE POLICY "Board owners and admins can manage memberships" ON board_members
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM boards
            WHERE boards.id = board_members.board_id
            AND (boards.owner_id = auth.uid()::text OR is_board_member(auth.uid()::text, boards.id::text, 'admin'))
        )
    );

-- Cards policies
CREATE POLICY "Users can read cards" ON cards
    FOR SELECT USING (is_board_member(auth.uid()::text, board_id::text, 'viewer'));

CREATE POLICY "Board members can create cards" ON cards
    FOR INSERT WITH CHECK (is_board_member(auth.uid()::text, board_id::text, 'member'));

CREATE POLICY "Board members can update cards" ON cards
    FOR UPDATE USING (is_board_member(auth.uid()::text, board_id::text, 'member'));

CREATE POLICY "Board admins can delete cards" ON cards
    FOR DELETE USING (is_board_member(auth.uid()::text, board_id::text, 'admin'));

-- Labels policies
CREATE POLICY "Users can read labels" ON labels
    FOR SELECT USING (is_board_member(auth.uid()::text, board_id::text, 'viewer'));

CREATE POLICY "Board members can manage labels" ON labels
    FOR ALL USING (is_board_member(auth.uid()::text, board_id::text, 'member'));

-- Card labels policies
CREATE POLICY "Users can read card labels" ON card_labels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = card_labels.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'viewer')
        )
    );

CREATE POLICY "Board members can manage card labels" ON card_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = card_labels.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'member')
        )
    );

-- Comments policies
CREATE POLICY "Users can read comments" ON comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'viewer')
        )
    );

CREATE POLICY "Board members can create comments" ON comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'member')
        )
    );

CREATE POLICY "Comment authors can update their comments" ON comments
    FOR UPDATE USING (author_id = auth.uid()::text);

CREATE POLICY "Comment authors and board admins can delete comments" ON comments
    FOR DELETE USING (
        author_id = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'admin')
        )
    );

-- Step 14: Update is_board_member function to handle UUID board IDs
DROP FUNCTION IF EXISTS is_board_member(text, integer, text);
DROP FUNCTION IF EXISTS is_board_member(text, text, text);

CREATE OR REPLACE FUNCTION is_board_member(user_id text, board_id text, min_role text)
RETURNS boolean AS $$
DECLARE
    user_role text;
    role_hierarchy text[] := ARRAY['viewer', 'member', 'admin', 'owner'];
    min_role_level int;
    user_role_level int;
BEGIN
    -- Get user's role for this board
    SELECT role INTO user_role
    FROM board_members
    WHERE board_members.user_id = is_board_member.user_id
    AND board_members.board_id = is_board_member.board_id::uuid;

    -- If user is not a member, check if they're the owner
    IF user_role IS NULL THEN
        SELECT 'owner' INTO user_role
        FROM boards
        WHERE boards.id = is_board_member.board_id::uuid
        AND boards.owner_id = is_board_member.user_id;
    END IF;

    -- If still no role found, return false
    IF user_role IS NULL THEN
        RETURN false;
    END IF;

    -- Check if user's role meets minimum requirement
    SELECT array_position(role_hierarchy, min_role) INTO min_role_level;
    SELECT array_position(role_hierarchy, user_role) INTO user_role_level;

    RETURN user_role_level >= min_role_level;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 15: Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE boards;
ALTER PUBLICATION supabase_realtime ADD TABLE board_members;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
ALTER PUBLICATION supabase_realtime ADD TABLE labels;
ALTER PUBLICATION supabase_realtime ADD TABLE card_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
