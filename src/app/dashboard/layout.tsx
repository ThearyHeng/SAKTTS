"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  AudioLines,
  ArrowLeft,
  Coins,
  Globe,
  Library,
  Mic,
  Moon,
  Music,
  Settings,
  Sun,
  Volume2,
} from "lucide-react";
import { useLanguage, useStudio, useTheme } from "@/components/providers";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Text to Speech", icon: Volume2 },
  { href: "/dashboard/voice-cloning", label: "Voice Cloning", icon: Mic },
  { href: "/dashboard/speech-to-text", label: "Speech to Text", icon: AudioLines },
  { href: "/dashboard/voice-clones", label: "Voice Library", icon: Library },
  { href: "/dashboard/music", label: "Music & Jingles", icon: Music },
  { href: "/dashboard/settings", label: "Settings & API", icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { creditsBalance, creditsLimit, plan } = useStudio();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { locale, setLocale } = useLanguage();

  const pct = Math.min(100, Math.round((creditsBalance / Math.max(1, creditsLimit)) * 100));

  return (
    <div className="bg-workspace flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-64 shrink-0 flex-col border-r lg:flex">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg">
              <img src="/logo.svg" alt="SAKTTS" className="h-full w-full dark:invert" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">SAKTTS Studio</span>
          </Link>
          <Link
            href="/"
            aria-label="Back to website"
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>

        <nav aria-label="Studio navigation" className="flex-1 space-y-1 px-3 py-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex h-10 items-center gap-3 rounded-2xl px-3.5 text-[14px] transition-colors ${
                  active
                    ? "bg-foreground text-background font-semibold"
                    : "text-muted-foreground hover:bg-foreground/[0.05] hover:text-foreground font-medium"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Credits + Quick Toggles */}
        <div className="border-sidebar-border space-y-3 border-t p-3">
          <div className="bg-card border-border/60 rounded-2xl border p-3.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5 font-medium">
                <Coins className="h-3.5 w-3.5" /> Credits
              </span>
              <span className="bg-foreground/[0.07] rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                {plan}
              </span>
            </div>
            <p className="mt-2 font-mono text-lg font-semibold tabular-nums">
              {creditsBalance.toLocaleString()}
              <span className="text-muted-foreground text-xs font-normal">
                {" "}
                / {creditsLimit.toLocaleString()}
              </span>
            </p>
            <div className="bg-foreground/[0.08] mt-2 h-1.5 w-full overflow-hidden rounded-full">
              <div
                className="bg-foreground h-full rounded-full transition-all duration-300"
                style={{ width: `${pct}%` }}
              />
            </div>
            <Link
              href="/dashboard/settings"
              className="bg-foreground/[0.06] hover:bg-foreground/[0.11] mt-3 flex h-8 w-full items-center justify-center rounded-full text-xs font-semibold transition-colors"
            >
              Top up / Manage plan
            </Link>
          </div>

          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "km" : "en")}
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              {locale === "en" ? "English" : "ភាសាខ្មែរ"}
            </button>
            <button
              type="button"
              onClick={toggleTheme}
              aria-label="Toggle theme"
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="h-3.5 w-3.5" />
              ) : (
                <Moon className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="bg-card/90 border-border/60 sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4 backdrop-blur-xl lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <img src="/logo.svg" alt="SAKTTS" className="h-7 w-7 rounded-lg dark:invert" />
          <span className="font-semibold tracking-tight">SAKTTS Studio</span>
        </Link>
        <div className="flex items-center gap-2">
          <span className="bg-foreground/[0.06] rounded-full px-2.5 py-1 font-mono text-xs font-semibold tabular-nums">
            {creditsBalance.toLocaleString()} cr
          </span>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="bg-foreground/[0.06] flex h-8 w-8 items-center justify-center rounded-full"
          >
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav
        aria-label="Mobile studio navigation"
        className="bg-card/95 border-border/70 fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t px-2 py-1.5 backdrop-blur-xl lg:hidden"
      >
        {NAV_ITEMS.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1 text-[10px] ${
                active ? "text-foreground font-semibold" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
