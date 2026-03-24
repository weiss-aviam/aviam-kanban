-- Migration 30: Add card_moved notification type
-- Also re-applies the card_completed addition from migration 29 idempotently,
-- so this migration is safe to run whether or not migration 29 was applied.

-- safe: expanding CHECK constraint; existing rows are unaffected
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- safe: expanding CHECK constraint; existing rows are unaffected
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'mention',
    'comment_on_assigned',
    'deadline_change',
    'file_upload',
    'card_assigned',
    'board_member_added',
    'card_completed',
    'card_moved'
  ));
