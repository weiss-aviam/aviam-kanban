import { describe, it, expect, vi } from "vitest";
import { mintToken } from "../mint";

vi.mock("../hash", () => ({
  hashToken: vi.fn(async (p: string) => `hashed:${p}`),
}));

describe("mintToken", () => {
  it("inserts a hashed token, returns plaintext + row metadata", async () => {
    const insertSpy = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: {
            id: "11111111-1111-4111-8111-111111111111",
            user_id: "user-1",
            name: "Laptop",
            prefix: "avk_a1b2",
            created_at: "2026-04-21T00:00:00Z",
          },
          error: null,
        }),
      })),
    }));
    const supabase = { from: vi.fn(() => ({ insert: insertSpy })) };

    const result = await mintToken({
      userId: "user-1",
      name: "Laptop",
      supabase: supabase as never,
    });

    expect(result.token).toMatch(/^avk_[A-Za-z0-9]{32}$/);
    expect(result.row.prefix).toBe(result.token.slice(0, 8));
    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        name: "Laptop",
        prefix: result.token.slice(0, 8),
        token_hash: `hashed:${result.token}`,
      }),
    );
  });
});
