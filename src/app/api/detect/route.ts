import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAudioDir } from "@/lib/store";
import { analyzeAudioFile } from "@/lib/stt-engine";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const tmpName = `detect-${crypto.randomUUID().slice(0, 8)}${path.extname(file.name || "audio.mp3") || ".mp3"}`;
    const tmpPath = path.join(getAudioDir(), tmpName);
    fs.writeFileSync(tmpPath, Buffer.from(await file.arrayBuffer()));

    const profile = await analyzeAudioFile(tmpPath);
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);

    return NextResponse.json({
      fileName: file.name,
      aiLikelihoodScore: profile.aiLikelihoodScore,
      verdict:
        profile.aiLikelihoodScore >= 65
          ? "Likely AI-generated"
          : profile.aiLikelihoodScore >= 40
          ? "Mixed / Uncertain"
          : "Likely Human speech",
      durationSec: profile.durationSec,
      metrics: profile.metrics,
    });
  } catch (error) {
    console.error("Detect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
