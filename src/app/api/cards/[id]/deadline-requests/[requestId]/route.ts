import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { z } from "zod";

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const resolveSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

// PATCH /api/cards/[id]/deadline-requests/[requestId]
// Approves or rejects a deadline suggestion. Only the card creator or board owner/admin.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> },
) {
  const { id: cardId, requestId } = await params;
  try {
    const supabase = await createClient();
    const boardAccessClient = supabase as unknown as BoardAccessClient;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!uuidRegex.test(cardId) || !uuidRegex.test(requestId)) {
      return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
    }

    const body = await request.json();
    const validation = resolveSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid input", details: validation.error.issues },
        { status: 400 },
      );
    }

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id, created_by")
      .eq("id", cardId)
      .single();
    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const authorization = await getBoardMutationAuthorization(
      boardAccessClient,
      card.board_id,
      user.id,
    );
    if (!authorization.ok) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    // Only the card creator may approve or reject deadline suggestions.
    const isCreator = card.created_by === user.id;
    if (!isCreator) {
      return NextResponse.json(
        {
          error:
            "Only the card creator can approve or reject deadline suggestions.",
        },
        { status: 403 },
      );
    }

    const { data: req, error: reqError } = await supabase
      .from("card_deadline_requests")
      .select("id, card_id, status, suggested_due_date")
      .eq("id", requestId)
      .eq("card_id", cardId)
      .single();
    if (reqError || !req) {
      return NextResponse.json(
        { error: "Deadline request not found" },
        { status: 404 },
      );
    }
    if (req.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been resolved." },
        { status: 409 },
      );
    }

    const { action } = validation.data;
    const now = new Date().toISOString();

    // Update the request status
    const { error: updateReqError } = await supabase
      .from("card_deadline_requests")
      .update({
        status: action === "approve" ? "approved" : "rejected",
        resolved_by: user.id,
        resolved_at: now,
      })
      .eq("id", requestId);

    if (updateReqError) {
      console.error("Error resolving deadline request:", updateReqError);
      return NextResponse.json(
        { error: "Failed to update request" },
        { status: 500 },
      );
    }

    if (action === "approve") {
      // Apply the suggested date to the card
      const { error: cardUpdateError } = await supabase
        .from("cards")
        .update({ due_date: req.suggested_due_date })
        .eq("id", cardId);

      if (cardUpdateError) {
        console.error("Error updating card due_date:", cardUpdateError);
        return NextResponse.json(
          { error: "Request approved but failed to update card deadline" },
          { status: 500 },
        );
      }

      // Auto-reject any other pending requests for this card
      await supabase
        .from("card_deadline_requests")
        .update({ status: "rejected", resolved_by: user.id, resolved_at: now })
        .eq("card_id", cardId)
        .eq("status", "pending")
        .neq("id", requestId);
    }

    return NextResponse.json({
      message:
        action === "approve"
          ? "Deadline suggestion approved"
          : "Deadline suggestion rejected",
    });
  } catch (err) {
    console.error("PATCH deadline-requests/[requestId] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
