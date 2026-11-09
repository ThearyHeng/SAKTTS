"use client";

import React, { useState } from "react";
import {
  BarChart3,
  Captions,
  Check,
  Code2,
  Copy,
  Globe,
  Loader2,
  Pause,
  Play,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { useLanguage } from "@/components/providers";
import { BUILTIN_VOICES } from "@/lib/voices";
import { VoiceOrb } from "@/components/voice-orb";

const BENTO_VOICES = ["Maly", "Chanda", "Nita"].map(
  (name) => BUILTIN_VOICES.find((v) => v.name === name)!
);

const CURL_SNIPPET = `curl https://api.saktts.com/v1/audio/speech \\
  -H "Authorization: Bearer $SAKTTS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "saktts", "voice": "Maly", "input": "សួស្តី"}'`;

export function BentoFeatures() {
  const { t } = useLanguage();
  const [activeVoice, setActiveVoice] = useState(BENTO_VOICES[0]);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const playVoiceSample = async () => {
    if (playing && audioEl) {
      audioEl.pause();
      setPlaying(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saktts-client": "studio",
        },
        body: JSON.stringify({
          voice: activeVoice.name,
          input: "សួស្តី! សូមស្វាគមន៍មកកាន់ SAKTTS — សំឡេងខ្មែរធម្មជាតិ។",
          skipCredits: true,
        }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.onended = () => setPlaying(false);
        setAudioEl(audio);
        await audio.play();
        setPlaying(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const copyCurl = () => {
    navigator.clipboard.writeText(CURL_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <section id="features" className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mb-12 max-w-3xl sm:mb-16">
          <h2 className="mb-6 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl">
            {t("features.title")}
          </h2>
          <p className="text-muted-foreground max-w-2xl text-[17px] leading-relaxed sm:text-xl">
            {t("features.subtitle")}
          </p>
        </div>

        <div className="space-y-3">
          {/* Top 2 wide cards */}
          <div className="grid gap-3 md:grid-cols-2">
            {/* Natural Voices Card */}
            <div className="bg-card flex min-w-0 flex-col rounded-3xl p-3">
              <div className="bg-foreground/[0.04] relative flex h-60 flex-col overflow-hidden rounded-[18px] p-5 sm:h-64">
                <div className="flex flex-wrap gap-2">
                  {BENTO_VOICES.map((v) => {
                    const selected = activeVoice.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setActiveVoice(v)}
                        className={`flex h-8 items-center gap-2 rounded-full pr-3 pl-2 text-sm transition-colors ${
                          selected
                            ? "bg-card text-foreground font-medium shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <VoiceOrb orb={v.orb} size={18} />
                        <span>{v.name}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-5 text-[15px] leading-relaxed">
                  សួស្តី! សូមស្វាគមន៍មកកាន់ SAKTTS — សំឡេងខ្មែរធម្មជាតិ។
                </p>
                <div className="mt-auto flex items-center gap-3">
                  <button
                    type="button"
                    onClick={playVoiceSample}
                    aria-label="Play natural voice sample"
                    className="bg-foreground text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform active:scale-95"
                  >
                    {loading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : playing ? (
                      <Pause className="h-3.5 w-3.5 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" />
                    )}
                  </button>
                  <span aria-hidden="true" className="flex h-10 flex-1 items-center gap-[2px]">
                    {[
                      47, 52, 45, 32, 22, 23, 33, 45, 58, 72, 65, 48, 36, 44, 62, 78, 84, 66, 51,
                      39, 48, 63, 75, 58, 42, 31, 46, 61, 70, 52, 38, 28,
                    ].map((h, i) => (
                      <span
                        key={i}
                        className={`w-full rounded-full transition-colors ${
                          playing ? "bg-foreground" : "bg-foreground/30"
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    ))}
                  </span>
                </div>
              </div>
              <div className="px-3 pt-4 pb-2">
                <h3 className="text-lg font-semibold tracking-tight">Natural Voices</h3>
                <p className="text-muted-foreground mt-1 text-[14.5px]">
                  AI-powered voices that sound human
                </p>
              </div>
            </div>

            {/* Speech to Text Card */}
            <div className="bg-card flex min-w-0 flex-col rounded-3xl p-3">
              <div className="bg-foreground/[0.04] relative flex h-60 flex-col justify-between overflow-hidden rounded-[18px] p-5 sm:h-64">
                <div className="space-y-2.5">
                  <div className="bg-card/85 rounded-2xl p-3 shadow-xs">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-blue-500" />
                      <span className="font-semibold">Speaker 1</span>
                      <span className="text-muted-foreground font-mono">00:00.0</span>
                    </div>
                    <p className="text-[14px]">សូមស្វាគមន៍មកកាន់កម្មវិធីរបស់យើង។</p>
                  </div>
                  <div className="bg-card/85 rounded-2xl p-3 shadow-xs">
                    <div className="mb-1 flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      <span className="font-semibold">Speaker 2</span>
                      <span className="text-muted-foreground font-mono">00:04.2</span>
                    </div>
                    <p className="text-[14px]">អរគុណ! ខ្ញុំរីករាយណាស់ដែលបានមកទីនេះ។</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 pt-2">
                  <span className="text-muted-foreground mr-1 text-xs">Export as</span>
                  {["SRT", "VTT", "JSON", "TXT", "CSV"].map((fmt) => (
                    <span
                      key={fmt}
                      className="bg-foreground/[0.06] text-muted-foreground rounded-full px-2 py-0.5 font-mono text-[10px]"
                    >
                      {fmt}
                    </span>
                  ))}
                </div>
              </div>
              <div className="px-3 pt-4 pb-2">
                <h3 className="text-lg font-semibold tracking-tight">Speech to Text</h3>
                <p className="text-muted-foreground mt-1 text-[14.5px]">
                  Upload or record audio and get an accurate transcript in seconds.
                </p>
              </div>
            </div>
          </div>

          {/* 4-column Feature Grid */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Zap,
                title: "Instant Generation",
                desc: "Generate speech in seconds",
              },
              {
                icon: Globe,
                title: "Multi-Language",
                desc: "Supporting English, Khmer, and many more languages worldwide.",
              },
              {
                icon: Sparkles,
                title: "Emotional Expression",
                desc: "Add personality with emotional range",
              },
              {
                icon: BarChart3,
                title: "Advanced Analytics",
                desc: "Track usage, performance, and optimize your audio content",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-card rounded-3xl p-6">
                  <span className="bg-foreground/[0.06] text-foreground grid h-10 w-10 place-items-center rounded-2xl">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-tight">{item.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-[14px] leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}

            {/* Easy API Integration (2 cols) */}
            <div className="bg-card rounded-3xl p-6 sm:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span className="bg-foreground/[0.06] text-foreground grid h-10 w-10 place-items-center rounded-2xl">
                    <Code2 className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold tracking-tight">
                    Easy API Integration
                  </h3>
                  <p className="text-muted-foreground mt-1.5 text-[14px] leading-relaxed">
                    Simple REST API for developers with great documentation
                  </p>
                </div>
                <button
                  type="button"
                  onClick={copyCurl}
                  className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <pre className="bg-foreground/[0.04] text-muted-foreground mt-5 overflow-x-auto rounded-2xl p-4 font-mono text-xs leading-relaxed">
                {CURL_SNIPPET}
              </pre>
            </div>

            <div className="bg-card rounded-3xl p-6">
              <span className="bg-foreground/[0.06] text-foreground grid h-10 w-10 place-items-center rounded-2xl">
                <Users className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold tracking-tight">Speaker Detection</h3>
              <p className="text-muted-foreground mt-1.5 text-[14px] leading-relaxed">
                Transcripts are split by speaker automatically, ready to rename and colour-code.
              </p>
            </div>

            <div className="bg-card rounded-3xl p-6">
              <span className="bg-foreground/[0.06] text-foreground grid h-10 w-10 place-items-center rounded-2xl">
                <Captions className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-[17px] font-semibold tracking-tight">Subtitle Export</h3>
              <p className="text-muted-foreground mt-1.5 text-[14px] leading-relaxed">
                Download transcripts as SRT, VTT, JSON, TXT, or CSV in one click.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
