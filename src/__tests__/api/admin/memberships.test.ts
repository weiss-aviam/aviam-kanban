import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { DELETE } from "@/app/api/admin/memberships/route";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  getClientIP,
  getUserAgent,
  logAdminAction,
  requireAdminAccess,
} from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  requireAdminAccess: vi.fn(),
  logAdminAction: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
  getUserAgent: vi.fn(() => "test-agent"),
}));

const BOARD_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_USER_ID = "22222222-2222-4222-8222-222222222222";
const TARGET_USER_ID = "33333333-3333-4333-8333-333333333333";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockRequireAdminAccess = vi.mocked(requireAdminAccess);
const mockLogAdminAction = vi.mocked(logAdminAction);
const mockGetClientIP = vi.mocked(getClientIP);
const mockGetUserAgent = vi.mocked(getUserAgent);

function buildDeleteRequest(userId: string, boardId = BOARD_ID) {
  return new NextRequest(
    `http://localhost:3000/api/admin/memberships?boardId=${boardId}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    },
  );
}

function createBoardMembersTable(options?: {
  membershipData?: {
    role: string;
    users: { id: string; email: string; name: string };
  } | null;
  membershipError?: unknown;
  removeError?: unknown;
}) {
  const membershipData = options?.membershipData ?? {
    role: "member",
    users: {
      id: TARGET_USER_ID,
      email: "member@example.com",
      name: "Member User",
    },
  };

  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: membershipData,
            error: options?.membershipError ?? null,
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: options?.removeError ?? null }),
      })),
    })),
  };
}

describe("DELETE /api/admin/memberships", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: ADMIN_USER_ID,
              email: "admin@example.com",
              name: "Admin User",
            },
          },
          error: null,
        }),
      },
    } as never);

    mockRequireAdminAccess.mockResolvedValue({
      userId: ADMIN_USER_ID,
      boardId: BOARD_ID,
      role: "admin",
    } as never);
    mockLogAdminAction.mockResolvedValue(undefined);
    mockGetClientIP.mockReturnValue("127.0.0.1");
    mockGetUserAgent.mockReturnValue("test-agent");
  });

  it("returns a validation error for invalid input", async () => {
    const response = await DELETE(
      new NextRequest(
        `http://localhost:3000/api/admin/memberships?boardId=${BOARD_ID}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: "invalid-user-id" }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Invalid input",
    });
  });

  it("blocks self-removal", async () => {
    const boardMembersTable = createBoardMembersTable({
      membershipData: {
        role: "member",
        users: {
          id: ADMIN_USER_ID,
          email: "admin@example.com",
          name: "Admin User",
        },
      },
    });
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "board_members") return boardMembersTable;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await DELETE(buildDeleteRequest(ADMIN_USER_ID));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "You cannot remove yourself from the board",
    });
  });

  it("removes a member and writes an audit log", async () => {
    const boardMembersTable = createBoardMembersTable();
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "board_members") return boardMembersTable;
        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await DELETE(buildDeleteRequest(TARGET_USER_ID));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({ message: "User removed from board successfully" });
    expect(mockLogAdminAction).toHaveBeenCalledWith({
      adminUserId: ADMIN_USER_ID,
      targetUserId: TARGET_USER_ID,
      boardId: BOARD_ID,
      action: "remove_user",
      details: {
        removedUser: {
          email: "member@example.com",
          name: "Member User",
          role: "member",
        },
      },
      ipAddress: "127.0.0.1",
      userAgent: "test-agent",
    });
  });
});
