"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

const CODE_EXAMPLES = {
  curl: `curl http://localhost:3000/api/v1/audio/speech \\
  -H "Authorization: Bearer saktts_live_demo_9f8a7c6b5e4d3c2b1a0f" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "saktts",
    "input": "សួស្តី ពិភពលោក! Hello, world!",
    "voice": "Maly",
    "response_format": "mp3"
  }' \\
  --output speech.mp3`,
  javascript: `import { writeFile } from "node:fs/promises";
import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.SAKTTS_API_KEY,
  baseURL: "http://localhost:3000/api/v1",
});

const speech = await client.audio.speech.create({
  model: "saktts",
  voice: "Maly",
  input: "សួស្តី ពិភពលោក! Hello, world!",
});

await writeFile("speech.mp3", Buffer.from(await speech.arrayBuffer()));`,
  python: `from openai import OpenAI

client = OpenAI(
    api_key="YOUR_SAKTTS_API_KEY",
    base_url="http://localhost:3000/api/v1",
)

with client.audio.speech.with_streaming_response.create(
    model="saktts",
    voice="Maly",
    input="សួស្តី ពិភពលោក! Hello, world!",
) as response:
    response.stream_to_file("speech.mp3")`,
};

export default function QuickStartPage() {
  const [lang, setLang] = useState<"curl" | "javascript" | "python">("curl");
  const [copied, setCopied] = useState(false);

  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-8 px-4 pt-32 pb-24 sm:px-6">
        <div>
          <p className="text-muted-foreground text-xs font-medium">
            <Link href="/docs" className="hover:underline">Documentation</Link> / Quick Start
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">Quick Start</h1>
          <p className="text-muted-foreground mt-3 text-base leading-relaxed">
            From nothing to a generated audio file in about two minutes. Every example below works
            against this app’s local <code>/api/v1</code> server.
          </p>
        </div>

        <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <span className="bg-foreground text-background inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            1
          </span>
          <h2 className="text-xl font-semibold">Create an API key</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Open the API keys page in your studio settings and create a token. Keep it on your
            server — never embed secret keys in public client code.
          </p>
          <Link
            href="/dashboard/settings"
            className="bg-foreground/[0.07] hover:bg-foreground/[0.12] inline-flex h-9 items-center rounded-full px-4 text-xs font-semibold"
          >
            Open API Keys →
          </Link>
        </div>

        <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="bg-foreground text-background inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                2
              </span>
              <h2 className="text-xl font-semibold">Generate your first audio</h2>
            </div>

            <div className="flex items-center gap-2">
              <div className="bg-foreground/[0.06] flex rounded-full p-1">
                {(["curl", "javascript", "python"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setLang(tab)}
                    className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
                      lang === tab ? "bg-card font-semibold shadow-xs" : "text-muted-foreground"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(CODE_EXAMPLES[lang]);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="bg-foreground/[0.06] inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>

          <p className="text-muted-foreground text-sm">
            The response body is the raw MP3/WAV audio file itself, ready to save or stream.
          </p>

          <pre className="bg-foreground/[0.04] overflow-x-auto rounded-2xl p-4 font-mono text-xs leading-relaxed">
            {CODE_EXAMPLES[lang]}
          </pre>
        </div>
      </main>
      <Footer />
    </div>
  );
}
