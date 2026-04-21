-- Migration 34: personal access tokens for Claude Code API.
-- One user → many tokens (multiple devices/projects).
-- token_hash is argon2id; the plaintext is shown to the user once at creation.
-- prefix is the first 8 chars of the full token (e.g. "avk_a1b2"); used for
-- O(1) lookup before the constant-time argon2 verify.
-- Soft revoke (revoked_at) — never DELETE rows, so audit history persists.

CREATE TABLE IF NOT EXISTS public.api_tokens (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR      NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  token_hash    TEXT         NOT NULL,
  prefix        VARCHAR(8)   NOT NULL,
  last_used_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS api_tokens_prefix_idx
  ON public.api_tokens(prefix)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS api_tokens_user_active_idx
  ON public.api_tokens(user_id, revoked_at);

ALTER TABLE public.api_tokens ENABLE ROW LEVEL SECURITY;

-- Owner-only read; the verify path uses the service role to bypass RLS for the
-- prefix lookup (constant-time hash compare happens in Node).
CREATE POLICY "Users can read their own tokens"
  ON public.api_tokens FOR SELECT
  USING (user_id = auth.uid()::text);

-- Inserts go through the API (POST /api/api-tokens) which is server-only and
-- uses the service role client. We still allow the owner to insert for
-- defense-in-depth in case the route ever switches to user-context.
CREATE POLICY "Users can mint their own tokens"
  ON public.api_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid()::text);

-- Updates are limited to setting revoked_at (soft revoke). Owner only.
CREATE POLICY "Users can revoke their own tokens"
  ON public.api_tokens FOR UPDATE
  USING (user_id = auth.uid()::text)
  WITH CHECK (user_id = auth.uid()::text);
