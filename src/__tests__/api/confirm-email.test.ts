import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/confirm-email/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mockCreateClient = vi.mocked(createClient);
const mockCreateAdminClient = vi.mocked(createAdminClient);

describe("POST /api/auth/confirm-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated session", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: new Error("not authenticated"),
        }),
      },
    } as never);

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 404 when the public.users profile is missing", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        })),
      })),
    } as never);

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("returns active status and skips banning for active users", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi
              .fn()
              .mockResolvedValue({ data: { status: "active" }, error: null }),
          })),
        })),
      })),
    } as never);

    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "active" });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("promotes unconfirmed user to pending and bans them", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { status: "unconfirmed" },
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    const updateUserById = vi.fn().mockResolvedValue({ error: null });
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn(() => ({ eq: updateEq }));

    mockCreateAdminClient.mockReturnValue({
      auth: { admin: { updateUserById } },
      from: vi.fn(() => ({ update })),
    } as never);

    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "pending" });

    // Should promote the public.users row to 'pending'
    expect(update).toHaveBeenCalledWith({ status: "pending" });
    expect(updateEq).toHaveBeenCalledWith("id", USER_ID);

    // Should ban at the auth layer and record status in app_metadata
    expect(updateUserById).toHaveBeenCalledWith(USER_ID, {
      ban_duration: expect.any(String),
      app_metadata: { status: "pending" },
    });
  });

  it("returns pending status immediately for already-pending users", async () => {
    mockCreateClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: USER_ID } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: { status: "pending" },
              error: null,
            }),
          })),
        })),
      })),
    } as never);

    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "pending" });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
