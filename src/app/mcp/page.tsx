"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy, Cpu, Loader2, Play, Sparkles } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { WaveformPlayer } from "@/components/waveform-player";

export default function McpPage() {
  const [copied, setCopied] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const endpoint = "https://mcp.saktts.com/mcp";

  const playWelcome = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-saktts-client": "studio" },
        body: JSON.stringify({
          voice: "Maly",
          input: "សូមស្វាគមន៍មកកាន់ SAKTTS។",
          skipCredits: true,
        }),
      });
      const data = await res.json();
      if (data.audioUrl) setAudioUrl(data.audioUrl);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-12 px-4 pt-32 pb-24 sm:px-6">
        <section className="space-y-5 text-center">
          <p className="text-muted-foreground bg-card inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-xs">
            <Cpu className="h-3.5 w-3.5" /> MCP Server
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-6xl">
            SAKTTS inside Claude, ChatGPT, Cursor and other AI tools
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
            Connect your AI assistant to SAKTTS with one link. It can then speak Khmer and English in
            natural voices, transcribe recordings, write songs, and read the transcripts already in
            your account.
          </p>

          <div className="bg-card border-border/70 mx-auto flex max-w-md items-center justify-between gap-2 rounded-full border py-1.5 pr-1.5 pl-4">
            <code className="truncate font-mono text-xs">{endpoint}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(endpoint);
                setCopied(true);
                setTimeout(() => setCopied(false), 1800);
              }}
              className="bg-foreground text-background inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-muted-foreground text-xs">
            Free · Sign in with your SAKTTS account · Works with every plan
          </p>
        </section>

        {/* Interactive Conversation Mockup */}
        <section className="bg-card mx-auto max-w-3xl space-y-5 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Khmer welcome and a jingle</p>
            <Link
              href="/dashboard/music"
              className="text-muted-foreground hover:text-foreground text-xs font-medium"
            >
              Try Music Studio →
            </Link>
          </div>

          <div className="space-y-3 text-sm">
            <div className="bg-foreground/[0.05] ml-auto max-w-lg rounded-2xl p-3.5">
              <p>Read this welcome in Khmer, in Maly’s voice:</p>
              <p className="mt-1 font-medium">សូមស្វាគមន៍មកកាន់ SAKTTS។</p>
            </div>

            <div className="bg-foreground/[0.03] border-border/60 space-y-3 rounded-2xl border p-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono font-semibold">SAKTTS › text_to_speech</span>
                <button
                  type="button"
                  onClick={playWelcome}
                  className="bg-foreground text-background inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-semibold"
                >
                  {loading ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 fill-current" />
                  )}
                  Run Tool
                </button>
              </div>
              {audioUrl && <WaveformPlayer audioUrl={audioUrl} autoPlay={true} compact={true} />}
              <p className="text-muted-foreground text-xs">
                Here it is in Maly’s voice — ready to download.
              </p>
            </div>

            <div className="bg-foreground/[0.05] ml-auto max-w-lg rounded-2xl p-3.5">
              <p className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Now write a short, warm jingle to go under it.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
