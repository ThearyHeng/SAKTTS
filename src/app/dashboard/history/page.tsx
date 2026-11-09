"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Clock, Search, Trash2, Volume2 } from "lucide-react";
import { useStudio } from "@/components/providers";
import { WaveformPlayer } from "@/components/waveform-player";
import { ModalDialog } from "@/components/ui/modal-dialog";

type HistoryTypeFilter = "all" | "tts" | "clone" | "stt" | "music";

const TYPE_LABELS: Record<HistoryTypeFilter, string> = {
  all: "All",
  tts: "Text to Speech",
  clone: "Voice Cloning",
  stt: "Speech to Text",
  music: "Music",
};

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function AudioHistoryPage() {
  const { history, refreshStore } = useStudio();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<HistoryTypeFilter>("all");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return history.filter((item) => {
      if (typeFilter !== "all" && item.type !== typeFilter) return false;
      if (
        q &&
        !item.title.toLowerCase().includes(q) &&
        !item.text.toLowerCase().includes(q) &&
        !(item.voiceName ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [history, query, typeFilter]);

  const deleteItem = async (id: string) => {
    setBusyId(id);
    try {
      await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      await refreshStore();
    } finally {
      setBusyId(null);
    }
  };

  const clearAll = async () => {
    await fetch("/api/history", { method: "DELETE" });
    await refreshStore();
    setClearConfirmOpen(false);
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8">
      {/* Toolbar */}
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
            aria-hidden="true"
          />
          <label htmlFor="history-search" className="sr-only">
            Search audio history
          </label>
          <input
            id="history-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text, voice name, or title…"
            className="bg-card border-border/75 min-h-10 w-full rounded-xl border pr-4 pl-9 text-base sm:text-xs outline-none"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {(Object.keys(TYPE_LABELS) as HistoryTypeFilter[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTypeFilter(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                typeFilter === key
                  ? "bg-foreground text-background font-semibold"
                  : "bg-card border-border/70 text-muted-foreground hover:text-foreground border"
              }`}
            >
              {TYPE_LABELS[key]}
            </button>
          ))}

          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setClearConfirmOpen(true)}
              className="border-border/75 text-muted-foreground hover:text-destructive rounded-lg border px-3 py-1.5 text-xs font-medium"
            >
              Clear All
            </button>
          )}
        </div>
      </div>

      {/* Items List */}
      {filtered.length === 0 ? (
        <div className="bg-card border-border/65 flex flex-col items-center justify-center rounded-2xl border px-6 py-16 text-center">
          <div className="bg-foreground/[0.05] mb-3 flex h-11 w-11 items-center justify-center rounded-2xl">
            <Clock className="text-muted-foreground h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-sm font-semibold">No history items yet</h2>
          <p className="text-muted-foreground mt-1 max-w-sm text-xs">
            Synthesize Khmer or English speech in Text to Speech or Voice Cloning to save audio runs
            here.
          </p>
          <Link
            href="/dashboard"
            className="bg-foreground text-background mt-4 inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
            Open Text to Speech
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((item) => (
            <article
              key={item.id}
              className="bg-card border-border/65 space-y-3 rounded-2xl border p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-sm font-semibold">{item.title}</h2>
                    <span className="bg-foreground/[0.06] rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {item.type}
                    </span>
                    {item.voiceName && (
                      <span className="border-border/70 rounded-md border px-2 py-0.5 text-[10px] font-medium">
                        {item.voiceName}
                      </span>
                    )}
                    {item.language && (
                      <span className="text-muted-foreground text-[11px]">{item.language}</span>
                    )}
                  </div>
                  <p className="text-muted-foreground text-[11px]">
                    {formatDate(item.createdAt)} · {item.durationSec.toFixed(1)}s ·{" "}
                    <span className="font-mono">{item.creditsUsed}</span> credits
                  </p>
                </div>

                <button
                  type="button"
                  disabled={busyId === item.id}
                  onClick={() => deleteItem(item.id)}
                  aria-label={`Delete ${item.title}`}
                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {item.text && (
                <p className="bg-foreground/[0.03] border-border/45 text-foreground/90 rounded-xl border p-3 text-xs leading-relaxed whitespace-pre-wrap">
                  {item.text}
                </p>
              )}

              {item.audioUrl && (
                <WaveformPlayer
                  audioUrl={item.audioUrl}
                  waveform={item.waveform}
                  durationHint={item.durationSec}
                  compact={true}
                  downloadName={`saktts-${item.id}.${item.format || "mp3"}`}
                />
              )}
            </article>
          ))}
        </div>
      )}

      <ModalDialog
        open={clearConfirmOpen}
        onClose={() => setClearConfirmOpen(false)}
        title="Clear Audio History"
        description="Delete all saved audio runs from your workspace history? User credit balances remain intact."
        maxWidthClass="max-w-md"
      >
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setClearConfirmOpen(false)}
            className="bg-foreground/[0.06] hover:bg-foreground/[0.1] min-h-10 rounded-xl px-4 text-xs font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="bg-destructive text-destructive-foreground min-h-10 rounded-xl px-5 text-xs font-semibold hover:opacity-90"
          >
            Clear All History
          </button>
        </div>
      </ModalDialog>
    </div>
  );
}
