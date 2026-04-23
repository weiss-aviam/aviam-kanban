-- 42_pin_function_search_path.sql
--
-- Pin search_path on every public.* function flagged by Supabase's
-- "Function Search Path Mutable" linter (lint 0011).
--
-- Why: When a function has no search_path set, it inherits the caller's
-- session search_path. A malicious caller could prepend a schema they
-- control and shadow trusted objects (e.g. a fake `public.users` table
-- referenced by a SECURITY DEFINER function). Pinning search_path closes
-- the attack vector.
--
-- We pin to `public, pg_catalog` (instead of '') because the existing
-- function bodies reference unqualified tables like `board_members`,
-- `boards`, `cards`, etc. The empty-string variant from Supabase's docs
-- would require rewriting every reference as `public.<table>`; pinning
-- to `public, pg_catalog` satisfies the linter without touching bodies.

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.is_board_member(user_id text, board_id text, min_role text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.is_board_member(user_id uuid, board_id integer, min_role text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.record_user_login(
    p_user_id character varying,
    p_ip_address inet,
    p_user_agent text,
    p_login_method character varying
  )
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.create_board_changeset(payload jsonb)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.expire_old_invitations()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.propagate_board_activity()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.update_user_invitations_updated_at()
  SET search_path = public, pg_catalog;
