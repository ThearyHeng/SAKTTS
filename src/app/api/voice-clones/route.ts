import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextRequest, NextResponse } from "next/server";
import {
  appendTransaction,
  checkUserCanSpend,
  getAudioDir,
  readStore,
  resolveUserFromStore,
  writeStore,
} from "@/lib/store";
import { getSessionUserId } from "@/lib/auth-session";
import { VoiceProfile } from "@/lib/voices";
import { AcousticProfile, analyzeAudioFile } from "@/lib/stt-engine";
import { synthesizeSpeech } from "@/lib/audio-engine";

const execFileAsync = promisify(execFile);

const ORB_PALETTES = [
  { base: "#f4a462", primary: "#8c8fd8", secondary: "#3e596e", angle: 168 },
  { base: "#82acde", primary: "#d7a19f", secondary: "#5a7ea8", angle: 120 },
  { base: "#9ab8a8", primary: "#52796f", secondary: "#e6b89c", angle: 48 },
  { base: "#e5b8a4", primary: "#9f87af", secondary: "#52489c", angle: 215 },
  { base: "#c8b3cf", primary: "#74698c", secondary: "#e2b698", angle: 270 },
];

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") ?? "";
    let mode: "clone" | "design" = "clone";
    let name = "";
    let description = "";
    let language: "Khmer" | "English" | "Bilingual" = "Bilingual";
    let gender: "female" | "male" = "female";
    let pitchSemitones = 0;
    let rateFactor = 1.0;
    let timbre: VoiceProfile["timbre"] = "warm";
    let referenceSampleUrl: string | undefined;
    let acousticProfile: AcousticProfile | undefined;
    let designPrompt: string | undefined;
    let promptText: string | undefined;
    let controlInstruction: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      mode = (fd.get("mode") as string) === "design" ? "design" : "clone";
      name = String(fd.get("name") ?? "").trim();
      description = String(fd.get("description") ?? "").trim();
      promptText = String(fd.get("promptText") ?? "").trim() || undefined;
      controlInstruction = String(fd.get("controlInstruction") ?? "").trim() || undefined;
      language = (fd.get("language") as VoiceProfile["language"]) || "Bilingual";
      const file = fd.get("file") as File | null;
      const explicitGender = fd.get("gender") as string | null;

      if (!name) {
        return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
      }

      if (file) {
        const audioDir = getAudioDir();
        const sampleId = crypto.randomUUID().slice(0, 8);
        const ext = path.extname(file.name || "sample.webm") || ".webm";
        const rawPath = path.join(audioDir, `raw-${sampleId}${ext}`);
        const refName = `ref-${sampleId}.wav`;
        const refPath = path.join(audioDir, refName);
        fs.writeFileSync(rawPath, Buffer.from(await file.arrayBuffer()));

        try {
          // Normalize uploaded MP3/M4A/WEBM/WAV to clean 48kHz mono WAV for F0 analysis & VoxCPM2 conditioning
          await execFileAsync("ffmpeg", [
            "-y",
            "-i",
            rawPath,
            "-ar",
            "48000",
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            refPath,
          ]);
          if (fs.existsSync(rawPath)) fs.unlinkSync(rawPath);
          referenceSampleUrl = `/api/v1/audio/${refName}`;
        } catch {
          // Fallback to original file if transcode fails
          fs.renameSync(rawPath, path.join(audioDir, `sample-${sampleId}${ext}`));
          referenceSampleUrl = `/api/v1/audio/sample-${sampleId}${ext}`;
        }

        const analysisPath = path.join(audioDir, path.basename(referenceSampleUrl));
        acousticProfile = await analyzeAudioFile(analysisPath);
        pitchSemitones = acousticProfile.suggestedPitchSemitones;
        timbre = acousticProfile.suggestedTimbre;
        gender =
          explicitGender === "male" || explicitGender === "female"
            ? explicitGender
            : acousticProfile.suggestedGender;
      }
    } else {
      const body = await req.json();
      mode = body.mode === "clone" ? "clone" : "design";
      name = String(body.name ?? "").trim();
      description = String(body.description ?? "").trim();
      designPrompt = String(body.prompt ?? description ?? "").trim();
      promptText = String(body.promptText ?? "").trim() || undefined;
      controlInstruction = String(body.controlInstruction ?? "").trim() || undefined;
      language = body.language || "Bilingual";
      gender = body.gender === "male" ? "male" : "female";
      pitchSemitones = Number(body.pitch ?? 0);
      rateFactor = Number(body.speed ?? 1.0);
      timbre =
        body.timbre ||
        (designPrompt.toLowerCase().includes("deep")
          ? "deep"
          : designPrompt.toLowerCase().includes("bright")
          ? "bright"
          : "warm");
    }

    if (!name) {
      return NextResponse.json({ error: "Voice name is required" }, { status: 400 });
    }

    const sessionUid = getSessionUserId(req);
    const cloneCost = 50;
    const spendCheck = checkUserCanSpend(cloneCost, sessionUid);
    if (!spendCheck.ok) {
      return NextResponse.json({ error: spendCheck.error }, { status: spendCheck.status });
    }

    const palette = ORB_PALETTES[Math.floor(Math.random() * ORB_PALETTES.length)];
    const id = `custom-${crypto.randomUUID().slice(0, 8)}`;

    const newVoice: VoiceProfile = {
      id,
      name,
      gender,
      language,
      category: mode === "clone" ? "Cloned" : "Designed",
      description:
        description ||
        (mode === "clone"
          ? acousticProfile?.medianF0Hz
            ? `Khmer Natural Voice ${promptText ? "Ultimate" : "Controllable"} clone (${Math.round(acousticProfile.medianF0Hz)} Hz ${gender}) from reference audio.`
            : "Khmer Natural Voice neural voice clone created from reference recording."
          : `Khmer Natural Voice designed voice: ${designPrompt || "Warm expressive narrator"}`),
      refText:
        language === "English"
          ? `Hello! This is ${name}, ready to narrate your script in natural English.`
          : `សួស្តី! នេះគឺជាសំឡេងរបស់ ${name} ដែលរួចរាល់សម្រាប់អានអត្ថបទរបស់អ្នក។`,
      neuralVoiceKm: gender === "female" ? "km-KH-SreymomNeural" : "km-KH-PisethNeural",
      neuralVoiceEn: gender === "female" ? "en-US-AvaMultilingualNeural" : "en-US-AndrewMultilingualNeural",
      pitchSemitones,
      rateFactor,
      timbre,
      orb: palette,
      referenceSampleUrl,
      pitchHz: acousticProfile?.medianF0Hz,
      engine: mode === "clone" && !referenceSampleUrl ? "edge-tts" : "voxcpm2",
      promptText,
      controlInstruction,
      designPrompt,
      createdAt: new Date().toISOString(),
    };

    // Synthesize a genuine VoxCPM2 48 kHz cloned/designed preview sample right away
    try {
      const preview = await synthesizeSpeech({
        text: newVoice.refText,
        voice: newVoice,
        speed: rateFactor,
        pitchSemitones: mode === "clone" ? 0 : pitchSemitones,
        matchingMode: "precise",
        controlInstruction,
        format: "mp3",
      });
      newVoice.customSampleUrl = preview.audioUrl;
    } catch (previewErr) {
      console.warn("Preview synthesis warning:", previewErr);
      newVoice.customSampleUrl = referenceSampleUrl;
    }

    const store = readStore();
    const active = resolveUserFromStore(store, sessionUid);
    const deducted = Math.min(active.creditsBalance, cloneCost);
    active.creditsBalance = Math.max(0, active.creditsBalance - cloneCost);
    active.creditsUsedTotal = (active.creditsUsedTotal || 0) + deducted;
    active.lastActiveAt = new Date().toISOString();
    store.customVoices = [newVoice, ...store.customVoices];
    appendTransaction(store, {
      userId: active.id,
      userName: active.name,
      userEmail: active.email,
      type: "usage",
      amount: -deducted,
      balanceAfter: active.creditsBalance,
      feature: "clone",
      description: `Created ${mode === "clone" ? "cloned" : "designed"} voice "${newVoice.name}"`,
    });
    writeStore(store);

    return NextResponse.json({
      voice: newVoice,
      profile: acousticProfile ?? null,
      creditsBalance: active.creditsBalance,
    });
  } catch (error) {
    console.error("Voice clone error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create voice" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Voice id required" }, { status: 400 });
  }
  const store = readStore();
  const target = store.customVoices.find((v) => v.id === id);
  store.customVoices = store.customVoices.filter((v) => v.id !== id);
  writeStore(store);

  const cleanupCandidates = new Set<string>();
  if (target?.referenceSampleUrl?.startsWith("/api/v1/audio/")) {
    cleanupCandidates.add(path.join(getAudioDir(), path.basename(target.referenceSampleUrl)));
  }
  if (target?.customSampleUrl?.startsWith("/api/v1/audio/")) {
    cleanupCandidates.add(path.join(getAudioDir(), path.basename(target.customSampleUrl)));
  }
  for (const filePath of cleanupCandidates) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  return NextResponse.json({ ok: true });
}
