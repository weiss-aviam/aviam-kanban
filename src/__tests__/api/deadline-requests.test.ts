import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  GET as getDeadlineRequests,
  POST as createDeadlineRequest,
} from "@/app/api/cards/[id]/deadline-requests/route";
import { PATCH as resolveDeadlineRequest } from "@/app/api/cards/[id]/deadline-requests/[requestId]/route";
import { getSessionUser } from "@/lib/supabase/server";
import { getBoardMutationAuthorization } from "@/lib/board-access";

vi.mock("@/lib/supabase/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/board-access", () => ({
  getBoardMutationAuthorization: vi.fn(),
}));

const CARD_ID = "11111111-1111-4111-8111-111111111111";
const BOARD_ID = "22222222-2222-4222-8222-222222222222";
const REQUEST_ID = "33333333-3333-4333-8333-333333333333";
const CREATOR_ID = "44444444-4444-4444-8444-444444444444";
const MEMBER_ID = "55555555-5555-5555-8555-555555555555";

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockGetBoardMutationAuthorization = vi.mocked(
  getBoardMutationAuthorization,
);

const buildRequest = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost:3000${url}`, {
    method,
    ...(body !== undefined
      ? {
          body: JSON.stringify(body),
          headers: { "Content-Type": "application/json" },
        }
      : {}),
  });

const cardParams = { params: Promise.resolve({ id: CARD_ID }) };
const requestParams = {
  params: Promise.resolve({ id: CARD_ID, requestId: REQUEST_ID }),
};

const mockCard = {
  id: CARD_ID,
  board_id: BOARD_ID,
  column_id: 1,
  created_by: CREATOR_ID,
};

const mockRequest = {
  id: REQUEST_ID,
  card_id: CARD_ID,
  status: "pending",
  suggested_due_date: "2026-04-01T00:00:00.000Z",
};

function makeSessionUser(userId: string, fromImpl: (table: string) => unknown) {
  const supabase = {
    from: vi.fn(fromImpl),
  };
  return { supabase, user: { id: userId } };
}

describe("deadline-requests routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetBoardMutationAuthorization.mockResolvedValue({
      ok: true,
      role: "member",
    });
  });

  // ─── GET ─────────────────────────────────────────────────────────────────

  describe("GET /api/cards/[id]/deadline-requests", () => {
    it("returns 401 when unauthenticated", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: null,
      });

      const res = await getDeadlineRequests(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "GET"),
        cardParams,
      );
      expect(res.status).toBe(401);
    });

    it("returns 400 for an invalid card ID", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: { from: vi.fn() } as never,
        user: { id: MEMBER_ID } as never,
      });

      const res = await getDeadlineRequests(
        buildRequest("/api/cards/not-a-uuid/deadline-requests", "GET"),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      expect(res.status).toBe(400);
    });

    it("returns 404 when the card does not exist", async () => {
      const { supabase, user } = makeSessionUser(MEMBER_ID, () => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      }));
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await getDeadlineRequests(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "GET"),
        cardParams,
      );
      expect(res.status).toBe(404);
    });

    it("returns the deadline requests for a card", async () => {
      const requests = [
        {
          id: REQUEST_ID,
          suggested_due_date: "2026-04-01T00:00:00Z",
          note: "Please push back",
          status: "pending",
          change_type: "suggestion",
          created_at: "2026-03-10T10:00:00Z",
          resolved_at: null,
          requester: {
            id: MEMBER_ID,
            name: "Alice",
            email: "alice@example.com",
          },
          resolver: null,
        },
      ];
      const { supabase, user } = makeSessionUser(MEMBER_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: mockCard, error: null }),
              })),
            })),
          };
        }
        if (table === "card_deadline_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi
                  .fn()
                  .mockResolvedValue({ data: requests, error: null }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await getDeadlineRequests(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "GET"),
        cardParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toEqual({ requests });
    });
  });

  // ─── POST ────────────────────────────────────────────────────────────────

  describe("POST /api/cards/[id]/deadline-requests", () => {
    it("returns 400 for missing suggestedDueDate", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: { from: vi.fn() } as never,
        user: { id: MEMBER_ID } as never,
      });

      const res = await createDeadlineRequest(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "POST", {
          note: "no date",
        }),
        cardParams,
      );
      expect(res.status).toBe(400);
    });

    it("returns 400 when the card creator tries to suggest", async () => {
      const { supabase, user } = makeSessionUser(CREATOR_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await createDeadlineRequest(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "POST", {
          suggestedDueDate: "2026-05-01T00:00:00.000Z",
        }),
        cardParams,
      );
      expect(res.status).toBe(400);
      await expect(res.json()).resolves.toMatchObject({
        error: expect.stringContaining("directly"),
      });
    });

    it("returns 409 when the member already has a pending request", async () => {
      const { supabase, user } = makeSessionUser(MEMBER_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "card_deadline_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: { id: REQUEST_ID },
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await createDeadlineRequest(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "POST", {
          suggestedDueDate: "2026-05-01T00:00:00.000Z",
        }),
        cardParams,
      );
      expect(res.status).toBe(409);
    });

    it("creates a deadline suggestion for a board member", async () => {
      const newRequest = {
        id: REQUEST_ID,
        suggested_due_date: "2026-05-01T00:00:00.000Z",
        note: null,
        status: "pending",
        change_type: "suggestion",
        created_at: "2026-03-12T10:00:00Z",
        resolved_at: null,
        requester: { id: MEMBER_ID, name: "Bob", email: "bob@example.com" },
        resolver: null,
      };
      const insertSelect = vi.fn(() => ({
        single: vi.fn().mockResolvedValue({ data: newRequest, error: null }),
      }));
      const insert = vi.fn(() => ({ select: insertSelect }));

      const { supabase, user } = makeSessionUser(MEMBER_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "card_deadline_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle: vi
                      .fn()
                      .mockResolvedValue({ data: null, error: null }),
                  })),
                })),
              })),
            })),
            insert,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await createDeadlineRequest(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "POST", {
          suggestedDueDate: "2026-05-01T00:00:00.000Z",
        }),
        cardParams,
      );
      expect(res.status).toBe(201);
      await expect(res.json()).resolves.toEqual({ request: newRequest });
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({
          card_id: CARD_ID,
          requested_by: MEMBER_ID,
          status: "pending",
        }),
      );
    });

    it("returns 403 when board access is denied", async () => {
      const { supabase, user } = makeSessionUser(MEMBER_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });
      mockGetBoardMutationAuthorization.mockResolvedValue({
        ok: false,
        status: 403,
        error: "Insufficient permissions",
      });

      const res = await createDeadlineRequest(
        buildRequest(`/api/cards/${CARD_ID}/deadline-requests`, "POST", {
          suggestedDueDate: "2026-05-01T00:00:00.000Z",
        }),
        cardParams,
      );
      expect(res.status).toBe(403);
    });
  });

  // ─── PATCH ───────────────────────────────────────────────────────────────

  describe("PATCH /api/cards/[id]/deadline-requests/[requestId]", () => {
    it("returns 400 for an invalid action", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: { from: vi.fn() } as never,
        user: { id: CREATOR_ID } as never,
      });

      const res = await resolveDeadlineRequest(
        buildRequest(
          `/api/cards/${CARD_ID}/deadline-requests/${REQUEST_ID}`,
          "PATCH",
          { action: "accept" }, // invalid
        ),
        requestParams,
      );
      expect(res.status).toBe(400);
    });

    it("returns 403 when a non-creator tries to resolve", async () => {
      const { supabase, user } = makeSessionUser(MEMBER_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await resolveDeadlineRequest(
        buildRequest(
          `/api/cards/${CARD_ID}/deadline-requests/${REQUEST_ID}`,
          "PATCH",
          { action: "approve" },
        ),
        requestParams,
      );
      expect(res.status).toBe(403);
      await expect(res.json()).resolves.toMatchObject({
        error: expect.stringContaining("creator"),
      });
    });

    it("returns 409 when the request is already resolved", async () => {
      const { supabase, user } = makeSessionUser(CREATOR_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "card_deadline_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: { ...mockRequest, status: "approved" },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await resolveDeadlineRequest(
        buildRequest(
          `/api/cards/${CARD_ID}/deadline-requests/${REQUEST_ID}`,
          "PATCH",
          { action: "reject" },
        ),
        requestParams,
      );
      expect(res.status).toBe(409);
    });

    it("rejects a pending suggestion", async () => {
      const updateEq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn(() => ({ eq: updateEq }));

      const { supabase, user } = makeSessionUser(CREATOR_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
          };
        }
        if (table === "card_deadline_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: mockRequest,
                    error: null,
                  }),
                })),
              })),
            })),
            update,
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await resolveDeadlineRequest(
        buildRequest(
          `/api/cards/${CARD_ID}/deadline-requests/${REQUEST_ID}`,
          "PATCH",
          { action: "reject" },
        ),
        requestParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        message: expect.stringContaining("rejected"),
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ status: "rejected" }),
      );
    });

    it("approves a suggestion and updates the card due_date", async () => {
      const deadlineUpdate = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }));
      const cardUpdate = vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }));
      // auto-reject others: update().eq().eq().neq()
      const autoRejectChain = vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            neq: vi.fn().mockResolvedValue({ error: null }),
          })),
        })),
      }));
      let deadlineUpdateCallCount = 0;

      const { supabase, user } = makeSessionUser(CREATOR_ID, (table) => {
        if (table === "cards") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: mockCard,
                  error: null,
                }),
              })),
            })),
            update: cardUpdate,
          };
        }
        if (table === "card_deadline_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: mockRequest,
                    error: null,
                  }),
                })),
              })),
            })),
            update: () => {
              deadlineUpdateCallCount++;
              // First call: update the request status
              if (deadlineUpdateCallCount === 1) {
                return { eq: vi.fn().mockResolvedValue({ error: null }) };
              }
              // Second call: auto-reject others
              return autoRejectChain();
            },
          };
        }
        throw new Error(`Unexpected table: ${table}`);
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: user as never,
      });

      const res = await resolveDeadlineRequest(
        buildRequest(
          `/api/cards/${CARD_ID}/deadline-requests/${REQUEST_ID}`,
          "PATCH",
          { action: "approve" },
        ),
        requestParams,
      );
      expect(res.status).toBe(200);
      await expect(res.json()).resolves.toMatchObject({
        message: expect.stringContaining("approved"),
      });
      // Card due_date should be updated
      expect(cardUpdate).toHaveBeenCalledWith({
        due_date: mockRequest.suggested_due_date,
      });
    });
  });
});
