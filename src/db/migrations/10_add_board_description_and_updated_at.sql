-- Add description and updated_at to boards
ALTER TABLE boards
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill updated_at from created_at for existing rows
UPDATE boards SET updated_at = created_at WHERE updated_at IS NULL;

-- Function: propagate latest card/column activity to board's updated_at
CREATE OR REPLACE FUNCTION propagate_board_activity() RETURNS TRIGGER AS $$
DECLARE
  _board_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    _board_id := OLD.board_id;
  ELSE
    _board_id := NEW.board_id;
  END IF;
  UPDATE boards SET updated_at = NOW() WHERE id = _board_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cards_update_board_activity ON cards;
CREATE TRIGGER cards_update_board_activity
  AFTER INSERT OR UPDATE OR DELETE ON cards
  FOR EACH ROW EXECUTE FUNCTION propagate_board_activity();

DROP TRIGGER IF EXISTS columns_update_board_activity ON columns;
CREATE TRIGGER columns_update_board_activity
  AFTER INSERT OR UPDATE OR DELETE ON columns
  FOR EACH ROW EXECUTE FUNCTION propagate_board_activity();
