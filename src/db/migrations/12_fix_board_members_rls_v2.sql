-- Replace the self-referential board_members SELECT policy from migration 11
-- with one that uses the SECURITY DEFINER is_board_member() function.
-- The self-referential EXISTS subquery in migration 11 caused the function
-- to see 0 rows, making the owner-fallback INSERT trigger and then crash
-- with a duplicate key error.

DROP POLICY IF EXISTS "Board members can read all memberships for their boards" ON board_members;

CREATE POLICY "Board members can read all memberships for their boards"
  ON board_members
  FOR SELECT USING (
    is_board_member(auth.uid()::text, board_id::text, 'viewer')
  );
