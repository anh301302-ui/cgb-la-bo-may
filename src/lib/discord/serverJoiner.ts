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
  const clientId = process.env.OAUTH2_CLIENT_ID!;
  const redirectUri = encodeURIComponent(process.env.OAUTH2_REDIRECT_URI!);
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
 */
export async function exchangeCodeForAccessToken(
  code: string
): Promise<{ accessToken: string | null; error?: string }> {
  try {
    const params = new URLSearchParams({
      client_id: process.env.OAUTH2_CLIENT_ID!,
      client_secret: process.env.OAUTH2_CLIENT_SECRET!,
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.OAUTH2_REDIRECT_URI!,
    });

    const res = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { accessToken: null, error: `Token exchange failed: HTTP ${res.status} ${errText}` };
    }

    const data = await res.json();
    return { accessToken: data.access_token };
  } catch (err: unknown) {
    return {
      accessToken: null,
      error: err instanceof Error ? err.message : "Token exchange request failed",
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
    const botToken = process.env.BOT_TOKEN!;

    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/members/${userId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ access_token: accessToken }),
    });

    if (res.status === 201) {
      return { success: true, alreadyMember: false };
    } else if (res.status === 204) {
      return { success: true, alreadyMember: true };
    } else {
      const errText = await res.text().catch(() => "");
      return { success: false, error: `Failed to add member: HTTP ${res.status} ${errText}` };
    }
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to add member to guild",
    };
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
