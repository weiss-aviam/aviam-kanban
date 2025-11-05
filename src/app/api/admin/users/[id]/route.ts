import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  requireAdminAccess,
  logAdminAction,
  getClientIP,
  getUserAgent,
} from "@/lib/supabase/admin";
import {
  validateSelfRoleChange,
  validateRoleAssignment,
  validateOwnerRequirement,
  updateUserSchema,
} from "@/lib/validations/admin";

/**
 * PATCH /api/admin/users/[id] - Update user details and role
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetUserId = id;
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "Board ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = updateUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { name, role } = validation.data;

    // Check admin permissions
    const _adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get current user details and role
    const { data: targetUser, error: userError } = await adminClient
      .from("board_members")
      .select(
        `
        role,
        users!inner (
          id,
          email,
          name
        )
      `,
      )
      .eq("board_id", boardId)
      .eq("user_id", targetUserId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: "User not found in this board" },
        { status: 404 },
      );
    }

    const currentTargetRole = targetUser.role;

    // Validate role change permissions
    if (role) {
      const selfRoleValidation = validateSelfRoleChange(
        _adminContext.role,
        targetUserId,
        user.id,
        role,
      );
      if (!selfRoleValidation.isValid) {
        return NextResponse.json(
          { error: selfRoleValidation.error },
          { status: 403 },
        );
      }

      const roleAssignmentValidation = validateRoleAssignment(
        _adminContext.role,
        role,
      );
      if (!roleAssignmentValidation.isValid) {
        return NextResponse.json(
          { error: roleAssignmentValidation.error },
          { status: 403 },
        );
      }

      const ownerValidation = validateOwnerRequirement(
        currentTargetRole,
        targetUserId,
        user.id,
        role,
      );
      if (!ownerValidation.isValid) {
        return NextResponse.json(
          { error: ownerValidation.error },
          { status: 403 },
        );
      }
    }

    const _updates: Record<string, unknown> = {};
    const auditDetails: Record<string, unknown> = {};

    // Update user name if provided
    const targetUsers = (
      targetUser as unknown as {
        users?: { name?: string } | { name?: string }[];
      }
    ).users;
    const currentName = Array.isArray(targetUsers)
      ? targetUsers[0]?.name
      : targetUsers?.name;
    if (name && name !== currentName) {
      const { error: nameUpdateError } =
        await adminClient.auth.admin.updateUserById(targetUserId, {
          user_metadata: { name },
        });

      if (nameUpdateError) {
        console.error("Error updating user name:", nameUpdateError);
        return NextResponse.json(
          { error: "Failed to update user name" },
          { status: 500 },
        );
      }

      // Also update in our users table
      await adminClient.from("users").update({ name }).eq("id", targetUserId);

      auditDetails.nameChanged = {
        from: currentName,
        to: name,
      };
    }

    // Update user role if provided
    if (role && role !== currentTargetRole) {
      const { error: roleUpdateError } = await adminClient
        .from("board_members")
        .update({ role })
        .eq("board_id", boardId)
        .eq("user_id", targetUserId);

      if (roleUpdateError) {
        console.error("Error updating user role:", roleUpdateError);
        return NextResponse.json(
          { error: "Failed to update user role" },
          { status: 500 },
        );
      }

      auditDetails.roleChanged = { from: currentTargetRole, to: role };
    }

    // Get updated user data
    const { data: updatedUser, error: fetchError } = await adminClient
      .from("board_members")
      .select(
        `
        role,
        created_at,
        users!inner (
          id,
          email,
          name,
          created_at
        )
      `,
      )
      .eq("board_id", boardId)
      .eq("user_id", targetUserId)
      .single();

    if (fetchError) {
      console.error("Error fetching updated user:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch updated user" },
        { status: 500 },
      );
    }

    // Log admin action
    await logAdminAction({
      adminUserId: user.id,
      targetUserId,
      boardId,
      action: "update_user",
      details: auditDetails,
      ipAddress: getClientIP(request) || "unknown",
      userAgent: getUserAgent(request) || "unknown",
    });

    return NextResponse.json({
      message: "User updated successfully",
      user: (() => {
        const u = (
          updatedUser as unknown as {
            users?:
              | {
                  id?: string;
                  email?: string;
                  name?: string;
                  created_at?: string;
                }
              | {
                  id?: string;
                  email?: string;
                  name?: string;
                  created_at?: string;
                }[];
          }
        ).users;
        const userObj = Array.isArray(u) ? u[0] : u;
        return {
          id: userObj?.id,
          email: userObj?.email,
          name: userObj?.name,
          role: (updatedUser as unknown as { role?: unknown }).role,
          joinedAt: (updatedUser as unknown as { created_at?: unknown })
            .created_at,
          createdAt: userObj?.created_at,
        };
      })(),
    });
  } catch (error) {
    console.error("Error in PATCH /api/admin/users/[id]:", error);

    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/admin/users/[id] - Remove user from board
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetUserId = id;
    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "Board ID is required" },
        { status: 400 },
      );
    }

    // Check admin permissions
    const _adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Get target user details
    const { data: targetUser, error: userError } = await adminClient
      .from("board_members")
      .select(
        `
        role,
        users!inner (
          id,
          email,
          name
        )
      `,
      )
      .eq("board_id", boardId)
      .eq("user_id", targetUserId)
      .single();

    if (userError || !targetUser) {
      return NextResponse.json(
        { error: "User not found in this board" },
        { status: 404 },
      );
    }

    // Validate removal permissions
    const ownerValidation = validateOwnerRequirement(
      targetUser.role,
      targetUserId,
      user.id,
      undefined,
      true,
    );
    if (!ownerValidation.isValid) {
      return NextResponse.json(
        { error: ownerValidation.error },
        { status: 403 },
      );
    }

    // Prevent self-removal
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the board" },
        { status: 403 },
      );
    }

    // Remove user from board
    const { error: removeError } = await adminClient
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", targetUserId);

    if (removeError) {
      console.error("Error removing user from board:", removeError);
      return NextResponse.json(
        { error: "Failed to remove user from board" },
        { status: 500 },
      );
    }

    // Log admin action
    await logAdminAction({
      adminUserId: user.id,
      targetUserId,
      boardId,
      action: "remove_user",
      details: {
        removedUser: (() => {
          const u = (
            targetUser as unknown as {
              users?:
                | { email?: string; name?: string }
                | { email?: string; name?: string }[];
            }
          ).users;
          const userObj = Array.isArray(u) ? u[0] : u;
          return {
            email: userObj?.email,
            name: userObj?.name,
            role: (targetUser as unknown as { role?: unknown }).role,
          };
        })(),
      },
      ipAddress: getClientIP(request) || "unknown",
      userAgent: getUserAgent(request) || "unknown",
    });

    return NextResponse.json({
      message: "User removed from board successfully",
    });
  } catch (error) {
    console.error("Error in DELETE /api/admin/users/[id]:", error);

    if (error instanceof Error && error.message === "Admin access required") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
