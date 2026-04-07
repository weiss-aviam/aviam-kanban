import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/calendar/cards/route";
import { getSessionUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getSessionUser: vi.fn(),
}));

const mockGetSessionUser = vi.mocked(getSessionUser);

const AUTH_USER = { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" };

function buildRequest(url: string) {
  return new NextRequest(url);
}

function makeSupabaseMock(cards: unknown[], error: unknown = null) {
  const chain = {
    not: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: cards, error }),
  };
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => chain),
    })),
  };
}

describe("GET /api/calendar/cards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabaseMock([]) as never,
      user: null,
    });

    const res = await GET(
      buildRequest(
        "http://localhost/api/calendar/cards?start=2024-01-01T00:00:00Z&end=2024-01-31T23:59:59Z",
      ),
    );
    expect(res.status).toBe(401);
  });

  it("returns 400 when start/end params are missing", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabaseMock([]) as never,
      user: AUTH_USER as never,
    });

    const res = await GET(buildRequest("http://localhost/api/calendar/cards"));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/start and end/i);
  });

  it("returns 400 when date params are invalid", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabaseMock([]) as never,
      user: AUTH_USER as never,
    });

    const res = await GET(
      buildRequest(
        "http://localhost/api/calendar/cards?start=not-a-date&end=also-not-a-date",
      ),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/valid ISO/i);
  });

  it("maps raw DB rows to CalendarCard shape", async () => {
    const rawCards = [
      {
        id: "card-1",
        title: "Fix bug",
        due_date: "2024-04-10T10:00:00Z",
        priority: "high",
        board_id: "board-1",
        column_id: 42,
        completed_at: null,
        boards: { id: "board-1", name: "Sprint Board", is_archived: false },
        columns: { id: 42, title: "In Progress" },
      },
    ];

    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabaseMock(rawCards) as never,
      user: AUTH_USER as never,
    });

    const res = await GET(
      buildRequest(
        "http://localhost/api/calendar/cards?start=2024-04-01T00:00:00Z&end=2024-04-30T23:59:59Z",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0]).toMatchObject({
      id: "card-1",
      title: "Fix bug",
      dueDate: "2024-04-10T10:00:00Z",
      priority: "high",
      boardId: "board-1",
      boardName: "Sprint Board",
      columnId: 42,
      columnTitle: "In Progress",
      completedAt: null,
    });
  });

  it("returns an empty array when no cards have due dates in range", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabaseMock([]) as never,
      user: AUTH_USER as never,
    });

    const res = await GET(
      buildRequest(
        "http://localhost/api/calendar/cards?start=2024-04-01T00:00:00Z&end=2024-04-30T23:59:59Z",
      ),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cards).toEqual([]);
  });

  it("returns 500 when supabase returns an error", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: makeSupabaseMock([], { message: "DB error" }) as never,
      user: AUTH_USER as never,
    });

    const res = await GET(
      buildRequest(
        "http://localhost/api/calendar/cards?start=2024-04-01T00:00:00Z&end=2024-04-30T23:59:59Z",
      ),
    );
    expect(res.status).toBe(500);
  });
});
