import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getBoardPresenceChannelName,
  normalizeBoardPresenceState,
  useBoardPresence,
} from "@/hooks/useBoardPresence";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

describe("useBoardPresence", () => {
  const mockCreateClient = vi.mocked(createClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a stable board-scoped channel name", () => {
    expect(getBoardPresenceChannelName("board-123")).toBe(
      "board-presence:board-123",
    );
  });

  it("normalizes multiple presence sessions into one member per user", () => {
    expect(
      normalizeBoardPresenceState({
        sessionA: [
          {
            sessionId: "sessionA",
            userId: "user-1",
            name: "Alex",
            email: "alex@example.com",
            role: "member",
            activity: { type: "viewing-board" },
            connectedAt: "2026-03-07T10:00:00.000Z",
            updatedAt: "2026-03-07T10:00:00.000Z",
          },
        ],
        sessionB: [
          {
            sessionId: "sessionB",
            userId: "user-1",
            name: "Alex",
            email: "alex@example.com",
            role: "member",
            activity: {
              type: "editing-card",
              cardId: "card-1",
              cardTitle: "Fix regression",
            },
            connectedAt: "2026-03-07T10:05:00.000Z",
            updatedAt: "2026-03-07T10:05:00.000Z",
          },
        ],
      }),
    ).toEqual([
      {
        userId: "user-1",
        name: "Alex",
        email: "alex@example.com",
        role: "member",
        activity: {
          type: "editing-card",
          cardId: "card-1",
          cardTitle: "Fix regression",
        },
        connectedAt: "2026-03-07T10:00:00.000Z",
        updatedAt: "2026-03-07T10:05:00.000Z",
        connections: 2,
      },
    ]);
  });

  it("tracks initial presence, updates activity, and cleans up on unmount", async () => {
    const presenceState = {
      remote: [
        {
          sessionId: "remote",
          userId: "user-2",
          name: "Riley",
          email: "riley@example.com",
          role: "viewer",
          activity: { type: "viewing-board" as const },
          connectedAt: "2026-03-07T09:55:00.000Z",
          updatedAt: "2026-03-07T09:55:00.000Z",
        },
      ],
    };

    const presenceHandlers: Record<string, () => void> = {};
    const track = vi.fn().mockResolvedValue("ok");
    const untrack = vi.fn().mockResolvedValue("ok");
    const subscribe = vi.fn(
      async (callback: (status: string) => void | Promise<void>) => {
        await callback("SUBSCRIBED");
        return channel;
      },
    );
    const channel = {
      on: vi.fn((_type: string, filter: { event: string }, handler: () => void) => {
        presenceHandlers[filter.event] = handler;
        return channel;
      }),
      subscribe,
      track,
      untrack,
      presenceState: vi.fn(() => presenceState),
    };

    const unsubscribe = vi.fn();
    const onAuthStateChange = vi.fn(() => ({
      data: { subscription: { unsubscribe } },
    }));
    const removeChannel = vi.fn().mockResolvedValue("ok");

    mockCreateClient.mockReturnValue({
      channel: vi.fn(() => channel),
      removeChannel,
      auth: { onAuthStateChange },
    } as never);

    const { result, unmount } = renderHook(() =>
      useBoardPresence({
        boardId: "board-123",
        currentUser: {
          id: "user-1",
          name: "Taylor",
          email: "taylor@example.com",
        },
        currentUserRole: "admin",
      }),
    );

    await waitFor(() => {
      expect(track).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          name: "Taylor",
          email: "taylor@example.com",
          role: "admin",
          activity: { type: "viewing-board" },
        }),
      );
    });

    act(() => {
      presenceHandlers.sync?.();
    });

    await waitFor(() => {
      expect(result.current.members).toEqual([
        {
          userId: "user-2",
          name: "Riley",
          email: "riley@example.com",
          role: "viewer",
          activity: { type: "viewing-board" },
          connectedAt: "2026-03-07T09:55:00.000Z",
          updatedAt: "2026-03-07T09:55:00.000Z",
          connections: 1,
        },
      ]);
      expect(result.current.status).toBe("joined");
    });

    await act(async () => {
      await result.current.setEditingCardActivity({
        id: "card-99",
        title: "Investigate incident",
      });
    });

    expect(track).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activity: {
          type: "editing-card",
          cardId: "card-99",
          cardTitle: "Investigate incident",
        },
      }),
    );

    unmount();

    await waitFor(() => {
      expect(unsubscribe).toHaveBeenCalledTimes(1);
      expect(untrack).toHaveBeenCalledTimes(1);
      expect(removeChannel).toHaveBeenCalledWith(channel);
    });
  });
});