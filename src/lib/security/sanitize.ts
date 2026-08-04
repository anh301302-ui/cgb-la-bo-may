/**
 * Input Sanitization
 * Server-side sanitization to prevent XSS, injection attacks
 */

import { z } from "zod";

// Sanitize a string: remove HTML tags, null bytes, control chars
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>&"'`]/g, "") // Remove HTML special chars
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[\x00-\x1F\x7F]/g, "") // Remove control characters
    .trim();
}

// Validate Discord Guild ID format
export const GuildIdSchema = z
  .string()
  .regex(/^[0-9]{17,19}$/, "Invalid Guild ID format (must be 17-19 digits)");

// Validate a single Discord user token
export const TokenSchema = z
  .string()
  .min(50, "Token too short")
  .max(200, "Token too long")
  .regex(
    /^[A-Za-z0-9._-]+$/,
    "Token contains invalid characters"
  );

// Schema for token validation request
export const ValidateTokensSchema = z.object({
  tokens: z
    .array(z.string())
    .min(1, "At least one token required")
    .max(8, "Maximum 8 tokens allowed per batch")
    .transform((tokens) =>
      tokens
        .map((t) => t.trim())
        .filter((t) => t.length > 0)
        // Deduplicate
        .filter((t, i, arr) => arr.indexOf(t) === i)
    ),
});

// Schema for a single-token boost request (client submits tokens one at a
// time so each serverless invocation stays short — see boost-one route).
export const BoostOneRequestSchema = z.object({
  token: z.string().min(50).max(200),
  userId: z.string().regex(/^[0-9]{17,20}$/, "Invalid user ID"),
  boostSlotIds: z.array(z.string()).max(2),
  boostsPerAccount: z.union([z.literal(1), z.literal(2)]),
});

// Parse raw token text (one per line or comma separated)
export function parseTokenInput(raw: string): string[] {
  return raw
    .split(/[\n,\r]+/)
    .map((t) => sanitizeString(t.trim()))
    .filter((t) => t.length >= 50 && /^[A-Za-z0-9._-]+$/.test(t))
    .slice(0, 8); // Hard cap at 8 tokens per batch
}
