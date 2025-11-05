import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../../../lib/supabase/server";

export async function POST(_request: NextRequest) {
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

    // Sync the user profile using Supabase (respects RLS)
    const { data: existingUser, error: checkError } = await supabase
      .from("users")
      .select("id")
      .eq("id", user.id)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      // Error other than "not found"
      console.error("Error checking user profile:", checkError);
      return NextResponse.json(
        { error: "Failed to check user profile" },
        { status: 500 },
      );
    }

    if (!existingUser) {
      // User doesn't exist, create profile
      const { error: insertError } = await supabase.from("users").insert({
        id: user.id,
        email: user.email || "",
        name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
      });

      if (insertError) {
        console.error("Error creating user profile:", insertError);
        return NextResponse.json(
          { error: "Failed to create user profile" },
          { status: 500 },
        );
      }
    } else {
      // User exists, update profile if needed
      const { error: updateError } = await supabase
        .from("users")
        .update({
          email: user.email || "",
          name: user.user_metadata?.name || user.email?.split("@")[0] || "User",
        })
        .eq("id", user.id);

      if (updateError) {
        console.error("Error updating user profile:", updateError);
        return NextResponse.json(
          { error: "Failed to update user profile" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json(
      { message: "Profile synced successfully" },
      { status: 200 },
    );
  } catch (error) {
    console.error("Profile sync error:", error);
    return NextResponse.json(
      { error: "Failed to sync profile" },
      { status: 500 },
    );
  }
}
