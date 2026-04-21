const LIMIT = 60;
const WINDOW_MS = 60_000;

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfter: number;
}

export function rateLimit(tokenId: string): RateLimitResult {
  const now = Date.now();
  const b = buckets.get(tokenId);

  if (!b || b.resetAt <= now) {
    buckets.set(tokenId, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: LIMIT - 1, retryAfter: 0 };
  }

  if (b.count >= LIMIT) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((b.resetAt - now) / 1000),
    };
  }

  b.count += 1;
  return { allowed: true, remaining: LIMIT - b.count, retryAfter: 0 };
}

/** @internal Test-only — clears the in-memory buckets. */
export function _resetRateLimitForTests() {
  buckets.clear();
}
