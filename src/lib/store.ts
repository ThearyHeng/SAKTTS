import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BUILTIN_VOICES, VoiceProfile } from "./voices";
import type { SpeechCue } from "./text-alignment";
import {
  PLAN_LIMITS,
  type CreditPolicy,
  type CreditTransaction,
  type CreditTxType,
  type PaymentOrder,
  type PlanId,
  type PublicUser,
  type UserRole,
  type UserStatus,
} from "./user-types";

export * from "./user-types";

export interface HistoryItem {
  id: string;
  type: "tts" | "clone" | "stt" | "music";
  title: string;
  text: string;
  voiceId?: string;
  voiceName?: string;
  language?: string;
  durationSec: number;
  creditsUsed: number;
  audioUrl?: string;
  format?: string;
  waveform: number[];
  cues?: SpeechCue[];
  segments?: Array<{
    id: string;
    speaker: string;
    color: string;
    start: number;
    end: number;
    words: { text: string; start: number; end: number }[];
  }>;
  userId?: string;
  createdAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  userId?: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface UserAccount {
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
  passwordHash?: string;
  createdAt: string;
  lastActiveAt: string | null;
}

export interface StoreData {
  plan: PlanId;
  creditsBalance: number;
  creditsLimit: number;
  activeUserId: string;
  users: UserAccount[];
  creditTransactions: CreditTransaction[];
  creditPolicy: CreditPolicy;
  paymentOrders: PaymentOrder[];
  customVoices: VoiceProfile[];
  history: HistoryItem[];
  apiKeys: ApiKeyItem[];
  user: {
    name: string;
    email: string;
    workspace: string;
  };
}

const DATA_DIR = process.env.SAKTTS_DATA_DIR
  ? path.resolve(process.env.SAKTTS_DATA_DIR)
  : path.join(process.cwd(), ".saktts-data");
const AUDIO_DIR = path.join(DATA_DIR, "audio");
const STORE_PATH = path.join(DATA_DIR, "store.json");

function ensureDirs() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(AUDIO_DIR)) fs.mkdirSync(AUDIO_DIR, { recursive: true });
}

function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

export function verifyPassword(password: string, storedHash?: string): boolean {
  if (!storedHash || !storedHash.startsWith("scrypt$")) return false;
  const parts = storedHash.split("$");
  if (parts.length !== 3) return false;
  const [, salt, hexHash] = parts;
  const derived = crypto.scryptSync(password, salt, 32);
  const expected = Buffer.from(hexHash, "hex");
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function toPublicUser(u: UserAccount): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    plan: u.plan,
    workspace: u.workspace,
    creditsBalance: u.creditsBalance,
    creditsLimit: u.creditsLimit,
    creditsUsedTotal: u.creditsUsedTotal,
    hasPassword: Boolean(u.passwordHash),
    createdAt: u.createdAt,
    lastActiveAt: u.lastActiveAt,
  };
}

function defaultPolicy(): CreditPolicy {
  return {
    enforceBalance: true,
    defaultSignupCredits: 2000,
    lowBalanceThreshold: 500,
  };
}

function syncActiveSnapshot(store: StoreData): StoreData {
  if (!Array.isArray(store.users) || store.users.length === 0) {
    const owner: UserAccount = {
      id: "usr-owner-1",
      name: store.user?.name || "SAKTTS Creator",
      email: store.user?.email || "creator@saktts.local",
      role: "owner",
      status: "active",
      plan: normalizePlan(store.plan),
      workspace: store.user?.workspace || "Personal Workspace",
      creditsBalance: typeof store.creditsBalance === "number" ? store.creditsBalance : 2000,
      creditsLimit: typeof store.creditsLimit === "number" ? store.creditsLimit : 2000,
      creditsUsedTotal: (store.history ?? []).reduce((sum, h) => sum + (h.creditsUsed || 0), 0),
      createdAt: new Date().toISOString(),
      lastActiveAt: new Date().toISOString(),
    };
    store.users = [owner];
    store.activeUserId = owner.id;
  }

  let active = store.users.find((u) => u.id === store.activeUserId);
  if (!active) {
    active = store.users[0];
    store.activeUserId = active.id;
  }

  store.plan = active.plan;
  store.creditsBalance = active.creditsBalance;
  store.creditsLimit = active.creditsLimit;
  store.user = {
    name: active.name,
    email: active.email,
    workspace: active.workspace,
  };
  return store;
}

export function normalizePlan(raw?: string): PlanId {
  if (raw && raw in PLAN_LIMITS) return raw as PlanId;
  return "free";
}

function defaultStore(): StoreData {
  const demoKey = "saktts_live_demo_9f8a7c6b5e4d3c2b1a0f";
  const now = new Date().toISOString();
  const ownerId = "usr-owner-1";
  const owner: UserAccount = {
    id: ownerId,
    name: "SAKTTS Creator",
    email: "creator@saktts.local",
    role: "owner",
    status: "active",
    plan: "free",
    workspace: "Personal Workspace",
    creditsBalance: 2000,
    creditsLimit: 2000,
    creditsUsedTotal: 84,
    createdAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
    lastActiveAt: now,
  };

  return {
    plan: "free",
    creditsBalance: 2000,
    creditsLimit: 2000,
    activeUserId: ownerId,
    users: [owner],
    creditTransactions: [
      {
        id: "tx-initial-owner",
        userId: ownerId,
        userName: owner.name,
        userEmail: owner.email,
        type: "signup_bonus",
        amount: 2000,
        balanceAfter: 2000,
        feature: "billing",
        description: "Initial Free plan workspace allocation",
        createdAt: owner.createdAt,
      },
    ],
    creditPolicy: defaultPolicy(),
    paymentOrders: [],
    user: {
      name: owner.name,
      email: owner.email,
      workspace: owner.workspace,
    },
    customVoices: [],
    history: [
      {
        id: "hist-welcome-km",
        type: "tts",
        title: "Khmer Welcome Intro",
        text: "សូមស្វាគមន៍មកកាន់ SAKTTS។ សូមរីករាយជាមួយសំឡេង AI ដែលស្តាប់ទៅដូចធម្មជាតិ។",
        voiceId: "91",
        voiceName: "Maly",
        language: "Khmer",
        durationSec: 5.4,
        creditsUsed: 84,
        waveform: [35, 52, 68, 44, 72, 85, 60, 48, 76, 90, 64, 52, 70, 82, 58, 40, 66, 88, 74, 56, 42, 69, 81, 50, 38, 62, 79, 68, 45, 71, 84, 59, 43, 67, 75, 53, 41, 65, 78, 55, 39, 60, 72, 48, 34, 46, 38, 26],
        userId: ownerId,
        createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
      },
    ],
    apiKeys: [
      {
        id: "key-demo-1",
        name: "Default Local Studio Key",
        prefix: "saktts_live_demo_...b1a0f",
        keyHash: hashKey(demoKey),
        userId: ownerId,
        createdAt: new Date(Date.now() - 86400_000 * 3).toISOString(),
        lastUsedAt: null,
      },
    ],
  };
}

export function readStore(): StoreData {
  ensureDirs();
  if (!fs.existsSync(STORE_PATH)) {
    const initial = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    const base = defaultStore();
    const hadUsers = Array.isArray(parsed.users) && parsed.users.length > 0;

    const merged: StoreData = {
      ...base,
      ...parsed,
      plan: normalizePlan(parsed.plan),
      users: hadUsers ? (parsed.users as UserAccount[]) : [],
      creditTransactions: Array.isArray(parsed.creditTransactions)
        ? parsed.creditTransactions
        : hadUsers
        ? []
        : [],
      creditPolicy: {
        ...defaultPolicy(),
        ...(parsed.creditPolicy ?? {}),
      },
      paymentOrders: Array.isArray(parsed.paymentOrders)
        ? (parsed.paymentOrders as PaymentOrder[])
        : [],
      customVoices: Array.isArray(parsed.customVoices) ? parsed.customVoices : base.customVoices,
      history: Array.isArray(parsed.history) ? parsed.history : base.history,
      apiKeys: Array.isArray(parsed.apiKeys) ? parsed.apiKeys : base.apiKeys,
      user: parsed.user ?? base.user,
    };

    const synced = syncActiveSnapshot(merged);
    if (!hadUsers) {
      fs.writeFileSync(STORE_PATH, JSON.stringify(synced, null, 2));
    }
    return synced;
  } catch {
    const fallback = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

export function writeStore(data: StoreData): void {
  ensureDirs();
  syncActiveSnapshot(data);
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
}

export function resolveUserFromStore(store: StoreData, preferredUserId?: string | null): UserAccount {
  if (preferredUserId) {
    const matched = store.users.find((u) => u.id === preferredUserId);
    if (matched) return matched;
  }
  const active = store.users.find((u) => u.id === store.activeUserId);
  return active ?? store.users[0];
}

export function appendTransaction(
  store: StoreData,
  tx: Omit<CreditTransaction, "id" | "createdAt">
): CreditTransaction {
  const item: CreditTransaction = {
    id: `tx-${crypto.randomUUID().slice(0, 10)}`,
    createdAt: new Date().toISOString(),
    ...tx,
  };
  store.creditTransactions = [item, ...store.creditTransactions].slice(0, 500);
  return item;
}

export function checkUserCanSpend(
  amountNeeded: number,
  preferredUserId?: string | null
):
  | { ok: true; user: UserAccount; store: StoreData }
  | { ok: false; status: number; error: string } {
  const store = readStore();
  const user = resolveUserFromStore(store, preferredUserId);

  if (user.status === "suspended") {
    return {
      ok: false,
      status: 403,
      error: `Account "${user.email}" is suspended. Reactivate it in Dashboard -> Users & Credits.`,
    };
  }

  if (
    amountNeeded > 0 &&
    user.plan !== "enterprise" &&
    store.creditPolicy.enforceBalance &&
    user.creditsBalance < amountNeeded
  ) {
    return {
      ok: false,
      status: 402,
      error: `Insufficient credits (${amountNeeded.toLocaleString()} required, ${user.creditsBalance.toLocaleString()} available for ${user.email}). Top up in Dashboard -> Users & Credits.`,
    };
  }

  return { ok: true, user, store };
}

export function adjustUserCredits(params: {
  userId: string;
  type: CreditTxType;
  amount: number;
  description: string;
  feature?: CreditTransaction["feature"];
  actorEmail?: string;
}): { store: StoreData; user: UserAccount; transaction: CreditTransaction } {
  const store = readStore();
  const user = store.users.find((u) => u.id === params.userId);
  if (!user) {
    throw new Error("User account not found");
  }

  const absAmount = Math.max(0, Math.round(Math.abs(params.amount)));
  let signedDelta = absAmount;

  if (params.type === "deduct" || params.type === "usage") {
    const deducted = Math.min(user.creditsBalance, absAmount);
    user.creditsBalance = Math.max(0, user.creditsBalance - absAmount);
    if (params.type === "usage") {
      user.creditsUsedTotal = (user.creditsUsedTotal || 0) + deducted;
    }
    signedDelta = -deducted;
  } else if (params.type === "plan_reset") {
    const targetLimit = PLAN_LIMITS[user.plan] ?? user.creditsLimit;
    user.creditsLimit = targetLimit;
    signedDelta = targetLimit - user.creditsBalance;
    user.creditsBalance = targetLimit;
  } else {
    user.creditsBalance += absAmount;
    if (user.creditsBalance > user.creditsLimit && user.plan !== "enterprise") {
      // Allow balance above monthly quota when topped up / granted manually
      user.creditsLimit = Math.max(user.creditsLimit, PLAN_LIMITS[user.plan] ?? 2000);
    }
    signedDelta = absAmount;
  }

  user.lastActiveAt = new Date().toISOString();

  const transaction = appendTransaction(store, {
    userId: user.id,
    userName: user.name,
    userEmail: user.email,
    type: params.type,
    amount: signedDelta,
    balanceAfter: user.creditsBalance,
    feature: params.feature ?? "admin",
    description: params.description.trim() || "Credit adjustment",
    actorEmail: params.actorEmail,
  });

  writeStore(store);
  return { store, user, transaction };
}

export function createUserAccount(input: {
  name: string;
  email: string;
  role?: UserRole;
  status?: UserStatus;
  plan?: PlanId;
  workspace?: string;
  password?: string;
  initialCredits?: number;
  makeActive?: boolean;
  actorEmail?: string;
}): { user: UserAccount; store: StoreData } {
  const store = readStore();
  const email = input.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Valid email address is required");
  }
  if (store.users.some((u) => u.email.toLowerCase() === email)) {
    throw new Error("An account with this email already exists");
  }

  const plan = normalizePlan(input.plan ?? "free");
  const limit = PLAN_LIMITS[plan];
  const initialCredits =
    typeof input.initialCredits === "number" && Number.isFinite(input.initialCredits)
      ? Math.max(0, Math.round(input.initialCredits))
      : plan === "free"
      ? store.creditPolicy.defaultSignupCredits
      : limit;

  const now = new Date().toISOString();
  const user: UserAccount = {
    id: `usr-${crypto.randomUUID().slice(0, 8)}`,
    name: input.name.trim() || email.split("@")[0],
    email,
    role: input.role ?? "member",
    status: input.status ?? "active",
    plan,
    workspace: input.workspace?.trim() || "SAKTTS Workspace",
    creditsBalance: initialCredits,
    creditsLimit: Math.max(limit, initialCredits),
    creditsUsedTotal: 0,
    ...(input.password && input.password.length >= 6
      ? { passwordHash: hashPassword(input.password) }
      : {}),
    createdAt: now,
    lastActiveAt: input.makeActive ? now : null,
  };

  store.users = [user, ...store.users];
  if (initialCredits > 0) {
    appendTransaction(store, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: input.actorEmail ? "grant" : "signup_bonus",
      amount: initialCredits,
      balanceAfter: initialCredits,
      feature: "billing",
      description: input.actorEmail
        ? `Account created with ${initialCredits.toLocaleString()} credits (${plan})`
        : `Welcome signup bonus (${plan} plan)`,
      actorEmail: input.actorEmail,
    });
  }

  if (input.makeActive) {
    store.activeUserId = user.id;
  }

  writeStore(store);
  return { user, store };
}

export function updateUserAccount(
  id: string,
  patch: {
    name?: string;
    email?: string;
    role?: UserRole;
    status?: UserStatus;
    plan?: PlanId;
    workspace?: string;
    password?: string;
    resetCreditsToPlan?: boolean;
  },
  actorEmail?: string
): { user: UserAccount; store: StoreData } {
  const store = readStore();
  const user = store.users.find((u) => u.id === id);
  if (!user) throw new Error("User account not found");

  if (patch.email) {
    const cleanEmail = patch.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("Invalid email format");
    }
    const conflict = store.users.find((u) => u.id !== id && u.email.toLowerCase() === cleanEmail);
    if (conflict) throw new Error("Another account already uses this email");
    user.email = cleanEmail;
  }

  // Prevent demoting or suspending the last remaining active owner
  const activeOwners = store.users.filter((u) => u.role === "owner" && u.status === "active");
  const isLastActiveOwner = activeOwners.length === 1 && activeOwners[0].id === user.id;
  if (isLastActiveOwner) {
    if (patch.status === "suspended") {
      throw new Error("Cannot suspend the last active workspace owner");
    }
    if (patch.role && patch.role !== "owner") {
      throw new Error("Assign another owner before changing the sole owner role");
    }
  }

  if (typeof patch.name === "string" && patch.name.trim()) {
    user.name = patch.name.trim();
  }
  if (patch.role) user.role = patch.role;
  if (patch.status) user.status = patch.status;
  if (typeof patch.workspace === "string" && patch.workspace.trim()) {
    user.workspace = patch.workspace.trim();
  }
  if (patch.password && patch.password.trim().length >= 6) {
    user.passwordHash = hashPassword(patch.password.trim());
  }

  if (patch.plan && patch.plan in PLAN_LIMITS) {
    const nextPlan = normalizePlan(patch.plan);
    const prevPlan = user.plan;
    const nextLimit = PLAN_LIMITS[nextPlan];
    user.plan = nextPlan;
    user.creditsLimit = nextLimit;

    if (patch.resetCreditsToPlan || (prevPlan !== nextPlan && nextLimit > user.creditsBalance)) {
      const delta = nextLimit - user.creditsBalance;
      user.creditsBalance = nextLimit;
      appendTransaction(store, {
        userId: user.id,
        userName: user.name,
        userEmail: user.email,
        type: "plan_reset",
        amount: delta,
        balanceAfter: user.creditsBalance,
        feature: "billing",
        description: `Plan changed to ${nextPlan} (${nextLimit.toLocaleString()} quota)`,
        actorEmail,
      });
    }
  }

  writeStore(store);
  return { user, store };
}

export function deleteUserAccount(id: string): StoreData {
  const store = readStore();
  const target = store.users.find((u) => u.id === id);
  if (!target) throw new Error("User account not found");
  if (store.users.length <= 1) {
    throw new Error("Cannot delete the only workspace account");
  }
  const activeOwners = store.users.filter((u) => u.role === "owner" && u.status === "active");
  if (target.role === "owner" && target.status === "active" && activeOwners.length <= 1) {
    throw new Error("Cannot delete the last active workspace owner");
  }

  store.users = store.users.filter((u) => u.id !== id);
  if (store.activeUserId === id) {
    const nextActive = store.users.find((u) => u.status === "active") ?? store.users[0];
    store.activeUserId = nextActive.id;
  }
  writeStore(store);
  return store;
}

export function authenticateUser(email: string, password: string): { user: UserAccount; store: StoreData } {
  const store = readStore();
  const cleanEmail = email.trim().toLowerCase();
  const user = store.users.find((u) => u.email.toLowerCase() === cleanEmail);
  if (!user) {
    throw new Error("AUTH_NOT_FOUND");
  }
  if (user.status === "suspended") {
    throw new Error("AUTH_SUSPENDED");
  }
  if (user.passwordHash) {
    if (!verifyPassword(password, user.passwordHash)) {
      throw new Error("AUTH_INVALID_PASSWORD");
    }
  } else {
    // Migrate legacy passwordless owner account smoothly on first explicit password sign-in
    if (password.length >= 6) {
      user.passwordHash = hashPassword(password);
    }
  }

  user.lastActiveAt = new Date().toISOString();
  store.activeUserId = user.id;
  writeStore(store);
  return { user, store };
}

export function getAudioDir(): string {
  ensureDirs();
  return AUDIO_DIR;
}

export function getAllVoices(): VoiceProfile[] {
  const store = readStore();
  return [...store.customVoices, ...BUILTIN_VOICES];
}

export function findVoice(voiceIdOrName?: string): VoiceProfile {
  const all = getAllVoices();
  if (!voiceIdOrName) return BUILTIN_VOICES[0];
  const lower = voiceIdOrName.toLowerCase();
  return (
    all.find(
      (v) => v.id.toLowerCase() === lower || v.name.toLowerCase() === lower
    ) ?? BUILTIN_VOICES[0]
  );
}

export function addHistoryItem(
  item: HistoryItem,
  deductCredits = 0,
  preferredUserId?: string | null
): StoreData {
  const store = readStore();
  const user = resolveUserFromStore(store, preferredUserId);
  item.userId = item.userId ?? user.id;
  store.history = [item, ...store.history].slice(0, 100);

  if (deductCredits > 0) {
    const deducted = Math.min(user.creditsBalance, deductCredits);
    user.creditsBalance = Math.max(0, user.creditsBalance - deductCredits);
    user.creditsUsedTotal = (user.creditsUsedTotal || 0) + deducted;
    user.lastActiveAt = new Date().toISOString();
    appendTransaction(store, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: "usage",
      amount: -deducted,
      balanceAfter: user.creditsBalance,
      feature: item.type,
      description: `${item.type.toUpperCase()}: ${item.title || "Audio generation"}`,
    });
  } else {
    user.lastActiveAt = new Date().toISOString();
  }

  writeStore(store);
  return store;
}

export function createApiKey(
  name: string,
  preferredUserId?: string | null
): { rawKey: string; item: ApiKeyItem } {
  const store = readStore();
  const user = resolveUserFromStore(store, preferredUserId);
  const rawKey = `saktts_live_${crypto.randomBytes(16).toString("hex")}`;
  const item: ApiKeyItem = {
    id: `key-${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim() || "API Key",
    prefix: `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`,
    keyHash: hashKey(rawKey),
    userId: user.id,
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  store.apiKeys = [item, ...store.apiKeys];
  writeStore(store);
  return { rawKey, item };
}

export function verifyApiKey(token?: string | null): boolean {
  if (!token) return true; // Local app allows unauthenticated playground/studio calls smoothly
  const store = readStore();
  const h = hashKey(token);
  const found = store.apiKeys.find((k) => k.keyHash === h);
  if (found) {
    found.lastUsedAt = new Date().toISOString();
    writeStore(store);
    return true;
  }
  return token.startsWith("saktts_") || token === "demo";
}

export function createPaymentOrder(order: PaymentOrder): PaymentOrder {
  const store = readStore();
  store.paymentOrders = [order, ...store.paymentOrders].slice(0, 200);
  writeStore(store);
  return order;
}

export function getPaymentOrder(orderId: string): PaymentOrder | null {
  const store = readStore();
  return store.paymentOrders.find((o) => o.id === orderId) ?? null;
}

export function listPaymentOrders(userId?: string): PaymentOrder[] {
  const store = readStore();
  if (!userId) return store.paymentOrders;
  return store.paymentOrders.filter((o) => o.userId === userId);
}

export function markPaymentOrderExpired(orderId: string): PaymentOrder | null {
  const store = readStore();
  const order = store.paymentOrders.find((o) => o.id === orderId);
  if (!order) return null;
  if (order.status === "pending") {
    order.status = "expired";
    writeStore(store);
  }
  return order;
}

export function markPaymentOrderFailed(orderId: string, reason: string): PaymentOrder | null {
  const store = readStore();
  const order = store.paymentOrders.find((o) => o.id === orderId);
  if (!order) return null;
  if (order.status === "pending") {
    order.status = "failed";
    order.failureReason = reason;
    writeStore(store);
  }
  return order;
}

export function markSandboxOrderSettled(
  orderId: string,
  simulatedHash?: string
): PaymentOrder {
  const store = readStore();
  const order = store.paymentOrders.find((o) => o.id === orderId);
  if (!order) {
    throw new Error("Payment order not found");
  }
  if (order.mode !== "sandbox") {
    throw new Error("SANDBOX_DISABLED_IN_LIVE");
  }
  if (order.status === "paid") {
    return order;
  }
  if (order.status !== "pending") {
    throw new Error(`Order is ${order.status}`);
  }
  order.sandboxSettled = true;
  if (simulatedHash) {
    order.bakongHash = simulatedHash;
  }
  writeStore(store);
  return order;
}

export function fulfillPaymentOrder(params: {
  orderId: string;
  bakongHash: string;
  fromAccountId?: string;
  toAccountId?: string;
  paidAmount: number;
  paidCurrency: string;
}): {
  order: PaymentOrder;
  user: UserAccount;
  alreadyApproved: boolean;
  transaction?: CreditTransaction;
} {
  const store = readStore();
  const order = store.paymentOrders.find((o) => o.id === params.orderId);
  if (!order) {
    throw new Error("Payment order not found");
  }

  const user = store.users.find((u) => u.id === order.userId);
  if (!user) {
    throw new Error("Purchaser account not found");
  }

  // Idempotent return if this exact order was already fulfilled
  if (order.status === "paid") {
    return { order, user, alreadyApproved: true };
  }

  if (order.status !== "pending") {
    throw new Error(`Cannot fulfill order in status "${order.status}"`);
  }

  // Anti-replay check: prevent same Bakong transaction hash from approving another order
  if (
    params.bakongHash &&
    store.paymentOrders.some(
      (o) => o.id !== order.id && o.bakongHash && o.bakongHash === params.bakongHash
    )
  ) {
    order.status = "failed";
    order.failureReason = "Duplicate Bakong transaction hash rejected";
    writeStore(store);
    throw new Error("Duplicate Bakong transaction hash");
  }

  // Verify currency & paid amount match expected order amount
  const paidCurrency = params.paidCurrency.toUpperCase();
  if (paidCurrency !== order.currency || params.paidAmount < order.amount - 0.005) {
    order.status = "failed";
    order.failureReason = `Payment mismatch: received ${params.paidAmount} ${paidCurrency}, expected ${order.amount} ${order.currency}`;
    writeStore(store);
    throw new Error(order.failureReason);
  }

  const now = new Date().toISOString();
  order.status = "paid";
  order.bakongHash = params.bakongHash;
  order.fromAccountId = params.fromAccountId;
  order.toAccountId = params.toAccountId;
  order.paidAmount = params.paidAmount;
  order.paidCurrency = paidCurrency;
  order.approvedAt = now;

  let transaction: CreditTransaction;
  const shortRef = params.bakongHash.slice(0, 12);

  if (order.kind === "plan_upgrade" && order.targetPlan) {
    const prevPlan = user.plan;
    const prevLimit = PLAN_LIMITS[prevPlan] ?? user.creditsLimit;
    const nextPlan = normalizePlan(order.targetPlan);
    const nextLimit = PLAN_LIMITS[nextPlan];
    const carryOverBonus = Math.max(0, user.creditsBalance - prevLimit);
    const nextBalance =
      prevPlan === nextPlan ? user.creditsBalance + nextLimit : nextLimit + carryOverBonus;
    const delta = nextBalance - user.creditsBalance;

    user.plan = nextPlan;
    user.creditsLimit = nextLimit;
    user.creditsBalance = nextBalance;
    user.lastActiveAt = now;

    transaction = appendTransaction(store, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: "plan_reset",
      amount: delta,
      balanceAfter: user.creditsBalance,
      feature: "billing",
      description: `KHQR Auto-Approved: ${nextPlan.replace("_", " ").toUpperCase()} Plan ($${order.amount.toFixed(2)}, Ref ${shortRef})`,
    });
  } else {
    const bonusCredits = Math.max(0, Math.round(order.topupCredits ?? 0));
    user.creditsBalance += bonusCredits;
    user.creditsLimit = Math.max(user.creditsLimit, PLAN_LIMITS[user.plan] ?? 2000);
    user.lastActiveAt = now;

    transaction = appendTransaction(store, {
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      type: "topup",
      amount: bonusCredits,
      balanceAfter: user.creditsBalance,
      feature: "billing",
      description: `KHQR Auto-Topup: +${bonusCredits.toLocaleString()} credits ($${order.amount.toFixed(2)}, Ref ${shortRef})`,
    });
  }

  writeStore(store);
  return { order, user, alreadyApproved: false, transaction };
}
