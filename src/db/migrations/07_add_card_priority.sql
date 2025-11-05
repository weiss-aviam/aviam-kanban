-- Migration: Add priority field to cards table
-- Date: 2025-09-16
-- Description: Add priority field with enum values (high, medium, low) and default to medium

-- Add priority column to cards table
ALTER TABLE cards 
ADD COLUMN priority VARCHAR(10) DEFAULT 'medium' 
CHECK (priority IN ('high', 'medium', 'low'));

-- Update existing cards to have medium priority (default)
UPDATE cards SET priority = 'medium' WHERE priority IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE cards ALTER COLUMN priority SET NOT NULL;

-- Add index for better query performance on priority filtering
CREATE INDEX idx_cards_priority ON cards(priority);

-- Add composite index for board_id and priority for efficient filtering
CREATE INDEX idx_cards_board_priority ON cards(board_id, priority);
