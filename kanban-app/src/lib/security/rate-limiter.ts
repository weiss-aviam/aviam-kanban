/**
 * In-memory rate limiter for admin operations
 * In production, this should be replaced with Redis or similar
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // Clean up expired entries every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000);
  }

  /**
   * Check if request is within rate limit
   */
  async checkLimit(
    identifier: string,
    maxRequests: number,
    windowSeconds: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowMs = windowSeconds * 1000;
    const resetTime = now + windowMs;

    const entry = this.store.get(identifier);

    if (!entry) {
      // First request for this identifier
      this.store.set(identifier, {
        count: 1,
        resetTime,
      });
      return true;
    }

    if (now > entry.resetTime) {
      // Window has expired, reset counter
      this.store.set(identifier, {
        count: 1,
        resetTime,
      });
      return true;
    }

    if (entry.count >= maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  }

  /**
   * Get current rate limit status
   */
  getStatus(identifier: string): {
    count: number;
    remaining: number;
    resetTime: number;
    isLimited: boolean;
  } {
    const entry = this.store.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return {
        count: 0,
        remaining: Infinity,
        resetTime: 0,
        isLimited: false,
      };
    }

    return {
      count: entry.count,
      remaining: Math.max(0, 100 - entry.count), // Assuming default limit of 100
      resetTime: entry.resetTime,
      isLimited: entry.count >= 100,
    };
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all entries (for testing)
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Destroy the rate limiter
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.store.clear();
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

/**
 * Rate limit function
 */
export async function rateLimit(
  identifier: string,
  maxRequests: number = 100,
  windowSeconds: number = 3600
): Promise<boolean> {
  return rateLimiter.checkLimit(identifier, maxRequests, windowSeconds);
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(identifier: string) {
  return rateLimiter.getStatus(identifier);
}

/**
 * Clear rate limiter (for testing)
 */
export function clearRateLimit(): void {
  rateLimiter.clear();
}

/**
 * Specific rate limiters for different admin operations
 */
export const AdminRateLimits = {
  // User invitations: 20 per hour
  INVITE_USER: { maxRequests: 20, windowSeconds: 3600 },
  
  // Password resets: 10 per hour
  RESET_PASSWORD: { maxRequests: 10, windowSeconds: 3600 },
  
  // User updates: 50 per hour
  UPDATE_USER: { maxRequests: 50, windowSeconds: 3600 },
  
  // User removals: 30 per hour
  REMOVE_USER: { maxRequests: 30, windowSeconds: 3600 },
  
  // Audit log queries: 200 per hour
  AUDIT_LOGS: { maxRequests: 200, windowSeconds: 3600 },
  
  // Membership updates: 100 per hour
  UPDATE_MEMBERSHIP: { maxRequests: 100, windowSeconds: 3600 },
  
  // General admin operations: 500 per hour
  GENERAL: { maxRequests: 500, windowSeconds: 3600 },
};

/**
 * Apply rate limit for specific admin operation
 */
export async function applyAdminRateLimit(
  identifier: string,
  operation: keyof typeof AdminRateLimits
): Promise<boolean> {
  const limits = AdminRateLimits[operation];
  return rateLimit(`admin_${operation}_${identifier}`, limits.maxRequests, limits.windowSeconds);
}

/**
 * Rate limit middleware for Next.js API routes
 */
export function withRateLimit(
  operation: keyof typeof AdminRateLimits,
  getIdentifier: (req: any) => string = (req) => req.ip || 'unknown'
) {
  return function rateLimitMiddleware(handler: any) {
    return async function (req: any, res: any) {
      const identifier = getIdentifier(req);
      const isAllowed = await applyAdminRateLimit(identifier, operation);
      
      if (!isAllowed) {
        const status = getRateLimitStatus(`admin_${operation}_${identifier}`);
        return res.status(429).json({
          error: 'Rate limit exceeded',
          retryAfter: Math.ceil((status.resetTime - Date.now()) / 1000),
          limit: AdminRateLimits[operation].maxRequests,
          remaining: status.remaining,
        });
      }
      
      return handler(req, res);
    };
  };
}

export default rateLimiter;
