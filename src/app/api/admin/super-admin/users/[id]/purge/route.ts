import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdmin } from "@/lib/auth";
import {
  createAdminClient,
  getClientIP,
  getUserAgent,
  logAdminAction,
} from "@/lib/supabase/admin";
import { userIdSchema } from "@/lib/validations/admin";

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

async function deleteStorageBucket(
  adminClient: ReturnType<typeof createAdminClient>,
  bucket: string,
  prefix: string,
) {
  const { data: files } = await adminClient.storage
    .from(bucket)
    .list(prefix, { limit: 1000 });

  if (files && files.length > 0) {
    const paths = files.map((f) => `${prefix}/${f.name}`);
    await adminClient.storage.from(bucket).remove(paths);
  }
}

// DELETE /api/admin/super-admin/users/[id]/purge
// Permanently deletes a deactivated user and all data they owned.
// Comments and files the user contributed to boards they did NOT own are preserved.
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
        { error: "You cannot delete your own account" },
        { status: 400 },
      );
    }

    const adminClient = createAdminClient();

    // Verify user exists and is deactivated
    const { data: existingUser, error: fetchError } = await adminClient
      .from("users")
      .select("id, email, name, status")
      .eq("id", targetUserId)
      .single();

    if (fetchError || !existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const user = existingUser as {
      id: string;
      email: string;
      name: string | null;
      status: string;
    };

    if (user.status !== "deactivated") {
      return NextResponse.json(
        {
          error:
            "User must be deactivated before being permanently deleted. Deactivate the user first.",
        },
        { status: 400 },
      );
    }

    // ── 1. Collect owned board IDs ───────────────────────────────────────────

    const { data: ownedBoards } = await adminClient
      .from("boards")
      .select("id")
      .eq("owner_id", targetUserId);

    const ownedBoardIds = (ownedBoards ?? []).map((b: { id: string }) => b.id);

    // ── 2. Collect card IDs within owned boards ──────────────────────────────

    let ownedCardIds: string[] = [];
    if (ownedBoardIds.length > 0) {
      // Get all columns in owned boards, then get cards from those columns
      const { data: columns } = await adminClient
        .from("columns")
        .select("id")
        .in("board_id", ownedBoardIds);

      const columnIds = (columns ?? []).map((c: { id: number }) => c.id);

      if (columnIds.length > 0) {
        const { data: cards } = await adminClient
          .from("cards")
          .select("id")
          .in("column_id", columnIds);

        ownedCardIds = (cards ?? []).map((c: { id: string }) => c.id);
      }
    }

    // ── 3. Clean up storage ──────────────────────────────────────────────────

    // Delete avatar files for this user
    await deleteStorageBucket(adminClient, "avatars", targetUserId);

    // Delete card attachments only for cards on boards the user owned
    for (const cardId of ownedCardIds) {
      await deleteStorageBucket(adminClient, "card-attachments", cardId);
    }

    // ── 4. Delete from public.users (cascades to all owned data) ────────────
    // Comments on boards NOT owned by this user get author_id = NULL (migration 20).
    // Comments on owned boards are cascade-deleted via board → column → card → comments.

    const { error: deleteError } = await adminClient
      .from("users")
      .delete()
      .eq("id", targetUserId);

    if (deleteError) {
      console.error("Error deleting user from public.users:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete user data" },
        { status: 500 },
      );
    }

    // ── 5. Delete from auth.users ────────────────────────────────────────────

    const { error: authDeleteError } =
      await adminClient.auth.admin.deleteUser(targetUserId);

    if (authDeleteError) {
      console.error("Error deleting user from auth.users:", authDeleteError);
      // public.users is already deleted at this point — log but don't fail
      console.error(
        "Warning: public.users deleted but auth.users deletion failed for",
        targetUserId,
      );
    }

    // ── 6. Audit log ─────────────────────────────────────────────────────────

    const clientIP = getClientIP(request);
    const userAgent = getUserAgent(request);

    await logAdminAction({
      adminUserId: currentUser.id,
      action: "purge_global_user",
      details: {
        email: user.email,
        name: user.name,
        ownedBoardsDeleted: ownedBoardIds.length,
        ownedCardsDeleted: ownedCardIds.length,
      },
      ...(clientIP ? { ipAddress: clientIP } : {}),
      ...(userAgent ? { userAgent } : {}),
      category: "system",
    });

    return NextResponse.json({ message: "User permanently deleted" });
  } catch (error) {
    const authError = getAuthErrorResponse(error);
    if (authError) return authError;

    console.error(
      "Error in DELETE /api/admin/super-admin/users/[id]/purge:",
      error,
    );
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
