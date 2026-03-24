import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendNewUserPendingNotification } from "@/lib/mailer";

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
    const { supabase, user } = await getSessionUser();
    if (!user) {
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

      // Ban at the auth layer and record status in app_metadata (JWT-readable,
      // no DB query required by middleware or other auth checks).
      await adminClient.auth.admin.updateUserById(user.id, {
        ban_duration: PENDING_BAN_DURATION,
        app_metadata: { status: "pending" },
      });

      // Notify superadmin — fire-and-forget, never block the response.
      const registeredAt = new Date().toLocaleString("de-DE", {
        timeZone: "Europe/Berlin",
        dateStyle: "long",
        timeStyle: "short",
      });
      sendNewUserPendingNotification({
        userEmail: user.email ?? "",
        userName: (user.user_metadata?.name as string | null) ?? null,
        registeredAt,
      }).catch((err) =>
        console.error(
          "[confirm-email] Failed to send superadmin notification:",
          err,
        ),
      );

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
