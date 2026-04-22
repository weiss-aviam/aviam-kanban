-- Migration 35: audit which surface created each piece of content.
-- Existing rows get the default 'ui'. New rows from the API set 'api'.
-- The Kanban UI shows a "via API" badge when this is 'api'.
--
-- Note: attachments are Supabase Storage objects (bucket: card-attachments),
-- not relational rows, so they have no created_via column here. The
-- subtasks table in this codebase is named card_subtasks.

ALTER TABLE public.boards
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));

ALTER TABLE public.cards
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));

ALTER TABLE public.card_subtasks
  ADD COLUMN IF NOT EXISTS created_via TEXT NOT NULL DEFAULT 'ui'
  CHECK (created_via IN ('ui', 'api'));
