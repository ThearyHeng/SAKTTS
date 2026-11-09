import React from "react";
import Link from "next/link";
import { Globe, Mic, Sparkles, Terminal, Volume2, Zap } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { TtsShowcase } from "@/components/landing/tts-showcase";

export default function TextToSpeechPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="pt-28 pb-20">
        <section className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-muted-foreground inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium shadow-xs">
            <Volume2 className="h-3.5 w-3.5" /> Text to Speech
          </p>
          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-6xl">
            Turn Text into Natural Speech
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed">
            Generate high-quality audio from any text in seconds. Multiple voices, expressive
            delivery, instant download.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard"
              className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold"
            >
              Try for Free
            </Link>
            <Link
              href="/dashboard"
              className="bg-card text-foreground inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            >
              Open Dashboard
            </Link>
          </div>
        </section>

        <TtsShowcase />

        <section className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mb-10 max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight">
              Everything you need for AI voice generation
            </h2>
            <p className="text-muted-foreground mt-2 text-base">
              Natural voices, voice cloning, API access, and audio you can use anywhere — all in one
              platform.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: Zap,
                title: "Instant generation",
                desc: "Audio comes back in seconds, not minutes. Built to hold up when you are generating at volume.",
              },
              {
                icon: Globe,
                title: "Khmer and English",
                desc: "Purpose-built for Khmer pronunciation, with natural English alongside it and seamless mid-sentence switching.",
              },
              {
                icon: Mic,
                title: "Voice cloning",
                desc: "Clone a voice from about ten seconds of clear audio and reuse it as a saved profile.",
              },
              {
                icon: Sparkles,
                title: "Expressive delivery",
                desc: "Voices that adapt to context instead of reading flat — calm, warm, or authoritative as the text needs.",
              },
              {
                icon: Terminal,
                title: "REST API",
                desc: "Generate speech from your own code. Full documentation with JavaScript, Python and curl examples.",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="bg-card rounded-3xl p-6">
                  <span className="bg-foreground/[0.06] grid h-10 w-10 place-items-center rounded-2xl">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-lg font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
