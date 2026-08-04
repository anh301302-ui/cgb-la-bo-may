import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const GEETEST_VALIDATE_URL = "https://gcaptcha4.geetest.com/validate";

export const GeetestResultSchema = z.object({
  lot_number: z.string().min(1).max(128).optional(),
  captcha_output: z.string().min(1).max(4096).optional(),
  pass_token: z.string().min(1).max(512).optional(),
  gen_time: z.string().regex(/^\d{1,20}$/).optional(),
}).refine((obj) => obj.lot_number && obj.captcha_output && obj.pass_token && obj.gen_time, {
  message: "Missing required GeeTest validation fields",
});

export type GeetestResult = z.infer<typeof GeetestResultSchema>;

export function isCaptchaEnabled(): boolean {
  return process.env.CAPTCHA?.trim().toLowerCase() === "true";
}

export function getGeetestCaptchaId(): string {
  const captchaId = process.env.GEETEST_ID?.trim();
  if (!captchaId) throw new Error("GEETEST_ID is not configured");
  return captchaId;
}

export async function verifyGeetest(result: unknown): Promise<boolean> {
  if (!isCaptchaEnabled()) return true;

  const parsed = GeetestResultSchema.safeParse(result);
  if (!parsed.success) return false;

  const captchaId = getGeetestCaptchaId();
  const captchaKey = process.env.GEETEST_KEY?.trim();
  if (!captchaKey) throw new Error("GEETEST_KEY is not configured");

  const { lot_number, captcha_output, pass_token, gen_time } = parsed.data;
  const signToken = createHmac("sha256", captchaKey).update(lot_number).digest("hex");
  const body = new URLSearchParams({
    lot_number,
    captcha_output,
    pass_token,
    gen_time,
    sign_token: signToken,
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetch(
      `${GEETEST_VALIDATE_URL}?captcha_id=${encodeURIComponent(captchaId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        cache: "no-store",
        signal: controller.signal,
      }
    );
    if (!response.ok) return false;

    const data = (await response.json()) as { result?: unknown };
    const actual = Buffer.from(String(data.result ?? ""));
    const expected = Buffer.from("success");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
