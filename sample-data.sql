-- Sample Data for Aviam Kanban
-- Run this AFTER creating the schema and AFTER you have signed up for an account

-- Note: Replace 'YOUR_USER_ID' with your actual user ID from auth.users
-- You can get your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';

-- Insert sample board (replace YOUR_USER_ID with your actual user ID)
INSERT INTO boards (name, owner_id) VALUES 
('Sample Project Board', 'YOUR_USER_ID');

-- Get the board ID (this will be 1 if it's your first board)
-- Insert board member (owner)
INSERT INTO board_members (board_id, user_id, role) VALUES 
(1, 'YOUR_USER_ID', 'owner');

-- Insert columns
INSERT INTO columns (board_id, title, position) VALUES 
(1, 'To Do', 1),
(1, 'In Progress', 2),
(1, 'Review', 3),
(1, 'Done', 4);

-- Insert labels
INSERT INTO labels (board_id, name, color) VALUES 
(1, 'Bug', '#ef4444'),
(1, 'Feature', '#3b82f6'),
(1, 'High Priority', '#f59e0b'),
(1, 'Low Priority', '#10b981'),
(1, 'Documentation', '#8b5cf6');

-- Insert sample cards
INSERT INTO cards (board_id, column_id, title, description, position) VALUES 
(1, 1, 'Set up project repository', 'Initialize the project with proper folder structure and dependencies', 1),
(1, 1, 'Design user interface mockups', 'Create wireframes and mockups for the main application screens', 2),
(1, 1, 'Research authentication solutions', 'Evaluate different authentication providers and choose the best fit', 3),
(1, 2, 'Implement user authentication', 'Set up Supabase Auth with email/password and magic link support', 1),
(1, 2, 'Create database schema', 'Design and implement the database schema with proper relationships', 2),
(1, 3, 'Add drag and drop functionality', 'Implement card movement between columns using @dnd-kit', 1),
(1, 4, 'Set up development environment', 'Configure Next.js, TypeScript, and Tailwind CSS', 1),
(1, 4, 'Create landing page', 'Design and implement an attractive landing page', 2);

-- Insert card labels (many-to-many relationships)
INSERT INTO card_labels (card_id, label_id) VALUES 
(1, 5), -- Set up project repository -> Documentation
(2, 2), -- Design user interface mockups -> Feature
(3, 2), -- Research authentication solutions -> Feature
(4, 2), -- Implement user authentication -> Feature
(4, 3), -- Implement user authentication -> High Priority
(5, 2), -- Create database schema -> Feature
(5, 3), -- Create database schema -> High Priority
(6, 2), -- Add drag and drop functionality -> Feature
(7, 2), -- Set up development environment -> Feature
(8, 2); -- Create landing page -> Feature

-- Insert sample comments
INSERT INTO comments (card_id, author_id, body) VALUES 
(4, 'YOUR_USER_ID', 'Started working on the authentication flow. Supabase Auth looks promising!'),
(4, 'YOUR_USER_ID', 'Email/password authentication is now working. Next up: magic links.'),
(5, 'YOUR_USER_ID', 'Database schema is complete. All tables have been created with proper RLS policies.'),
(6, 'YOUR_USER_ID', 'The drag and drop functionality is working smoothly. Cards move between columns perfectly!'),
(8, 'YOUR_USER_ID', 'Landing page looks great! Added feature showcase and call-to-action sections.');

-- Instructions for use:
-- 1. First, sign up for an account in your application
-- 2. Get your user ID by running: SELECT id FROM auth.users WHERE email = 'your-email@example.com';
-- 3. Replace all instances of 'YOUR_USER_ID' in this file with your actual user ID
-- 4. Run this SQL in your Supabase SQL Editor
