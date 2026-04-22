import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockGetSessionUser = vi.fn();

/**
 * A chainable Supabase query builder stub.
 * Every method returns `this` so any chain works.
 * `then` makes it thenable (awaitable) returning the configured result.
 */
function makeChainable(resolveWith: unknown) {
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop === "then") {
        // Make the object awaitable
        return (resolve: (v: unknown) => unknown) =>
          Promise.resolve(resolveWith).then(resolve);
      }
      // Every method returns another chainable with the same resolved value
      return () => new Proxy({}, handler);
    },
  };
  return new Proxy({}, handler);
}

function buildSupabaseMock(
  rowsResult = { data: [], error: null },
  countResult = { count: 0, error: null },
) {
  const selectChain = makeChainable(rowsResult);
  const countChain = makeChainable(countResult);
  const updateChain = makeChainable({ error: null });

  let selectCallCount = 0;

  return {
    from: vi.fn(() => ({
      select: vi.fn(() => {
        selectCallCount++;
        // First select is the main data query; second is the count query
        return selectCallCount === 1 ? selectChain : countChain;
      }),
      update: vi.fn(() => updateChain),
    })),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getAuthorizedUser: mockGetSessionUser,
  getSessionUser: mockGetSessionUser,
}));

// ── import routes after mocks ─────────────────────────────────────────────────

const { GET: getNotifications } = await import("@/app/api/notifications/route");
const { PATCH: patchNotification } =
  await import("@/app/api/notifications/[id]/route");
const { POST: markAllRead } =
  await import("@/app/api/notifications/mark-all-read/route");

// ── helpers ───────────────────────────────────────────────────────────────────

function _makeRequest(method = "GET", body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/notifications", {
    method,
    body: body ? JSON.stringify(body) : null,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/notifications", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({ supabase: {} as never, user: null });
    const res = await getNotifications();
    expect(res.status).toBe(401);
  });

  it("returns notifications array when authenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock() as never,
      user: { id: "user-1" } as never,
    });
    // The chainable mock already resolves with { data: [], error: null } by default
    const res = await getNotifications();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("notifications");
    expect(body).toHaveProperty("unreadCount");
  });
});

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({ supabase: {} as never, user: null });
    const req = new NextRequest("http://localhost/api/notifications/some-id", {
      method: "PATCH",
    });
    const res = await patchNotification(req, {
      params: Promise.resolve({ id: "some-id" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("POST /api/notifications/mark-all-read", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({ supabase: {} as never, user: null });
    const res = await markAllRead();
    expect(res.status).toBe(401);
  });

  it("returns ok when authenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock() as never,
      user: { id: "user-1" } as never,
    });
    const res = await markAllRead();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("ok", true);
  });
});
