import { NextRequest, NextResponse } from "next/server";

/**
 * Edge middleware: CSRF protection + baseline security headers.
 *
 * WHY THIS EXISTS
 * The session cookie is httpOnly, which protects it from XSS exfiltration but
 * does NOT stop cross-site request forgery: a malicious page can still make the
 * browser POST to /api/tokens/boost-one and the cookie rides along. The cookie
 * is declared SameSite=strict, which blocks the classic case, but SameSite is a
 * browser-side defence only — it is silently absent for non-browser clients and
 * has historically had bypasses. We therefore enforce same-origin server-side
 * for every state-changing API call.
 *
 * POLICY
 *  - Safe methods (GET/HEAD/OPTIONS) pass through. Vercel Cron hits
 *    GET /api/cron/cleanup with no Origin header, and that route does its own
 *    CRON_SECRET bearer check.
 *  - Mutating methods must carry an Origin (or, failing that, a Referer) whose
 *    host matches the host serving the request. Anything else is rejected 403
 *    before it ever reaches a route handler.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestHost(req: NextRequest): string | null {
  // x-forwarded-host is what Vercel populates behind its proxy.
  return req.headers.get("x-forwarded-host") ?? req.headers.get("host");
}

function hostOf(rawUrl: string | null): string | null {
  if (!rawUrl) return null;
  try {
    return new URL(rawUrl).host;
  } catch {
    return null;
  }
}

function isSameOrigin(req: NextRequest): boolean {
  const expected = requestHost(req);
  if (!expected) return false;

  const origin = hostOf(req.headers.get("origin"));
  if (origin) return origin === expected;

  // Some browsers omit Origin on same-origin form posts; fall back to Referer.
  const referer = hostOf(req.headers.get("referer"));
  if (referer) return referer === expected;

  // Neither header present on a mutating request => not a legitimate browser
  // navigation from our own UI.
  return false;
}

function withSecurityHeaders(res: NextResponse): NextResponse {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  return res;
}

export function middleware(req: NextRequest) {
  const isApi = req.nextUrl.pathname.startsWith("/api/");

  if (isApi && !SAFE_METHODS.has(req.method) && !isSameOrigin(req)) {
    return withSecurityHeaders(
      NextResponse.json(
        { error: "Request blocked: cross-origin requests are not allowed." },
        { status: 403 }
      )
    );
  }

  return withSecurityHeaders(NextResponse.next());
}

export const config = {
  // Run on everything except Next's static output and static asset files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
