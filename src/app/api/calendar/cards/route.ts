import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";

export type CalendarCard = {
  id: string;
  title: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
  boardId: string;
  boardName: string;
  columnId: number;
  columnTitle: string;
  completedAt: string | null;
};

// GET /api/calendar/cards?start=<ISO>&end=<ISO>
// Returns all cards with a due_date in [start, end] across all boards the user is a member of.
export async function GET(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { error: "start and end query parameters are required" },
        { status: 400 },
      );
    }

    // Validate ISO date strings
    if (isNaN(Date.parse(start)) || isNaN(Date.parse(end))) {
      return NextResponse.json(
        { error: "start and end must be valid ISO date strings" },
        { status: 400 },
      );
    }

    // RLS on cards ensures only boards the user is a member of are returned.
    // The !inner join on boards filters out cards whose board is archived.
    const { data, error } = await supabase
      .from("cards")
      .select(
        `
        id,
        title,
        due_date,
        priority,
        board_id,
        column_id,
        completed_at,
        boards!inner(id, name, is_archived),
        columns!inner(id, title)
      `,
      )
      .not("due_date", "is", null)
      .eq("boards.is_archived", false)
      .gte("due_date", start)
      .lte("due_date", end)
      .order("due_date", { ascending: true });

    if (error) {
      console.error("Error fetching calendar cards:", error);
      return NextResponse.json(
        { error: "Failed to fetch calendar cards" },
        { status: 500 },
      );
    }

    const cards: CalendarCard[] = (data ?? []).map((card) => {
      const board = card.boards as unknown as {
        id: string;
        name: string;
        is_archived: boolean;
      };
      const column = card.columns as unknown as { id: number; title: string };
      return {
        id: card.id,
        title: card.title,
        dueDate: card.due_date!,
        priority: card.priority as "high" | "medium" | "low",
        boardId: card.board_id,
        boardName: board.name,
        columnId: column.id,
        columnTitle: column.title,
        completedAt: card.completed_at,
      };
    });

    return NextResponse.json({ cards });
  } catch (error) {
    console.error("Error fetching calendar cards:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
