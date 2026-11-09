"use client";

import React, { useEffect, useState } from "react";
import { Check, Copy, Key, Monitor, Moon, Plus, Sun, Trash2, Zap } from "lucide-react";
import { ThemePreference, useLanguage, useStudio, useTheme } from "@/components/providers";
import { ModalDialog } from "@/components/ui/modal-dialog";

interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default function SettingsPage() {
  const { plan, creditsBalance, creditsLimit, history, refreshStore } = useStudio();
  const { preference, systemTheme, setPreference } = useTheme();
  const { locale, setLocale } = useLanguage();

  const [apiKeys, setApiKeys] = useState<ApiKeyRow[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdRawKey, setCreatedRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Settings, Credits & API Keys
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your credit pool, usage analytics, API bearer tokens, theme, and language.
        </p>
      </div>

      {/* Analytics + Credits */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-muted-foreground text-xs font-medium">Available Credits</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {creditsBalance.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Plan: <span className="text-foreground font-semibold uppercase">{plan}</span> · Limit{" "}
            {creditsLimit.toLocaleString()}
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-muted-foreground text-xs font-medium">Studio Runs</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">{history.length}</p>
          <p className="text-muted-foreground mt-1 text-xs">
            {ttsCount} speech · {sttCount} transcriptions
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <p className="text-muted-foreground text-xs font-medium">Total Audio Processed</p>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {totalSec.toFixed(1)}s
          </p>
          <button
            type="button"
            onClick={topUp}
            className="text-foreground mt-1 inline-flex items-center gap-1 text-xs font-semibold hover:underline"
          >
            <Zap className="h-3 w-3" /> Add +5,000 demo credits
          </button>
        </div>
      </div>

      {/* Plan Switcher */}
      <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
        <h2 className="text-lg font-semibold">Workspace Plan</h2>
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
              <Key className="h-4 w-4" /> API Keys
            </h2>
            <p className="text-muted-foreground text-xs">
              OpenAI-compatible Bearer tokens for <code>/api/v1/audio/speech</code> and{" "}
              <code>/api/v1/audio/transcriptions</code>.
            </p>
          </div>
          <form onSubmit={handleCreateKey} className="flex gap-2">
            <input
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key label…"
              className="bg-foreground/[0.04] border-border/60 h-9 rounded-full border px-3.5 text-xs outline-none"
            />
            <button
              type="submit"
              className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Create Key
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
          <h2 className="text-base font-semibold">Appearance</h2>
          <p className="text-muted-foreground text-xs">
            Choose System to follow your OS theme automatically, or pin Light/Dark mode.
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                {
                  id: "system",
                  label: `System (${systemTheme === "dark" ? "Dark" : "Light"})`,
                  icon: Monitor,
                },
                { id: "light", label: "Light", icon: Sun },
                { id: "dark", label: "Dark", icon: Moon },
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
          <h2 className="text-base font-semibold">Interface Language</h2>
          <p className="text-muted-foreground text-xs">
            Switch SAKTTS labels between English and Khmer (ភាសាខ្មែរ).
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
