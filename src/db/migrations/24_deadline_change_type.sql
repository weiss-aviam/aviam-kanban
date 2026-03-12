-- Migration 24: Add change_type to card_deadline_requests.
--
-- Enables tracking direct deadline changes (by the creator/admin) alongside
-- member suggestions, giving complete timeline transparency.
--
-- change_type = 'suggestion' → member-submitted, needs approval (existing rows)
-- change_type = 'direct'     → set directly by creator/admin, status = 'applied'

ALTER TABLE public.card_deadline_requests
  ADD COLUMN IF NOT EXISTS change_type TEXT NOT NULL DEFAULT 'suggestion'
    CHECK (change_type IN ('suggestion', 'direct'));

-- Allow suggested_due_date to be NULL for 'direct' removal events
-- (when a creator clears the deadline, the new value is null).
ALTER TABLE public.card_deadline_requests
  ALTER COLUMN suggested_due_date DROP NOT NULL;

-- Also extend the status enum to include 'applied' for direct changes.
-- Drop and re-add the check constraint (no enum type, just a check).
DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT c.conname INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  JOIN pg_namespace n ON t.relnamespace = n.oid
  WHERE n.nspname = 'public'
    AND t.relname = 'card_deadline_requests'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.card_deadline_requests DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

ALTER TABLE public.card_deadline_requests
  ADD CONSTRAINT card_deadline_requests_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'applied'));
