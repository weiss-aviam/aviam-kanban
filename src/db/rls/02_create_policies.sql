-- Row Level Security Policies
-- This script should be executed in the Supabase SQL editor after enabling RLS

-- Helper function to check if user is a board member with specific role
CREATE OR REPLACE FUNCTION is_board_member(user_id TEXT, board_id INTEGER, min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    role_hierarchy INTEGER;
    min_role_hierarchy INTEGER;
BEGIN
    -- Get user's role for the board
    SELECT role INTO user_role
    FROM board_members
    WHERE board_members.user_id = is_board_member.user_id
    AND board_members.board_id = is_board_member.board_id;
    
    -- If no membership found, return false
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Define role hierarchy (higher number = more permissions)
    role_hierarchy := CASE user_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    min_role_hierarchy := CASE min_role
        WHEN 'owner' THEN 4
        WHEN 'admin' THEN 3
        WHEN 'member' THEN 2
        WHEN 'viewer' THEN 1
        ELSE 0
    END;
    
    RETURN role_hierarchy >= min_role_hierarchy;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- USERS TABLE POLICIES
-- Users can read their own profile and profiles of users in shared boards
CREATE POLICY "Users can read own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can read profiles of board members" ON users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM board_members bm1
            JOIN board_members bm2 ON bm1.board_id = bm2.board_id
            WHERE bm1.user_id = auth.uid()
            AND bm2.user_id = users.id
        )
    );

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- Users can insert their own profile (for profile sync)
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- BOARDS TABLE POLICIES
-- Users can read boards they are members of
CREATE POLICY "Users can read boards they are members of" ON boards
    FOR SELECT USING (
        is_board_member(auth.uid(), id, 'viewer')
    );

-- Users can create boards (they become the owner)
CREATE POLICY "Users can create boards" ON boards
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Only board owners can update boards
CREATE POLICY "Board owners can update boards" ON boards
    FOR UPDATE USING (
        is_board_member(auth.uid(), id, 'owner')
    );

-- Only board owners can delete boards
CREATE POLICY "Board owners can delete boards" ON boards
    FOR DELETE USING (
        is_board_member(auth.uid(), id, 'owner')
    );

-- BOARD_MEMBERS TABLE POLICIES
-- Users can read memberships for boards they are members of
CREATE POLICY "Users can read board memberships" ON board_members
    FOR SELECT USING (
        is_board_member(auth.uid(), board_id, 'viewer')
    );

-- Board owners and admins can manage memberships
CREATE POLICY "Board owners and admins can manage memberships" ON board_members
    FOR ALL USING (
        is_board_member(auth.uid(), board_id, 'admin')
    );

-- COLUMNS TABLE POLICIES
-- Users can read columns for boards they are members of
CREATE POLICY "Users can read columns" ON columns
    FOR SELECT USING (
        is_board_member(auth.uid(), board_id, 'viewer')
    );

-- Board members and above can create columns
CREATE POLICY "Board members can create columns" ON columns
    FOR INSERT WITH CHECK (
        is_board_member(auth.uid(), board_id, 'member')
    );

-- Board members and above can update columns
CREATE POLICY "Board members can update columns" ON columns
    FOR UPDATE USING (
        is_board_member(auth.uid(), board_id, 'member')
    );

-- Board admins and above can delete columns
CREATE POLICY "Board admins can delete columns" ON columns
    FOR DELETE USING (
        is_board_member(auth.uid(), board_id, 'admin')
    );

-- CARDS TABLE POLICIES
-- Users can read cards for boards they are members of
CREATE POLICY "Users can read cards" ON cards
    FOR SELECT USING (
        is_board_member(auth.uid(), board_id, 'viewer')
    );

-- Board members and above can create cards
CREATE POLICY "Board members can create cards" ON cards
    FOR INSERT WITH CHECK (
        is_board_member(auth.uid(), board_id, 'member')
    );

-- Board members can update cards, or users can update cards they created
CREATE POLICY "Board members can update cards" ON cards
    FOR UPDATE USING (
        is_board_member(auth.uid(), board_id, 'member')
    );

-- Board admins and above can delete any card, or users can delete cards they created
CREATE POLICY "Board admins can delete cards" ON cards
    FOR DELETE USING (
        is_board_member(auth.uid(), board_id, 'admin')
    );

-- LABELS TABLE POLICIES
-- Users can read labels for boards they are members of
CREATE POLICY "Users can read labels" ON labels
    FOR SELECT USING (
        is_board_member(auth.uid(), board_id, 'viewer')
    );

-- Board members and above can create labels
CREATE POLICY "Board members can create labels" ON labels
    FOR INSERT WITH CHECK (
        is_board_member(auth.uid(), board_id, 'member')
    );

-- Board members and above can update labels
CREATE POLICY "Board members can update labels" ON labels
    FOR UPDATE USING (
        is_board_member(auth.uid(), board_id, 'member')
    );

-- Board admins and above can delete labels
CREATE POLICY "Board admins can delete labels" ON labels
    FOR DELETE USING (
        is_board_member(auth.uid(), board_id, 'admin')
    );

-- CARD_LABELS TABLE POLICIES
-- Users can read card labels for boards they are members of
CREATE POLICY "Users can read card labels" ON card_labels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = card_labels.card_id
            AND is_board_member(auth.uid(), cards.board_id, 'viewer')
        )
    );

-- Board members and above can manage card labels
CREATE POLICY "Board members can manage card labels" ON card_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = card_labels.card_id
            AND is_board_member(auth.uid(), cards.board_id, 'member')
        )
    );

-- COMMENTS TABLE POLICIES
-- Users can read comments for boards they are members of
CREATE POLICY "Users can read comments" ON comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid(), cards.board_id, 'viewer')
        )
    );

-- Board members and above can create comments
CREATE POLICY "Board members can create comments" ON comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid(), cards.board_id, 'member')
        )
        AND auth.uid() = author_id
    );

-- Users can update their own comments if they are board members
CREATE POLICY "Users can update own comments" ON comments
    FOR UPDATE USING (
        auth.uid() = author_id
        AND EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid(), cards.board_id, 'member')
        )
    );

-- Users can delete their own comments, or board admins can delete any comment
CREATE POLICY "Users can delete own comments or admins can delete any" ON comments
    FOR DELETE USING (
        auth.uid() = author_id
        OR EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid(), cards.board_id, 'admin')
        )
    );
