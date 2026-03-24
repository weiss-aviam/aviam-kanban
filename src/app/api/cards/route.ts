import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { z } from "zod";

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const createCardSchema = z.object({
  boardId: z.string().uuid("Board ID must be a valid UUID"),
  columnId: z.number().int().positive("Column ID must be a positive integer"),
  title: z
    .string()
    .min(1, "Card title is required")
    .max(160, "Card title too long"),
  description: z.string().optional(),
  assigneeId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["high", "medium", "low"]).default("medium"),
  position: z.number().int().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getSessionUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = createCardSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const {
      boardId,
      columnId,
      title,
      description,
      assigneeId,
      dueDate,
      priority,
      position,
    } = validation.data;

    const boardAccessClient = supabase as unknown as BoardAccessClient;
    const authorization = await getBoardMutationAuthorization(
      boardAccessClient,
      boardId,
      user.id,
    );

    if (!authorization.ok) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    // Verify the column belongs to the board and user has access (using Supabase RLS)
    const { data: column, error: columnError } = await supabase
      .from("columns")
      .select("id, board_id")
      .eq("id", columnId)
      .eq("board_id", boardId)
      .single();

    if (columnError || !column) {
      return NextResponse.json(
        { error: "Column not found or does not belong to this board" },
        { status: 400 },
      );
    }

    // If no position provided, get the next position in the column
    let finalPosition = position;
    if (!finalPosition) {
      const { data: maxPositionResult } = await supabase
        .from("cards")
        .select("position")
        .eq("column_id", columnId)
        .order("position", { ascending: false })
        .limit(1);

      finalPosition = (maxPositionResult?.[0]?.position || 0) + 1;
    }

    // Create the card using Supabase (respects RLS)
    const { data: newCard, error: cardError } = await supabase
      .from("cards")
      .insert({
        board_id: boardId,
        column_id: columnId,
        title,
        description: description || null,
        assignee_id: assigneeId || null,
        due_date: dueDate ? new Date(dueDate).toISOString() : null,
        priority: priority || "medium",
        position: finalPosition,
        created_by: user.id,
      })
      .select("*")
      .single();

    if (cardError) {
      console.error("Create card error:", cardError);
      return NextResponse.json(
        { error: "Failed to create card" },
        { status: 500 },
      );
    }

    // Transform response to match expected format
    const transformedCard = {
      id: newCard.id,
      boardId: newCard.board_id,
      columnId: newCard.column_id,
      title: newCard.title,
      description: newCard.description,
      assigneeId: newCard.assignee_id,
      dueDate: newCard.due_date,
      priority: newCard.priority,
      position: newCard.position,
      createdAt: newCard.created_at,
      createdBy: newCard.created_by,
      labels: [],
      comments: [],
    };

    // Record the initial deadline in the history for full transparency
    if (newCard.due_date) {
      await supabase.from("card_deadline_requests").insert({
        card_id: newCard.id,
        requested_by: user.id,
        suggested_due_date: newCard.due_date,
        status: "applied",
        change_type: "direct",
        resolved_by: user.id,
        resolved_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ card: transformedCard }, { status: 201 });
  } catch (error) {
    console.error("Create card error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
