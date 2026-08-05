/**
 * Boost Caller
 * Calls Discord's premium subscription API to boost a server using user tokens
 */

const DISCORD_API = "https://discord.com/api/v10";
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RATE_LIMIT_RETRIES = 2;
const MAX_RETRY_DELAY_MS = 10_000;

interface BoostCallResult {
  success: boolean;
  boostedCount: number;
  error?: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  for (let attempt = 0; attempt <= MAX_RATE_LIMIT_RETRIES; attempt++) {
    // Every request gets its own timeout. Without this a hung Discord
    // connection would keep the serverless invocation alive until the platform
    // kills it, which surfaces to the user as a generic 504 with no context.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

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
        signal: controller.signal,
      });

      if (res.ok) {
        return { success: true, boostedCount: slotsToApply.length };
      }

      // Discord rate limits boost calls aggressively when several accounts hit
      // the same guild back to back. It tells us exactly how long to wait, so
      // honour that and retry instead of surfacing a dead end to the user.
      if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
        const retryAfterSec = await readRetryAfterSeconds(res);
        const waitMs = Math.min(Math.ceil(retryAfterSec * 1000) + 250, MAX_RETRY_DELAY_MS);
        clearTimeout(timeout);
        await sleep(waitMs);
        continue;
      }

      return { success: false, boostedCount: 0, error: describeFailure(res.status) };
    } catch (err: unknown) {
      const aborted = err instanceof Error && err.name === "AbortError";
      if (aborted && attempt < MAX_RATE_LIMIT_RETRIES) {
        continue;
      }
      return {
        success: false,
        boostedCount: 0,
        error: aborted
          ? "Discord did not respond in time. Please try this token again."
          : "Could not reach Discord. Please try this token again.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  return {
    success: false,
    boostedCount: 0,
    error: "Discord is rate limiting boosts right now. Please wait a moment and retry.",
  };
}

/**
 * Read Discord's retry hint. It appears either as a JSON `retry_after` (seconds,
 * may be fractional) or as the standard `Retry-After` header.
 */
async function readRetryAfterSeconds(res: Response): Promise<number> {
  try {
    const data = (await res.clone().json()) as { retry_after?: number };
    if (typeof data.retry_after === "number" && Number.isFinite(data.retry_after)) {
      return Math.max(data.retry_after, 1);
    }
  } catch {
    // Body was not JSON — fall through to the header.
  }

  const header = Number(res.headers.get("retry-after"));
  return Number.isFinite(header) && header > 0 ? header : 3;
}

/**
 * Map Discord status codes to actionable, user-safe messages.
 *
 * SECURITY: the raw Discord response body is intentionally never returned to
 * the client — it can echo request details and internal identifiers.
 */
function describeFailure(status: number): string {
  switch (status) {
    case 400:
      return "Discord rejected the boost — the slots may already be in use on another server.";
    case 401:
      return "This token is no longer valid.";
    case 403:
      return "This account is not allowed to boost this server.";
    case 404:
      return "Server not found, or the account is not a member of it.";
    default:
      return status >= 500
        ? "Discord is having problems right now. Please try again shortly."
        : "Boost failed. Please try this token again.";
  }
}
