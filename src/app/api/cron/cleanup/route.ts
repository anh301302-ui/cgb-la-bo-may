import { NextRequest, NextResponse } from "next/server";
import { resetRateLimitStore } from "@/lib/security/rateLimit";

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
  const authHeader = req.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleared = resetRateLimitStore();

  return NextResponse.json({
    success: true,
    clearedEntries: cleared,
    clearedAt: new Date().toISOString(),
  });
}
