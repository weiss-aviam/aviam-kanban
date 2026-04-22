import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { z } from "zod";

const patchSubtaskSchema = z.object({
  completed: z.boolean().optional(),
  title: z.string().min(1).max(200).optional(),
});

type RouteContext = { params: Promise<{ id: string; subtaskId: string }> };

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: cardId, subtaskId } = await params;

    const body = await request.json();
    const validation = patchSubtaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    // Fetch the current subtask (RLS verifies board membership)
    const { data: existing, error: fetchError } = await supabase
      .from("card_subtasks")
      .select("id, card_id, completed_at")
      .eq("id", subtaskId)
      .eq("card_id", cardId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Subtask not found" }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};

    if (validation.data.title !== undefined) {
      updates.title = validation.data.title;
    }
    if (validation.data.completed !== undefined) {
      updates.completed_at = validation.data.completed
        ? new Date().toISOString()
        : null;
    }

    const { data: subtask, error } = await supabase
      .from("card_subtasks")
      .update(updates)
      .eq("id", subtaskId)
      .select("id, card_id, title, completed_at, position, created_at")
      .single();

    if (error) {
      console.error("Update subtask error:", error);
      return NextResponse.json(
        { error: "Failed to update subtask" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      subtask: {
        id: subtask.id,
        cardId: subtask.card_id,
        title: subtask.title,
        completedAt: subtask.completed_at,
        position: subtask.position,
        createdAt: subtask.created_at,
      },
    });
  } catch (error) {
    console.error("Update subtask error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: cardId, subtaskId } = await params;

    const { error } = await supabase
      .from("card_subtasks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", subtaskId)
      .eq("card_id", cardId)
      .is("deleted_at", null);

    if (error) {
      console.error("Delete subtask error:", error);
      return NextResponse.json(
        { error: "Failed to delete subtask" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete subtask error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
