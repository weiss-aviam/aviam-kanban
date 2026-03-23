-- Migration 27: Add board_member_added notification type
-- Expands the notifications.type CHECK constraint to include the new value.
-- Postgres names inline CHECK constraints automatically as <table>_<col>_check.
-- Dropping and re-adding the constraint is safe: existing rows are unaffected.

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
    'board_member_added'
  ));
