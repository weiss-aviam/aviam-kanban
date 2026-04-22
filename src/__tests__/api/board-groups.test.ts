import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
  GET as listGroups,
  POST as createGroup,
} from "@/app/api/board-groups/route";
import {
  PUT as updateGroup,
  DELETE as deleteGroup,
} from "@/app/api/board-groups/[id]/route";
import { PUT as updateBoard } from "@/app/api/boards/[id]/route";
import { getAuthorizedUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getAuthorizedUser: vi.fn(),
  getSessionUser: vi.fn(),
}));

const mockGetSessionUser = vi.mocked(getAuthorizedUser);

const USER = { id: "11111111-1111-4111-8111-111111111111" };
const OTHER_USER = { id: "22222222-2222-4222-8222-222222222222" };
const GROUP_ID = "33333333-3333-4333-8333-333333333333";
const BOARD_ID = "44444444-4444-4444-8444-444444444444";

type FromImpl = (table: string) => unknown;
const supabaseMock = (impl: FromImpl) => ({ from: vi.fn(impl) });

const buildRequest = (path: string, method: string, body?: unknown) =>
  body !== undefined
    ? new NextRequest(`http://localhost${path}`, {
        method,
        body: JSON.stringify(body),
        headers: { "Content-Type": "application/json" },
      })
    : new NextRequest(`http://localhost${path}`, { method });

describe("board-groups API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("visibility (GET /api/board-groups)", () => {
    it("returns 401 when no session", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: supabaseMock(() => {
          throw new Error("should not query when unauthenticated");
        }) as never,
        user: null as never,
      });

      const res = await listGroups();
      expect(res.status).toBe(401);
    });

    it("returns groups visible to the user (RLS-filtered)", async () => {
      // Simulate RLS: returns only the rows the user is allowed to see.
      const visibleRows = [
        {
          id: GROUP_ID,
          name: "Marketing",
          color: "#3b82f6",
          created_by: USER.id,
          position: 0,
          created_at: "2026-01-01T00:00:00Z",
        },
      ];
      const supabase = supabaseMock((table) => {
        if (table !== "board_groups") throw new Error(`unexpected ${table}`);
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              order: vi
                .fn()
                .mockResolvedValue({ data: visibleRows, error: null }),
            })),
          })),
        };
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: USER as never,
      });

      const res = await listGroups();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.groups).toEqual([
        {
          id: GROUP_ID,
          name: "Marketing",
          color: "#3b82f6",
          createdBy: USER.id,
          position: 0,
          createdAt: "2026-01-01T00:00:00Z",
        },
      ]);
    });
  });

  describe("create (POST /api/board-groups)", () => {
    it("rejects unauthenticated", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: supabaseMock(() => {
          throw new Error("nope");
        }) as never,
        user: null as never,
      });
      const res = await createGroup(
        buildRequest("/api/board-groups", "POST", { name: "X" }),
      );
      expect(res.status).toBe(401);
    });

    it("rejects empty name", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: supabaseMock(() => {
          throw new Error("should not query");
        }) as never,
        user: USER as never,
      });
      const res = await createGroup(
        buildRequest("/api/board-groups", "POST", { name: "  " }),
      );
      expect(res.status).toBe(400);
    });

    it("rejects malformed color", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: supabaseMock(() => {
          throw new Error("should not query");
        }) as never,
        user: USER as never,
      });
      const res = await createGroup(
        buildRequest("/api/board-groups", "POST", {
          name: "OK",
          color: "blue",
        }),
      );
      expect(res.status).toBe(400);
    });

    it("creates with created_by = caller", async () => {
      const insertSpy = vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: {
              id: GROUP_ID,
              name: "Marketing",
              color: "#3b82f6",
              created_by: USER.id,
              position: 0,
              created_at: "2026-01-01T00:00:00Z",
            },
            error: null,
          }),
        })),
      }));
      const supabase = supabaseMock((table) => {
        if (table !== "board_groups") throw new Error(`unexpected ${table}`);
        return { insert: insertSpy };
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: USER as never,
      });

      const res = await createGroup(
        buildRequest("/api/board-groups", "POST", {
          name: "Marketing",
          color: "#3b82f6",
        }),
      );
      expect(res.status).toBe(200);
      expect(insertSpy).toHaveBeenCalledWith({
        name: "Marketing",
        color: "#3b82f6",
        created_by: USER.id,
      });
    });
  });

  describe("update / delete (creator-only via RLS)", () => {
    it("PUT returns 404 when RLS drops the row (non-creator)", async () => {
      const supabase = supabaseMock((table) => {
        if (table !== "board_groups") throw new Error(`unexpected ${table}`);
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                // RLS dropped → maybeSingle returns null
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        };
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: OTHER_USER as never,
      });

      const res = await updateGroup(
        buildRequest(`/api/board-groups/${GROUP_ID}`, "PUT", {
          name: "Hacked",
        }),
        { params: Promise.resolve({ id: GROUP_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("DELETE returns 404 when RLS drops the row", async () => {
      const supabase = supabaseMock((table) => {
        if (table !== "board_groups") throw new Error(`unexpected ${table}`);
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: null }),
              })),
            })),
          })),
        };
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: OTHER_USER as never,
      });

      const res = await deleteGroup(
        buildRequest(`/api/board-groups/${GROUP_ID}`, "DELETE"),
        { params: Promise.resolve({ id: GROUP_ID }) },
      );
      expect(res.status).toBe(404);
    });

    it("DELETE returns 200 when RLS allows (creator)", async () => {
      const supabase = supabaseMock((table) => {
        if (table !== "board_groups") throw new Error(`unexpected ${table}`);
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                maybeSingle: vi
                  .fn()
                  .mockResolvedValue({ data: { id: GROUP_ID }, error: null }),
              })),
            })),
          })),
        };
      });
      mockGetSessionUser.mockResolvedValue({
        supabase: supabase as never,
        user: USER as never,
      });

      const res = await deleteGroup(
        buildRequest(`/api/board-groups/${GROUP_ID}`, "DELETE"),
        { params: Promise.resolve({ id: GROUP_ID }) },
      );
      expect(res.status).toBe(200);
    });

    it("rejects invalid UUID", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: supabaseMock(() => {
          throw new Error("should not query");
        }) as never,
        user: USER as never,
      });
      const res = await deleteGroup(
        buildRequest("/api/board-groups/not-a-uuid", "DELETE"),
        { params: Promise.resolve({ id: "not-a-uuid" }) },
      );
      expect(res.status).toBe(400);
    });
  });
});

describe("PUT /api/boards/[id] groupId enforcement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Build a supabase mock that mirrors the call chain inside PUT /api/boards/[id]:
   *  - board_members → role lookup
   *  - board_groups  → visibility check (RLS-filtered)
   *  - boards        → update
   */
  type Opts = {
    role?: "owner" | "admin" | "member" | "viewer";
    groupVisible?: boolean;
  };
  const makeBoardsSupabase = (opts: Opts) => {
    const role = opts.role ?? "owner";
    const groupRow = opts.groupVisible
      ? { data: { id: GROUP_ID }, error: null }
      : { data: null, error: null };

    return supabaseMock((table) => {
      if (table === "board_members") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi
                  .fn()
                  .mockResolvedValue({ data: { role }, error: null }),
              })),
            })),
          })),
        };
      }
      if (table === "board_groups") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue(groupRow),
            })),
          })),
        };
      }
      if (table === "boards") {
        return {
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: BOARD_ID,
                    name: "B",
                    description: null,
                    is_archived: false,
                    created_at: "2026-01-01T00:00:00Z",
                    updated_at: "2026-01-01T00:00:00Z",
                    owner_id: USER.id,
                    group_id: GROUP_ID,
                    group_position: 0,
                  },
                  error: null,
                }),
              })),
            })),
          })),
        };
      }
      throw new Error(`unexpected table ${table}`);
    });
  };

  it("returns 403 when caller is viewer/member trying to set groupId", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeBoardsSupabase({ role: "viewer" }) as never,
      user: USER as never,
    });

    const res = await updateBoard(
      buildRequest(`/api/boards/${BOARD_ID}`, "PUT", { groupId: GROUP_ID }),
      { params: Promise.resolve({ id: BOARD_ID }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns 404 when group is not visible to caller (RLS)", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeBoardsSupabase({
        role: "owner",
        groupVisible: false,
      }) as never,
      user: USER as never,
    });

    const res = await updateBoard(
      buildRequest(`/api/boards/${BOARD_ID}`, "PUT", { groupId: GROUP_ID }),
      { params: Promise.resolve({ id: BOARD_ID }) },
    );
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/group/i);
  });

  it("allows admin to assign a visible group", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeBoardsSupabase({
        role: "admin",
        groupVisible: true,
      }) as never,
      user: USER as never,
    });

    const res = await updateBoard(
      buildRequest(`/api/boards/${BOARD_ID}`, "PUT", { groupId: GROUP_ID }),
      { params: Promise.resolve({ id: BOARD_ID }) },
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.board.groupId).toBe(GROUP_ID);
  });

  it("allows owner to detach (groupId = null) without visibility check", async () => {
    // groupVisible doesn't matter when groupId is null
    mockGetSessionUser.mockResolvedValue({
      supabase: makeBoardsSupabase({
        role: "owner",
        groupVisible: false,
      }) as never,
      user: USER as never,
    });

    const res = await updateBoard(
      buildRequest(`/api/boards/${BOARD_ID}`, "PUT", { groupId: null }),
      { params: Promise.resolve({ id: BOARD_ID }) },
    );
    expect(res.status).toBe(200);
  });

  it("rejects malformed groupId", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeBoardsSupabase({ role: "owner" }) as never,
      user: USER as never,
    });

    const res = await updateBoard(
      buildRequest(`/api/boards/${BOARD_ID}`, "PUT", {
        groupId: "not-a-uuid",
      }),
      { params: Promise.resolve({ id: BOARD_ID }) },
    );
    expect(res.status).toBe(400);
  });
});
