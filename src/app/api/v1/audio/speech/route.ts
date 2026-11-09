import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { findVoice, addHistoryItem, verifyApiKey, readStore } from "@/lib/store";
import { synthesizeSpeech } from "@/lib/audio-engine";

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
    if (!verifyApiKey(token)) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const body = await req.json();
    const isStudio = req.headers.get("x-saktts-client") === "studio" || req.nextUrl.searchParams.get("meta") === "1";

    const rawVoice = body.voice ?? "Maly";
    const model = typeof body.model === "string" ? body.model : undefined;
    const defaultVoice = findVoice(rawVoice);
    const speed = Math.max(0.7, Math.min(1.2, Number(body.speed ?? 1.0)));
    const stability = Math.max(0.1, Math.min(2.5, Number(body.stability ?? 1.7)));
    const pitchSemitones = Math.max(-6, Math.min(6, Number(body.pitch ?? 0)));
    const matchingMode: "precise" | "natural" =
      body.matching_mode === "natural" || body.matchingMode === "natural" ? "natural" : "precise";
    const emotion = body.emotion ?? "neutral";
    const controlInstruction =
      typeof (body.control_instruction ?? body.controlInstruction) === "string"
        ? String(body.control_instruction ?? body.controlInstruction).trim() || undefined
        : undefined;
    const normalizeNumbers = body.normalize_text !== false;
    const format: "mp3" | "wav" = body.response_format === "wav" ? "wav" : "mp3";

    const paragraphsInput: Array<{ text: string; voice?: string }> | undefined = Array.isArray(body.paragraphs)
      ? body.paragraphs
      : undefined;

    const textInput = String(body.input ?? body.text ?? "").trim();

    if (!textInput && (!paragraphsInput || paragraphsInput.length === 0)) {
      return NextResponse.json({ error: "Missing 'input' text" }, { status: 400 });
    }

    const resolvedParagraphs = paragraphsInput
      ? paragraphsInput
          .filter((p) => p.text?.trim())
          .map((p) => ({
            text: p.text.trim(),
            voice: findVoice(p.voice ?? defaultVoice.name),
          }))
      : [{ text: textInput, voice: defaultVoice }];

    const fullText = resolvedParagraphs.map((p) => p.text).join("\n\n");
    const creditsUsed = Math.max(10, Math.round(fullText.length * 1.1));

    const result = await synthesizeSpeech({
      paragraphs: resolvedParagraphs,
      voice: defaultVoice,
      model,
      speed,
      stability,
      pitchSemitones,
      matchingMode,
      emotion,
      controlInstruction,
      normalizeNumbers,
      format,
    });

    const store = readStore();
    const historyItem = {
      id: result.id,
      type: defaultVoice.category === "Cloned" || defaultVoice.category === "Designed" ? ("clone" as const) : ("tts" as const),
      title: fullText.slice(0, 48) + (fullText.length > 48 ? "…" : ""),
      text: fullText,
      voiceId: defaultVoice.id,
      voiceName: defaultVoice.name,
      language: defaultVoice.language,
      durationSec: result.durationSec,
      creditsUsed,
      audioUrl: result.audioUrl,
      format: result.format,
      waveform: result.waveform,
      cues: result.cues,
      createdAt: new Date().toISOString(),
    };

    const updated = addHistoryItem(historyItem, body.skipCredits ? 0 : creditsUsed);

    if (isStudio) {
      return NextResponse.json({
        id: result.id,
        audioUrl: result.audioUrl,
        durationSec: result.durationSec,
        waveform: result.waveform,
        cues: result.cues,
        format: result.format,
        creditsUsed: body.skipCredits ? 0 : creditsUsed,
        creditsBalance: updated.creditsBalance,
        historyItem,
      });
    }

    const fileBytes = fs.readFileSync(result.filePath);
    return new NextResponse(fileBytes, {
      status: 200,
      headers: {
        "Content-Type": format === "wav" ? "audio/wav" : "audio/mpeg",
        "Content-Length": String(fileBytes.length),
        "Content-Disposition": `inline; filename="${result.id}.${format}"`,
        "X-SAKTTS-Credits-Remaining": String(updated.creditsBalance ?? store.creditsBalance),
      },
    });
  } catch (error) {
    console.error("TTS synthesis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to synthesize speech" },
      { status: 500 }
    );
  }
}
