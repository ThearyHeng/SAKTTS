import React from "react";
import Link from "next/link";
import { AudioLines, Languages, Mic, Puzzle, SpellCheck, Volume2 } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";

export default function ExtensionPage() {
  const shortcuts = [
    { key: "Alt+T", desc: "Translate the current selection" },
    { key: "Alt+R", desc: "Read the current selection aloud" },
    { key: "Alt+V", desc: "Start or stop voice typing" },
    { key: "Alt+G", desc: "Check grammar in the current field" },
  ];

  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-5xl space-y-16 px-4 pt-32 pb-24 sm:px-6">
        <section className="space-y-6 text-center">
          <p className="text-muted-foreground bg-card inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium shadow-xs">
            <Puzzle className="h-3.5 w-3.5" /> Chrome Extension
          </p>
          <h1 className="mx-auto max-w-3xl text-4xl leading-[1.08] font-semibold tracking-[-0.03em] sm:text-6xl">
            SAKTTS on every page you read and write
          </h1>
          <p className="text-muted-foreground mx-auto max-w-2xl text-lg leading-relaxed">
            Highlight a sentence to translate it, catch spelling and grammar mistakes as you type,
            hear it in a natural voice, dictate into any text field, or transcribe what you record
            — without leaving the tab.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <a
              href="https://chromewebstore.google.com/detail/cmgbfhodhjmpgnkhjmjgalagmmmhbobg"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-primary text-primary-foreground inline-flex h-11 items-center rounded-full px-6 text-[15px] font-semibold"
            >
              Add to Chrome
            </a>
            <Link
              href="/dashboard"
              className="bg-card text-foreground inline-flex h-11 items-center rounded-full px-6 text-[15px] font-medium ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            >
              Open Web Studio
            </Link>
          </div>
          <p className="text-muted-foreground text-xs">
            Free · Chrome 116 and newer · Runs on your own SAKTTS account
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            {
              icon: Languages,
              title: "Highlight to translate",
              desc: "Select text on any page and open a translation card beside the original — with Latin-script reading for Khmer.",
            },
            {
              icon: SpellCheck,
              title: "Check your writing",
              desc: "Spelling, grammar and punctuation underlines as you type in Khmer and English, leaving mixed writing alone where right.",
            },
            {
              icon: Volume2,
              title: "Read it aloud",
              desc: "Play any translation or paragraph in any voice on your account, cloned voices included.",
            },
            {
              icon: Mic,
              title: "Type with your voice",
              desc: "A microphone button inside comment boxes, forms, webmail, and web editors.",
            },
            {
              icon: AudioLines,
              title: "Transcribe in the side panel",
              desc: "Record, drop an audio file, or stream live with SRT export and Pro mode.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="bg-card rounded-3xl p-6">
                <span className="bg-foreground/[0.06] grid h-10 w-10 place-items-center rounded-2xl">
                  <Icon className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-semibold">{item.title}</h2>
                <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">{item.desc}</p>
              </div>
            );
          })}
        </section>

        <section className="bg-card rounded-3xl p-6 sm:p-8">
          <h2 className="text-xl font-semibold">Without touching the mouse</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            On a Mac, use Ctrl+Shift with the same letter. Rebind any shortcut from{" "}
            <code>chrome://extensions/shortcuts</code>.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {shortcuts.map((s) => (
              <div
                key={s.key}
                className="bg-foreground/[0.04] flex items-center justify-between rounded-2xl p-4"
              >
                <span className="text-sm font-medium">{s.desc}</span>
                <kbd className="bg-card rounded-lg px-2.5 py-1 font-mono text-xs font-semibold shadow-xs">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
