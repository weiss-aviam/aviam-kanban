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
  updateMembershipSchema,
  bulkUpdateMembershipsSchema,
  paginationSchema,
  removeUserSchema,
} from "@/lib/validations/admin";
import {
  validateRoleAssignment,
  validateOwnerRequirement,
} from "@/lib/validations/admin";

/**
 * GET /api/admin/memberships - Get all board memberships
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "Board ID is required" },
        { status: 400 },
      );
    }

    // Validate pagination parameters with defaults
    const paginationInput = {
      page: searchParams.get("page") || "1",
      limit: searchParams.get("limit") || "20",
      search: searchParams.get("search") || undefined,
      role: searchParams.get("role") || undefined,
      sortBy: searchParams.get("sortBy") || "name",
      sortOrder: searchParams.get("sortOrder") || "asc",
    };

    const paginationResult = paginationSchema.safeParse(paginationInput);

    if (!paginationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid pagination parameters",
          details: paginationResult.error.issues,
        },
        { status: 400 },
      );
    }

    const { page, limit, search, role, sortBy, sortOrder } =
      paginationResult.data;

    // Check admin permissions
    const _adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Build query for board memberships with user details and activity stats
    let query = adminClient
      .from("board_members")
      .select(
        `
        user_id,
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
      .eq("board_id", boardId);

    // Apply search filter
    if (search) {
      query = query.or(
        `users.name.ilike.%${search}%,users.email.ilike.%${search}%`,
      );
    }

    // Apply role filter
    if (role) {
      query = query.eq("role", role);
    }

    // Apply sorting
    if (sortBy === "joinedAt") {
      query = query.order("created_at", { ascending: sortOrder === "asc" });
    } else if (sortBy === "name") {
      query = query.order("users(name)", { ascending: sortOrder === "asc" });
    } else if (sortBy === "email") {
      query = query.order("users(email)", { ascending: sortOrder === "asc" });
    } else {
      query = query.order("role", { ascending: sortOrder === "asc" });
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: memberships, error: membershipsError } = await query;

    if (membershipsError) {
      console.error("Error fetching memberships:", membershipsError);
      return NextResponse.json(
        { error: "Failed to fetch memberships" },
        { status: 500 },
      );
    }

    // Get total count
    const { count, error: countError } = await adminClient
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("board_id", boardId);

    if (countError) {
      console.error("Error counting memberships:", countError);
      return NextResponse.json(
        { error: "Failed to count memberships" },
        { status: 500 },
      );
    }

    // Get activity stats for each user (optional enhancement)
    interface MembershipRow {
      user_id: string;
      role: string;
      created_at: string;
      users:
        | { id: string; email: string; name: string; created_at?: string }
        | { id: string; email: string; name: string; created_at?: string }[];
    }

    const userIds = (memberships as MembershipRow[]).map((m) => m.user_id);
    const { data: cardCounts } = await adminClient
      .from("cards")
      .select("assignee_id")
      .eq("board_id", boardId)
      .in("assignee_id", userIds);

    const { data: commentCounts } = await adminClient
      .from("comments")
      .select(
        `
        author_id,
        cards!inner(board_id)
      `,
      )
      .eq("cards.board_id", boardId)
      .in("author_id", userIds);

    // Calculate activity stats
    interface ActivityStats {
      assignedCards: number;
      comments: number;
    }

    const activityStats = userIds.reduce(
      (acc: Record<string, ActivityStats>, userId: string) => {
        acc[userId] = {
          assignedCards:
            (cardCounts as { assignee_id: string }[] | null)?.filter(
              (c) => c.assignee_id === userId,
            ).length || 0,
          comments:
            (commentCounts as { author_id: string }[] | null)?.filter(
              (c) => c.author_id === userId,
            ).length || 0,
        };
        return acc;
      },
      {} as Record<string, ActivityStats>,
    );

    // Transform the response
    const members = (memberships as MembershipRow[]).map((membership) => {
      const user = Array.isArray(membership.users)
        ? membership.users[0]
        : membership.users;
      return {
        id: user?.id,
        email: user?.email,
        name: user?.name,
        role: membership.role,
        joinedAt: membership.created_at,
        createdAt: user?.created_at,
        activity: activityStats[membership.user_id] || {
          assignedCards: 0,
          comments: 0,
        },
      };
    });

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      memberships: members,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      summary: {
        totalMembers: count || 0,
        roleDistribution: {
          owner: members.filter((m) => m.role === "owner").length,
          admin: members.filter((m) => m.role === "admin").length,
          member: members.filter((m) => m.role === "member").length,
          viewer: members.filter((m) => m.role === "viewer").length,
        },
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/memberships:", error);

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
 * PATCH /api/admin/memberships - Update member role
 */
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "Board ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();

    // Check if this is a bulk update or single update
    const isBulkUpdate = Array.isArray(body.updates);

    if (isBulkUpdate) {
      const validation = bulkUpdateMembershipsSchema.safeParse({
        ...body,
        boardId,
      });
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid input", details: validation.error.issues },
          { status: 400 },
        );
      }

      // Handle bulk update logic here
      return NextResponse.json(
        { error: "Bulk updates not implemented yet" },
        { status: 501 },
      );
    } else {
      const validation = updateMembershipSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json(
          { error: "Invalid input", details: validation.error.issues },
          { status: 400 },
        );
      }

      const { userId: targetUserId, role } = validation.data;

      // Check admin permissions
      const _adminContext = await requireAdminAccess(user.id, boardId);

      const adminClient = createAdminClient();

      // Get current membership details
      const { data: currentMembership, error: membershipError } =
        await adminClient
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

      if (membershipError || !currentMembership) {
        return NextResponse.json(
          { error: "User not found in this board" },
          { status: 404 },
        );
      }

      const currentRole = currentMembership.role;

      // Validate role assignment
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
        currentRole,
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

      // Update the membership role
      const { error: updateError } = await adminClient
        .from("board_members")
        .update({ role })
        .eq("board_id", boardId)
        .eq("user_id", targetUserId);

      if (updateError) {
        console.error("Error updating membership role:", updateError);
        return NextResponse.json(
          { error: "Failed to update membership role" },
          { status: 500 },
        );
      }

      // Log admin action
      await logAdminAction({
        adminUserId: user.id,
        targetUserId,
        boardId,
        action: "update_role",
        details: {
          roleChanged: { from: currentRole, to: role },
          targetUser: {
            email: "Unknown",
            name: "Unknown",
          },
        },
        ipAddress: getClientIP(request) || "unknown",
        userAgent: getUserAgent(request) || "unknown",
      });

      return NextResponse.json({
        message: "Membership role updated successfully",
        membership: {
          userId: targetUserId,
          email: "Unknown",
          name: "Unknown",
          role,
          previousRole: currentRole,
        },
      });
    }
  } catch (error) {
    console.error("Error in PATCH /api/admin/memberships:", error);

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
 * DELETE /api/admin/memberships - Remove member from board
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId) {
      return NextResponse.json(
        { error: "Board ID is required" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const validation = removeUserSchema.safeParse({ ...body, boardId });

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { userId: targetUserId } = validation.data;

    await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();
    const { data: targetUser, error: membershipError } = await adminClient
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

    if (membershipError || !targetUser) {
      return NextResponse.json(
        { error: "User not found in this board" },
        { status: 404 },
      );
    }

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

    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the board" },
        { status: 403 },
      );
    }

    const { error: removeError } = await adminClient
      .from("board_members")
      .delete()
      .eq("board_id", boardId)
      .eq("user_id", targetUserId);

    if (removeError) {
      console.error("Error removing member from board:", removeError);
      return NextResponse.json(
        { error: "Failed to remove user from board" },
        { status: 500 },
      );
    }

    await logAdminAction({
      adminUserId: user.id,
      targetUserId,
      boardId,
      action: "remove_user",
      details: {
        removedUser: (() => {
          const relatedUsers = (
            targetUser as unknown as {
              users?:
                | { email?: string; name?: string }
                | { email?: string; name?: string }[];
            }
          ).users;
          const targetDetails = Array.isArray(relatedUsers)
            ? relatedUsers[0]
            : relatedUsers;

          return {
            email: targetDetails?.email,
            name: targetDetails?.name,
            role: (targetUser as { role?: string }).role,
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
    console.error("Error in DELETE /api/admin/memberships:", error);

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
