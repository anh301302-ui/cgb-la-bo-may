/**
 * Session Management
 * JWT-based session with httpOnly cookies for security
 */

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionData } from "./discord/types";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-in-production-min-32-chars"
);

const SESSION_COOKIE = "boost_session";
const SESSION_EXPIRY = "1h";

export async function createSession(data: SessionData): Promise<string> {
  const token = await new SignJWT({ ...data })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_EXPIRY)
    .setJti(crypto.randomUUID())
    .sign(JWT_SECRET);

  return token;
}

export async function verifySession(token: string): Promise<SessionData | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
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
