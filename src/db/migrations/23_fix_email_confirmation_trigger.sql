-- Migration 23: Fix email confirmation flow.
--
-- Problem: handle_email_confirmed() updates auth.users.banned_until from within
-- an AFTER UPDATE trigger on auth.users. Supabase does not support self-referential
-- auth.users updates from triggers — it causes "Database error querying schema"
-- at login time. Additionally, admin-created users (email_confirm: true) also
-- triggered this ban because the trigger had no admin_created guard.
--
-- Fix:
--   1. Drop the on_auth_user_email_confirmed trigger and function entirely.
--   2. Banning is now handled in the application layer (POST /api/auth/confirm-email)
--      after the user successfully exchanges the confirmation code.
--   3. Unban any users who are currently 'active' in public.users but were
--      incorrectly banned by the old trigger.

-- ── 1. Drop the broken trigger ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
DROP FUNCTION IF EXISTS public.handle_email_confirmed();

-- ── 2. Unban users who are 'active' but got incorrectly banned ───────────────
-- These are admin-created users that the trigger incorrectly banned.

UPDATE auth.users
SET banned_until = NULL
WHERE id IN (
  SELECT id::uuid
  FROM public.users
  WHERE status = 'active'
)
AND banned_until IS NOT NULL;
