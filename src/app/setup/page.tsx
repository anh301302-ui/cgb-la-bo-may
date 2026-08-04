"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { Logo } from "@/components/Logo";

type BotStatus = "checking" | "absent" | "needs_permission" | "present" | "error";

export default function SetupPage() {
  const router = useRouter();
  const [botStatus, setBotStatus] = useState<BotStatus>("checking");
  const [inviteUrl, setInviteUrl] = useState("");
  const [guild, setGuild] = useState<{ name: string; icon: string | null } | null>(null);
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    fetch("/api/session/verify")
      .then((r) => r.json())
      .then((data) => {
        if (!data.valid) router.replace("/");
        else setGuild(data.guild);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  const checkBot = useCallback(async () => {
    try {
      const [checkRes, inviteRes] = await Promise.all([
        fetch("/api/bot/check", { cache: "no-store" }),
        fetch("/api/bot/invite-url"),
      ]);
      const checkData = await checkRes.json();
      const inviteData = await inviteRes.json();

      if (inviteData.inviteUrl) setInviteUrl(inviteData.inviteUrl);

      if (checkData.guild) setGuild(checkData.guild);

      if (checkData.botInServer && checkData.hasPermission) {
        // Bot present AND has sufficient permission — skip authorization, proceed.
        setBotStatus("present");
        setTimeout(() => router.push("/boost"), 1400);
      } else if (checkData.botInServer && !checkData.hasPermission) {
        // Bot is a member but lacks CREATE_INSTANT_INVITE/Administrator —
        // re-authorizing with the same invite link upgrades its permissions.
        setBotStatus("needs_permission");
      } else {
        setBotStatus("absent");
      }
    } catch {
      setBotStatus("error");
    }
  }, [router]);

  useEffect(() => {
    checkBot();
  }, [checkBot]);

  useEffect(() => {
    if (botStatus !== "absent" && botStatus !== "needs_permission") return;
    // Poll every 4s per requirement — each tick re-checks both membership AND
    // permission via /api/bot/check (never assumes stale state).
    const interval = setInterval(async () => {
      setPollCount((c) => c + 1);
      const res = await fetch("/api/bot/check", { cache: "no-store" });
      const data = await res.json();
      if (data.guild) setGuild(data.guild);
      if (data.botInServer && data.hasPermission) {
        clearInterval(interval);
        setBotStatus("present");
        setTimeout(() => router.push("/boost"), 1400);
      } else if (data.botInServer && !data.hasPermission) {
        setBotStatus("needs_permission");
      } else {
        setBotStatus("absent");
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [botStatus, router]);

  const needsAuthorize = botStatus === "absent" || botStatus === "needs_permission";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md animate-slide-up">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-6">
            <Logo size={56} showText={false} />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink-text mb-2 tracking-wide">
            Bot <em className="italic font-normal">Integration</em>
          </h1>
          {guild && (
            <p className="text-ink-muted text-sm italic font-serif">
              for <span className="text-ink-text not-italic">{guild.name}</span>
            </p>
          )}
        </div>

        <Stepper currentStep={2} />

        <div className="panel p-8 space-y-6">
          <div className="flex items-start gap-4">
            <div className="mt-0.5 flex-shrink-0">
              {botStatus === "checking" && <div className="w-2 h-2 rounded-full bg-ink-text/40 animate-pulse-soft" />}
              {needsAuthorize && <div className="w-2 h-2 rounded-full bg-ink-text animate-pulse-soft" />}
              {botStatus === "present" && <div className="w-2 h-2 rounded-full bg-ink-text" />}
              {botStatus === "error" && <div className="w-2 h-2 rounded-full bg-ink-text/30" />}
            </div>
            <div className="flex-1">
              {botStatus === "checking" && (
                <>
                  <p className="text-ink-text text-sm font-medium">Checking integration status</p>
                  <p className="text-ink-dim text-xs mt-1">Verifying bot presence in target server</p>
                </>
              )}
              {botStatus === "absent" && (
                <>
                  <p className="text-ink-text text-sm font-medium">Awaiting bot authorization</p>
                  <p className="text-ink-dim text-xs mt-1">
                    Add the bot to proceed
                    {pollCount > 0 && <span className="ml-1 text-ink-muted">· polling ({pollCount})</span>}
                  </p>
                </>
              )}
              {botStatus === "needs_permission" && (
                <>
                  <p className="text-ink-text text-sm font-medium">Bot present, missing permission</p>
                  <p className="text-ink-dim text-xs mt-1">
                    Re-authorize below to grant the required permission
                    {pollCount > 0 && <span className="ml-1 text-ink-muted">· polling ({pollCount})</span>}
                  </p>
                </>
              )}
              {botStatus === "present" && (
                <>
                  <p className="text-ink-text text-sm font-medium">Bot confirmed active</p>
                  <p className="text-ink-dim text-xs mt-1">Proceeding to next step</p>
                </>
              )}
              {botStatus === "error" && (
                <>
                  <p className="text-ink-text text-sm font-medium">Verification failed</p>
                  <p className="text-ink-dim text-xs mt-1">Unable to check bot status</p>
                </>
              )}
            </div>
          </div>

          <div className="fade-line" />

          {needsAuthorize && (
            <div className="space-y-4">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Authorization steps</p>
              <ol className="space-y-3">
                {[
                  "Open the authorization link below",
                  "Select the target server",
                  "Confirm the authorization request",
                  "Return here — detection is automatic",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <span className="w-5 h-5 rounded-full border border-ink-line text-ink-muted text-[10px] flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-ink-muted">{step}</span>
                  </li>
                ))}
              </ol>

              {inviteUrl && (
                <a
                  href={inviteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary block w-full text-center font-medium py-3.5 px-4 text-xs uppercase tracking-[0.2em]"
                >
                  {botStatus === "needs_permission" ? "Re-authorize Bot" : "Authorize Bot"}
                </a>
              )}
            </div>
          )}

          {botStatus === "present" && (
            <div className="text-center py-2">
              <div className="inline-flex items-center gap-2 text-ink-muted text-xs uppercase tracking-widest">
                <Spinner /> Advancing
              </div>
            </div>
          )}

          {(botStatus === "checking" || botStatus === "error") && (
            <button onClick={checkBot} className="btn-outline w-full py-3.5 px-4 text-xs uppercase tracking-[0.2em]">
              {botStatus === "checking" ? "Checking" : "Retry"}
            </button>
          )}
        </div>

        <button
          onClick={() => router.push("/")}
          className="w-full mt-5 text-ink-dim hover:text-ink-text text-xs uppercase tracking-widest py-2 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
