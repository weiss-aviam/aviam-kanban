/**
 * Tests for useBoardRealtime
 *
 * Key coverage:
 * - INSERT handler maps `created_by` → `createdBy` on new cards
 * - UPDATE handler preserves `createdBy` from the existing card
 * - completedAt is mapped correctly for both INSERT and UPDATE
 */
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBoardRealtime } from "@/hooks/useBoardRealtime";
import { createClient } from "@/lib/supabase/client";
import type { BoardWithDetails } from "@/types/database";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockCreateClient = vi.mocked(createClient);

const BOARD_ID = "board-0000-0000-0000-000000000001";
const CARD_ID = "card-0000-0000-0000-000000000001";
const CREATOR_ID = "user-0000-0000-0000-000000000001";
const COLUMN_ID = 1;

type EventHandler = (payload: {
  eventType: string;
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}) => void;

/** Builds a minimal BoardWithDetails for tests */
function makeBoard(
  cardOverrides: Record<string, unknown> = {},
  includeCard = true,
): BoardWithDetails {
  const card = {
    id: CARD_ID,
    board_id: BOARD_ID,
    column_id: COLUMN_ID,
    title: "Existing card",
    description: null,
    position: 1,
    dueDate: null,
    due_date: null,
    priority: "medium",
    completedAt: null,
    completed_at: null,
    createdAt: new Date(),
    created_at: "",
    createdBy: CREATOR_ID,
    created_by: CREATOR_ID,
    assigneeId: null,
    assignee_id: null,
    labels: [],
    comments: [],
    ...cardOverrides,
  };

  return {
    id: BOARD_ID,
    name: "Test Board",
    owner_id: CREATOR_ID,
    owner: {
      id: CREATOR_ID,
      email: "owner@test.com",
      name: "Owner",
      avatar_url: null,
      created_at: "",
    },
    members: [],
    labels: [],
    role: "owner",
    isArchived: false,
    memberCount: 1,
    created_at: "",
    columns: [
      {
        id: COLUMN_ID,
        board_id: BOARD_ID,
        title: "Todo",
        position: 1,
        isDone: false,
        is_done: false,
        created_at: "",
        cards: includeCard ? [card] : [],
      },
    ],
  } as unknown as BoardWithDetails;
}

/** A minimal DB row payload for a card insert/update event */
function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CARD_ID,
    board_id: BOARD_ID,
    column_id: COLUMN_ID,
    title: "Realtime card",
    description: null,
    position: 1,
    due_date: null,
    priority: "medium",
    completed_at: null,
    created_at: new Date().toISOString(),
    created_by: CREATOR_ID,
    assignee_id: null,
    ...overrides,
  };
}

/** Builds a Supabase mock that captures listeners per table */
function buildSupabaseMock() {
  const listenersByTable: Record<string, EventHandler> = {};

  const channel = {
    on: vi.fn(
      (
        _eventType: unknown,
        filter: { table?: string },
        handler: EventHandler,
      ) => {
        if (filter?.table) {
          listenersByTable[filter.table] = handler;
        }
        return channel;
      },
    ),
    subscribe: vi.fn(() => channel),
    unsubscribe: vi.fn(),
  };

  const supabase = {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn().mockResolvedValue(undefined),
  };

  return {
    supabase,
    getCardsListener: () => listenersByTable["cards"] ?? null,
  };
}

describe("useBoardRealtime — dbRowToCardFields mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps created_by to createdBy on INSERT", () => {
    const { supabase, getCardsListener } = buildSupabaseMock();
    mockCreateClient.mockReturnValue(supabase as never);

    const emptyBoard = makeBoard({}, false);

    let capturedUpdater: ((b: BoardWithDetails) => BoardWithDetails) | null =
      null;
    const onBoardChange = vi.fn(
      (updater: (b: BoardWithDetails) => BoardWithDetails) => {
        capturedUpdater = updater;
      },
    );

    renderHook(() => useBoardRealtime({ boardId: BOARD_ID, onBoardChange }));

    const listener = getCardsListener();
    expect(listener).not.toBeNull();

    listener!({
      eventType: "INSERT",
      new: makeDbRow({ created_by: CREATOR_ID }),
      old: {},
    });

    expect(capturedUpdater).not.toBeNull();
    const nextBoard = capturedUpdater!(emptyBoard);
    const card = nextBoard.columns[0]!.cards[0];

    expect(card).toBeDefined();
    expect((card as unknown as { createdBy: string }).createdBy).toBe(
      CREATOR_ID,
    );
  });

  it("maps completedAt on INSERT", () => {
    const { supabase, getCardsListener } = buildSupabaseMock();
    mockCreateClient.mockReturnValue(supabase as never);

    const emptyBoard = makeBoard({}, false);

    let capturedUpdater: ((b: BoardWithDetails) => BoardWithDetails) | null =
      null;
    const onBoardChange = vi.fn(
      (updater: (b: BoardWithDetails) => BoardWithDetails) => {
        capturedUpdater = updater;
      },
    );

    renderHook(() => useBoardRealtime({ boardId: BOARD_ID, onBoardChange }));

    const completedAt = "2026-03-24T12:00:00.000Z";
    getCardsListener()!({
      eventType: "INSERT",
      new: makeDbRow({ completed_at: completedAt }),
      old: {},
    });

    expect(capturedUpdater).not.toBeNull();
    const nextBoard = capturedUpdater!(emptyBoard);
    const card = nextBoard.columns[0]!.cards[0];
    expect((card as unknown as { completedAt: string }).completedAt).toBe(
      completedAt,
    );
  });

  it("preserves createdBy from existing card on UPDATE", () => {
    const { supabase, getCardsListener } = buildSupabaseMock();
    mockCreateClient.mockReturnValue(supabase as never);

    // Board with existing card that has createdBy set
    const board = makeBoard({ createdBy: CREATOR_ID });

    let capturedUpdater: ((b: BoardWithDetails) => BoardWithDetails) | null =
      null;
    const onBoardChange = vi.fn(
      (updater: (b: BoardWithDetails) => BoardWithDetails) => {
        capturedUpdater = updater;
      },
    );

    renderHook(() => useBoardRealtime({ boardId: BOARD_ID, onBoardChange }));

    // Fire UPDATE — incoming row has created_by set (now that we fixed dbRowToCardFields)
    getCardsListener()!({
      eventType: "UPDATE",
      new: makeDbRow({ title: "Updated title", created_by: CREATOR_ID }),
      old: {},
    });

    expect(capturedUpdater).not.toBeNull();
    const nextBoard = capturedUpdater!(board);
    const card = nextBoard.columns[0]!.cards[0];
    expect((card as unknown as { createdBy: string }).createdBy).toBe(
      CREATOR_ID,
    );
  });

  it("maps created_by=null to createdBy=null on INSERT (legacy cards)", () => {
    const { supabase, getCardsListener } = buildSupabaseMock();
    mockCreateClient.mockReturnValue(supabase as never);

    const emptyBoard = makeBoard({}, false);

    let capturedUpdater: ((b: BoardWithDetails) => BoardWithDetails) | null =
      null;
    const onBoardChange = vi.fn(
      (updater: (b: BoardWithDetails) => BoardWithDetails) => {
        capturedUpdater = updater;
      },
    );

    renderHook(() => useBoardRealtime({ boardId: BOARD_ID, onBoardChange }));

    getCardsListener()!({
      eventType: "INSERT",
      new: makeDbRow({ created_by: null }),
      old: {},
    });

    expect(capturedUpdater).not.toBeNull();
    const nextBoard = capturedUpdater!(emptyBoard);
    const card = nextBoard.columns[0]!.cards[0];
    expect((card as unknown as { createdBy: unknown }).createdBy).toBeNull();
  });
});
