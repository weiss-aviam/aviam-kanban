-- Board groups: organize boards on the dashboard / boards overview.
-- 1:N — each board belongs to at most one group.
-- A group is visible to a user if they created it, or if at least one
-- board in the group has them as a member.
-- ON DELETE SET NULL on boards.group_id → deleting a group leaves its
-- boards intact (they fall back to the "ungrouped" section).

CREATE TABLE IF NOT EXISTS public.board_groups (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL,
  color       VARCHAR(7),
  created_by  VARCHAR      REFERENCES public.users(id) ON DELETE SET NULL,
  position    INTEGER      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS group_id        UUID REFERENCES public.board_groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS group_position  INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS boards_group_id_idx
  ON public.boards(group_id);

ALTER TABLE public.board_groups ENABLE ROW LEVEL SECURITY;

-- Visible: creator or member of any board in the group
CREATE POLICY "Members or creator can select board groups"
  ON public.board_groups FOR SELECT
  USING (
    created_by = auth.uid()::text
    OR EXISTS (
      SELECT 1 FROM public.boards b
      JOIN public.board_members bm ON bm.board_id = b.id
      WHERE b.group_id = board_groups.id
        AND bm.user_id = auth.uid()::text
    )
  );

-- Any authenticated user can create a group; created_by must equal the caller
CREATE POLICY "Authenticated users can insert board groups"
  ON public.board_groups FOR INSERT
  WITH CHECK (created_by = auth.uid()::text);

-- Only the creator can rename / recolor / reorder
CREATE POLICY "Creator can update board groups"
  ON public.board_groups FOR UPDATE
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- Only the creator can delete; boards.group_id falls back to NULL
CREATE POLICY "Creator can delete board groups"
  ON public.board_groups FOR DELETE
  USING (created_by = auth.uid()::text);
