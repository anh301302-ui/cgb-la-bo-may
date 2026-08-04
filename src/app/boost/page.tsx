"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { Logo } from "@/components/Logo";

interface ValidToken {
  token: string;
  tokenMasked: string;
  username?: string;
  userId?: string;
  avatar?: string;
  nitroType?: string;
  availableBoostSlots: number;
  boostSlotIds: string[];
}

interface ValidationResult {
  summary: {
    total: number;
    validWithBoosts: number;
    validNoBoosts: number;
    invalid: number;
    totalAvailableBoosts: number;
  };
  valid: ValidToken[];
  validNoBoosts: Array<{ tokenMasked: string; username?: string; nitroType?: string; error?: string }>;
  invalid: Array<{ tokenMasked: string; error?: string }>;
}

export default function BoostPage() {
  const router = useRouter();
  const [guild, setGuild] = useState<{ name: string; icon: string | null } | null>(null);
  const [tokensRaw, setTokensRaw] = useState("");
  const [boostsPerAccount, setBoostsPerAccount] = useState<1 | 2>(2);
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState("");
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  useEffect(() => {
    fetch("/api/session/verify")
      .then((r) => r.json())
      .then((data) => {
        if (!data.valid) router.replace("/");
        else setGuild(data.guild);
      })
      .catch(() => router.replace("/"));
  }, [router]);

  const handleValidate = async () => {
    setError("");
    setValidation(null);
    if (!tokensRaw.trim()) {
      setError("Paste at least one token");
      return;
    }
    setValidating(true);
    try {
      const res = await fetch("/api/tokens/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokensRaw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Validation failed");
        return;
      }
      setValidation(data);
    } catch {
      setError("Network error during validation");
    } finally {
      setValidating(false);
    }
  };

  const handleBoost = async () => {
    if (!validation || validation.valid.length === 0) return;
    setLoading(true);
    sessionStorage.setItem("boostConfig", JSON.stringify({
      tokens: validation.valid,
      boostsPerAccount,
      guildName: guild?.name,
    }));
    router.push("/result");
  };

  const tokenCount = tokensRaw
    .split(/[\n,\r]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 50).length;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 pt-14 pb-16">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <Logo size={48} showText={false} />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink-text mb-2 tracking-wide">
            Token <em className="italic font-normal">Configuration</em>
          </h1>
          {guild && (
            <p className="text-ink-muted text-sm italic font-serif">
              target: <span className="text-ink-text not-italic">{guild.name}</span>
            </p>
          )}
        </div>

        <Stepper currentStep={3} />

        <div className="space-y-5">
          <div className="panel p-7">
            <div className="flex items-center justify-between mb-3">
              <label className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">
                Token Input
              </label>
              {tokenCount > 0 && (
                <span className="text-ink-text text-xs font-mono">{tokenCount} detected</span>
              )}
            </div>
            <textarea
              value={tokensRaw}
              onChange={(e) => {
                setTokensRaw(e.target.value);
                setValidation(null);
                setError("");
              }}
              placeholder={"Token 1\nToken 2\nToken 3\n..."}
              rows={7}
              disabled={validating || loading}
              className="input-elegant w-full rounded-none px-4 py-3.5 font-mono text-xs resize-none"
            />
            <p className="text-[11px] text-ink-dim mt-2">One token per line · Maximum 8</p>
          </div>

          <div className="panel p-7">
            <label className="block text-[11px] uppercase tracking-[0.2em] text-ink-muted mb-4">
              Boosts per Account
            </label>
            <div className="grid grid-cols-2 gap-3">
              {([1, 2] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setBoostsPerAccount(n)}
                  className={`
                    p-5 border text-left transition-all duration-300
                    ${
                      boostsPerAccount === n
                        ? "border-ink-text bg-ink-text/[0.04]"
                        : "border-ink-line hover:border-ink-line2"
                    }
                  `}
                >
                  <div className="font-serif text-2xl text-ink-text mb-1">{n}×</div>
                  <div className="text-ink-text text-xs uppercase tracking-wide">
                    Boost{n > 1 ? "s" : ""}
                  </div>
                  <div className="text-ink-dim text-[11px] mt-1">
                    {n === 1 ? "single slot" : "both slots"}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="border-l-2 border-ink-text/40 pl-4 py-1">
              <p className="text-ink-text/80 text-xs">{error}</p>
            </div>
          )}

          {validation && (
            <div className="panel p-7 space-y-5 animate-fade-in">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Validation Report</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Ready" value={validation.summary.validWithBoosts} />
                <StatCard label="Boost Slots" value={validation.summary.totalAvailableBoosts} />
                <StatCard label="No Boosts" value={validation.summary.validNoBoosts} dim />
                <StatCard label="Invalid" value={validation.summary.invalid} dim />
              </div>

              {validation.valid.length > 0 && (
                <div>
                  <div className="fade-line mb-4" />
                  <p className="text-ink-text text-xs mb-3 uppercase tracking-wide">
                    {validation.valid.length} accounts · {validation.summary.totalAvailableBoosts} boosts available
                  </p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {validation.valid.map((t) => (
                      <div key={t.tokenMasked} className="flex items-center gap-3 border border-ink-line px-3 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-ink-text/10 flex items-center justify-center text-xs font-serif flex-shrink-0">
                          {t.username?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-ink-text text-xs font-medium truncate">{t.username ?? "Unknown"}</p>
                          <p className="text-ink-dim text-[11px] font-mono truncate">{t.tokenMasked}</p>
                        </div>
                        <span className="text-ink-muted text-[11px] flex-shrink-0">
                          {t.availableBoostSlots} slot{t.availableBoostSlots !== 1 ? "s" : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {validation.summary.validWithBoosts === 0 && (
                <div className="text-center py-4">
                  <p className="text-ink-muted text-sm">No eligible tokens found</p>
                  <p className="text-ink-dim text-xs mt-1">Tokens must have active Nitro with unused boost slots</p>
                </div>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            {!validation ? (
              <button
                onClick={handleValidate}
                disabled={validating || tokenCount === 0}
                className="btn-primary flex-1 font-medium py-3.5 px-4 text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
              >
                {validating ? (
                  <>
                    <Spinner /> Validating
                  </>
                ) : (
                  "Validate Tokens"
                )}
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setValidation(null);
                    setError("");
                  }}
                  className="btn-outline sm:flex-none px-6 py-3.5 text-xs uppercase tracking-[0.2em]"
                >
                  Re-check
                </button>
                <button
                  onClick={handleBoost}
                  disabled={loading || validation.summary.validWithBoosts === 0}
                  className="btn-primary flex-1 font-medium py-3.5 px-4 text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Spinner /> Starting
                    </>
                  ) : (
                    `Begin Boost — ${validation.summary.validWithBoosts} accounts`
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, dim }: { label: string; value: number; dim?: boolean }) {
  return (
    <div className="border border-ink-line px-3 py-3.5 text-center">
      <div className={`text-2xl font-serif ${dim ? "text-ink-muted" : "text-ink-text"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-dim mt-1">{label}</div>
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
