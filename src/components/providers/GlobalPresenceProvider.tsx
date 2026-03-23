"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";

// How often to refresh last_seen_at while the user is active (ms)
const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

async function pingLastSeen() {
  try {
    await fetch("/api/auth/sync-profile", { method: "POST" });
  } catch {
    // ignore — best-effort
  }
}

/**
 * Joins the global Supabase Realtime presence channel so every authenticated
 * user is trackable app-wide (used by the super-admin dashboard to show who
 * is currently online).
 *
 * Also keeps last_seen_at up-to-date in the database via a heartbeat every
 * 2 minutes, so offline users show an accurate "last active" timestamp.
 */
export function GlobalPresenceProvider({ children }: { children: ReactNode }) {
  const setOnlineUserIds = useAppStore((s) => s.setOnlineUserIds);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let heartbeat: ReturnType<typeof setInterval> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      const user = session.user;

      // Immediate ping to set last_seen_at on app open
      void pingLastSeen();

      // Periodic heartbeat so last_seen_at stays fresh during long sessions
      heartbeat = setInterval(() => void pingLastSeen(), HEARTBEAT_INTERVAL_MS);

      channel = supabase.channel("global-presence", {
        config: { presence: { key: user.id } },
      });

      channel
        .on("presence", { event: "sync" }, () => {
          if (!channel) return;
          setOnlineUserIds(Object.keys(channel.presenceState()));
        })
        .subscribe(async (status) => {
          if (status === "SUBSCRIBED" && channel) {
            await channel.track({
              userId: user.id,
              name: (user.user_metadata?.name as string | undefined) ?? null,
              email: user.email ?? null,
            });
          }
        });
    });

    return () => {
      if (heartbeat) clearInterval(heartbeat);
      if (channel) void supabase.removeChannel(channel);
    };
    // setOnlineUserIds is a stable Zustand action
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <>{children}</>;
}
