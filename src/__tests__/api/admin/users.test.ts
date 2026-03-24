import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/users/route";

// Mock Supabase
const { mockGetSessionUser } = vi.hoisted(() => ({
  mockGetSessionUser: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getSessionUser: mockGetSessionUser,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(),
    })),
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(),
      },
    },
  })),
  requireAdminAccess: vi.fn(),
  logAdminAction: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
  getUserAgent: vi.fn(() => "test-agent"),
  generateInvitationToken: vi.fn(() => "test-token"),
  getInvitationExpiry: vi.fn(() => new Date()),
}));

describe("/api/admin/users", () => {
  const mockUser = {
    id: "user-123",
    email: "admin@example.com",
    name: "Admin User",
  };

  const mockBoardId = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/users", () => {
    it("should return unauthorized when user is not authenticated", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: null,
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/users?boardId=${mockBoardId}`,
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return bad request when boardId is missing", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: mockUser as never,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/users");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Board ID is required");
    });

    it("should return forbidden when user is not admin", async () => {
      const { requireAdminAccess } = await import("@/lib/supabase/admin");

      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: mockUser as never,
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Admin access required"),
      );

      const request = new NextRequest(
        `http://localhost:3000/api/admin/users?boardId=${mockBoardId}`,
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });
  });

  describe("POST /api/admin/users", () => {
    it("should return unauthorized when user is not authenticated", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: null,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
          boardId: mockBoardId,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe("Unauthorized");
    });

    it("should return validation error for invalid input", async () => {
      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: mockUser as never,
      });

      const request = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "invalid-email",
          role: "invalid-role",
          boardId: "invalid-uuid",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid input");
      expect(data.details).toBeDefined();
    });

    it("should return forbidden when user lacks admin access", async () => {
      const { requireAdminAccess } = await import("@/lib/supabase/admin");

      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: mockUser as never,
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("Admin access required"),
      );

      const request = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "newuser@example.com",
          role: "member",
          boardId: mockBoardId,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe("Admin access required");
    });

    it("should return gone for legacy invite-by-email requests", async () => {
      const { requireAdminAccess } = await import("@/lib/supabase/admin");

      mockGetSessionUser.mockResolvedValue({
        supabase: {} as never,
        user: mockUser as never,
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: mockUser.id,
        boardId: mockBoardId,
        role: "admin",
        permissions: { canInviteUsers: true },
      });

      const request = new NextRequest("http://localhost:3000/api/admin/users", {
        method: "POST",
        body: JSON.stringify({
          email: "existing@example.com",
          role: "member",
          boardId: mockBoardId,
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe(
        "Inviting users by email is no longer supported. Add existing registered users to the board instead.",
      );
    });
  });
});
