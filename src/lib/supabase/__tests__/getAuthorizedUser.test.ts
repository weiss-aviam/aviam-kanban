import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next/headers", () => ({
  headers: vi.fn(),
  cookies: vi.fn(async () => ({
    getAll: () => [],
    set: () => {},
  })),
}));
vi.mock("@/lib/api-tokens/verify", () => ({
  authenticateBearerToken: vi.fn(),
}));

import { headers } from "next/headers";
import { authenticateBearerToken } from "@/lib/api-tokens/verify";
import { getAuthorizedUser } from "../server";

const mockHeaders = vi.mocked(headers);
const mockAuth = vi.mocked(authenticateBearerToken);

describe("getAuthorizedUser", () => {
  beforeEach(() => vi.clearAllMocks());

  it("falls back to session when no Authorization header", async () => {
    mockHeaders.mockReturnValue({ get: () => null } as never);
    const result = await getAuthorizedUser();
    expect(mockAuth).not.toHaveBeenCalled();
    expect(result).toHaveProperty("user");
  });

  it("uses bearer token when Authorization: Bearer avk_… is present", async () => {
    mockHeaders.mockReturnValue({
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? "Bearer avk_xxx" : null,
    } as never);
    mockAuth.mockResolvedValue({ tokenId: "t1", userId: "u1" });

    const result = await getAuthorizedUser();
    expect(mockAuth).toHaveBeenCalledWith("avk_xxx", expect.any(Object));
    expect(result.user).toEqual(expect.objectContaining({ id: "u1" }));
  });

  it("returns { user: null } when bearer auth fails", async () => {
    mockHeaders.mockReturnValue({
      get: (k: string) =>
        k.toLowerCase() === "authorization" ? "Bearer avk_bad" : null,
    } as never);
    mockAuth.mockResolvedValue(null);

    const result = await getAuthorizedUser();
    expect(result.user).toBeNull();
  });
});
