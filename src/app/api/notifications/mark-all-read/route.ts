import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";

export async function POST() {
  try {
    const { supabase, user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Mark all read error:", error);
      return NextResponse.json(
        { error: "Failed to mark all notifications as read" },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Mark all read route error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
