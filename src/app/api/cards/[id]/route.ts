import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { createNotifications } from "@/lib/notifications";
import { z } from "zod";

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const updateCardSchema = z.object({
  title: z
    .string()
    .min(1, "Card title is required")
    .max(160, "Card title too long")
    .optional(),
  description: z.string().optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  priority: z.enum(["high", "medium", "low"]).optional(),
  columnId: z
    .number()
    .int()
    .positive("Column ID must be a positive integer")
    .optional(),
  position: z
    .number()
    .int()
    .positive("Position must be a positive integer")
    .optional(),
  completedAt: z.string().datetime().nullable().optional(),
});

type CardUpdateData = {
  title?: string;
  description?: string;
  assignee_id?: string | null;
  due_date?: string | null;
  priority?: "high" | "medium" | "low";
  column_id?: number;
  position?: number;
  completed_at?: string | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

    const cardId = id;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cardId)) {
      return NextResponse.json(
        { error: "Invalid card ID format" },
        { status: 400 },
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = updateCardSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const {
      title,
      description,
      assigneeId,
      dueDate,
      priority,
      columnId,
      position,
      completedAt,
    } = validation.data;

    // Get the existing card to verify access (using Supabase RLS)
    const { data: existingCard, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id, column_id, created_by, due_date, assignee_id")
      .eq("id", cardId)
      .single();

    if (cardError || !existingCard) {
      return NextResponse.json(
        { error: "Card not found or access denied" },
        { status: 404 },
      );
    }

    const authorization = await getBoardMutationAuthorization(
      boardAccessClient,
      existingCard.board_id,
      user.id,
    );

    if (!authorization.ok) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    // Guard: only the card creator may change due_date directly.
    // Board owners and admins must use the suggestion workflow like everyone else.
    if (dueDate !== undefined) {
      const isCreator = existingCard.created_by === user.id;
      if (!isCreator) {
        return NextResponse.json(
          {
            error:
              "Only the card creator can change the deadline directly. Use the suggestion workflow instead.",
          },
          { status: 403 },
        );
      }
    }

    // If changing column, verify the new column belongs to the same board
    if (columnId && columnId !== existingCard.column_id) {
      const { data: newColumn, error: columnError } = await supabase
        .from("columns")
        .select("id, board_id")
        .eq("id", columnId)
        .eq("board_id", existingCard.board_id)
        .single();

      if (columnError || !newColumn) {
        return NextResponse.json(
          { error: "Invalid column or column does not belong to this board" },
          { status: 400 },
        );
      }
    }

    // Prepare update data
    const updateData: CardUpdateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (assigneeId !== undefined) updateData.assignee_id = assigneeId;
    if (dueDate !== undefined)
      updateData.due_date = dueDate ? new Date(dueDate).toISOString() : null;
    if (priority !== undefined) updateData.priority = priority;
    if (columnId !== undefined) updateData.column_id = columnId;
    if (position !== undefined) updateData.position = position;
    if (completedAt !== undefined)
      updateData.completed_at = completedAt
        ? new Date(completedAt).toISOString()
        : null;

    // Update the card using Supabase (respects RLS)
    const { data: updatedCard, error: updateError } = await supabase
      .from("cards")
      .update(updateData)
      .eq("id", cardId)
      .select()
      .single();

    if (updateError) {
      console.error("Update card error:", updateError);
      return NextResponse.json(
        { error: "Failed to update card" },
        { status: 500 },
      );
    }

    // Record direct deadline changes in history for full transparency.
    // Only log when the due_date value actually changed.
    if (dueDate !== undefined) {
      const prevDate = existingCard.due_date
        ? new Date(existingCard.due_date as string).toISOString()
        : null;
      const nextDate = updatedCard.due_date
        ? new Date(updatedCard.due_date).toISOString()
        : null;
      if (prevDate !== nextDate) {
        const now = new Date().toISOString();
        await supabase.from("card_deadline_requests").insert({
          card_id: cardId,
          requested_by: user.id,
          suggested_due_date: nextDate, // null = deadline removed
          status: "applied",
          change_type: "direct",
          resolved_by: user.id,
          resolved_at: now,
        });
      }
    }

    // ── Notifications (non-throwing) ──────────────────────────────────────
    const notifRows: Parameters<typeof createNotifications>[1] = [];

    // card_assigned: assignee changed to a new person who is not the actor
    if (
      assigneeId !== undefined &&
      assigneeId !== null &&
      assigneeId !== existingCard.assignee_id &&
      assigneeId !== user.id
    ) {
      notifRows.push({
        user_id: assigneeId,
        type: "card_assigned",
        actor_id: user.id,
        card_id: cardId,
        board_id: existingCard.board_id,
        metadata: {},
      });
    }

    // deadline_change: due_date changed and the assignee (not the actor) is affected
    if (dueDate !== undefined) {
      const prevDate = existingCard.due_date
        ? new Date(existingCard.due_date as string).toISOString()
        : null;
      const nextDate = updatedCard.due_date
        ? new Date(updatedCard.due_date).toISOString()
        : null;
      const currentAssignee =
        assigneeId !== undefined ? assigneeId : existingCard.assignee_id;
      if (
        prevDate !== nextDate &&
        currentAssignee &&
        currentAssignee !== user.id
      ) {
        notifRows.push({
          user_id: currentAssignee,
          type: "deadline_change",
          actor_id: user.id,
          card_id: cardId,
          board_id: existingCard.board_id,
          metadata: {
            previousDueDate: prevDate,
            newDueDate: nextDate,
          },
        });
      }
    }

    await createNotifications(createAdminClient(), notifRows);
    // ── End notifications ──────────────────────────────────────────────────

    // Transform response to match expected format
    const transformedCard = {
      id: updatedCard.id,
      boardId: updatedCard.board_id,
      columnId: updatedCard.column_id,
      title: updatedCard.title,
      description: updatedCard.description,
      assigneeId: updatedCard.assignee_id,
      dueDate: updatedCard.due_date,
      priority: updatedCard.priority,
      completedAt: updatedCard.completed_at,
      position: updatedCard.position,
      createdAt: updatedCard.created_at,
      createdBy: updatedCard.created_by,
    };

    return NextResponse.json({ card: transformedCard });
  } catch (error) {
    console.error("Update card error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
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

    const cardId = id;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(cardId)) {
      return NextResponse.json(
        { error: "Invalid card ID format" },
        { status: 400 },
      );
    }

    const { data: existingCard, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id")
      .eq("id", cardId)
      .single();

    if (cardError || !existingCard) {
      return NextResponse.json(
        { error: "Card not found or access denied" },
        { status: 404 },
      );
    }

    const authorization = await getBoardMutationAuthorization(
      boardAccessClient,
      existingCard.board_id,
      user.id,
    );

    if (!authorization.ok) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    // Delete the card using Supabase (respects RLS)
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", cardId);

    if (deleteError) {
      console.error("Delete card error:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete card" },
        { status: 500 },
      );
    }

    return NextResponse.json({ message: "Card deleted successfully" });
  } catch (error) {
    console.error("Delete card error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
