import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  requireAdminAccess,
  logAdminAction,
  getClientIP,
  getUserAgent,
  generateInvitationToken,
  getInvitationExpiry,
} from "@/lib/supabase/admin";
import { inviteUserSchema, paginationSchema } from "@/lib/validations/admin";

/**
 * GET /api/admin/users - Get paginated list of board users
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

    // Build query for board members with user details
    const adminClient = createAdminClient();
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

    const { data: members, error: membersError } = await query;

    if (membersError) {
      console.error("Error fetching board members:", membersError);
      return NextResponse.json(
        { error: "Failed to fetch users" },
        { status: 500 },
      );
    }

    // Get total count for pagination
    const { count, error: countError } = await adminClient
      .from("board_members")
      .select("*", { count: "exact", head: true })
      .eq("board_id", boardId);

    if (countError) {
      console.error("Error counting board members:", countError);
      return NextResponse.json(
        { error: "Failed to count users" },
        { status: 500 },
      );
    }

    // Transform the response
    const users = members.map((member: unknown) => {
      const m = member as {
        users: { id: string; email: string; name: string; created_at: string };
        role: string;
        created_at: string;
      };
      return {
        id: m.users.id,
        email: m.users.email,
        name: m.users.name,
        role: m.role,
        joinedAt: m.created_at,
        createdAt: m.users.created_at,
      };
    });

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Error in GET /api/admin/users:", error);

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
 * POST /api/admin/users - Invite a new user to the board
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = inviteUserSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { email, role, boardId } = validation.data;

    // Check admin permissions
    const _adminContext = await requireAdminAccess(user.id, boardId);

    const adminClient = createAdminClient();

    // Check if user is already a member of this board
    const { data: existingMember } = await adminClient
      .from("board_members")
      .select("user_id")
      .eq("board_id", boardId)
      .eq("users.email", email)
      .single();

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member of this board" },
        { status: 409 },
      );
    }

    // Check if there's already a pending invitation
    const { data: existingInvitation } = await adminClient
      .from("user_invitations")
      .select("id")
      .eq("email", email)
      .eq("board_id", boardId)
      .is("accepted_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (existingInvitation) {
      return NextResponse.json(
        { error: "User already has a pending invitation" },
        { status: 409 },
      );
    }

    // Generate invitation token and expiry
    const token = generateInvitationToken();
    const expiresAt = getInvitationExpiry();

    // Create invitation record
    const { data: invitation, error: invitationError } = await adminClient
      .from("user_invitations")
      .insert({
        email,
        board_id: boardId,
        role,
        invited_by: user.id,
        token,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (invitationError) {
      console.error("Error creating invitation:", invitationError);
      return NextResponse.json(
        { error: "Failed to create invitation" },
        { status: 500 },
      );
    }

    // Send invitation email using Supabase Auth Admin API
    const { data: _inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}${process.env.NEXT_PUBLIC_BASE_PATH || ""}/auth/accept-invitation?token=${token}`,
        data: {
          boardId,
          role,
          invitationId: invitation.id,
        },
      });

    if (inviteError) {
      console.error("Error sending invitation email:", inviteError);
      // Clean up the invitation record
      await adminClient
        .from("user_invitations")
        .delete()
        .eq("id", invitation.id);
      return NextResponse.json(
        { error: "Failed to send invitation email" },
        { status: 500 },
      );
    }

    // Log admin action
    await logAdminAction({
      adminUserId: user.id,
      boardId,
      action: "invite_user",
      details: { email, role, invitationId: invitation.id },
      ipAddress: getClientIP(request) || "unknown",
      userAgent: getUserAgent(request) || "unknown",
    });

    return NextResponse.json(
      {
        message: "Invitation sent successfully",
        invitation: {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expires_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error in POST /api/admin/users:", error);

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
