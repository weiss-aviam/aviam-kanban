import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ── Supabase mock ─────────────────────────────────────────────────────────────

const mockGetSessionUser = vi.fn();

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

const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

function buildSupabaseMock() {
  return {
    from: vi.fn((table: string) => {
      if (table === "cards") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: mockSingle,
            })),
          })),
        };
      }
      if (table === "card_subtasks") {
        return {
          select: vi.fn(() => makeChainable({ data: [], error: null })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({ single: mockInsert })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                is: vi.fn(() => ({
                  single: mockUpdate,
                  // for DELETE (no single)
                  then: (resolve: (v: unknown) => unknown) =>
                    Promise.resolve({ error: null }).then(resolve),
                })),
              })),
            })),
          })),
        };
      }
      return {};
    }),
  };
}

vi.mock("@/lib/supabase/server", () => ({
  getSessionUser: mockGetSessionUser,
}));

// ── import routes after mocks ─────────────────────────────────────────────────

const { GET: getSubtasks, POST: createSubtask } =
  await import("@/app/api/cards/[id]/subtasks/route");
const { PATCH: patchSubtask, DELETE: deleteSubtask } =
  await import("@/app/api/cards/[id]/subtasks/[subtaskId]/route");

// ── helpers ───────────────────────────────────────────────────────────────────

const CARD_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const SUBTASK_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : null,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

// ── GET /api/cards/[id]/subtasks ──────────────────────────────────────────────

describe("GET /api/cards/[id]/subtasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock(),
      user: null,
    });
    const req = makeRequest(
      "GET",
      `http://localhost/api/cards/${CARD_ID}/subtasks`,
    );
    const res = await getSubtasks(req, {
      params: Promise.resolve({ id: CARD_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when card not found", async () => {
    const supabase = buildSupabaseMock();
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    mockGetSessionUser.mockResolvedValue({ supabase, user: { id: "u1" } });
    const req = makeRequest(
      "GET",
      `http://localhost/api/cards/${CARD_ID}/subtasks`,
    );
    const res = await getSubtasks(req, {
      params: Promise.resolve({ id: CARD_ID }),
    });
    expect(res.status).toBe(404);
  });

  it("returns empty subtasks list for valid card", async () => {
    const supabase = buildSupabaseMock();
    mockSingle.mockResolvedValue({ data: { id: CARD_ID }, error: null });
    // Override the card_subtasks select chain to return empty list
     
    (supabase.from as any) = vi.fn((table: string) => {
      if (table === "cards") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ single: mockSingle })),
          })),
        };
      }
      // card_subtasks
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn(() => ({
              order: vi.fn(() => ({
                order: vi.fn(() => Promise.resolve({ data: [], error: null })),
              })),
            })),
          })),
        })),
      };
    });
    mockGetSessionUser.mockResolvedValue({ supabase, user: { id: "u1" } });
    const req = makeRequest(
      "GET",
      `http://localhost/api/cards/${CARD_ID}/subtasks`,
    );
    const res = await getSubtasks(req, {
      params: Promise.resolve({ id: CARD_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subtasks).toEqual([]);
  });
});

// ── POST /api/cards/[id]/subtasks ─────────────────────────────────────────────

describe("POST /api/cards/[id]/subtasks", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock(),
      user: null,
    });
    const req = makeRequest(
      "POST",
      `http://localhost/api/cards/${CARD_ID}/subtasks`,
      {
        title: "Test subtask",
      },
    );
    const res = await createSubtask(req, {
      params: Promise.resolve({ id: CARD_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for missing title", async () => {
    const supabase = buildSupabaseMock();
    mockSingle.mockResolvedValue({ data: { id: CARD_ID }, error: null });
    mockGetSessionUser.mockResolvedValue({ supabase, user: { id: "u1" } });
    const req = makeRequest(
      "POST",
      `http://localhost/api/cards/${CARD_ID}/subtasks`,
      {
        title: "",
      },
    );
    const res = await createSubtask(req, {
      params: Promise.resolve({ id: CARD_ID }),
    });
    expect(res.status).toBe(400);
  });

  it("creates a subtask and returns 201", async () => {
    const createdSubtask = {
      id: SUBTASK_ID,
      card_id: CARD_ID,
      title: "Buy milk",
      completed_at: null,
      position: 0,
      created_at: new Date().toISOString(),
    };
    const supabase = buildSupabaseMock();
    mockSingle.mockResolvedValueOnce({ data: { id: CARD_ID }, error: null }); // card check
    mockInsert.mockResolvedValue({ data: createdSubtask, error: null });
     
    (supabase.from as any) = vi.fn((table: string) => {
      if (table === "cards") {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) })),
        };
      }
      return {
        insert: vi.fn(() => ({
          select: vi.fn(() => ({ single: mockInsert })),
        })),
      };
    });
    mockGetSessionUser.mockResolvedValue({ supabase, user: { id: "u1" } });
    const req = makeRequest(
      "POST",
      `http://localhost/api/cards/${CARD_ID}/subtasks`,
      {
        title: "Buy milk",
      },
    );
    const res = await createSubtask(req, {
      params: Promise.resolve({ id: CARD_ID }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.subtask.title).toBe("Buy milk");
    expect(body.subtask.completedAt).toBeNull();
  });
});

// ── PATCH /api/cards/[id]/subtasks/[subtaskId] ────────────────────────────────

describe("PATCH /api/cards/[id]/subtasks/[subtaskId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock(),
      user: null,
    });
    const req = makeRequest(
      "PATCH",
      `http://localhost/api/cards/${CARD_ID}/subtasks/${SUBTASK_ID}`,
      { completed: true },
    );
    const res = await patchSubtask(req, {
      params: Promise.resolve({ id: CARD_ID, subtaskId: SUBTASK_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock(),
      user: { id: "u1" },
    });
    const req = makeRequest(
      "PATCH",
      `http://localhost/api/cards/${CARD_ID}/subtasks/${SUBTASK_ID}`,
      { completed: "yes" }, // wrong type
    );
    const res = await patchSubtask(req, {
      params: Promise.resolve({ id: CARD_ID, subtaskId: SUBTASK_ID }),
    });
    expect(res.status).toBe(400);
  });
});

// ── DELETE /api/cards/[id]/subtasks/[subtaskId] ───────────────────────────────

describe("DELETE /api/cards/[id]/subtasks/[subtaskId]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when unauthenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: buildSupabaseMock(),
      user: null,
    });
    const req = makeRequest(
      "DELETE",
      `http://localhost/api/cards/${CARD_ID}/subtasks/${SUBTASK_ID}`,
    );
    const res = await deleteSubtask(req, {
      params: Promise.resolve({ id: CARD_ID, subtaskId: SUBTASK_ID }),
    });
    expect(res.status).toBe(401);
  });

  it("soft-deletes and returns success", async () => {
    const supabase = {
      from: vi.fn(() => ({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn(() => Promise.resolve({ error: null })),
            })),
          })),
        })),
      })),
    };
    mockGetSessionUser.mockResolvedValue({ supabase, user: { id: "u1" } });
    const req = makeRequest(
      "DELETE",
      `http://localhost/api/cards/${CARD_ID}/subtasks/${SUBTASK_ID}`,
    );
    const res = await deleteSubtask(req, {
      params: Promise.resolve({ id: CARD_ID, subtaskId: SUBTASK_ID }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});
