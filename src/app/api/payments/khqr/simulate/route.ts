import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth-session";
import { isBakongLiveMode } from "@/lib/khqr";
import {
  getPaymentOrder,
  markSandboxOrderSettled,
  readStore,
  resolveUserFromStore,
} from "@/lib/store";

export async function POST(req: NextRequest) {
  if (isBakongLiveMode()) {
    return NextResponse.json(
      { error: "Sandbox payment simulation is disabled while live BAKONG_TOKEN is configured." },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const orderId = String(body.orderId ?? "").trim();
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    const store = readStore();
    const active = resolveUserFromStore(store, getSessionUserId(req));
    const existing = getPaymentOrder(orderId);
    if (!existing) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    if (existing.userId !== active.id && active.role !== "owner" && active.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const simulatedHash = `BAKONG-SIM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const order = markSandboxOrderSettled(orderId, simulatedHash);

    return NextResponse.json({
      ok: true,
      message: "Sandbox bank settlement recorded. Polling verification will auto-approve now.",
      order,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to simulate KHQR settlement";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
