import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { VoiceProfile } from "./voices";
import { normalizeTextForSpeech, parseSpeechChunks } from "./khmer-normalizer";
import { getAudioDir } from "./store";
import { synthesizeWithVoxCPM } from "./voice-engine-client";

const execFileAsync = promisify(execFile);

export interface SynthesizeOptions {
  text?: string;
  paragraphs?: Array<{ text: string; voice: VoiceProfile }>;
  voice: VoiceProfile;
  model?: string;
  speed?: number; // 0.7 - 1.2
  stability?: number; // 0.1 - 2.5
  pitchSemitones?: number; // -6 to +6
  matchingMode?: "precise" | "natural";
  emotion?: "neutral" | "calm" | "warm" | "news" | "energetic" | "whisper";
  controlInstruction?: string;
  normalizeNumbers?: boolean;
  format?: "mp3" | "wav";
}

export interface SynthesizeResult {
  id: string;
  filePath: string;
  audioUrl: string;
  format: "mp3" | "wav";
  durationSec: number;
  waveform: number[];
  bytes: number;
}

async function synthesizeEdgeChunk(
  text: string,
  neuralVoice: string,
  ratePct: number,
  pitchHz: number,
  outPath: string
): Promise<void> {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(neuralVoice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);

  const rateStr = `${ratePct >= 0 ? "+" : ""}${Math.round(ratePct)}%`;
  const pitchStr = `${pitchHz >= 0 ? "+" : ""}${Math.round(pitchHz)}Hz`;

  const { audioStream } = tts.toStream(text, {
    rate: rateStr,
    pitch: pitchStr,
  });

  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("TTS timeout")), 15000);
    audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
    audioStream.on("end", () => {
      clearTimeout(timer);
      resolve();
    });
    audioStream.on("error", (err: Error) => {
      clearTimeout(timer);
      reject(err);
    });
  });

  if (chunks.length === 0) {
    throw new Error("Empty audio stream from edge-tts");
  }
  fs.writeFileSync(outPath, Buffer.concat(chunks));
}

async function synthesizeMacSayFallback(
  text: string,
  gender: "female" | "male",
  rate: number,
  outPath: string
): Promise<void> {
  const tmpAiff = outPath + ".aiff";
  const voiceName = gender === "female" ? "Samantha" : "Daniel";
  const wordsPerMin = Math.round(175 * rate);
  const safeText = text.replace(/[\u1780-\u17FF]+/g, " SAKTTS voice synthesis ");
  await execFileAsync("say", [
    "-v",
    voiceName,
    "-r",
    String(wordsPerMin),
    "-o",
    tmpAiff,
    safeText || "Welcome to SAKTTS.",
  ]);
  await execFileAsync("ffmpeg", ["-y", "-i", tmpAiff, "-ar", "24000", "-ac", "1", outPath]);
  if (fs.existsSync(tmpAiff)) fs.unlinkSync(tmpAiff);
}

async function createSilenceFile(
  durationMs: number,
  outPath: string,
  sampleRate = 24000
): Promise<void> {
  const sec = Math.max(0.1, durationMs / 1000).toFixed(3);
  const isWav = outPath.toLowerCase().endsWith(".wav");
  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `anullsrc=r=${sampleRate}:cl=mono`,
    "-t",
    sec,
    ...(isWav ? ["-c:a", "pcm_s16le"] : ["-q:a", "6"]),
    outPath,
  ]);
}

function resolveReferenceAudioPath(voice: VoiceProfile): string | null {
  if (voice.category !== "Cloned") return null;
  const candidate = voice.referenceSampleUrl || voice.customSampleUrl;
  if (!candidate || !candidate.startsWith("/api/v1/audio/")) return null;
  const filePath = path.join(getAudioDir(), path.basename(candidate));
  return fs.existsSync(filePath) ? filePath : null;
}

const EMOTION_INSTRUCT: Record<NonNullable<SynthesizeOptions["emotion"]>, string | undefined> = {
  neutral: undefined,
  calm: "calm, gentle, unhurried delivery",
  warm: "warm, friendly, natural storytelling tone",
  news: "crisp, clear broadcast news anchor articulation",
  energetic: "upbeat, lively, enthusiastic expression",
  whisper: "soft, intimate, quiet whisper",
};

function buildVoxCpmInstruct(
  voice: VoiceProfile,
  isDesignedOrModel: boolean,
  emotion: NonNullable<SynthesizeOptions["emotion"]>,
  overrideInstruct?: string
): string | undefined {
  if (voice.category === "Cloned" && voice.promptText?.trim()) {
    // Ultimate continuation mode aligns promptText directly to promptAudio without (instruct)
    return undefined;
  }
  const parts: string[] = [];
  if (isDesignedOrModel) {
    const baseDesign =
      voice.designPrompt?.trim() ||
      `${voice.gender} ${voice.language} narrator, ${voice.timbre} vocal tone, ${voice.description}`;
    parts.push(baseDesign);
  }
  const customCtrl = overrideInstruct?.trim() || voice.controlInstruction?.trim();
  if (customCtrl) parts.push(customCtrl);
  const emo = EMOTION_INSTRUCT[emotion];
  if (emo) parts.push(emo);
  const merged = parts.join(", ").trim();
  return merged || undefined;
}

function splitBilingualPauseRuns(
  normalizedText: string
): Array<{ type: "pause"; pauseMs: number } | { type: "text"; text: string }> {
  const tokens = normalizedText.split(/(\[break=\d+(?:\.\d+)?(?:ms|s)\])/gi);
  const out: Array<{ type: "pause"; pauseMs: number } | { type: "text"; text: string }> = [];
  for (const token of tokens) {
    if (!token) continue;
    const pauseMatch = token.match(/^\[break=(\d+(?:\.\d+)?)(ms|s)\]$/i);
    if (pauseMatch) {
      const val = parseFloat(pauseMatch[1]);
      const ms = pauseMatch[2].toLowerCase() === "ms" ? val : val * 1000;
      out.push({ type: "pause", pauseMs: Math.min(Math.max(ms, 100), 10000) });
    } else {
      const trimmed = token.trim();
      if (trimmed) out.push({ type: "text", text: trimmed });
    }
  }
  return out;
}

function buildTimbreFilter(
  timbre: VoiceProfile["timbre"],
  emotion: SynthesizeOptions["emotion"],
  pitchSemitones: number,
  speedMultiplier: number
): string {
  const filters: string[] = [];

  // Fine pitch adjustment using asetrate + atempo compensation
  const clampedSemi = Math.max(-5, Math.min(5, pitchSemitones));
  if (Math.abs(clampedSemi) > 0.15) {
    const factor = Math.pow(2, clampedSemi / 12);
    const inv = 1 / factor;
    filters.push(`asetrate=24000*${factor.toFixed(4)},aresample=24000`);
    const combinedTempo = Math.max(0.6, Math.min(1.6, inv * speedMultiplier));
    filters.push(`atempo=${combinedTempo.toFixed(4)}`);
  } else if (Math.abs(speedMultiplier - 1.0) > 0.02) {
    filters.push(`atempo=${Math.max(0.6, Math.min(1.5, speedMultiplier)).toFixed(4)}`);
  }

  // Acoustic timbre EQ shaping
  if (timbre === "warm" || emotion === "warm") {
    filters.push("equalizer=f=220:t=q:w=1.2:g=2.5,equalizer=f=4500:t=q:w=1.5:g=-1.5");
  } else if (timbre === "bright" || emotion === "energetic") {
    filters.push("equalizer=f=3200:t=q:w=1.4:g=3.0,equalizer=f=180:t=q:w=1.2:g=-1.5");
  } else if (timbre === "deep") {
    filters.push("equalizer=f=140:t=q:w=1.1:g=3.5,equalizer=f=3800:t=q:w=1.6:g=-2.0");
  } else if (timbre === "soft" || emotion === "calm" || emotion === "whisper") {
    filters.push("equalizer=f=280:t=q:w=1.2:g=1.5,lowpass=f=6800");
  } else if (timbre === "crisp" || emotion === "news") {
    filters.push("equalizer=f=2400:t=q:w=1.3:g=2.0,acompressor=threshold=-18dB:ratio=2.5");
  }

  return filters.join(",");
}

export async function inspectAudioMetrics(filePath: string): Promise<{
  durationSec: number;
  waveform: number[];
}> {
  let durationSec = 2.0;
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      filePath,
    ]);
    const parsed = parseFloat(stdout.trim());
    if (!Number.isNaN(parsed) && parsed > 0) {
      durationSec = Math.round(parsed * 100) / 100;
    }
  } catch {
    // ignore fallback
  }

  // Extract 48 PCM amplitude bars using ffmpeg raw s16le output
  const bars = 48;
  let waveform: number[] = [];
  try {
    const { stdout } = await execFileAsync(
      "ffmpeg",
      ["-i", filePath, "-ac", "1", "-ar", "4000", "-f", "s16le", "-"],
      { encoding: "buffer", maxBuffer: 10 * 1024 * 1024 }
    );
    const buf = stdout as unknown as Buffer;
    const totalSamples = Math.floor(buf.length / 2);
    if (totalSamples >= bars) {
      const step = Math.floor(totalSamples / bars);
      const peaks: number[] = [];
      for (let i = 0; i < bars; i++) {
        let sum = 0;
        const start = i * step;
        for (let j = 0; j < step; j++) {
          const sample = buf.readInt16LE((start + j) * 2);
          sum += Math.abs(sample);
        }
        peaks.push(sum / step);
      }
      const maxPeak = Math.max(...peaks, 1);
      waveform = peaks.map((p) =>
        Math.max(16, Math.min(96, Math.round((p / maxPeak) * 85 + 14)))
      );
    }
  } catch {
    // fallback deterministic waveform
  }

  if (waveform.length !== bars) {
    waveform = Array.from({ length: bars }, (_, idx) =>
      Math.round(30 + Math.abs(Math.sin(idx * 0.45) * 45) + ((idx * 7) % 15))
    );
  }

  return { durationSec, waveform };
}

export async function synthesizeSpeech(opts: SynthesizeOptions): Promise<SynthesizeResult> {
  const id = `speech-${crypto.randomUUID().slice(0, 10)}`;
  const audioDir = getAudioDir();
  const tmpDir = path.join(audioDir, `.tmp-${id}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const speed = opts.speed ?? 1.0;
  const stability = opts.stability ?? 1.7;
  const emotion = opts.emotion ?? "neutral";
  const format = opts.format ?? "mp3";
  const normalizeNumbers = opts.normalizeNumbers ?? true;

  const emotionSpeedAdj =
    emotion === "calm" ? 0.92 : emotion === "energetic" ? 1.06 : emotion === "whisper" ? 0.94 : 1.0;
  const emotionPitchAdj =
    emotion === "calm" ? -0.5 : emotion === "energetic" ? 0.8 : emotion === "warm" ? -0.3 : 0;

  const paragraphs =
    opts.paragraphs && opts.paragraphs.length > 0
      ? opts.paragraphs
      : [{ text: opts.text || "", voice: opts.voice }];

  const usesVoxCpmAnywhere = paragraphs.some(
    (p) =>
      Boolean(resolveReferenceAudioPath(p.voice)) ||
      p.voice.category === "Designed" ||
      opts.model === "voxcpm2-48k"
  );
  const targetSampleRate = usesVoxCpmAnywhere ? 48000 : 24000;

  const chunkFiles: string[] = [];

  try {
    let idx = 0;
    for (let pIndex = 0; pIndex < paragraphs.length; pIndex++) {
      const p = paragraphs[pIndex];
      const normalized = normalizeTextForSpeech(p.text, normalizeNumbers);

      const refAudioPath = resolveReferenceAudioPath(p.voice);
      const isDesignedVoice = p.voice.category === "Designed";
      const useVoxCpm =
        Boolean(refAudioPath) || isDesignedVoice || opts.model === "voxcpm2-48k";

      const effectiveSpeed = speed * p.voice.rateFactor * emotionSpeedAdj;
      const effectivePitchSemi =
        (opts.pitchSemitones ?? 0) + p.voice.pitchSemitones + emotionPitchAdj;

      // Edge TTS prosody baseline (for built-in standard voices & offline fallback)
      const ratePct = (effectiveSpeed - 1.0) * 100;
      const pitchHz = refAudioPath ? 0 : effectivePitchSemi * 4;
      const stabilityPitchOffset = stability < 1.0 ? 2 : stability > 2.1 ? -1 : 0;

      if (useVoxCpm) {
        const runs = splitBilingualPauseRuns(normalized);
        const instruct = buildVoxCpmInstruct(
          p.voice,
          !refAudioPath,
          emotion,
          opts.controlInstruction
        );
        const inferenceTimesteps = opts.matchingMode === "natural" ? 8 : 10;
        const cfgValue = Number(
          Math.max(
            2.0,
            Math.min(
              2.6,
              2.0 + (opts.matchingMode === "natural" ? 0 : 0.2) + (stability - 1.7) * 0.2
            )
          ).toFixed(2)
        );
        const voxPitchShift = refAudioPath ? opts.pitchSemitones ?? 0 : effectivePitchSemi;

        for (const run of runs) {
          const chunkPath = path.join(tmpDir, `chunk-${String(idx++).padStart(3, "0")}.wav`);
          if (run.type === "pause") {
            await createSilenceFile(run.pauseMs, chunkPath, targetSampleRate);
            chunkFiles.push(chunkPath);
            continue;
          }

          const voxOutPath = path.join(tmpDir, `vox-${idx}.wav`);
          const voxResult = await synthesizeWithVoxCPM({
            text: run.text,
            outputPath: voxOutPath,
            refAudioPath: refAudioPath ?? undefined,
            promptAudioPath: refAudioPath && p.voice.promptText?.trim() ? refAudioPath : undefined,
            promptText: refAudioPath && p.voice.promptText?.trim() ? p.voice.promptText.trim() : undefined,
            instruct,
            inferenceTimesteps,
            cfgValue,
            speed: effectiveSpeed,
            pitchShift: voxPitchShift,
          });

          if (voxResult?.ok && fs.existsSync(voxOutPath)) {
            await execFileAsync("ffmpeg", [
              "-y",
              "-i",
              voxOutPath,
              "-ar",
              String(targetSampleRate),
              "-ac",
              "1",
              "-c:a",
              "pcm_s16le",
              chunkPath,
            ]);
            fs.unlinkSync(voxOutPath);
            chunkFiles.push(chunkPath);
            continue;
          }

          // Graceful Edge-TTS fallback only if local VoxCPM2 MLX engine is unavailable
          const chunksFallback = parseSpeechChunks(run.text);
          const subRawPaths: string[] = [];
          for (let sIdx = 0; sIdx < chunksFallback.length; sIdx++) {
            const sub = chunksFallback[sIdx];
            if (sub.type !== "text" || !sub.text) continue;
            const neuralVoice = sub.lang === "km" ? p.voice.neuralVoiceKm : p.voice.neuralVoiceEn;
            const rawSub = path.join(tmpDir, `sub-${idx}-${sIdx}.mp3`);
            try {
              await synthesizeEdgeChunk(
                sub.text,
                neuralVoice,
                ratePct,
                pitchHz + stabilityPitchOffset,
                rawSub
              );
            } catch {
              await synthesizeMacSayFallback(
                sub.text,
                p.voice.gender,
                effectiveSpeed,
                rawSub
              );
            }
            subRawPaths.push(rawSub);
          }

          if (subRawPaths.length > 0) {
            const fallbackFilter = buildTimbreFilter(
              p.voice.timbre,
              emotion,
              refAudioPath ? effectivePitchSemi * 0.55 : effectivePitchSemi,
              1.0
            );
            const mergedIn = subRawPaths[0];
            await execFileAsync("ffmpeg", [
              "-y",
              ...(subRawPaths.length === 1
                ? ["-i", mergedIn]
                : [
                    "-i",
                    `concat:${subRawPaths.join("|")}`,
                  ]),
              ...(fallbackFilter ? ["-af", fallbackFilter] : []),
              "-ar",
              String(targetSampleRate),
              "-ac",
              "1",
              "-c:a",
              "pcm_s16le",
              chunkPath,
            ]);
            for (const f of subRawPaths) {
              if (fs.existsSync(f)) fs.unlinkSync(f);
            }
            chunkFiles.push(chunkPath);
          }
        }
      } else {
        // Fast Edge TTS path for built-in studio voices
        const chunks = parseSpeechChunks(normalized);
        for (const chunk of chunks) {
          const chunkPath = path.join(tmpDir, `chunk-${String(idx++).padStart(3, "0")}.wav`);
          if (chunk.type === "pause") {
            await createSilenceFile(chunk.pauseMs ?? 1000, chunkPath, targetSampleRate);
            chunkFiles.push(chunkPath);
            continue;
          }
          if (!chunk.text) continue;

          const neuralVoice =
            chunk.lang === "km" ? p.voice.neuralVoiceKm : p.voice.neuralVoiceEn;
          const rawChunkPath = chunkPath + ".raw.mp3";
          try {
            await synthesizeEdgeChunk(
              chunk.text,
              neuralVoice,
              ratePct,
              pitchHz + stabilityPitchOffset,
              rawChunkPath
            );
          } catch {
            await synthesizeMacSayFallback(
              chunk.text,
              p.voice.gender,
              effectiveSpeed,
              rawChunkPath
            );
          }

          const filterChain = buildTimbreFilter(
            p.voice.timbre,
            emotion,
            opts.pitchSemitones ?? 0,
            1.0
          );

          await execFileAsync("ffmpeg", [
            "-y",
            "-i",
            rawChunkPath,
            ...(filterChain ? ["-af", filterChain] : []),
            "-ar",
            String(targetSampleRate),
            "-ac",
            "1",
            "-c:a",
            "pcm_s16le",
            chunkPath,
          ]);
          if (fs.existsSync(rawChunkPath)) fs.unlinkSync(rawChunkPath);
          chunkFiles.push(chunkPath);
        }
      }

      // Natural pause between dialogue paragraphs
      if (pIndex < paragraphs.length - 1) {
        const gapPath = path.join(tmpDir, `chunk-${String(idx++).padStart(3, "0")}.wav`);
        await createSilenceFile(450, gapPath, targetSampleRate);
        chunkFiles.push(gapPath);
      }
    }

    if (chunkFiles.length === 0) {
      const emptyPath = path.join(tmpDir, "empty.wav");
      await createSilenceFile(800, emptyPath, targetSampleRate);
      chunkFiles.push(emptyPath);
    }

    const finalPath = path.join(audioDir, `${id}.${format}`);

    if (chunkFiles.length === 1) {
      await execFileAsync("ffmpeg", [
        "-y",
        "-i",
        chunkFiles[0],
        "-ar",
        String(targetSampleRate),
        "-ac",
        "1",
        ...(format === "mp3" ? ["-c:a", "libmp3lame", "-q:a", "1"] : ["-c:a", "pcm_s16le"]),
        finalPath,
      ]);
    } else {
      const listPath = path.join(tmpDir, "concat.txt");
      fs.writeFileSync(
        listPath,
        chunkFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n")
      );
      await execFileAsync("ffmpeg", [
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listPath,
        "-ar",
        String(targetSampleRate),
        "-ac",
        "1",
        ...(format === "mp3" ? ["-c:a", "libmp3lame", "-q:a", "1"] : ["-c:a", "pcm_s16le"]),
        finalPath,
      ]);
    }

    const { durationSec, waveform } = await inspectAudioMetrics(finalPath);
    const bytes = fs.statSync(finalPath).size;

    return {
      id,
      filePath: finalPath,
      audioUrl: `/api/v1/audio/${id}.${format}`,
      format,
      durationSec,
      waveform,
      bytes,
    };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

/**
 * Generates an ambient musical jingle / soundbed using ffmpeg synthesis
 * (used in the Music / Soundboard Studio and MCP jingle workflow).
 */
export async function synthesizeMusicJingle(
  prompt: string,
  durationSec = 10,
  mood: "warm" | "upbeat" | "ambient" | "cinematic" = "warm"
): Promise<SynthesizeResult> {
  const id = `music-${crypto.randomUUID().slice(0, 10)}`;
  const audioDir = getAudioDir();
  const finalPath = path.join(audioDir, `${id}.mp3`);
  const dur = Math.max(4, Math.min(30, durationSec));

  // Choose musical chord frequencies based on mood / prompt hash
  const chords: Record<string, [number, number, number]> = {
    warm: [261.63, 329.63, 392.0], // C major warm
    upbeat: [293.66, 369.99, 440.0], // D major bright
    ambient: [220.0, 261.63, 329.63], // A minor airy
    cinematic: [196.0, 246.94, 293.66], // G resonant
  };
  const [f1, f2, f3] = chords[mood] ?? chords.warm;

  // Build gentle layered harmonic pad with envelope fades
  const expr = `0.18*sin(2*PI*${f1}*t)*sin(2*PI*0.25*t+0.5)+0.15*sin(2*PI*${f2}*t)+0.12*sin(2*PI*${f3}*t)*(0.6+0.4*sin(2*PI*0.5*t))+0.08*sin(2*PI*${(f1 / 2).toFixed(2)}*t)`;

  await execFileAsync("ffmpeg", [
    "-y",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc='${expr}':s=24000:d=${dur}`,
    "-af",
    `afade=t=in:st=0:d=1.2,afade=t=out:st=${Math.max(1, dur - 1.8)}:d=1.8,lowpass=f=2600`,
    "-c:a",
    "libmp3lame",
    "-q:a",
    "3",
    finalPath,
  ]);

  const metrics = await inspectAudioMetrics(finalPath);
  const bytes = fs.statSync(finalPath).size;

  return {
    id,
    filePath: finalPath,
    audioUrl: `/api/v1/audio/${id}.mp3`,
    format: "mp3",
    durationSec: metrics.durationSec,
    waveform: metrics.waveform,
    bytes,
  };
}
