import React from "react";
import Link from "next/link";
import { AudioLines, Bell, Mic, Smartphone, Volume2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function DownloadPage() {
  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-16 px-4 pt-32 pb-24 sm:px-6">
        <section className="space-y-6 text-center">
          <p className="text-muted-foreground bg-card inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-xs">
            <Smartphone className="h-3.5 w-3.5" /> Mobile App
          </p>
          <h1 className="text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-6xl">
            SAKTTS on your phone
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
            Turn text into natural speech, transcribe recordings and clone voices from your phone —
            with a notification the moment your audio is ready.
          </p>

          <div className="flex flex-wrap justify-center gap-3">
            <div className="bg-card border-border/60 rounded-2xl border px-5 py-3 text-left">
              <p className="text-muted-foreground text-[11px]">Download on the</p>
              <p className="text-sm font-semibold">App Store · Coming soon</p>
            </div>
            <div className="bg-card border-border/60 rounded-2xl border px-5 py-3 text-left">
              <p className="text-muted-foreground text-[11px]">Get it on</p>
              <p className="text-sm font-semibold">Google Play · Coming soon</p>
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            The iPhone and Android apps are coming soon. Until then, SAKTTS works in any phone
            browser as an installable web app.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Volume2, title: "Text to Speech", desc: "Paste a script and hear it in a natural Khmer or English voice." },
            { icon: AudioLines, title: "Speech to Text", desc: "Upload or record audio and get a timestamped transcript." },
            { icon: Mic, title: "Voice Cloning", desc: "Record a short clip and speak any script in that voice." },
            { icon: Bell, title: "Ready when you are", desc: "Start a generation and get notified the moment it is done." },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-card rounded-3xl p-6">
                <Icon className="h-5 w-5" />
                <h2 className="mt-4 text-base font-semibold">{item.title}</h2>
                <p className="text-muted-foreground mt-1.5 text-sm">{item.desc}</p>
              </div>
            );
          })}
        </section>

        <section className="bg-card space-y-6 rounded-3xl p-6 sm:p-8">
          <div>
            <h2 className="text-2xl font-semibold">Use it on your phone today</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Add the web app to your home screen and it opens full screen, like an installed app.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            {[
              { step: "01", title: "Open SAKTTS", desc: "In Chrome on Android or Safari on iPhone." },
              { step: "02", title: "Open Studio", desc: "Use your existing account or try straight away." },
              { step: "03", title: "Add to Home Screen", desc: "From the browser menu on Android, or Share on iPhone." },
            ].map((s) => (
              <div key={s.step} className="bg-foreground/[0.04] rounded-2xl p-5">
                <span className="font-mono text-xs font-semibold opacity-60">{s.step}</span>
                <p className="mt-2 font-semibold">{s.title}</p>
                <p className="text-muted-foreground mt-1 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>

          <div>
            <Link
              href="/dashboard"
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-full px-6 text-sm font-semibold"
            >
              Launch Web App →
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
