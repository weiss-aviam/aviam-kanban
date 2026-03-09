-- Migration: Add avatar_url to users table
-- Description: Store avatar URL in the users table so it can be
--              included in board member queries without Auth metadata lookups.

ALTER TABLE users
ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048);
