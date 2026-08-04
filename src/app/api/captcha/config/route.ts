import { NextResponse } from "next/server";
import { getGeetestCaptchaId, isCaptchaEnabled } from "@/lib/security/geetest";

export const dynamic = "force-dynamic";

export async function GET() {
  const enabled = isCaptchaEnabled();

  try {
    return NextResponse.json(
      { enabled, captchaId: enabled ? getGeetestCaptchaId() : null },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { error: "CAPTCHA is temporarily unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
