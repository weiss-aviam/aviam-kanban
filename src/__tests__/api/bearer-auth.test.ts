import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET as listBoards } from "@/app/api/boards/route";
import { getAuthorizedUser } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  getAuthorizedUser: vi.fn(),
  getSessionUser: vi.fn(),
}));

const mockAuth = vi.mocked(getAuthorizedUser);

describe("Bearer auth on /api/boards", () => {
  it("uses bearer-token user identity when Authorization header is present", async () => {
    mockAuth.mockResolvedValue({
      supabase: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [], error: null }),
          })),
        })),
      } as never,
      user: { id: "user-from-token" } as never,
    });

    const req = new NextRequest("http://localhost/api/boards", {
      headers: { authorization: "Bearer avk_xxx" },
    });
    const res = await listBoards(req as never);
    expect(res.status).toBe(200);
    expect(mockAuth).toHaveBeenCalled();
  });
});
