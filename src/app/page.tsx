"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { Logo } from "@/components/Logo";

interface GuildInfo {
  id: string;
  name: string;
  icon: string | null;
  memberCount?: number;
  verified?: boolean;
}

interface GeetestValidateResult {
  lot_number?: string;
  captcha_output?: string;
  pass_token?: string;
  gen_time?: string;
}

interface GeetestInstance {
  onReady(callback: () => void): GeetestInstance;
  onSuccess(callback: () => void): GeetestInstance;
  onError(callback: () => void): GeetestInstance;
  onClose(callback: () => void): GeetestInstance;
  getValidate(): GeetestValidateResult | false;
  showCaptcha(): void;
  reset(): void;
  destroy(): void;
}

declare global {
  interface Window {
    initGeetest4?: (
      config: { captchaId: string; product: "bind"; language: string; riskType: string },
      callback: (captcha: GeetestInstance) => void
    ) => void;
  }
}

let geetestScriptPromise: Promise<void> | null = null;

function loadGeetestScript(): Promise<void> {
  if (window.initGeetest4) {
    console.log("[GeeTest] Script already loaded");
    return Promise.resolve();
  }
  if (geetestScriptPromise) {
    console.log("[GeeTest] Load in progress, reusing promise");
    return geetestScriptPromise;
  }

  geetestScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src*="geetest"]');
    if (existing?.readyState === "loaded" || existing?.readyState === "complete") {
      console.log("[GeeTest] Script tag exists and loaded");
      resolve();
      return;
    }

    console.log("[GeeTest] Creating new script tag");
    const script = document.createElement("script");
    script.src = "https://static.geetest.com/v4/gt4.js";
    script.async = true;
    script.defer = true;
    script.charset = "utf-8";

    const timeout = setTimeout(() => {
      console.error("[GeeTest] Load timeout after 10s");
      geetestScriptPromise = null;
      reject(new Error("GeeTest script load timeout"));
    }, 10_000);

    script.onload = () => {
      clearTimeout(timeout);
      console.log("[GeeTest] Script loaded successfully, initGeetest4 available:", !!window.initGeetest4);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeout);
      geetestScriptPromise = null;
      console.error("[GeeTest] Script load failed (404, CORS, or network)");
      reject(new Error("GeeTest script load failed (check CDN availability and CORS)"));
    };

    document.head.appendChild(script);
  });

  return geetestScriptPromise;
}

export default function HomePage() {
  const router = useRouter();
  const captchaRef = useRef<GeetestInstance | null>(null);
  const [guildId, setGuildId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [guildInfo, setGuildInfo] = useState<GuildInfo | null>(null);

  const createSession = async (captcha?: GeetestValidateResult) => {
    try {
      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ guildId: guildId.trim(), captcha }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Failed to verify server");
        captchaRef.current?.reset();
        return;
      }

      captchaRef.current?.destroy();
      captchaRef.current = null;
      setGuildInfo(data.guild);
      setTimeout(() => router.push("/setup"), 1400);
    } catch {
      setError("Network error. Please try again.");
      captchaRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const openCaptcha = async () => {
    try {
      setError("");
      const configRes = await fetch("/api/captcha/config", { cache: "no-store" });
      const config = (await configRes.json()) as { enabled?: boolean; captchaId?: string; error?: string };
      if (!configRes.ok) throw new Error(config.error ?? "CAPTCHA is unavailable");

      if (!config.enabled) {
        await createSession();
        return;
      }
      if (!config.captchaId) throw new Error("CAPTCHA is not configured");

      await loadGeetestScript();
      if (!window.initGeetest4) throw new Error("GeeTest script failed to load");

      // GeeTest v4: use 'popup' mode for auto-showing modal
      // 'bind' mode requires manual trigger; 'popup' is simplest
      window.initGeetest4(
        {
          captchaId: config.captchaId,
          product: "popup", // Auto-popup on success callback
          language: "eng",
          riskType: "slide",
        },
        (captcha) => {
          captchaRef.current?.destroy();
          captchaRef.current = captcha;

          captcha
            .onReady(() => {
              // onReady fires when iframe ready; popup mode auto-shows now
            })
            .onSuccess(() => {
              const proof = captcha.getValidate();
              if (!proof || !proof.lot_number) {
                setError("CAPTCHA verification failed. Please try again.");
                captcha.reset();
                setLoading(false);
                return;
              }
              void createSession(proof);
            })
            .onError(() => {
              setError("CAPTCHA error. Please check your network and try again.");
              captcha.reset();
              setLoading(false);
            })
            .onClose(() => {
              if (!loading) setLoading(false); // onClose fires after user interaction
            });
        }
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "CAPTCHA is temporarily unavailable";
      setError(msg);
      console.error("[CAPTCHA Error]", msg);
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setGuildInfo(null);

    const trimmedId = guildId.trim();
    if (!/^[0-9]{17,19}$/.test(trimmedId)) {
      setError("Guild ID must be 17-19 digits");
      return;
    }

    console.log("[Guild Setup] Guild ID valid, opening CAPTCHA...");
    setLoading(true);
    await openCaptcha();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <nav className="fixed top-0 left-0 right-0 flex items-center justify-center gap-6 sm:gap-10 py-6 text-[10px] sm:text-xs tracking-[0.25em] text-ink-dim uppercase z-20">
        <span className="hover:text-ink-text transition-colors cursor-default">System</span><span className="text-ink-line">·</span>
        <span className="hover:text-ink-text transition-colors cursor-default">Secure</span><span className="text-ink-line">·</span>
        <span className="hover:text-ink-text transition-colors cursor-default">Automated</span>
      </nav>

      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6"><Logo size={72} showText={false} /></div>
          <h1 className="font-serif text-4xl sm:text-5xl text-ink-text mb-3 tracking-wide">Server <em className="italic font-normal">Amplify</em></h1>
          <p className="text-ink-muted text-sm italic font-serif max-w-xs mx-auto leading-relaxed">Enter your server identifier to begin the automated boost sequence</p>
        </div>

        <Stepper currentStep={1} />
        <div className="panel panel-hover p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[11px] uppercase tracking-[0.2em] text-ink-muted mb-3">Server ID</label>
              <input
                type="text" value={guildId}
                onChange={(e) => { setGuildId(e.target.value.replace(/[^0-9]/g, "").slice(0, 19)); setError(""); }}
                placeholder="000000000000000000" maxLength={19}
                className="input-elegant w-full rounded-none px-4 py-3.5 font-mono text-sm tracking-wider"
                disabled={loading || !!guildInfo} inputMode="numeric" autoComplete="off"
              />
              <p className="mt-2 text-[11px] text-ink-dim leading-relaxed">Developer Mode → right-click server → Copy Server ID</p>
            </div>

            {error && <div className="border-l-2 border-ink-text/40 pl-4 py-1"><p className="text-ink-text/80 text-xs">{error}</p></div>}

            {guildInfo && (
              <div className={`border-l-2 pl-4 py-2 animate-fade-in ${guildInfo.verified ? "border-ink-text" : "border-ink-text/30"}`}>
                <div className="flex items-center gap-3">
                  {guildInfo.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={guildInfo.icon} alt={guildInfo.name} className="w-9 h-9 rounded-full grayscale" />
                  ) : <div className="w-9 h-9 rounded-full bg-ink-text/10 flex items-center justify-center text-ink-text font-serif text-sm">{guildInfo.verified ? guildInfo.name[0] : "?"}</div>}
                  <div><p className="text-ink-text text-sm font-medium">{guildInfo.name}</p>
                    {guildInfo.memberCount ? <p className="text-ink-dim text-xs">{guildInfo.memberCount.toLocaleString()} members</p> : !guildInfo.verified ? <p className="text-ink-dim text-xs">Will confirm once the bot joins</p> : null}
                  </div>
                </div>
              </div>
            )}

            <button type="submit" disabled={loading || !!guildInfo || guildId.length < 17} className="btn-primary w-full font-medium py-3.5 px-4 text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 mt-2">
              {loading ? <><Spinner /> Waiting for verification</> : guildInfo ? "Proceeding" : "Continue"}
            </button>
          </form>
        </div>
        <p className="text-center text-[10px] tracking-widest text-ink-dim/60 mt-6 uppercase">Encrypted session · No data retained</p>
      </div>
    </div>
  );
}

function Spinner() {
  return <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24"><circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>;
}
