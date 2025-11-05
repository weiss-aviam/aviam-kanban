import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Name is required").max(255, "Name is too long"),
});

// PUT /api/profile - Update current user's profile (name)
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let parsed;
    try {
      const body = await request.json();
      parsed = updateProfileSchema.safeParse(body);
    } catch (_e) {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.issues },
        { status: 400 },
      );
    }

    const { name } = parsed.data;

    // Update current user's auth metadata (name)
    const { error: updateAuthErr } = await supabase.auth.updateUser({
      data: { name },
    });
    if (updateAuthErr) {
      console.error("Auth metadata update failed:", updateAuthErr);
      return NextResponse.json(
        { error: "Failed to update profile (auth)" },
        { status: 500 },
      );
    }

    // Update our users table (RLS should allow the user to modify their own row)
    const { error: updateUserErr } = await supabase
      .from("users")
      .update({ name })
      .eq("id", user.id);

    if (updateUserErr) {
      console.error("Users table update failed:", updateUserErr);
      return NextResponse.json(
        { error: "Failed to update profile" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      message: "Profile updated",
      user: { id: user.id, name },
    });
  } catch (error) {
    console.error("Error in PUT /api/profile:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
