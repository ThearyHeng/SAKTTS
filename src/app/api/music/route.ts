import { NextRequest, NextResponse } from "next/server";
import { synthesizeMusicJingle } from "@/lib/audio-engine";
import { addHistoryItem, checkUserCanSpend, resolveUserFromStore } from "@/lib/store";
import { getSessionUserId } from "@/lib/auth-session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "Warm welcome acoustic jingle").trim();
    const durationSec = Math.max(4, Math.min(30, Number(body.duration ?? 8)));
    const mood = body.mood ?? "warm";
    const creditsUsed = Math.round(durationSec * 8);
    const sessionUid = getSessionUserId(req);

    const check = checkUserCanSpend(creditsUsed, sessionUid);
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: check.status });
    }

    const result = await synthesizeMusicJingle(prompt, durationSec, mood);

    const historyItem = {
      id: result.id,
      type: "music" as const,
      title: prompt.slice(0, 48),
      text: prompt,
      voiceName: `Soundbed (${mood})`,
      durationSec: result.durationSec,
      creditsUsed,
      audioUrl: result.audioUrl,
      format: "mp3",
      waveform: result.waveform,
      createdAt: new Date().toISOString(),
    };

    const updated = addHistoryItem(historyItem, creditsUsed, sessionUid);
    const activeAfter = resolveUserFromStore(updated, sessionUid);

    return NextResponse.json({
      ...result,
      creditsUsed,
      creditsBalance: activeAfter.creditsBalance,
      historyItem,
    });
  } catch (error) {
    console.error("Music error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Music generation failed" },
      { status: 500 }
    );
  }
}
