import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/users/route";

// Mock Supabase
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
    },
  })),
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

  const mockBoardId = "board-123";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/admin/users", () => {
    it("should return unauthorized when user is not authenticated", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockSupabase = createClient as unknown as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("Unauthorized"),
          }),
        },
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
      const { createClient } = await import("@/lib/supabase/server");
      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      });

      const request = new NextRequest("http://localhost:3000/api/admin/users");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Board ID is required");
    });

    it("should return forbidden when user is not admin", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { requireAdminAccess } = await import("@/lib/supabase/admin");

      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
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

    it("should return paginated users when request is valid", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { requireAdminAccess, createAdminClient } = await import(
        "@/lib/supabase/admin"
      );

      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: mockUser.id,
        boardId: mockBoardId,
        role: "admin",
        permissions: { canInviteUsers: true },
      });

      const mockUsers = [
        {
          id: "user-1",
          email: "user1@example.com",
          name: "User 1",
          role: "member",
          joined_at: "2023-01-01T00:00:00Z",
        },
        {
          id: "user-2",
          email: "user2@example.com",
          name: "User 2",
          role: "viewer",
          joined_at: "2023-01-02T00:00:00Z",
        },
      ];

      const mockAdminClient = createAdminClient as ReturnType<typeof vi.fn>;
      mockAdminClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => ({
                  data: mockUsers,
                  error: null,
                  count: 2,
                })),
              })),
            })),
          })),
        })),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/users?boardId=${mockBoardId}&page=1&limit=10`,
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(2);
      expect(data.pagination.total).toBe(2);
      expect(data.pagination.page).toBe(1);
    });

    it("should handle search and filtering", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { requireAdminAccess, createAdminClient } = await import(
        "@/lib/supabase/admin"
      );

      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: mockUser.id,
        boardId: mockBoardId,
        role: "admin",
        permissions: { canInviteUsers: true },
      });

      const mockAdminClient = createAdminClient as ReturnType<typeof vi.fn>;
      mockAdminClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              ilike: vi.fn(() => ({
                order: vi.fn(() => ({
                  range: vi.fn(() => ({
                    data: [],
                    error: null,
                    count: 0,
                  })),
                })),
              })),
            })),
          })),
        })),
      });

      const request = new NextRequest(
        `http://localhost:3000/api/admin/users?boardId=${mockBoardId}&search=john&role=member`,
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.users).toHaveLength(0);
    });
  });

  describe("POST /api/admin/users", () => {
    it("should return unauthorized when user is not authenticated", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: null },
            error: new Error("Unauthorized"),
          }),
        },
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
      const { createClient } = await import("@/lib/supabase/server");
      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
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
      expect(data.error).toBe("Validation failed");
      expect(data.details).toBeDefined();
    });

    it("should successfully invite a user", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { requireAdminAccess, createAdminClient, logAdminAction } =
        await import("@/lib/supabase/admin");

      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: mockUser.id,
        boardId: mockBoardId,
        role: "admin",
        permissions: { canInviteUsers: true },
      });

      const mockAdminClient = createAdminClient as ReturnType<typeof vi.fn>;
      mockAdminClient.mockReturnValue({
        auth: {
          admin: {
            inviteUserByEmail: vi.fn().mockResolvedValue({
              data: {
                user: { id: "new-user-id", email: "newuser@example.com" },
              },
              error: null,
            }),
          },
        },
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({
            data: [{ id: "invitation-id" }],
            error: null,
          }),
        })),
      });

      (logAdminAction as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

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

      expect(response.status).toBe(201);
      expect(data.message).toBe("User invitation sent successfully");
      expect(data.user.email).toBe("newuser@example.com");
      expect(logAdminAction).toHaveBeenCalledWith({
        adminUserId: mockUser.id,
        targetUserId: "new-user-id",
        boardId: mockBoardId,
        action: "invite_user",
        details: expect.objectContaining({
          email: "newuser@example.com",
          role: "member",
        }),
        ipAddress: "127.0.0.1",
        userAgent: "test-agent",
      });
    });

    it("should handle Supabase invitation errors", async () => {
      const { createClient } = await import("@/lib/supabase/server");
      const { requireAdminAccess, createAdminClient } = await import(
        "@/lib/supabase/admin"
      );

      const mockSupabase = createClient as ReturnType<typeof vi.fn>;
      mockSupabase.mockReturnValue({
        auth: {
          getUser: vi.fn().mockResolvedValue({
            data: { user: mockUser },
            error: null,
          }),
        },
      });

      (requireAdminAccess as ReturnType<typeof vi.fn>).mockResolvedValue({
        userId: mockUser.id,
        boardId: mockBoardId,
        role: "admin",
        permissions: { canInviteUsers: true },
      });

      const mockAdminClient = createAdminClient as ReturnType<typeof vi.fn>;
      mockAdminClient.mockReturnValue({
        auth: {
          admin: {
            inviteUserByEmail: vi.fn().mockResolvedValue({
              data: null,
              error: { message: "User already exists" },
            }),
          },
        },
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

      expect(response.status).toBe(400);
      expect(data.error).toBe("User already exists");
    });
  });
});
