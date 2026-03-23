import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ─── Supabase server mock ────────────────────────────────────────────────────

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockUpdateEq = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
    from: vi.fn(() => ({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    })),
  })),
}));

// Chain helpers — reset before each test
function setupSelectChain(resolveValue: unknown) {
  mockSingle.mockResolvedValue(resolveValue);
  mockEq.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ eq: mockEq });
}

function setupInsertChain(resolveValue: unknown) {
  mockInsert.mockResolvedValue(resolveValue);
}

function setupUpdateChain(resolveValue: unknown) {
  mockUpdateEq.mockResolvedValue(resolveValue);
  mockUpdate.mockReturnValue({ eq: mockUpdateEq });
}

// ─── import after mocks ──────────────────────────────────────────────────────

const { POST } = await import("@/app/api/auth/sync-profile/route");

const makeRequest = () =>
  new NextRequest("http://localhost/api/auth/sync-profile", { method: "POST" });

// ─── tests ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST /api/auth/sync-profile", () => {
  describe("authentication", () => {
    it("returns 401 when no session exists", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: null },
        error: new Error("no session"),
      });

      const res = await POST(makeRequest());
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error).toBe("Unauthorized");
    });
  });

  describe("create mode — user does not exist yet", () => {
    const user = {
      id: "user-123",
      email: "ada@example.com",
      user_metadata: { name: "Ada Lovelace" },
    };

    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      // Profile check → not found (PGRST116)
      setupSelectChain({ data: null, error: { code: "PGRST116" } });
    });

    it("inserts the new profile and returns 200", async () => {
      setupInsertChain({ error: null });

      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: user.id,
          email: user.email,
          name: "Ada Lovelace",
        }),
      );
    });

    it("derives the name from user_metadata.name", async () => {
      setupInsertChain({ error: null });
      await POST(makeRequest());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Ada Lovelace" }),
      );
    });

    it("falls back to the email prefix when metadata has no name", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { ...user, user_metadata: {} } },
        error: null,
      });
      setupInsertChain({ error: null });

      await POST(makeRequest());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: "ada" }),
      );
    });

    it("falls back to 'User' when neither metadata nor email is available", async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: "u", email: null, user_metadata: {} } },
        error: null,
      });
      setupInsertChain({ error: null });

      await POST(makeRequest());
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ name: "User" }),
      );
    });

    it("returns 500 when the insert fails", async () => {
      setupInsertChain({ error: new Error("insert failed") });

      const res = await POST(makeRequest());
      expect(res.status).toBe(500);
    });
  });

  describe("update mode — user already exists", () => {
    const user = {
      id: "user-123",
      email: "ada@example.com",
      user_metadata: { name: "Ada" },
    };

    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      // Profile check → found
      setupSelectChain({ data: { id: user.id }, error: null });
    });

    it("updates only last_seen_at and returns 200", async () => {
      setupUpdateChain({ error: null });

      const res = await POST(makeRequest());
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ last_seen_at: expect.any(String) }),
      );
      // Must NOT overwrite name or email
      const updateArg = mockUpdate.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(updateArg).not.toHaveProperty("name");
      expect(updateArg).not.toHaveProperty("email");
    });

    it("returns 500 when the update fails", async () => {
      setupUpdateChain({ error: new Error("update failed") });

      const res = await POST(makeRequest());
      expect(res.status).toBe(500);
    });
  });

  describe("error handling", () => {
    it("returns 500 on a non-PGRST116 profile check error", async () => {
      const user = { id: "u", email: "a@b.com", user_metadata: {} };
      mockGetUser.mockResolvedValue({ data: { user }, error: null });
      setupSelectChain({
        data: null,
        error: { code: "PGRST500", message: "db error" },
      });

      const res = await POST(makeRequest());
      expect(res.status).toBe(500);
    });
  });
});
