"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { BoardMemberRole } from "@/types/database";
import { createClient } from "@/lib/supabase/client";

export type BoardPresenceActivity =
  | { type: "viewing-board" }
  | { type: "editing-card"; cardId: string; cardTitle?: string | null };

export interface BoardPresencePayload {
  sessionId: string;
  userId: string;
  name: string | null;
  email: string | null;
  role: BoardMemberRole | null;
  activity: BoardPresenceActivity;
  connectedAt: string;
  updatedAt: string;
}

export interface BoardPresenceMember {
  userId: string;
  name: string | null;
  email: string | null;
  role: BoardMemberRole | null;
  activity: BoardPresenceActivity;
  connectedAt: string;
  updatedAt: string;
  connections: number;
}

export interface BoardPresenceEditingTarget {
  id: string;
  title?: string | null;
}

interface UseBoardPresenceOptions {
  boardId: string;
  currentUser: { id: string; name?: string | null; email?: string | null } | null;
  currentUserRole?: BoardMemberRole | null;
}

export type BoardPresenceStatus = "idle" | "joining" | "joined" | "error";
type RawPresenceState = Record<string, BoardPresencePayload[]>;

const VIEWING_BOARD_ACTIVITY: BoardPresenceActivity = { type: "viewing-board" };

function createPresenceSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `presence-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getActivityPriority(activity: BoardPresenceActivity) {
  return activity.type === "editing-card" ? 1 : 0;
}

function getPresenceSortLabel(presence: BoardPresenceMember) {
  return presence.name ?? presence.email ?? presence.userId;
}

export function getBoardPresenceChannelName(boardId: string) {
  return `board-presence:${boardId}`;
}

export function normalizeBoardPresenceState(state: RawPresenceState) {
  const membersByUser = new Map<string, BoardPresenceMember>();

  for (const entries of Object.values(state)) {
    for (const entry of entries) {
      const existing = membersByUser.get(entry.userId);

      if (!existing) {
        membersByUser.set(entry.userId, {
          userId: entry.userId,
          name: entry.name,
          email: entry.email,
          role: entry.role,
          activity: entry.activity,
          connectedAt: entry.connectedAt,
          updatedAt: entry.updatedAt,
          connections: 1,
        });
        continue;
      }

      const existingUpdatedAt = Date.parse(existing.updatedAt);
      const nextUpdatedAt = Date.parse(entry.updatedAt);
      const existingActivityPriority = getActivityPriority(existing.activity);
      const nextActivityPriority = getActivityPriority(entry.activity);
      const shouldReplaceActivity =
        nextActivityPriority > existingActivityPriority ||
        (nextActivityPriority === existingActivityPriority &&
          nextUpdatedAt >= existingUpdatedAt);

      membersByUser.set(entry.userId, {
        userId: existing.userId,
        name: existing.name ?? entry.name,
        email: existing.email ?? entry.email,
        role: existing.role ?? entry.role,
        activity: shouldReplaceActivity ? entry.activity : existing.activity,
        connectedAt:
          existing.connectedAt <= entry.connectedAt
            ? existing.connectedAt
            : entry.connectedAt,
        updatedAt:
          existingUpdatedAt >= nextUpdatedAt ? existing.updatedAt : entry.updatedAt,
        connections: existing.connections + 1,
      });
    }
  }

  return [...membersByUser.values()].sort((left, right) => {
    const priorityDiff =
      getActivityPriority(right.activity) - getActivityPriority(left.activity);

    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return getPresenceSortLabel(left).localeCompare(getPresenceSortLabel(right));
  });
}

export function useBoardPresence({
  boardId,
  currentUser,
  currentUserRole = null,
}: UseBoardPresenceOptions) {
  const supabase = useMemo(() => createClient(), []);
  const sessionIdRef = useRef(createPresenceSessionId());
  const connectedAtRef = useRef(new Date().toISOString());
  const activeActivityRef = useRef<BoardPresenceActivity>(VIEWING_BOARD_ACTIVITY);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isSubscribedRef = useRef(false);

  const [members, setMembers] = useState<BoardPresenceMember[]>([]);
  const [status, setStatus] = useState<BoardPresenceStatus>("idle");

  const buildPresencePayload = useCallback(
    (activity: BoardPresenceActivity): BoardPresencePayload | null => {
      if (!currentUser) {
        return null;
      }

      return {
        sessionId: sessionIdRef.current,
        userId: currentUser.id,
        name: currentUser.name ?? null,
        email: currentUser.email ?? null,
        role: currentUserRole,
        activity,
        connectedAt: connectedAtRef.current,
        updatedAt: new Date().toISOString(),
      };
    },
    [currentUser, currentUserRole],
  );

  const cleanupChannel = useCallback(
    async (channel: RealtimeChannel | null = channelRef.current) => {
      if (!channel) {
        return;
      }

      const isCurrentChannel = channelRef.current === channel;
      if (isCurrentChannel) {
        channelRef.current = null;
        isSubscribedRef.current = false;
        setMembers([]);
      }

      try {
        await channel.untrack();
      } catch {
        // Best-effort cleanup only.
      }

      await supabase.removeChannel(channel);
    },
    [supabase],
  );

  const trackActivity = useCallback(
    async (activity: BoardPresenceActivity) => {
      activeActivityRef.current = activity;

      const channel = channelRef.current;
      if (!channel || !isSubscribedRef.current) {
        return;
      }

      const payload = buildPresencePayload(activity);
      if (!payload) {
        return;
      }

      await channel.track(payload);
    },
    [buildPresencePayload],
  );

  const setViewingBoardActivity = useCallback(async () => {
    await trackActivity(VIEWING_BOARD_ACTIVITY);
  }, [trackActivity]);

  const setEditingCardActivity = useCallback(
    async (card: BoardPresenceEditingTarget) => {
      await trackActivity({
        type: "editing-card",
        cardId: card.id,
        cardTitle: card.title ?? null,
      });
    },
    [trackActivity],
  );

  useEffect(() => {
    if (!boardId || !currentUser) {
      setStatus("idle");
      void cleanupChannel();
      return;
    }

    void cleanupChannel();

    connectedAtRef.current = new Date().toISOString();
    activeActivityRef.current = VIEWING_BOARD_ACTIVITY;
    setStatus("joining");

    const channel = supabase.channel(getBoardPresenceChannelName(boardId), {
      config: {
        presence: {
          key: sessionIdRef.current,
        },
      },
    });

    channelRef.current = channel;

    const syncPresence = () => {
      if (channelRef.current !== channel) {
        return;
      }

      setMembers(
        normalizeBoardPresenceState(channel.presenceState() as RawPresenceState),
      );
    };

    channel.on("presence", { event: "sync" }, syncPresence);
    channel.on("presence", { event: "join" }, syncPresence);
    channel.on("presence", { event: "leave" }, syncPresence);

    channel.subscribe(async (nextStatus) => {
      if (channelRef.current !== channel) {
        return;
      }

      switch (nextStatus) {
        case "SUBSCRIBED":
          isSubscribedRef.current = true;
          setStatus("joined");
          await trackActivity(activeActivityRef.current);
          return;
        case "CHANNEL_ERROR":
        case "TIMED_OUT":
          isSubscribedRef.current = false;
          setStatus("error");
          return;
        case "CLOSED":
          isSubscribedRef.current = false;
          setMembers([]);
          setStatus("idle");
          return;
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setMembers([]);
        setStatus("idle");
        void cleanupChannel(channel);
      }
    });

    return () => {
      subscription.unsubscribe();
      void cleanupChannel(channel);
    };
  }, [boardId, cleanupChannel, currentUser, supabase, trackActivity]);

  return {
    channelName: getBoardPresenceChannelName(boardId),
    members,
    status,
    setViewingBoardActivity,
    setEditingCardActivity,
  };
}