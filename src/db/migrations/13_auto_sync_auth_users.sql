-- Migration 13: Auto-sync auth.users → public.users via trigger
--
-- Establishes the canonical pattern: auth is only for authentication.
-- All profile data lives in public.users, which is kept in sync
-- automatically whenever an auth.user is created or their email/metadata
-- is updated.
--
-- Also backfills any existing auth users that are missing from public.users.

-- ── 1. Trigger function ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id::text,
    COALESCE(NEW.email, ''),
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(COALESCE(NEW.email, ''), '@', 1),
      'User'
    ),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 2. Trigger on INSERT (new sign-up or admin-created user) ─────────────────

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ── 3. Trigger function for email / metadata updates ────────────────────────

CREATE OR REPLACE FUNCTION public.handle_auth_user_updated()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    email      = COALESCE(NEW.email, ''),
    name       = COALESCE(
                   NEW.raw_user_meta_data->>'name',
                   split_part(COALESCE(NEW.email, ''), '@', 1),
                   'User'
                 ),
    avatar_url = COALESCE(
                   NEW.raw_user_meta_data->>'avatar_url',
                   avatar_url   -- keep existing if no new value
                 )
  WHERE id = NEW.id::text;

  RETURN NEW;
END;
$$;

-- ── 4. Trigger on UPDATE ─────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE OF email, raw_user_meta_data ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_auth_user_updated();

-- ── 5. Backfill: insert any auth users not yet in public.users ───────────────

INSERT INTO public.users (id, email, name, avatar_url)
SELECT
  u.id::text,
  COALESCE(u.email, ''),
  COALESCE(
    u.raw_user_meta_data->>'name',
    split_part(COALESCE(u.email, ''), '@', 1),
    'User'
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.users pu WHERE pu.id = u.id::text
)
ON CONFLICT (id) DO NOTHING;
