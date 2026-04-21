import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// PUT /api/board-groups/[id] — rename / recolor / reposition (creator only, RLS-enforced)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid group ID format" },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { name, color, position } = body;

    const updateData: Partial<{
      name: string;
      color: string | null;
      position: number;
    }> = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return NextResponse.json(
          { error: "Name cannot be empty" },
          { status: 400 },
        );
      }
      if (name.trim().length > 120) {
        return NextResponse.json(
          { error: "Name too long (max 120 chars)" },
          { status: 400 },
        );
      }
      updateData.name = name.trim();
    }
    if (color !== undefined) {
      if (color !== null && !HEX_COLOR.test(color)) {
        return NextResponse.json(
          { error: "Color must be a 6-digit hex like #aabbcc" },
          { status: 400 },
        );
      }
      updateData.color = color ?? null;
    }
    if (position !== undefined) {
      if (typeof position !== "number" || !Number.isFinite(position)) {
        return NextResponse.json(
          { error: "Invalid position" },
          { status: 400 },
        );
      }
      updateData.position = Math.trunc(position);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("board_groups")
      .update(updateData)
      .eq("id", id)
      .select("id, name, color, created_by, position, created_at")
      .maybeSingle();

    if (error) {
      console.error("Error updating board group:", error);
      return NextResponse.json(
        { error: "Failed to update board group" },
        { status: 500 },
      );
    }
    if (!data) {
      // RLS dropped the row → user is not creator (or group does not exist)
      return NextResponse.json(
        { error: "Group not found or access denied" },
        { status: 404 },
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
    console.error("Error in PUT /api/board-groups/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

// DELETE /api/board-groups/[id] — creator only (RLS-enforced)
// Boards keep existing — boards.group_id falls back to NULL via FK.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { supabase, user } = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    if (!UUID_RE.test(id)) {
      return NextResponse.json(
        { error: "Invalid group ID format" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("board_groups")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Error deleting board group:", error);
      return NextResponse.json(
        { error: "Failed to delete board group" },
        { status: 500 },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "Group not found or access denied" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Board group deleted" });
  } catch (error) {
    console.error("Error in DELETE /api/board-groups/[id]:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
