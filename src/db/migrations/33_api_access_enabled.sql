-- Migration 33: master opt-in flag for Claude API access.
-- Default false → no token can authenticate until the user explicitly toggles
-- this on in /profile/api-access. Toggling off makes existing tokens inert
-- without deleting them.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS api_access_enabled BOOLEAN NOT NULL DEFAULT false;
