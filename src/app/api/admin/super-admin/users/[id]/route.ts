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
};

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
    const { name } = validation.data;
    if (typeof name !== "string") {
      return NextResponse.json(
        { error: "Display name is required" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id, email, name, created_at")
      .eq("id", targetUserId)
      .single();

    if (existingUserError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentName = (existingUser as UserRow).name ?? null;
    if (name === currentName) {
      return NextResponse.json({
        message: "No changes applied",
        user: {
          id: (existingUser as UserRow).id,
          email: (existingUser as UserRow).email,
          name: currentName,
          createdAt: (existingUser as UserRow).created_at,
        },
      });
    }

    const { data: authUserData, error: authUserError } =
      await adminClient.auth.admin.getUserById(targetUserId);

    if (authUserError || !authUserData.user) {
      console.error("Error loading target auth user:", authUserError);
      return NextResponse.json(
        { error: "Failed to load auth user" },
        { status: 500 },
      );
    }

    const existingMetadata =
      (authUserData.user.user_metadata as
        | Record<string, unknown>
        | undefined) ?? {};

    const { error: authUpdateError } =
      await adminClient.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          ...existingMetadata,
          name,
        },
      });

    if (authUpdateError) {
      console.error("Error updating auth metadata:", authUpdateError);
      return NextResponse.json(
        { error: "Failed to update user name" },
        { status: 500 },
      );
    }

    const { error: profileUpdateError } = await adminClient
      .from("users")
      .update({ name })
      .eq("id", targetUserId);

    if (profileUpdateError) {
      console.error("Error updating user profile:", profileUpdateError);
      return NextResponse.json(
        { error: "Failed to update user profile" },
        { status: 500 },
      );
    }

    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);

    await logAdminAction({
      adminUserId: currentUser.id,
      targetUserId,
      action: "update_global_user",
      details: {
        nameChanged: {
          from: currentName,
          to: name,
        },
      },
      ...(clientIP ? { ipAddress: clientIP } : {}),
      ...(userAgent ? { userAgent } : {}),
      category: "system",
    });

    return NextResponse.json({
      message: "User updated successfully",
      user: {
        id: (existingUser as UserRow).id,
        email: (existingUser as UserRow).email,
        name,
        createdAt: (existingUser as UserRow).created_at,
      },
    });
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    if (authError) {
      return authError;
    }

    console.error("Error in PATCH /api/admin/super-admin/users/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
