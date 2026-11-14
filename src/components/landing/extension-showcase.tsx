"use client";

import React from "react";
import Link from "next/link";
import {
  AudioLines,
  CheckCheck,
  Languages,
  Mic,
  Puzzle,
  SpellCheck,
  Volume2,
} from "lucide-react";
import { useLanguage } from "@/components/providers";

export function ExtensionShowcase() {
  const { t } = useLanguage();

  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-14">
          <div className="min-w-0 space-y-6">
            <p className="text-muted-foreground flex items-center gap-2 text-[13px] font-medium">
              <Puzzle className="h-4 w-4" />
              {t("ext.badge")}
            </p>
            <h2 className="text-3xl leading-[1.1] font-semibold tracking-[-0.03em] sm:text-4xl lg:text-5xl">
              {t("ext.title")}
            </h2>
            <p className="text-muted-foreground text-[15px] leading-relaxed sm:text-[17px]">
              {t("ext.subtitle")}
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link
                href="/dashboard"
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center rounded-full px-6 text-[15px] font-semibold transition-all"
              >
                Open Web Studio
              </Link>
            </div>
            <p className="text-muted-foreground text-[13px] leading-relaxed">
              Free to install, and any SAKTTS plan works — the free one included. Translation and
              grammar checks are free for the first 100 a day.
            </p>
          </div>

          {/* Interactive Chrome Extension Preview UI */}
          <div className="bg-card overflow-hidden rounded-3xl p-4 shadow-sm ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]">
            <div className="bg-foreground/[0.03] border-border/60 rounded-2xl border p-4 sm:p-5">
              <div className="border-border/50 mb-4 flex items-center justify-between border-b pb-3">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                </div>
                <span className="bg-card text-muted-foreground rounded-full px-3 py-1 font-mono text-[11px]">
                  SAKTTS Voice & Translate · Alt+T
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="bg-card rounded-2xl p-4 shadow-xs">
                  <span className="text-muted-foreground text-[11px] font-medium uppercase">
                    Original · Khmer
                  </span>
                  <p className="mt-2 text-sm leading-relaxed">
                    <mark className="bg-foreground/10 text-foreground rounded px-1">
                      សូមស្វាគមន៍មកកាន់បច្ចេកវិទ្យាសំឡេង AI ជំនាន់ថ្មី។
                    </mark>
                  </p>
                  <p className="text-muted-foreground mt-2 font-mono text-[11px]">
                    Soum svakom mok kan bachekvitya samleng AI jumnan thmei.
                  </p>
                </div>
                <div className="bg-card rounded-2xl p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-[11px] font-medium uppercase">
                      Translation · English
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
                      <CheckCheck className="h-3 w-3" /> Grammar OK
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed">
                    Welcome to the next generation of AI voice technology.
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href="/dashboard"
                      className="bg-foreground text-background inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
                    >
                      <Volume2 className="h-3 w-3" /> Read aloud
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <ul className="bg-card mt-16 grid grid-cols-1 gap-x-8 gap-y-7 rounded-3xl p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-5">
          {[
            {
              icon: Languages,
              title: "Highlight to translate",
              desc: "Select text anywhere and a card opens with the translation beside the original.",
            },
            {
              icon: SpellCheck,
              title: "Check your writing",
              desc: "Spelling and grammar mistakes underlined as you type, in Khmer and English — click to fix.",
            },
            {
              icon: Volume2,
              title: "Read it aloud",
              desc: "Any voice on your account, cloned ones included, with a player that stays put.",
            },
            {
              icon: Mic,
              title: "Type with your voice",
              desc: "A microphone in every text field — comment boxes, forms and web editors.",
            },
            {
              icon: AudioLines,
              title: "Transcribe in the side panel",
              desc: "Record, upload or stream live, export as SRT — with Pro mode for hard audio.",
            },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.title} className="min-w-0">
                <span className="bg-foreground/[0.07] text-foreground/80 grid h-9 w-9 place-items-center rounded-full">
                  <Icon className="h-4 w-4" />
                </span>
                <p className="mt-3.5 text-[15px] font-semibold">{item.title}</p>
                <p className="text-muted-foreground mt-1 text-[14px] leading-relaxed">
                  {item.desc}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
