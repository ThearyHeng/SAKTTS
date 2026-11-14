"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Copy,
  Key,
  Lock,
  LogOut,
  Monitor,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Trash2,
  Users,
  Zap,
} from "lucide-react";
import { ThemePreference, useLanguage, useStudio, useTheme } from "@/components/providers";
import { isUserAdmin } from "@/lib/user-types";
import { ModalDialog } from "@/components/ui/modal-dialog";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const { plan, creditsBalance, creditsLimit, history, activeUser, refreshStore } = useStudio();
  const { preference, systemTheme, setPreference } = useTheme();
  const { locale, setLocale, t } = useLanguage();
  const isAdmin = isUserAdmin(activeUser?.role);

  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileWorkspace, setProfileWorkspace] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeUser) {
      setProfileName(activeUser.name);
      setProfileEmail(activeUser.email);
      setProfileWorkspace(activeUser.workspace);
    }
  }, [activeUser]);

  const fetchKeys = async () => {
    const res = await fetch("/api/keys");
    if (res.ok) {
      const data = await res.json();
      setApiKeys(data.apiKeys ?? []);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setProfileSuccess(null);

    if (!profileName.trim()) {
      setProfileError("Display name is required.");
      return;
    }
    if (!profileEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileEmail.trim())) {
      setProfileError("Please enter a valid email address.");
      return;
    }

    setSavingProfile(true);
    try {
      const res = await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: {
            name: profileName.trim(),
            email: profileEmail.trim(),
            workspace: profileWorkspace.trim() || "Personal Workspace",
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileError(data.error || "Unable to save profile.");
        return;
      }
      await refreshStore();
      setProfileSuccess("Profile updated for current active account.");
    } catch {
      setProfileError("Network error while saving profile.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth/session", { method: "DELETE" });
    await refreshStore();
    router.push("/auth/login");
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newKeyName || "Production Server Key" }),
    });
    const data = await res.json();
    if (data.rawKey) {
      setCreatedRawKey(data.rawKey);
      setNewKeyName("");
      fetchKeys();
    }
  };

  const handleDeleteKey = async (id: string) => {
    await fetch(`/api/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    fetchKeys();
  };

  const switchPlan = async (nextPlan: string) => {
    await fetch("/api/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: nextPlan }),
    });
    refreshStore();
  };

  const topUp = async () => {
    await fetch("/api/history", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topUpCredits: 5000 }),
    });
    refreshStore();
  };

  const ttsCount = history.filter((h) => h.type === "tts" || h.type === "clone").length;
  const sttCount = history.filter((h) => h.type === "stt").length;
  const totalSec = history.reduce((acc, h) => acc + (h.durationSec || 0), 0);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {t("settings.title")}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("settings.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/dashboard/billing"
            className="border-border/75 bg-card hover:bg-foreground/[0.04] inline-flex min-h-10 w-fit items-center gap-2 rounded-full border px-4 text-xs font-semibold transition-colors"
          >
            {t("settings.billing")}
          </Link>
          {isAdmin ? (
            <Link
              href="/dashboard/users"
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 w-fit items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors"
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {t("settings.manageUsers")}
            </Link>
          ) : (
            <button
              type="button"
              disabled
              title="Admin access required to manage users and credit ledger"
              className="border-border/60 bg-foreground/[0.03] text-muted-foreground inline-flex min-h-10 w-fit cursor-not-allowed items-center gap-2 rounded-full border px-4 text-xs font-medium opacity-50"
            >
              <Lock className="h-3.5 w-3.5 opacity-50" aria-hidden="true" />
              {t("settings.manageUsersAdminOnly")}
            </button>
          )}
        </div>
      </div>

      {/* Signed-In Profile & Account */}
      <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold">{t("settings.profileTitle")}</h2>
              {activeUser && (
                <span className="bg-foreground/[0.07] inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase">
                  <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                  {activeUser.role}
                </span>
              )}
            </div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {t("settings.profileSubtitle", { email: activeUser?.email ?? "creator@saktts.local" })}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Link
                href="/dashboard/users"
                className="border-border/70 hover:bg-foreground/[0.04] inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium"
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {t("settings.switchAccount")}
              </Link>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="border-border/70 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
              {t("settings.signOut")}
            </button>
          </div>
        </div>

        {profileError && (
          <div
            role="alert"
            className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
          >
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{profileError}</span>
          </div>
        )}

        {profileSuccess && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-medium text-emerald-700 dark:text-emerald-300"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{profileSuccess}</span>
          </div>
        )}

        <form method="POST" onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="settings-name" className="block text-xs font-semibold">
              {t("settings.displayName")}
            </label>
            <input
              id="settings-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              value={profileName}
              onChange={(e) => {
                setProfileName(e.target.value);
                if (profileError) setProfileError(null);
                if (profileSuccess) setProfileSuccess(null);
              }}
              className="bg-workspace border-border/70 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-email" className="block text-xs font-semibold">
              {t("settings.accountEmail")}
            </label>
            <input
              id="settings-email"
              name="email"
              type="email"
              autoComplete="username"
              spellCheck={false}
              autoCorrect="off"
              autoCapitalize="off"
              required
              value={profileEmail}
              onChange={(e) => {
                setProfileEmail(e.target.value);
                if (profileError) setProfileError(null);
                if (profileSuccess) setProfileSuccess(null);
              }}
              className="bg-workspace border-border/70 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="settings-workspace" className="block text-xs font-semibold">
              {t("settings.workspaceName")}
            </label>
            <input
              id="settings-workspace"
              name="workspace"
              type="text"
              value={profileWorkspace}
              onChange={(e) => {
                setProfileWorkspace(e.target.value);
                if (profileError) setProfileError(null);
                if (profileSuccess) setProfileSuccess(null);
              }}
              className="bg-workspace border-border/70 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
            />
          </div>

          <div className="flex justify-end sm:col-span-3">
            <button
              type="submit"
              disabled={savingProfile}
              className="bg-foreground text-background hover:opacity-90 min-h-10 rounded-full px-5 text-xs font-semibold transition-opacity disabled:opacity-50"
            >
              {savingProfile ? t("settings.saving") : t("settings.saveProfile")}
            </button>
          </div>
        </form>
      </div>

      {/* Analytics + Credits */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-muted-foreground text-xs font-medium">{t("settings.availableCredits")}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {plan === "enterprise" ? t("settings.unlimited") : creditsBalance.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("settings.plan")}: <span className="text-foreground font-semibold uppercase">{plan}</span> · {t("settings.limit")}{" "}
            {plan === "enterprise" ? t("settings.unlimited") : creditsLimit.toLocaleString()}
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-muted-foreground text-xs font-medium">{t("settings.studioRuns")}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{history.length}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {t("settings.runsStats", { tts: ttsCount, stt: sttCount })}
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-muted-foreground text-xs font-medium">{t("settings.totalAudio")}</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {totalSec.toFixed(1)}s
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={topUp}
                  className="text-foreground inline-flex items-center gap-1 text-xs font-semibold hover:underline"
                >
                  <Zap className="h-3 w-3" /> {t("settings.addCredits")}
                </button>
                <Link
                  href="/dashboard/users?tab=credits"
                  className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-4"
                >
                  {t("settings.openLedger")}
                </Link>
              </>
            ) : (
              <Link
                href="/dashboard/billing"
                className="text-foreground inline-flex items-center gap-1 text-xs font-semibold hover:underline"
              >
                <Zap className="h-3 w-3" /> {t("settings.topUpKhqr")}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Plan Switcher */}
      <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <h2 className="text-lg font-semibold">{t("settings.workspacePlan")}</h2>
        <div className="grid gap-2.5 sm:grid-cols-5">
          {[
            { id: "free", label: "Free", price: "$0" },
            { id: "basic", label: "Basic", price: "$2.99" },
            { id: "starter", label: "Starter", price: "$6.99" },
            { id: "studio", label: "Studio", price: "$11.99" },
            { id: "studio_max", label: "Studio Max", price: "$49.99" },
          ].map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => switchPlan(p.id)}
                className={`rounded-2xl border p-3.5 text-left transition-all ${
                  active
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/60 hover:bg-foreground/[0.04]"
                }`}
              >
                <span className="block text-sm font-semibold">{p.label}</span>
                <span className="text-xs opacity-75">{p.price}/mo</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* API Keys */}
      <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Key className="h-4 w-4" /> {t("settings.apiKeys")}
            </h2>
            <p className="text-muted-foreground text-xs">
              OpenAI-compatible Bearer tokens for <code>/api/v1/audio/speech</code> and{" "}
              <code>/api/v1/audio/transcriptions</code>.
            </p>
          </div>
          <form method="POST" onSubmit={handleCreateKey} className="flex gap-2">
            <label htmlFor="api-key-label" className="sr-only">
              {t("settings.keyName")}
            </label>
            <input
              id="api-key-label"
              name="keyName"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder={t("settings.keyPlaceholder")}
              className="bg-foreground/[0.04] border-border/60 h-9 rounded-full border px-3.5 text-xs outline-none"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> {t("settings.createKey")}
            </button>
          </form>
        </div>

        <div className="divide-border/50 divide-y">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between gap-4 py-3 text-sm">
              <div>
                <p className="font-semibold">{k.name}</p>
                <p className="text-muted-foreground font-mono text-xs">{k.prefix}</p>
              </div>
              <button
                type="button"
                onClick={() => handleDeleteKey(k.id)}
                aria-label={`Revoke ${k.name}`}
                className="text-muted-foreground hover:text-destructive p-2"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Appearance & Language (3-state system/light/dark per modern-web-guidance) */}
      <div className="bg-card grid gap-6 rounded-3xl p-6 ring-1 ring-black/[0.04] sm:grid-cols-2 dark:ring-white/[0.06]">
        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("settings.theme")}</h2>
          <p className="text-muted-foreground text-xs">
            {t("settings.themeDesc")}
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: "system",
                  label: `${t("settings.themeSystem")} (${systemTheme === "dark" ? t("settings.themeDark") : t("settings.themeLight")})`,
                  icon: Monitor,
                },
                { id: "light", label: t("settings.themeLight"), icon: Sun },
                { id: "dark", label: t("settings.themeDark"), icon: Moon },
              ] as Array<{ id: ThemePreference; label: string; icon: React.ComponentType<{ className?: string }> }>
            ).map((opt) => {
              const Icon = opt.icon;
              const active = preference === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setPreference(opt.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border p-3 text-xs font-medium transition-colors ${
                    active
                      ? "border-foreground bg-foreground text-background"
                      : "border-border/60 hover:bg-foreground/[0.04]"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-center leading-tight">{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold">{t("settings.language")}</h2>
          <p className="text-muted-foreground text-xs">
            {t("settings.languageDesc")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setLocale("en")}
              className={`rounded-2xl border p-3 text-sm font-medium ${
                locale === "en"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 hover:bg-foreground/[0.04]"
              }`}
            >
              English (EN)
            </button>
            <button
              type="button"
              onClick={() => setLocale("km")}
              className={`rounded-2xl border p-3 text-sm font-medium ${
                locale === "km"
                  ? "border-foreground bg-foreground text-background"
                  : "border-border/60 hover:bg-foreground/[0.04]"
              }`}
            >
              ភាសាខ្មែរ (KM)
            </button>
          </div>
        </div>
      </div>

      {/* Created API Key Modal */}
      <ModalDialog
        open={createdRawKey !== null}
        onClose={() => setCreatedRawKey(null)}
        title="Copy Your New API Key"
        description="Save this secret key now — for security it will not be shown in full again."
        maxWidthClass="max-w-lg"
      >
        {createdRawKey && (
          <div className="space-y-4">
            <div className="bg-foreground/[0.05] flex items-center justify-between gap-2 rounded-2xl p-3 font-mono text-xs break-all">
              <span>{createdRawKey}</span>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(createdRawKey);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="bg-foreground text-background inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-3 font-sans text-xs font-semibold"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
