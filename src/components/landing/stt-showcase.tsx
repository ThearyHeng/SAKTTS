"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  AudioLines,
  Captions,
  Clock,
  Download,
  FolderKanban,
  Mic,
  Pause,
  Play,
  Scissors,
  Users,
} from "lucide-react";
import { DEMO_STT_SEGMENTS, SttSegment } from "@/lib/presets";
import { useLanguage } from "@/components/providers";

export function SttShowcase() {
  const { t } = useLanguage();
  const [segments, setSegments] = useState<SttSegment[]>(DEMO_STT_SEGMENTS);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const timerRef = useRef<number | null>(null);
  const totalDuration = 12.0;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    const startWall = performance.now() - currentTime * 1000;
    timerRef.current = window.setInterval(() => {
      const elapsed = (performance.now() - startWall) / 1000;
      if (elapsed >= totalDuration) {
        setCurrentTime(0);
        setPlaying(false);
      } else {
        setCurrentTime(elapsed);
      }
    }, 60);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [playing]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportTranscript = (fmt: "SRT" | "VTT" | "JSON" | "TXT" | "CSV") => {
    let text = "";
    const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const fmtTime = (sec: number, sep: string) =>
      `00:${pad(sec / 60)}:${pad(sec % 60)}${sep}${String(Math.round((sec % 1) * 1000)).padStart(3, "0")}`;

    if (fmt === "SRT") {
      text = segments
        .map(
          (s, i) =>
            `${i + 1}\n${fmtTime(s.start, ",")} --> ${fmtTime(s.end, ",")}\n[${s.speaker}] ${s.words
              .map((w) => w.text)
              .join(" ")}`
        )
        .join("\n\n");
    } else if (fmt === "VTT") {
      text =
        "WEBVTT\n\n" +
        segments
          .map(
            (s) =>
              `${fmtTime(s.start, ".")} --> ${fmtTime(s.end, ".")}\n<v ${s.speaker}>${s.words
                .map((w) => w.text)
                .join(" ")}`
          )
          .join("\n\n");
    } else if (fmt === "JSON") {
      text = JSON.stringify({ file: "interview.mp3", segments }, null, 2);
    } else if (fmt === "CSV") {
      text =
        "speaker,start,end,text\n" +
        segments
          .map(
            (s) =>
              `"${s.speaker}",${s.start.toFixed(3)},${s.end.toFixed(3)},"${s.words
                .map((w) => w.text)
                .join(" ")}"`
          )
          .join("\n");
    } else {
      text = segments
        .map((s) => `[${s.speaker}] ${s.words.map((w) => w.text).join(" ")}`)
        .join("\n");
    }

    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `interview.${fmt.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renameSpeaker = (segId: string, nextName: string) => {
    setSegments((prev) => prev.map((s) => (s.id === segId ? { ...s, speaker: nextName } : s)));
  };

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0 space-y-6">
            <p className="text-muted-foreground flex items-center gap-2 text-[13px] font-medium">
              <AudioLines className="h-4 w-4" />
              {t("stt.badge")}
            </p>
            <h2 className="text-3xl leading-[1.1] font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              {t("stt.title")}
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-[17px]">
              {t("stt.subtitle")}
            </p>
            <p className="text-foreground text-[14px] font-medium">{t("stt.try")}</p>
            <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center">
              <Link
                href="/dashboard/speech-to-text"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-all"
              >
                {t("stt.start")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/speech-to-text"
                className="bg-card text-foreground hover:opacity-85 inline-flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-medium shadow-xs ring-1 ring-black/[0.04] transition-all dark:ring-white/[0.06]"
              >
                {t("stt.explore")}
              </Link>
            </div>
            <p className="text-muted-foreground text-[13px]">{t("stt.note")}</p>
          </div>

          {/* Interactive Transcript Card */}
          <div className="bg-card min-w-0 rounded-3xl p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]">
            <div className="bg-foreground/[0.04] mb-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setPlaying((p) => !p)}
                  aria-label={playing ? "Pause demo transcript" : "Play demo transcript"}
                  className="bg-foreground text-background flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                >
                  {playing ? (
                    <Pause className="h-4 w-4 fill-current" />
                  ) : (
                    <Play className="h-4 w-4 translate-x-[1px] fill-current" />
                  )}
                </button>
                <div>
                  <p className="text-sm font-semibold">interview.mp3</p>
                  <p className="text-muted-foreground text-xs">
                    {playing ? "Playing synced transcript…" : "Click any word to jump"}
                  </p>
                </div>
              </div>
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                00:{String(Math.floor(currentTime)).padStart(2, "0")} / 00:12
              </span>
            </div>

            <div className="space-y-3">
              {segments.map((seg) => (
                <div
                  key={seg.id}
                  className="border-border/50 bg-foreground/[0.02] rounded-2xl border p-3.5"
                >
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      <input
                        aria-label={`Speaker label for ${seg.id}`}
                        value={seg.speaker}
                        onChange={(e) => renameSpeaker(seg.id, e.target.value)}
                        className="bg-transparent font-semibold outline-none focus:underline"
                      />
                    </div>
                    <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                      {seg.start.toFixed(3)} – {seg.end.toFixed(3)}
                    </span>
                  </div>
                  <p className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[14.5px] leading-relaxed">
                    {seg.words.map((w, idx) => {
                      const active = currentTime >= w.start && currentTime <= w.end;
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setCurrentTime(w.start);
                            setPlaying(true);
                          }}
                          className={`rounded px-0.5 transition-colors ${
                            active
                              ? "bg-foreground text-background font-medium"
                              : "hover:bg-foreground/[0.08]"
                          }`}
                        >
                          {w.text}
                        </button>
                      );
                    })}
                  </p>
                </div>
              ))}
            </div>

            <div className="border-border/50 mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-4">
              <span className="text-muted-foreground text-xs font-medium">Export as</span>
              <div className="flex flex-wrap gap-1.5">
                {(["SRT", "VTT", "JSON", "TXT", "CSV"] as const).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() => exportTranscript(fmt)}
                    className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex items-center gap-1 rounded-full px-3 py-1 font-mono text-[11px] font-medium transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    {fmt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 6 STT Feature Pillars */}
        <ul className="bg-card mt-16 grid grid-cols-1 gap-x-8 gap-y-7 rounded-3xl p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3">
          {[
            {
              icon: Mic,
              title: "Upload or record",
              desc: "Drop in an audio file or record straight from your browser.",
            },
            {
              icon: Users,
              title: "Speaker labels",
              desc: "Speakers are detected automatically — rename and colour-code them.",
            },
            {
              icon: Clock,
              title: "Timestamped segments",
              desc: "Every line keeps its own timing, and stays fully editable.",
            },
            {
              icon: Scissors,
              title: "Trim before transcribing",
              desc: "Select just the part you need, up to one hour per run.",
            },
            {
              icon: Captions,
              title: "Subtitle-ready exports",
              desc: "Download as SRT, VTT, JSON, TXT, or CSV.",
            },
            {
              icon: FolderKanban,
              title: "Projects & history",
              desc: "Group transcriptions into projects and revisit them anytime.",
            },
          ].map((feat) => {
            const Icon = feat.icon;
            return (
              <li key={feat.title} className="min-w-0">
                <span className="bg-foreground/[0.07] text-foreground/80 grid h-9 w-9 place-items-center rounded-full">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3.5 text-[15px] font-semibold">{feat.title}</p>
                <p className="text-muted-foreground mt-1 text-[14px] leading-relaxed">
                  {feat.desc}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
