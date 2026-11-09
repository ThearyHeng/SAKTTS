import { NextRequest, NextResponse } from "next/server";
import {
  PLAN_LIMITS,
  adjustUserCredits,
  normalizePlan,
  readStore,
  resolveUserFromStore,
  toPublicUser,
  updateUserAccount,
  writeStore,
} from "@/lib/store";
import { getSessionUserId } from "@/lib/auth-session";

export async function GET(req: NextRequest) {
  const store = readStore();
  const active = resolveUserFromStore(store, getSessionUserId(req));

  return NextResponse.json({
    plan: active.plan,
    creditsBalance: active.creditsBalance,
    creditsLimit: active.creditsLimit,
    user: {
      name: active.name,
      email: active.email,
      workspace: active.workspace,
    },
    activeUser: toPublicUser(active),
    creditPolicy: store.creditPolicy,
    customVoices: store.customVoices,
    history: store.history,
    apiKeys: store.apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const store = readStore();
    const active = resolveUserFromStore(store, getSessionUserId(req));
    const isAdminOrOwner = active.role === "owner" || active.role === "admin";

    if (body.plan && String(body.plan) in PLAN_LIMITS) {
      const nextPlan = normalizePlan(String(body.plan));
      if (nextPlan !== "free" && !isAdminOrOwner) {
        return NextResponse.json(
          {
            error:
              "Paid plan upgrades require Bakong KHQR payment verification in Dashboard -> Billing.",
          },
          { status: 402 }
        );
      }
      updateUserAccount(
        active.id,
        {
          plan: nextPlan,
          resetCreditsToPlan: true,
        },
        active.email
      );
    }

    if (typeof body.topUpCredits === "number" && body.topUpCredits > 0) {
      if (!isAdminOrOwner) {
        return NextResponse.json(
          {
            error:
              "Credit top-ups require Bakong KHQR verification in Dashboard -> Billing or an admin grant.",
          },
          { status: 402 }
        );
      }
      adjustUserCredits({
        userId: active.id,
        type: "topup",
        amount: body.topUpCredits,
        description: `Studio instant top-up (+${Math.round(body.topUpCredits).toLocaleString()} credits)`,
        feature: "billing",
        actorEmail: active.email,
      });
    }

    if (body.user) {
      updateUserAccount(
        active.id,
        {
          name: body.user.name,
          email: body.user.email,
          workspace: body.user.workspace,
        },
        active.email
      );
    }

    const refreshed = readStore();
    const updatedActive = resolveUserFromStore(refreshed, active.id);
    return NextResponse.json({
      plan: updatedActive.plan,
      creditsBalance: updatedActive.creditsBalance,
      creditsLimit: updatedActive.creditsLimit,
      user: {
        name: updatedActive.name,
        email: updatedActive.email,
        workspace: updatedActive.workspace,
      },
      activeUser: toPublicUser(updatedActive),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update workspace settings" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const store = readStore();
  if (id) {
    store.history = store.history.filter((h) => h.id !== id);
  } else {
    store.history = [];
  }
  writeStore(store);
  return NextResponse.json({ ok: true, history: store.history });
}
