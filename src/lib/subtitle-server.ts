import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { inspectAudioMetrics } from "./audio-engine";

const execFileAsync = promisify(execFile);

export interface MediaSubtitleProbe {
  durationSec: number;
  hasVideo: boolean;
  hasAudio: boolean;
  width?: number;
  height?: number;
  speechWindows: Array<{ start: number; end: number }>;
  waveform: number[];
}

export async function probeMediaForSubtitles(filePath: string): Promise<MediaSubtitleProbe> {
  let durationSec = 5.0;
  let hasVideo = false;
  let hasAudio = true;
  let width: number | undefined;
  let height: number | undefined;

  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration:stream=codec_type,width,height",
      "-of",
      "json",
      filePath,
    ]);
    const parsed = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const rawDur = parseFloat(parsed.format?.duration ?? "0");
    if (!Number.isNaN(rawDur) && rawDur > 0) {
      durationSec = Math.round(rawDur * 100) / 100;
    }
    const streams = parsed.streams ?? [];
    if (streams.length > 0) {
      const videoStream = streams.find((s) => s.codec_type === "video");
      const audioStream = streams.find((s) => s.codec_type === "audio");
      hasVideo = Boolean(videoStream);
      hasAudio = Boolean(audioStream);
      if (videoStream?.width && videoStream?.height) {
        width = videoStream.width;
        height = videoStream.height;
      }
    }
  } catch {
    // Keep safe defaults
  }

  const silences: Array<{ start: number; end: number }> = [];
  if (hasAudio) {
    try {
      const { stderr } = await execFileAsync(
        "ffmpeg",
        ["-i", filePath, "-vn", "-af", "silencedetect=noise=-30dB:d=0.35", "-f", "null", "-"],
        { maxBuffer: 8 * 1024 * 1024 }
      );
      let curStart: number | null = null;
      for (const line of stderr.split("\n")) {
        const sMatch = line.match(/silence_start:\s*(\d+(?:\.\d+)?)/);
        if (sMatch) curStart = parseFloat(sMatch[1]);
        const eMatch = line.match(/silence_end:\s*(\d+(?:\.\d+)?)/);
        if (eMatch && curStart !== null) {
          silences.push({ start: curStart, end: parseFloat(eMatch[1]) });
          curStart = null;
        }
      }
    } catch {
      // Ignore silencedetect failure
    }
  }

  const speechWindows: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const sil of silences) {
    if (sil.start - cursor > 0.3) {
      speechWindows.push({
        start: Math.round(cursor * 1000) / 1000,
        end: Math.round(sil.start * 1000) / 1000,
      });
    }
    cursor = Math.max(cursor, sil.end);
  }
  if (durationSec - cursor > 0.3) {
    speechWindows.push({
      start: Math.round(cursor * 1000) / 1000,
      end: Math.round(durationSec * 1000) / 1000,
    });
  }
  if (speechWindows.length === 0) {
    speechWindows.push({ start: 0, end: durationSec });
  }

  const metrics = hasAudio
    ? await inspectAudioMetrics(filePath)
    : {
        durationSec,
        waveform: Array.from({ length: 48 }, (_, i) => Math.round(28 + Math.abs(Math.sin(i * 0.4) * 40))),
      };

  return {
    durationSec: Math.max(durationSec, metrics.durationSec),
    hasVideo,
    hasAudio,
    width,
    height,
    speechWindows,
    waveform: metrics.waveform,
  };
}
