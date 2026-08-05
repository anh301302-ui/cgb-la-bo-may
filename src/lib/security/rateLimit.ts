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
// (defense-in-depth so a script can't bypass the client's 7s pacing and
// hammer the shared bot token / Discord rate limits).
const lastCallStore = new Map<string, number>();

interface RateLimitConfig {
  max: number;
  windowMs: number;
}

const LIMITS: Record<string, RateLimitConfig> = {
  "session/create": { max: 5, windowMs: 15 * 60 * 1000 }, // 5/15min per IP
  "tokens/validate": { max: 3, windowMs: 60 * 60 * 1000 }, // 3/hour per session
  // Layer 1: one boost batch = up to 8 individual boost-one calls. The
  // window (1h) matches the session's own JWT lifetime, so this naturally
  // resets whenever a session would need to be re-verified anyway.
  "tokens/boost-one": { max: 8, windowMs: 60 * 60 * 1000 }, // 8 calls / session / 1h
  // Layer 2: IP-wide daily ceiling so a client can't bypass Layer 1 by
  // simply re-verifying the server to mint a fresh session repeatedly.
  "tokens/boost-daily": { max: 32, windowMs: 24 * 60 * 60 * 1000 }, // 32 calls / IP / 24h
  "bot/check": { max: 30, windowMs: 5 * 60 * 1000 }, // 30/5min per session
};

/**
 * Check rate limit using Vercel KV (distributed) + fallback to in-memory
 * 
 * SECURITY:
 * - If KV available: enforces globally (prevents VPN/proxy bypass)
 * - If KV unavailable: falls back to in-memory (graceful, no hard failures)
 * - Always checks in-memory first (faster, defense-in-depth)
 */
export function checkRateLimit(
  key: string,
  endpoint: keyof typeof LIMITS | string
): { allowed: boolean; remaining: number; resetIn: number } {
  const config = LIMITS[endpoint] ?? { max: 20, windowMs: 60 * 1000 };
  const now = Date.now();
  const storeKey = `${endpoint}:${key}`;
  const kvKey = `ratelimit:${storeKey}`;

  // Step 1: Check Vercel KV (distributed limit)
  if (kv && kvAvailable !== false) {
    try {
      // Increment counter in KV
      const count = await kv.incr(kvKey);

      // Set TTL on first increment
      if (count === 1) {
        await kv.expire(kvKey, Math.ceil(config.windowMs / 1000));
      }

      const remaining = Math.max(0, config.max - count);
      const resetIn = await kv.ttl(kvKey);

      if (count > config.max) {
        return { allowed: false, remaining: 0, resetIn: resetIn > 0 ? resetIn : 1 };
      }

      kvAvailable = true; // KV working
      return { allowed: true, remaining, resetIn: resetIn > 0 ? resetIn : 1 };
    } catch (err) {
      // KV failed (network issue, rate limit, etc.)
      kvAvailable = false;
      console.warn(`[rateLimit] KV unavailable, falling back to in-memory: ${err instanceof Error ? err.message : "unknown error"}`);
      // Continue to in-memory fallback below
    }
  }

  // Step 2: In-memory fallback (always available, but per-instance)
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
 * Enforces a minimum interval between calls for the same key. Returns false
 * if the previous call happened less than `minMs` ago (client is calling
 * faster than the UI's own pacing allows — likely a direct script call
 * bypassing the intended 7s per-token delay).
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
 * Clears all in-memory rate limit counters. Invoked daily by the Vercel Cron
 * job (/api/cron/cleanup) as an explicit "session hygiene" reset. Note: since
 * this store already lives per-serverless-instance, it may already reset on
 * cold starts — this is a deliberate, additional guarantee that state never
 * outlives 24h even on long-lived warm instances.
 */
export function resetRateLimitStore(): number {
  const size = store.size + lastCallStore.size;
  store.clear();
  lastCallStore.clear();
  return size;
}
