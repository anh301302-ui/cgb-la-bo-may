/**
 * CSRF & Security Middleware
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

export function middleware(request: NextRequest) {
  // Only check mutations (POST, PUT, DELETE)
  const method = request.method;
  const isMutation = ["POST", "PUT", "DELETE", "PATCH"].includes(method);

  if (!isMutation) {
    // GET/HEAD/OPTIONS don't need CSRF check
    return NextResponse.next();
  }

  // Extract origin from request headers
  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");

  // Check if origin/referer matches allowed list
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    // All API routes
    "/api/:path*",
    // Exclude static files and images
    "/((?!.*\\.(js|css|map|png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf|eot)).*)",
  ],
};
