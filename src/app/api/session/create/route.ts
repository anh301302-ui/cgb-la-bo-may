import { NextRequest, NextResponse } from "next/server";
import { createSession, getSessionCookieOptions } from "@/lib/session";
import { GuildIdSchema, sanitizeString } from "@/lib/security/sanitize";
import { checkRateLimit, getRateLimitHeaders } from "@/lib/security/rateLimit";
import { isCaptchaEnabled, verifyGeetest } from "@/lib/security/geetest";

const DISCORD_API = "https://discord.com/api/v10";

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown";
  const rl = checkRateLimit(ip, "session/create");
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before trying again." },
      { status: 429, headers: getRateLimitHeaders(rl) }
    );
  }

  let body: { guildId?: string; captcha?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Validate and sanitize guild ID
  const rawId = sanitizeString(body.guildId ?? "");
  const parseResult = GuildIdSchema.safeParse(rawId);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: parseResult.error.issues[0]?.message ?? "Invalid Guild ID" },
      { status: 400 }
    );
  }

  const guildId = parseResult.data;

  if (isCaptchaEnabled()) {
    const captchaValid = await verifyGeetest(body.captcha);
    if (!captchaValid) {
      return NextResponse.json(
        { error: "CAPTCHA verification failed. Please try again." },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error(
      "[session/create] Missing BOT_TOKEN env var. Set it in Vercel → Settings → Environment Variables and redeploy."
    );
    return NextResponse.json(
      { error: "Server configuration error: BOT_TOKEN is not set. Contact the administrator." },
      { status: 500 }
    );
  }

  try {
    // Best-effort guild lookup. IMPORTANT: at this point the bot may NOT be in the
    // guild yet (user hasn't completed Step 2 invite flow). Discord's Bot-token
    // GET /guilds/{id} endpoint only succeeds if the bot already has access, so a
    // 403/404 here does NOT necessarily mean the guild ID is invalid — it just means
    // we can't preview guild details yet. We must NOT block the user in that case;
    // the invite step will confirm the bot afterward.
    const guildRes = await fetch(`${DISCORD_API}/guilds/${guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    // 401 = the BOT_TOKEN itself is invalid/revoked — this is a real config error.
    if (guildRes.status === 401) {
      console.error("[session/create] BOT_TOKEN rejected by Discord (401). Token is invalid or revoked.");
      return NextResponse.json(
        { error: "Server configuration error: bot token is invalid. Contact the administrator." },
        { status: 500 }
      );
    }

    let guildName: string | undefined;
    let guildIcon: string | undefined;
    let memberCount: number | undefined;
    let guildVerified = false;

    if (guildRes.ok) {
      const guild = await guildRes.json();
      guildName = guild.name;
      guildIcon = guild.icon ?? undefined;
      memberCount = guild.approximate_member_count;
      guildVerified = true;
    }
    // else: 403/404 — bot not a member yet. Proceed anyway; Step 2 will verify.

    const nonce = crypto.randomUUID();
    const sessionToken = await createSession({
      guildId,
      guildName,
      guildIcon,
      memberCount,
      nonce,
      guildVerified,
    });

    const cookieOptions = getSessionCookieOptions();
    const res = NextResponse.json({
      success: true,
      guild: {
        id: guildId,
        name: guildName ?? "Pending verification",
        icon: guildIcon ? `https://cdn.discordapp.com/icons/${guildId}/${guildIcon}.png?size=128` : null,
        memberCount,
        verified: guildVerified,
      },
    });

    res.cookies.set({
      ...cookieOptions,
      value: sessionToken,
    });

    return res;
  } catch (err) {
    console.error("Session create error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
