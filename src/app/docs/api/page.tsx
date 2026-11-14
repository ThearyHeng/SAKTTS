import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const ENDPOINTS = [
  {
    group: "Speech",
    items: [
      {
        method: "POST",
        path: "/api/v1/audio/speech",
        desc: "Generate MP3 or WAV audio from Khmer, English, or mixed text. Returns binary audio bytes.",
      },
    ],
  },
  {
    group: "Transcription",
    items: [
      {
        method: "POST",
        path: "/api/v1/audio/transcriptions",
        desc: "Upload audio (MP3, WAV, M4A, WEBM) and receive timestamped speaker-diarized segments.",
      },
    ],
  },
  {
    group: "Voices & Clones",
    items: [
      {
        method: "GET",
        path: "/api/v1/voices",
        desc: "List all built-in Khmer/English voices and your custom cloned/designed voices.",
      },
      {
        method: "POST",
        path: "/api/voice-clones",
        desc: "Create an instant voice clone from a reference clip or design a new voice from a text prompt.",
      },
    ],
  },
];

export default function ApiReferencePage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-8 px-4 pt-32 pb-24 sm:px-6">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            <Link href="/docs" className="hover:underline">Documentation</Link> / API Reference
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">API Reference</h1>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            An OpenAI-compatible REST API for speech, transcription, and voices. Point an existing
            client at our base URL and it works out of the box.
          </p>
        </div>

        <div className="bg-card space-y-3 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <h2 className="text-lg font-semibold">Base URL & Authentication</h2>
          <pre className="bg-foreground/[0.04] rounded-2xl p-4 font-mono text-xs leading-relaxed">
{`Base URL:      http://localhost:3800/api/v1
Authorization: Bearer YOUR_API_KEY`}
          </pre>
        </div>

        {ENDPOINTS.map((group) => (
          <div
            key={group.group}
            id={group.group.toLowerCase().includes("voice") ? "voices" : "transcriptions"}
            className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
          >
            <h2 className="text-xl font-semibold">{group.group}</h2>
            <div className="divide-border/50 divide-y">
              {group.items.map((ep) => (
                <div key={ep.path} className="space-y-1.5 py-4 first:pt-1 last:pb-1">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="bg-foreground text-background rounded-full px-2.5 py-0.5 font-mono text-[11px] font-semibold">
                      {ep.method}
                    </span>
                    <code className="font-mono text-sm font-semibold">{ep.path}</code>
                  </div>
                  <p className="text-muted-foreground text-sm">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>
      <Footer />
    </div>
  );
}
