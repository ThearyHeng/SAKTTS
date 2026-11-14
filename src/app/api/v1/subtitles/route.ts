import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  addHistoryItem,
  checkUserCanSpend,
  getAudioDir,
  readStore,
  resolveUserFromStore,
} from "@/lib/store";
import { getSessionUserId } from "@/lib/auth-session";
import {
  DEFAULT_SUBTITLE_OPTIONS,
  SubtitleBuildOptions,
  SubtitleCue,
  formatSubtitleExport,
  generateSubtitlesFromHistoryItem,
  generateSubtitlesFromPlainScript,
  generateSubtitlesFromSpeechWindows,
  rewrapSubtitleCues,
  normalizeCueTimeline,
} from "@/lib/subtitle-format";
import { probeMediaForSubtitles } from "@/lib/subtitle-server";

function parseBuildOptions(raw: Record<string, unknown>): SubtitleBuildOptions {
  const maxCharsRaw = Number(raw.maxCharsPerLine ?? DEFAULT_SUBTITLE_OPTIONS.maxCharsPerLine);
  const maxLinesRaw = Number(raw.maxLines ?? DEFAULT_SUBTITLE_OPTIONS.maxLines);
  const minCueRaw = Number(raw.minCueSec ?? DEFAULT_SUBTITLE_OPTIONS.minCueSec);
  const maxCueRaw = Number(raw.maxCueSec ?? DEFAULT_SUBTITLE_OPTIONS.maxCueSec);
  const offsetRaw = Number(raw.offsetMs ?? DEFAULT_SUBTITLE_OPTIONS.offsetMs);

  return {
    maxCharsPerLine: Math.max(18, Math.min(72, Number.isFinite(maxCharsRaw) ? maxCharsRaw : 40)),
    maxLines: maxLinesRaw === 1 ? 1 : 2,
    minCueSec: Math.max(0.4, Math.min(3.5, Number.isFinite(minCueRaw) ? minCueRaw : 1.0)),
    maxCueSec: Math.max(2.0, Math.min(12.0, Number.isFinite(maxCueRaw) ? maxCueRaw : 5.5)),
    offsetMs: Math.max(-5000, Math.min(5000, Number.isFinite(offsetRaw) ? offsetRaw : 0)),
    includeSpeaker: raw.includeSpeaker === true || raw.includeSpeaker === "true",
  };
}

function buildExportsBundle(cues: SubtitleCue[], title: string, includeSpeaker: boolean) {
  return {
    srt: formatSubtitleExport(cues, "srt", { title, includeSpeaker }),
    vtt: formatSubtitleExport(cues, "vtt", { title, includeSpeaker }),
    ass: formatSubtitleExport(cues, "ass", { title, includeSpeaker }),
    txt: formatSubtitleExport(cues, "txt", { title, includeSpeaker }),
    json: formatSubtitleExport(cues, "json", { title, includeSpeaker }),
  };
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    const sessionUid = getSessionUserId(req);

    // 1. Multipart upload: Audio or Video + optional script alignment
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const scriptText = String(formData.get("scriptText") ?? "");
      const language = String(formData.get("language") ?? "auto");

      if (!file) {
        return NextResponse.json({ error: "Please select an audio or video file." }, { status: 400 });
      }
      if (file.size > 120 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Media file exceeds the 120 MB local studio limit." },
          { status: 413 }
        );
      }

      const preCheck = checkUserCanSpend(10, sessionUid);
      if (!preCheck.ok) {
        return NextResponse.json({ error: preCheck.error }, { status: preCheck.status });
      }

      const opts = parseBuildOptions({
        maxCharsPerLine: formData.get("maxCharsPerLine"),
        maxLines: formData.get("maxLines"),
        minCueSec: formData.get("minCueSec"),
        maxCueSec: formData.get("maxCueSec"),
        offsetMs: formData.get("offsetMs"),
        includeSpeaker: formData.get("includeSpeaker"),
      });

      const origName = file.name || "media.mp4";
      const rawExt = path.extname(origName).toLowerCase() || (file.type.startsWith("video/") ? ".mp4" : ".mp3");
      const safeExt = [".mp4", ".mov", ".mkv", ".webm", ".mp3", ".wav", ".m4a", ".ogg", ".flac"].includes(rawExt)
        ? rawExt
        : ".mp4";
      const isVideoUpload =
        file.type.startsWith("video/") || [".mp4", ".mov", ".mkv"].includes(safeExt);
      const id = `${isVideoUpload ? "sub-vid" : "sub-aud"}-${crypto.randomUUID().slice(0, 10)}`;
      const fileName = `${id}${safeExt}`;
      const filePath = path.join(getAudioDir(), fileName);
      const bytes = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(filePath, bytes);

      const probe = await probeMediaForSubtitles(filePath);
      const cues = generateSubtitlesFromSpeechWindows(
        probe.speechWindows,
        scriptText,
        probe.durationSec,
        language,
        opts
      );

      const mediaUrl = `/api/v1/audio/${fileName}`;
      const creditsUsed = Math.max(10, Math.round(probe.durationSec * 2));
      const cleanTitle = `Subtitles: ${origName}`;

      const historyItem = {
        id,
        type: "stt" as const,
        title: cleanTitle,
        text: cues.map((c) => c.lines.join(" ")).join("\n"),
        language: language === "km" ? "Khmer" : language === "en" ? "English" : "Khmer & English",
        durationSec: probe.durationSec,
        creditsUsed,
        audioUrl: mediaUrl,
        format: safeExt.replace(".", ""),
        waveform: probe.waveform,
        cues: cues.map((c) => ({
          paragraphIndex: 0,
          text: c.lines.join(" "),
          startSec: c.startSec,
          endSec: c.endSec,
        })),
        createdAt: new Date().toISOString(),
      };

      const updatedStore = addHistoryItem(historyItem, creditsUsed, sessionUid);
      const activeAfter = resolveUserFromStore(updatedStore, sessionUid);

      return NextResponse.json({
        id,
        source: "upload",
        title: origName,
        mediaUrl,
        hasVideo: probe.hasVideo,
        width: probe.width,
        height: probe.height,
        durationSec: probe.durationSec,
        waveform: probe.waveform,
        speechWindows: probe.speechWindows,
        cues,
        creditsUsed,
        creditsBalance: activeAfter.creditsBalance,
        historyItem,
        exports: buildExportsBundle(cues, origName, opts.includeSpeaker),
      });
    }

    // 2. JSON payload: existing Studio History item or Script/Cue re-timing
    const body = (await req.json()) as Record<string, unknown>;
    const opts = parseBuildOptions(body);

    if (typeof body.historyId === "string" && body.historyId.trim()) {
      const store = readStore();
      const item = store.history.find((h) => h.id === body.historyId);
      if (!item) {
        return NextResponse.json({ error: "History item not found" }, { status: 404 });
      }
      const cues = generateSubtitlesFromHistoryItem(item, opts);
      return NextResponse.json({
        id: `sub-${item.id}`,
        source: "history",
        historyId: item.id,
        title: item.title,
        text: item.text,
        mediaUrl: item.audioUrl ?? null,
        hasVideo: Boolean(item.audioUrl && /\.(mp4|mov|mkv)$/i.test(item.audioUrl)),
        durationSec: item.durationSec,
        waveform: item.waveform,
        cues,
        creditsUsed: 0,
        exports: buildExportsBundle(cues, item.title, opts.includeSpeaker),
      });
    }

    // Re-wrap / export provided cues
    if (Array.isArray(body.cues) && body.cues.length > 0 && !body.regenerateFromText) {
      const rawCues = body.cues as SubtitleCue[];
      const rewrapped = normalizeCueTimeline(
        rewrapSubtitleCues(rawCues, opts.maxCharsPerLine, opts.maxLines, opts.includeSpeaker),
        opts.offsetMs
      );
      const title = String(body.title ?? "SAKTTS Subtitles");
      return NextResponse.json({
        id: `sub-custom-${Date.now()}`,
        source: "cues",
        title,
        cues: rewrapped,
        creditsUsed: 0,
        exports: buildExportsBundle(rewrapped, title, opts.includeSpeaker),
      });
    }

    // Plain pasted script generation
    const scriptText = String(body.text ?? body.scriptText ?? "").trim();
    if (!scriptText) {
      return NextResponse.json(
        { error: "Provide a historyId, uploaded media file, or script text." },
        { status: 400 }
      );
    }

    const durationSec = Number(body.durationSec ?? 0);
    const cues = generateSubtitlesFromPlainScript(scriptText, durationSec, opts);
    const totalDur = cues.length > 0 ? cues[cues.length - 1].endSec : Math.max(2, durationSec);
    const title = String(body.title ?? scriptText.slice(0, 40));

    return NextResponse.json({
      id: `sub-script-${Date.now()}`,
      source: "script",
      title,
      durationSec: totalDur,
      cues,
      creditsUsed: 0,
      exports: buildExportsBundle(cues, title, opts.includeSpeaker),
    });
  } catch (error) {
    console.error("Subtitle generation error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate subtitles" },
      { status: 500 }
    );
  }
}
