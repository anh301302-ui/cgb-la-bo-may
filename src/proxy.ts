/**
 * CSRF & Security Proxy (Next.js 16+)
 * Validates Origin header on all mutations to prevent cross-site request forgery
 */

import { NextRequest, NextResponse } from "next/server";

// Allowed origins for API requests
const ALLOWED_ORIGINS = [
  "https://booster.storemmo.pro.vn",
  "https://www.booster.storemmo.pro.vn",
];

// Also allow localhost in development
if (process.env.NODE_ENV === "development") {
  ALLOWED_ORIGINS.push("http://localhost:3000");
  ALLOWED_ORIGINS.push("http://localhost:3001");
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // Add security headers to all responses
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://static.geetest.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.geetest.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://static.geetest.com",
      "font-src 'self' https://fonts.gstatic.com https://static.geetest.com",
      "img-src 'self' https://cdn.discordapp.com https://*.geetest.com data: blob:",
      "frame-src 'self' https://static.geetest.com",
      "connect-src 'self' https://discord.com https://api.discord.com https://*.geetest.com",
    ].join("; ")
  );

  // CSRF Protection: Validate Origin header on mutations
  const method = request.method;
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  if (isMutation) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");

    const isAllowed =
      (origin && ALLOWED_ORIGINS.some((o) => origin.startsWith(o))) ||
      (referer && ALLOWED_ORIGINS.some((o) => referer.startsWith(o)));

    if (!isAllowed) {
      console.warn(
        `[CSRF] Rejected ${method} from origin="${origin}" referer="${referer}"`
      );
      return NextResponse.json(
        { error: "Forbidden: Invalid origin" },
        { status: 403 }
      );
    }
  }

  return response;
}

export const config = {
  matcher: [
    // All API routes
    "/api/:path*",
    // Exclude static files and images
    "/((?!.*\\.(js|css|map|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)",
  ],
};
