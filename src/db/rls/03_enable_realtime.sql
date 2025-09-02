-- Enable Supabase Realtime on tables
-- This script should be executed in the Supabase SQL editor

-- Enable Realtime for boards table
ALTER PUBLICATION supabase_realtime ADD TABLE boards;

-- Enable Realtime for board_members table
ALTER PUBLICATION supabase_realtime ADD TABLE board_members;

-- Enable Realtime for columns table
ALTER PUBLICATION supabase_realtime ADD TABLE columns;

-- Enable Realtime for cards table
ALTER PUBLICATION supabase_realtime ADD TABLE cards;

-- Enable Realtime for labels table
ALTER PUBLICATION supabase_realtime ADD TABLE labels;

-- Enable Realtime for card_labels table
ALTER PUBLICATION supabase_realtime ADD TABLE card_labels;

-- Enable Realtime for comments table
ALTER PUBLICATION supabase_realtime ADD TABLE comments;

-- Note: Realtime filtering by board_id will be handled in the client-side subscription
-- The client will subscribe to changes with filters like:
-- supabase
--   .channel('board-changes')
--   .on('postgres_changes', {
--     event: '*',
--     schema: 'public',
--     table: 'cards',
--     filter: 'board_id=eq.1'
--   }, handleCardChange)
--   .subscribe()
