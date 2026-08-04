import { NextResponse } from "next/server";
import { getGeetestCaptchaId, isCaptchaEnabled } from "@/lib/security/geetest";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = isCaptchaEnabled();

  try {
    const captchaId = enabled ? getGeetestCaptchaId() : null;
    const response = NextResponse.json(
      { enabled, captchaId },
      { status: 200, headers: { "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0" } }
    );
    // Add CORS headers if needed
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Content-Type", "application/json; charset=utf-8");
    return response;
  } catch (err) {
    console.error("[CAPTCHA Config Error]", err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { enabled: false, captchaId: null, error: "CAPTCHA temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
