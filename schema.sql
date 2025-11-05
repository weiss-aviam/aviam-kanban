-- Aviam Kanban Database Schema
-- Run this in your Supabase SQL Editor

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create boards table
CREATE TABLE IF NOT EXISTS boards (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create board_members table
CREATE TABLE IF NOT EXISTS board_members (
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (board_id, user_id)
);

-- Create columns table
CREATE TABLE IF NOT EXISTS columns (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create labels table
CREATE TABLE IF NOT EXISTS labels (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6'
);

-- Create cards table
CREATE TABLE IF NOT EXISTS cards (
  id SERIAL PRIMARY KEY,
  board_id INTEGER NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  column_id INTEGER NOT NULL REFERENCES columns(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create card_labels table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS card_labels (
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  label_id INTEGER NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  PRIMARY KEY (card_id, label_id)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id SERIAL PRIMARY KEY,
  card_id INTEGER NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_boards_owner_id ON boards(owner_id);
CREATE INDEX IF NOT EXISTS idx_board_members_board_id ON board_members(board_id);
CREATE INDEX IF NOT EXISTS idx_board_members_user_id ON board_members(user_id);
CREATE INDEX IF NOT EXISTS idx_columns_board_id ON columns(board_id);
CREATE INDEX IF NOT EXISTS idx_columns_position ON columns(board_id, position);
CREATE INDEX IF NOT EXISTS idx_labels_board_id ON labels(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_board_id ON cards(board_id);
CREATE INDEX IF NOT EXISTS idx_cards_column_id ON cards(column_id);
CREATE INDEX IF NOT EXISTS idx_cards_assignee_id ON cards(assignee_id);
CREATE INDEX IF NOT EXISTS idx_cards_position ON cards(column_id, position);
CREATE INDEX IF NOT EXISTS idx_card_labels_card_id ON card_labels(card_id);
CREATE INDEX IF NOT EXISTS idx_card_labels_label_id ON card_labels(label_id);
CREATE INDEX IF NOT EXISTS idx_comments_card_id ON comments(card_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);

-- Enable Row Level Security on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE card_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies

-- Users policies
CREATE POLICY "Users can view their own profile" ON users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Boards policies
CREATE POLICY "Users can view boards they are members of" ON boards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = boards.id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Board owners can update their boards" ON boards
  FOR UPDATE USING (owner_id = auth.uid());

CREATE POLICY "Board owners can delete their boards" ON boards
  FOR DELETE USING (owner_id = auth.uid());

CREATE POLICY "Authenticated users can create boards" ON boards
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Board members policies
CREATE POLICY "Users can view board members for boards they belong to" ON board_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = board_members.board_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Board owners and admins can manage members" ON board_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = board_members.board_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Columns policies
CREATE POLICY "Users can view columns for boards they belong to" ON columns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = columns.board_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can manage columns" ON columns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = columns.board_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'member')
    )
  );

-- Labels policies
CREATE POLICY "Users can view labels for boards they belong to" ON labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = labels.board_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can manage labels" ON labels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = labels.board_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'member')
    )
  );

-- Cards policies
CREATE POLICY "Users can view cards for boards they belong to" ON cards
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = cards.board_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can manage cards" ON cards
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM board_members 
      WHERE board_id = cards.board_id 
      AND user_id = auth.uid() 
      AND role IN ('owner', 'admin', 'member')
    )
  );

-- Card labels policies
CREATE POLICY "Users can view card labels for boards they belong to" ON card_labels
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN board_members bm ON bm.board_id = c.board_id
      WHERE c.id = card_labels.card_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can manage card labels" ON card_labels
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN board_members bm ON bm.board_id = c.board_id
      WHERE c.id = card_labels.card_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

-- Comments policies
CREATE POLICY "Users can view comments for boards they belong to" ON comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM cards c
      JOIN board_members bm ON bm.board_id = c.board_id
      WHERE c.id = comments.card_id AND bm.user_id = auth.uid()
    )
  );

CREATE POLICY "Board members can create comments" ON comments
  FOR INSERT WITH CHECK (
    auth.uid() = author_id AND
    EXISTS (
      SELECT 1 FROM cards c
      JOIN board_members bm ON bm.board_id = c.board_id
      WHERE c.id = comments.card_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin', 'member')
    )
  );

CREATE POLICY "Comment authors can update their comments" ON comments
  FOR UPDATE USING (author_id = auth.uid());

CREATE POLICY "Comment authors and board admins can delete comments" ON comments
  FOR DELETE USING (
    author_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM cards c
      JOIN board_members bm ON bm.board_id = c.board_id
      WHERE c.id = comments.card_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Enable Realtime for live collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE boards;
ALTER PUBLICATION supabase_realtime ADD TABLE board_members;
ALTER PUBLICATION supabase_realtime ADD TABLE columns;
ALTER PUBLICATION supabase_realtime ADD TABLE cards;
ALTER PUBLICATION supabase_realtime ADD TABLE card_labels;
ALTER PUBLICATION supabase_realtime ADD TABLE labels;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- Function to handle user profile creation/update
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'name')
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user profile
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
