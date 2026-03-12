import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// How long to ban pending-approval users (same as deactivation duration).
const PENDING_BAN_DURATION = "876600h";

// POST /api/auth/confirm-email
// Called by the callback page immediately after exchangeCodeForSession succeeds.
// If the user's status is 'unconfirmed' (self-registered, email just confirmed),
// this endpoint promotes them to 'pending' and bans them at the auth layer until
// a super admin approves them.
// Returns { status: 'active' | 'pending' | 'deactivated' }.
export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("status")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const { status } = profile as { status: string };

    if (status === "unconfirmed") {
      const adminClient = createAdminClient();

      // Promote to pending in public.users
      await adminClient
        .from("users")
        .update({ status: "pending" })
        .eq("id", user.id);

      // Ban at the auth layer — user must wait for admin approval
      await adminClient.auth.admin.updateUserById(user.id, {
        ban_duration: PENDING_BAN_DURATION,
      });

      return NextResponse.json({ status: "pending" });
    }

    // Already active, pending, or deactivated — return as-is
    return NextResponse.json({ status });
  } catch (err) {
    console.error("POST /api/auth/confirm-email error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
