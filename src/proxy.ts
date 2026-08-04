import { NextRequest, NextResponse } from "next/server";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` and `middleware()` -> `proxy()`.
// Runtime is Node.js by default now (previously Edge); no Edge-only APIs are used
// here so behavior is unchanged.
export function proxy(request: NextRequest) {
  const res = NextResponse.next();

  // Security headers on all responses
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), interest-cohort=()"
  );
  res.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload"
  );
  res.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      process.env.NODE_ENV === "production"
        ? "script-src 'self' 'unsafe-inline' https://static.geetest.com"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.geetest.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://static.geetest.com",
      "font-src 'self' https://fonts.gstatic.com https://static.geetest.com",
      "img-src 'self' https://cdn.discordapp.com https://*.geetest.com data: blob:",
      "connect-src 'self' https://*.geetest.com",
      "frame-src https://*.geetest.com",
      "frame-ancestors 'none'",
    ].join("; ")
  );

  // Block suspicious patterns
  const url = request.nextUrl.pathname;
  const suspiciousPatterns = [
    /\.\./,
    /<script/i,
    /javascript:/i,
    /vbscript:/i,
    /on\w+=/i, // Event handlers
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
