import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth-session";
import { createDynamicKhqr } from "@/lib/khqr";
import {
  BILLING_PLAN_CATALOG,
  TOPUP_PACK_CATALOG,
  createPaymentOrder,
  readStore,
  resolveUserFromStore,
  type PaymentOrder,
} from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const store = readStore();
    const user = resolveUserFromStore(store, getSessionUserId(req));

    if (user.status === "suspended") {
      return NextResponse.json(
        { error: "Suspended accounts cannot initiate KHQR checkouts." },
        { status: 403 }
      );
    }

    const kind = body.kind === "credit_topup" ? "credit_topup" : "plan_upgrade";
    const orderId = `KHQR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const createdAt = new Date();
    const expiresAtMs = createdAt.getTime() + 10 * 60_000;

    let amount = 0;
    let targetPlan: PaymentOrder["targetPlan"];
    let topupCredits: number | undefined;
    let itemLabel = "";

    if (kind === "plan_upgrade") {
      const requestedPlan = String(body.targetPlan ?? "");
      const spec = BILLING_PLAN_CATALOG.find((p) => p.id === requestedPlan);
      if (!spec || spec.priceUsd <= 0) {
        return NextResponse.json(
          { error: "Select a paid plan to generate a KHQR checkout." },
          { status: 400 }
        );
      }
      targetPlan = spec.id;
      amount = spec.priceUsd;
      itemLabel = `${spec.name} Plan (${spec.creditsMonthly.toLocaleString()} credits/mo)`;
    } else {
      const requestedPackId = String(body.packId ?? "");
      const requestedCredits = Number(body.credits ?? 0);
      const pack =
        TOPUP_PACK_CATALOG.find((p) => p.id === requestedPackId) ??
        TOPUP_PACK_CATALOG.find((p) => p.credits === requestedCredits);
      if (!pack) {
        return NextResponse.json(
          { error: "Invalid extra-credit pack selected." },
          { status: 400 }
        );
      }
      topupCredits = pack.credits;
      amount = pack.priceUsd;
      itemLabel = `+${pack.credits.toLocaleString()} Extra Credits`;
    }

    const khqr = await createDynamicKhqr({
      orderId,
      amount,
      currency: "USD",
      expiresAtMs,
    });

    const order: PaymentOrder = {
      id: orderId,
      userId: user.id,
      userEmail: user.email,
      kind,
      targetPlan,
      topupCredits,
      amount,
      currency: "USD",
      qrPayload: khqr.qrPayload,
      qrMd5: khqr.qrMd5,
      status: "pending",
      mode: khqr.config.liveMode ? "live" : "sandbox",
      expiresAt: new Date(expiresAtMs).toISOString(),
      createdAt: createdAt.toISOString(),
    };

    createPaymentOrder(order);

    return NextResponse.json(
      {
        order,
        itemLabel,
        qrImageDataUrl: khqr.qrImageDataUrl,
        merchant: {
          name: khqr.config.merchantName,
          city: khqr.config.merchantCity,
          bakongAccountId: khqr.config.bakongAccountId,
          liveMode: khqr.config.liveMode,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create KHQR payment" },
      { status: 400 }
    );
  }
}
