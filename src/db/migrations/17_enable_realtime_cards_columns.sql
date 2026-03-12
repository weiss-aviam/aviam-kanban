-- Enable realtime publication for cards and columns tables
-- This allows Supabase Realtime Postgres Changes to fire for these tables

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'cards'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cards;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
    AND schemaname = 'public'
    AND tablename = 'columns'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.columns;
  END IF;
END $$;
