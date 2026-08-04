import { NextResponse } from "next/server";
import { getSession, createSession, getSessionCookieOptions } from "@/lib/session";

const DISCORD_API = "https://discord.com/api/v10";

// Discord permission bit flags relevant to the Add Guild Member operation.
// Add Guild Member (PUT /guilds/{guild.id}/members/{user.id}) requires the bot
// to hold CREATE_INSTANT_INVITE in the target guild. ADMINISTRATOR implicitly
// satisfies every permission check, so either bit is sufficient.
const PERMISSION_CREATE_INSTANT_INVITE = 0x1n;
const PERMISSION_ADMINISTRATOR = 0x8n;

function hasRequiredPermission(permissionsBitfield: string): boolean {
  try {
    const bits = BigInt(permissionsBitfield);
    return (bits & PERMISSION_ADMINISTRATOR) !== 0n || (bits & PERMISSION_CREATE_INSTANT_INVITE) !== 0n;
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const botToken = process.env.BOT_TOKEN;
  if (!botToken) {
    console.error("[bot/check] Missing BOT_TOKEN env var.");
    return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
  }

  try {
    // IMPORTANT: `GET /guilds/{guild.id}/members/@me` is NOT a valid bot-token
    // endpoint (it only supports PATCH for updating the bot's own nickname, and
    // even then is unreliable). The correct, documented way for a bot to check
    // its own membership + computed permissions in a specific guild is
    // `GET /users/@me/guilds`, which lists every guild the bot belongs to along
    // with a `permissions` bitfield already computed for the bot in that guild.
    const guildsRes = await fetch(`${DISCORD_API}/users/@me/guilds?limit=200`, {
      headers: { Authorization: `Bot ${botToken}` },
    });

    if (guildsRes.status === 401) {
      console.error("[bot/check] BOT_TOKEN rejected by Discord (401).");
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }

    if (!guildsRes.ok) {
      console.error(`[bot/check] /users/@me/guilds failed: HTTP ${guildsRes.status}`);
      return NextResponse.json({ error: "Could not check bot status" }, { status: 500 });
    }

    const guilds: Array<{ id: string; name: string; icon: string | null; permissions: string }> =
      await guildsRes.json();

    const match = guilds.find((g) => g.id === session.guildId);

    if (!match) {
      // Bot genuinely isn't a member of this guild yet.
      return NextResponse.json({ botInServer: false, hasPermission: false });
    }

    const hasPermission = hasRequiredPermission(match.permissions);

    // Fetch member count for display (best-effort, non-blocking on failure).
    let memberCount: number | undefined = session.memberCount;
    const guildDetailRes = await fetch(`${DISCORD_API}/guilds/${session.guildId}?with_counts=true`, {
      headers: { Authorization: `Bot ${botToken}` },
    });
    if (guildDetailRes.ok) {
      const detail = await guildDetailRes.json();
      memberCount = detail.approximate_member_count;
    }

    const refreshedToken = await createSession({
      guildId: session.guildId,
      guildName: match.name,
      guildIcon: match.icon ?? undefined,
      memberCount,
      nonce: session.nonce,
      guildVerified: true,
    });

    const res = NextResponse.json({
      // "botInServer" reflects raw membership; "hasPermission" reflects whether
      // it can actually add members. The frontend should only advance past the
      // authorize step when BOTH are true — otherwise the user needs to
      // (re-)authorize the bot with sufficient permissions.
      botInServer: true,
      hasPermission,
      guild: {
        name: match.name,
        icon: match.icon ? `https://cdn.discordapp.com/icons/${session.guildId}/${match.icon}.png?size=128` : null,
        memberCount,
      },
    });

    res.cookies.set({
      ...getSessionCookieOptions(),
      value: refreshedToken,
    });

    return res;
  } catch (err) {
    console.error("Bot check error:", err);
    return NextResponse.json({ error: "Could not check bot status" }, { status: 500 });
  }
}
