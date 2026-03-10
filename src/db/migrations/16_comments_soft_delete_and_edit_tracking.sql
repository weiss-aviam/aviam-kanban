-- Migration 16: Add edit tracking and soft delete to comments
--
-- edited_at: set when a comment body is updated, so the UI can show "(edited)"
-- deleted_at: set instead of hard-deleting, so the thread position is preserved
--             and the UI can show "Deleted on [datetime]"

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
