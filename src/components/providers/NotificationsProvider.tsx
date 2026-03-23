"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";
import { useNotificationsRealtime } from "@/hooks/useNotificationsRealtime";
import { NotificationToast } from "@/components/notifications/NotificationToast";

/**
 * Bootstraps the notification system:
 * - Fetches initial notifications on mount.
 * - Subscribes to realtime INSERT events for live delivery.
 * - Renders the live-toast overlay.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const fetchNotifications = useAppStore((s) => s.fetchNotifications);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) return;
      setUserId(session.user.id);
      void fetchNotifications(true);
    });
    // fetchNotifications is a stable Zustand action
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Realtime subscription — active whenever we have a userId
  useNotificationsRealtime(userId);

  return (
    <>
      {children}
      <NotificationToast />
    </>
  );
}
