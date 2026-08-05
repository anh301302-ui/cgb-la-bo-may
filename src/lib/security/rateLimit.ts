/**
 * Rate Limiting with In-Memory Storage
 * Simple, synchronous rate limiting that works on Vercel serverless
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (resets per serverless instance)
const store = new Map<string, RateLimitEntry>();

// Tracks the last call timestamp per key, for minimum-interval enforcement
const lastCallStore = new Map<string, number>();

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  "session/create": { max: 5, windowMs: 15 * 60 * 1000 }, // 5/15min per IP
  "tokens/validate": { max: 3, windowMs: 60 * 60 * 1000 }, // 3/hour per session
  "tokens/boost-one": { max: 8, windowMs: 60 * 60 * 1000 }, // 8 calls / session / 1h
  "tokens/boost-daily": { max: 32, windowMs: 24 * 60 * 60 * 1000 }, // 32 calls / IP / 24h
  "bot/check": { max: 30, windowMs: 5 * 60 * 1000 }, // 30/5min per session
};

/**
 * Check rate limit using in-memory storage (synchronous)
 * 
 * SECURITY:
 * - Simple, fast, and reliable (no external dependency)
 * - Resets per cold start (which is fine for abuse prevention)
 * - Per-instance limits catch most attackers
 */
export function checkRateLimit(
  key: string,
  endpoint: keyof typeof LIMITS | string
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = LIMITS[endpoint] ?? { max: 20, windowMs: 60 * 1000 };
  const now = Date.now();
  const storeKey = `${endpoint}:${key}`;

  let entry = store.get(storeKey);

  if (!entry || entry.resetAt < now) {
    entry = { count: 0, resetAt: now + config.windowMs };
    store.set(storeKey, entry);
  }

  entry.count++;

  const remaining = Math.max(0, config.max - entry.count);
  const resetIn = Math.ceil((entry.resetAt - now) / 1000);

  if (entry.count > config.max) {
    return { allowed: false, remaining: 0, resetIn };
  }

  return { allowed: true, remaining, resetIn };
}

export function getRateLimitHeaders(result: ReturnType<typeof checkRateLimit>) {
  return {
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset-In": result.resetIn.toString(),
  };
}

/**
 * Enforces a minimum interval between calls for the same key.
 */
export function checkMinInterval(key: string, minMs: number): boolean {
  const now = Date.now();
  const last = lastCallStore.get(key);
  lastCallStore.set(key, now);
  if (last !== undefined && now - last < minMs) {
    return false;
  }
  return true;
}

/**
 * Clears all in-memory rate limit counters (daily cleanup)
 */
export function resetRateLimitStore(): number {
  const size = store.size + lastCallStore.size;
  store.clear();
  lastCallStore.clear();
  return size;
}
