-- Migration 37: idempotency-key store for replay protection on the
-- changesets endpoint. Rows older than 24h are pruned by the server's
-- middleware on read; nothing automated runs in the DB itself.

CREATE TABLE IF NOT EXISTS public.api_idempotency_keys (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  token_id    UUID         NOT NULL REFERENCES public.api_tokens(id) ON DELETE CASCADE,
  key         TEXT         NOT NULL,
  status      INTEGER      NOT NULL,
  response    JSONB        NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT  api_idempotency_keys_unique UNIQUE (token_id, key)
);

CREATE INDEX IF NOT EXISTS api_idempotency_keys_created_idx
  ON public.api_idempotency_keys(created_at);

ALTER TABLE public.api_idempotency_keys ENABLE ROW LEVEL SECURITY;

-- Server-side only — no user-facing select policy needed; service role bypasses.
