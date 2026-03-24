import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/auth/confirm-email/route";
import { getSessionUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({ getSessionUser: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/mailer", () => ({
  sendNewUserPendingNotification: vi.fn().mockResolvedValue(undefined),
}));

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mockGetSessionUser = vi.mocked(getSessionUser);
const mockCreateAdminClient = vi.mocked(createAdminClient);

describe("POST /api/auth/confirm-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when there is no authenticated session", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: {} as never,
      user: null,
    });

    const res = await POST();
    expect(res.status).toBe(401);
  });

  it("returns 404 when the public.users profile is missing", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      } as never,
      user: { id: USER_ID } as never,
    });

    const res = await POST();
    expect(res.status).toBe(404);
  });

  it("returns active status and skips banning for active users", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi
                .fn()
                .mockResolvedValue({ data: { status: "active" }, error: null }),
            })),
          })),
        })),
      } as never,
      user: { id: USER_ID } as never,
    });

    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "active" });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });

  it("promotes unconfirmed user to pending and bans them", async () => {
    mockGetSessionUser.mockResolvedValue({
      supabase: {
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
      } as never,
      user: {
        id: USER_ID,
        email: "test@example.com",
        user_metadata: {},
      } as never,
    });

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
    mockGetSessionUser.mockResolvedValue({
      supabase: {
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
      } as never,
      user: { id: USER_ID } as never,
    });

    const res = await POST();
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ status: "pending" });
    expect(mockCreateAdminClient).not.toHaveBeenCalled();
  });
});
