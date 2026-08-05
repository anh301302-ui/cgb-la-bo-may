/**
 * Secure Logger
 * Redacts sensitive tokens and secrets from logging
 * Ensures Discord tokens, OAuth2 secrets, and user data are NEVER logged
 */

/**
 * Redact a Discord token by showing only first 10 and last 5 characters
 */
export function redactToken(str: string | undefined): string {
  if (!str || str.length < 20) return "***REDACTED***";
  return str.substring(0, 10) + "***" + str.substring(str.length - 5);
}

/**
 * Redact OAuth2/sensitive data from objects before logging
 */
export function sanitizeForLogging(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  const clean = Array.isArray(obj) ? [...obj] : { ...obj };

  // Token fields to redact
  const tokenFields = ["token", "userToken", "accessToken", "code", "refresh_token"];
  // Secret fields (should never reach here, but just in case)
  const secretFields = ["client_secret", "JWT_SECRET"];

  for (const field of tokenFields) {
    if (field in clean && typeof clean[field] === "string") {
      clean[field] = redactToken(clean[field]);
    }
  }

  for (const field of secretFields) {
    if (field in clean) {
      clean[field] = "***REDACTED_SECRET***";
    }
  }

  return clean;
}

/**
 * Safely stringify an object for logging (redacts sensitive fields)
 */
export function safeStringify(obj: any): string {
  try {
    return JSON.stringify(sanitizeForLogging(obj));
  } catch {
    return "[object - not JSON stringifiable]";
  }
}

/**
 * Log with automatic redaction
 */
export function logSecure(
  context: string,
  message: string,
  data?: any,
  level: "log" | "error" | "warn" = "log"
) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${context}]`;

  if (data) {
    const safeData = sanitizeForLogging(data);
    console[level](`${prefix} ${message}`, safeData);
  } else {
    console[level](`${prefix} ${message}`);
  }
}
