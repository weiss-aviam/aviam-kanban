-- Migration 36: enforce unique column title per board.
-- Required so the changesets API can resolve `columnRef` (title-based) to a
-- single column unambiguously. Run scripts/check-column-duplicates.js before
-- applying — the migration will fail otherwise.
ALTER TABLE public.columns
  ADD CONSTRAINT columns_board_title_unique UNIQUE (board_id, title);
