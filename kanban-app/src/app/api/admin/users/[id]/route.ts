import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient, requireAdminAccess, logAdminAction, getClientIP, getUserAgent } from '@/lib/supabase/admin';
import { updateUserSchema, removeUserSchema } from '@/lib/validations/admin';
import { validateSelfRoleChange, validateRoleAssignment, validateOwnerRequirement } from '@/lib/validations/admin';

/**
 * PATCH /api/admin/users/[id] - Update user details and role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = id;
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
    }

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { name, role } = validation.data;

    // Check admin permissions
    const adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get current user details and role
    const { data: targetUser, error: userError } = await adminClient
      .from('board_members')
      .select(`
        role,
        users!inner (
          id,
          email,
          name
        )
      `)
      .eq('board_id', boardId)
      .eq('user_id', targetUserId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found in this board' }, { status: 404 });
    }

    const currentTargetRole = targetUser.role;

    // Validate role change permissions
    if (role) {
      const selfRoleValidation = validateSelfRoleChange(
        adminContext.role,
        targetUserId,
        user.id,
        role
      );
      if (!selfRoleValidation.isValid) {
        return NextResponse.json({ error: selfRoleValidation.error }, { status: 403 });
      }

      const roleAssignmentValidation = validateRoleAssignment(adminContext.role, role);
      if (!roleAssignmentValidation.isValid) {
        return NextResponse.json({ error: roleAssignmentValidation.error }, { status: 403 });
      }

      const ownerValidation = validateOwnerRequirement(
        currentTargetRole,
        targetUserId,
        user.id,
        role
      );
      if (!ownerValidation.isValid) {
        return NextResponse.json({ error: ownerValidation.error }, { status: 403 });
      }
    }

    const updates: any = {};
    const auditDetails: any = {};

    // Update user name if provided
    if (name && name !== (Array.isArray(targetUser.users) ? targetUser.users[0]?.name : targetUser.users?.name)) {
      const { error: nameUpdateError } = await adminClient.auth.admin.updateUserById(
        targetUserId,
        { user_metadata: { name } }
      );

      if (nameUpdateError) {
        console.error('Error updating user name:', nameUpdateError);
        return NextResponse.json({ error: 'Failed to update user name' }, { status: 500 });
      }

      // Also update in our users table
      await adminClient
        .from('users')
        .update({ name })
        .eq('id', targetUserId);

      auditDetails.nameChanged = {
        from: Array.isArray(targetUser.users) ? targetUser.users[0]?.name : targetUser.users?.name,
        to: name
      };
    }

    // Update user role if provided
    if (role && role !== currentTargetRole) {
      const { error: roleUpdateError } = await adminClient
        .from('board_members')
        .update({ role })
        .eq('board_id', boardId)
        .eq('user_id', targetUserId);

      if (roleUpdateError) {
        console.error('Error updating user role:', roleUpdateError);
        return NextResponse.json({ error: 'Failed to update user role' }, { status: 500 });
      }

      auditDetails.roleChanged = { from: currentTargetRole, to: role };
    }

    // Get updated user data
    const { data: updatedUser, error: fetchError } = await adminClient
      .from('board_members')
      .select(`
        role,
        created_at,
        users!inner (
          id,
          email,
          name,
          created_at
        )
      `)
      .eq('board_id', boardId)
      .eq('user_id', targetUserId)
      .single();

    if (fetchError) {
      console.error('Error fetching updated user:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch updated user' }, { status: 500 });
    }

    // Log admin action
    await logAdminAction({
      adminUserId: user.id,
      targetUserId,
      boardId,
      action: 'update_user',
      details: auditDetails,
      ipAddress: getClientIP(request) || "unknown",
      userAgent: getUserAgent(request) || "unknown",
    });

    return NextResponse.json({
      message: 'User updated successfully',
      user: {
        id: Array.isArray(updatedUser.users) ? updatedUser.users[0]?.id : updatedUser.users?.id,
        email: Array.isArray(updatedUser.users) ? updatedUser.users[0]?.email : updatedUser.users?.email,
        name: Array.isArray(updatedUser.users) ? updatedUser.users[0]?.name : updatedUser.users?.name,
        role: updatedUser.role,
        joinedAt: updatedUser.created_at,
        createdAt: Array.isArray(updatedUser.users) ? updatedUser.users[0]?.created_at : updatedUser.users?.created_at,
      },
    });

  } catch (error) {
    console.error('Error in PATCH /api/admin/users/[id]:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users/[id] - Remove user from board
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetUserId = id;
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get('boardId');

    if (!boardId) {
      return NextResponse.json({ error: 'Board ID is required' }, { status: 400 });
    }

    // Check admin permissions
    const adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get target user details
    const { data: targetUser, error: userError } = await adminClient
      .from('board_members')
      .select(`
        role,
        users!inner (
          id,
          email,
          name
        )
      `)
      .eq('board_id', boardId)
      .eq('user_id', targetUserId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json({ error: 'User not found in this board' }, { status: 404 });
    }

    // Validate removal permissions
    const ownerValidation = validateOwnerRequirement(
      targetUser.role,
      targetUserId,
      user.id,
      undefined,
      true
    );
    if (!ownerValidation.isValid) {
      return NextResponse.json({ error: ownerValidation.error }, { status: 403 });
    }

    // Prevent self-removal
    if (targetUserId === user.id) {
      return NextResponse.json({ error: 'You cannot remove yourself from the board' }, { status: 403 });
    }

    // Remove user from board
    const { error: removeError } = await adminClient
      .from('board_members')
      .delete()
      .eq('board_id', boardId)
      .eq('user_id', targetUserId);

    if (removeError) {
      console.error('Error removing user from board:', removeError);
      return NextResponse.json({ error: 'Failed to remove user from board' }, { status: 500 });
    }

    // Log admin action
    await logAdminAction({
      adminUserId: user.id,
      targetUserId,
      boardId,
      action: 'remove_user',
      details: {
        removedUser: {
          email: Array.isArray(targetUser.users) ? targetUser.users[0]?.email : targetUser.users?.email,
          name: Array.isArray(targetUser.users) ? targetUser.users[0]?.name : targetUser.users?.name,
          role: targetUser.role,
        },
      },
      ipAddress: getClientIP(request) || "unknown",
      userAgent: getUserAgent(request) || "unknown",
    });

    return NextResponse.json({
      message: 'User removed from board successfully',
    });

  } catch (error) {
    console.error('Error in DELETE /api/admin/users/[id]:', error);
    
    if (error instanceof Error && error.message === 'Admin access required') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
