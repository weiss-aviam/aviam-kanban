-- Add card_subtasks table for per-card checklist/subtask support.
-- NULL completed_at = open task; non-null = checked/done.
-- Soft-delete via deleted_at (same pattern as comments).

CREATE TABLE IF NOT EXISTS public.card_subtasks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id     UUID        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  completed_at TIMESTAMPTZ,
  position    INTEGER     NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS card_subtasks_card_id_idx
  ON public.card_subtasks(card_id);

ALTER TABLE public.card_subtasks ENABLE ROW LEVEL SECURITY;

-- Board members can read subtasks for cards on their boards
CREATE POLICY "Board members can select subtasks"
  ON public.card_subtasks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.board_members bm ON bm.board_id = c.board_id
      WHERE c.id = card_subtasks.card_id
        AND bm.user_id = auth.uid()::text
    )
  );

-- Non-viewers can insert subtasks
CREATE POLICY "Non-viewer board members can insert subtasks"
  ON public.card_subtasks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.board_members bm ON bm.board_id = c.board_id
      WHERE c.id = card_subtasks.card_id
        AND bm.user_id = auth.uid()::text
        AND bm.role != 'viewer'
    )
  );

-- Non-viewers can update subtasks (toggle completed, rename)
CREATE POLICY "Non-viewer board members can update subtasks"
  ON public.card_subtasks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.board_members bm ON bm.board_id = c.board_id
      WHERE c.id = card_subtasks.card_id
        AND bm.user_id = auth.uid()::text
        AND bm.role != 'viewer'
    )
  );
