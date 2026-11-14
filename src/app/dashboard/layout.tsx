"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AudioLines,
  BarChart3,
  Bell,
  Captions,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  FileAudio2,
  Globe,
  Info,
  KeyRound,
  Library,
  LifeBuoy,
  LogOut,
  Menu,
  Mic,
  Monitor,
  Moon,
  Music,
  Settings,
  Sparkles,
  Sun,
  Users,
  X,
  Zap,
} from "lucide-react";
import { useLanguage, useStudio, useTheme } from "@/components/providers";
import { PLAN_LABELS } from "@/lib/user-types";

interface NavLinkItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: "studio" | "upgrade";
}

interface NavGroup {
  heading: string;
  items: NavLinkItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Create",
    items: [
      { href: "/dashboard", label: "Text to Speech", icon: AudioLines, badge: "studio" },
      { href: "/dashboard/voice-cloning", label: "Voice Cloning", icon: Mic, badge: "upgrade" },
      { href: "/dashboard/speech-to-text", label: "Speech to Text", icon: FileAudio2 },
      { href: "/dashboard/subtitles", label: "Subtitles", icon: Captions },
      { href: "/dashboard/music", label: "Music", icon: Music, badge: "upgrade" },
    ],
  },
  {
    heading: "Library",
    items: [
      { href: "/dashboard/voice-clones", label: "My voices", icon: Library },
      { href: "/dashboard/history", label: "History", icon: Clock },
    ],
  },
  {
    heading: "Account",
    items: [
      { href: "/dashboard/usage", label: "Usage", icon: BarChart3 },
      { href: "/dashboard/settings", label: "API", icon: KeyRound },
      { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
      { href: "/dashboard/users", label: "Users & Credits", icon: Users },
    ],
  },
];

const PAGE_TITLES: Array<{ match: (p: string) => boolean; title: string }> = [
  { match: (p) => p === "/dashboard", title: "Text to Speech" },
  { match: (p) => p.startsWith("/dashboard/voice-cloning"), title: "Voice Cloning" },
  { match: (p) => p.startsWith("/dashboard/speech-to-text"), title: "Speech to Text" },
  { match: (p) => p.startsWith("/dashboard/subtitles"), title: "Subtitle Studio" },
  { match: (p) => p.startsWith("/dashboard/music"), title: "Music" },
  { match: (p) => p.startsWith("/dashboard/voice-clones"), title: "My voices" },
  { match: (p) => p.startsWith("/dashboard/history"), title: "History" },
  { match: (p) => p.startsWith("/dashboard/usage"), title: "Usage" },
  { match: (p) => p.startsWith("/dashboard/billing"), title: "Billing" },
  { match: (p) => p.startsWith("/dashboard/users"), title: "Users & Credits" },
  { match: (p) => p.startsWith("/dashboard/settings"), title: "API & Settings" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { creditsBalance, plan, activeUser, creditPolicy, history, refreshStore } = useStudio();
  const { preference, resolvedTheme, setPreference } = useTheme();
  const { locale, setLocale } = useLanguage();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [openPanel, setOpenPanel] = useState<"alerts" | "account" | null>(null);

  const mainShellRef = useRef<HTMLDivElement | null>(null);
  const drawerCloseRef = useRef<HTMLButtonElement | null>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement | null>(null);
  const topControlsRef = useRef<HTMLDivElement | null>(null);

  const isUnlimited = plan === "enterprise";
  const isFreePlan = plan === "free";
  const isLowBalance =
    !isUnlimited && creditsBalance <= (creditPolicy?.lowBalanceThreshold ?? 500);
  const planDisplay = PLAN_LABELS[plan as keyof typeof PLAN_LABELS]?.label ?? plan;
  const pageTitle = PAGE_TITLES.find((t) => t.match(pathname))?.title ?? "SAKTTS Studio";

  const alertCount = (isLowBalance ? 1 : 0) + (history.length > 0 ? Math.min(3, history.length) : 0);

  // Manage background inert state & keyboard focus for mobile drawer
  useEffect(() => {
    const shell = mainShellRef.current;
    if (shell) {
      shell.inert = drawerOpen;
    }
    if (drawerOpen) {
      drawerCloseRef.current?.focus();
    }
  }, [drawerOpen]);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
    setOpenPanel(null);
  }, [pathname]);

  // Global Escape + outside pointer dismissal for header panels and drawer
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (drawerOpen) {
          setDrawerOpen(false);
          drawerTriggerRef.current?.focus();
        } else if (openPanel) {
          setOpenPanel(null);
        }
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (
        openPanel &&
        topControlsRef.current &&
        !topControlsRef.current.contains(e.target as Node)
      ) {
        setOpenPanel(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [drawerOpen, openPanel]);

  const cycleTheme = () => {
    if (preference === "system") setPreference("light");
    else if (preference === "light") setPreference("dark");
    else setPreference("system");
  };

  const handleSignOut = async () => {
    setOpenPanel(null);
    await fetch("/api/auth/session", { method: "DELETE" });
    await refreshStore();
    router.push("/auth/login");
  };

  const renderSidebarNav = () => (
    <div className="flex h-full flex-col">
      {/* Brand Row */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <span className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-lg">
            <img src="/logo.svg" alt="" width={28} height={28} className="h-full w-full dark:invert" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">SAKTTS</span>
        </Link>
        <button
          ref={drawerCloseRef}
          type="button"
          onClick={() => {
            setDrawerOpen(false);
            drawerTriggerRef.current?.focus();
          }}
          aria-label="Close navigation menu"
          className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] flex h-8 w-8 items-center justify-center rounded-full lg:hidden"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {/* Grouped Navigation */}
      <nav aria-label="Studio navigation" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.heading} className="space-y-1">
            <p className="text-muted-foreground/75 px-2.5 pb-0.5 text-[11px] font-medium">
              {group.heading}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href);
                const showUpgrade = item.badge === "upgrade" && isFreePlan;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex min-h-9 items-center justify-between gap-2 rounded-xl px-2.5 py-1.5 text-[13px] transition-colors ${
                        active
                          ? "bg-foreground/[0.07] text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground font-medium"
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
                        <span className="truncate">{item.label}</span>
                      </span>

                      {item.badge === "studio" && (
                        <span className="border-border/80 bg-card text-muted-foreground shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium">
                          Studio
                        </span>
                      )}
                      {showUpgrade && (
                        <span className="bg-foreground text-background inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                          <Sparkles className="h-2.5 w-2.5" aria-hidden="true" />
                          Upgrade
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Sidebar Bottom Utility Links */}
      <div className="border-sidebar-border/80 shrink-0 space-y-0.5 border-t px-3 py-3">
        <Link
          href="/download"
          className="text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground flex min-h-8 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-colors"
        >
          <Download className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
          <span>Install App</span>
        </Link>
        <Link
          href="/docs"
          className="text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground flex min-h-8 items-center justify-between rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <Info className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
            <span>Learn More</span>
          </span>
          <ChevronRight className="h-3.5 w-3.5 opacity-60" aria-hidden="true" />
        </Link>
        <Link
          href="/contact"
          className="text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground flex min-h-8 items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[13px] font-medium transition-colors"
        >
          <LifeBuoy className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />
          <span>Support</span>
        </Link>
      </div>
    </div>
  );

  return (
    <div className="bg-background flex min-h-screen flex-col lg:h-screen lg:flex-row lg:overflow-hidden">
      {/* Desktop Sidebar */}
      <aside className="bg-sidebar border-sidebar-border hidden w-60 shrink-0 border-r lg:block">
        {renderSidebarNav()}
      </aside>

      {/* Mobile Navigation Drawer */}
      {drawerOpen && (
        <div
          id="mobile-nav-drawer"
          className="fixed inset-0 z-50 flex lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Dashboard navigation"
        >
          <div
            className="fixed inset-0 bg-black/45 backdrop-blur-[2px]"
            onClick={() => {
              setDrawerOpen(false);
              drawerTriggerRef.current?.focus();
            }}
          />
          <aside className="bg-sidebar border-sidebar-border relative z-10 h-dvh w-72 max-w-[82vw] overflow-y-auto border-r shadow-2xl">
            {renderSidebarNav()}
          </aside>
        </div>
      )}

      {/* Main Content Shell */}
      <div
        id="dashboard-main-shell"
        ref={mainShellRef}
        className="flex min-w-0 flex-1 flex-col lg:overflow-hidden"
      >
        {/* Top Sticky Workspace Header Bar */}
        <header className="bg-background/90 border-border/50 sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b px-4 backdrop-blur-md sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              ref={drawerTriggerRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
              className="border-border/70 bg-card hover:bg-foreground/[0.04] inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border lg:hidden"
            >
              <Menu className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="truncate text-[15px] font-semibold tracking-tight">{pageTitle}</span>
          </div>

          <div ref={topControlsRef} className="relative flex shrink-0 items-center gap-1.5 sm:gap-2">
            {/* Notifications Bell */}
            <button
              type="button"
              onClick={() => setOpenPanel((p) => (p === "alerts" ? null : "alerts"))}
              aria-label="Workspace notifications"
              aria-expanded={openPanel === "alerts"}
              aria-controls="header-alerts-panel"
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            >
              <Bell className="h-4 w-4" aria-hidden="true" />
              {alertCount > 0 && (
                <span className="bg-foreground text-background absolute top-0.5 right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full px-1 text-[9px] font-bold">
                  {alertCount}
                </span>
              )}
            </button>

            {/* Language Switch */}
            <button
              type="button"
              onClick={() => setLocale(locale === "en" ? "km" : "en")}
              aria-label={locale === "en" ? "Switch language to Khmer" : "Switch language to English"}
              title={locale === "en" ? "English (Click for Khmer)" : "ភាសាខ្មែរ (ចុចប្ដូរជាអង់គ្លេស)"}
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] hidden h-8 items-center gap-1 rounded-full px-2 text-xs font-medium transition-colors sm:inline-flex"
            >
              <Globe className="h-4 w-4" aria-hidden="true" />
              <span className="uppercase">{locale}</span>
            </button>

            {/* Theme / System Switch */}
            <button
              type="button"
              onClick={cycleTheme}
              aria-label={`Theme mode: ${preference}. Click to switch.`}
              title={`Theme: ${preference} (${resolvedTheme})`}
              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.05] inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
            >
              {preference === "system" ? (
                <Monitor className="h-4 w-4" aria-hidden="true" />
              ) : resolvedTheme === "dark" ? (
                <Sun className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Moon className="h-4 w-4" aria-hidden="true" />
              )}
            </button>

            {/* Credits + Plan Pill -> Billing */}
            <Link
              href="/dashboard/billing"
              className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                isLowBalance
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
                  : "border-border/75 bg-card hover:bg-foreground/[0.04]"
              }`}
              title="Open Billing & Plans"
            >
              <Zap
                className={`h-3 w-3 shrink-0 ${isLowBalance ? "text-amber-500" : "opacity-75"}`}
                aria-hidden="true"
              />
              <span className="font-mono tabular-nums">
                {isUnlimited ? "∞" : creditsBalance.toLocaleString()}
              </span>
              <span className="bg-foreground/[0.07] text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold">
                {planDisplay}
              </span>
            </Link>

            {/* Account Avatar Button */}
            <button
              type="button"
              onClick={() => setOpenPanel((p) => (p === "account" ? null : "account"))}
              aria-label="Account profile and workspace switcher"
              aria-expanded={openPanel === "account"}
              aria-controls="header-account-panel"
              className="bg-foreground text-background flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold uppercase ring-2 ring-black/10 transition-transform hover:scale-[1.03] dark:ring-white/15"
            >
              {activeUser?.name ? activeUser.name.slice(0, 2) : "SA"}
            </button>

            {/* Notifications Disclosure Panel */}
            {openPanel === "alerts" && (
              <div
                id="header-alerts-panel"
                className="bg-card border-border/75 absolute top-11 right-0 z-40 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border p-4 shadow-xl"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold">Workspace Activity</h2>
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setOpenPanel(null)}
                    className="text-muted-foreground hover:text-foreground text-[11px] underline underline-offset-4"
                  >
                    Billing & Quota
                  </Link>
                </div>

                {isLowBalance && (
                  <div className="mb-3 rounded-xl border border-amber-500/35 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
                    Low credits ({creditsBalance.toLocaleString()} left). Upgrade or top up in{" "}
                    <Link
                      href="/dashboard/billing"
                      onClick={() => setOpenPanel(null)}
                      className="font-semibold underline"
                    >
                      Billing
                    </Link>
                    .
                  </div>
                )}

                {history.length === 0 ? (
                  <p className="text-muted-foreground py-2 text-xs">
                    No recent studio generations yet.
                  </p>
                ) : (
                  <ul className="divide-border/50 divide-y">
                    {history.slice(0, 3).map((item) => (
                      <li key={item.id} className="py-2 text-xs">
                        <p className="truncate font-medium">{item.title}</p>
                        <p className="text-muted-foreground text-[11px]">
                          {item.type.toUpperCase()} · {item.creditsUsed} credits ·{" "}
                          {item.durationSec.toFixed(1)}s
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Account Disclosure Panel */}
            {openPanel === "account" && (
              <div
                id="header-account-panel"
                className="bg-card border-border/75 absolute top-11 right-0 z-40 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border p-3.5 shadow-xl"
              >
                <div className="border-border/60 mb-2.5 border-b pb-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">
                      {activeUser?.name ?? "SAKTTS Creator"}
                    </p>
                    <span className="bg-foreground/[0.07] shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                      {activeUser?.role ?? "owner"}
                    </span>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {activeUser?.email ?? "creator@saktts.local"}
                  </p>
                </div>

                <div className="space-y-1 text-xs">
                  <Link
                    href="/dashboard/billing"
                    onClick={() => setOpenPanel(null)}
                    className="hover:bg-foreground/[0.05] flex items-center gap-2 rounded-xl px-2.5 py-2 font-medium"
                  >
                    <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
                    Billing & Plan ({planDisplay})
                  </Link>
                  <Link
                    href="/dashboard/usage"
                    onClick={() => setOpenPanel(null)}
                    className="hover:bg-foreground/[0.05] flex items-center gap-2 rounded-xl px-2.5 py-2 font-medium"
                  >
                    <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                    Usage Analytics
                  </Link>
                  <Link
                    href="/dashboard/users"
                    onClick={() => setOpenPanel(null)}
                    className="hover:bg-foreground/[0.05] flex items-center gap-2 rounded-xl px-2.5 py-2 font-medium"
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Users & Credit Admin
                  </Link>
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setOpenPanel(null)}
                    className="hover:bg-foreground/[0.05] flex items-center gap-2 rounded-xl px-2.5 py-2 font-medium"
                  >
                    <Settings className="h-3.5 w-3.5" aria-hidden="true" />
                    API Keys & Profile
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="text-destructive hover:bg-destructive/10 flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left font-medium"
                  >
                    <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Scrollable Workspace Content */}
        <main className="bg-background flex min-h-0 min-w-0 flex-1 flex-col overflow-x-clip overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
