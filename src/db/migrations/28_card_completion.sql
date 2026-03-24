-- Add completed_at to cards
-- NULL = active card, non-null = timestamp when it was marked complete
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Add is_done flag to columns
-- Columns marked as done auto-complete cards moved into them
-- and auto-reopen cards moved out of them
ALTER TABLE public.columns ADD COLUMN IF NOT EXISTS is_done BOOLEAN NOT NULL DEFAULT FALSE;
