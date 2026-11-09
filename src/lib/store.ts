import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { BUILTIN_VOICES, VoiceProfile } from "./voices";

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
  segments?: Array<{
    id: string;
    speaker: string;
    color: string;
    start: number;
    end: number;
    words: { text: string; start: number; end: number }[];
  }>;
  createdAt: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  keyHash: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export interface StoreData {
  plan: "free" | "basic" | "starter" | "studio" | "studio_max";
  creditsBalance: number;
  creditsLimit: number;
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

function defaultStore(): StoreData {
  const demoKey = "saktts_live_demo_9f8a7c6b5e4d3c2b1a0f";
  return {
    plan: "free",
    creditsBalance: 2000,
    creditsLimit: 2000,
    user: {
      name: "SAKTTS Creator",
      email: "creator@saktts.local",
      workspace: "Personal Workspace",
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
        createdAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
      },
    ],
    apiKeys: [
      {
        id: "key-demo-1",
        name: "Default Local Studio Key",
        prefix: "saktts_live_demo_...b1a0f",
        keyHash: hashKey(demoKey),
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
    const parsed = JSON.parse(raw) as StoreData;
    return {
      ...defaultStore(),
      ...parsed,
    };
  } catch {
    const fallback = defaultStore();
    fs.writeFileSync(STORE_PATH, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

export function writeStore(data: StoreData): void {
  ensureDirs();
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2));
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

export function addHistoryItem(item: HistoryItem, deductCredits = 0): StoreData {
  const store = readStore();
  store.history = [item, ...store.history].slice(0, 100);
  if (deductCredits > 0) {
    store.creditsBalance = Math.max(0, store.creditsBalance - deductCredits);
  }
  writeStore(store);
  return store;
}

export function createApiKey(name: string): { rawKey: string; item: ApiKeyItem } {
  const rawKey = `saktts_live_${crypto.randomBytes(16).toString("hex")}`;
  const item: ApiKeyItem = {
    id: `key-${crypto.randomUUID().slice(0, 8)}`,
    name: name.trim() || "API Key",
    prefix: `${rawKey.slice(0, 14)}...${rawKey.slice(-4)}`,
    keyHash: hashKey(rawKey),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
  };
  const store = readStore();
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
