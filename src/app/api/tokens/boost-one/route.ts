import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { BoostOneRequestSchema } from "@/lib/security/sanitize";
import { checkRateLimit, checkMinInterval, getRateLimitHeaders } from "@/lib/security/rateLimit";
import { joinServerWithToken } from "@/lib/discord/serverJoiner";
import { boostServer } from "@/lib/discord/boostCaller";
import type { BoostResult } from "@/lib/discord/types";

interface Stage {
  status: string;
  message: string;
  timestamp: number;
}

/**
 * Processes ONE token per request. The client calls this endpoint
 * sequentially (one token at a time, pacing itself ~7s between calls)
 * instead of the server holding a single long-lived streaming connection
 * open for an entire batch. This keeps every serverless invocation short
 * (only as long as the actual Discord API work takes — a few seconds),
 * which:
 *   - avoids wasting billed Vercel function-time on artificial sleeps
 *   - avoids any risk of hitting the function timeout on a large batch
 *   - stops automatically if the user closes the tab (no further calls
 *     are made — no explicit cancellation logic needed)
 */
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired. Please start over." }, { status: 401 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";

  // Layer 1: up to 8 calls per session (matches the 8-token batch cap; the
  // window equals the session's own 1h JWT lifetime).
  // SECURITY: checkRateLimit now uses Vercel KV for distributed rate limiting
  const sessionLimit = await checkRateLimit(session.nonce, "tokens/boost-one");
  if (!sessionLimit.allowed) {
    return NextResponse.json(
      { error: "Boost limit reached for this session (max 8 tokens). Start a new session to continue." },
      { status: 429, headers: getRateLimitHeaders(sessionLimit) }
    );
  }

  // Layer 2: IP-wide daily ceiling — prevents bypassing Layer 1 by simply
  // re-verifying the server to mint a fresh session repeatedly.
  // SECURITY: Enforced globally via Vercel KV (prevents VPN/proxy bypass)
  const dailyLimit = await checkRateLimit(ip, "tokens/boost-daily");
  if (!dailyLimit.allowed) {
    return NextResponse.json(
      { error: "Daily boost limit reached for this network. Please try again tomorrow." },
      { status: 429, headers: getRateLimitHeaders(dailyLimit) }
    );
  }

  // Defense-in-depth: reject calls faster than 3s apart for the same
  // session — the UI paces itself at 7s, so anything faster indicates a
  // direct script call bypassing the intended throttling.
  if (!checkMinInterval(`boost-one:${session.nonce}`, 3000)) {
    return NextResponse.json(
      { error: "Requests are arriving too quickly. Please slow down." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = BoostOneRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 }
    );
  }

  const { token, userId, boostSlotIds, boostsPerAccount } = parsed.data;
  const guildId = session.guildId;
  const tokenMasked = token.substring(0, 10) + "***" + token.substring(token.length - 5);

  const stages: Stage[] = [];
  const stage = (status: string, message: string) => stages.push({ status, message, timestamp: Date.now() });

  const result: BoostResult = {
    token: "",
    tokenMasked,
    userId,
    joinStatus: "failed",
    boostStatus: "skipped",
    boostCount: 0,
  };

  stage("checking", "Checking membership status");

  try {
    stage("joining", "Token not in server — adding");
    const joinResult = await joinServerWithToken(token, userId, guildId);

    if (!joinResult.success) {
      result.joinStatus = "failed";
      result.boostStatus = "skipped";
      result.error = joinResult.error;
      stage("join_failed", `Failed to add: ${joinResult.error ?? "unknown error"}`);
    } else {
      result.joinStatus = joinResult.alreadyMember ? "already_member" : "joined";
      stage(
        joinResult.alreadyMember ? "already_member" : "joined",
        joinResult.alreadyMember ? "Already a member" : "Added to server successfully"
      );

      if (boostSlotIds.length > 0) {
        // Small delay after joining before boosting the same token, to avoid
        // hitting Discord immediately twice in a row for the same account.
        await new Promise((r) => setTimeout(r, 1000));

        stage("boosting", "Boosting server");
        const boostResult = await boostServer(token, guildId, boostSlotIds, boostsPerAccount);

        if (boostResult.success) {
          result.boostStatus = "boosted";
          result.boostCount = boostResult.boostedCount;
          stage(
            "boosted",
            `Boosted ${boostResult.boostedCount} slot${boostResult.boostedCount !== 1 ? "s" : ""} successfully`
          );
        } else {
          result.boostStatus = "failed";
          result.error = boostResult.error;
          stage("boost_failed", `Boost failed: ${boostResult.error ?? "unknown error"}`);
        }
      } else {
        result.boostStatus = "no_slots";
        stage("no_slots", "No available boost slots");
      }
    }
  } catch (err: unknown) {
    result.joinStatus = "failed";
    result.boostStatus = "failed";
    result.error = err instanceof Error ? err.message : "Unknown error";
    stage("error", result.error);
  }

  return NextResponse.json({ success: true, result, stages });
}
