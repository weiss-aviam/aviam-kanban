import { createClient } from '@supabase/supabase-js';

/**
 * Create a Supabase client with service role key for admin operations
 * This client bypasses RLS and should only be used server-side for admin operations
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration for admin client');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Type definitions for admin operations
 */
export interface AdminPermissions {
  canInviteUsers: boolean;
  canManageUsers: boolean;
  canResetPasswords: boolean;
  canViewAuditLogs: boolean;
  canManageMemberships: boolean;
}

export interface AdminContext {
  userId: string;
  boardId: string;
  role: string;
  permissions: AdminPermissions;
}

/**
 * Check if a user has admin permissions for a specific board
 */
export async function checkAdminPermissions(
  userId: string,
  boardId: string
): Promise<AdminContext | null> {
  try {
    const supabase = createAdminClient();

    // Get user's role in the board
    const { data: membership, error } = await supabase
      .from('board_members')
      .select('role')
      .eq('board_id', boardId)
      .eq('user_id', userId)
      .single();

    if (error || !membership) {
      return null;
    }

    const role = membership.role;
    const isAdmin = role === 'owner' || role === 'admin';

    if (!isAdmin) {
      return null;
    }

    // Define permissions based on role
    const permissions: AdminPermissions = {
      canInviteUsers: isAdmin,
      canManageUsers: isAdmin,
      canResetPasswords: isAdmin,
      canViewAuditLogs: isAdmin,
      canManageMemberships: isAdmin,
    };

    return {
      userId,
      boardId,
      role,
      permissions,
    };
  } catch (error) {
    console.error('Error checking admin permissions:', error);
    return null;
  }
}

/**
 * Middleware function to require admin access
 * Use this in API routes to ensure only admins can access certain endpoints
 */
export async function requireAdminAccess(
  userId: string,
  boardId: string
): Promise<AdminContext> {
  const adminContext = await checkAdminPermissions(userId, boardId);
  
  if (!adminContext) {
    throw new Error('Admin access required');
  }
  
  return adminContext;
}

/**
 * Log admin actions for audit trail
 */
export async function logAdminAction(params: {
  adminUserId: string;
  targetUserId?: string;
  boardId?: string;
  action: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  category?: 'user_management' | 'security' | 'system' | 'data_access';
}): Promise<void> {
  try {
    const supabase = createAdminClient();

    const auditEntry = {
      admin_user_id: params.adminUserId,
      target_user_id: params.targetUserId,
      board_id: params.boardId,
      action: params.action,
      details: params.details ? JSON.stringify({
        ...params.details,
        severity: params.severity || 'medium',
        category: params.category || 'user_management',
        timestamp: new Date().toISOString(),
      }) : null,
      ip_address: params.ipAddress,
      user_agent: params.userAgent,
    };

    await supabase.from('admin_audit_log').insert(auditEntry);

    // Log to console for immediate monitoring in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Admin Action Logged:', {
        action: params.action,
        admin: params.adminUserId,
        board: params.boardId,
        target: params.targetUserId,
        severity: params.severity || 'medium',
      });
    }

    // Alert for critical security events
    if (params.severity === 'critical') {
      console.error('CRITICAL SECURITY EVENT:', params);
      // TODO: Implement alerting system (email, Slack, etc.)
    }
  } catch (error) {
    console.error('Error logging admin action:', error);
    // Don't throw here as we don't want audit logging to break the main operation
  }
}

/**
 * Get client IP address from request headers
 */
export function getClientIP(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwarded) {
    return forwarded.split(',')[0]?.trim();
  }
  
  return realIP || cfConnectingIP || undefined;
}

/**
 * Get user agent from request headers
 */
export function getUserAgent(request: Request): string | undefined {
  return request.headers.get('user-agent') || undefined;
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Generate a secure random token for invitations
 */
export function generateInvitationToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Calculate invitation expiry date (default: 7 days from now)
 */
export function getInvitationExpiry(days: number = 7): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}
