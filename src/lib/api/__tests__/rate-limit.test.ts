import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, _resetRateLimitForTests } from "../rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    _resetRateLimitForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-21T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to N requests per window", () => {
    for (let i = 0; i < 60; i++) {
      expect(rateLimit("token-1").allowed).toBe(true);
    }
  });

  it("blocks the 61st request and reports retry-after", () => {
    for (let i = 0; i < 60; i++) rateLimit("token-1");
    const r = rateLimit("token-1");
    expect(r.allowed).toBe(false);
    expect(r.retryAfter).toBeGreaterThan(0);
    expect(r.retryAfter).toBeLessThanOrEqual(60);
  });

  it("resets after the window slides past", () => {
    for (let i = 0; i < 60; i++) rateLimit("token-1");
    expect(rateLimit("token-1").allowed).toBe(false);

    vi.advanceTimersByTime(61_000);
    expect(rateLimit("token-1").allowed).toBe(true);
  });

  it("isolates buckets per token", () => {
    for (let i = 0; i < 60; i++) rateLimit("token-1");
    expect(rateLimit("token-1").allowed).toBe(false);
    expect(rateLimit("token-2").allowed).toBe(true);
  });
});
