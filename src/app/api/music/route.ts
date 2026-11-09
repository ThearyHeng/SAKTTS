import { NextRequest, NextResponse } from "next/server";
import { synthesizeMusicJingle } from "@/lib/audio-engine";
import { addHistoryItem } from "@/lib/store";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const prompt = String(body.prompt ?? "Warm welcome acoustic jingle").trim();
    const durationSec = Math.max(4, Math.min(30, Number(body.duration ?? 8)));
    const mood = body.mood ?? "warm";

    const result = await synthesizeMusicJingle(prompt, durationSec, mood);
    const creditsUsed = Math.round(durationSec * 8);

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

    const updated = addHistoryItem(historyItem, creditsUsed);

    return NextResponse.json({
      ...result,
      creditsUsed,
      creditsBalance: updated.creditsBalance,
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
