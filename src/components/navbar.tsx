"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  Globe,
  Menu,
  Moon,
  Sun,
  X,
  Volume2,
  AudioLines,
  Mic,
  ShieldCheck,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { useLanguage, useTheme } from "./providers";

export function Navbar() {
  const { locale, setLocale, t } = useLanguage();
  const { toggleTheme } = useTheme();
  const [productsOpen, setProductsOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const productItems = [
    {
      href: "/text-to-speech",
      label: "Text to Speech",
      desc: "Natural Khmer & English speech synthesis",
      icon: Volume2,
    },
    {
      href: "/speech-to-text",
      label: "Speech to Text",
      desc: "Accurate transcripts & subtitle exports",
      icon: AudioLines,
    },
    {
      href: "/dashboard/voice-clones",
      label: "Voice Cloning & Design",
      desc: "Clone from 10s audio or design via prompt",
      icon: Mic,
    },
    {
      href: "/ai-voice-detector",
      label: "AI Voice Detector",
      desc: "Check acoustic authenticity of audio clips",
      icon: ShieldCheck,
    },
    {
      href: "/extension",
      label: "Chrome Extension",
      desc: "Translate, grammar-check & read aloud anywhere",
      icon: Puzzle,
    },
    {
      href: "/dashboard/music",
      label: "Audio & Music Studio",
      desc: "Generate ambient jingles & soundbeds",
      icon: Sparkles,
    },
  ];

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3 transition-all duration-300 sm:top-4 sm:px-4">
      <nav
        aria-label="Primary"
        className="bg-card/80 mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full pr-2 pl-4 shadow-[0_4px_16px_-4px_rgba(0,0,0,0.16)] ring-1 ring-black/[0.04] backdrop-blur-xl dark:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.75)] dark:ring-white/[0.06]"
      >
        <Link
          href="/"
          aria-label="Go to homepage"
          className="group flex shrink-0 items-center gap-2"
        >
          <span className="transition-transform duration-300 group-hover:scale-105">
            <span className="relative flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-xl">
              <img
                src="/logo.svg"
                alt="SAKTTS Logo"
                className="h-full w-full object-cover dark:invert"
              />
            </span>
          </span>
          <span className="text-[17px] font-semibold tracking-tight">{t("brand")}</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-0.5 md:flex">
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setProductsOpen((v) => !v);
                setLangOpen(false);
              }}
              aria-expanded={productsOpen}
              className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center gap-1 rounded-full px-3.5 text-[14px] font-medium transition-colors"
            >
              {t("nav.products")}
              <ChevronDown
                className={`h-3.5 w-3.5 opacity-60 transition-transform ${
                  productsOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {productsOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setProductsOpen(false)}
                />
                <div className="bg-popover text-popover-foreground border-border/70 absolute top-12 left-0 z-50 w-[340px] rounded-3xl border p-2 shadow-2xl backdrop-blur-xl">
                  {productItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setProductsOpen(false)}
                        className="hover:bg-foreground/[0.05] flex items-start gap-3 rounded-2xl p-2.5 transition-colors"
                      >
                        <span className="bg-foreground/[0.06] text-foreground mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13.5px] font-semibold">
                            {item.label}
                          </span>
                          <span className="text-muted-foreground block text-[12px] leading-snug">
                            {item.desc}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          <Link
            href="/#features"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium transition-colors"
          >
            {t("nav.features")}
          </Link>
          <Link
            href="/#demo"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium transition-colors"
          >
            {t("nav.demo")}
          </Link>
          <Link
            href="/pricing"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium transition-colors"
          >
            {t("nav.pricing")}
          </Link>
          <Link
            href="/docs"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium transition-colors"
          >
            {t("nav.api")}
          </Link>
          <Link
            href="/mcp"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium transition-colors"
          >
            {t("nav.mcp")}
          </Link>
          <Link
            href="/download"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-9 items-center rounded-full px-3.5 text-[14px] font-medium transition-colors"
          >
            {t("nav.download")}
          </Link>
        </div>

        {/* Right actions */}
        <div className="hidden items-center gap-1.5 md:flex">
          <div className="bg-foreground/[0.05] relative flex h-10 items-center gap-0.5 rounded-full p-0.5">
            <button
              type="button"
              aria-label="Language"
              onClick={() => {
                setLangOpen((v) => !v);
                setProductsOpen(false);
              }}
              className="text-muted-foreground hover:bg-hover hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            >
              <Globe className="h-4 w-4" />
            </button>

            {langOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setLangOpen(false)}
                />
                <div className="bg-popover border-border/70 absolute top-12 right-0 z-50 w-40 rounded-2xl border p-1.5 shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setLocale("en");
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                      locale === "en"
                        ? "bg-foreground text-background font-semibold"
                        : "hover:bg-foreground/[0.05]"
                    }`}
                  >
                    <span>English</span>
                    <span className="text-[11px] opacity-70">EN</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLocale("km");
                      setLangOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] transition-colors ${
                      locale === "km"
                        ? "bg-foreground text-background font-semibold"
                        : "hover:bg-foreground/[0.05]"
                    }`}
                  >
                    <span>ភាសាខ្មែរ</span>
                    <span className="text-[11px] opacity-70">KM</span>
                  </button>
                </div>
              </>
            )}

            <button
              type="button"
              onClick={toggleTheme}
              className="text-muted-foreground hover:bg-hover hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full transition-colors"
            >
              <span className="hidden dark:inline-flex">
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Switch to light theme</span>
              </span>
              <span className="inline-flex dark:hidden">
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">Switch to dark theme</span>
              </span>
            </button>
          </div>

          <Link
            href="/auth/login"
            className="text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground flex h-10 items-center rounded-full px-4 text-[14px] font-medium transition-colors"
          >
            {t("nav.login")}
          </Link>

          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground hover:bg-primary/90 flex h-10 items-center rounded-full px-5 text-[14px] font-semibold transition-all active:scale-[0.98]"
          >
            {t("nav.tryFree")}
          </Link>
        </div>

        {/* Mobile actions */}
        <div className="flex items-center gap-1.5 md:hidden">
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "km" : "en")}
            aria-label="Switch language"
            className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full"
          >
            <Globe className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className="text-muted-foreground hover:text-foreground flex h-9 w-9 items-center justify-center rounded-full"
          >
            <span className="hidden dark:inline-flex">
              <Sun className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Switch to light theme</span>
            </span>
            <span className="inline-flex dark:hidden">
              <Moon className="h-4 w-4" aria-hidden="true" />
              <span className="sr-only">Switch to dark theme</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            className="text-foreground bg-foreground/[0.06] flex h-9 w-9 items-center justify-center rounded-full"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu panel */}
      {mobileOpen && (
        <div className="bg-card/95 border-border/70 mx-auto mt-2 max-w-6xl rounded-3xl border p-4 shadow-xl backdrop-blur-xl md:hidden">
          <div className="grid gap-1">
            {[
              { href: "/text-to-speech", label: "Text to Speech" },
              { href: "/speech-to-text", label: "Speech to Text" },
              { href: "/dashboard/voice-clones", label: "Voice Cloning & Design" },
              { href: "/ai-voice-detector", label: "AI Voice Detector" },
              { href: "/pricing", label: "Pricing" },
              { href: "/docs", label: "API Docs" },
              { href: "/mcp", label: "MCP Server" },
              { href: "/extension", label: "Chrome Extension" },
              { href: "/download", label: "Mobile App" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="hover:bg-foreground/[0.05] rounded-2xl px-3.5 py-2.5 text-[15px] font-medium"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="border-border/60 mt-3 grid grid-cols-2 gap-2 border-t pt-3">
            <Link
              href="/auth/login"
              onClick={() => setMobileOpen(false)}
              className="bg-foreground/[0.06] flex h-11 items-center justify-center rounded-full text-[14px] font-medium"
            >
              {t("nav.login")}
            </Link>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="bg-primary text-primary-foreground flex h-11 items-center justify-center rounded-full text-[14px] font-semibold"
            >
              {t("nav.tryFree")}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
