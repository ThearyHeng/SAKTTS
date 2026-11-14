export type UserRole = "owner" | "admin" | "user" | "member" | "billing";

export function isUserAdmin(role?: string | null): boolean {
  if (!role) return false;
  const normalized = role.toLowerCase().trim();
  return normalized === "owner" || normalized === "admin";
}

export type UserStatus = "active" | "suspended";

export type PlanId =
  | "free"
  | "basic"
  | "starter"
  | "studio"
  | "studio_max"
  | "team"
  | "team_pro"
  | "enterprise";

export type CreditTxType =
  | "topup"
  | "grant"
  | "deduct"
  | "usage"
  | "plan_reset"
  | "refund"
  | "signup_bonus";

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  plan: PlanId;
  workspace: string;
  creditsBalance: number;
  creditsLimit: number;
  creditsUsedTotal: number;
  hasPassword: boolean;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  type: CreditTxType;
  amount: number;
  balanceAfter: number;
  feature?: "tts" | "clone" | "stt" | "music" | "admin" | "billing";
  description: string;
  actorEmail?: string;
  createdAt: string;
}

export interface CreditPolicy {
  enforceBalance: boolean;
  defaultSignupCredits: number;
  lowBalanceThreshold: number;
}

export const PLAN_LIMITS: Record<PlanId, number> = {
  free: 2000,
  basic: 30000,
  starter: 70000,
  studio: 150000,
  studio_max: 800000,
  team: 200000,
  team_pro: 1000000,
  enterprise: 99999999,
};

export const PLAN_LABELS: Record<PlanId, { label: string; price: string }> = {
  free: { label: "Free", price: "$0/mo" },
  basic: { label: "Basic", price: "$2.99/mo" },
  starter: { label: "Starter", price: "$6.99/mo" },
  studio: { label: "Studio", price: "$11.99/mo" },
  studio_max: { label: "Studio Max", price: "$49.99/mo" },
  team: { label: "Team", price: "$19.99/mo" },
  team_pro: { label: "Team Pro", price: "$69.99/mo" },
  enterprise: { label: "Enterprise", price: "Custom" },
};

export interface BillingPlanSpec {
  id: PlanId;
  name: string;
  tagline: string;
  price: string;
  priceUsd: number;
  periodLabel?: string;
  creditsMonthly: number;
  popular?: boolean;
  features: string[];
}

export interface TopUpPackSpec {
  id: "pack_5k" | "pack_25k" | "pack_100k";
  credits: number;
  priceUsd: number;
  label: string;
}

export const TOPUP_PACK_CATALOG: TopUpPackSpec[] = [
  { id: "pack_5k", credits: 5000, priceUsd: 1.0, label: "+5,000 credits ($1.00)" },
  { id: "pack_25k", credits: 25000, priceUsd: 4.5, label: "+25,000 credits ($4.50)" },
  { id: "pack_100k", credits: 100000, priceUsd: 15.0, label: "+100,000 credits ($15.00)" },
];

export type PaymentOrderKind = "plan_upgrade" | "credit_topup";
export type PaymentOrderStatus = "pending" | "paid" | "expired" | "failed";

export interface PaymentOrder {
  id: string;
  userId: string;
  userEmail: string;
  kind: PaymentOrderKind;
  targetPlan?: PlanId;
  topupCredits?: number;
  amount: number;
  currency: "USD" | "KHR";
  qrPayload: string;
  qrMd5: string;
  status: PaymentOrderStatus;
  mode: "live" | "sandbox";
  sandboxSettled?: boolean;
  bakongHash?: string;
  fromAccountId?: string;
  toAccountId?: string;
  paidAmount?: number;
  paidCurrency?: string;
  failureReason?: string;
  approvedAt?: string;
  expiresAt: string;
  createdAt: string;
}

export const BILLING_PLAN_CATALOG: BillingPlanSpec[] = [
  {
    id: "free",
    name: "Free",
    tagline: "Perfect to get started",
    price: "$0",
    priceUsd: 0,
    creditsMonthly: 2000,
    features: [
      "2000 credits / month (~6 min of audio)",
      "Or ~10 min of speech-to-text",
      "1 custom voice clones",
      "Voice cloning from just 10 seconds of audio",
      "Access to standard voice library",
      "Transcribe and history features",
      "No credit card required",
    ],
  },
  {
    id: "basic",
    name: "Basic",
    tagline: "For individuals and growing needs",
    price: "$2.99",
    priceUsd: 2.99,
    periodLabel: "30 days",
    creditsMonthly: 30000,
    features: [
      "30000 credits / month (~90 min of audio)",
      "Or ~170 min of speech-to-text",
      "Everything in Free",
      "10 custom voice clones",
      "Higher quality voice output",
      "Commercial use license",
      "Email support",
    ],
  },
  {
    id: "starter",
    name: "Starter",
    tagline: "For individuals and growing needs",
    price: "$6.99",
    priceUsd: 6.99,
    periodLabel: "30 days",
    creditsMonthly: 70000,
    features: [
      "70000 credits / month (~210 min of audio)",
      "Or ~390 min of speech-to-text",
      "Everything in Basic",
      "20 custom voice clones",
      "Higher quality voice output",
      "Commercial use license included",
      "Advanced voice customization controls",
      "Priority processing",
      "API access",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For creators and growing teams",
    price: "$11.99",
    priceUsd: 11.99,
    periodLabel: "30 days",
    creditsMonthly: 150000,
    popular: true,
    features: [
      "150000 credits / month (~450 min of audio)",
      "Or ~830 min of speech-to-text",
      "Everything in Starter",
      "Unlimited custom voice clones",
      "Fast expressive synthesis controls",
      "Priority support",
    ],
  },
  {
    id: "studio_max",
    name: "Studio Max",
    tagline: "For creators and high-volume teams",
    price: "$49.99",
    priceUsd: 49.99,
    periodLabel: "30 days",
    creditsMonthly: 800000,
    features: [
      "800000 credits / month (~2400 min of audio)",
      "Or ~4400 min of speech-to-text",
      "Everything in Studio",
      "Unlimited custom voice clones",
      "Maximum voice output quality",
      "Fastest priority processing",
      "Full commercial use license",
      "Advanced customization & controls",
      "Dedicated support",
    ],
  },
];
