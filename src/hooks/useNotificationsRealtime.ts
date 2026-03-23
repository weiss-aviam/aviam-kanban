"use client";

import { useEffect, useRef, useMemo } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useAppStore } from "@/store";
import type { NotificationItem } from "@/store";

type DbRow = Record<string, unknown>;

export function useNotificationsRealtime(userId: string | null) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const prependNotification = useAppStore((s) => s.prependNotification);

  useEffect(() => {
    if (!userId) return;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`notifications:${userId}`);

    channel.on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as DbRow;
        // Fetch the enriched row immediately so actor/card/board info is
        // available in the toast and notification center right away.
        void supabase
          .from("notifications")
          .select(
            `id, type, metadata, read_at, created_at,
             actor:users!actor_id(id, name, avatar_url),
             card:cards!card_id(id, title),
             board:boards!board_id(id, name)`,
          )
          .eq("id", row.id as string)
          .single()
          .then(({ data }) => {
            if (!data) {
              // Fallback: prepend with raw row (no joins)
              prependNotification({
                id: row.id as string,
                type: row.type as NotificationItem["type"],
                metadata: (row.metadata as Record<string, unknown>) ?? {},
                readAt: null,
                createdAt: row.created_at as string,
                actor: null,
                card: null,
                board: null,
              });
              return;
            }
            type ActorRow = {
              id: string;
              name: string;
              avatar_url: string | null;
            };
            type CardRow = { id: string; title: string };
            type BoardRow = { id: string; name: string };
            const rawA = data.actor as ActorRow | ActorRow[] | null;
            const rawC = data.card as CardRow | CardRow[] | null;
            const rawB = data.board as BoardRow | BoardRow[] | null;
            const a = Array.isArray(rawA) ? (rawA[0] ?? null) : rawA;
            const c = Array.isArray(rawC) ? (rawC[0] ?? null) : rawC;
            const b = Array.isArray(rawB) ? (rawB[0] ?? null) : rawB;
            prependNotification({
              id: data.id,
              type: data.type as NotificationItem["type"],
              metadata: (data.metadata as Record<string, unknown>) ?? {},
              readAt: (data.read_at as string | null) ?? null,
              createdAt: data.created_at as string,
              actor: a
                ? { id: a.id, name: a.name, avatarUrl: a.avatar_url }
                : null,
              card: c ? { id: c.id, title: c.title } : null,
              board: b ? { id: b.id, name: b.name } : null,
            });
          });
      },
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId, supabase, prependNotification]);
}
