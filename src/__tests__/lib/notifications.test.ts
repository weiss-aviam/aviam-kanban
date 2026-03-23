import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock the Supabase server client ──────────────────────────────────────────

const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: mockFrom })),
}));

// ── import after mocks ────────────────────────────────────────────────────────

const { createNotifications } = await import("@/lib/notifications");

// ── helpers ───────────────────────────────────────────────────────────────────

function makeRow(overrides = {}) {
  return {
    user_id: "user-1",
    type: "mention" as const,
    actor_id: "actor-1",
    card_id: "card-uuid",
    board_id: "board-uuid",
    metadata: {},
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("createNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it("does not call insert when given zero rows", async () => {
    // createNotifications receives a pre-created supabase client
    const supabase = { from: mockFrom } as unknown as Parameters<
      typeof createNotifications
    >[0];
    await createNotifications(supabase, []);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("inserts a batch of rows", async () => {
    const supabase = { from: mockFrom } as unknown as Parameters<
      typeof createNotifications
    >[0];
    const rows = [
      makeRow(),
      makeRow({ user_id: "user-2", type: "card_assigned" }),
    ];
    await createNotifications(supabase, rows);
    expect(mockFrom).toHaveBeenCalledWith("notifications");
    expect(mockInsert).toHaveBeenCalledWith(rows);
  });

  it("does not throw when insert returns an error", async () => {
    mockInsert.mockResolvedValue({ error: new Error("DB down") });
    const supabase = { from: mockFrom } as unknown as Parameters<
      typeof createNotifications
    >[0];
    // Must resolve without throwing
    await expect(
      createNotifications(supabase, [makeRow()]),
    ).resolves.toBeUndefined();
  });
});
