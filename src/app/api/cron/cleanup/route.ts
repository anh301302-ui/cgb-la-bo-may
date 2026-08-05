import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { resetRateLimitStore } from "@/lib/security/rateLimit";

/**
 * Constant-time string comparison. A plain `!==` on a secret leaks information
 * through timing: the comparison bails at the first differing byte, so an
 * attacker can recover the secret byte-by-byte by measuring response latency.
 */
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Daily cleanup cron — invoked automatically by Vercel Cron (see vercel.json).
 * Vercel signs cron requests with `Authorization: Bearer $CRON_SECRET`; we
 * verify that header to make sure this endpoint can't be triggered by anyone
 * else. Session cookies themselves are JWTs that already expire after 1h, so
 * this is a defense-in-depth reset of any accumulated in-memory state
 * (rate-limit counters) rather than something strictly required for
 * correctness.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");

  if (!cronSecret || !authHeader || !safeEquals(authHeader, `Bearer ${cronSecret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleared = resetRateLimitStore();

  return NextResponse.json({
    success: true,
    clearedEntries: cleared,
    clearedAt: new Date().toISOString(),
  });
}
