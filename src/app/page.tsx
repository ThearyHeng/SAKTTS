import React from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { HeroGridSvg } from "@/components/landing/hero-grid-svg";
import { HeroPlayground } from "@/components/landing/hero-playground";
import { PartnerMarquee } from "@/components/landing/marquee";
import { BentoFeatures } from "@/components/landing/bento-features";
import { TtsShowcase } from "@/components/landing/tts-showcase";
import { SttShowcase } from "@/components/landing/stt-showcase";
import { PricingSection } from "@/components/landing/pricing-section";

export default function HomePage() {
  return (
    <div className="bg-workspace min-h-screen font-sans">
      <Navbar />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden pt-32 pb-20 lg:pt-44 lg:pb-28">
          <HeroGridSvg />
          <HeroPlayground />
        </section>

        {/* Partner Marquee */}
        <PartnerMarquee />

        {/* Bento Features */}
        <BentoFeatures />

        {/* Text to Speech Showcase */}
        <TtsShowcase />

        {/* Speech to Text Showcase */}
        <SttShowcase />

        {/* Pricing + Comparison Table */}
        <PricingSection showCompare={true} />

        {/* Final CTA */}
        <section className="relative overflow-hidden py-24 sm:py-32">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:24px_24px]" />
          <div className="relative z-10 mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="mb-10 text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl">
              Ready to build the future of audio experiences?
            </h2>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-[15px] font-semibold transition-all sm:w-auto"
              >
                Start Building Now
              </Link>
              <Link
                href="/contact"
                className="bg-card text-foreground hover:opacity-85 inline-flex h-12 w-full items-center justify-center rounded-full px-7 text-[15px] font-medium shadow-xs ring-1 ring-black/[0.04] transition-all sm:w-auto dark:ring-white/[0.06]"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
