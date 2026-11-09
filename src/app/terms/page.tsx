import React from "react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function TermsPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-32 pb-24 sm:px-6">
        <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
        <div className="bg-card text-muted-foreground space-y-4 rounded-3xl p-6 text-sm leading-relaxed sm:p-8">
          <p>
            By using SAKTTS for text-to-speech, speech-to-text, or voice cloning, you agree to
            use synthetic audio responsibly and never impersonate individuals without explicit
            authorization.
          </p>
          <p>
            Commercial usage rights apply on Basic, Starter, Studio, Studio Max, Team, and
            Enterprise plans.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  );
}
