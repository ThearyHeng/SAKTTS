"use client";

import React, { useState } from "react";
import { Loader2, ShieldCheck, Upload } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

interface DetectResult {
  fileName: string;
  aiLikelihoodScore: number;
  verdict: string;
  durationSec: number;
  metrics: {
    dynamicRangeDb: number;
    silenceRatio: number;
    spectralBalance: string;
    cadenceConsistency: number;
  };
}

export default function AiVoiceDetectorPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DetectResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/detect", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Detection failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to inspect file");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl px-4 pt-32 pb-24 sm:px-6">
        <div className="text-center">
          <p className="text-muted-foreground bg-card inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-xs">
            <ShieldCheck className="h-3.5 w-3.5" /> AI Voice Detector
          </p>
          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl">
            Verify Synthetic & Cloned Audio
          </h1>
          <p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-base leading-relaxed">
            Upload any audio clip to inspect dynamic range, micro-pause cadence, and spectral
            uniformity to estimate synthetic voice likelihood.
          </p>
        </div>

        <div className="bg-card mt-10 rounded-3xl p-8 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <label className="bg-foreground/[0.03] border-border/70 hover:bg-foreground/[0.05] flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-10 text-center transition-colors">
            <span className="bg-foreground text-background flex h-12 w-12 items-center justify-center rounded-full">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
            </span>
            <span className="text-sm font-semibold">
              {loading ? "Analyzing audio acoustics…" : "Drop or select an audio file (.mp3, .wav, .m4a, .webm)"}
            </span>
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

          {error && <p className="text-destructive mt-4 text-center text-sm">{error}</p>}

          {result && (
            <div className="mt-8 space-y-6">
              <div className="bg-foreground/[0.04] flex flex-col items-start justify-between gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
                <div>
                  <p className="text-muted-foreground text-xs">{result.fileName}</p>
                  <p className="mt-1 text-2xl font-semibold">{result.verdict}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="font-mono text-3xl font-semibold tabular-nums">
                    {result.aiLikelihoodScore}%
                  </p>
                  <p className="text-muted-foreground text-xs">Synthetic Acoustic Score</p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-4">
                {[
                  { label: "Duration", val: `${result.durationSec.toFixed(2)}s` },
                  { label: "Dynamic Range", val: `${result.metrics.dynamicRangeDb} dB` },
                  { label: "Micro-pause Ratio", val: `${result.metrics.silenceRatio}%` },
                  { label: "Cadence Uniformity", val: `${result.metrics.cadenceConsistency}%` },
                ].map((m) => (
                  <div key={m.label} className="bg-foreground/[0.03] rounded-2xl p-4">
                    <p className="text-muted-foreground text-xs">{m.label}</p>
                    <p className="mt-1 font-mono text-lg font-semibold">{m.val}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
