-- Enable Row Level Security on all tables
-- This script should be executed in the Supabase SQL editor

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Enable RLS on boards table
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

-- Enable RLS on board_members table
ALTER TABLE board_members ENABLE ROW LEVEL SECURITY;

-- Enable RLS on columns table
ALTER TABLE columns ENABLE ROW LEVEL SECURITY;

-- Enable RLS on cards table
ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

-- Enable RLS on labels table
ALTER TABLE labels ENABLE ROW LEVEL SECURITY;

-- Enable RLS on card_labels table
ALTER TABLE card_labels ENABLE ROW LEVEL SECURITY;

-- Enable RLS on comments table
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
