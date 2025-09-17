import { z } from 'zod';

/**
 * Validation schemas for admin user management operations
 */

// Role validation
export const roleSchema = z.enum(['admin', 'member', 'viewer']);

// Board ID validation
export const boardIdSchema = z.string().uuid({
  message: 'Board ID must be a valid UUID',
});

// User ID validation
export const userIdSchema = z.string().uuid({
  message: 'User ID must be a valid UUID',
});

// Email validation
export const emailSchema = z.string().email({
  message: 'Please enter a valid email address',
});

// Name validation
export const nameSchema = z.string()
  .min(1, 'Name is required')
  .max(100, 'Name must be less than 100 characters')
  .trim();

/**
 * Schema for inviting a new user
 */
export const inviteUserSchema = z.object({
  email: emailSchema,
  role: roleSchema,
  boardId: boardIdSchema,
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/**
 * Schema for bulk inviting users
 */
export const bulkInviteUsersSchema = z.object({
  invitations: z.array(z.object({
    email: emailSchema,
    role: roleSchema,
  })).min(1, 'At least one invitation is required').max(50, 'Maximum 50 invitations at once'),
  boardId: boardIdSchema,
});

export type BulkInviteUsersInput = z.infer<typeof bulkInviteUsersSchema>;

/**
 * Schema for updating user details
 */
export const updateUserSchema = z.object({
  name: nameSchema.optional(),
  role: roleSchema.optional(),
}).refine(
  (data) => data.name !== undefined || data.role !== undefined,
  {
    message: 'At least one field (name or role) must be provided',
  }
);

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Schema for updating board membership
 */
export const updateMembershipSchema = z.object({
  userId: userIdSchema,
  role: roleSchema,
});

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;

/**
 * Schema for bulk updating memberships
 */
export const bulkUpdateMembershipsSchema = z.object({
  updates: z.array(z.object({
    userId: userIdSchema,
    role: roleSchema,
  })).min(1, 'At least one update is required').max(100, 'Maximum 100 updates at once'),
  boardId: boardIdSchema,
});

export type BulkUpdateMembershipsInput = z.infer<typeof bulkUpdateMembershipsSchema>;

/**
 * Schema for removing user from board
 */
export const removeUserSchema = z.object({
  userId: userIdSchema,
  boardId: boardIdSchema,
});

export type RemoveUserInput = z.infer<typeof removeUserSchema>;

/**
 * Schema for password reset
 */
export const resetPasswordSchema = z.object({
  userId: userIdSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Schema for pagination parameters
 */
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  role: z.enum(['owner', 'admin', 'member', 'viewer', 'all']).optional(),
  sortBy: z.enum(['name', 'email', 'role', 'joinedAt']).default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Schema for audit log filters
 */
export const auditLogFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z.string().optional(),
  targetUserId: userIdSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type AuditLogFiltersInput = z.infer<typeof auditLogFiltersSchema>;

/**
 * Schema for accepting invitation
 */
export const acceptInvitationSchema = z.object({
  token: z.string().min(1, 'Invitation token is required'),
  name: nameSchema.optional(),
});

export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;

/**
 * Validation helper functions
 */

/**
 * Validate that a user is not trying to modify their own role to a lower level
 */
export function validateSelfRoleChange(
  currentUserRole: string,
  targetUserId: string,
  currentUserId: string,
  newRole?: string
): { isValid: boolean; error?: string } {
  // Users cannot modify their own role
  if (targetUserId === currentUserId && newRole) {
    return {
      isValid: false,
      error: 'You cannot modify your own role',
    };
  }

  return { isValid: true };
}

/**
 * Validate that a user has permission to assign a specific role
 */
export function validateRoleAssignment(
  currentUserRole: string,
  targetRole: string
): { isValid: boolean; error?: string } {
  // Only owners can assign admin roles
  if (targetRole === 'admin' && currentUserRole !== 'owner') {
    return {
      isValid: false,
      error: 'Only board owners can assign admin roles',
    };
  }

  return { isValid: true };
}

/**
 * Validate that a board has at least one owner
 */
export function validateOwnerRequirement(
  currentUserRole: string,
  targetUserId: string,
  currentUserId: string,
  newRole?: string,
  isRemoval: boolean = false
): { isValid: boolean; error?: string } {
  // Prevent removing the last owner or changing owner role
  if (currentUserRole === 'owner' && targetUserId === currentUserId) {
    if (isRemoval) {
      return {
        isValid: false,
        error: 'Cannot remove the board owner. Transfer ownership first.',
      };
    }
    
    if (newRole && newRole !== 'owner') {
      return {
        isValid: false,
        error: 'Cannot change owner role. Transfer ownership first.',
      };
    }
  }

  return { isValid: true };
}
