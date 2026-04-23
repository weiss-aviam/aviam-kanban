-- 44_restore_lost_table_policies.sql
--
-- URGENT FOLLOW-UP TO MIGRATION 41
-- ----------------------------------------------------------------------------
-- Migration 41 enabled RLS on cards, comments, labels, card_labels,
-- column_templates and template_columns under the assumption that the
-- original policies from migrations 04 and 05 still existed in the database.
-- They do not: migration 06's `DROP TABLE … CASCADE` pattern destroyed the
-- policies along with the original tables, and the new tables created by 06
-- were never re-policed. The Supabase `rls_enabled_no_policy` advisor (run
-- after applying migration 41) confirmed all six tables had zero policies.
--
-- Default-deny on these tables means every read from a user-scoped Supabase
-- client returns zero rows, breaking board/card/comment/label/template UIs
-- for non-service-role callers.
--
-- This migration restores the exact policy set from migration 05 (cards,
-- comments, labels, card_labels) and migration 04 (column_templates,
-- template_columns). Idempotent: each policy is dropped first so the
-- migration is safe to re-apply.
--
-- api_idempotency_keys and _drizzle_migrations are intentionally left at
-- default-deny — they are internal tables only ever accessed via the
-- service-role admin client, which bypasses RLS by design.

-- ---------------------------------------------------------------------------
-- cards
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read cards" ON cards;
CREATE POLICY "Users can read cards" ON cards
    FOR SELECT USING (is_board_member(auth.uid()::text, board_id::text, 'viewer'));

DROP POLICY IF EXISTS "Board members can create cards" ON cards;
CREATE POLICY "Board members can create cards" ON cards
    FOR INSERT WITH CHECK (is_board_member(auth.uid()::text, board_id::text, 'member'));

DROP POLICY IF EXISTS "Board members can update cards" ON cards;
CREATE POLICY "Board members can update cards" ON cards
    FOR UPDATE USING (is_board_member(auth.uid()::text, board_id::text, 'member'));

DROP POLICY IF EXISTS "Board admins can delete cards" ON cards;
CREATE POLICY "Board admins can delete cards" ON cards
    FOR DELETE USING (is_board_member(auth.uid()::text, board_id::text, 'admin'));

-- ---------------------------------------------------------------------------
-- labels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read labels" ON labels;
CREATE POLICY "Users can read labels" ON labels
    FOR SELECT USING (is_board_member(auth.uid()::text, board_id::text, 'viewer'));

DROP POLICY IF EXISTS "Board members can manage labels" ON labels;
CREATE POLICY "Board members can manage labels" ON labels
    FOR ALL USING (is_board_member(auth.uid()::text, board_id::text, 'member'));

-- ---------------------------------------------------------------------------
-- card_labels
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read card labels" ON card_labels;
CREATE POLICY "Users can read card labels" ON card_labels
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = card_labels.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'viewer')
        )
    );

DROP POLICY IF EXISTS "Board members can manage card labels" ON card_labels;
CREATE POLICY "Board members can manage card labels" ON card_labels
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = card_labels.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'member')
        )
    );

-- ---------------------------------------------------------------------------
-- comments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read comments" ON comments;
CREATE POLICY "Users can read comments" ON comments
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'viewer')
        )
    );

DROP POLICY IF EXISTS "Board members can create comments" ON comments;
CREATE POLICY "Board members can create comments" ON comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'member')
        )
    );

DROP POLICY IF EXISTS "Comment authors can update their comments" ON comments;
CREATE POLICY "Comment authors can update their comments" ON comments
    FOR UPDATE USING (author_id = auth.uid()::text);

DROP POLICY IF EXISTS "Comment authors and board admins can delete comments" ON comments;
CREATE POLICY "Comment authors and board admins can delete comments" ON comments
    FOR DELETE USING (
        author_id = auth.uid()::text OR
        EXISTS (
            SELECT 1 FROM cards
            WHERE cards.id = comments.card_id
            AND is_board_member(auth.uid()::text, cards.board_id::text, 'admin')
        )
    );

-- ---------------------------------------------------------------------------
-- column_templates  (from migration 04)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read own and public templates" ON column_templates;
CREATE POLICY "Users can read own and public templates" ON column_templates
    FOR SELECT USING (
        owner_id = auth.uid()::text OR is_public = true
    );

DROP POLICY IF EXISTS "Users can create templates" ON column_templates;
CREATE POLICY "Users can create templates" ON column_templates
    FOR INSERT WITH CHECK (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Users can update own templates" ON column_templates;
CREATE POLICY "Users can update own templates" ON column_templates
    FOR UPDATE USING (auth.uid()::text = owner_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON column_templates;
CREATE POLICY "Users can delete own templates" ON column_templates
    FOR DELETE USING (auth.uid()::text = owner_id);

-- ---------------------------------------------------------------------------
-- template_columns  (from migration 04)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read template columns" ON template_columns;
CREATE POLICY "Users can read template columns" ON template_columns
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM column_templates
            WHERE column_templates.id = template_columns.template_id
            AND (column_templates.owner_id = auth.uid()::text OR column_templates.is_public = true)
        )
    );

DROP POLICY IF EXISTS "Users can manage own template columns" ON template_columns;
CREATE POLICY "Users can manage own template columns" ON template_columns
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM column_templates
            WHERE column_templates.id = template_columns.template_id
            AND column_templates.owner_id = auth.uid()::text
        )
    );
