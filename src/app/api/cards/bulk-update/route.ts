import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";
import { z } from "zod";

const bulkUpdateSchema = z.object({
  updates: z.array(
    z.object({
      id: z.string().uuid("Card ID must be a valid UUID"),
      columnId: z
        .number()
        .int()
        .positive("Column ID must be a positive integer"),
      position: z
        .number()
        .int()
        .positive("Position must be a positive integer"),
    }),
  ),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Get the current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
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

    // Perform bulk update using Supabase
    const updatePromises = updates.map(async (update) => {
      const { error } = await supabase
        .from("cards")
        .update({
          column_id: update.columnId,
          position: update.position,
        })
        .eq("id", update.id);

      if (error) {
        console.error(`Failed to update card ${update.id}:`, error);
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
    console.error("Bulk update cards error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
