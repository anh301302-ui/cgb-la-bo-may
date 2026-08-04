import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { parseTokenInput, ValidateTokensSchema } from "@/lib/security/sanitize";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/security/rateLimit";
import { validateTokensBatch } from "@/lib/discord/tokenValidator";

export async function POST(req: NextRequest) {
  // Verify session
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Session expired. Please start over." }, { status: 401 });
  }

  // Rate limit by session guild + IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rl = checkRateLimit(`${session.guildId}:${ip}`, "tokens/validate");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many validation requests. Please wait." },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let body: { tokensRaw?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.tokensRaw || typeof body.tokensRaw !== "string") {
    return NextResponse.json({ error: "Tokens field is required" }, { status: 400 });
  }

  // Parse and sanitize tokens
  const rawTokens = parseTokenInput(body.tokensRaw);
  const validation = ValidateTokensSchema.safeParse({ tokens: rawTokens });

  if (!validation.success) {
    return NextResponse.json(
      { error: validation.error.issues[0]?.message ?? "Invalid tokens" },
      { status: 400 }
    );
  }

  const tokens = validation.data.tokens;

  try {
    // Validate all tokens in parallel batches
    const results = await validateTokensBatch(tokens, 3);

    const valid = results.filter((r) => r.valid && r.availableBoostSlots > 0);
    const validNoBoosts = results.filter((r) => r.valid && r.availableBoostSlots === 0);
    const invalid = results.filter((r) => !r.valid);

    const totalAvailableBoosts = valid.reduce((sum, r) => sum + r.availableBoostSlots, 0);

    return NextResponse.json({
      success: true,
      summary: {
        total: tokens.length,
        validWithBoosts: valid.length,
        validNoBoosts: validNoBoosts.length,
        invalid: invalid.length,
        totalAvailableBoosts,
      },
      valid: valid.map((r) => ({
        tokenMasked: r.tokenMasked,
        token: r.token, // Needed for boost step - NOT stored server-side
        username: r.username,
        userId: r.userId,
        avatar: r.avatar,
        nitroType: r.nitroType,
        availableBoostSlots: r.availableBoostSlots,
        boostSlotIds: r.boostSlotIds,
      })),
      validNoBoosts: validNoBoosts.map((r) => ({
        tokenMasked: r.tokenMasked,
        username: r.username,
        nitroType: r.nitroType,
        error: r.error,
      })),
      invalid: invalid.map((r) => ({
        tokenMasked: r.tokenMasked,
        error: r.error,
      })),
    });
  } catch (err) {
    console.error("Token validation error:", err);
    return NextResponse.json({ error: "Validation failed" }, { status: 500 });
  }
}
