import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function AboutPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-4xl space-y-14 px-4 pt-32 pb-24 sm:px-6">
        <section className="space-y-5">
          <p className="text-muted-foreground bg-card inline-flex rounded-full px-3.5 py-1 text-xs font-medium">
            A Blizzer product
          </p>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-6xl">
            Voice AI that speaks Khmer first.
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed">
            SAKTTS is a voice platform built in Phnom Penh. We make text to speech, transcription and
            voice cloning for a language most speech tools were never trained to handle.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/dashboard"
              className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-full px-6 text-sm font-semibold"
            >
              Try for Free
            </Link>
            <Link
              href="/contact"
              className="bg-card inline-flex h-11 items-center rounded-full px-6 text-sm font-medium ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            >
              Talk to us
            </Link>
          </div>
        </section>

        <section className="bg-card space-y-4 rounded-3xl p-6 sm:p-8">
          <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            Why we started
          </p>
          <h2 className="text-2xl font-semibold">A language the big models skipped</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Khmer writes without spaces between words, stacks its consonants, and has far less
            public training data than English. Speech tools built elsewhere treat it as an
            afterthought, when they support it at all. Cambodians heard robotic voices and read
            transcripts full of guesses.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            SAKTTS exists to close that gap. English and other languages work too. Khmer is simply
            the one we refuse to get wrong.
          </p>
        </section>

        <section className="bg-card flex flex-col justify-between gap-6 rounded-3xl p-6 sm:flex-row sm:items-center sm:p-8">
          <div>
            <p className="text-muted-foreground text-xs font-medium">Our parent company</p>
            <h2 className="mt-1 text-xl font-semibold">SAKTTS is part of Blizzer</h2>
            <p className="text-muted-foreground mt-2 max-w-lg text-sm">
              Blizzer is an AI company in Phnom Penh building for Cambodia and the region. Find us
              in Toul Kork, Phnom Penh, Cambodia.
            </p>
          </div>
          <Link
            href="/contact"
            className="bg-foreground/[0.07] hover:bg-foreground/[0.12] shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold"
          >
            Contact Phnom Penh Office
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
