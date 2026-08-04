/**
 * Token Validator
 * Validates Discord user tokens and checks Nitro/boost status
 * Uses discord.js-selfbot-v13 for self-bot operations
 * IMPORTANT: Tokens are never stored - processed in memory only
 */

import type { TokenValidationResult } from "./types";

const DISCORD_API = "https://discord.com/api/v10";

export function maskToken(token: string): string {
  if (token.length < 20) return "***";
  return token.substring(0, 10) + "***" + token.substring(token.length - 5);
}

async function fetchWithToken(url: string, token: string) {
  const res = await fetch(url, {
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });
  return res;
}

interface DiscordUser {
  id: string;
  username: string;
  discriminator: string;
  avatar?: string;
  premium_type?: number; // 0=None, 1=Classic, 2=Nitro, 3=Basic
}

interface BoostSlot {
  id: string;
  subscription_id: string;
  premium_guild_subscription?: {
    guild_id: string;
    ended: boolean;
  } | null;
  cooldown_ends_at: string | null;
}

function nitroTypeFromPremium(premiumType?: number): TokenValidationResult["nitroType"] {
  switch (premiumType) {
    case 1: return "classic";
    case 2: return "nitro";
    case 3: return "basic";
    default: return "none";
  }
}

export async function validateToken(token: string): Promise<TokenValidationResult> {
  const tokenMasked = maskToken(token);

  try {
    // Step 1: Validate token and get user info
    const userRes = await fetchWithToken(`${DISCORD_API}/users/@me`, token);

    if (!userRes.ok) {
      const status = userRes.status;
      let error = "Invalid token";
      if (status === 401) error = "Token is invalid or expired";
      else if (status === 403) error = "Token access forbidden";
      else if (status === 429) error = "Rate limited - try again later";
      return { token, tokenMasked, valid: false, availableBoostSlots: 0, boostSlotIds: [], error };
    }

    const user: DiscordUser = await userRes.json();
    const nitroType = nitroTypeFromPremium(user.premium_type);

    // Step 2: If not Nitro, no boosts available
    if (nitroType === "none" || nitroType === "basic") {
      return {
        token,
        tokenMasked,
        valid: true,
        username: user.username,
        discriminator: user.discriminator,
        userId: user.id,
        avatar: user.avatar,
        nitroType,
        availableBoostSlots: 0,
        boostSlotIds: [],
        error: nitroType === "basic" ? "Nitro Basic does not include server boosts" : "Account has no Nitro",
      };
    }

    // Step 3: Get boost subscription slots
    const slotsRes = await fetchWithToken(
      `${DISCORD_API}/users/@me/guilds/premium/subscription-slots`,
      token
    );

    if (!slotsRes.ok) {
      return {
        token,
        tokenMasked,
        valid: true,
        username: user.username,
        discriminator: user.discriminator,
        userId: user.id,
        avatar: user.avatar,
        nitroType,
        availableBoostSlots: 0,
        boostSlotIds: [],
        error: "Could not fetch boost slots",
      };
    }

    const slots: BoostSlot[] = await slotsRes.json();
    
    // Filter available slots: not currently used and no cooldown
    const availableSlots = slots.filter(
      (slot) =>
        !slot.premium_guild_subscription ||
        slot.premium_guild_subscription.ended === true ||
        slot.cooldown_ends_at === null
    );

    return {
      token,
      tokenMasked,
      valid: true,
      username: user.username,
      discriminator: user.discriminator,
      userId: user.id,
      avatar: user.avatar,
      nitroType,
      availableBoostSlots: availableSlots.length,
      boostSlotIds: availableSlots.map((s) => s.id),
    };
  } catch (err: unknown) {
    return {
      token,
      tokenMasked,
      valid: false,
      availableBoostSlots: 0,
      boostSlotIds: [],
      error: err instanceof Error ? err.message : "Unknown error during validation",
    };
  }
}

export async function validateTokensBatch(
  tokens: string[],
  concurrency = 3
): Promise<TokenValidationResult[]> {
  const results: TokenValidationResult[] = [];
  
  // Process in chunks to avoid overwhelming Discord API
  for (let i = 0; i < tokens.length; i += concurrency) {
    const chunk = tokens.slice(i, i + concurrency);
    const chunkResults = await Promise.all(chunk.map(validateToken));
    results.push(...chunkResults);
    
    // Small delay between chunks to avoid rate limits
    if (i + concurrency < tokens.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  
  return results;
}
