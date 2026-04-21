import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { z } from "zod";

const createSubtaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title too long"),
  position: z.number().int().min(0).optional().default(0),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: cardId } = await params;

    // Verify card exists and user has board access (RLS)
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Card not found or access denied" },
        { status: 404 },
      );
    }

    const { data: subtasks, error } = await supabase
      .from("card_subtasks")
      .select("id, card_id, title, completed_at, position, created_at")
      .eq("card_id", cardId)
      .is("deleted_at", null)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Get subtasks error:", error);
      return NextResponse.json(
        { error: "Failed to fetch subtasks" },
        { status: 500 },
      );
    }

    const transformed = (subtasks ?? []).map((s) => ({
      id: s.id,
      cardId: s.card_id,
      title: s.title,
      completedAt: s.completed_at,
      position: s.position,
      createdAt: s.created_at,
    }));

    return NextResponse.json({ subtasks: transformed });
  } catch (error) {
    console.error("Get subtasks error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: cardId } = await params;

    // Verify card exists and user has non-viewer board access (RLS will enforce)
    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id")
      .eq("id", cardId)
      .single();

    if (cardError || !card) {
      return NextResponse.json(
        { error: "Card not found or access denied" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const validation = createSubtaskSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { title, position } = validation.data;

    const { data: subtask, error } = await supabase
      .from("card_subtasks")
      .insert({ card_id: cardId, title, position })
      .select("id, card_id, title, completed_at, position, created_at")
      .single();

    if (error) {
      console.error("Create subtask error:", error);
      return NextResponse.json(
        { error: "Failed to create subtask" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        subtask: {
          id: subtask.id,
          cardId: subtask.card_id,
          title: subtask.title,
          completedAt: subtask.completed_at,
          position: subtask.position,
          createdAt: subtask.created_at,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Create subtask error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
