import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { addHistoryItem, getAudioDir } from "@/lib/store";
import { inspectAudioMetrics } from "@/lib/audio-engine";
import { transcribeAudioSegments, formatTranscriptExport } from "@/lib/stt-engine";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const hintText = (formData.get("hintText") as string | null) ?? "";
    const language = (formData.get("language") as string | null) ?? "auto";
    const responseFormat = (formData.get("response_format") as string | null) ?? "verbose_json";

    if (!file) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
    }

    const id = `stt-${crypto.randomUUID().slice(0, 10)}`;
    const ext = path.extname(file.name || "recording.webm") || ".webm";
    const fileName = `${id}${ext}`;
    const filePath = path.join(getAudioDir(), fileName);
    const bytes = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, bytes);

    const [{ durationSec, segments }, metrics] = await Promise.all([
      transcribeAudioSegments(filePath, hintText, language),
      inspectAudioMetrics(filePath),
    ]);

    const fullText = segments
      .map((s) => s.words.map((w) => w.text).join(" "))
      .join(" ");

    const creditsUsed = Math.max(15, Math.round(durationSec * 3.5));
    const audioUrl = `/api/v1/audio/${fileName}`;

    const historyItem = {
      id,
      type: "stt" as const,
      title: file.name || "Voice Recording",
      text: fullText,
      language: language === "auto" ? "Khmer & English" : language,
      durationSec,
      creditsUsed,
      audioUrl,
      format: ext.replace(".", ""),
      waveform: metrics.waveform,
      segments,
      createdAt: new Date().toISOString(),
    };

    const updated = addHistoryItem(historyItem, creditsUsed);

    if (responseFormat === "srt" || responseFormat === "vtt" || responseFormat === "txt") {
      const formatted = formatTranscriptExport(segments, responseFormat);
      return new NextResponse(formatted, {
        status: 200,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }

    return NextResponse.json({
      id,
      text: fullText,
      durationSec,
      audioUrl,
      waveform: metrics.waveform,
      segments,
      creditsUsed,
      creditsBalance: updated.creditsBalance,
      historyItem,
    });
  } catch (error) {
    console.error("STT error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
