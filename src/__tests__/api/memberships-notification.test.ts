import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Constants ─────────────────────────────────────────────────────────────────

// Proper RFC 4122 UUIDs (version 1, variant 4) required by Zod v4's stricter check
const BOARD_ID = "123e4567-e89b-12d3-a456-426614174001";
const ACTOR_ID = "123e4567-e89b-12d3-a456-426614174002";
const TARGET_ID = "123e4567-e89b-12d3-a456-426614174003";

// ── Chainable Supabase query builder stub ──────────────────────────────────────

function makeChainable(resolveWith: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolveWith).then(resolve);
      }
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

// ── Mocks ─────────────────────────────────────────────────────────────────────
// vi.hoisted() ensures variables are initialized before vi.mock factories run.

const {
  mockGetUser,
  mockAdminFrom,
  mockRequireAdminAccess,
  mockLogAdminAction,
  mockCreateNotifications,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockAdminFrom: vi.fn(),
  mockRequireAdminAccess: vi.fn(),
  mockLogAdminAction: vi.fn(),
  mockCreateNotifications: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockAdminFrom })),
  requireAdminAccess: mockRequireAdminAccess,
  logAdminAction: mockLogAdminAction,
  getClientIP: vi.fn(() => "127.0.0.1"),
  getUserAgent: vi.fn(() => "test-agent"),
}));

vi.mock("@/lib/notifications", () => ({
  createNotifications: mockCreateNotifications,
}));

// ── Import route after mocks ───────────────────────────────────────────────────

const { POST } = await import("@/app/api/admin/memberships/route");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object): NextRequest {
  return new NextRequest(
    `http://localhost/api/admin/memberships?boardId=${BOARD_ID}`,
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
  );
}

/**
 * Set up the admin Supabase mock for a successful add-member flow:
 *   1. users lookup → target user found
 *   2. board_members existence check → not yet a member
 *   3. board_members insert → success
 *   4. boards lookup → board found (for notification)
 */
function setupAdminClientForSuccess(actorId = ACTOR_ID) {
  const callCounts: Record<string, number> = {};

  mockAdminFrom.mockImplementation((table: string) => {
    callCounts[table] = (callCounts[table] ?? 0) + 1;

    if (table === "users") {
      return makeChainable({
        data: { id: TARGET_ID, email: "target@test.com", name: "Target User" },
        error: null,
      });
    }

    if (table === "board_members") {
      // First call = existence check (maybeSingle → null means not a member)
      // Second call = insert
      if (callCounts["board_members"] === 1) {
        return makeChainable({ data: null, error: null });
      }
      return makeChainable({ data: null, error: null });
    }

    if (table === "boards") {
      return makeChainable({
        data: { id: BOARD_ID, name: "My Board" },
        error: null,
      });
    }

    return makeChainable({ data: null, error: null });
  });

  mockGetUser.mockResolvedValue({
    data: { user: { id: actorId } },
    error: null,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/admin/memberships — board_member_added notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAdminAccess.mockResolvedValue({ role: "admin" });
    mockLogAdminAction.mockResolvedValue(undefined);
    mockCreateNotifications.mockResolvedValue(undefined);
  });

  it("creates a board_member_added notification when a different user is added", async () => {
    setupAdminClientForSuccess(ACTOR_ID);

    const res = await POST(makeRequest({ userId: TARGET_ID, role: "member" }));
    expect(res.status).toBe(201);

    expect(mockCreateNotifications).toHaveBeenCalledOnce();
    const [, rows] = mockCreateNotifications.mock.calls[0] as [
      unknown,
      Array<Record<string, unknown>>,
    ];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: TARGET_ID,
      type: "board_member_added",
      actor_id: ACTOR_ID,
      card_id: null,
      board_id: BOARD_ID,
    });
  });

  it("includes boardName and role in notification metadata", async () => {
    setupAdminClientForSuccess(ACTOR_ID);

    await POST(makeRequest({ userId: TARGET_ID, role: "member" }));

    const [, rows] = mockCreateNotifications.mock.calls[0] as [
      unknown,
      Array<Record<string, unknown>>,
    ];
    expect(rows[0]?.metadata).toMatchObject({
      boardName: "My Board",
      role: "member",
    });
  });

  it("skips notification when the actor adds themselves", async () => {
    // Actor and target are the same user
    setupAdminClientForSuccess(TARGET_ID);

    const res = await POST(makeRequest({ userId: TARGET_ID, role: "member" }));
    expect(res.status).toBe(201);
    expect(mockCreateNotifications).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
      error: new Error("not authed"),
    });

    const res = await POST(makeRequest({ userId: TARGET_ID, role: "member" }));
    expect(res.status).toBe(401);
    expect(mockCreateNotifications).not.toHaveBeenCalled();
  });

  it("returns 403 when caller lacks admin access", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: ACTOR_ID } },
      error: null,
    });
    mockRequireAdminAccess.mockRejectedValue(
      new Error("Admin access required"),
    );

    const res = await POST(makeRequest({ userId: TARGET_ID, role: "member" }));
    expect(res.status).toBe(403);
    expect(mockCreateNotifications).not.toHaveBeenCalled();
  });
});
