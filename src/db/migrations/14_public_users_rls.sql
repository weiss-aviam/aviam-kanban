-- Migration 14: Set RLS policies on public.users
--
-- public.users is the app-level user profile store.
-- Any authenticated user should be able to read all profiles
-- (needed for assignee dropdowns, member lists, etc.).
-- Users can only update their own profile row.

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies to start clean
DROP POLICY IF EXISTS "Users can view all profiles" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.users;
DROP POLICY IF EXISTS "Service role can manage users" ON public.users;

-- Any authenticated user can read all profile rows
CREATE POLICY "Users can view all profiles"
  ON public.users
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Users can only update their own profile
CREATE POLICY "Users can update own profile"
  ON public.users
  FOR UPDATE
  USING (auth.uid()::text = id);

-- Users can insert their own profile (needed for first-login sync)
CREATE POLICY "Users can insert own profile"
  ON public.users
  FOR INSERT
  WITH CHECK (auth.uid()::text = id);
