/**
 * Tests for the deadline guard in PATCH /api/cards/[id]
 *
 * Business rule: only the card creator can change due_date directly.
 * Cards with created_by = null (pre-date creator tracking) are also allowed.
 * Everyone else must use the suggestion workflow.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { PATCH } from "@/app/api/cards/[id]/route";
import { getSessionUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBoardMutationAuthorization } from "@/lib/board-access";

vi.mock("@/lib/supabase/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/board-access", () => ({
  getBoardMutationAuthorization: vi.fn(),
}));
vi.mock("@/lib/notifications", () => ({
  createNotifications: vi.fn().mockResolvedValue(undefined),
}));

const CARD_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BOARD_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CREATOR_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const OTHER_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockGetBoardMutationAuthorization = vi.mocked(
  getBoardMutationAuthorization,
);

const params = { params: Promise.resolve({ id: CARD_ID }) };

function buildRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/cards/${CARD_ID}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeSupabase(userId: string, card: Record<string, unknown>) {
  const updatedCard = {
    id: CARD_ID,
    board_id: BOARD_ID,
    column_id: 1,
    title: "Test card",
    description: null,
    assignee_id: null,
    due_date: card.due_date ?? null,
    priority: "medium",
    completed_at: null,
    position: 1,
    created_at: new Date().toISOString(),
    created_by: card.created_by ?? null,
  };

  const chain = (resolveValue: unknown) => {
    const obj: Record<string, unknown> = {};
    const handler: ProxyHandler<object> = {
      get(_t, prop) {
        if (prop === "then") {
          return (resolve: (v: unknown) => unknown) =>
            Promise.resolve(resolveValue).then(resolve);
        }
        return () => new Proxy(obj, handler);
      },
    };
    return new Proxy(obj, handler);
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "cards") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: card, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: updatedCard, error: null }),
              }),
            }),
          }),
        };
      }
      if (table === "columns") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 2, board_id: BOARD_ID, title: "Done" },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      // boards, card_deadline_requests — return chainable no-ops
      return chain({ data: null, error: null });
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetBoardMutationAuthorization.mockResolvedValue({
    ok: true,
    role: "member",
  });
  // Admin client just needs to exist (notifications mock swallows the call)
  mockCreateAdminClient.mockReturnValue(
    {} as ReturnType<typeof createAdminClient>,
  );
});

describe("PATCH /api/cards/[id] — deadline guard", () => {
  it("allows the card creator to change due_date", async () => {
    const card = {
      id: CARD_ID,
      board_id: BOARD_ID,
      column_id: 1,
      created_by: CREATOR_ID,
      due_date: null,
      assignee_id: null,
      completed_at: null,
    };
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabase(CREATOR_ID, card) as never,
      user: { id: CREATOR_ID } as never,
    });

    const res = await PATCH(
      buildRequest({ dueDate: "2026-06-01T00:00:00.000Z" }),
      params,
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it("blocks a non-creator from changing due_date", async () => {
    const card = {
      id: CARD_ID,
      board_id: BOARD_ID,
      column_id: 1,
      created_by: CREATOR_ID,
      due_date: null,
      assignee_id: null,
      completed_at: null,
    };
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabase(OTHER_ID, card) as never,
      user: { id: OTHER_ID } as never,
    });

    const res = await PATCH(
      buildRequest({ dueDate: "2026-06-01T00:00:00.000Z" }),
      params,
    );

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/card creator/i);
  });

  it("allows any board member to change due_date when created_by is null (legacy cards)", async () => {
    const card = {
      id: CARD_ID,
      board_id: BOARD_ID,
      column_id: 1,
      created_by: null, // legacy card — no creator recorded
      due_date: null,
      assignee_id: null,
      completed_at: null,
    };
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabase(OTHER_ID, card) as never,
      user: { id: OTHER_ID } as never,
    });

    const res = await PATCH(
      buildRequest({ dueDate: "2026-06-01T00:00:00.000Z" }),
      params,
    );

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
  });

  it("allows setting dueDate to null (removing deadline) by creator", async () => {
    const card = {
      id: CARD_ID,
      board_id: BOARD_ID,
      column_id: 1,
      created_by: CREATOR_ID,
      due_date: "2026-05-01T00:00:00.000Z",
      assignee_id: null,
      completed_at: null,
    };
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabase(CREATOR_ID, card) as never,
      user: { id: CREATOR_ID } as never,
    });

    const res = await PATCH(buildRequest({ dueDate: null }), params);

    expect(res.status).toBe(200);
  });

  it("allows PATCH without dueDate field (non-deadline update) by any member", async () => {
    const card = {
      id: CARD_ID,
      board_id: BOARD_ID,
      column_id: 1,
      created_by: CREATOR_ID,
      due_date: null,
      assignee_id: null,
      completed_at: null,
    };
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabase(OTHER_ID, card) as never,
      user: { id: OTHER_ID } as never,
    });

    const res = await PATCH(buildRequest({ title: "New title" }), params);

    expect(res.status).toBe(200);
  });
});
