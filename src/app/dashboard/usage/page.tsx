"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, AudioLines, BarChart3, Clock, CreditCard, Mic, Music, Zap } from "lucide-react";
import { useStudio } from "@/components/providers";
import { PLAN_LABELS, type CreditTransaction } from "@/lib/user-types";

export default function UsageAnalyticsPage() {
  const { plan, creditsBalance, creditsLimit, history, activeUser } = useStudio();
  const [txs, setTxs] = useState<CreditTransaction[]>([]);

  useEffect(() => {
    const uid = activeUser?.id ? `?userId=${encodeURIComponent(activeUser.id)}` : "";
    fetch(`/api/credits${uid}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.transactions) setTxs(d.transactions);
      })
      .catch(() => {});
  }, [activeUser?.id, creditsBalance]);

  const featureBreakdown = useMemo(() => {
    const buckets: Array<{
      key: "tts" | "clone" | "stt" | "music";
      label: string;
      icon: React.ComponentType<{ className?: string }>;
      runs: number;
      sec: number;
      credits: number;
    }> = [
      { key: "tts", label: "Text to Speech", icon: AudioLines, runs: 0, sec: 0, credits: 0 },
      { key: "clone", label: "Voice Cloning", icon: Mic, runs: 0, sec: 0, credits: 0 },
      { key: "stt", label: "Speech to Text", icon: BarChart3, runs: 0, sec: 0, credits: 0 },
      { key: "music", label: "Music & Jingles", icon: Music, runs: 0, sec: 0, credits: 0 },
    ];
    for (const item of history) {
      const b = buckets.find((x) => x.key === item.type);
      if (b) {
        b.runs += 1;
        b.sec += item.durationSec || 0;
        b.credits += item.creditsUsed || 0;
      }
    }
    return buckets;
  }, [history]);

  const totalSec = useMemo(
    () => history.reduce((acc, h) => acc + (h.durationSec || 0), 0),
    [history]
  );
  const totalCreditsFromRuns = useMemo(
    () => history.reduce((acc, h) => acc + (h.creditsUsed || 0), 0),
    [history]
  );

  const isEnterprise = plan === "enterprise";
  const planName = PLAN_LABELS[plan as keyof typeof PLAN_LABELS]?.label ?? plan;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-card border-border/65 rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium">Available Credits</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
            {isEnterprise ? "Unlimited" : creditsBalance.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {planName} · Limit {isEnterprise ? "Unlimited" : creditsLimit.toLocaleString()}
          </p>
        </div>

        <div className="bg-card border-border/65 rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium">Lifetime Credits Used</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
            {(activeUser?.creditsUsedTotal ?? totalCreditsFromRuns).toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">Across all studio features</p>
        </div>

        <div className="bg-card border-border/65 rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium">Audio Processed</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">
            {(totalSec / 60).toFixed(1)}m
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {totalSec.toFixed(1)} seconds total
          </p>
        </div>

        <div className="bg-card border-border/65 rounded-2xl border p-5">
          <p className="text-muted-foreground text-xs font-medium">Studio Runs</p>
          <p className="mt-2 font-mono text-3xl font-bold tabular-nums">{history.length}</p>
          <Link
            href="/dashboard/history"
            className="text-foreground mt-1 inline-flex items-center gap-1 text-xs font-medium hover:underline"
          >
            Browse Audio History
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Usage by Feature + Quick Actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="bg-card border-border/65 space-y-4 rounded-2xl border p-6 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Usage by Feature</h2>
              <p className="text-muted-foreground text-xs">
                Credit consumption broken down by voice synthesis, cloning, STT, and music.
              </p>
            </div>
            <Link
              href="/dashboard/billing"
              className="border-border/75 hover:bg-foreground/[0.04] inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-medium"
            >
              <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
              Manage Plan
            </Link>
          </div>

          <div className="space-y-4 pt-1">
            {featureBreakdown.map((item) => {
              const Icon = item.icon;
              const pct =
                totalCreditsFromRuns > 0
                  ? Math.round((item.credits / totalCreditsFromRuns) * 100)
                  : 0;
              return (
                <div key={item.key} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <Icon className="text-muted-foreground h-3.5 w-3.5" aria-hidden="true" />
                      {item.label}
                    </span>
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {item.runs} runs · {item.sec.toFixed(1)}s ·{" "}
                      <strong className="text-foreground">{item.credits.toLocaleString()}</strong> cr
                    </span>
                  </div>
                  <div className="bg-foreground/[0.06] h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-card border-border/65 space-y-4 rounded-2xl border p-6 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold">Recent Credit Events</h2>
              <p className="text-muted-foreground text-xs">Latest top-ups and usage logs.</p>
            </div>
            <Link
              href="/dashboard/billing?tab=history"
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
            >
              Full history
            </Link>
          </div>

          {txs.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center justify-center rounded-xl border border-dashed py-10 text-center text-xs">
              <Clock className="mb-2 h-4 w-4" aria-hidden="true" />
              No ledger events logged yet.
            </div>
          ) : (
            <ul className="divide-border/50 divide-y">
              {txs.slice(0, 6).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{tx.description}</p>
                    <p className="text-muted-foreground text-[11px] capitalize">
                      {tx.type.replace("_", " ")} · balance {tx.balanceAfter.toLocaleString()}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 font-mono font-semibold tabular-nums ${
                      tx.amount >= 0
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/dashboard/billing"
            className="bg-foreground text-background hover:opacity-90 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-xs font-semibold transition-opacity"
          >
            <Zap className="h-3.5 w-3.5" aria-hidden="true" />
            Upgrade or Top Up Credits
          </Link>
        </div>
      </div>
    </div>
  );
}
