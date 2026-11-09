import { NextRequest, NextResponse } from "next/server";
import { readStore, writeStore } from "@/lib/store";

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    plan: store.plan,
    creditsBalance: store.creditsBalance,
    creditsLimit: store.creditsLimit,
    user: store.user,
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
  const body = await req.json();
  const store = readStore();

  if (body.plan) {
    const limits: Record<string, number> = {
      free: 2000,
      basic: 30000,
      starter: 70000,
      studio: 150000,
      studio_max: 800000,
    };
    if (limits[body.plan]) {
      store.plan = body.plan;
      store.creditsLimit = limits[body.plan];
      store.creditsBalance = limits[body.plan];
    }
  }

  if (typeof body.topUpCredits === "number" && body.topUpCredits > 0) {
    store.creditsBalance += body.topUpCredits;
  }

  if (body.user) {
    store.user = { ...store.user, ...body.user };
  }

  writeStore(store);
  return NextResponse.json({
    plan: store.plan,
    creditsBalance: store.creditsBalance,
    creditsLimit: store.creditsLimit,
    user: store.user,
  });
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
