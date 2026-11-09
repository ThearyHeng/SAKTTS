import { NextRequest, NextResponse } from "next/server";
import {
  PLAN_LIMITS,
  adjustUserCredits,
  appendTransaction,
  readStore,
  resolveUserFromStore,
  toPublicUser,
  writeStore,
  type CreditTxType,
} from "@/lib/store";
import { getSessionUserId } from "@/lib/auth-session";

const ADJUST_TYPES = new Set<CreditTxType>([
  "topup",
  "grant",
  "deduct",
  "refund",
  "plan_reset",
]);

export async function GET(req: NextRequest) {
  const store = readStore();
  const active = resolveUserFromStore(store, getSessionUserId(req));

  const userIdFilter = req.nextUrl.searchParams.get("userId") ?? "";
  const typeFilter = req.nextUrl.searchParams.get("type") ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim().toLowerCase() ?? "";

  const transactions = store.creditTransactions.filter((tx) => {
    if (userIdFilter && userIdFilter !== "all" && tx.userId !== userIdFilter) return false;
    if (typeFilter && typeFilter !== "all" && tx.type !== typeFilter) return false;
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

  const threshold = store.creditPolicy.lowBalanceThreshold ?? 500;
  return NextResponse.json({
    transactions,
    users: store.users.map(toPublicUser),
    activeUserId: active.id,
    creditPolicy: store.creditPolicy,
    stats: {
      totalTransactions: store.creditTransactions.length,
      totalGranted: store.creditTransactions
        .filter((tx) => tx.amount > 0)
        .reduce((sum, tx) => sum + tx.amount, 0),
      totalConsumed: store.creditTransactions
        .filter((tx) => tx.amount < 0)
        .reduce((sum, tx) => sum + Math.abs(tx.amount), 0),
      lowBalanceUsers: store.users.filter(
        (u) => u.status === "active" && u.plan !== "enterprise" && u.creditsBalance <= threshold
      ).length,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = readStore();
    const actor = resolveUserFromStore(store, getSessionUserId(req));
    if (actor.role !== "owner" && actor.role !== "admin" && actor.role !== "billing") {
      return NextResponse.json(
        {
          error:
            "Manual credit adjustments require Owner, Admin, or Billing permissions. Use KHQR checkout to top up credits.",
        },
        { status: 403 }
      );
    }
    const action = String(body.action ?? "adjust");

    if (action === "adjust") {
      const userId = String(body.userId ?? activeUserFallback(store, actor.id)).trim();
      const type: CreditTxType = ADJUST_TYPES.has(body.type) ? body.type : "topup";
      const amount = Number(body.amount ?? 0);
      const description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : type === "deduct"
          ? "Manual admin credit deduction"
          : type === "plan_reset"
          ? "Reset balance to plan monthly quota"
          : type === "refund"
          ? "Service credit refund"
          : "Manual credit top-up";

      if (type !== "plan_reset" && (!Number.isFinite(amount) || amount <= 0)) {
        return NextResponse.json(
          { error: "Credit amount must be a positive number" },
          { status: 400 }
        );
      }

      const result = adjustUserCredits({
        userId,
        type,
        amount,
        description,
        feature: "admin",
        actorEmail: actor.email,
      });

      return NextResponse.json({
        user: toPublicUser(result.user),
        transaction: result.transaction,
        creditPolicy: result.store.creditPolicy,
      });
    }

    if (action === "bulkGrant") {
      const amount = Math.round(Number(body.amount ?? 0));
      if (!Number.isFinite(amount) || amount <= 0) {
        return NextResponse.json(
          { error: "Bulk grant amount must be positive" },
          { status: 400 }
        );
      }
      const targetMode = body.target === "low_balance" ? "low_balance" : "all_active";
      const threshold = store.creditPolicy.lowBalanceThreshold ?? 500;
      const description =
        typeof body.description === "string" && body.description.trim()
          ? body.description.trim()
          : targetMode === "low_balance"
          ? `Low-balance boost (+${amount.toLocaleString()} credits)`
          : `Workspace bonus grant (+${amount.toLocaleString()} credits)`;

      const targets = store.users.filter((u) => {
        if (u.status !== "active") return false;
        if (targetMode === "low_balance") {
          return u.plan !== "enterprise" && u.creditsBalance <= threshold;
        }
        return true;
      });

      const createdTxs = targets.map((u) => {
        u.creditsBalance += amount;
        return appendTransaction(store, {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          type: "grant",
          amount,
          balanceAfter: u.creditsBalance,
          feature: "admin",
          description,
          actorEmail: actor.email,
        });
      });

      writeStore(store);
      return NextResponse.json({
        updatedCount: targets.length,
        transactions: createdTxs,
      });
    }

    if (action === "resetCycle") {
      const specificUserId = typeof body.userId === "string" ? body.userId.trim() : "";
      const targets = store.users.filter((u) => {
        if (specificUserId) return u.id === specificUserId;
        return u.status === "active";
      });

      if (targets.length === 0) {
        return NextResponse.json({ error: "No matching active users found" }, { status: 404 });
      }

      for (const u of targets) {
        const quota = PLAN_LIMITS[u.plan] ?? u.creditsLimit;
        const delta = quota - u.creditsBalance;
        u.creditsLimit = quota;
        u.creditsBalance = quota;
        appendTransaction(store, {
          userId: u.id,
          userName: u.name,
          userEmail: u.email,
          type: "plan_reset",
          amount: delta,
          balanceAfter: quota,
          feature: "billing",
          description: `Monthly billing quota reset (${u.plan} · ${quota.toLocaleString()})`,
          actorEmail: actor.email,
        });
      }

      writeStore(store);
      return NextResponse.json({
        updatedCount: targets.length,
      });
    }

    return NextResponse.json({ error: "Unsupported credit action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Credit operation failed" },
      { status: 400 }
    );
  }
}

function activeUserFallback(store: { activeUserId: string; users: Array<{ id: string }> }, actorId: string): string {
  return actorId || store.activeUserId || store.users[0]?.id || "";
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = readStore();
    const actor = resolveUserFromStore(store, getSessionUserId(req));
    if (actor.role !== "owner" && actor.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (typeof body.enforceBalance === "boolean") {
      store.creditPolicy.enforceBalance = body.enforceBalance;
    }
    if (typeof body.defaultSignupCredits === "number" && Number.isFinite(body.defaultSignupCredits)) {
      store.creditPolicy.defaultSignupCredits = Math.max(0, Math.round(body.defaultSignupCredits));
    }
    if (typeof body.lowBalanceThreshold === "number" && Number.isFinite(body.lowBalanceThreshold)) {
      store.creditPolicy.lowBalanceThreshold = Math.max(0, Math.round(body.lowBalanceThreshold));
    }

    writeStore(store);
    return NextResponse.json({ creditPolicy: store.creditPolicy });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update policy" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const clear = req.nextUrl.searchParams.get("clear");
  const store = readStore();
  const actor = resolveUserFromStore(store, getSessionUserId(req));
  if (actor.role !== "owner" && actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (clear === "1") {
    store.creditTransactions = [];
  } else if (id) {
    store.creditTransactions = store.creditTransactions.filter((tx) => tx.id !== id);
  } else {
    return NextResponse.json({ error: "Specify ?id=... or ?clear=1" }, { status: 400 });
  }

  writeStore(store);
  return NextResponse.json({ ok: true, transactions: store.creditTransactions });
}
