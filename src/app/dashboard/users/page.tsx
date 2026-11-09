"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  Coins,
  CreditCard,
  Edit3,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { useStudio } from "@/components/providers";
import { ModalDialog } from "@/components/ui/modal-dialog";
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  type CreditPolicy,
  type CreditTransaction,
  type CreditTxType,
  type PlanId,
  type PublicUser,
  type UserRole,
  type UserStatus,
} from "@/lib/user-types";

interface UsersSummary {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalCreditsPool: number;
  totalCreditsUsed: number;
  lowBalanceUsers: number;
}

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "billing", label: "Billing" },
  { value: "member", label: "Member" },
];

const PLAN_OPTIONS: PlanId[] = [
  "free",
  "basic",
  "starter",
  "studio",
  "studio_max",
  "team",
  "team_pro",
  "enterprise",
];

const TX_TYPE_LABELS: Record<CreditTxType, string> = {
  topup: "Top-up",
  grant: "Admin Grant",
  deduct: "Deduction",
  usage: "AI Usage",
  plan_reset: "Plan Reset",
  refund: "Refund",
  signup_bonus: "Signup Bonus",
};

function formatDate(iso?: string | null): string {
  if (!iso) return "Never";
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

export default function UsersAndCreditsPage() {
  const { refreshStore, activeUser: contextActiveUser } = useStudio();

  const [tab, setTab] = useState<"users" | "credits">("users");
  const [loading, setLoading] = useState(true);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(null);

  // Directory state
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [activeUserId, setActiveUserId] = useState<string>("");
  const [summary, setSummary] = useState<UsersSummary>({
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    totalCreditsPool: 0,
    totalCreditsUsed: 0,
    lowBalanceUsers: 0,
  });

  // Users filters
  const [userQuery, setUserQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Credit ledger & policy state
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [txUserFilter, setTxUserFilter] = useState("all");
  const [txTypeFilter, setTxTypeFilter] = useState("all");
  const [txQuery, setTxQuery] = useState("");
  const [policy, setPolicy] = useState<CreditPolicy>({
    enforceBalance: true,
    defaultSignupCredits: 2000,
    lowBalanceThreshold: 500,
  });
  const [savingPolicy, setSavingPolicy] = useState(false);

  // Quick top-up selection in Credits tab
  const [quickTargetUserId, setQuickTargetUserId] = useState<string>("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Create/Edit User modal state
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<UserRole>("member");
  const [formStatus, setFormStatus] = useState<UserStatus>("active");
  const [formPlan, setFormPlan] = useState<PlanId>("free");
  const [formWorkspace, setFormWorkspace] = useState("SAKTTS Studio");
  const [formPassword, setFormPassword] = useState("");
  const [formInitialCredits, setFormInitialCredits] = useState("2000");
  const [formResetToPlan, setFormResetToPlan] = useState(false);
  const [formMakeActive, setFormMakeActive] = useState(false);
  const [userModalError, setUserModalError] = useState<string | null>(null);
  const [savingUser, setSavingUser] = useState(false);

  // Adjust Credits modal state
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditUserId, setCreditUserId] = useState("");
  const [creditType, setCreditType] = useState<CreditTxType>("topup");
  const [creditAmount, setCreditAmount] = useState("5000");
  const [creditReason, setCreditReason] = useState("");
  const [creditModalError, setCreditModalError] = useState<string | null>(null);
  const [savingCredit, setSavingCredit] = useState(false);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    title: string;
    description: string;
    confirmLabel: string;
    destructive?: boolean;
    onConfirm: () => Promise<void>;
  } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const showToast = (msg: string) => {
    setBannerError(null);
    setBannerSuccess(msg);
    setTimeout(() => {
      setBannerSuccess((cur) => (cur === msg ? null : cur));
    }, 4500);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, cRes] = await Promise.all([
        fetch("/api/users", { cache: "no-store" }),
        fetch("/api/credits", { cache: "no-store" }),
      ]);
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(uData.users ?? []);
        setActiveUserId(uData.activeUserId ?? "");
        if (uData.summary) setSummary(uData.summary);
        setQuickTargetUserId((prev) => prev || uData.activeUserId || uData.users?.[0]?.id || "");
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        setTransactions(cData.transactions ?? []);
        if (cData.creditPolicy) setPolicy(cData.creditPolicy);
      }
    } catch {
      setBannerError("Failed to load user and credit records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    try {
      const requestedTab = new URLSearchParams(window.location.search).get("tab");
      if (requestedTab === "credits") setTab("credits");
    } catch {
      // ignore
    }
    fetchAll();
  }, [fetchAll]);

  const activeUser = useMemo(
    () => users.find((u) => u.id === activeUserId) ?? contextActiveUser ?? users[0] ?? null,
    [users, activeUserId, contextActiveUser]
  );

  const filteredUsers = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      if (
        q &&
        !u.name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q) &&
        !u.workspace.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [users, userQuery, roleFilter, statusFilter]);

  const filteredTransactions = useMemo(() => {
    const q = txQuery.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (txUserFilter !== "all" && tx.userId !== txUserFilter) return false;
      if (txTypeFilter !== "all" && tx.type !== txTypeFilter) return false;
      if (
        q &&
        !tx.userName.toLowerCase().includes(q) &&
        !tx.userEmail.toLowerCase().includes(q) &&
        !tx.description.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [transactions, txUserFilter, txTypeFilter, txQuery]);

  const openCreateUserModal = () => {
    setEditingUser(null);
    setFormName("");
    setFormEmail("");
    setFormRole("member");
    setFormStatus("active");
    setFormPlan("free");
    setFormWorkspace(activeUser?.workspace || "SAKTTS Studio");
    setFormPassword("");
    setFormInitialCredits(String(policy.defaultSignupCredits));
    setFormResetToPlan(false);
    setFormMakeActive(false);
    setUserModalError(null);
    setUserModalOpen(true);
  };

  const openEditUserModal = (u: PublicUser) => {
    setEditingUser(u);
    setFormName(u.name);
    setFormEmail(u.email);
    setFormRole(u.role);
    setFormStatus(u.status);
    setFormPlan(u.plan);
    setFormWorkspace(u.workspace);
    setFormPassword("");
    setFormResetToPlan(false);
    setFormMakeActive(false);
    setUserModalError(null);
    setUserModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserModalError(null);

    if (!formName.trim()) {
      setUserModalError("Full name is required.");
      return;
    }
    if (!formEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formEmail.trim())) {
      setUserModalError("Please enter a valid email address.");
      return;
    }
    if (formPassword && formPassword.length < 6) {
      setUserModalError("Password must be at least 6 characters.");
      return;
    }

    setSavingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: editingUser ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          editingUser
            ? {
                id: editingUser.id,
                name: formName.trim(),
                email: formEmail.trim(),
                role: formRole,
                status: formStatus,
                plan: formPlan,
                workspace: formWorkspace.trim(),
                password: formPassword || undefined,
                resetCreditsToPlan: formResetToPlan,
              }
            : {
                name: formName.trim(),
                email: formEmail.trim(),
                role: formRole,
                status: formStatus,
                plan: formPlan,
                workspace: formWorkspace.trim(),
                password: formPassword || undefined,
                initialCredits: Math.max(0, Number(formInitialCredits) || 0),
                makeActive: formMakeActive,
              }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setUserModalError(data.error || "Unable to save user.");
        return;
      }
      setUserModalOpen(false);
      await Promise.all([fetchAll(), refreshStore()]);
      showToast(editingUser ? `Updated ${formEmail.trim()}` : `Added user ${formEmail.trim()}`);
    } catch {
      setUserModalError("Network error while saving user.");
    } finally {
      setSavingUser(false);
    }
  };

  const handleSwitchActiveUser = async (u: PublicUser) => {
    setBannerError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "switchActive", userId: u.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Failed to switch active user.");
        return;
      }
      await Promise.all([fetchAll(), refreshStore()]);
      showToast(`Signed in workspace session as ${u.name} (${u.email})`);
    } catch {
      setBannerError("Unable to switch active user.");
    }
  };

  const handleToggleSuspend = async (u: PublicUser) => {
    const nextStatus: UserStatus = u.status === "active" ? "suspended" : "active";
    setBannerError(null);
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id, status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Failed to update account status.");
        return;
      }
      await Promise.all([fetchAll(), refreshStore()]);
      showToast(`${u.name} is now ${nextStatus}.`);
    } catch {
      setBannerError("Network error while updating account status.");
    }
  };

  const openDeleteUserConfirm = (u: PublicUser) => {
    setConfirmState({
      title: "Delete User Account",
      description: `Remove ${u.name} (${u.email}) from this workspace? Their saved audit ledger entries stay intact for history.`,
      confirmLabel: "Delete User",
      destructive: true,
      onConfirm: async () => {
        const res = await fetch(`/api/users?id=${encodeURIComponent(u.id)}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Unable to delete user.");
        }
        await Promise.all([fetchAll(), refreshStore()]);
        showToast(`Deleted user ${u.email}`);
      },
    });
  };

  const openAdjustCreditsModal = (targetId?: string, presetType: CreditTxType = "topup") => {
    const fallbackId = targetId || activeUser?.id || users[0]?.id || "";
    setCreditUserId(fallbackId);
    setCreditType(presetType);
    setCreditAmount("5000");
    setCreditReason("");
    setCreditModalError(null);
    setCreditModalOpen(true);
  };

  const creditModalTargetUser = useMemo(
    () => users.find((u) => u.id === creditUserId) ?? null,
    [users, creditUserId]
  );

  const previewBalance = useMemo(() => {
    if (!creditModalTargetUser) return 0;
    const amt = Math.max(0, Math.round(Number(creditAmount) || 0));
    if (creditType === "plan_reset") {
      return PLAN_LIMITS[creditModalTargetUser.plan] ?? creditModalTargetUser.creditsLimit;
    }
    if (creditType === "deduct" || creditType === "usage") {
      return Math.max(0, creditModalTargetUser.creditsBalance - amt);
    }
    return creditModalTargetUser.creditsBalance + amt;
  }, [creditModalTargetUser, creditType, creditAmount]);

  const handleAdjustCredits = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreditModalError(null);
    const amt = Math.round(Number(creditAmount) || 0);
    if (creditType !== "plan_reset" && amt <= 0) {
      setCreditModalError("Enter a positive credit amount.");
      return;
    }
    setSavingCredit(true);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          userId: creditUserId,
          type: creditType,
          amount: amt,
          description: creditReason.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreditModalError(data.error || "Credit update failed.");
        return;
      }
      setCreditModalOpen(false);
      await Promise.all([fetchAll(), refreshStore()]);
      showToast(
        `Updated credits for ${data.user?.name ?? "user"} (${data.user?.creditsBalance?.toLocaleString() ?? ""} remaining)`
      );
    } catch {
      setCreditModalError("Network error while updating credits.");
    } finally {
      setSavingCredit(false);
    }
  };

  const handleQuickGrant = async (userId: string, amount: number, label: string) => {
    if (!userId) return;
    setBulkBusy(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "adjust",
          userId,
          type: "topup",
          amount,
          description: label,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Failed to add credits.");
        return;
      }
      await Promise.all([fetchAll(), refreshStore()]);
      showToast(`Added +${amount.toLocaleString()} credits to ${data.user?.email}`);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkGrant = async (target: "all_active" | "low_balance", amount: number) => {
    setBulkBusy(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "bulkGrant",
          target,
          amount,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Bulk grant failed.");
        return;
      }
      await Promise.all([fetchAll(), refreshStore()]);
      showToast(
        `Granted +${amount.toLocaleString()} credits to ${data.updatedCount} account(s).`
      );
    } finally {
      setBulkBusy(false);
    }
  };

  const openResetCycleConfirm = () => {
    setConfirmState({
      title: "Reset Monthly Credit Cycle",
      description:
        "Reset every active user's credit balance back to their current plan's monthly quota?",
      confirmLabel: "Reset Active Quotas",
      destructive: false,
      onConfirm: async () => {
        const res = await fetch("/api/credits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "resetCycle" }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Reset failed");
        await Promise.all([fetchAll(), refreshStore()]);
        showToast(`Reset monthly credits for ${data.updatedCount} active user(s).`);
      },
    });
  };

  const handleSavePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPolicy(true);
    setBannerError(null);
    try {
      const res = await fetch("/api/credits", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const data = await res.json();
      if (!res.ok) {
        setBannerError(data.error || "Failed to save policy.");
        return;
      }
      if (data.creditPolicy) setPolicy(data.creditPolicy);
      await refreshStore();
      showToast("Credit enforcement & threshold policy saved.");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handleDeleteTx = async (txId: string) => {
    await fetch(`/api/credits?id=${encodeURIComponent(txId)}`, { method: "DELETE" });
    fetchAll();
  };

  const openClearLedgerConfirm = () => {
    setConfirmState({
      title: "Clear Credit Audit Ledger",
      description:
        "Remove all recorded transaction log entries? User credit balances will not be modified.",
      confirmLabel: "Clear Ledger",
      destructive: true,
      onConfirm: async () => {
        const res = await fetch("/api/credits?clear=1", { method: "DELETE" });
        if (!res.ok) throw new Error("Failed to clear ledger");
        await fetchAll();
        showToast("Cleared credit audit ledger.");
      },
    });
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="max-w-xl">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Users & Credit Management
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Create and manage workspace users, switch active accounts, enforce credit quotas, and
            audit every credit grant or deduction.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openResetCycleConfirm}
            className="bg-card border-border/70 hover:bg-foreground/[0.04] inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reset Cycle
          </button>
          <button
            type="button"
            onClick={() => openAdjustCreditsModal(activeUser?.id, "topup")}
            className="bg-card border-border/70 hover:bg-foreground/[0.04] inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 text-xs font-semibold transition-colors"
          >
            <Coins className="h-3.5 w-3.5" aria-hidden="true" />
            Adjust Credits
          </button>
          <button
            type="button"
            onClick={openCreateUserModal}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center gap-1.5 rounded-full px-4 text-xs font-semibold transition-colors"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            Add User
          </button>
        </div>
      </div>

      {/* Feedback Alerts */}
      {bannerError && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{bannerError}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerError(null)}
            className="text-xs underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {bannerSuccess && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/35 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{bannerSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setBannerSuccess(null)}
            className="text-xs underline underline-offset-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Active Session Strip */}
      {activeUser && (
        <div className="bg-card border-border/60 flex flex-col justify-between gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 items-center gap-3.5">
            <div className="bg-foreground text-background flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold uppercase">
              {activeUser.name.slice(0, 2)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold">{activeUser.name}</span>
                <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                  <UserCheck className="h-3 w-3" aria-hidden="true" />
                  Active Session
                </span>
                <span className="bg-foreground/[0.07] rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase">
                  {activeUser.role}
                </span>
              </div>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {activeUser.email} · {activeUser.workspace} ·{" "}
                <strong className="text-foreground font-mono">
                  {activeUser.plan === "enterprise"
                    ? "Unlimited"
                    : `${activeUser.creditsBalance.toLocaleString()} / ${activeUser.creditsLimit.toLocaleString()}`}{" "}
                  credits
                </strong>
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() =>
                handleQuickGrant(
                  activeUser.id,
                  5000,
                  "Instant +5,000 top-up for active session"
                )
              }
              className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
              +5,000 Top Up
            </button>
            <Link
              href="/dashboard/billing"
              className="border-border/70 hover:bg-foreground/[0.04] inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-medium"
            >
              Billing &amp; Plans
            </Link>
            <Link
              href="/dashboard/settings"
              className="border-border/70 hover:bg-foreground/[0.04] inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-medium"
            >
              API Keys
            </Link>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Workspace Users</span>
            <Users className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {summary.totalUsers}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {summary.activeUsers} active · {summary.suspendedUsers} suspended
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Available Credits Pool</span>
            <Coins className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {summary.totalCreditsPool.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            Combined across all user seats
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Total Credits Used</span>
            <Sparkles className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 font-mono text-3xl font-semibold tabular-nums">
            {summary.totalCreditsUsed.toLocaleString()}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {transactions.length} ledger event(s) logged
          </p>
        </div>

        <div className="bg-card rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="text-muted-foreground flex items-center justify-between text-xs font-medium">
            <span>Balance Enforcement</span>
            <Shield className="h-4 w-4" aria-hidden="true" />
          </div>
          <p className="mt-2 text-xl font-semibold">
            {policy.enforceBalance ? "Enforced (Strict)" : "Soft Limit"}
          </p>
          <p className="text-muted-foreground mt-1 text-xs">
            {summary.lowBalanceUsers > 0 ? (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                {summary.lowBalanceUsers} user(s) ≤ {policy.lowBalanceThreshold.toLocaleString()} cr
              </span>
            ) : (
              `Warn below ${policy.lowBalanceThreshold.toLocaleString()} cr`
            )}
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        role="tablist"
        aria-label="Management views"
        className="bg-card border-border/60 inline-flex rounded-full border p-1"
      >
        <button
          type="button"
          role="tab"
          id="tab-users"
          aria-selected={tab === "users"}
          aria-controls="panel-users"
          onClick={() => setTab("users")}
          className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors ${
            tab === "users"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          Users Directory ({users.length})
        </button>
        <button
          type="button"
          role="tab"
          id="tab-credits"
          aria-selected={tab === "credits"}
          aria-controls="panel-credits"
          onClick={() => setTab("credits")}
          className={`inline-flex min-h-9 items-center gap-2 rounded-full px-4 text-xs font-semibold transition-colors ${
            tab === "credits"
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
          Credit Management & Ledger ({transactions.length})
        </button>
      </div>

      {/* TAB 1: USERS DIRECTORY */}
      {tab === "users" && (
        <section
          role="tabpanel"
          id="panel-users"
          aria-labelledby="tab-users"
          className="bg-card space-y-4 rounded-3xl p-5 ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]"
        >
          {/* Search & Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
                aria-hidden="true"
              />
              <label htmlFor="users-search" className="sr-only">
                Search users by name, email, or workspace
              </label>
              <input
                id="users-search"
                type="search"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="Search name, email, workspace…"
                className="bg-workspace border-border/70 min-h-10 w-full rounded-full border pr-4 pl-9 text-base sm:text-xs outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <label htmlFor="filter-role" className="sr-only">
                Filter by role
              </label>
              <select
                id="filter-role"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="bg-workspace border-border/70 min-h-10 rounded-full border px-3.5 text-xs font-medium outline-none"
              >
                <option value="all">All Roles</option>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>

              <label htmlFor="filter-status" className="sr-only">
                Filter by account status
              </label>
              <select
                id="filter-status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-workspace border-border/70 min-h-10 rounded-full border px-3.5 text-xs font-medium outline-none"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="suspended">Suspended Only</option>
              </select>

              <button
                type="button"
                onClick={fetchAll}
                aria-label="Refresh user directory"
                className="border-border/70 hover:bg-foreground/[0.04] inline-flex h-10 w-10 items-center justify-center rounded-full border"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div
            tabIndex={0}
            role="region"
            aria-labelledby="users-table-caption"
            className="saktts-table-wrap border-border/50 border"
          >
            <table
              className="saktts-data-table"
              style={
                {
                  "--col-2": '"Role"',
                  "--col-3": '"Plan"',
                  "--col-4": '"Credits"',
                  "--col-5": '"Used"',
                  "--col-6": '"Status"',
                  "--col-7": '"Actions"',
                } as React.CSSProperties
              }
            >
              <caption id="users-table-caption" className="px-3.5 pt-3">
                Showing {filteredUsers.length} of {users.length} workspace account(s).
              </caption>
              <thead>
                <tr>
                  <th scope="col">User</th>
                  <th scope="col">Role</th>
                  <th scope="col">Plan</th>
                  <th scope="col">Credits</th>
                  <th scope="col">Used</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                      No user accounts match the current filters.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isCurrent = u.id === activeUserId;
                    const isLow =
                      u.status === "active" &&
                      u.plan !== "enterprise" &&
                      u.creditsBalance <= policy.lowBalanceThreshold;
                    const pct =
                      u.plan === "enterprise"
                        ? 100
                        : Math.min(100, Math.round((u.creditsBalance / Math.max(1, u.creditsLimit)) * 100));

                    return (
                      <tr key={u.id}>
                        <th scope="row">
                          <div className="flex items-center gap-2.5">
                            <span className="bg-foreground/[0.08] flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold uppercase">
                              {u.name.slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-semibold">{u.name}</span>
                                {isCurrent && (
                                  <span className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                                    Current
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground text-xs font-normal">
                                {u.email}
                              </p>
                              <p className="text-muted-foreground/80 text-[11px] font-normal">
                                {u.workspace} · Active {formatDate(u.lastActiveAt)}
                              </p>
                            </div>
                          </div>
                        </th>

                        <td>
                          <span className="bg-foreground/[0.06] inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize">
                            <ShieldCheck className="h-3 w-3 opacity-70" aria-hidden="true" />
                            {u.role}
                          </span>
                        </td>

                        <td>
                          <span className="border-border/70 inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium">
                            {PLAN_LABELS[u.plan]?.label ?? u.plan}
                          </span>
                        </td>

                        <td>
                          <div className="min-w-[112px] space-y-1 text-right sm:text-left">
                            <div className="flex items-center justify-end gap-1.5 font-mono text-xs font-semibold tabular-nums sm:justify-start">
                              <span className={isLow ? "text-amber-600 dark:text-amber-400" : ""}>
                                {u.plan === "enterprise"
                                  ? "Unlimited"
                                  : u.creditsBalance.toLocaleString()}
                              </span>
                              {u.plan !== "enterprise" && (
                                <span className="text-muted-foreground font-normal">
                                  / {u.creditsLimit.toLocaleString()}
                                </span>
                              )}
                              {isLow && (
                                <AlertTriangle
                                  className="h-3.5 w-3.5 text-amber-500"
                                  aria-label="Low credit balance"
                                />
                              )}
                            </div>
                            <div className="bg-foreground/[0.08] h-1.5 w-full overflow-hidden rounded-full">
                              <div
                                className={`h-full rounded-full ${
                                  isLow ? "bg-amber-500" : "bg-foreground"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="font-mono text-xs tabular-nums">
                          {u.creditsUsedTotal.toLocaleString()}
                        </td>

                        <td>
                          {u.status === "active" ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                              <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              Active
                            </span>
                          ) : (
                            <span className="bg-destructive/12 text-destructive inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold">
                              <Ban className="h-3 w-3" aria-hidden="true" />
                              Suspended
                            </span>
                          )}
                        </td>

                        <td>
                          <div className="flex flex-wrap items-center justify-end gap-1 sm:flex-nowrap">
                            <button
                              type="button"
                              onClick={() => openAdjustCreditsModal(u.id, "topup")}
                              className="bg-foreground/[0.06] hover:bg-foreground/[0.12] inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[11px] font-medium whitespace-nowrap"
                              title="Top up or deduct credits"
                            >
                              <Coins className="h-3 w-3" aria-hidden="true" />
                              Credits
                            </button>
                            {!isCurrent && u.status === "active" && (
                              <button
                                type="button"
                                onClick={() => handleSwitchActiveUser(u)}
                                className="border-border/70 hover:bg-foreground/[0.05] inline-flex min-h-7 shrink-0 items-center gap-1 rounded-full border px-2 text-[11px] font-medium whitespace-nowrap"
                                title="Switch active workspace session to this user"
                              >
                                <UserCheck className="h-3 w-3" aria-hidden="true" />
                                Switch
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              aria-label={`Edit ${u.name}`}
                              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            >
                              <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleToggleSuspend(u)}
                              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] inline-flex min-h-7 shrink-0 items-center rounded-full px-2 text-[11px] font-medium whitespace-nowrap"
                            >
                              {u.status === "active" ? "Suspend" : "Activate"}
                            </button>
                            <button
                              type="button"
                              onClick={() => openDeleteUserConfirm(u)}
                              aria-label={`Delete ${u.name}`}
                              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: CREDIT MANAGEMENT & LEDGER */}
      {tab === "credits" && (
        <section
          role="tabpanel"
          id="panel-credits"
          aria-labelledby="tab-credits"
          className="space-y-6"
        >
          {/* Control Strip: Quick Allocation + Policy */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Quick Credits & Bulk Actions */}
            <div className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <Zap className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  Quick Credit Allocation
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Add credit packs to an account immediately or grant bonus credits across seats.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="quick-credit-user" className="block text-xs font-semibold">
                  Target Account
                </label>
                <select
                  id="quick-credit-user"
                  value={quickTargetUserId}
                  onChange={(e) => setQuickTargetUserId(e.target.value)}
                  className="bg-workspace border-border/70 min-h-11 w-full rounded-2xl border px-3.5 text-sm outline-none"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) —{" "}
                      {u.plan === "enterprise"
                        ? "Unlimited"
                        : `${u.creditsBalance.toLocaleString()} cr`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[1000, 5000, 25000, 100000].map((pack) => (
                  <button
                    key={pack}
                    type="button"
                    disabled={bulkBusy || !quickTargetUserId}
                    onClick={() =>
                      handleQuickGrant(
                        quickTargetUserId,
                        pack,
                        `Quick pack top-up (+${pack.toLocaleString()} credits)`
                      )
                    }
                    className="border-border/70 hover:bg-foreground/[0.05] flex min-h-10 items-center justify-center rounded-2xl border font-mono text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    +{pack.toLocaleString()}
                  </button>
                ))}
              </div>

              <div className="border-border/50 flex flex-wrap gap-2 border-t pt-3">
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => handleBulkGrant("low_balance", 2000)}
                  className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  Boost Low-Balance (+2,000)
                </button>
                <button
                  type="button"
                  disabled={bulkBusy}
                  onClick={() => handleBulkGrant("all_active", 1000)}
                  className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Users className="h-3.5 w-3.5" aria-hidden="true" />
                  Bonus All Active (+1,000)
                </button>
              </div>
            </div>

            {/* Credit Enforcement Policy */}
            <form
              method="POST"
              onSubmit={handleSavePolicy}
              className="bg-card space-y-4 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
            >
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold">
                  <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                  Credit Policy & Limits
                </h2>
                <p className="text-muted-foreground mt-0.5 text-xs">
                  Configure balance enforcement for TTS, cloning, STT, and music endpoints.
                </p>
              </div>

              <label
                htmlFor="policy-enforce"
                className="bg-workspace border-border/60 flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5"
              >
                <input
                  id="policy-enforce"
                  name="enforceBalance"
                  type="checkbox"
                  checked={policy.enforceBalance}
                  onChange={(e) =>
                    setPolicy((p) => ({ ...p, enforceBalance: e.target.checked }))
                  }
                  className="mt-0.5 h-4 w-4 rounded"
                />
                <span>
                  <span className="block text-xs font-semibold">
                    Enforce strict credit balance check
                  </span>
                  <span className="text-muted-foreground block text-[11px]">
                    Reject Studio/API synthesis with HTTP 402 when an account does not have enough
                    credits (Enterprise exempt).
                  </span>
                </span>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label htmlFor="policy-signup-bonus" className="block text-xs font-semibold">
                    Default Signup Bonus
                  </label>
                  <input
                    id="policy-signup-bonus"
                    name="defaultSignupCredits"
                    type="number"
                    min={0}
                    step={100}
                    value={policy.defaultSignupCredits}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        defaultSignupCredits: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="bg-workspace border-border/70 min-h-10 w-full rounded-2xl border px-3.5 font-mono text-base sm:text-sm outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="policy-low-threshold" className="block text-xs font-semibold">
                    Low-Balance Warning
                  </label>
                  <input
                    id="policy-low-threshold"
                    name="lowBalanceThreshold"
                    type="number"
                    min={0}
                    step={50}
                    value={policy.lowBalanceThreshold}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        lowBalanceThreshold: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="bg-workspace border-border/70 min-h-10 w-full rounded-2xl border px-3.5 font-mono text-base sm:text-sm outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingPolicy}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center rounded-full px-5 text-xs font-semibold disabled:opacity-50"
                >
                  {savingPolicy ? "Saving…" : "Save Credit Policy"}
                </button>
              </div>
            </form>
          </div>

          {/* Audit Ledger Table */}
          <div className="bg-card space-y-4 rounded-3xl p-5 ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1 sm:max-w-xs">
                <Search
                  className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2"
                  aria-hidden="true"
                />
                <label htmlFor="tx-search" className="sr-only">
                  Search ledger entries
                </label>
                <input
                  id="tx-search"
                  type="search"
                  value={txQuery}
                  onChange={(e) => setTxQuery(e.target.value)}
                  placeholder="Search user or description…"
                  className="bg-workspace border-border/70 min-h-10 w-full rounded-full border pr-4 pl-9 text-base sm:text-xs outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="tx-user-filter" className="sr-only">
                  Filter ledger by user
                </label>
                <select
                  id="tx-user-filter"
                  value={txUserFilter}
                  onChange={(e) => setTxUserFilter(e.target.value)}
                  className="bg-workspace border-border/70 min-h-10 rounded-full border px-3.5 text-xs font-medium outline-none"
                >
                  <option value="all">All Accounts</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>

                <label htmlFor="tx-type-filter" className="sr-only">
                  Filter ledger by transaction type
                </label>
                <select
                  id="tx-type-filter"
                  value={txTypeFilter}
                  onChange={(e) => setTxTypeFilter(e.target.value)}
                  className="bg-workspace border-border/70 min-h-10 rounded-full border px-3.5 text-xs font-medium outline-none"
                >
                  <option value="all">All Types</option>
                  {Object.entries(TX_TYPE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>

                {transactions.length > 0 && (
                  <button
                    type="button"
                    onClick={openClearLedgerConfirm}
                    className="border-border/70 text-muted-foreground hover:text-destructive min-h-10 rounded-full border px-3.5 text-xs font-medium"
                  >
                    Clear Ledger
                  </button>
                )}
              </div>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby="ledger-table-caption"
              className="saktts-table-wrap border-border/50 border"
            >
              <table
                className="saktts-data-table"
                style={
                  {
                    "--col-2": '"Account"',
                    "--col-3": '"Type"',
                    "--col-4": '"Amount"',
                    "--col-5": '"Balance After"',
                    "--col-6": '"Details"',
                    "--col-7": '"Remove"',
                  } as React.CSSProperties
                }
              >
                <caption id="ledger-table-caption" className="px-3.5 pt-3">
                  Showing {filteredTransactions.length} credit ledger transaction(s).
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Time</th>
                    <th scope="col">Account</th>
                    <th scope="col">Type</th>
                    <th scope="col">Amount</th>
                    <th scope="col">Balance After</th>
                    <th scope="col">Details</th>
                    <th scope="col" className="text-right">
                      Remove
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-muted-foreground py-8 text-center text-sm">
                        No credit transactions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isPositive = tx.amount >= 0;
                      return (
                        <tr key={tx.id}>
                          <th scope="row" className="text-xs whitespace-nowrap">
                            {formatDate(tx.createdAt)}
                          </th>
                          <td>
                            <div className="min-w-0 text-right sm:text-left">
                              <p className="text-xs font-semibold">{tx.userName}</p>
                              <p className="text-muted-foreground text-[11px]">{tx.userEmail}</p>
                            </div>
                          </td>
                          <td>
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                isPositive
                                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                  : "bg-amber-500/12 text-amber-700 dark:text-amber-300"
                              }`}
                            >
                              {isPositive ? (
                                <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <ArrowDownRight className="h-3 w-3" aria-hidden="true" />
                              )}
                              {TX_TYPE_LABELS[tx.type] ?? tx.type}
                            </span>
                          </td>
                          <td
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              isPositive
                                ? "text-emerald-700 dark:text-emerald-300"
                                : "text-amber-700 dark:text-amber-300"
                            }`}
                          >
                            {tx.amount > 0 ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()}
                          </td>
                          <td className="font-mono text-xs tabular-nums">
                            {tx.balanceAfter.toLocaleString()}
                          </td>
                          <td className="max-w-xs text-xs">
                            <p className="truncate">{tx.description}</p>
                            {tx.actorEmail && (
                              <p className="text-muted-foreground text-[11px]">
                                by {tx.actorEmail}
                              </p>
                            )}
                          </td>
                          <td className="text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteTx(tx.id)}
                              aria-label={`Delete ledger entry ${tx.id}`}
                              className="text-muted-foreground hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-full"
                            >
                              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          </td>
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

      {/* ADD / EDIT USER MODAL */}
      <ModalDialog
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? `Edit ${editingUser.name}` : "Add Workspace User"}
        description={
          editingUser
            ? "Update role, status, subscription tier, workspace, or password."
            : "Create a new account with its own role, plan, and starting credit balance."
        }
        maxWidthClass="max-w-lg"
      >
        <form method="POST" onSubmit={handleSaveUser} className="space-y-4">
          {userModalError && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{userModalError}</span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="u-name" className="block text-xs font-semibold">
                Full Name
              </label>
              <input
                id="u-name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Sokha Dara"
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="u-email" className="block text-xs font-semibold">
                Email Address
              </label>
              <input
                id="u-email"
                name="email"
                type="email"
                inputMode="email"
                required
                spellCheck={false}
                autoCorrect="off"
                autoCapitalize="off"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="member@saktts.ai"
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="u-role" className="block text-xs font-semibold">
                Role
              </label>
              <select
                id="u-role"
                name="role"
                value={formRole}
                onChange={(e) => setFormRole(e.target.value as UserRole)}
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3 text-base sm:text-sm outline-none"
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="u-plan" className="block text-xs font-semibold">
                Plan Tier
              </label>
              <select
                id="u-plan"
                name="plan"
                value={formPlan}
                onChange={(e) => {
                  const nextPlan = e.target.value as PlanId;
                  setFormPlan(nextPlan);
                  if (!editingUser) {
                    setFormInitialCredits(
                      String(
                        nextPlan === "free"
                          ? policy.defaultSignupCredits
                          : PLAN_LIMITS[nextPlan]
                      )
                    );
                  }
                }}
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3 text-base sm:text-sm outline-none"
              >
                {PLAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {PLAN_LABELS[p].label} ({PLAN_LABELS[p].price})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="u-status" className="block text-xs font-semibold">
                Status
              </label>
              <select
                id="u-status"
                name="status"
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as UserStatus)}
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3 text-base sm:text-sm outline-none"
              >
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="u-workspace" className="block text-xs font-semibold">
                Workspace Name
              </label>
              <input
                id="u-workspace"
                name="workspace"
                type="text"
                value={formWorkspace}
                onChange={(e) => setFormWorkspace(e.target.value)}
                placeholder="Khmer News Studio"
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="u-password" className="block text-xs font-semibold">
                {editingUser ? "New Password (optional)" : "Password (optional)"}
              </label>
              <input
                id="u-password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                placeholder="Min 6 characters"
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
              />
            </div>
          </div>

          {!editingUser ? (
            <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
              <div className="space-y-1.5">
                <label htmlFor="u-initial-credits" className="block text-xs font-semibold">
                  Starting Credits
                </label>
                <input
                  id="u-initial-credits"
                  name="initialCredits"
                  type="number"
                  min={0}
                  value={formInitialCredits}
                  onChange={(e) => setFormInitialCredits(e.target.value)}
                  className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 font-mono text-base sm:text-sm outline-none"
                />
              </div>

              <label
                htmlFor="u-make-active"
                className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium"
              >
                <input
                  id="u-make-active"
                  name="makeActive"
                  type="checkbox"
                  checked={formMakeActive}
                  onChange={(e) => setFormMakeActive(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>Switch active studio session to new user</span>
              </label>
            </div>
          ) : (
            <label
              htmlFor="u-reset-plan-credits"
              className="bg-workspace border-border/60 flex cursor-pointer items-center gap-2.5 rounded-2xl border p-3 text-xs font-medium"
            >
              <input
                id="u-reset-plan-credits"
                name="resetCreditsToPlan"
                type="checkbox"
                checked={formResetToPlan}
                onChange={(e) => setFormResetToPlan(e.target.checked)}
                className="h-4 w-4 rounded"
              />
              <span>
                Also reset credit balance to {PLAN_LABELS[formPlan].label} quota (
                {formPlan === "enterprise"
                  ? "Unlimited"
                  : PLAN_LIMITS[formPlan].toLocaleString()}{" "}
                credits)
              </span>
            </label>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.11] min-h-11 rounded-full px-5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingUser}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 rounded-full px-6 text-sm font-semibold disabled:opacity-50"
            >
              {savingUser ? "Saving…" : editingUser ? "Save Changes" : "Create User"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* ADJUST CREDITS MODAL */}
      <ModalDialog
        open={creditModalOpen}
        onClose={() => setCreditModalOpen(false)}
        title="Adjust User Credits"
        description="Add top-ups, issue refunds, deduct usage, or reset to plan quota."
        maxWidthClass="max-w-md"
      >
        <form method="POST" onSubmit={handleAdjustCredits} className="space-y-4">
          {creditModalError && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{creditModalError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="c-user" className="block text-xs font-semibold">
              Account
            </label>
            <select
              id="c-user"
              name="userId"
              value={creditUserId}
              onChange={(e) => setCreditUserId(e.target.value)}
              className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) — {u.creditsBalance.toLocaleString()} cr
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="c-type" className="block text-xs font-semibold">
              Adjustment Type
            </label>
            <select
              id="c-type"
              name="type"
              value={creditType}
              onChange={(e) => setCreditType(e.target.value as CreditTxType)}
              className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
            >
              <option value="topup">Top-up Credits (+)</option>
              <option value="grant">Admin Bonus Grant (+)</option>
              <option value="refund">Service Credit Refund (+)</option>
              <option value="deduct">Manual Credit Deduction (-)</option>
              <option value="plan_reset">Reset to Plan Quota</option>
            </select>
          </div>

          {creditType !== "plan_reset" && (
            <div className="space-y-2">
              <label htmlFor="c-amount" className="block text-xs font-semibold">
                Credit Amount
              </label>
              <input
                id="c-amount"
                name="amount"
                type="number"
                min={1}
                required
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 font-mono text-base sm:text-sm outline-none"
              />
              <div className="grid grid-cols-4 gap-1.5">
                {[500, 2000, 5000, 25000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setCreditAmount(String(preset))}
                    className="border-border/70 hover:bg-foreground/[0.05] min-h-8 rounded-full border font-mono text-[11px] font-medium"
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="c-reason" className="block text-xs font-semibold">
              Reason / Note
            </label>
            <input
              id="c-reason"
              name="description"
              type="text"
              value={creditReason}
              onChange={(e) => setCreditReason(e.target.value)}
              placeholder="Monthly invoice paid, support refund, etc."
              className="bg-workspace border-border/75 min-h-11 w-full rounded-2xl border px-3.5 text-base sm:text-sm outline-none"
            />
          </div>

          {creditModalTargetUser && (
            <div className="bg-workspace border-border/60 flex items-center justify-between rounded-2xl border px-4 py-3 text-xs">
              <span className="text-muted-foreground">Balance preview</span>
              <span className="font-mono font-semibold tabular-nums">
                {creditModalTargetUser.creditsBalance.toLocaleString()} →{" "}
                <strong className="text-foreground">{previewBalance.toLocaleString()}</strong> cr
              </span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setCreditModalOpen(false)}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.11] min-h-11 rounded-full px-5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingCredit}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-h-11 rounded-full px-6 text-sm font-semibold disabled:opacity-50"
            >
              {savingCredit ? "Applying…" : "Apply Adjustment"}
            </button>
          </div>
        </form>
      </ModalDialog>

      {/* CONFIRMATION MODAL */}
      <ModalDialog
        open={confirmState !== null}
        onClose={() => !confirmBusy && setConfirmState(null)}
        title={confirmState?.title ?? "Confirm Action"}
        description={confirmState?.description}
        maxWidthClass="max-w-md"
      >
        {confirmState && (
          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={confirmBusy}
              onClick={() => setConfirmState(null)}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.11] min-h-11 rounded-full px-5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={confirmBusy}
              onClick={async () => {
                setConfirmBusy(true);
                try {
                  await confirmState.onConfirm();
                  setConfirmState(null);
                } catch (err) {
                  setBannerError(err instanceof Error ? err.message : "Action failed");
                  setConfirmState(null);
                } finally {
                  setConfirmBusy(false);
                }
              }}
              className={`min-h-11 rounded-full px-6 text-sm font-semibold disabled:opacity-50 ${
                confirmState.destructive
                  ? "bg-destructive text-destructive-foreground hover:opacity-90"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              {confirmBusy ? "Working…" : confirmState.confirmLabel}
            </button>
          </div>
        )}
      </ModalDialog>
    </div>
  );
}
