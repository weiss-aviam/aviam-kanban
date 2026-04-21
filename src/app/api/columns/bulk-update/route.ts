import { NextRequest, NextResponse } from "next/server";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";
import { z } from "zod";

type BoardAccessClient = Parameters<typeof getBoardMutationAuthorization>[0];

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.number().int().positive("Column ID must be a positive integer"),
      position: z
        .number()
        .int()
        .positive("Position must be a positive integer"),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthorizedUser();
    const boardAccessClient = supabase as unknown as BoardAccessClient;

    if (!user) {
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

    const columnIds = updates.map((update) => update.id);

    const { data: columns, error: columnsError } = await supabase
      .from("columns")
      .select("id, board_id")
      .in("id", columnIds);

    if (columnsError) {
      console.error("Error fetching columns for bulk update:", columnsError);
      return NextResponse.json(
        { error: "Failed to verify columns" },
        { status: 500 },
      );
    }

    if (columns.length !== columnIds.length) {
      return NextResponse.json(
        { error: "Some columns not found or access denied" },
        { status: 404 },
      );
    }

    const boardIds = [...new Set(columns.map((column) => column.board_id))];

    if (boardIds.length !== 1) {
      return NextResponse.json(
        { error: "All columns must belong to the same board" },
        { status: 400 },
      );
    }

    const authorization = await getBoardMutationAuthorization(
      boardAccessClient,
      boardIds[0],
      user.id,
    );

    if (!authorization.ok) {
      return NextResponse.json(
        { error: authorization.error },
        { status: authorization.status },
      );
    }

    // Perform bulk update using Supabase
    const updatePromises = updates.map(async (update) => {
      const { error } = await supabase
        .from("columns")
        .update({
          position: update.position,
        })
        .eq("id", update.id);

      if (error) {
        console.error(`Failed to update column ${update.id}:`, error);
        throw error;
      }

      return update;
    });

    await Promise.all(updatePromises);

    return NextResponse.json({
      success: true,
      updatedCount: updates.length,
    });
  } catch (error) {
    console.error("Bulk update columns error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
