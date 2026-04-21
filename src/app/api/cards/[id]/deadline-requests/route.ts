import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { z } from "zod";

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const createRequestSchema = z.object({
  suggestedDueDate: z.string().datetime(),
  note: z.string().max(500).optional(),
});

// GET /api/cards/[id]/deadline-requests
// Returns all deadline requests for a card, newest first.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cardId } = await params;
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!uuidRegex.test(cardId)) {
      return NextResponse.json({ error: "Invalid card ID" }, { status: 400 });
    }

    const { data: card, error: cardError } = await supabase
      .from("cards")
      .select("id, board_id, column_id, created_by")
      .eq("id", cardId)
      .single();
    if (cardError || !card) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    const { data: requests, error: reqError } = await supabase
      .from("card_deadline_requests")
      .select(
        `id, suggested_due_date, note, status, change_type, created_at, resolved_at,
         requested_by, resolved_by,
         requester:requested_by(id, name, email),
         resolver:resolved_by(id, name)`,
      )
      .eq("card_id", cardId)
      .order("created_at", { ascending: false });

    if (reqError) {
      console.error("Error fetching deadline requests:", reqError);
      return NextResponse.json(
        { error: "Failed to fetch deadline requests" },
        { status: 500 },
      );
    }

    return NextResponse.json({ requests: requests ?? [] });
  } catch (err) {
    console.error("GET deadline-requests error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/cards/[id]/deadline-requests
// Submits a deadline suggestion. Only non-creators (and non-owners/admins) may use this.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: cardId } = await params;
  try {
    const { supabase, user } = await getAuthorizedUser();
    const boardAccessClient = supabase as unknown as BoardAccessClient;
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!uuidRegex.test(cardId)) {
      return NextResponse.json({ error: "Invalid card ID" }, { status: 400 });
    }

    const body = await request.json();
    const validation = createRequestSchema.safeParse(body);
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

    // Only the card creator edits the deadline directly — everyone else suggests,
    // including board owners and admins.
    const isCreator = card.created_by === user.id;
    if (isCreator) {
      return NextResponse.json(
        {
          error: "You can edit the deadline directly — no suggestion needed.",
        },
        { status: 400 },
      );
    }

    // Prevent duplicate pending requests from the same user
    const { data: existing } = await supabase
      .from("card_deadline_requests")
      .select("id")
      .eq("card_id", cardId)
      .eq("requested_by", user.id)
      .eq("status", "pending")
      .maybeSingle();
    if (existing) {
      return NextResponse.json(
        {
          error:
            "You already have a pending suggestion for this card. Wait for the creator to respond before submitting another.",
        },
        { status: 409 },
      );
    }

    const { suggestedDueDate, note } = validation.data;
    const { data: newRequest, error: insertError } = await supabase
      .from("card_deadline_requests")
      .insert({
        card_id: cardId,
        requested_by: user.id,
        suggested_due_date: new Date(suggestedDueDate).toISOString(),
        note: note ?? null,
        status: "pending",
      })
      .select(
        `id, suggested_due_date, note, status, change_type, created_at, resolved_at,
         requester:requested_by(id, name, email),
         resolver:resolved_by(id, name)`,
      )
      .single();

    if (insertError || !newRequest) {
      console.error("Error creating deadline request:", insertError);
      return NextResponse.json(
        { error: "Failed to create deadline request" },
        { status: 500 },
      );
    }

    return NextResponse.json({ request: newRequest }, { status: 201 });
  } catch (err) {
    console.error("POST deadline-requests error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
