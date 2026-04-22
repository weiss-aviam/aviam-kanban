import { describe, it, expect } from "vitest";
import { generateToken, parsePrefix, BEARER_PREFIX } from "../format";

describe("generateToken", () => {
  it("produces a token of exactly 36 chars starting with avk_", () => {
    const t = generateToken();
    expect(t).toMatch(/^avk_[A-Za-z0-9]{32}$/);
    expect(t).toHaveLength(36);
  });

  it("returns unique tokens across many calls (smoke)", () => {
    const set = new Set(Array.from({ length: 1000 }, generateToken));
    expect(set.size).toBe(1000);
  });
});

describe("parsePrefix", () => {
  it("returns the first 8 chars of the full token", () => {
    expect(parsePrefix("avk_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6")).toBe(
      "avk_a1b2",
    );
  });

  it("returns null for malformed input", () => {
    expect(parsePrefix("nope")).toBeNull();
    expect(parsePrefix("avk_short")).toBeNull();
  });
});

describe("BEARER_PREFIX", () => {
  it("equals 'avk_'", () => {
    expect(BEARER_PREFIX).toBe("avk_");
  });
});
