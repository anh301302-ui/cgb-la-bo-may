import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  const clientId = process.env.OAUTH2_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json({ error: "Bot not configured" }, { status: 500 });
  }

  // Build bot invite URL with permissions the Add Guild Member API actually
  // requires. BUG FIX: this previously requested only MANAGE_GUILD
  // (268435456 = bit 28), which does NOT include CREATE_INSTANT_INVITE
  // (bit 0 = value 1) — the specific permission Discord's
  // PUT /guilds/{id}/members/{user.id} endpoint checks. That mismatch meant
  // `hasPermission` in /api/bot/check could never become true even after the
  // bot was added, since the granted permission bit never matched what was
  // being validated. Now requesting CREATE_INSTANT_INVITE + MANAGE_GUILD
  // (268435457) so the bot can both add members and manage basic settings.
  const REQUIRED_PERMISSIONS = 268435457; // CREATE_INSTANT_INVITE (1) | MANAGE_GUILD (268435456)
  const inviteUrl =
    `https://discord.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&permissions=${REQUIRED_PERMISSIONS}` +
    `&scope=bot` +
    `&guild_id=${session.guildId}`;

  return NextResponse.json({ inviteUrl, guildId: session.guildId });
}
