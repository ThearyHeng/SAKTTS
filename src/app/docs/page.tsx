"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Code2, Cpu, FileText, Search, Terminal, Zap } from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { ModalDialog } from "@/components/ui/modal-dialog";

const DOC_LINKS = [
  { href: "/docs", label: "Introduction", section: "Getting Started", desc: "Overview of SAKTTS Khmer & English Voice API" },
  { href: "/docs/quickstart", label: "Quick Start", section: "Getting Started", desc: "Generate your first audio file in 2 minutes" },
  { href: "/docs/api", label: "API Reference", section: "API Reference", desc: "OpenAI-compatible REST endpoints for speech, STT & voices" },
  { href: "/mcp", label: "MCP Server", section: "Resources", desc: "Connect Claude, ChatGPT, and Cursor via MCP" },
  { href: "/dashboard/settings", label: "Authentication & Keys", section: "Getting Started", desc: "Create and manage Bearer API tokens" },
];

export default function DocsPage() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = DOC_LINKS.filter(
    (d) =>
      d.label.toLowerCase().includes(query.toLowerCase()) ||
      d.desc.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="bg-workspace min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 pt-32 pb-24 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[240px_minmax(0,1fr)]">
          {/* Sidebar */}
          <aside className="space-y-6">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="bg-card border-border/70 text-muted-foreground flex h-10 w-full items-center justify-between rounded-full border px-4 text-xs"
            >
              <span className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5" /> Search docs…
              </span>
              <kbd className="bg-foreground/[0.06] rounded px-1.5 py-0.5 font-mono text-[10px]">
                ⌘K
              </kbd>
            </button>

            <div className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                  Getting Started
                </p>
                <ul className="space-y-1.5">
                  <li><Link href="/docs" className="font-semibold">Introduction</Link></li>
                  <li><Link href="/docs/quickstart" className="text-muted-foreground hover:text-foreground">Quick Start</Link></li>
                  <li><Link href="/dashboard/settings" className="text-muted-foreground hover:text-foreground">Authentication</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                  API Reference
                </p>
                <ul className="space-y-1.5">
                  <li><Link href="/docs/api" className="text-muted-foreground hover:text-foreground">Generate Speech</Link></li>
                  <li><Link href="/docs/api#transcriptions" className="text-muted-foreground hover:text-foreground">Transcriptions</Link></li>
                  <li><Link href="/docs/api#voices" className="text-muted-foreground hover:text-foreground">Available Voices</Link></li>
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-semibold uppercase tracking-wider">
                  Resources
                </p>
                <ul className="space-y-1.5">
                  <li><Link href="/mcp" className="text-muted-foreground hover:text-foreground">MCP Server</Link></li>
                  <li><Link href="/pricing" className="text-muted-foreground hover:text-foreground">Pricing</Link></li>
                </ul>
              </div>
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-8">
            <div>
              <p className="text-muted-foreground text-xs font-medium">Home / Documentation</p>
              <h1 className="mt-2 text-4xl font-semibold tracking-tight">Introduction</h1>
              <p className="text-muted-foreground mt-4 text-base leading-relaxed">
                Welcome to the SAKTTS API documentation. Our OpenAI-compatible API lets you
                generate natural Khmer and English speech, clone voices, and transcribe audio
                files with speaker diarization.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {[
                {
                  href: "/docs/quickstart",
                  icon: Zap,
                  title: "Quick Start",
                  desc: "Go from zero to a synthesized Khmer & English MP3 file in under two minutes.",
                },
                {
                  href: "/docs/api",
                  icon: Code2,
                  title: "API Reference",
                  desc: "Explore /v1/audio/speech, /v1/audio/transcriptions, and /v1/voices endpoints.",
                },
                {
                  href: "/mcp",
                  icon: Cpu,
                  title: "MCP Server",
                  desc: "Connect SAKTTS directly to Claude, ChatGPT, or Cursor.",
                },
                {
                  href: "/dashboard/settings",
                  icon: Terminal,
                  title: "Manage API Keys",
                  desc: "Create Bearer tokens and monitor credit consumption in your workspace.",
                },
              ].map((card) => {
                const Icon = card.icon;
                return (
                  <Link
                    key={card.title}
                    href={card.href}
                    className="bg-card hover:ring-foreground/20 rounded-3xl p-6 ring-1 ring-black/[0.04] transition-all dark:ring-white/[0.06]"
                  >
                    <Icon className="h-5 w-5" />
                    <h2 className="mt-4 text-lg font-semibold">{card.title}</h2>
                    <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
                      {card.desc}
                    </p>
                  </Link>
                );
              })}
            </div>

            <section id="faq" className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <BookOpen className="h-5 w-5" /> Frequently Asked Questions
              </h2>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="font-semibold">Is the API compatible with the OpenAI SDK?</p>
                  <p className="text-muted-foreground mt-1">
                    Yes. Point the OpenAI SDK <code>baseURL</code> to your local or hosted{" "}
                    <code>/api/v1</code> endpoint and supply your SAKTTS Bearer key.
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Can I mix Khmer and English in the same input?</p>
                  <p className="text-muted-foreground mt-1">
                    Yes! SAKTTS detects script transitions mid-sentence and speaks both Khmer and
                    English phrases naturally.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
      <Footer />

      <ModalDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        title="Search Documentation"
        maxWidthClass="max-w-lg"
      >
        <div className="space-y-3">
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search guides, endpoints, voices…"
            className="bg-foreground/[0.05] border-border/60 h-10 w-full rounded-full border px-4 text-sm outline-none"
          />
          <div className="space-y-1">
            {filtered.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSearchOpen(false)}
                className="hover:bg-foreground/[0.05] flex items-start gap-3 rounded-2xl p-3"
              >
                <FileText className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{item.label}</p>
                  <p className="text-muted-foreground text-xs">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
