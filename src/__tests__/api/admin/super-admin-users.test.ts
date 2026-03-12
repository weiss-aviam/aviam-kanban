import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/admin/super-admin/users/route";
import { PATCH } from "@/app/api/admin/super-admin/users/[id]/route";
import { createClient } from "@/lib/supabase/server";
import {
  createAdminClient,
  getClientIP,
  getUserAgent,
  logAdminAction,
} from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
  logAdminAction: vi.fn(),
  getClientIP: vi.fn(() => "127.0.0.1"),
  getUserAgent: vi.fn(() => "test-agent"),
}));

const SUPER_ADMIN_USER = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "super-admin@example.com",
  app_metadata: { super_admin: true },
  user_metadata: { name: "Super Admin" },
};

const TARGET_USER_ID = "22222222-2222-4222-8222-222222222222";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockLogAdminAction = vi.mocked(logAdminAction);
const mockGetClientIP = vi.mocked(getClientIP);
const mockGetUserAgent = vi.mocked(getUserAgent);

describe("Super Admin user management routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: SUPER_ADMIN_USER },
          error: null,
        }),
      },
    } as never);

    mockLogAdminAction.mockResolvedValue(undefined);
    mockGetClientIP.mockReturnValue("127.0.0.1");
    mockGetUserAgent.mockReturnValue("test-agent");
  });

  it("rejects non-Super-Admin access for the global user list", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              ...SUPER_ADMIN_USER,
              app_metadata: { role: "member" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/super-admin/users"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Super Admin access required",
    });
  });

  it("rejects access when only user_metadata claims Super Admin", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              ...SUPER_ADMIN_USER,
              app_metadata: {},
              user_metadata: { role: "super_admin", name: "Editable Claim" },
            },
          },
          error: null,
        }),
      },
    } as never);

    const response = await GET(
      new NextRequest("http://localhost:3000/api/admin/super-admin/users"),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      error: "Super Admin access required",
    });
  });

  it("creates a user through the Super Admin route", async () => {
    const createUser = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: TARGET_USER_ID,
          email: "new.user@example.com",
          created_at: "2026-03-07T12:00:00.000Z",
        },
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const upsert = vi.fn().mockResolvedValue({ error: null });

    mockCreateAdminClient.mockReturnValue({
      auth: {
        admin: {
          createUser,
          updateUserById,
        },
      },
      from: vi.fn((table: string) => {
        if (table === "users") {
          return { upsert };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await POST(
      new NextRequest("http://localhost:3000/api/admin/super-admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "new.user@example.com",
          name: "New User",
          password: "StrongPass1!",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(createUser).toHaveBeenCalledWith({
      email: "new.user@example.com",
      password: "StrongPass1!",
      email_confirm: true,
      app_metadata: { admin_created: true },
      user_metadata: { name: "New User" },
    });
    expect(updateUserById).toHaveBeenCalledWith(TARGET_USER_ID, {
      ban_duration: "none",
    });
    expect(upsert).toHaveBeenCalledWith({
      id: TARGET_USER_ID,
      email: "new.user@example.com",
      name: "New User",
      status: "active",
    });
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: SUPER_ADMIN_USER.id,
        targetUserId: TARGET_USER_ID,
        action: "create_global_user",
      }),
    );
  });

  it("updates a user name while preserving existing auth metadata", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: TARGET_USER_ID,
        email: "existing.user@example.com",
        name: "Existing User",
        created_at: "2026-03-01T12:00:00.000Z",
      },
      error: null,
    });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));
    const getUserById = vi.fn().mockResolvedValue({
      data: {
        user: {
          id: TARGET_USER_ID,
          user_metadata: { timezone: "UTC", super_admin: false },
        },
      },
      error: null,
    });
    const updateUserById = vi.fn().mockResolvedValue({ error: null });

    mockCreateAdminClient.mockReturnValue({
      auth: {
        admin: {
          getUserById,
          updateUserById,
        },
      },
      from: vi.fn((table: string) => {
        if (table === "users") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ single })),
            })),
            update,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    } as never);

    const response = await PATCH(
      new NextRequest(
        `http://localhost:3000/api/admin/super-admin/users/${TARGET_USER_ID}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: "Updated User" }),
        },
      ),
      { params: Promise.resolve({ id: TARGET_USER_ID }) },
    );

    expect(response.status).toBe(200);
    expect(updateUserById).toHaveBeenCalledWith(TARGET_USER_ID, {
      user_metadata: {
        timezone: "UTC",
        super_admin: false,
        name: "Updated User",
      },
    });
    expect(update).toHaveBeenCalledWith({ name: "Updated User" });
    expect(updateEq).toHaveBeenCalledWith("id", TARGET_USER_ID);
    expect(mockLogAdminAction).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: SUPER_ADMIN_USER.id,
        targetUserId: TARGET_USER_ID,
        action: "update_global_user",
      }),
    );
  });
});
