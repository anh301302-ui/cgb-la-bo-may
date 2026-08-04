/**
 * Boost Caller
 * Calls Discord's premium subscription API to boost a server using user tokens
 */

const DISCORD_API = "https://discord.com/api/v10";

interface BoostCallResult {
  success: boolean;
  boostedCount: number;
  error?: string;
}

/**
 * Apply server boosts using user token and their available boost slot IDs
 * @param userToken - The Discord user token (self-bot)
 * @param guildId - Target guild to boost
 * @param slotIds - Boost slot IDs to apply (from tokenValidator)
 * @param boostsToUse - How many boosts to apply (1 or 2)
 */
export async function boostServer(
  userToken: string,
  guildId: string,
  slotIds: string[],
  boostsToUse: 1 | 2
): Promise<BoostCallResult> {
  if (slotIds.length === 0) {
    return { success: false, boostedCount: 0, error: "No available boost slots" };
  }

  // Only use up to boostsToUse slots
  const slotsToApply = slotIds.slice(0, boostsToUse);

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/premium/subscriptions`, {
      method: "PUT",
      headers: {
        Authorization: userToken,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Origin: "https://discord.com",
        Referer: `https://discord.com/channels/${guildId}`,
      },
      body: JSON.stringify({
        user_premium_guild_subscription_slot_ids: slotsToApply,
      }),
    });

    if (res.ok) {
      return { success: true, boostedCount: slotsToApply.length };
    }

    // Handle specific error cases
    const errBody = await res.text().catch(() => "Unknown error");
    
    if (res.status === 400) {
      return { success: false, boostedCount: 0, error: "Invalid boost request - slots may already be in use" };
    } else if (res.status === 403) {
      return { success: false, boostedCount: 0, error: "Forbidden - token may lack permissions" };
    } else if (res.status === 404) {
      return { success: false, boostedCount: 0, error: "Guild not found or user not a member" };
    } else if (res.status === 429) {
      return { success: false, boostedCount: 0, error: "Rate limited by Discord" };
    }

    return { success: false, boostedCount: 0, error: `Boost failed: ${res.status} - ${errBody}` };
  } catch (err: unknown) {
    return {
      success: false,
      boostedCount: 0,
      error: err instanceof Error ? err.message : "Boost API call failed",
    };
  }
}
