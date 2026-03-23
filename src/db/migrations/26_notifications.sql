-- Migration 26: In-app notifications
--
-- A single table stores all notification types.
-- metadata JSONB carries type-specific payload.
-- Realtime is enabled so clients receive live INSERTs filtered by user_id.

CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       TEXT        NOT NULL CHECK (type IN (
               'mention',
               'comment_on_assigned',
               'deadline_change',
               'file_upload',
               'card_assigned'
             )),
  actor_id   TEXT        REFERENCES public.users(id) ON DELETE SET NULL,
  card_id    UUID        REFERENCES public.cards(id) ON DELETE CASCADE,
  board_id   UUID        REFERENCES public.boards(id) ON DELETE CASCADE,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx
  ON public.notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON public.notifications (user_id)
  WHERE read_at IS NULL;

-- RLS: users can only see and manage their own notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE POLICY "Users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

-- Enable realtime so clients receive new notifications instantly
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
