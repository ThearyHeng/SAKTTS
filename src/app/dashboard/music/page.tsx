"use client";

import React, { useState } from "react";
import { Loader2, Music, Sparkles } from "lucide-react";
import { useStudio } from "@/components/providers";
import { WaveformPlayer } from "@/components/waveform-player";

export default function MusicStudioPage() {
  const { refreshStore } = useStudio();
  const [prompt, setPrompt] = useState("Warm acoustic welcome jingle for a Cambodian podcast intro");
  const [mood, setMood] = useState<"warm" | "upbeat" | "ambient" | "cinematic">("warm");
  const [duration, setDuration] = useState(8);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[] | undefined>(undefined);
  const [actualDuration, setActualDuration] = useState(0);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mood, duration }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setWaveform(data.waveform);
        setActualDuration(data.durationSec);
        refreshStore();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Music & Jingles</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Generate warm harmonic background jingles and ambient soundbeds to pair with your voiceovers.
        </p>
      </div>

      <form
        onSubmit={handleGenerate}
        className="bg-card space-y-5 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
      >
        <div className="space-y-1.5">
          <label htmlFor="music-prompt" className="text-xs font-medium">
            Jingle Prompt
          </label>
          <textarea
            id="music-prompt"
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-foreground/[0.03] border-border/60 w-full resize-none rounded-2xl border p-4 text-sm outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <p className="text-xs font-medium">Mood</p>
            <div className="flex flex-wrap gap-1.5">
              {(["warm", "upbeat", "ambient", "cinematic"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMood(m)}
                  className={`rounded-full px-3.5 py-1.5 text-xs capitalize transition-colors ${
                    mood === m
                      ? "bg-foreground text-background font-semibold"
                      : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-medium">
              <span>Duration</span>
              <span className="font-mono">{duration}s</span>
            </div>
            <input
              type="range"
              min={4}
              max={20}
              step={2}
              value={duration}
              onChange={(e) => setDuration(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-primary text-primary-foreground inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Synthesizing Jingle…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" /> Generate Jingle
              </>
            )}
          </button>
        </div>
      </form>

      {audioUrl && (
        <div className="bg-card space-y-3 rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Music className="h-4 w-4" /> Generated Soundbed
          </p>
          <WaveformPlayer
            audioUrl={audioUrl}
            waveform={waveform}
            durationHint={actualDuration}
            autoPlay={true}
            downloadName={`saktts-jingle-${mood}.mp3`}
          />
        </div>
      )}
    </div>
  );
}
