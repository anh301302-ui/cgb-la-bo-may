import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }

  return NextResponse.json({
    valid: true,
    guild: {
      id: session.guildId,
      name: session.guildName ?? "Pending verification",
      icon: session.guildIcon
        ? `https://cdn.discordapp.com/icons/${session.guildId}/${session.guildIcon}.png?size=128`
        : null,
      memberCount: session.memberCount,
      verified: session.guildVerified ?? false,
    },
  });
}
