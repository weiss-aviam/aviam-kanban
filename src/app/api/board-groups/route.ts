import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// GET /api/board-groups — visible groups (RLS-filtered)
export async function GET() {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("board_groups")
      .select("id, name, color, created_by, position, created_at")
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching board groups:", error);
      return NextResponse.json(
        { error: "Failed to fetch board groups" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      groups: (data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        color: g.color ?? null,
        createdBy: g.created_by ?? null,
        position: g.position ?? 0,
        createdAt: g.created_at,
      })),
    });
  } catch (error) {
    console.error("Error in GET /api/board-groups:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// POST /api/board-groups — create
export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, color } = body;

    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (name.trim().length > 120) {
      return NextResponse.json(
        { error: "Name too long (max 120 chars)" },
        { status: 400 },
      );
    }
    if (color !== undefined && color !== null && !HEX_COLOR.test(color)) {
      return NextResponse.json(
        { error: "Color must be a 6-digit hex like #aabbcc" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("board_groups")
      .insert({
        name: name.trim(),
        color: color ?? null,
        created_by: user.id,
      })
      .select("id, name, color, created_by, position, created_at")
      .single();

    if (error || !data) {
      console.error("Error creating board group:", error);
      return NextResponse.json(
        { error: "Failed to create board group" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      group: {
        id: data.id,
        name: data.name,
        color: data.color ?? null,
        createdBy: data.created_by ?? null,
        position: data.position ?? 0,
        createdAt: data.created_at,
      },
    });
  } catch (error) {
    console.error("Error in POST /api/board-groups:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
