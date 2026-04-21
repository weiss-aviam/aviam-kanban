"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";
import type { Board } from "@/types/database";
import type { BoardActionState } from "./boards-state";

const createBoardSchema = z.object({
  name: z.string().trim().min(1, "Board name is required"),
  templateId: z.string().optional().nullable(),
  groupId: z.string().uuid("Invalid group ID").optional().nullable(),
});

const updateBoardSchema = z.object({
  boardId: z.string().uuid("Invalid board ID"),
  name: z.string().trim().min(1, "Board name is required"),
  description: z.string().optional().nullable(),
});

export async function createBoardAction(
  _prev: BoardActionState,
  formData: FormData,
): Promise<BoardActionState> {
  const parsed = createBoardSchema.safeParse({
    name: formData.get("name"),
    templateId: formData.get("templateId") || null,
    groupId: formData.get("groupId") || null,
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { supabase, user } = await getSessionUser();
  if (!user) {
    return { status: "error", error: "Unauthorized" };
  }

  const templateId = parsed.data.templateId
    ? Number(parsed.data.templateId)
    : null;

  let templateColumns: Array<{ title: string; position: number }> = [];
  if (templateId) {
    const { data: template } = await supabase
      .from("column_templates")
      .select("id, template_columns (title, position)")
      .eq("id", templateId)
      .single();
    if (!template) {
      return { status: "error", error: "Template not found" };
    }
    templateColumns = (
      template.template_columns as Array<{ title: string; position: number }>
    ).sort((a, b) => a.position - b.position);
  } else {
    const { data: defaultTemplate } = await supabase
      .from("column_templates")
      .select("id, template_columns (title, position)")
      .eq("is_default", true)
      .single();
    if (defaultTemplate) {
      templateColumns = (
        defaultTemplate.template_columns as Array<{
          title: string;
          position: number;
        }>
      ).sort((a, b) => a.position - b.position);
    } else {
      templateColumns = [
        { title: "To Do", position: 1 },
        { title: "In Progress", position: 2 },
        { title: "Done", position: 3 },
      ];
    }
  }

  // Verify the group exists and is visible to the user (RLS protects).
  // Without this check, a malicious caller could orphan boards under a
  // group ID they have no access to.
  if (parsed.data.groupId) {
    const { data: group } = await supabase
      .from("board_groups")
      .select("id")
      .eq("id", parsed.data.groupId)
      .maybeSingle();
    if (!group) {
      return { status: "error", error: "Group not found or access denied" };
    }
  }

  const { data: newBoard, error: boardError } = await supabase
    .from("boards")
    .insert({
      name: parsed.data.name,
      owner_id: user.id,
      group_id: parsed.data.groupId ?? null,
    })
    .select()
    .single();
  if (boardError || !newBoard) {
    return { status: "error", error: "Failed to create board" };
  }

  const { error: memberError } = await supabase.from("board_members").insert({
    board_id: newBoard.id,
    user_id: user.id,
    role: "owner",
  });
  if (memberError) {
    return { status: "error", error: "Failed to add board member" };
  }

  if (templateColumns.length > 0) {
    await supabase.from("columns").insert(
      templateColumns.map((col) => ({
        board_id: newBoard.id,
        title: col.title,
        position: col.position,
      })),
    );
  }

  return {
    status: "success",
    board: {
      id: newBoard.id,
      name: newBoard.name,
      isArchived: newBoard.is_archived,
      createdAt: newBoard.created_at,
      ownerId: newBoard.owner_id,
      role: "owner",
      description: null,
      updatedAt: newBoard.updated_at,
      groupId: newBoard.group_id ?? null,
      groupPosition: newBoard.group_position ?? 0,
      createdVia: newBoard.created_via,
    } as Board,
  };
}

export async function updateBoardAction(
  _prev: BoardActionState,
  formData: FormData,
): Promise<BoardActionState> {
  const parsed = updateBoardSchema.safeParse({
    boardId: formData.get("boardId"),
    name: formData.get("name"),
    description: formData.get("description") || null,
  });
  if (!parsed.success) {
    return {
      status: "error",
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const { supabase, user } = await getSessionUser();
  if (!user) {
    return { status: "error", error: "Unauthorized" };
  }

  const { data: memberData } = await supabase
    .from("board_members")
    .select("role")
    .eq("board_id", parsed.data.boardId)
    .eq("user_id", user.id)
    .single();

  if (!memberData) {
    return { status: "error", error: "Board not found or access denied" };
  }
  if (memberData.role !== "owner" && memberData.role !== "admin") {
    return { status: "error", error: "Insufficient permissions" };
  }

  const { data: updated, error: updateError } = await supabase
    .from("boards")
    .update({
      name: parsed.data.name,
      description: parsed.data.description?.trim() || null,
    })
    .eq("id", parsed.data.boardId)
    .select()
    .single();

  if (updateError || !updated) {
    return { status: "error", error: "Failed to update board" };
  }

  return {
    status: "success",
    board: {
      id: updated.id,
      name: updated.name,
      description: updated.description ?? null,
      isArchived: updated.is_archived,
      createdAt: updated.created_at,
      updatedAt: updated.updated_at,
      ownerId: updated.owner_id,
      role: memberData.role,
      groupId: updated.group_id ?? null,
      groupPosition: updated.group_position ?? 0,
      createdVia: updated.created_via,
    } as Board,
  };
}
