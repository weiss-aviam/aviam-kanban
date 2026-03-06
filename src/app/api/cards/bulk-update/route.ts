import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { z } from "zod";

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid("Card ID must be a valid UUID"),
      columnId: z
        .number()
        .int()
        .positive("Column ID must be a positive integer"),
      position: z
        .number()
        .int()
        .positive("Position must be a positive integer"),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const boardAccessClient = supabase as unknown as BoardAccessClient;

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
    const validation = bulkUpdateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { updates } = validation.data;

    if (updates.length === 0) {
      return NextResponse.json({ success: true });
    }

    const cardIds = updates.map((update) => update.id);

    const { data: cards, error: cardsError } = await supabase
      .from("cards")
      .select("id, board_id")
      .in("id", cardIds);

    if (cardsError) {
      console.error("Error fetching cards for bulk update:", cardsError);
      return NextResponse.json(
        { error: "Failed to verify cards" },
        { status: 500 },
      );
    }

    if (cards.length !== cardIds.length) {
      return NextResponse.json(
        { error: "Some cards not found or access denied" },
        { status: 404 },
      );
    }

    const boardIds = [...new Set(cards.map((card) => card.board_id))];

    if (boardIds.length !== 1) {
      return NextResponse.json(
        { error: "All cards must belong to the same board" },
        { status: 400 },
      );
    }

    const boardId = boardIds[0];
    const columnIds = [...new Set(updates.map((update) => update.columnId))];

    const { data: columns, error: columnsError } = await supabase
      .from("columns")
      .select("id, board_id")
      .in("id", columnIds)
      .eq("board_id", boardId);

    if (columnsError) {
      console.error("Error fetching columns for bulk update:", columnsError);
      return NextResponse.json(
        { error: "Failed to verify columns" },
        { status: 500 },
      );
    }

    if (columns.length !== columnIds.length) {
      return NextResponse.json(
        { error: "Some columns not found or do not belong to this board" },
        { status: 400 },
      );
    }

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

    // Perform bulk update using Supabase
    const updatePromises = updates.map(async (update) => {
      const { error } = await supabase
        .from("cards")
        .update({
          column_id: update.columnId,
          position: update.position,
        })
        .eq("id", update.id);

      if (error) {
        console.error(`Failed to update card ${update.id}:`, error);
        throw error;
      }

      return update;
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
    });
  } catch (error) {
    console.error("Bulk update cards error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
