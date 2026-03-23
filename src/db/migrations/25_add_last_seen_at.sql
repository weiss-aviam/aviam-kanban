-- Migration 25: Add last_seen_at to track when a user was last active
-- Updated by the sync-profile endpoint on every authenticated page load.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

COMMENT ON COLUMN public.users.last_seen_at IS
  'Timestamp of the last time the user was seen (profile sync on login / page load).';
