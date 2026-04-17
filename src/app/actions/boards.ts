"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";
import type { Board } from "@/types/database";

export type BoardActionState =
  | { status: "idle" }
  | { status: "success"; board: Board }
  | { status: "error"; error: string };

export const INITIAL_BOARD_STATE: BoardActionState = { status: "idle" };

const createBoardSchema = z.object({
  name: z.string().trim().min(1, "Board name is required"),
  templateId: z.string().optional().nullable(),
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

  const { data: newBoard, error: boardError } = await supabase
    .from("boards")
    .insert({ name: parsed.data.name, owner_id: user.id })
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
    } as Board,
  };
}
