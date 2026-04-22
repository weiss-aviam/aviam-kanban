import { describe, it, expect } from "vitest";
import { hashToken, verifyToken } from "../hash";

describe("hashToken / verifyToken", () => {
  it("verifies a freshly hashed token", async () => {
    const hash = await hashToken("avk_secret123");
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(await verifyToken("avk_secret123", hash)).toBe(true);
  }, 10_000);

  it("rejects a tampered token", async () => {
    const hash = await hashToken("avk_secret123");
    expect(await verifyToken("avk_secret124", hash)).toBe(false);
  }, 10_000);

  it("rejects empty input", async () => {
    const hash = await hashToken("avk_secret123");
    expect(await verifyToken("", hash)).toBe(false);
  }, 10_000);
});
