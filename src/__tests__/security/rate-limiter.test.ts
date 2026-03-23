import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AdminRateLimits,
  applyAdminRateLimit,
  clearRateLimit,
  getRateLimitStatus,
  rateLimit,
} from "@/lib/security/rate-limiter";

beforeEach(() => {
  vi.useFakeTimers();
  clearRateLimit();
});

afterEach(() => {
  vi.useRealTimers();
  clearRateLimit();
});

describe("rateLimit", () => {
  it("allows the first request", async () => {
    expect(await rateLimit("user-1", 5, 60)).toBe(true);
  });

  it("allows requests up to the limit", async () => {
    for (let i = 0; i < 5; i++) {
      expect(await rateLimit("user-1", 5, 60)).toBe(true);
    }
  });

  it("blocks the request that exceeds the limit", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("user-1", 5, 60);
    expect(await rateLimit("user-1", 5, 60)).toBe(false);
  });

  it("resets the counter after the window expires", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("user-1", 5, 60);
    expect(await rateLimit("user-1", 5, 60)).toBe(false);

    vi.advanceTimersByTime(61_000); // past the 60-second window

    expect(await rateLimit("user-1", 5, 60)).toBe(true);
  });

  it("tracks different identifiers independently", async () => {
    for (let i = 0; i < 5; i++) await rateLimit("user-a", 5, 60);
    expect(await rateLimit("user-a", 5, 60)).toBe(false);
    expect(await rateLimit("user-b", 5, 60)).toBe(true);
  });

  it("uses defaults of maxRequests=100 and windowSeconds=3600 when not provided", async () => {
    for (let i = 0; i < 100; i++) await rateLimit("default-user");
    expect(await rateLimit("default-user")).toBe(false);
  });
});

describe("getRateLimitStatus", () => {
  it("returns count=0 and isLimited=false for an unknown identifier", () => {
    const status = getRateLimitStatus("unknown");
    expect(status.count).toBe(0);
    expect(status.isLimited).toBe(false);
  });

  it("reflects the current count after some requests", async () => {
    await rateLimit("user-1", 100, 3600);
    await rateLimit("user-1", 100, 3600);

    // The singleton's getStatus uses a hard-coded limit of 100 for 'remaining'
    const status = getRateLimitStatus("user-1");
    expect(status.count).toBe(2);
    expect(status.remaining).toBe(98);
    expect(status.isLimited).toBe(false);
  });

  it("returns count=0 after the window has expired", async () => {
    await rateLimit("user-1", 5, 60);
    vi.advanceTimersByTime(61_000);

    const status = getRateLimitStatus("user-1");
    expect(status.count).toBe(0);
  });
});

describe("applyAdminRateLimit", () => {
  it("uses INVITE_USER limits (20/hr)", async () => {
    for (let i = 0; i < 20; i++) {
      expect(await applyAdminRateLimit("admin-1", "INVITE_USER")).toBe(true);
    }
    expect(await applyAdminRateLimit("admin-1", "INVITE_USER")).toBe(false);
  });

  it("uses RESET_PASSWORD limits (10/hr)", async () => {
    for (let i = 0; i < 10; i++) {
      expect(await applyAdminRateLimit("admin-1", "RESET_PASSWORD")).toBe(true);
    }
    expect(await applyAdminRateLimit("admin-1", "RESET_PASSWORD")).toBe(false);
  });

  it("namespaces identifiers per operation so they don't collide", async () => {
    for (let i = 0; i < 10; i++)
      await applyAdminRateLimit("admin-1", "RESET_PASSWORD");
    expect(await applyAdminRateLimit("admin-1", "RESET_PASSWORD")).toBe(false);
    // INVITE_USER has a separate namespace and should still be available
    expect(await applyAdminRateLimit("admin-1", "INVITE_USER")).toBe(true);
  });
});

describe("AdminRateLimits constants", () => {
  it("defines the expected limits", () => {
    expect(AdminRateLimits.INVITE_USER).toEqual({
      maxRequests: 20,
      windowSeconds: 3600,
    });
    expect(AdminRateLimits.RESET_PASSWORD).toEqual({
      maxRequests: 10,
      windowSeconds: 3600,
    });
    expect(AdminRateLimits.UPDATE_USER).toEqual({
      maxRequests: 50,
      windowSeconds: 3600,
    });
    expect(AdminRateLimits.REMOVE_USER).toEqual({
      maxRequests: 30,
      windowSeconds: 3600,
    });
    expect(AdminRateLimits.AUDIT_LOGS).toEqual({
      maxRequests: 200,
      windowSeconds: 3600,
    });
    expect(AdminRateLimits.UPDATE_MEMBERSHIP).toEqual({
      maxRequests: 100,
      windowSeconds: 3600,
    });
    expect(AdminRateLimits.GENERAL).toEqual({
      maxRequests: 500,
      windowSeconds: 3600,
    });
  });
});
