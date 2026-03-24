-- Migration 29: Add card_completed notification type + backfill completedAt
--
-- 1. Expand the notifications.type CHECK constraint to include 'card_completed'.
-- 2. Backfill completed_at for cards already sitting in a done column.

-- safe: expanding CHECK constraint to include new type; existing rows are unaffected
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- safe: expanding CHECK constraint to include new type; existing rows are unaffected
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'mention',
    'comment_on_assigned',
    'deadline_change',
    'file_upload',
    'card_assigned',
    'board_member_added',
    'card_completed'
  ));

-- Backfill: cards that live in a done column but have no completed_at yet.
-- Uses NOW() as a best-effort timestamp since the original completion time is unknown.
UPDATE public.cards
SET completed_at = NOW()
WHERE completed_at IS NULL
  AND column_id IN (
    SELECT id FROM public.columns WHERE is_done = TRUE
  );
