-- Migration: Add User Management Tables
-- This migration adds tables required for comprehensive user management functionality

-- Admin audit log table - tracks all admin actions for security and compliance
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  board_id UUID REFERENCES boards(id) ON DELETE SET NULL,
  action VARCHAR(50) NOT NULL, -- 'invite_user', 'update_user', 'remove_user', 'reset_password', 'update_role'
  details TEXT, -- JSON string with additional details
  ip_address VARCHAR(45), -- Support IPv6
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- User invitations table - tracks pending invitations
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL,
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE, -- Invitation token
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_target_user_id ON admin_audit_log(target_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_board_id ON admin_audit_log(board_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at);

CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_board_id ON user_invitations(board_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_invitations_invited_by ON user_invitations(invited_by);

-- Enable Row Level Security on new tables
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for admin_audit_log
-- Only board admins and owners can view audit logs for their boards
CREATE POLICY "Board admins can view audit logs for their boards" ON admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = admin_audit_log.board_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Only authenticated users can insert audit logs (server-side operations)
CREATE POLICY "Authenticated users can create audit logs" ON admin_audit_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- RLS policies for user_invitations
-- Board admins can view invitations for their boards
CREATE POLICY "Board admins can view invitations for their boards" ON user_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = user_invitations.board_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Board admins can create invitations for their boards
CREATE POLICY "Board admins can create invitations for their boards" ON user_invitations
  FOR INSERT WITH CHECK (
    auth.uid() = invited_by AND
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = user_invitations.board_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Board admins can update invitations for their boards
CREATE POLICY "Board admins can update invitations for their boards" ON user_invitations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = user_invitations.board_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Board admins can delete invitations for their boards
CREATE POLICY "Board admins can delete invitations for their boards" ON user_invitations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM board_members bm 
      WHERE bm.board_id = user_invitations.board_id 
      AND bm.user_id = auth.uid() 
      AND bm.role IN ('owner', 'admin')
    )
  );

-- Enable Realtime for live collaboration
ALTER PUBLICATION supabase_realtime ADD TABLE admin_audit_log;
ALTER PUBLICATION supabase_realtime ADD TABLE user_invitations;

-- Add missing invited_at column to board_members if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'board_members' AND column_name = 'invited_at') THEN
        ALTER TABLE board_members ADD COLUMN invited_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Update existing board_members to have invited_at = created_at if null
UPDATE board_members SET invited_at = created_at WHERE invited_at IS NULL;
