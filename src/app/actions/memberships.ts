"use server";

import { getSessionUser } from "@/lib/supabase/server";
import {
  createAdminClient,
  requireAdminAccess,
  logAdminAction,
} from "@/lib/supabase/admin";
import { createNotifications } from "@/lib/notifications";
import {
  addMembershipSchema,
  validateRoleAssignment,
} from "@/lib/validations/admin";

export type AddMemberActionState =
  | { status: "idle" }
  | {
      status: "success";
      membership: { userId: string; email: string; name: string; role: string };
    }
  | { status: "error"; error: string };

export const INITIAL_ADD_MEMBER_STATE: AddMemberActionState = {
  status: "idle",
};

export async function addMemberAction(
  _prev: AddMemberActionState,
  formData: FormData,
): Promise<AddMemberActionState> {
  const { user } = await getSessionUser();
  if (!user) {
    return { status: "error", error: "Unauthorized" };
  }

  const parsed = addMembershipSchema.safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    boardId: formData.get("boardId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { userId: targetUserId, role, boardId } = parsed.data;

  let adminContext;
  try {
    adminContext = await requireAdminAccess(user.id, boardId);
  } catch {
    return { status: "error", error: "Admin access required" };
  }

  const roleAssignmentValidation = validateRoleAssignment(
    adminContext.role,
    role,
  );
  if (!roleAssignmentValidation.isValid) {
    return {
      status: "error",
      error: roleAssignmentValidation.error ?? "Invalid role assignment",
    };
  }

  const adminClient = createAdminClient();

  const { data: targetUser } = await adminClient
    .from("users")
    .select("id, email, name")
    .eq("id", targetUserId)
    .single();

  if (!targetUser) {
    return { status: "error", error: "Registered user not found" };
  }

  const { data: existingMembership } = await adminClient
    .from("board_members")
    .select("user_id")
    .eq("board_id", boardId)
    .eq("user_id", targetUserId)
    .maybeSingle();

  if (existingMembership) {
    return {
      status: "error",
      error: "User is already a member of this board",
    };
  }

  const { error: insertError } = await adminClient
    .from("board_members")
    .insert({ board_id: boardId, user_id: targetUserId, role });

  if (insertError) {
    return { status: "error", error: "Failed to add user to board" };
  }

  if (targetUserId !== user.id) {
    const { data: board } = await adminClient
      .from("boards")
      .select("id, name")
      .eq("id", boardId)
      .single();

    if (board) {
      await createNotifications(adminClient, [
        {
          user_id: targetUserId,
          type: "board_member_added",
          actor_id: user.id,
          card_id: null,
          board_id: boardId,
          metadata: { boardName: board.name, role },
        },
      ]);
    }
  }

  await logAdminAction({
    adminUserId: user.id,
    targetUserId,
    boardId,
    action: "add_user",
    details: {
      addedUser: {
        email: targetUser.email,
        name: targetUser.name,
        role,
      },
    },
  });

  return {
    status: "success",
    membership: {
      userId: targetUserId,
      email: targetUser.email ?? "",
      name: targetUser.name ?? "",
      role,
    },
  };
}
