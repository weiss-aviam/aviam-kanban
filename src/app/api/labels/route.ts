import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../lib/supabase/server";
import { z } from "zod";

const createLabelSchema = z.object({
  boardId: z.number().int().positive("Board ID must be a positive integer"),
  name: z
    .string()
    .min(1, "Label name is required")
    .max(50, "Label name too long"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Color must be a valid hex color"),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createLabelSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { boardId, name, color } = validation.data;

    // Verify user has access to the board (using Supabase RLS)
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id")
      .eq("id", boardId)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { error: "Board not found or insufficient permissions" },
        { status: 404 },
      );
    }

    // Create the label using Supabase (respects RLS)
    const { data: newLabel, error: labelError } = await supabase
      .from("labels")
      .insert({
        board_id: boardId,
        name,
        color,
      })
      .select()
      .single();

    if (labelError) {
      console.error("Create label error:", labelError);
      return NextResponse.json(
        { error: "Failed to create label" },
        { status: 500 },
      );
    }

    // Transform response to match expected format
    const transformedLabel = {
      id: newLabel.id,
      boardId: newLabel.board_id,
      name: newLabel.name,
      color: newLabel.color,
      createdAt: newLabel.created_at,
    };

    return NextResponse.json(transformedLabel, { status: 201 });
  } catch (error) {
    console.error("Create label error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const boardId = searchParams.get("boardId");

    if (!boardId || isNaN(parseInt(boardId))) {
      return NextResponse.json(
        { error: "Valid board ID is required" },
        { status: 400 },
      );
    }

    const boardIdInt = parseInt(boardId);

    // Verify user has access to the board (using Supabase RLS)
    const { data: board, error: boardError } = await supabase
      .from("boards")
      .select("id")
      .eq("id", boardIdInt)
      .single();

    if (boardError || !board) {
      return NextResponse.json(
        { error: "Board not found or insufficient permissions" },
        { status: 404 },
      );
    }

    // Get labels for the board using Supabase (respects RLS)
    const { data: labels, error: labelsError } = await supabase
      .from("labels")
      .select("*")
      .eq("board_id", boardIdInt)
      .order("name");

    if (labelsError) {
      console.error("Get labels error:", labelsError);
      return NextResponse.json(
        { error: "Failed to fetch labels" },
        { status: 500 },
      );
    }

    // Transform response to match expected format
    const transformedLabels = labels.map((label) => ({
      id: label.id,
      boardId: label.board_id,
      name: label.name,
      color: label.color,
      createdAt: label.created_at,
    }));

    return NextResponse.json({ labels: transformedLabels });
  } catch (error) {
    console.error("Get labels error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
