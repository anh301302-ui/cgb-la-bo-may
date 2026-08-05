/**
 * Server Joiner
 * Handles OAuth2 flow to join Discord servers using user tokens.
 *
 * Re-implemented from the EXACT logic of discord.js-selfbot-v13's
 * `Client.authorizeURL()` (src/client/Client.js), which is what the source
 * repo (ferrymehdi/Discord-Token-Auto-Joiner-Bot) relies on internally. Key
 * details that were missing from earlier hand-rolled versions and caused
 * "No authorization code in redirect" failures:
 *
 *   1. The request BODY must re-include the URL's query params (client_id,
 *      redirect_uri, response_type, scope) alongside `authorize`,
 *      `permissions`, `integration_type`, AND a `location_context` object —
 *      not just send them in the query string.
 *   2. Discord's authorize endpoint expects the request to look like it came
 *      from an actual Discord client: it checks headers such as
 *      `X-Super-Properties` (base64 JSON client fingerprint), `X-Discord-Locale`,
 *      `X-Discord-Timezone`, `X-Debug-Options`, and standard `sec-ch-ua`/
 *      `sec-fetch-*` headers. Without these, Discord may return a location
 *      that is NOT the redirect-with-code (e.g. an interactive consent page),
 *      which is exactly the "no code in redirect" symptom.
 */

const DISCORD_API = "https://discord.com/api/v9";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

interface JoinResult {
  success: boolean;
  alreadyMember?: boolean;
  error?: string;
}

/**
 * Read a required environment variable.
 *
 * Previously these were read with non-null assertions (`process.env.X!`). When
 * the variable was actually missing, `undefined` was interpolated straight into
 * a URL or an Authorization header and the user saw a meaningless Discord error
 * ("401", "invalid client_id") instead of being told the deployment is
 * misconfigured. Failing loudly here keeps the cause obvious.
 */
class MissingConfigError extends Error {
  constructor(name: string) {
    super(`Server is not fully configured (missing ${name}). Please contact the administrator.`);
    this.name = "MissingConfigError";
  }
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MissingConfigError(name);
  return value;
}

/** Fetch with a hard timeout so a hung Discord call can't stall the function. */
async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 15_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Build the base64-encoded X-Super-Properties header Discord uses to
 * fingerprint the requesting client. Mirrors the structure discord.js-selfbot-v13
 * sends by default (os/browser/version/build fields) so the authorize
 * endpoint treats the request as coming from a genuine browser session.
 */
function buildSuperPropertiesHeader(): string {
  const properties = {
    os: "Windows",
    browser: "Chrome",
    device: "",
    system_locale: "en-US",
    browser_user_agent: BROWSER_UA,
    browser_version: "124.0.0.0",
    os_version: "10",
    referrer: "",
    referring_domain: "",
    referrer_current: "",
    referring_domain_current: "",
    release_channel: "stable",
    client_build_number: 324000,
    client_event_source: null,
  };
  return Buffer.from(JSON.stringify(properties)).toString("base64");
}

function browserLikeHeaders(userToken: string, referer: string): Record<string, string> {
  return {
    Authorization: userToken,
    "Content-Type": "application/json",
    "User-Agent": BROWSER_UA,
    Accept: "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    Origin: "https://discord.com",
    Referer: referer,
    "X-Super-Properties": buildSuperPropertiesHeader(),
    "X-Discord-Locale": "en-US",
    "X-Discord-Timezone": "America/New_York",
    "X-Debug-Options": "bugReporterEnabled",
    "sec-ch-ua": '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
  };
}

/**
 * Build the OAuth2 authorization URL (browser-facing form, used both as the
 * Referer header and as the source of query params re-sent in the body).
 */
export function buildOAuth2URL(): string {
  const clientId = requireEnv("OAUTH2_CLIENT_ID");
  const redirectUri = encodeURIComponent(requireEnv("OAUTH2_REDIRECT_URI"));
  return (
    `https://discord.com/oauth2/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code` +
    `&scope=guilds.join%20identify`
  );
}

/**
 * Use a self-bot token to authorize the OAuth2 consent programmatically —
 * exact port of discord.js-selfbot-v13's authorizeURL() request shape.
 */
export async function authorizeOAuth2WithToken(
  userToken: string,
  oauth2Url: string,
  guildId: string
): Promise<{ code: string | null; error?: string }> {
  try {
    const parsed = new URL(oauth2Url);
    const searchParams = Object.fromEntries(parsed.searchParams.entries());

    // Body: default flags + location_context + all URL query params spread in
    // (client_id, redirect_uri, response_type, scope), matching the library's
    // `{ authorize: true, permissions: '0', integration_type: 0, location_context, ...searchParams }`.
    const body = {
      authorize: true,
      permissions: "0",
      integration_type: 0,
      location_context: {
        guild_id: guildId,
        channel_id: "10000",
        channel_type: 10000,
      },
      ...searchParams,
    };

    // Query string sent on the request URL itself mirrors the same params.
    const apiAuthorizeUrl = `${DISCORD_API}/oauth2/authorize?${new URLSearchParams(searchParams).toString()}`;

    const res = await fetch(apiAuthorizeUrl, {
      method: "POST",
      headers: browserLikeHeaders(userToken, oauth2Url),
      body: JSON.stringify(body),
    });

    const rawText = await res.text().catch(() => "");
    let data: Record<string, unknown> = {};
    try {
      data = rawText ? JSON.parse(rawText) : {};
    } catch {
      // non-JSON response body
    }

    if (!res.ok) {
      let reason = `HTTP ${res.status}`;
      if (res.status === 401) reason = "Token invalid or expired";
      else if (typeof data.message === "string") reason = data.message;
      if (data.captcha_key) reason = "Discord requires CAPTCHA verification for this account";
      if (data.mfa) reason = "Discord requires additional MFA verification for this account";
      return { code: null, error: `Authorization failed: ${reason}` };
    }

    const location = data.location as string | undefined;
    if (!location) {
      return { code: null, error: "No redirect location returned by Discord" };
    }

    const redirectUrl = new URL(location);
    const code = redirectUrl.searchParams.get("code");

    if (!code) {
      // Discord returned a location but it wasn't the redirect_uri+code —
      // usually means the consent still needs interactive approval (e.g.
      // captcha) or the account has restrictions on this application.
      return {
        code: null,
        error: `No authorization code in redirect (Discord returned: ${location})`,
      };
    }

    return { code };
  } catch (err: unknown) {
    return {
      code: null,
      error: err instanceof Error ? err.message : "OAuth2 authorization request failed",
    };
  }
}

/**
 * Exchange authorization code for an access token
 * CRITICAL: Do not log the client_secret, response body, or error details
 */
export async function exchangeCodeForAccessToken(
  code: string
): Promise<{ accessToken: string | null; error?: string }> {
  try {
    const params = new URLSearchParams({
      client_id: requireEnv("OAUTH2_CLIENT_ID"),
      client_secret: requireEnv("OAUTH2_CLIENT_SECRET"),
      grant_type: "authorization_code",
      code,
      redirect_uri: requireEnv("OAUTH2_REDIRECT_URI"),
    });

    const res = await fetchWithTimeout(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      // SECURITY: Don't log response body (may contain error details that leak secrets)
      console.error(`[serverJoiner] Token exchange failed: HTTP ${res.status}`);
      return { accessToken: null, error: "Authorization failed. Please try again." };
    }

    const data = (await res.json()) as { access_token?: string };
    if (!data.access_token) {
      return { accessToken: null, error: "Authorization failed. Please try again." };
    }
    return { accessToken: data.access_token };
  } catch (err: unknown) {
    // A missing env var is a deployment problem, not a user problem — surface
    // it verbatim so the operator can act on it.
    if (err instanceof MissingConfigError) {
      return { accessToken: null, error: err.message };
    }
    // SECURITY: Log error context only, not the full error
    console.error(`[serverJoiner] Token exchange error`);
    return {
      accessToken: null,
      error: "Authorization failed. Please try again.",
    };
  }
}

/**
 * Add a user to a guild using their OAuth2 access token (requires Bot token
 * with CREATE_INSTANT_INVITE permission in that guild).
 */
export async function addMemberToGuild(
  userId: string,
  guildId: string,
  accessToken: string
): Promise<JoinResult> {
  try {
    const botToken = requireEnv("BOT_TOKEN");

    const res = await fetchWithTimeout(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (res.status === 201) {
      return { success: true, alreadyMember: false };
    }
    if (res.status === 204) {
      return { success: true, alreadyMember: true };
    }

    // Discord asks us to back off; one retry keeps a busy batch moving instead
    // of failing an otherwise-good token.
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const waitMs = Math.min((Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 3) * 1000, 10_000);
      await new Promise((r) => setTimeout(r, waitMs));

      const retry = await fetchWithTimeout(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
        method: "PUT",
        headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ access_token: accessToken }),
      });
      if (retry.status === 201) return { success: true, alreadyMember: false };
      if (retry.status === 204) return { success: true, alreadyMember: true };
      return { success: false, error: describeAddMemberFailure(retry.status) };
    }

    // SECURITY: never echo Discord's raw response body back to the client.
    return { success: false, error: describeAddMemberFailure(res.status) };
  } catch (err: unknown) {
    if (err instanceof MissingConfigError) {
      return { success: false, error: err.message };
    }
    if (err instanceof Error && err.name === "AbortError") {
      return { success: false, error: "Discord did not respond in time. Please try this token again." };
    }
    return { success: false, error: "Failed to add the account to the server. Please try again." };
  }
}

/**
 * Turn an Add-Guild-Member status code into an actionable, user-safe message.
 * The most common real-world failure is 403: the bot was invited without
 * CREATE_INSTANT_INVITE, so Discord refuses the call.
 */
function describeAddMemberFailure(status: number): string {
  switch (status) {
    case 400:
      return "Discord rejected the request for this account.";
    case 401:
      return "The bot token is invalid or was reset. Please contact the administrator.";
    case 403:
      return "The bot lacks permission to add members. Re-invite it with the 'Create Invite' permission.";
    case 404:
      return "Server not found. Make sure the bot is still in the server.";
    default:
      return status >= 500
        ? "Discord is having problems right now. Please try again shortly."
        : "Failed to add the account to the server. Please try again.";
  }
}

/**
 * Full join flow: OAuth2 authorize → exchange code → add member
 */
export async function joinServerWithToken(
  userToken: string,
  userId: string,
  guildId: string
): Promise<JoinResult> {
  const oauth2Url = buildOAuth2URL();

  const { code, error: authError } = await authorizeOAuth2WithToken(userToken, oauth2Url, guildId);
  if (!code) {
    return { success: false, error: authError };
  }

  const { accessToken, error: tokenError } = await exchangeCodeForAccessToken(code);
  if (!accessToken) {
    return { success: false, error: tokenError };
  }

  return addMemberToGuild(userId, guildId, accessToken);
}
