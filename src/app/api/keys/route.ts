import { NextRequest, NextResponse } from "next/server";
import { createApiKey, readStore, writeStore } from "@/lib/store";

export async function GET() {
  const store = readStore();
  return NextResponse.json({
    apiKeys: store.apiKeys.map((k) => ({
      id: k.id,
      name: k.name,
      prefix: k.prefix,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
    })),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? "API Key").trim();
  const { rawKey, item } = createApiKey(name);
  return NextResponse.json({
    rawKey,
    item: {
      id: item.id,
      name: item.name,
      prefix: item.prefix,
      createdAt: item.createdAt,
      lastUsedAt: item.lastUsedAt,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const store = readStore();
  store.apiKeys = store.apiKeys.filter((k) => k.id !== id);
  writeStore(store);
  return NextResponse.json({ ok: true });
}
