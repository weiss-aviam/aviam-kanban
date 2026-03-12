-- Migration 20: Change comments.author_id FK from ON DELETE CASCADE to ON DELETE SET NULL.
-- This preserves comments when their author is permanently deleted,
-- rather than cascade-deleting them. Comments on boards NOT owned by the deleted user
-- will remain with author_id = NULL (anonymous attribution).
-- Comments on boards the deleted user DID own are still removed via the board cascade.

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT tc.constraint_name INTO v_constraint
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
   AND tc.table_schema = kcu.table_schema
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'comments'
    AND kcu.column_name = 'author_id'
    AND tc.constraint_type = 'FOREIGN KEY';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.comments DROP CONSTRAINT %I', v_constraint);
  END IF;
END $$;

-- Allow NULL so SET NULL can work
ALTER TABLE public.comments ALTER COLUMN author_id DROP NOT NULL;

-- Re-add FK with SET NULL on delete
ALTER TABLE public.comments
  ADD CONSTRAINT comments_author_id_fk
  FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;
