-- Migration 19: Ban self-registered users at the auth layer until approved by a super admin.
-- A BEFORE INSERT trigger on auth.users sets banned_until = 'infinity' for all new signups
-- UNLESS the row was created via the admin API with app_metadata.admin_created = true.
-- This enforces the approval workflow at the database level, independent of any client-side checks.

CREATE OR REPLACE FUNCTION public.ban_pending_signup()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Admin-created users (via service role) bypass the ban
  IF (NEW.raw_app_meta_data->>'admin_created')::boolean IS TRUE THEN
    RETURN NEW;
  END IF;

  -- Self-registered users are immediately banned until a super admin approves them
  NEW.banned_until = 'infinity'::timestamptz;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_signup_ban ON auth.users;

CREATE TRIGGER on_auth_user_signup_ban
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.ban_pending_signup();

-- Also ban any existing pending users who slipped through without a ban
-- (e.g. registered before this migration was applied)
UPDATE auth.users au
SET banned_until = 'infinity'::timestamptz
FROM public.users pu
WHERE au.id = pu.id::uuid
  AND pu.status = 'pending'
  AND (au.banned_until IS NULL OR au.banned_until < now());
