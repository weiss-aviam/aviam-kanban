import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/changesets/board/route";
import { getAuthorizedUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { _resetRateLimitForTests } from "@/lib/api/rate-limit";

vi.mock("@/lib/supabase/server", () => ({
  getAuthorizedUser: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

const mockAuth = vi.mocked(getAuthorizedUser);
const mockAdmin = vi.mocked(createAdminClient);

function noopAdminClient() {
  // No replay row found; insert is a no-op; sweep DELETE returns nothing.
  const lookup = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          gt: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    })),
    insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn(() => ({
      lt: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
  return { from: vi.fn(() => lookup) } as never;
}

const validPayload = {
  board: { name: "Q3" },
  columns: [
    { title: "Backlog", position: 1 },
    { title: "Done", position: 2 },
  ],
  cards: [{ columnRef: "Backlog", title: "Plan" }],
};

const buildReq = (body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest("http://localhost/api/changesets/board", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json", ...headers },
  });

describe("POST /api/changesets/board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAdmin.mockReturnValue(noopAdminClient());
  });

  it("returns 401 when unauthenticated", async () => {
    mockAuth.mockResolvedValue({ supabase: {} as never, user: null as never });
    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(401);
  });

  it("returns 400 on invalid payload", async () => {
    mockAuth.mockResolvedValue({
      supabase: { rpc: vi.fn() } as never,
      user: { id: "u1" } as never,
    });
    const res = await POST(buildReq({ board: { name: "" }, columns: [] }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBeDefined();
    expect(body.at).toBeDefined();
  });

  it("calls RPC and returns 201 on success", async () => {
    const rpcResult = {
      board: { id: "b1", name: "Q3", groupId: null },
      columns: [
        { id: 1, title: "Backlog", position: 1 },
        { id: 2, title: "Done", position: 2 },
      ],
      cards: [{ id: "c1", title: "Plan", columnId: 1, subtasks: [] }],
    };
    const rpcSpy = vi.fn().mockResolvedValue({ data: rpcResult, error: null });
    mockAuth.mockResolvedValue({
      supabase: { rpc: rpcSpy } as never,
      user: { id: "u1" } as never,
    });

    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(201);
    expect(rpcSpy).toHaveBeenCalledWith(
      "create_board_changeset",
      expect.objectContaining({ payload: expect.any(Object) }),
    );
    expect(await res.json()).toEqual(rpcResult);
  });

  it("returns 500 with error envelope when RPC errors", async () => {
    const rpcSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom" } });
    mockAuth.mockResolvedValue({
      supabase: { rpc: rpcSpy } as never,
      user: { id: "u1" } as never,
    });
    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to apply changeset");
    // dev-only detail — RPC message must not leak into the top-level error string
    expect(body.details).toBe("boom");
  });

  it("returns the stored response on idempotency replay", async () => {
    const stored = {
      board: { id: "b1", name: "Q3", groupId: null },
      columns: [],
      cards: [],
    };
    mockAdmin.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              gt: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: { status: 201, response: stored },
                  error: null,
                }),
              })),
            })),
          })),
        })),
        insert: vi.fn(),
        delete: vi.fn(() => ({
          lt: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    } as never);

    const rpcSpy = vi.fn();
    mockAuth.mockResolvedValue({
      supabase: { rpc: rpcSpy } as never,
      user: { id: "u1", tokenId: "t1" } as never,
    });

    const res = await POST(
      buildReq(validPayload, { "idempotency-key": "abc" }),
    );
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual(stored);
    expect(rpcSpy).not.toHaveBeenCalled();
  });

  it("returns 429 when token rate limit is exceeded", async () => {
    _resetRateLimitForTests();
    const rpcSpy = vi.fn().mockResolvedValue({ data: {}, error: null });
    mockAuth.mockResolvedValue({
      supabase: { rpc: rpcSpy, from: vi.fn() } as never,
      user: { id: "u1", tokenId: "t-rate" } as never,
    });

    for (let i = 0; i < 60; i++) {
      await POST(buildReq(validPayload));
    }
    const res = await POST(buildReq(validPayload));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeDefined();
  });
});
