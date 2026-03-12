-- Migration 21: Email confirmation before admin review.
--
-- New signup flow:
--   1. User registers → status = 'unconfirmed', NOT banned yet
--   2. Supabase sends confirmation email
--   3. User clicks confirmation link → email_confirmed_at is set
--   4. AFTER UPDATE trigger fires → status = 'pending', banned_until = 'infinity'
--   5. Admin approves → status = 'active', ban lifted
--
-- This replaces migration 19's INSERT-time ban: the ban was too early
-- because it prevented the confirmation email link from working.

-- ── 1. Remove migration 19's ban-on-insert trigger ───────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_signup_ban ON auth.users;
DROP FUNCTION IF EXISTS public.ban_pending_signup();

-- ── 2. Add 'unconfirmed' to the status check constraint ─────────────────────

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT c.conname INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'users'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.users DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.users
  ADD CONSTRAINT users_status_check
  CHECK (status IN ('unconfirmed', 'pending', 'active', 'deactivated'));

-- Change default so new self-registered rows start as 'unconfirmed'
ALTER TABLE public.users ALTER COLUMN status SET DEFAULT 'unconfirmed';

-- ── 3. Update handle_new_auth_user to set explicit status ───────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- Admin-created users (via service role API) get 'active' immediately
  IF (NEW.raw_app_meta_data->>'admin_created')::boolean IS TRUE THEN
    v_status := 'active';
  ELSE
    v_status := 'unconfirmed';
  END IF;

  INSERT INTO public.users (id, email, name, avatar_url, status)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    v_status
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 4. Email confirmation trigger: unconfirmed → pending + ban ───────────────

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
    -- Promote the user from unconfirmed to pending in public.users
    UPDATE public.users
    SET status = 'pending'
    WHERE id = NEW.id::text AND status = 'unconfirmed';

    -- Ban the user at the auth layer until a super admin approves them.
    -- Updating banned_until does NOT re-trigger this trigger because
    -- this trigger only fires on changes to email_confirmed_at.
    UPDATE auth.users
    SET banned_until = 'infinity'::timestamptz
    WHERE id = NEW.id AND (banned_until IS NULL OR banned_until < now());
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_email_confirmed();
