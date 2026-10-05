"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Stepper } from "@/components/Stepper";
import { Logo } from "@/components/Logo";
import { useHistory } from "@/contexts/HistoryContext";

interface BoostResult {
  tokenMasked: string;
  username?: string;
  userId?: string;
  joinStatus: "joined" | "already_member" | "failed";
  boostStatus: "boosted" | "no_slots" | "failed" | "skipped";
  boostCount: number;
  error?: string;
}

interface LiveLogEntry {
  index: number;
  userId?: string;
  tokenMasked: string;
  status: string;
  message: string;
  boostCount?: number;
  timestamp: number;
}

interface BoostConfig {
  tokens: Array<{
    token: string;
    userId: string;
    boostSlotIds: string[];
    tokenMasked: string;
    username?: string;
  }>;
  boostsPerAccount: 1 | 2;
  guildId?: string; // 👈 Thêm ID
  guildName?: string;
}

type JobStatus = "idle" | "running" | "complete" | "error";

const DELAY_BETWEEN_TOKENS_MS = 7000;

const STATUS_LABELS: Record<string, string> = {
  checking: "Checking membership",
  joining: "Not in server yet — adding",
  joined: "Added to server",
  already_member: "Already a member",
  join_failed: "Failed to add",
  boosting: "Boosting",
  boosted: "Boosted successfully",
  boost_failed: "Boost failed",
  no_slots: "No boost slots available",
  error: "Error",
};

export default function ResultPage() {
  const router = useRouter();
  const { addHistory } = useHistory();
  const [status, setStatus] = useState<JobStatus>("idle");
  const [results, setResults] = useState<BoostResult[]>([]);
  const [liveLog, setLiveLog] = useState<LiveLogEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<{
    totalTokens: number;
    boosted: number;
    totalBoostedCount: number;
    alreadyMember: number;
    failed: number;
  } | null>(null);
  const [guildName, setGuildName] = useState("");
  const [error, setError] = useState("");
  const hasStarted = useRef(false);
  const stoppedRef = useRef(false);
  const logEndRef = useRef<HTMLDivElement>(null);

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const runSequentially = async (config: BoostConfig) => {
    setStatus("running");
    setTotal(config.tokens.length);

    const collected: BoostResult[] = [];
    let totalBoosted = 0;

    for (let i = 0; i < config.tokens.length; i++) {
      if (stoppedRef.current) break;

      const t = config.tokens[i];
      setCurrentIndex(i + 1);

      try {
        const res = await fetch("/api/tokens/boost-one", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: t.token,
            userId: t.userId,
            boostSlotIds: t.boostSlotIds,
            boostsPerAccount: config.boostsPerAccount,
          }),
        });

        if (stoppedRef.current) break;

        const data = await res.json();

        if (!res.ok) {
          setError(data.error ?? `Request failed for token ${i + 1}`);
          const failResult: BoostResult = {
            tokenMasked: t.tokenMasked,
            userId: t.userId,
            joinStatus: "failed",
            boostStatus: "failed",
            boostCount: 0,
            error: data.error ?? "Request failed",
          };
          collected.push(failResult);
          setResults((prev) => [...prev, failResult]);
          appendStages(i, t.userId, t.tokenMasked, [
            { status: "error", message: data.error ?? "Request failed", timestamp: Date.now() },
          ]);
        } else {
          const result: BoostResult = data.result;
          collected.push(result);
          setResults((prev) => [...prev, result]);
          if (result.boostStatus === "boosted") totalBoosted += result.boostCount;

          const stages: Array<{ status: string; message: string; timestamp: number }> = data.stages ?? [];
          appendStages(i, t.userId, t.tokenMasked, stages);
        }
      } catch (err) {
        const failResult: BoostResult = {
          tokenMasked: t.tokenMasked,
          userId: t.userId,
          joinStatus: "failed",
          boostStatus: "failed",
          boostCount: 0,
          error: err instanceof Error ? err.message : "Network error",
        };
        collected.push(failResult);
        setResults((prev) => [...prev, failResult]);
      }

      if (stoppedRef.current) break;

      if (i < config.tokens.length - 1) {
        await sleep(DELAY_BETWEEN_TOKENS_MS);
      }
    }

    if (stoppedRef.current) return;

    const failed = collected.filter((r) => r.joinStatus === "failed" || r.boostStatus === "failed").length;
    const boosted = collected.filter((r) => r.boostStatus === "boosted").length;
    const alreadyMember = collected.filter((r) => r.joinStatus === "already_member").length;

    setSummary({
      totalTokens: config.tokens.length,
      boosted,
      totalBoostedCount: totalBoosted,
      alreadyMember,
      failed,
    });
    setStatus("complete");

    // 👇 LƯU LỊCH SỬ VỚI ID SERVER CHUẨN
    const now = new Date();
    const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    
    // Ưu tiên lấy ID, nếu không có mới lấy tên
    const finalServerId = config.guildId || config.guildName || "Unknown Server";

    addHistory({
      serverId: finalServerId,
      boosts: totalBoosted,
      boosted: boosted,
      existing: alreadyMember,
      failed: failed,
      date: dateStr,
    });
  };

  const appendStages = (
    index: number,
    userId: string,
    tokenMasked: string,
    stages: Array<{ status: string; message: string; timestamp: number }>
  ) => {
    const entries: LiveLogEntry[] = stages.map((s) => ({
      index,
      userId,
      tokenMasked,
      status: s.status,
      message: s.message,
      timestamp: s.timestamp,
    }));
    setLiveLog((prev) => [...prev, ...entries]);
  };

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const configRaw = sessionStorage.getItem("boostConfig");
    if (!configRaw) {
      router.replace("/");
      return;
    }

    let config: BoostConfig;
    try {
      config = JSON.parse(configRaw);
    } catch {
      router.replace("/");
      return;
    }

    setGuildName(config.guildName ?? "Server");
    sessionStorage.removeItem("boostConfig");
    runSequentially(config);

    return () => {
      stoppedRef.current = true;
    };
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [liveLog]);

  const progress = total > 0 ? Math.round((results.length / total) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start p-6 pt-14 pb-16">
      <div className="w-full max-w-lg animate-slide-up">
        <div className="text-center mb-10">
          <div className="flex justify-center mb-5">
            <Logo size={48} showText={false} />
          </div>
          <h1 className="font-serif text-3xl sm:text-4xl text-ink-text mb-2 tracking-wide">
            {status === "running" && (
              <>
                In <em className="italic font-normal">Progress</em>
              </>
            )}
            {status === "complete" && (
              <>
                Boost <em className="italic font-normal">Complete</em>
              </>
            )}
            {status === "error" && "Operation Failed"}
            {status === "idle" && "Preparing"}
          </h1>
          <p className="text-ink-muted text-sm italic font-serif">
            target: <span className="text-ink-text not-italic">{guildName}</span>
          </p>
        </div>

        <Stepper currentStep={4} />

        <div className="space-y-5">
          {status === "running" && total > 0 && (
            <div className="panel p-7">
              <div className="flex justify-between text-xs mb-3 uppercase tracking-wide">
                <span className="text-ink-muted">Processing token {currentIndex}/{total}</span>
                <span className="text-ink-text font-mono">{results.length}/{total}</span>
              </div>
              <div className="w-full h-px bg-ink-line overflow-hidden">
                <div
                  className="h-full bg-ink-text transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-ink-dim mt-3 text-center uppercase tracking-widest">
                {progress}% · Keep this tab open to continue
              </p>
            </div>
          )}

          {liveLog.length > 0 && (
            <div className="panel p-7">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted">Live Log</p>
                {status === "running" && (
                  <span className="flex items-center gap-1.5 text-[10px] text-ink-dim uppercase tracking-widest">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-text animate-pulse-soft" />
                    Streaming
                  </span>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto pr-1 font-mono text-[11px] space-y-1.5">
                {liveLog.map((entry, i) => (
                  <LiveLogLine key={i} entry={entry} />
                ))}
                <div ref={logEndRef} />
              </div>
            </div>
          )}

          {summary && status === "complete" && (
            <div className="panel p-7 animate-fade-in">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted mb-5 text-center">Summary</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                <SummaryCard label="Boosts" value={summary.totalBoostedCount} highlight />
                <SummaryCard label="Boosted" value={summary.boosted} />
                <SummaryCard label="Existing" value={summary.alreadyMember} dim />
                <SummaryCard label="Failed" value={summary.failed} dim />
              </div>
              {summary.totalBoostedCount > 0 && (
                <div className="text-center py-4 border-t border-ink-line">
                  <p className="font-serif text-lg text-ink-text italic">
                    {summary.totalBoostedCount} boost{summary.totalBoostedCount !== 1 ? "s" : ""} applied to {guildName}
                  </p>
                </div>
              )}
            </div>
          )}

          {error && status !== "complete" && (
            <div className="panel p-7 border-l-2 border-ink-text/40">
              <p className="text-ink-text text-sm font-medium mb-1">Notice</p>
              <p className="text-ink-dim text-xs">{error}</p>
            </div>
          )}

          {results.length > 0 && (
            <div className="panel p-7">
              <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted mb-4">
                Final Report ({results.length})
              </p>
              <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
                {results.map((r, i) => (
                  <TokenResultRow key={i} result={r} />
                ))}
                {status === "running" && results.length < total && (
                  <div className="flex items-center gap-3 border border-ink-line px-3 py-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-ink-text animate-pulse-soft" />
                    <span className="text-ink-dim text-xs">Processing next token</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {(status === "complete" || status === "error") && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => router.push("/boost")}
                className="btn-outline flex-1 py-3.5 px-4 text-xs uppercase tracking-[0.2em]"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push("/")}
                className="btn-primary flex-1 font-medium py-3.5 px-4 text-xs uppercase tracking-[0.2em]"
              >
                New Session
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveLogLine({ entry }: { entry: LiveLogEntry }) {
  const isSuccess = entry.status === "joined" || entry.status === "boosted" || entry.status === "already_member";
  const isFailure = entry.status === "join_failed" || entry.status === "boost_failed" || entry.status === "error";
  const time = new Date(entry.timestamp).toLocaleTimeString("en-US", { hour12: false });

  const label = STATUS_LABELS[entry.status] ?? entry.status;
  const detail = entry.status === "boosted" && entry.boostCount ? `boost ${entry.boostCount} cái thành công` : entry.message;

  return (
    <div className="flex items-start gap-2 leading-relaxed">
      <span className="text-ink-dim/60 flex-shrink-0">{time}</span>
      <span className={isSuccess ? "text-ink-text" : isFailure ? "text-ink-dim" : "text-ink-muted"}>
        [{entry.tokenMasked}] {label}
        {detail && detail !== label ? ` — ${detail}` : ""}
      </span>
    </div>
  );
}

function TokenResultRow({ result }: { result: BoostResult }) {
  const isSuccess = result.boostStatus === "boosted";
  const isFailed = result.joinStatus === "failed" || result.boostStatus === "failed";

  return (
    <div className={`flex items-center gap-3 border px-3 py-2.5 ${isSuccess ? "border-ink-text/30" : "border-ink-line"}`}>
      <div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-ink-text"
        style={{ opacity: isSuccess ? 1 : isFailed ? 0.2 : 0.4 }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-ink-text text-xs font-medium truncate">{result.username ?? "Unknown"}</p>
        <p className="text-ink-dim text-[11px] font-mono truncate">{result.tokenMasked}</p>
      </div>
      <div className="text-right flex-shrink-0">
        {isSuccess && <span className="text-ink-text text-xs">+{result.boostCount}</span>}
        {isFailed && <span className="text-ink-dim text-[11px]">{result.error?.substring(0, 24) ?? "Failed"}</span>}
        {!isSuccess && !isFailed && (
          <span className="text-ink-dim text-[11px]">{result.boostStatus === "no_slots" ? "No slots" : "Skipped"}</span>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, highlight, dim }: { label: string; value: number; highlight?: boolean; dim?: boolean }) {
  return (
    <div className={`border px-3 py-4 text-center ${highlight ? "border-ink-text" : "border-ink-line"}`}>
      <div className={`text-2xl font-serif ${dim ? "text-ink-muted" : "text-ink-text"}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-ink-dim mt-1">{label}</div>
    </div>
  );
}
