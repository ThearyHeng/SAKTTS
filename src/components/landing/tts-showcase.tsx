"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Mic, Volume2 } from "lucide-react";
import { SHOWCASE_VOICES, VoiceProfile } from "@/lib/voices";
import { useLanguage, useStudio } from "@/components/providers";
import { VoiceOrb } from "@/components/voice-orb";
import { WaveformPlayer } from "@/components/waveform-player";
import { VoicePickerDialog } from "@/components/studio/voice-picker-dialog";

export function TtsShowcase() {
  const { t } = useLanguage();
  const { voices } = useStudio();
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(SHOWCASE_VOICES[0]);
  const [script, setScript] = useState(SHOWCASE_VOICES[0].refText);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[] | undefined>(undefined);
  const [duration, setDuration] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectVoice = (v: VoiceProfile) => {
    setSelectedVoice(v);
    setScript(v.refText);
  };

  const generateSample = async (voiceToPlay = selectedVoice, textToPlay = script) => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saktts-client": "studio",
        },
        body: JSON.stringify({
          voice: voiceToPlay.name,
          input: textToPlay,
          skipCredits: true,
        }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setWaveform(data.waveform);
        setDuration(data.durationSec);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="demo" className="py-24 sm:py-32">
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0 space-y-6">
            <p className="text-muted-foreground flex items-center gap-2 text-[13px] font-medium">
              <Volume2 className="h-4 w-4" />
              {t("tts.badge")}
            </p>
            <h2 className="text-3xl leading-[1.1] font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              {t("tts.title")}
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-[17px]">
              {t("tts.subtitle")}
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-all"
              >
                {t("tts.start")}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/dashboard/voice-clones"
                className="bg-card text-foreground hover:opacity-85 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium shadow-xs ring-1 ring-black/[0.04] transition-all dark:ring-white/[0.06]"
              >
                <Mic className="h-4 w-4" />
                {t("tts.clone")}
              </Link>
            </div>
          </div>

          <div className="bg-card min-w-0 rounded-3xl p-5 shadow-sm ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {SHOWCASE_VOICES.map((voice) => {
                  const active = selectedVoice.id === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => selectVoice(voice)}
                      className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-left text-xs transition-all ${
                        active
                          ? "bg-foreground text-background font-semibold"
                          : "bg-foreground/[0.05] text-foreground hover:bg-foreground/[0.09]"
                      }`}
                    >
                      <VoiceOrb orb={voice.orb} size={18} />
                      <span>{voice.name}</span>
                      <span className="opacity-65 capitalize">· {voice.gender}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
              >
                {t("tts.explore")} ({voices.length}) →
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground text-xs font-medium">Script</span>
                <span className="text-muted-foreground text-xs">
                  {selectedVoice.name} · {selectedVoice.language}
                </span>
              </div>
              <textarea
                aria-label="Showcase voice script"
                value={script}
                onChange={(e) => setScript(e.target.value)}
                rows={4}
                className="bg-foreground/[0.03] border-border/60 focus:ring-foreground/15 w-full resize-none rounded-2xl border p-4 text-[14.5px] leading-relaxed outline-none focus:ring-2"
              />
            </div>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <WaveformPlayer
                  audioUrl={audioUrl}
                  waveform={waveform}
                  durationHint={duration}
                  autoPlay={true}
                  downloadName={`${selectedVoice.name.toLowerCase()}-sample.mp3`}
                />
              </div>
              <button
                type="button"
                onClick={() => generateSample()}
                disabled={loading || !script.trim()}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-all disabled:opacity-50"
              >
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                {loading ? "Synthesizing…" : "Play Voice"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <VoicePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedVoiceId={selectedVoice.id}
        onSelect={(v) => {
          selectVoice(v);
          setPickerOpen(false);
        }}
      />
    </section>
  );
}
