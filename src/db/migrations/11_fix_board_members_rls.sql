-- Fix board_members RLS: allow any board member (not just the owner or
-- the row's own user) to read all memberships for boards they belong to.
-- The old policy only let users see their own row OR the owner to see all,
-- which caused the assignee selector to show no other users.

DROP POLICY IF EXISTS "Users can read board memberships" ON board_members;

CREATE POLICY "Board members can read all memberships for their boards"
  ON board_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members bm
      WHERE bm.board_id = board_members.board_id
        AND bm.user_id = auth.uid()::text
    )
  );
