import React from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { PricingSection } from "@/components/landing/pricing-section";

const FAQS = [
  {
    q: "How does the shared credit pool work?",
    a: "Every plan includes one unified credit pool that covers text-to-speech synthesis, speech-to-text transcription, and custom voice cloning.",
  },
  {
    q: "How much audio do I need to clone a voice?",
    a: "Just 10 seconds of clear speech without heavy background noise is enough to create an instant voice clone.",
  },
  {
    q: "Can I use generated audio commercially?",
    a: "Yes — Basic, Starter, Studio, Studio Max, Team, and Enterprise plans include commercial usage rights.",
  },
  {
    q: "Can I cancel or switch plans anytime?",
    a: "Yes, plans update immediately with no lock-in or cancellation fees.",
  },
];

export default function PricingPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="pt-16">
        <PricingSection showCompare={true} />

        <section id="faq" className="mx-auto max-w-4xl px-4 pb-24 sm:px-6">
          <h2 className="mb-8 text-center text-3xl font-semibold tracking-tight">Pricing FAQ</h2>
          <div className="space-y-3">
            {FAQS.map((item) => (
              <details
                key={item.q}
                className="bg-card group rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
              >
                <summary className="cursor-pointer list-none text-base font-semibold">
                  {item.q}
                </summary>
                <p className="text-muted-foreground mt-3 text-sm leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
