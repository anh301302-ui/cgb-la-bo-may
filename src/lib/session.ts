/**
 * Session Management
 * JWT-based session with httpOnly cookies for security
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionData } from "./discord/types";

/**
 * SECURITY (critical): never fall back to a hardcoded signing key.
 *
 * A predictable fallback secret means anyone who reads this open-source repo
 * can forge a `boost_session` JWT for ANY guildId and drive every authenticated
 * endpoint. In production we therefore refuse to sign/verify at all unless a
 * real JWT_SECRET (>= 32 chars) is configured. In development we derive an
 * ephemeral random key so local runs still work without setup — it changes on
 * every restart, which is fine because dev sessions are disposable.
 */
const DEV_EPHEMERAL_SECRET = crypto.randomUUID() + crypto.randomUUID();

function resolveJwtSecret(): Uint8Array {
  const configured = process.env.JWT_SECRET?.trim();

  if (configured && configured.length >= 32) {
    return new TextEncoder().encode(configured);
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JWT_SECRET is not configured (must be at least 32 characters). " +
        "Set it in Vercel → Settings → Environment Variables and redeploy."
    );
  }

  if (configured) {
    console.warn("[session] JWT_SECRET is shorter than 32 characters — using an ephemeral dev key.");
  }
  return new TextEncoder().encode(DEV_EPHEMERAL_SECRET);
}

const SESSION_COOKIE = "boost_session";
const SESSION_EXPIRY = "1h";

export async function createSession(data: SessionData): Promise<string> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(resolveJwtSecret());

  return token;
}

export async function verifySession(token: string): Promise<SessionData | null> {
  // Resolved outside the try/catch so a genuine misconfiguration surfaces as a
  // 500 instead of being silently swallowed into "session expired".
  const secret = resolveJwtSecret();
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      guildId: payload.guildId as string,
      guildName: payload.guildName as string | undefined,
      guildIcon: payload.guildIcon as string | undefined,
      memberCount: payload.memberCount as number | undefined,
      nonce: payload.nonce as string,
      guildVerified: payload.guildVerified as boolean | undefined,
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);
  if (!sessionCookie?.value) return null;
  return verifySession(sessionCookie.value);
}

export function getSessionCookieOptions() {
  return {
    name: SESSION_COOKIE,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    maxAge: 60 * 60, // 1 hour
    path: "/",
  };
}
