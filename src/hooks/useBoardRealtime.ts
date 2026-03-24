"use client";

import { useEffect, useRef, useMemo, useCallback } from "react";
import type {
  RealtimeChannel,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import type { BoardWithDetails } from "@/types/database";

type BoardUpdater = (prev: BoardWithDetails) => BoardWithDetails;

interface UseBoardRealtimeOptions {
  boardId: string;
  onBoardChange: (updater: BoardUpdater) => void;
}

type DbRow = Record<string, unknown>;

function dbRowToCardFields(row: DbRow) {
  return {
    id: row.id as string,
    boardId: row.board_id as string,
    columnId: row.column_id as number,
    title: row.title as string,
    description: (row.description as string | null) ?? null,
    position: row.position as number,
    dueDate: row.due_date ? new Date(row.due_date as string) : null,
    priority: (row.priority as string) ?? "medium",
    completedAt: (row.completed_at as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    createdBy: (row.created_by as string | null) ?? null,
    assigneeId: (row.assignee_id as string | null) ?? null,
  };
}

export function useBoardRealtime({
  boardId,
  onBoardChange,
}: UseBoardRealtimeOptions) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // Stable wrapper so the effect only re-runs when boardId changes, not on each render.
  // onBoardChange from BoardDetailPage is already stable (useCallback with stable deps).
  const stableOnBoardChange = useCallback(
    (updater: BoardUpdater) => onBoardChange(updater),

    [onBoardChange],
  );

  useEffect(() => {
    if (!boardId) return;

    if (channelRef.current) {
      void supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase.channel(`board-realtime:${boardId}`);

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "cards",
        filter: `board_id=eq.${boardId}`,
      },
      (payload: RealtimePostgresChangesPayload<DbRow>) => {
        const { eventType } = payload;

        if (eventType === "INSERT") {
          const card = dbRowToCardFields(payload.new);
          stableOnBoardChange((prev) => ({
            ...prev,
            columns: prev.columns.map((col) => {
              if (col.id !== card.columnId) return col;
              // Skip if card already exists (our own optimistic insert)
              if (col.cards.some((c) => c.id === card.id)) return col;
              return {
                ...col,
                cards: [
                  ...col.cards,
                  { ...card, labels: [], comments: [] },
                ].sort((a, b) => a.position - b.position) as typeof col.cards,
              };
            }),
          }));
        } else if (eventType === "UPDATE") {
          const incoming = dbRowToCardFields(payload.new);
          stableOnBoardChange((prev) => {
            // Preserve rich data (labels, comments, assignee object) from existing card
            const existing = prev.columns
              .flatMap((col) => col.cards)
              .find((c) => c.id === incoming.id);

            const merged = existing
              ? {
                  ...existing,
                  ...incoming,
                  // If assignee_id changed, try to resolve from board members
                  assignee:
                    incoming.assigneeId !== existing.assigneeId
                      ? (prev.members?.find(
                          (m) => m.user.id === incoming.assigneeId,
                        )?.user ?? undefined)
                      : existing.assignee,
                }
              : { ...incoming, labels: [], comments: [] };

            return {
              ...prev,
              columns: prev.columns.map((col) => {
                const hadCard = col.cards.some((c) => c.id === merged.id);
                const isTarget = col.id === merged.columnId;

                if (hadCard && isTarget) {
                  // Same column — update in place
                  return {
                    ...col,
                    cards: col.cards
                      .map((c) =>
                        c.id === merged.id ? (merged as typeof c) : c,
                      )
                      .sort((a, b) => a.position - b.position),
                  };
                } else if (hadCard) {
                  // Moved away — remove
                  return {
                    ...col,
                    cards: col.cards.filter((c) => c.id !== merged.id),
                  };
                } else if (isTarget) {
                  // Moved here — insert
                  return {
                    ...col,
                    cards: [...col.cards, merged as (typeof col.cards)[0]].sort(
                      (a, b) => a.position - b.position,
                    ),
                  };
                }
                return col;
              }),
            };
          });
        } else if (eventType === "DELETE") {
          const deletedId = (payload.old as DbRow).id as string;
          stableOnBoardChange((prev) => ({
            ...prev,
            columns: prev.columns.map((col) => ({
              ...col,
              cards: col.cards.filter((c) => c.id !== deletedId),
            })),
          }));
        }
      },
    );

    channel.on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "columns",
        filter: `board_id=eq.${boardId}`,
      },
      (payload: RealtimePostgresChangesPayload<DbRow>) => {
        const { eventType } = payload;

        if (eventType === "UPDATE") {
          const row = payload.new;
          stableOnBoardChange((prev) => ({
            ...prev,
            columns: prev.columns
              .map((col) =>
                col.id === (row.id as number)
                  ? {
                      ...col,
                      title: (row.title as string) ?? col.title,
                      position: (row.position as number) ?? col.position,
                      isDone: (row.is_done as boolean) ?? col.isDone,
                    }
                  : col,
              )
              .sort((a, b) => a.position - b.position),
          }));
        } else if (eventType === "DELETE") {
          const deletedId = (payload.old as DbRow).id as number;
          stableOnBoardChange((prev) => ({
            ...prev,
            columns: prev.columns.filter((col) => col.id !== deletedId),
          }));
        }
        // INSERT is handled locally via handleColumnCreated in BoardDetailPage
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
  }, [boardId, supabase, stableOnBoardChange]);
}
