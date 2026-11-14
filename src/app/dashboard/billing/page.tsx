"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Download,
  Gift,
  Link2,
  Loader2,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useStudio } from "@/components/providers";
import { ModalDialog } from "@/components/ui/modal-dialog";
import {
  BILLING_PLAN_CATALOG,
  TOPUP_PACK_CATALOG,
  isUserAdmin,
  type BillingPlanSpec,
  type CreditTransaction,
  type PaymentOrder,
  type TopUpPackSpec,
} from "@/lib/user-types";

interface ActiveKhqrCheckout {
  order: PaymentOrder;
  itemLabel: string;
  qrImageDataUrl: string;
  merchantName: string;
  merchantCity: string;
  bakongAccountId: string;
  checkMessage?: string;
}

function formatTxDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCountdown(expiresAtIso: string, nowMs: number): string {
  const diffSec = Math.max(0, Math.floor((Date.parse(expiresAtIso) - nowMs) / 1000));
  const mins = Math.floor(diffSec / 60);
  const secs = diffSec % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export default function BillingPage() {
  const { plan, creditsBalance, creditsLimit, activeUser, refreshStore } = useStudio();

  const [tab, setTab] = useState<"overview" | "history">("overview");
  const [inviteDetailsOpen, setInviteDetailsOpen] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [originUrl, setOriginUrl] = useState("https://www.saktts.com");

  // Top-up & Free-downgrade modal state
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [selectedPackId, setSelectedPackId] = useState<TopUpPackSpec["id"]>("pack_5k");
  const [freeConfirmOpen, setFreeConfirmOpen] = useState(false);

  // Live KHQR Checkout & Auto-Verify state
  const [khqrCheckout, setKhqrCheckout] = useState<ActiveKhqrCheckout | null>(null);
  const [creatingQr, setCreatingQr] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [simulatingBank, setSimulatingBank] = useState(false);
  const [copiedQrPayload, setCopiedQrPayload] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [feedback, setFeedback] = useState<string | null>(null);

  // Ledger + KHQR Invoices history
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [khqrOrders, setKhqrOrders] = useState<PaymentOrder[]>([]);
  const [liveBakongConfigured, setLiveBakongConfigured] = useState(false);
  const [loadingTx, setLoadingTx] = useState(false);
  const pollBusyRef = useRef(false);

  useEffect(() => {
    try {
      setOriginUrl(window.location.origin);
      if (new URLSearchParams(window.location.search).get("tab") === "history") {
        setTab("history");
      }
    } catch {
      // ignore SSR
    }
  }, []);

  const loadBillingHistory = useCallback(async () => {
    setLoadingTx(true);
    try {
      const uid = activeUser?.id ? `?userId=${encodeURIComponent(activeUser.id)}` : "";
      const [creditsRes, ordersRes] = await Promise.all([
        fetch(`/api/credits${uid}`, { cache: "no-store" }),
        fetch("/api/payments/khqr/status", { cache: "no-store" }),
      ]);
      if (creditsRes.ok) {
        const data = await creditsRes.json();
        setTransactions(data.transactions ?? []);
      }
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        setKhqrOrders(ordersData.orders ?? []);
        setLiveBakongConfigured(Boolean(ordersData.liveMode));
      }
    } finally {
      setLoadingTx(false);
    }
  }, [activeUser?.id]);

  useEffect(() => {
    loadBillingHistory();
  }, [loadBillingHistory, creditsBalance, plan]);

  const verifyOrderStatus = useCallback(
    async (orderId: string, includeQr = false) => {
      if (pollBusyRef.current) return;
      pollBusyRef.current = true;
      setCheckingStatus(true);
      try {
        const res = await fetch(
          `/api/payments/khqr/status?orderId=${encodeURIComponent(orderId)}${
            includeQr ? "&includeQr=1" : ""
          }`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok) {
          setCheckoutError(data.error || "Unable to verify KHQR payment status.");
          if (data.order) {
            setKhqrCheckout((prev) => (prev ? { ...prev, order: data.order } : prev));
          }
          return;
        }

        if (data.order) {
          setKhqrCheckout((prev) =>
            prev && prev.order.id === data.order.id
              ? {
                  ...prev,
                  order: data.order,
                  qrImageDataUrl: data.qrImageDataUrl || prev.qrImageDataUrl,
                  checkMessage: data.checkMessage || prev.checkMessage,
                }
              : prev
          );
        }

        if (data.approved) {
          setCheckoutError(null);
          await Promise.all([refreshStore(), loadBillingHistory()]);
          const label =
            data.order?.kind === "plan_upgrade" && data.order?.targetPlan
              ? `KHQR verified & ${data.order.targetPlan.replace("_", " ").toUpperCase()} Plan auto-approved!`
              : `KHQR verified & +${Number(data.order?.topupCredits ?? 0).toLocaleString()} credits added!`;
          setFeedback(label);
          setTimeout(() => setFeedback(null), 5000);
        }
      } catch {
        setCheckoutError("Network error while checking Bakong KHQR verification.");
      } finally {
        pollBusyRef.current = false;
        setCheckingStatus(false);
      }
    },
    [refreshStore, loadBillingHistory]
  );

  // Automatic 3-second KHQR status polling & 1-second expiration clock
  useEffect(() => {
    if (!khqrCheckout || khqrCheckout.order.status !== "pending") return;

    setNowMs(Date.now());
    const tickTimer = setInterval(() => setNowMs(Date.now()), 1000);
    const pollTimer = setInterval(() => {
      verifyOrderStatus(khqrCheckout.order.id);
    }, 3000);

    return () => {
      clearInterval(tickTimer);
      clearInterval(pollTimer);
    };
  }, [khqrCheckout?.order.id, khqrCheckout?.order.status, verifyOrderStatus]);

  const currentPlanSpec = useMemo(
    () => BILLING_PLAN_CATALOG.find((p) => p.id === plan) ?? BILLING_PLAN_CATALOG[0],
    [plan]
  );

  const isEnterprise = plan === "enterprise";
  const safeLimit = Math.max(1, creditsLimit || currentPlanSpec.creditsMonthly || 2000);
  const cappedRemaining = Math.min(safeLimit, Math.max(0, creditsBalance));
  const usedCreditsThisCycle = isEnterprise
    ? activeUser?.creditsUsedTotal ?? 0
    : Math.max(0, safeLimit - cappedRemaining);
  const usedPercent = isEnterprise
    ? 0
    : Math.min(100, Math.round((usedCreditsThisCycle / safeLimit) * 100));
  const remainingPercent = isEnterprise ? 100 : Math.max(0, 100 - usedPercent);

  const referralCode = useMemo(() => {
    const raw = (activeUser?.id ?? "usr-saktts-01").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    return `SAKTTS-${raw.slice(-8).padStart(8, "0")}`;
  }, [activeUser?.id]);
  const inviteUrl = `${originUrl}/auth/register?ref=${referralCode}`;

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      // ignore clipboard restriction
    }
  };

  // Circular SVG progress ring math
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (usedPercent / 100) * circumference;

  const startKhqrCheckout = async (payload: {
    kind: "plan_upgrade" | "credit_topup";
    targetPlan?: BillingPlanSpec["id"];
    packId?: TopUpPackSpec["id"];
  }) => {
    setCreatingQr(true);
    setCheckoutError(null);
    setCopiedQrPayload(false);
    try {
      const res = await fetch("/api/payments/khqr/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setFeedback(data.error || "Unable to generate KHQR code.");
        setTimeout(() => setFeedback(null), 4000);
        return;
      }

      setTopUpModalOpen(false);
      setKhqrCheckout({
        order: data.order,
        itemLabel: data.itemLabel,
        qrImageDataUrl: data.qrImageDataUrl,
        merchantName: data.merchant?.name ?? "SAKTTS STUDIO",
        merchantCity: data.merchant?.city ?? "Phnom Penh",
        bakongAccountId: data.merchant?.bakongAccountId ?? "saktts_studio@bkrt",
      });
      loadBillingHistory();
    } finally {
      setCreatingQr(false);
    }
  };

  const handlePlanButtonClick = (tier: BillingPlanSpec) => {
    if (tier.id === "free") {
      setFreeConfirmOpen(true);
      return;
    }
    startKhqrCheckout({ kind: "plan_upgrade", targetPlan: tier.id });
  };

  const confirmFreeDowngrade = async () => {
    setCreatingQr(true);
    try {
      const res = await fetch("/api/history", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: "free" }),
      });
      if (res.ok) {
        await Promise.all([refreshStore(), loadBillingHistory()]);
        setFreeConfirmOpen(false);
        setFeedback("Switched workspace plan to Free (2,000 monthly quota).");
        setTimeout(() => setFeedback(null), 4500);
      }
    } finally {
      setCreatingQr(false);
    }
  };

  const simulateSandboxPayment = async () => {
    if (!khqrCheckout) return;
    setSimulatingBank(true);
    setCheckoutError(null);
    try {
      const res = await fetch("/api/payments/khqr/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: khqrCheckout.order.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCheckoutError(data.error || "Unable to simulate bank settlement.");
        return;
      }
      // Run immediate status check so polling auto-approves right away
      await verifyOrderStatus(khqrCheckout.order.id);
    } finally {
      setSimulatingBank(false);
    }
  };

  const resumePendingOrder = async (order: PaymentOrder) => {
    setCheckoutError(null);
    const res = await fetch(
      `/api/payments/khqr/status?orderId=${encodeURIComponent(order.id)}&includeQr=1`,
      { cache: "no-store" }
    );
    const data = await res.json();
    if (!res.ok) {
      setFeedback(data.error || "Unable to resume KHQR order.");
      setTimeout(() => setFeedback(null), 4000);
      return;
    }
    if (data.approved) {
      await Promise.all([refreshStore(), loadBillingHistory()]);
      setFeedback(`Order ${order.id} confirmed paid and auto-approved!`);
      setTimeout(() => setFeedback(null), 4500);
      return;
    }
    const itemLabel =
      order.kind === "plan_upgrade" && order.targetPlan
        ? `${order.targetPlan.replace("_", " ").toUpperCase()} Plan`
        : `+${Number(order.topupCredits ?? 0).toLocaleString()} Extra Credits`;
    setKhqrCheckout({
      order: data.order ?? order,
      itemLabel,
      qrImageDataUrl: data.qrImageDataUrl || "",
      merchantName: data.merchant?.name ?? "SAKTTS STUDIO",
      merchantCity: data.merchant?.city ?? "Phnom Penh",
      bakongAccountId: data.merchant?.bakongAccountId ?? "saktts_studio@bkrt",
      checkMessage: data.checkMessage,
    });
  };

  const copyQrString = async () => {
    if (!khqrCheckout?.order.qrPayload) return;
    try {
      await navigator.clipboard.writeText(khqrCheckout.order.qrPayload);
      setCopiedQrPayload(true);
      setTimeout(() => setCopiedQrPayload(false), 1800);
    } catch {
      // ignore clipboard errors
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-8">
      {/* Top Tab Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Billing sections"
          className="inline-flex items-center gap-1 rounded-xl p-0.5"
        >
          <button
            type="button"
            role="tab"
            id="billing-tab-overview"
            aria-selected={tab === "overview"}
            aria-controls="billing-panel-overview"
            onClick={() => setTab("overview")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === "overview"
                ? "bg-card border-border/75 text-foreground border shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            id="billing-tab-history"
            aria-selected={tab === "history"}
            aria-controls="billing-panel-history"
            onClick={() => setTab("history")}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors ${
              tab === "history"
                ? "bg-card border-border/75 text-foreground border shadow-2xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            History
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {feedback && (
            <div
              role="status"
              aria-live="polite"
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/35 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300"
            >
              <Check className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{feedback}</span>
            </div>
          )}
        </div>
      </div>

      {/* OVERVIEW TAB */}
      {tab === "overview" && (
        <section
          role="tabpanel"
          id="billing-panel-overview"
          aria-labelledby="billing-tab-overview"
          className="space-y-7"
        >
          {/* Top Row: Current Plan + Payment Methods / Invite Friends */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {/* Left: Current Plan */}
            <div className="min-w-0 lg:col-span-7">
              <p className="text-muted-foreground mb-2 text-xs font-medium">Current Plan</p>
              <div className="bg-card border-border/65 flex h-[calc(100%-1.5rem)] flex-col justify-between rounded-2xl border p-5 sm:p-6">
                <div className="space-y-5">
                  {/* Plan Header */}
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-xl font-semibold tracking-tight">{currentPlanSpec.name}</h2>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-md border px-2.5 py-0.5 text-[11px] font-medium ${
                          activeUser?.status === "suspended"
                            ? "border-destructive/35 bg-destructive/10 text-destructive"
                            : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        }`}
                      >
                        {activeUser?.status === "suspended" ? "Suspended" : "Active"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setTopUpModalOpen(true)}
                        aria-label="Top up extra credits via KHQR"
                        title="Buy extra credits"
                        className="border-border/75 text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors"
                      >
                        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {/* Donut Gauge + Remaining Count */}
                  <div className="flex items-center gap-5">
                    <div className="relative flex h-24 w-24 shrink-0 items-center justify-center">
                      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 88 88" aria-hidden="true">
                        <circle
                          cx="44"
                          cy="44"
                          r={radius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          className="text-foreground/[0.09]"
                        />
                        <circle
                          cx="44"
                          cy="44"
                          r={radius}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="8"
                          strokeLinecap="round"
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          className="text-foreground transition-all duration-500"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                        <span className="font-mono text-sm font-semibold tabular-nums">
                          {usedPercent}%
                        </span>
                        <span className="text-muted-foreground mt-0.5 text-[10px]">used</span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="text-muted-foreground text-xs font-medium">Remaining</p>
                      <p className="mt-0.5 font-mono text-3xl font-bold tracking-tight tabular-nums">
                        {isEnterprise ? "Unlimited" : creditsBalance.toLocaleString()}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                        {isEnterprise ? "Enterprise quota" : `${creditsLimit.toLocaleString()} total`}
                      </p>
                    </div>
                  </div>

                  {/* Horizontal Slim Progress Bar */}
                  <div className="bg-foreground/[0.07] h-2 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-foreground h-full rounded-full transition-all duration-500"
                      style={{ width: `${remainingPercent}%` }}
                    />
                  </div>

                  {/* Breakdown Lines */}
                  <div className="border-border/55 divide-border/55 divide-y border-t text-xs">
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-muted-foreground inline-flex items-center gap-2 font-medium">
                        <span className="bg-foreground inline-block h-2 w-2 rounded-full" />
                        Plan Credits
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {isEnterprise ? "Unlimited" : creditsLimit.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between py-2.5">
                      <span className="text-muted-foreground inline-flex items-center gap-2 font-medium">
                        <span className="border-muted-foreground inline-block h-2 w-2 rounded-full border" />
                        Used
                      </span>
                      <span className="font-mono font-semibold tabular-nums">
                        {usedCreditsThisCycle.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Contextual Tip + Quick Top-up */}
                <div className="border-border/55 mt-2 flex flex-wrap items-center justify-between gap-2 border-t pt-3.5 text-xs">
                  <p className="text-muted-foreground">
                    {plan === "free"
                      ? "Upgrade to Basic for $2.99 a month, then buy extra credits whenever you run short."
                      : `Active ${currentPlanSpec.name} tier. Need extra capacity before renewal?`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setTopUpModalOpen(true)}
                    className="text-foreground inline-flex items-center gap-1 font-semibold hover:underline"
                  >
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    Buy extra credits
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Payment Methods + Invite Friends */}
            <div className="min-w-0 space-y-5 lg:col-span-5">
              <div>
                <p className="text-muted-foreground mb-2 text-xs font-medium">Payment methods</p>
                <div className="bg-card border-border/65 rounded-2xl border p-4">
                  <div className="bg-foreground/[0.03] border-border/45 flex items-center justify-between gap-3 rounded-xl border p-4">
                    <div>
                      <p className="text-muted-foreground mb-2 text-xs">We accept</p>
                      <button
                        type="button"
                        onClick={() => setTopUpModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg transition-opacity hover:opacity-80"
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e1251b] text-[8px] font-extrabold tracking-tighter text-white"
                          aria-hidden="true"
                        >
                          KHQR
                        </span>
                        <span className="text-xs font-bold tracking-wide">KHQR Bakong</span>
                      </button>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                        liveBakongConfigured
                          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                          : "bg-foreground/[0.06] text-muted-foreground"
                      }`}
                    >
                      {liveBakongConfigured ? "Auto-Verify Live" : "Auto-Verify Ready"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Invite Friends Card */}
              <div className="bg-card border-border/65 space-y-3.5 rounded-2xl border p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-foreground/[0.05] border-border/60 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border">
                      <Gift className="h-4 w-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold">Invite friends</h3>
                      <p className="text-muted-foreground text-xs">
                        Share your link and earn credits.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={inviteDetailsOpen}
                    aria-controls="invite-friends-details"
                    onClick={() => setInviteDetailsOpen((v) => !v)}
                    className="border-border/75 hover:bg-foreground/[0.04] inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium"
                  >
                    Details
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${
                        inviteDetailsOpen ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>
                </div>

                {inviteDetailsOpen && (
                  <div
                    id="invite-friends-details"
                    className="bg-foreground/[0.03] border-border/50 text-muted-foreground rounded-xl border p-3 text-xs leading-relaxed"
                  >
                    Anyone who signs up using your code{" "}
                    <strong className="text-foreground font-mono">{referralCode}</strong> starts with
                    welcome studio credits, and workspace admins can grant +500 referral rewards in{" "}
                    {isUserAdmin(activeUser?.role) ? (
                      <Link href="/dashboard/users" className="text-foreground font-medium underline">
                        Users &amp; Credits
                      </Link>
                    ) : (
                      <span className="text-foreground font-medium">workspace settings</span>
                    )}
                    .
                  </div>
                )}

                <div className="border-border/70 bg-background/70 flex items-center justify-between gap-2 rounded-xl border p-1.5 pl-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <Link2 className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    <span className="text-muted-foreground truncate font-mono text-[11px]">
                      {inviteUrl}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={copyInviteLink}
                    className="bg-foreground text-background hover:opacity-90 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-opacity"
                  >
                    {copiedInvite ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy link
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Available Plans */}
          <div>
            <p className="text-muted-foreground mb-3 text-xs font-medium">Available Plans</p>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {BILLING_PLAN_CATALOG.map((tier) => {
                const isCurrent = plan === tier.id;
                const isDarkCard = Boolean(tier.popular);
                return (
                  <div
                    key={tier.id}
                    className={`flex flex-col rounded-2xl border p-6 transition-shadow ${
                      isDarkCard
                        ? "border-neutral-900 bg-neutral-950 text-white shadow-lg dark:border-neutral-700"
                        : "bg-card border-border/65 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold">{tier.name}</h3>
                      {isCurrent && (
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${
                            isDarkCard
                              ? "bg-white/15 text-white"
                              : "bg-foreground/[0.06] text-muted-foreground border-border/60 border"
                          }`}
                        >
                          Current Plan
                        </span>
                      )}
                      {tier.popular && (
                        <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-neutral-950">
                          Most Popular
                        </span>
                      )}
                    </div>

                    <p
                      className={`mt-1 text-xs ${
                        isDarkCard ? "text-neutral-300" : "text-muted-foreground"
                      }`}
                    >
                      {tier.tagline}
                    </p>

                    <div className="mt-4 flex items-baseline gap-1.5">
                      <span className="text-3xl font-bold tracking-tight">{tier.price}</span>
                      {tier.periodLabel && (
                        <span
                          className={`text-xs ${
                            isDarkCard ? "text-neutral-400" : "text-muted-foreground"
                          }`}
                        >
                          {tier.periodLabel}
                        </span>
                      )}
                    </div>

                    <div className="mt-4">
                      <button
                        type="button"
                        disabled={isCurrent || creatingQr}
                        onClick={() => handlePlanButtonClick(tier)}
                        className={`h-10 w-full rounded-xl text-xs font-semibold transition-all ${
                          isCurrent
                            ? isDarkCard
                              ? "cursor-default bg-white/15 text-white/70"
                              : "bg-foreground/[0.06] text-muted-foreground cursor-default"
                            : isDarkCard
                            ? "bg-white text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
                            : "bg-foreground/[0.06] text-foreground hover:bg-foreground hover:text-background disabled:opacity-60"
                        }`}
                      >
                        {isCurrent
                          ? "Current Plan"
                          : tier.id === "free"
                          ? "Switch to Free"
                          : creatingQr
                          ? "Preparing KHQR…"
                          : `Upgrade to ${tier.name}`}
                      </button>
                    </div>

                    <div
                      className={`mt-5 border-t pt-4 ${
                        isDarkCard ? "border-white/15" : "border-border/55"
                      }`}
                    >
                      <p
                        className={`mb-2.5 text-xs font-medium ${
                          isDarkCard ? "text-neutral-200" : "text-foreground"
                        }`}
                      >
                        Includes
                      </p>
                      <ul className="space-y-2">
                        {tier.features.map((feat) => (
                          <li
                            key={feat}
                            className={`flex items-start gap-2 text-xs ${
                              isDarkCard ? "text-neutral-300" : "text-muted-foreground"
                            }`}
                          >
                            <Check
                              className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                                isDarkCard ? "text-white" : "text-foreground/75"
                              }`}
                              aria-hidden="true"
                            />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* HISTORY TAB */}
      {tab === "history" && (
        <section
          role="tabpanel"
          id="billing-panel-history"
          aria-labelledby="billing-tab-history"
          className="space-y-6"
        >
          {/* KHQR Payment Orders */}
          <div className="bg-card border-border/65 space-y-4 rounded-2xl border p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold">KHQR Invoices &amp; Verification</h2>
                <p className="text-muted-foreground text-xs">
                  Dynamic Bakong KHQR checkouts and automatic MD5 payment verifications.
                </p>
              </div>
              <button
                type="button"
                onClick={loadBillingHistory}
                className="border-border/75 hover:bg-foreground/[0.04] inline-flex h-8 items-center gap-1.5 self-start rounded-lg border px-3 text-xs font-medium"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Refresh Orders
              </button>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="khqr-orders-caption"
              className="saktts-table-wrap border-border/50 border"
            >
              <table
                className="saktts-data-table"
                style={
                  {
                    "--col-2": '"Order"',
                    "--col-3": '"Item"',
                    "--col-4": '"Amount"',
                    "--col-5": '"Status"',
                    "--col-6": '"Action"',
                  } as React.CSSProperties
                }
              >
                <caption id="khqr-orders-caption">
                  Showing {khqrOrders.length} KHQR checkout order(s).
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Order</th>
                    <th scope="col">Item</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {khqrOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-muted-foreground py-6 text-center text-xs">
                        No KHQR payment orders generated yet.
                      </td>
                    </tr>
                  ) : (
                    khqrOrders.map((ord) => (
                      <tr key={ord.id}>
                        <th scope="row" className="text-xs whitespace-nowrap">
                          {formatTxDate(ord.createdAt)}
                        </th>
                        <td className="font-mono text-xs">{ord.id}</td>
                        <td className="text-xs">
                          {ord.kind === "plan_upgrade" && ord.targetPlan
                            ? `${ord.targetPlan.replace("_", " ").toUpperCase()} Plan`
                            : `+${Number(ord.topupCredits ?? 0).toLocaleString()} Credits`}
                        </td>
                        <td className="font-mono text-xs font-semibold">
                          ${ord.amount.toFixed(2)}
                        </td>
                        <td>
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                              ord.status === "paid"
                                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                : ord.status === "pending"
                                ? "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                                : "bg-foreground/[0.07] text-muted-foreground"
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="text-xs">
                          {ord.status === "pending" ? (
                            <button
                              type="button"
                              onClick={() => resumePendingOrder(ord)}
                              className="bg-foreground text-background hover:opacity-90 rounded-lg px-2.5 py-1 text-[11px] font-semibold"
                            >
                              View QR / Verify
                            </button>
                          ) : ord.bakongHash ? (
                            <span className="text-muted-foreground font-mono text-[11px]">
                              {ord.bakongHash.slice(0, 14)}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Credit Ledger Events */}
          <div className="bg-card border-border/65 space-y-4 rounded-2xl border p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold">Billing &amp; Credit History</h2>
                <p className="text-muted-foreground text-xs">
                  All plan upgrades, KHQR top-ups, signup bonuses, and synthesis credit deductions
                  for <strong className="text-foreground">{activeUser?.email ?? "your account"}</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTopUpModalOpen(true)}
                  className="bg-foreground text-background hover:opacity-90 inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-xs font-semibold"
                >
                  <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                  Top up credits
                </button>
                {isUserAdmin(activeUser?.role) && (
                  <Link
                    href="/dashboard/users?tab=credits"
                    className="border-border/75 hover:bg-foreground/[0.04] inline-flex h-9 items-center rounded-lg border px-3 text-xs font-medium"
                  >
                    Admin Ledger
                  </Link>
                )}
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="billing-history-caption"
              className="saktts-table-wrap border-border/50 border"
            >
              <table
                className="saktts-data-table"
                style={
                  {
                    "--col-2": '"Type"',
                    "--col-3": '"Amount"',
                    "--col-4": '"Balance After"',
                    "--col-5": '"Details"',
                  } as React.CSSProperties
                }
              >
                <caption id="billing-history-caption">
                  {loadingTx
                    ? "Loading billing transactions…"
                    : `Showing ${transactions.length} account credit event(s).`}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Balance After</th>
                    <th scope="col">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-muted-foreground py-8 text-center text-sm">
                        No billing or credit events recorded for this account yet.
                      </td>
                    </tr>
                  ) : (
                    transactions.map((tx) => {
                      const pos = tx.amount >= 0;
                      return (
                        <tr key={tx.id}>
                          <th scope="row" className="text-xs whitespace-nowrap">
                            {formatTxDate(tx.createdAt)}
                          </th>
                          <td>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                                pos
                                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {tx.type.replace("_", " ")}
                            </span>
                          </td>
                          <td
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              pos
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {tx.amount > 0
                              ? `+${tx.amount.toLocaleString()}`
                              : tx.amount.toLocaleString()}
                          </td>
                          <td className="font-mono text-xs tabular-nums">
                            {tx.balanceAfter.toLocaleString()}
                          </td>
                          <td className="text-xs">{tx.description}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* LIVE KHQR CHECKOUT + AUTO-APPROVE MODAL */}
      <ModalDialog
        open={khqrCheckout !== null}
        onClose={() => setKhqrCheckout(null)}
        title="Pay with Bakong KHQR"
        description="Scan with Bakong, ABA, ACLEDA, Wing, or any Cambodian bank app. Plan approves automatically once settled."
        maxWidthClass="max-w-md"
      >
        {khqrCheckout && (
          <div className="space-y-4">
            {/* Mode + Order Badge Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground font-mono">
                Order {khqrCheckout.order.id}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  khqrCheckout.order.mode === "live"
                    ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    khqrCheckout.order.mode === "live" ? "bg-emerald-500" : "bg-amber-500"
                  }`}
                />
                {khqrCheckout.order.mode === "live"
                  ? "Live Bakong MD5 Verify"
                  : "Sandbox Mode (No BAKONG_TOKEN)"}
              </span>
            </div>

            {khqrCheckout.order.status === "paid" ? (
              <div
                role="status"
                aria-live="polite"
                className="space-y-4 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-5 text-center"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white">
                  <CheckCircle2 className="h-7 w-7" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-emerald-800 dark:text-emerald-200">
                    Payment Verified &amp; Auto-Approved!
                  </h3>
                  <p className="mt-1 text-xs text-emerald-700/90 dark:text-emerald-300">
                    {khqrCheckout.itemLabel} is now active on your workspace.
                  </p>
                </div>
                <div className="border-emerald-500/25 bg-card/80 space-y-1 rounded-xl border p-3 text-left text-xs">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Amount Paid</span>
                    <span className="font-mono font-semibold">
                      ${(khqrCheckout.order.paidAmount ?? khqrCheckout.order.amount).toFixed(2)}{" "}
                      {khqrCheckout.order.paidCurrency ?? "USD"}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Bakong Tx Ref</span>
                    <span className="font-mono font-semibold">
                      {khqrCheckout.order.bakongHash || "Verified"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setKhqrCheckout(null)}
                  className="bg-foreground text-background hover:opacity-90 h-10 w-full rounded-xl text-xs font-semibold"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                {/* Authentic KHQR Card */}
                <div className="overflow-hidden rounded-2xl border border-black/10 bg-white text-neutral-900 shadow-md">
                  <div className="flex items-center justify-between bg-[#e1251b] px-4 py-2.5 text-white">
                    <span className="text-sm font-black tracking-wider">KHQR</span>
                    <span className="text-[11px] font-medium opacity-90">
                      {khqrCheckout.bakongAccountId}
                    </span>
                  </div>
                  <div className="border-b border-dashed border-neutral-200 px-5 py-3.5">
                    <p className="text-xs font-medium text-neutral-500">
                      {khqrCheckout.merchantName}
                    </p>
                    <p className="mt-0.5 text-2xl font-bold tracking-tight">
                      ${khqrCheckout.order.amount.toFixed(2)}{" "}
                      <span className="text-xs font-semibold text-neutral-500">USD</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-600">{khqrCheckout.itemLabel}</p>
                  </div>
                  <div className="flex flex-col items-center px-5 py-4">
                    {khqrCheckout.qrImageDataUrl ? (
                      <img
                        src={khqrCheckout.qrImageDataUrl}
                        alt={`Dynamic KHQR code for ${khqrCheckout.itemLabel}`}
                        className="h-52 w-52 rounded-xl border border-neutral-100"
                      />
                    ) : (
                      <div className="flex h-52 w-52 items-center justify-center rounded-xl bg-neutral-100">
                        <QrCode className="h-16 w-16 text-neutral-400" aria-hidden="true" />
                      </div>
                    )}
                    <p className="mt-2 font-mono text-[10px] text-neutral-400">
                      MD5: {khqrCheckout.order.qrMd5.slice(0, 16)}…
                    </p>
                  </div>
                </div>

                {/* Auto-Verify Live Polling Bar */}
                <div
                  role="status"
                  aria-live="polite"
                  className="bg-workspace border-border/65 flex items-center justify-between gap-2 rounded-xl border px-3.5 py-2.5 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {khqrCheckout.order.status === "expired" ? (
                      <AlertCircle className="text-destructive h-4 w-4 shrink-0" aria-hidden="true" />
                    ) : (
                      <Loader2
                        className={`h-4 w-4 shrink-0 ${checkingStatus ? "animate-spin" : ""}`}
                        aria-hidden="true"
                      />
                    )}
                    <span className="truncate font-medium">
                      {khqrCheckout.order.status === "expired"
                        ? "QR expired. Generate a fresh code."
                        : checkingStatus
                        ? "Checking Bakong transaction…"
                        : "Auto-checking payment every 3s…"}
                    </span>
                  </div>
                  <span className="text-muted-foreground inline-flex shrink-0 items-center gap-1 font-mono text-[11px] tabular-nums">
                    <Clock className="h-3 w-3" aria-hidden="true" />
                    {formatCountdown(khqrCheckout.order.expiresAt, nowMs)}
                  </span>
                </div>

                {checkoutError && (
                  <p className="text-destructive rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs">
                    {checkoutError}
                  </p>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={checkingStatus}
                    onClick={() => verifyOrderStatus(khqrCheckout.order.id)}
                    className="bg-foreground text-background hover:opacity-90 inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold disabled:opacity-50"
                  >
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    {checkingStatus ? "Checking…" : "Check Payment Now"}
                  </button>

                  {khqrCheckout.qrImageDataUrl && (
                    <a
                      href={khqrCheckout.qrImageDataUrl}
                      download={`${khqrCheckout.order.id}.png`}
                      className="border-border/75 hover:bg-foreground/[0.04] inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium"
                    >
                      <Download className="h-3.5 w-3.5" aria-hidden="true" />
                      Save QR
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={copyQrString}
                    className="border-border/75 hover:bg-foreground/[0.04] inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium"
                  >
                    {copiedQrPayload ? (
                      <>
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copy EMV
                      </>
                    )}
                  </button>
                </div>

                {/* Sandbox Test Bank Simulator (Disabled automatically when BAKONG_TOKEN is set) */}
                {khqrCheckout.order.mode === "sandbox" && khqrCheckout.order.status === "pending" && (
                  <div className="border-border/60 border-t pt-3">
                    <button
                      type="button"
                      disabled={simulatingBank}
                      onClick={simulateSandboxPayment}
                      className="w-full rounded-xl border border-amber-500/40 bg-amber-500/10 py-2.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-300"
                    >
                      {simulatingBank
                        ? "Recording Sandbox Settlement…"
                        : "Simulate Bank Payment (Test Auto-Approve)"}
                    </button>
                    <p className="text-muted-foreground mt-1.5 text-center text-[11px]">
                      Set <code className="font-mono">BAKONG_TOKEN</code> &amp;{" "}
                      <code className="font-mono">BAKONG_ACCOUNT_ID</code> in env to verify real
                      Bakong transfers via NBC Open API.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </ModalDialog>

      {/* FREE PLAN DOWNGRADE CONFIRMATION */}
      <ModalDialog
        open={freeConfirmOpen}
        onClose={() => !creatingQr && setFreeConfirmOpen(false)}
        title="Switch to Free Plan"
        description="Your monthly base quota resets to 2,000 credits. No KHQR charge required."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={creatingQr}
              onClick={() => setFreeConfirmOpen(false)}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.1] min-h-10 rounded-xl px-4 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={creatingQr}
              onClick={confirmFreeDowngrade}
              className="bg-foreground text-background hover:opacity-90 min-h-10 rounded-xl px-5 text-xs font-semibold disabled:opacity-50"
            >
              {creatingQr ? "Switching…" : "Confirm Free Plan"}
            </button>
          </div>
        </div>
      </ModalDialog>

      {/* EXTRA CREDITS PACK PICKER -> GENERATES KHQR */}
      <ModalDialog
        open={topUpModalOpen}
        onClose={() => !creatingQr && setTopUpModalOpen(false)}
        title="Buy Extra Credits via KHQR"
        description="Choose a non-expiring credit pack to generate a Dynamic Bakong KHQR invoice."
        maxWidthClass="max-w-md"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {TOPUP_PACK_CATALOG.map((pack) => (
              <button
                key={pack.id}
                type="button"
                onClick={() => setSelectedPackId(pack.id)}
                className={`rounded-2xl border p-3 text-center transition-all ${
                  selectedPackId === pack.id
                    ? "border-foreground bg-foreground text-background"
                    : "border-border/70 hover:bg-foreground/[0.04]"
                }`}
              >
                <span className="block font-mono text-sm font-bold">
                  +{pack.credits.toLocaleString()}
                </span>
                <span className="block text-[11px] opacity-80">${pack.priceUsd.toFixed(2)}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={creatingQr}
              onClick={() => setTopUpModalOpen(false)}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.1] min-h-10 rounded-xl px-4 text-xs font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={creatingQr}
              onClick={() =>
                startKhqrCheckout({ kind: "credit_topup", packId: selectedPackId })
              }
              className="bg-foreground text-background hover:opacity-90 inline-flex min-h-10 items-center gap-1.5 rounded-xl px-5 text-xs font-semibold disabled:opacity-50"
            >
              <QrCode className="h-3.5 w-3.5" aria-hidden="true" />
              {creatingQr ? "Generating KHQR…" : "Generate KHQR Code"}
            </button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
