import React from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function PrivacyPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-32 pb-24 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
        <div className="bg-card text-muted-foreground space-y-4 rounded-3xl p-6 text-sm leading-relaxed sm:p-8">
          <p>
            SAKTTS stores your voice clones, generated speech audio, and transcripts locally in
            your workspace (<code>.saktts-data/</code>) so your studio assets remain under your
            control.
          </p>
          <p>
            Only upload or record reference audio samples that you own or have explicit consent to
            clone. You may delete any custom voice profile or audio history entry at any time from
            your dashboard.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
