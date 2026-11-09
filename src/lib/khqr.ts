import crypto from "node:crypto";
import QRCode from "qrcode";

export interface KhqrMerchantConfig {
  liveMode: boolean;
  bakongApiUrl: string;
  bakongAccountId: string;
  merchantId?: string;
  acquiringBank: string;
  merchantName: string;
  merchantCity: string;
}

export function isBakongLiveMode(): boolean {
  const hasToken = Boolean(process.env.BAKONG_TOKEN?.trim());
  const forcedSandbox = process.env.BAKONG_SANDBOX === "true";
  return hasToken && !forcedSandbox;
}

export function getKhqrMerchantConfig(): KhqrMerchantConfig {
  return {
    liveMode: isBakongLiveMode(),
    bakongApiUrl: (process.env.BAKONG_API_URL?.trim() || "https://api-bakong.nbc.gov.kh").replace(
      /\/+$/,
      ""
    ),
    bakongAccountId: process.env.BAKONG_ACCOUNT_ID?.trim() || "saktts_studio@bkrt",
    merchantId: process.env.BAKONG_MERCHANT_ID?.trim() || undefined,
    acquiringBank: process.env.BAKONG_ACQUIRING_BANK?.trim() || "Bakong",
    merchantName: (process.env.BAKONG_MERCHANT_NAME?.trim() || "SAKTTS STUDIO").slice(0, 25),
    merchantCity: (process.env.BAKONG_MERCHANT_CITY?.trim() || "Phnom Penh").slice(0, 15),
  };
}

function tlv(tag: string, value: string): string {
  const len = Buffer.byteLength(value, "utf8");
  return `${tag}${String(len).padStart(2, "0")}${value}`;
}

function crc16CcittFalse(input: string): string {
  let crc = 0xffff;
  const buf = Buffer.from(input, "utf8");
  for (let i = 0; i < buf.length; i += 1) {
    crc ^= buf[i] << 8;
    for (let bit = 0; bit < 8; bit += 1) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ 0x1021) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function formatAmount(amount: number, currency: "USD" | "KHR"): string {
  if (currency === "KHR") {
    return String(Math.round(amount));
  }
  // Keep up to 2 decimal places without redundant .00 (matches bakong-khqr)
  const fixed = amount.toFixed(2);
  return fixed.endsWith(".00") ? fixed.slice(0, -3) : fixed;
}

export async function createDynamicKhqr(params: {
  orderId: string;
  amount: number;
  currency?: "USD" | "KHR";
  expiresAtMs?: number;
}): Promise<{
  qrPayload: string;
  qrMd5: string;
  qrImageDataUrl: string;
  config: KhqrMerchantConfig;
}> {
  const cfg = getKhqrMerchantConfig();
  const currency = params.currency ?? "USD";
  const nowMs = Date.now();
  const expiresAtMs = params.expiresAtMs ?? nowMs + 10 * 60_000;

  // Tag 29 (Individual Bakong) vs Tag 30 (Merchant Bakong)
  const accountTag = cfg.merchantId
    ? tlv(
        "30",
        tlv("00", cfg.bakongAccountId) +
          tlv("01", cfg.merchantId.slice(0, 32)) +
          tlv("02", cfg.acquiringBank.slice(0, 32))
      )
    : tlv("29", tlv("00", cfg.bakongAccountId));

  const additionalData = tlv(
    "62",
    tlv("01", params.orderId.slice(0, 25)) +
      tlv("03", cfg.merchantName.slice(0, 25)) +
      tlv("07", "SAKTTS Web")
  );

  const timestampTag = tlv(
    "99",
    tlv("00", String(nowMs)) + tlv("01", String(expiresAtMs))
  );

  const bodyWithoutCrc =
    tlv("00", "01") + // Payload Format Indicator
    tlv("01", "12") + // Dynamic QR (12 = one-time use)
    accountTag +
    tlv("52", "5999") + // MCC: Miscellaneous Digital/Specialty Goods
    tlv("53", currency === "KHR" ? "116" : "840") + // Currency Code
    tlv("54", formatAmount(params.amount, currency)) +
    tlv("58", "KH") +
    tlv("59", cfg.merchantName) +
    tlv("60", cfg.merchantCity) +
    additionalData +
    timestampTag +
    "6304";

  const qrPayload = `${bodyWithoutCrc}${crc16CcittFalse(bodyWithoutCrc)}`;
  const qrMd5 = crypto.createHash("md5").update(qrPayload).digest("hex");
  const qrImageDataUrl = await QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  });

  return { qrPayload, qrMd5, qrImageDataUrl, config: cfg };
}

export async function renderQrImageDataUrl(qrPayload: string): Promise<string> {
  return QRCode.toDataURL(qrPayload, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#111111",
      light: "#ffffff",
    },
  });
}

export interface BakongCheckResult {
  status: "paid" | "pending" | "error";
  transaction?: {
    hash: string;
    fromAccountId?: string;
    toAccountId?: string;
    currency: string;
    amount: number;
    description?: string;
    createdDateMs?: number;
    acknowledgedDateMs?: number;
  };
  responseMessage?: string;
}

export async function checkBakongTransactionByMd5(md5: string): Promise<BakongCheckResult> {
  const token = process.env.BAKONG_TOKEN?.trim();
  const cfg = getKhqrMerchantConfig();
  if (!token) {
    return { status: "error", responseMessage: "BAKONG_TOKEN is not configured" };
  }

  try {
    const res = await fetch(`${cfg.bakongApiUrl}/v1/check_transaction_by_md5`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ md5 }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });

    const json = (await res.json().catch(() => null)) as {
      responseCode?: number;
      responseMessage?: string;
      errorCode?: number | null;
      data?: {
        hash?: string;
        fromAccountId?: string;
        toAccountId?: string;
        currency?: string;
        amount?: number | string;
        description?: string;
        createdDateMs?: number;
        acknowledgedDateMs?: number;
      } | null;
    } | null;

    if (!res.ok || !json) {
      return {
        status: "error",
        responseMessage: `Bakong HTTP ${res.status}`,
      };
    }

    if (json.responseCode === 0 && json.data?.hash) {
      return {
        status: "paid",
        transaction: {
          hash: String(json.data.hash),
          fromAccountId: json.data.fromAccountId,
          toAccountId: json.data.toAccountId,
          currency: String(json.data.currency || "USD").toUpperCase(),
          amount: Number(json.data.amount ?? 0),
          description: json.data.description,
          createdDateMs: json.data.createdDateMs,
          acknowledgedDateMs: json.data.acknowledgedDateMs,
        },
        responseMessage: json.responseMessage,
      };
    }

    // responseCode === 1 typically means transaction not found / user hasn't paid yet
    if (json.responseCode === 1) {
      return {
        status: "pending",
        responseMessage: json.responseMessage || "Transaction not found yet",
      };
    }

    return {
      status: "error",
      responseMessage: json.responseMessage || `Bakong code ${json.responseCode}`,
    };
  } catch (err) {
    return {
      status: "error",
      responseMessage: err instanceof Error ? err.message : "Bakong verification request failed",
    };
  }
}
