import { NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";

// GET /api/dashboard/stats - Returns KPI stats for the current user's dashboard
export async function GET() {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Count cards assigned to the user on non-archived boards.
    // RLS already limits cards to boards the user is a member of.
    const { count, error } = await supabase
      .from("cards")
      .select("id, boards!inner(is_archived)", { count: "exact", head: true })
      .eq("assignee_id", user.id)
      .eq("boards.is_archived", false);

    if (error) {
      console.error("Error fetching active task count:", error);
      return NextResponse.json(
        { error: "Failed to fetch stats" },
        { status: 500 },
      );
    }

    return NextResponse.json({ activeTaskCount: count ?? 0 });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
