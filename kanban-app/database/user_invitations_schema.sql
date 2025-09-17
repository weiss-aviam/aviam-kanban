-- User Invitations Table
-- This table tracks all user invitations sent for boards
CREATE TABLE IF NOT EXISTS user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'member', 'viewer')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  token VARCHAR(255) NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  accepted_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one pending invitation per email per board
  UNIQUE(board_id, email, status) DEFERRABLE INITIALLY DEFERRED
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_invitations_board_id ON user_invitations(board_id);
CREATE INDEX IF NOT EXISTS idx_user_invitations_email ON user_invitations(email);
CREATE INDEX IF NOT EXISTS idx_user_invitations_token ON user_invitations(token);
CREATE INDEX IF NOT EXISTS idx_user_invitations_status ON user_invitations(status);
CREATE INDEX IF NOT EXISTS idx_user_invitations_expires_at ON user_invitations(expires_at);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_user_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_user_invitations_updated_at ON user_invitations;
CREATE TRIGGER trigger_update_user_invitations_updated_at
  BEFORE UPDATE ON user_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_user_invitations_updated_at();

-- Function to automatically expire old invitations
CREATE OR REPLACE FUNCTION expire_old_invitations()
RETURNS void AS $$
BEGIN
  UPDATE user_invitations 
  SET status = 'expired', updated_at = NOW()
  WHERE status = 'pending' 
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- User Login Tracking Table
-- This table tracks user login activity to show if invited users have logged in
CREATE TABLE IF NOT EXISTS user_login_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  login_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address INET,
  user_agent TEXT,
  login_method VARCHAR(50), -- 'email', 'google', 'github', etc.
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for user login activity
CREATE INDEX IF NOT EXISTS idx_user_login_activity_user_id ON user_login_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_login_activity_login_at ON user_login_activity(login_at);

-- View to get invitation status with user login information
CREATE OR REPLACE VIEW invitation_status_view AS
SELECT 
  ui.id,
  ui.board_id,
  ui.email,
  ui.role,
  ui.status,
  ui.token,
  ui.invited_by,
  ui.invited_at,
  ui.accepted_at,
  ui.expires_at,
  ui.created_at,
  ui.updated_at,
  -- Check if user exists and has logged in
  u.id as user_id,
  u.name as user_name,
  u.created_at as user_created_at,
  -- Get latest login activity
  ula.login_at as last_login_at,
  ula.login_method as last_login_method,
  -- Calculate invitation status
  CASE 
    WHEN ui.status = 'accepted' AND u.id IS NOT NULL THEN 'active_user'
    WHEN ui.status = 'accepted' AND u.id IS NULL THEN 'accepted_no_account'
    WHEN ui.status = 'pending' AND ui.expires_at < NOW() THEN 'expired'
    WHEN ui.status = 'pending' THEN 'pending'
    ELSE ui.status
  END as computed_status,
  -- Check if user has ever logged in
  CASE 
    WHEN ula.login_at IS NOT NULL THEN true
    ELSE false
  END as has_logged_in
FROM user_invitations ui
LEFT JOIN users u ON u.email = ui.email
LEFT JOIN LATERAL (
  SELECT login_at, login_method
  FROM user_login_activity 
  WHERE user_id = u.id 
  ORDER BY login_at DESC 
  LIMIT 1
) ula ON true;

-- RLS Policies for user_invitations
ALTER TABLE user_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see invitations for boards they are members of
CREATE POLICY "Users can view invitations for their boards" ON user_invitations
  FOR SELECT USING (
    board_id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy: Only admins and owners can insert invitations
CREATE POLICY "Admins can create invitations" ON user_invitations
  FOR INSERT WITH CHECK (
    board_id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: Only admins and owners can update invitations
CREATE POLICY "Admins can update invitations" ON user_invitations
  FOR UPDATE USING (
    board_id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- Policy: Only admins and owners can delete invitations
CREATE POLICY "Admins can delete invitations" ON user_invitations
  FOR DELETE USING (
    board_id IN (
      SELECT board_id FROM board_members 
      WHERE user_id = auth.uid() 
      AND role IN ('owner', 'admin')
    )
  );

-- RLS Policies for user_login_activity
ALTER TABLE user_login_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own login activity
CREATE POLICY "Users can view their own login activity" ON user_login_activity
  FOR SELECT USING (user_id = auth.uid());

-- Policy: Only the user themselves can insert login activity (typically done by triggers)
CREATE POLICY "Users can insert their own login activity" ON user_login_activity
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Function to record user login
CREATE OR REPLACE FUNCTION record_user_login(
  p_user_id UUID,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_login_method VARCHAR(50) DEFAULT 'email'
)
RETURNS void AS $$
BEGIN
  INSERT INTO user_login_activity (user_id, ip_address, user_agent, login_method)
  VALUES (p_user_id, p_ip_address, p_user_agent, p_login_method);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT SELECT ON invitation_status_view TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_invitations() TO authenticated;
GRANT EXECUTE ON FUNCTION record_user_login(UUID, INET, TEXT, VARCHAR) TO authenticated;
