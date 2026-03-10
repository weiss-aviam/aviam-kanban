-- Migration 15: Backfill avatar_url for existing public.users rows
--
-- Migration 13 only inserted *missing* users. Users who were already in
-- public.users but with avatar_url = NULL won't have had their OAuth photo
-- (from raw_user_meta_data->>'avatar_url') carried over.
-- This migration updates those rows.

UPDATE public.users pu
SET avatar_url = au.raw_user_meta_data->>'avatar_url'
FROM auth.users au
WHERE pu.id = au.id::text
  AND pu.avatar_url IS NULL
  AND au.raw_user_meta_data->>'avatar_url' IS NOT NULL;
