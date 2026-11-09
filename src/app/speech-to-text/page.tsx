import React from "react";
import Link from "next/link";
import { AudioLines } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { SttShowcase } from "@/components/landing/stt-showcase";

export default function SpeechToTextPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="pt-28 pb-20">
        <section className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-muted-foreground inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium shadow-xs">
            <AudioLines className="h-3.5 w-3.5" /> Speech to Text
          </p>
          <h1 className="mt-6 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-6xl">
            Turn Audio into Accurate Text
          </h1>
          <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-lg leading-relaxed">
            Upload a recording or record in the browser and get back a timestamped transcript you
            can edit, label by speaker, and export as subtitles.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/dashboard/speech-to-text"
              className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold"
            >
              Start transcribing free
            </Link>
            <Link
              href="/docs/api"
              className="bg-card text-foreground inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            >
              View the API
            </Link>
          </div>
        </section>

        <SttShowcase />
      </main>
      <Footer />
    </div>
  );
}
