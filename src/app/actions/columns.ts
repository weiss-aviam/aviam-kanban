"use server";

import { z } from "zod";
import { getSessionUser } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import type { Column } from "@/types/database";

export type ColumnActionState =
  | { status: "idle" }
  | { status: "success"; column: Column }
  | { status: "error"; error: string };

export const INITIAL_COLUMN_STATE: ColumnActionState = { status: "idle" };

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const createColumnSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  title: z
    .string()
    .trim()
    .min(1, "Column title is required")
    .max(120, "Column title too long"),
});

export async function createColumnAction(
  _prev: ColumnActionState,
  formData: FormData,
): Promise<ColumnActionState> {
  const parsed = createColumnSchema.safeParse({
    boardId: formData.get("boardId"),
    title: formData.get("title"),
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

  const { boardId, title } = parsed.data;

  const authorization = await getBoardMutationAuthorization(
    supabase as unknown as BoardAccessClient,
    boardId,
    user.id,
  );
  if (!authorization.ok) {
    return { status: "error", error: authorization.error };
  }

  const { data: maxPositionResult } = await supabase
    .from("columns")
    .select("position")
    .eq("board_id", boardId)
    .order("position", { ascending: false })
    .limit(1);
  const finalPosition = (maxPositionResult?.[0]?.position ?? 0) + 1;

  const { data: newColumn, error: columnError } = await supabase
    .from("columns")
    .insert({ board_id: boardId, title, position: finalPosition })
    .select()
    .single();

  if (columnError || !newColumn) {
    return { status: "error", error: "Failed to create column" };
  }

  return {
    status: "success",
    column: {
      id: newColumn.id,
      boardId: newColumn.board_id,
      title: newColumn.title,
      position: newColumn.position,
      isDone: newColumn.is_done ?? false,
      createdAt: newColumn.created_at,
    } as Column,
  };
}
