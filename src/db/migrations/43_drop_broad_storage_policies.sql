-- 43_drop_broad_storage_policies.sql
--
-- Remove overly permissive SELECT/INSERT/DELETE policies on storage.objects
-- that the Supabase linter flagged (lint 0025 "Public Bucket Allows
-- Listing"), and which in practice let any authenticated user enumerate
-- and overwrite files belonging to other users/boards.
--
-- For card-attachments, three matching board-member-scoped policies
-- already exist:
--   - "Board members can read card attachments"   (SELECT, USING is_member)
--   - "Board members can upload card attachments" (INSERT, WITH CHECK)
--   - "Board members can delete card attachments" (DELETE, USING)
-- Postgres OR's policies for the same command, so the broad
-- attachments_auth_*_v1 policies were silently making the scoped ones
-- ineffective. Dropping them activates board-member enforcement.
--
-- For avatars, the bucket is public so direct GETs serve files via URL
-- without any storage.objects policy check. The "Authenticated users can
-- read avatars" policy only mattered for .list() calls, which the
-- application never makes against avatars. Dropping it prevents arbitrary
-- enumeration of avatar filenames.
--
-- Board owners are added to board_members with role 'owner' on board
-- creation (see src/app/api/boards/route.ts), so the existing scoped
-- policies cover owners as well.

-- ---------------------------------------------------------------------------
-- card-attachments: drop the 3 broad authenticated-only policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "attachments_auth_select_v1 ew4foz_0" ON storage.objects;
DROP POLICY IF EXISTS "attachments_auth_insert_v1 ew4foz_0" ON storage.objects;
DROP POLICY IF EXISTS "attachments_auth_delete_v1 ew4foz_0" ON storage.objects;

-- ---------------------------------------------------------------------------
-- avatars: drop the broad SELECT policy (public bucket — direct URLs still work)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read avatars" ON storage.objects;
