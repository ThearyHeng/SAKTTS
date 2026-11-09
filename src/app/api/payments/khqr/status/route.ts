import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/auth-session";
import {
  checkBakongTransactionByMd5,
  getKhqrMerchantConfig,
  isBakongLiveMode,
  renderQrImageDataUrl,
} from "@/lib/khqr";
import {
  fulfillPaymentOrder,
  getPaymentOrder,
  listPaymentOrders,
  markPaymentOrderExpired,
  readStore,
  resolveUserFromStore,
  toPublicUser,
} from "@/lib/store";

export async function GET(req: NextRequest) {
  const store = readStore();
  const active = resolveUserFromStore(store, getSessionUserId(req));
  const orderId = req.nextUrl.searchParams.get("orderId")?.trim();

  if (!orderId) {
    const orders = listPaymentOrders(active.id);
    return NextResponse.json({
      orders,
      liveMode: isBakongLiveMode(),
    });
  }

  const order = getPaymentOrder(orderId);
  if (!order) {
    return NextResponse.json({ error: "KHQR payment order not found" }, { status: 404 });
  }

  if (order.userId !== active.id && active.role !== "owner" && active.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.status === "paid") {
    const ownerUser = resolveUserFromStore(readStore(), order.userId);
    return NextResponse.json({
      approved: true,
      alreadyApproved: true,
      order,
      user: toPublicUser(ownerUser),
      mode: order.mode,
    });
  }

  if (order.status === "expired" || order.status === "failed") {
    return NextResponse.json({
      approved: false,
      expired: order.status === "expired",
      failed: order.status === "failed",
      order,
      mode: order.mode,
    });
  }

  // Order is currently pending: verify either against Bakong Open API or Sandbox state
  if (order.mode === "live") {
    const check = await checkBakongTransactionByMd5(order.qrMd5);
    if (check.status === "paid" && check.transaction) {
      try {
        const fulfilled = fulfillPaymentOrder({
          orderId: order.id,
          bakongHash: check.transaction.hash,
          fromAccountId: check.transaction.fromAccountId,
          toAccountId: check.transaction.toAccountId,
          paidAmount: check.transaction.amount,
          paidCurrency: check.transaction.currency,
        });
        return NextResponse.json({
          approved: true,
          autoApproved: !fulfilled.alreadyApproved,
          order: fulfilled.order,
          transaction: fulfilled.transaction,
          user: toPublicUser(fulfilled.user),
          mode: "live",
        });
      } catch (err) {
        const failedOrder = getPaymentOrder(order.id);
        return NextResponse.json(
          {
            approved: false,
            failed: true,
            order: failedOrder ?? order,
            error: err instanceof Error ? err.message : "Payment verification failed",
            mode: "live",
          },
          { status: 422 }
        );
      }
    }

    if (Date.now() > Date.parse(order.expiresAt)) {
      const expiredOrder = markPaymentOrderExpired(order.id);
      return NextResponse.json({
        approved: false,
        expired: true,
        order: expiredOrder ?? order,
        mode: "live",
      });
    }

    const cfg = getKhqrMerchantConfig();
    const includeQr = req.nextUrl.searchParams.get("includeQr") === "1";
    const qrImageDataUrl = includeQr ? await renderQrImageDataUrl(order.qrPayload) : undefined;
    return NextResponse.json({
      approved: false,
      order,
      mode: "live",
      qrImageDataUrl,
      merchant: {
        name: cfg.merchantName,
        city: cfg.merchantCity,
        bakongAccountId: cfg.bakongAccountId,
      },
      checkMessage: check.responseMessage || "Waiting for Bakong settlement…",
    });
  }

  // Sandbox mode (local verification flow when BAKONG_TOKEN is unset)
  if (order.sandboxSettled) {
    try {
      const cfg = getKhqrMerchantConfig();
      const fulfilled = fulfillPaymentOrder({
        orderId: order.id,
        bakongHash: order.bakongHash || `BAKONG-SIM-${order.qrMd5.slice(0, 10).toUpperCase()}`,
        fromAccountId: "sandbox_customer@aba",
        toAccountId: cfg.bakongAccountId,
        paidAmount: order.amount,
        paidCurrency: order.currency,
      });
      return NextResponse.json({
        approved: true,
        autoApproved: !fulfilled.alreadyApproved,
        order: fulfilled.order,
        transaction: fulfilled.transaction,
        user: toPublicUser(fulfilled.user),
        mode: "sandbox",
      });
    } catch (err) {
      return NextResponse.json(
        {
          approved: false,
          failed: true,
          order: getPaymentOrder(order.id) ?? order,
          error: err instanceof Error ? err.message : "Sandbox fulfillment error",
          mode: "sandbox",
        },
        { status: 422 }
      );
    }
  }

  if (Date.now() > Date.parse(order.expiresAt)) {
    const expiredOrder = markPaymentOrderExpired(order.id);
    return NextResponse.json({
      approved: false,
      expired: true,
      order: expiredOrder ?? order,
      mode: "sandbox",
    });
  }

  const cfg = getKhqrMerchantConfig();
  const includeQr = req.nextUrl.searchParams.get("includeQr") === "1";
  const qrImageDataUrl = includeQr ? await renderQrImageDataUrl(order.qrPayload) : undefined;
  return NextResponse.json({
    approved: false,
    order,
    mode: "sandbox",
    qrImageDataUrl,
    merchant: {
      name: cfg.merchantName,
      city: cfg.merchantCity,
      bakongAccountId: cfg.bakongAccountId,
    },
    checkMessage: "Waiting for customer KHQR scan or sandbox bank settlement…",
  });
}
