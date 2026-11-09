import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ENGINE_URL = process.env.SAKTTS_VOICE_ENGINE_URL || "http://127.0.0.1:8765";

export interface EngineHealth {
  ok: boolean;
  ready: boolean;
  loading?: boolean;
  device?: string;
  model?: string;
  sample_rate?: number;
  error?: string | null;
}

export interface EngineAcousticAnalysis {
  durationSec: number;
  medianF0Hz: number;
  spectralCentroidHz: number;
  rmsLevel: number;
  meanVolumeDb: number;
  maxVolumeDb: number;
  dynamicRangeDb: number;
  silenceRatio: number;
  suggestedPitchSemitones: number;
  suggestedTimbre: "warm" | "bright" | "deep" | "crisp" | "soft";
  suggestedGender: "female" | "male";
}

export interface EngineConvertParams {
  sourcePath: string;
  targetPath: string;
  outputPath: string;
  diffusionSteps?: number;
  inferenceCfgRate?: number;
  lengthAdjust?: number;
  pitchShift?: number;
}

export interface EngineConvertResult {
  ok: boolean;
  outputPath: string;
  durationSec: number;
  elapsedSec: number;
  sourceF0Hz?: number;
  targetF0Hz?: number;
  outputF0Hz?: number;
  device?: string;
}

export interface EngineSynthesizeParams {
  text: string;
  outputPath: string;
  refAudioPath?: string;
  promptAudioPath?: string;
  promptText?: string;
  instruct?: string;
  inferenceTimesteps?: number;
  cfgValue?: number;
  speed?: number;
  pitchShift?: number;
}

export interface EngineSynthesizeResult {
  ok: boolean;
  outputPath: string;
  durationSec: number;
  elapsedSec: number;
  sampleRate?: number;
  targetF0Hz?: number;
  outputF0Hz?: number;
  mode?: string;
  model?: string;
  device?: string;
}

let bootPromise: Promise<boolean> | null = null;

function getEnginePaths(): { pythonBin: string; serverScript: string; engineDir: string } | null {
  const engineDir = path.resolve(/*turbopackIgnore: true*/ process.cwd(), [".voice", "engine"].join("-"));
  const voxPython = path.resolve(/*turbopackIgnore: true*/ engineDir, ["venv_voxcpm", "bin", "python"].join(path.sep));
  const voxServer = path.resolve(/*turbopackIgnore: true*/ engineDir, ["voxcpm_server", "py"].join("."));
  if (fs.existsSync(voxPython) && fs.existsSync(voxServer)) {
    return { pythonBin: voxPython, serverScript: voxServer, engineDir };
  }
  const legacyPython = path.resolve(/*turbopackIgnore: true*/ engineDir, ["venv", "bin", "python"].join(path.sep));
  const legacyServer = path.resolve(/*turbopackIgnore: true*/ engineDir, ["server", "py"].join("."));
  if (fs.existsSync(legacyPython) && fs.existsSync(legacyServer)) {
    return { pythonBin: legacyPython, serverScript: legacyServer, engineDir };
  }
  return null;
}

export async function fetchEngineHealth(timeoutMs = 1500): Promise<EngineHealth | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${ENGINE_URL}/health`, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as EngineHealth;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export async function ensureVoiceEngineStarted(waitForReady = true, maxWaitMs = 90000): Promise<boolean> {
  const existing = await fetchEngineHealth(1200);
  if (existing?.ok && (!waitForReady || existing.ready)) {
    return true;
  }

  if (!bootPromise) {
    bootPromise = (async () => {
      try {
        const current = await fetchEngineHealth(1200);
        if (!current) {
          const paths = getEnginePaths();
          if (!paths) return false;

          const logPath = path.join(/*turbopackIgnore: true*/ paths.engineDir, "server.log");
          const outFd = fs.openSync(logPath, "a");
          try {
            const child = spawn(/*turbopackIgnore: true*/ paths.pythonBin, [paths.serverScript], {
              cwd: paths.engineDir,
              detached: true,
              stdio: ["ignore", outFd, outFd],
              env: {
                ...process.env,
                HF_HUB_DISABLE_XET: "1",
                PYTHONUNBUFFERED: "1",
              },
            });
            child.unref();
          } finally {
            fs.closeSync(outFd);
          }
        }

        const deadline = Date.now() + maxWaitMs;
        while (Date.now() < deadline) {
          const health = await fetchEngineHealth(1500);
          if (health?.ok) {
            if (!waitForReady || health.ready) return true;
            if (health.error) return false;
          }
          await new Promise((r) => setTimeout(r, 1200));
        }
        return false;
      } finally {
        bootPromise = null;
      }
    })();
  }

  return bootPromise;
}

export async function analyzeAudioWithEngine(
  filePath: string
): Promise<EngineAcousticAnalysis | null> {
  try {
    const alive = await ensureVoiceEngineStarted(false, 15000);
    if (!alive) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch(`${ENGINE_URL}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file_path: filePath }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.ok) return null;
      return {
        durationSec: Number(data.duration_sec ?? 5),
        medianF0Hz: Number(data.median_f0_hz ?? 0),
        spectralCentroidHz: Number(data.spectral_centroid_hz ?? 1800),
        rmsLevel: Number(data.rms_level ?? 0.1),
        meanVolumeDb: Number(data.mean_volume_db ?? -20),
        maxVolumeDb: Number(data.max_volume_db ?? -3),
        dynamicRangeDb: Number(data.dynamic_range_db ?? 15),
        silenceRatio: Number(data.silence_ratio ?? 0.15),
        suggestedPitchSemitones: Number(data.suggested_pitch_semitones ?? 0),
        suggestedTimbre: (data.suggested_timbre || "warm") as EngineAcousticAnalysis["suggestedTimbre"],
        suggestedGender: data.suggested_gender === "male" ? "male" : "female",
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export async function convertVoiceWithEngine(
  params: EngineConvertParams
): Promise<EngineConvertResult | null> {
  try {
    const ready = await ensureVoiceEngineStarted(true, 90000);
    if (!ready) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const res = await fetch(`${ENGINE_URL}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_path: params.sourcePath,
          target_path: params.targetPath,
          output_path: params.outputPath,
          diffusion_steps: params.diffusionSteps ?? 28,
          inference_cfg_rate: params.inferenceCfgRate ?? 0.7,
          length_adjust: params.lengthAdjust ?? 1.0,
          pitch_shift: params.pitchShift ?? 0,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.ok) return null;
      return {
        ok: true,
        outputPath: String(data.output_path || params.outputPath),
        durationSec: Number(data.duration_sec ?? 0),
        elapsedSec: Number(data.elapsed_sec ?? 0),
        sourceF0Hz: data.source_f0_hz ? Number(data.source_f0_hz) : undefined,
        targetF0Hz: data.target_f0_hz ? Number(data.target_f0_hz) : undefined,
        outputF0Hz: data.output_f0_hz ? Number(data.output_f0_hz) : undefined,
        device: data.device ? String(data.device) : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export async function synthesizeWithVoxCPM(
  params: EngineSynthesizeParams
): Promise<EngineSynthesizeResult | null> {
  try {
    const ready = await ensureVoiceEngineStarted(true, 120000);
    if (!ready) return null;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 180000);
    try {
      const res = await fetch(`${ENGINE_URL}/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: params.text,
          output_path: params.outputPath,
          ref_audio_path: params.refAudioPath,
          prompt_audio_path: params.promptAudioPath,
          prompt_text: params.promptText,
          instruct: params.instruct,
          inference_timesteps: params.inferenceTimesteps ?? 8,
          cfg_value: params.cfgValue ?? 2.0,
          speed: params.speed ?? 1.0,
          pitch_shift: params.pitchShift ?? 0.0,
        }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data.ok) return null;
      return {
        ok: true,
        outputPath: String(data.output_path || params.outputPath),
        durationSec: Number(data.duration_sec ?? 0),
        elapsedSec: Number(data.elapsed_sec ?? 0),
        sampleRate: data.sample_rate ? Number(data.sample_rate) : 48000,
        targetF0Hz: data.target_f0_hz ? Number(data.target_f0_hz) : undefined,
        outputF0Hz: data.output_f0_hz ? Number(data.output_f0_hz) : undefined,
        mode: data.mode ? String(data.mode) : undefined,
        model: data.model ? String(data.model) : undefined,
        device: data.device ? String(data.device) : undefined,
      };
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}
