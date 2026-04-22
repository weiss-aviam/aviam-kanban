-- Migration 40: harden public.api_idempotency_keys.
--
-- 1. Add an explicit expires_at column with a 24h default. Replaces the
--    implicit "filter by created_at > now() - 24h" logic in the app — once
--    a key is past expires_at, it MUST not be used for replay.
-- 2. Backfill existing rows so the column can be NOT NULL safely.
--
-- Cleanup runs from the app via the admin client (opportunistic DELETE
-- WHERE expires_at < NOW()), so no in-DB function is added here. RLS on
-- this table remains intentionally enabled with no policies — only the
-- service-role client touches it (see refactor of withIdempotency).

-- Add column nullable first (no data rewrite for existing rows)
ALTER TABLE public.api_idempotency_keys
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill existing rows to (created_at + 24h)
UPDATE public.api_idempotency_keys
  SET expires_at = created_at + INTERVAL '24 hours'
  WHERE expires_at IS NULL;

-- Enforce default + NOT NULL for new inserts
ALTER TABLE public.api_idempotency_keys
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '24 hours');

ALTER TABLE public.api_idempotency_keys
  ALTER COLUMN expires_at SET NOT NULL;

-- Index for cheap "WHERE expires_at < NOW()" sweeps
CREATE INDEX IF NOT EXISTS api_idempotency_keys_expires_idx
  ON public.api_idempotency_keys(expires_at);
