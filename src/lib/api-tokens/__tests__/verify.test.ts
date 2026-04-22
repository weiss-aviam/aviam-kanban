import { describe, it, expect, vi, beforeEach } from "vitest";
import { authenticateBearerToken } from "../verify";

vi.mock("../hash", () => ({
  verifyToken: vi.fn(
    async (plain: string, hash: string) => hash === `hashed:${plain}`,
  ),
}));

const FULL_TOKEN = "avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
const PREFIX = "avk_a1b2";

const adminClient = (rows: unknown[]) => ({
  from: vi.fn((table: string) => {
    if (table === "api_tokens") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            is: vi.fn().mockResolvedValue({ data: rows, error: null }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      };
    }
    if (table === "users") {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({
              data: rows[0]
                ? {
                    id: (rows[0] as { user_id: string }).user_id,
                    api_access_enabled: true,
                  }
                : null,
              error: null,
            }),
          })),
        })),
      };
    }
    throw new Error(`unexpected ${table}`);
  }),
});

describe("authenticateBearerToken", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns user when prefix + hash + master flag all match", async () => {
    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: adminClient([
        { id: "tok-1", user_id: "user-1", token_hash: `hashed:${FULL_TOKEN}` },
      ]) as never,
    });
    expect(result).toEqual({ tokenId: "tok-1", userId: "user-1" });
  });

  it("returns null when no row matches the prefix", async () => {
    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: adminClient([]) as never,
    });
    expect(result).toBeNull();
  });

  it("returns null when hash does not verify", async () => {
    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: adminClient([
        { id: "tok-1", user_id: "user-1", token_hash: "hashed:different" },
      ]) as never,
    });
    expect(result).toBeNull();
  });

  it("returns null when the master flag is off", async () => {
    const ac = adminClient([
      { id: "tok-1", user_id: "user-1", token_hash: `hashed:${FULL_TOKEN}` },
    ]);
    ac.from = vi.fn((table: string) => {
      if (table === "api_tokens") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              is: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "tok-1",
                    user_id: "user-1",
                    token_hash: `hashed:${FULL_TOKEN}`,
                  },
                ],
                error: null,
              }),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn().mockResolvedValue({ data: null, error: null }),
          })),
        };
      }
      if (table === "users") {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: { id: "user-1", api_access_enabled: false },
                error: null,
              }),
            })),
          })),
        };
      }
      throw new Error(`unexpected ${table}`);
    });

    const result = await authenticateBearerToken(FULL_TOKEN, {
      adminClient: ac as never,
    });
    expect(result).toBeNull();
  });

  it("returns null for malformed token (no avk_ prefix)", async () => {
    const result = await authenticateBearerToken("nope", {
      adminClient: adminClient([]) as never,
    });
    expect(result).toBeNull();
  });
});
