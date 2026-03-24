import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { createNotifications } from "@/lib/notifications";
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
      .select("id, board_id, assignee_id, completed_at, column_id")
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
      .select("id, board_id, is_done")
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

    // Build a map of columnId → is_done so we can auto-complete/reopen cards
    const columnDoneMap = new Map<number, boolean>(
      columns.map((col) => [
        col.id,
        (col as unknown as { is_done?: boolean }).is_done ?? false,
      ]),
    );

    const now = new Date().toISOString();

    // Pre-build a map of cardId → existing card data for notification logic
    const existingCardMap = new Map(cards.map((c) => [c.id, c]));

    // Fetch board owner for card_completed notifications
    const { data: boardRow } = await supabase
      .from("boards")
      .select("owner_id")
      .eq("id", boardId)
      .single();
    const boardOwnerId: string | null = boardRow?.owner_id ?? null;

    // Perform bulk update using Supabase
    const updatePromises = updates.map(async (update) => {
      const isDone = columnDoneMap.get(update.columnId) ?? false;
      const { error } = await supabase
        .from("cards")
        .update({
          column_id: update.columnId,
          position: update.position,
          // Auto-complete when moving to a done column; reopen when moving out
          completed_at: isDone ? now : null,
        })
        .eq("id", update.id);

      if (error) {
        console.error(`Failed to update card ${update.id}:`, error);
        throw error;
      }

      return update;
    });

    await Promise.all(updatePromises);

    // Fire card_completed notifications for cards newly moved into a done column
    const notifRows: Parameters<typeof createNotifications>[1] = [];
    for (const update of updates) {
      const isDone = columnDoneMap.get(update.columnId) ?? false;
      if (!isDone) continue;
      const existing = existingCardMap.get(update.id);
      if (!existing || existing.completed_at) continue; // already was done
      // Notify board owner + assignee (not the actor)
      const recipientIds = new Set<string>();
      if (boardOwnerId && boardOwnerId !== user.id)
        recipientIds.add(boardOwnerId);
      const assigneeId = (existing as { assignee_id?: string | null })
        .assignee_id;
      if (assigneeId && assigneeId !== user.id) recipientIds.add(assigneeId);
      for (const recipientId of recipientIds) {
        notifRows.push({
          user_id: recipientId,
          type: "card_completed",
          actor_id: user.id,
          card_id: update.id,
          board_id: boardId!,
          metadata: {},
        });
      }
    }
    await createNotifications(createAdminClient(), notifRows);

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
