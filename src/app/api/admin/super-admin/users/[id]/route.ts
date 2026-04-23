import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import {
  createAdminClient,
  getClientIP,
  getUserAgent,
  logAdminAction,
} from "@/lib/supabase/admin";
import {
  superAdminUpdateUserSchema,
  userIdSchema,
} from "@/lib/validations/admin";

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  status: string;
  api_access_enabled: boolean;
};

// Effectively permanent ban (~100 years)
const BAN_DURATION = "876600h";

function getAuthErrorResponse(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "Authentication required") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error.message === "Super Admin access required") {
      return NextResponse.json(
        { error: "Super Admin access required" },
        { status: 403 },
      );
    }
  }
  return null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireSuperAdmin();
    const { id } = await params;

    const userIdValidation = userIdSchema.safeParse(id);
    if (!userIdValidation.success) {
      return NextResponse.json(
        { error: "Invalid user ID", details: userIdValidation.error.issues },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const validation = superAdminUpdateUserSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const targetUserId = userIdValidation.data;
    const { name, status, apiAccessEnabled } = validation.data;

    const adminClient = createAdminClient();

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id, email, name, created_at, status, api_access_enabled")
      .eq("id", targetUserId)
      .single();

    if (existingUserError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const row = existingUser as UserRow;
    const updateData: Record<string, unknown> = {};
    const changes: Record<string, unknown> = {};

    if (name !== undefined && name !== row.name) {
      updateData.name = name;
      changes.name = { from: row.name, to: name };

      // Also update auth metadata
      const { data: authUserData } =
        await adminClient.auth.admin.getUserById(targetUserId);
      const existingMeta =
        (authUserData?.user?.user_metadata as Record<string, unknown>) ?? {};
      await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: { ...existingMeta, name },
      });
    }

    if (status !== undefined && status !== row.status) {
      updateData.status = status;
      changes.status = { from: row.status, to: status };

      if (status === "deactivated") {
        updateData.deactivated_at = new Date().toISOString();
        // Ban in Supabase auth, record status in app_metadata, revoke sessions
        await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: BAN_DURATION,
          app_metadata: { status: "deactivated" },
        });
        await adminClient.auth.admin.signOut(targetUserId, "global");
      } else if (status === "active") {
        // Unban in Supabase auth and mark active in app_metadata
        await adminClient.auth.admin.updateUserById(targetUserId, {
          ban_duration: "none",
          app_metadata: { status: "active" },
        });
      }
    }

    if (
      apiAccessEnabled !== undefined &&
      apiAccessEnabled !== row.api_access_enabled
    ) {
      updateData.api_access_enabled = apiAccessEnabled;
      changes.apiAccessEnabled = {
        from: row.api_access_enabled,
        to: apiAccessEnabled,
      };
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No changes applied", user: row });
    }

    const { error: updateError } = await adminClient
      .from("users")
      .update(updateData)
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Error updating user:", updateError);
      return NextResponse.json(
        { error: "Failed to update user" },
        { status: 500 },
      );
    }

    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);

    await logAdminAction({
      adminUserId: currentUser.id,
      targetUserId,
      action: "update_global_user",
      details: changes,
      ...(clientIP ? { ipAddress: clientIP } : {}),
      ...(userAgent ? { userAgent } : {}),
      category: "system",
    });

    return NextResponse.json({
      message: "User updated successfully",
      user: {
        id: row.id,
        email: row.email,
        name: name ?? row.name,
        createdAt: row.created_at,
        status: status ?? row.status,
        apiAccessEnabled: apiAccessEnabled ?? row.api_access_enabled,
      },
    });
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    if (authError) return authError;

    console.error("Error in PATCH /api/admin/super-admin/users/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE = deactivate (data is preserved, login is blocked)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireSuperAdmin();
    const { id } = await params;

    const userIdValidation = userIdSchema.safeParse(id);
    if (!userIdValidation.success) {
      return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
    }

    const targetUserId = userIdValidation.data;

    if (targetUserId === currentUser.id) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id, email, name, status")
      .eq("id", targetUserId)
      .single();

    if (existingUserError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Deactivate in public.users
    const { error: updateError } = await adminClient
      .from("users")
      .update({
        status: "deactivated",
        deactivated_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);

    if (updateError) {
      console.error("Error deactivating user:", updateError);
      return NextResponse.json(
        { error: "Failed to deactivate user" },
        { status: 500 },
      );
    }

    // Ban in Supabase auth, record status in app_metadata, revoke sessions
    await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: BAN_DURATION,
      app_metadata: { status: "deactivated" },
    });
    await adminClient.auth.admin.signOut(targetUserId, "global");

    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);

    await logAdminAction({
      adminUserId: currentUser.id,
      targetUserId,
      action: "deactivate_global_user",
      details: { email: (existingUser as UserRow).email },
      ...(clientIP ? { ipAddress: clientIP } : {}),
      ...(userAgent ? { userAgent } : {}),
      category: "system",
    });

    return NextResponse.json({ message: "User deactivated successfully" });
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    if (authError) return authError;

    console.error("Error in DELETE /api/admin/super-admin/users/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
