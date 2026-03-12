-- Migration 22: Deadline suggestion workflow for cards.
--
-- Rules:
--   - card.created_by is the only user who can directly edit the due_date
--   - Board owners/admins are also treated as authoritative
--   - All other users must submit a suggestion (card_deadline_requests)
--   - Creator approves or rejects suggestions
--   - History of all suggestions (and their outcomes) is preserved

-- ── 1. Track who created each card ──────────────────────────────────────────

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS created_by TEXT REFERENCES public.users(id) ON DELETE SET NULL;

-- ── 2. Deadline requests table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.card_deadline_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id       UUID        NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  requested_by  TEXT        REFERENCES public.users(id) ON DELETE SET NULL,
  suggested_due_date TIMESTAMPTZ NOT NULL,
  note          TEXT,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  resolved_by   TEXT        REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS card_deadline_requests_card_id_idx
  ON public.card_deadline_requests (card_id);

-- ── 3. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.card_deadline_requests ENABLE ROW LEVEL SECURITY;

-- Board members can view all requests for cards on boards they belong to
CREATE POLICY "board members can view deadline requests"
  ON public.card_deadline_requests FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.columns col ON c.column_id = col.id
      JOIN public.board_members bm ON col.board_id = bm.board_id
      WHERE c.id = card_deadline_requests.card_id
        AND bm.user_id = auth.uid()::text
    )
  );

-- Board members can insert requests for themselves
CREATE POLICY "board members can create deadline requests"
  ON public.card_deadline_requests FOR INSERT
  WITH CHECK (
    requested_by = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.columns col ON c.column_id = col.id
      JOIN public.board_members bm ON col.board_id = bm.board_id
      WHERE c.id = card_id
        AND bm.user_id = auth.uid()::text
    )
  );

-- Card creator (or board owner) can approve/reject requests via the API
-- (enforced at API level; this policy allows the update)
CREATE POLICY "card creator can resolve deadline requests"
  ON public.card_deadline_requests FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.cards c
      JOIN public.columns col ON c.column_id = col.id
      JOIN public.board_members bm ON col.board_id = bm.board_id
      WHERE c.id = card_deadline_requests.card_id
        AND bm.user_id = auth.uid()::text
        AND bm.role IN ('owner', 'admin')
    )
    OR EXISTS (
      SELECT 1 FROM public.cards c
      WHERE c.id = card_deadline_requests.card_id
        AND c.created_by = auth.uid()::text
    )
  );
