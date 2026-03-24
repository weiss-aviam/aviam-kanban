import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";

export async function GET() {
  try {
    const { supabase, user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch 50 most recent notifications with actor + card + board info
    // Use explicit table hints (table!column) so PostgREST resolves FKs correctly
    const { data: rows, error } = await supabase
      .from("notifications")
      .select(
        `
        id,
        type,
        metadata,
        read_at,
        created_at,
        actor:users!actor_id ( id, name, avatar_url ),
        card:cards!card_id ( id, title ),
        board:boards!board_id ( id, name )
        `,
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(
        "Fetch notifications error:",
        error.message,
        error.details,
        error.hint,
      );
      return NextResponse.json(
        { error: "Failed to fetch notifications", detail: error.message },
        { status: 500 },
      );
    }

    // Count unread separately
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);

    const notifications = (rows ?? []).map((n) => {
      const actor = Array.isArray(n.actor) ? n.actor[0] : n.actor;
      const card = Array.isArray(n.card) ? n.card[0] : n.card;
      const board = Array.isArray(n.board) ? n.board[0] : n.board;
      return {
        id: n.id,
        type: n.type,
        metadata: n.metadata,
        readAt: n.read_at,
        createdAt: n.created_at,
        actor: actor
          ? {
              id: (actor as { id: string }).id,
              name: (actor as { name: string | null }).name,
              avatarUrl: (actor as { avatar_url: string | null }).avatar_url,
            }
          : null,
        card: card
          ? {
              id: (card as { id: string }).id,
              title: (card as { title: string }).title,
            }
          : null,
        board: board
          ? {
              id: (board as { id: string }).id,
              name: (board as { name: string }).name,
            }
          : null,
      };
    });

    return NextResponse.json({
      notifications,
      unreadCount: count ?? 0,
    });
  } catch (error) {
    console.error("Notifications route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
