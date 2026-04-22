-- Migration 39: Close two RLS gaps surfaced by the security audit.
--
-- 1. public.columns had RLS DISABLED entirely, so anyone with the anon key
--    could read every column on every board via the auto-exposed PostgREST
--    endpoint. Enable RLS and gate access on board membership, mirroring the
--    cards/labels pattern from migration 05.
-- 2. public.card_subtasks had SELECT/INSERT/UPDATE policies but no DELETE
--    policy, so legitimate DELETEs through the user-scoped Supabase client
--    silently no-op'd. Add an admin-or-non-viewer DELETE policy mirroring the
--    surrounding pattern.
--
-- Both changes are additive — no data is dropped or rewritten.

-- ============================================================
-- 1. columns table — enable RLS + role-graded policies
-- ============================================================

ALTER TABLE public.columns ENABLE ROW LEVEL SECURITY;

-- Board viewers can read columns
DROP POLICY IF EXISTS "Board members can read columns" ON public.columns;
CREATE POLICY "Board members can read columns"
  ON public.columns FOR SELECT
  USING (is_board_member(auth.uid()::text, board_id::text, 'viewer'));

-- Non-viewer members can create columns
DROP POLICY IF EXISTS "Board members can insert columns" ON public.columns;
CREATE POLICY "Board members can insert columns"
  ON public.columns FOR INSERT
  WITH CHECK (is_board_member(auth.uid()::text, board_id::text, 'member'));

-- Non-viewer members can rename / reorder columns
DROP POLICY IF EXISTS "Board members can update columns" ON public.columns;
CREATE POLICY "Board members can update columns"
  ON public.columns FOR UPDATE
  USING (is_board_member(auth.uid()::text, board_id::text, 'member'));

-- Only admins/owners can delete columns (parity with cards DELETE policy)
DROP POLICY IF EXISTS "Board admins can delete columns" ON public.columns;
CREATE POLICY "Board admins can delete columns"
  ON public.columns FOR DELETE
  USING (is_board_member(auth.uid()::text, board_id::text, 'admin'));

-- ============================================================
-- 2. card_subtasks table — add missing DELETE policy
-- ============================================================

DROP POLICY IF EXISTS "Non-viewer board members can delete subtasks" ON public.card_subtasks;
CREATE POLICY "Non-viewer board members can delete subtasks"
  ON public.card_subtasks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.board_members bm ON bm.board_id = c.board_id
      WHERE c.id = card_subtasks.card_id
        AND bm.user_id = auth.uid()::text
        AND bm.role != 'viewer'
    )
  );
