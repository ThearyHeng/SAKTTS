"use client";

import React, { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  Captions,
  Check,
  Clock,
  Copy,
  Download,
  FileAudio2,
  FileText,
  Film,
  History as HistoryIcon,
  Loader2,
  Merge,
  Mic,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Scissors,
  Sparkles,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { useStudio } from "@/components/providers";
import { WaveformPlayer, WaveformPlayerHandle } from "@/components/waveform-player";
import {
  DEFAULT_SUBTITLE_OPTIONS,
  SubtitleCue,
  SubtitleExportFormat,
  formatSubtitleExport,
  formatTimeDisplay,
  mergeCueWithNext,
  normalizeCueTimeline,
  rewrapSubtitleCues,
  splitCueInHalf,
  wrapPlainTextLines,
} from "@/lib/subtitle-format";

type SourceTab = "history" | "upload" | "script";
type BackdropStyle = "pill" | "outline" | "minimal";

function SubtitleStudioWorkspace() {
  const { history, refreshStore } = useStudio();
  const searchParams = useSearchParams();
  const requestedHistoryId = searchParams.get("historyId");

  const formUid = useId();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const waveformPlayerRef = useRef<WaveformPlayerHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);
  const localObjectUrlRef = useRef<string | null>(null);
  const vttTrackUrlRef = useRef<string | null>(null);
  const loadedHistoryRef = useRef<string | null>(null);

  const [sourceTab, setSourceTab] = useState<SourceTab>("history");
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>("");

  // Media & playback state
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [waveform, setWaveform] = useState<number[] | undefined>(undefined);
  const [durationSec, setDurationSec] = useState(0);
  const [currentTimeSec, setCurrentTimeSec] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [projectTitle, setProjectTitle] = useState("SAKTTS Subtitles");

  // Upload & Script states
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<"auto" | "km" | "en">("auto");
  const [uploadScript, setUploadScript] = useState("");
  const [pastedScript, setPastedScript] = useState(
    "សួស្តី! សូមស្វាគមន៍មកកាន់ SAKTTS។\nថ្ងៃនេះយើងបង្កើតចំណងជើងរងជាភាសាខ្មែរ និងអង់គ្លេសដោយស្វ័យប្រវត្តិ។\nExport straight to SRT, WebVTT, or ASS in seconds."
  );
  const [targetScriptSec, setTargetScriptSec] = useState("10");
  const [dictating, setDictating] = useState(false);

  // Caption layout & styling options
  const [maxCharsPerLine, setMaxCharsPerLine] = useState(DEFAULT_SUBTITLE_OPTIONS.maxCharsPerLine);
  const [maxLines, setMaxLines] = useState<1 | 2>(DEFAULT_SUBTITLE_OPTIONS.maxLines);
  const [offsetMs, setOffsetMs] = useState(0);
  const [includeSpeaker, setIncludeSpeaker] = useState(false);
  const [fontSizePx, setFontSizePx] = useState(22);
  const [backdropStyle, setBackdropStyle] = useState<BackdropStyle>("pill");
  const [karaokeEnabled, setKaraokeEnabled] = useState(true);

  // Subtitle cues + status feedback
  const [cues, setCues] = useState<SubtitleCue[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [copiedFormat, setCopiedFormat] = useState<string | null>(null);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current);
      if (vttTrackUrlRef.current) URL.revokeObjectURL(vttTrackUrlRef.current);
    };
  }, []);

  const generateFromHistory = useCallback(
    async (
      historyId: string,
      overrideOpts?: { maxCharsPerLine?: number; maxLines?: 1 | 2; includeSpeaker?: boolean }
    ) => {
      if (!historyId) return;
      setGenerating(true);
      setError(null);
      try {
        const res = await fetch("/api/v1/subtitles", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            historyId,
            maxCharsPerLine: overrideOpts?.maxCharsPerLine ?? maxCharsPerLine,
            maxLines: overrideOpts?.maxLines ?? maxLines,
            offsetMs: 0,
            includeSpeaker: overrideOpts?.includeSpeaker ?? includeSpeaker,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to build subtitles");

        if (localObjectUrlRef.current) {
          URL.revokeObjectURL(localObjectUrlRef.current);
          localObjectUrlRef.current = null;
        }
        setSelectedHistoryId(historyId);
        setProjectTitle(data.title || "Studio Subtitles");
        setMediaUrl(data.mediaUrl || null);
        setHasVideo(Boolean(data.hasVideo));
        setWaveform(data.waveform);
        setDurationSec(Number(data.durationSec || 0));
        setCurrentTimeSec(0);
        setIsPlaying(false);
        setOffsetMs(0);
        setCues(Array.isArray(data.cues) ? data.cues : []);
        setStatusMessage(`Generated ${(data.cues ?? []).length} subtitle cues from "${data.title}".`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load history subtitles");
      } finally {
        setGenerating(false);
      }
    },
    [includeSpeaker, maxCharsPerLine, maxLines]
  );

  // Auto-load requested ?historyId or the latest available history item on mount
  useEffect(() => {
    if (history.length === 0) return;
    if (requestedHistoryId && loadedHistoryRef.current !== requestedHistoryId) {
      const target = history.find((h) => h.id === requestedHistoryId);
      if (target) {
        loadedHistoryRef.current = target.id;
        setSourceTab("history");
        generateFromHistory(target.id);
        return;
      }
    }
    if (!loadedHistoryRef.current && history[0]) {
      loadedHistoryRef.current = history[0].id;
      generateFromHistory(history[0].id);
    }
  }, [history, requestedHistoryId, generateFromHistory]);

  // WebVTT object URL synced to cues for native <video><track kind="captions"></track> accessibility
  const vttBlobUrl = useMemo(() => {
    if (typeof window === "undefined" || cues.length === 0) return "";
    if (vttTrackUrlRef.current) {
      URL.revokeObjectURL(vttTrackUrlRef.current);
      vttTrackUrlRef.current = null;
    }
    const vtt = formatSubtitleExport(cues, "vtt", {
      title: projectTitle,
      includeSpeaker,
    });
    const blob = new Blob([vtt], { type: "text/vtt;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    vttTrackUrlRef.current = url;
    return url;
  }, [cues, includeSpeaker, projectTitle]);

  // Active cue + active word inside active cue for karaoke highlight
  const activeCue = useMemo(() => {
    return (
      cues.find((c) => currentTimeSec >= c.startSec && currentTimeSec <= c.endSec) ?? null
    );
  }, [cues, currentTimeSec]);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setError("Please choose an audio or video file first.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile, uploadFile.name);
      fd.append("language", language);
      fd.append("scriptText", uploadScript);
      fd.append("maxCharsPerLine", String(maxCharsPerLine));
      fd.append("maxLines", String(maxLines));
      fd.append("includeSpeaker", String(includeSpeaker));

      const res = await fetch("/api/v1/subtitles", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Media subtitle extraction failed");

      const fileIsVideo = uploadFile.type.startsWith("video/") || Boolean(data.hasVideo);
      if (localObjectUrlRef.current) URL.revokeObjectURL(localObjectUrlRef.current);
      // Prefer immediate zero-latency local Blob URL for local video/audio scrub if supported
      const previewUrl =
        fileIsVideo ? URL.createObjectURL(uploadFile) : data.mediaUrl || URL.createObjectURL(uploadFile);
      if (previewUrl.startsWith("blob:")) {
        localObjectUrlRef.current = previewUrl;
      } else {
        localObjectUrlRef.current = null;
      }

      setProjectTitle(uploadFile.name);
      setMediaUrl(previewUrl);
      setHasVideo(fileIsVideo);
      setWaveform(data.waveform);
      setDurationSec(Number(data.durationSec || 0));
      setCurrentTimeSec(0);
      setIsPlaying(false);
      setOffsetMs(0);
      setCues(Array.isArray(data.cues) ? data.cues : []);
      setStatusMessage(
        `Aligned ${(data.cues ?? []).length} cues across ${Number(data.durationSec || 0).toFixed(1)}s (${data.creditsUsed} credits).`
      );
      await refreshStore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process uploaded media");
    } finally {
      setGenerating(false);
    }
  };

  const handleScriptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pastedScript.trim()) {
      setError("Paste Khmer or English script text to generate timed subtitle cues.");
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      const durNum = parseFloat(targetScriptSec);
      const res = await fetch("/api/v1/subtitles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: pastedScript,
          durationSec: Number.isFinite(durNum) && durNum > 0 ? durNum : 0,
          maxCharsPerLine,
          maxLines,
          includeSpeaker,
          title: "Script Subtitles",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script alignment failed");

      setProjectTitle("Script Subtitles");
      setDurationSec(Number(data.durationSec || 0));
      setCurrentTimeSec(0);
      setOffsetMs(0);
      setCues(Array.isArray(data.cues) ? data.cues : []);
      setStatusMessage(`Generated ${(data.cues ?? []).length} timed cues from pasted script.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to build script subtitles");
    } finally {
      setGenerating(false);
    }
  };

  const toggleDictation = () => {
    if (dictating) {
      speechRecRef.current?.stop();
      setDictating(false);
      return;
    }
    const SpeechRec =
      (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

    if (typeof SpeechRec !== "function") {
      setError("Live dictation requires Chromium Web Speech API; paste your script manually instead.");
      return;
    }

    try {
      setError(null);
      const rec = new (SpeechRec as new () => {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
        onend: () => void;
        start: () => void;
        stop: () => void;
      })();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = language === "en" ? "en-US" : "km-KH";
      rec.onresult = (ev) => {
        const parts: string[] = [];
        for (let i = 0; i < ev.results.length; i++) {
          parts.push(ev.results[i][0].transcript);
        }
        setUploadScript(parts.join(" "));
      };
      rec.onend = () => setDictating(false);
      rec.start();
      speechRecRef.current = rec;
      setDictating(true);
    } catch {
      setError("Microphone dictation could not start in this browser context.");
    }
  };

  const seekMediaTo = (sec: number, shouldPlay = true) => {
    const safeSec = Math.max(0, durationSec > 0 ? Math.min(durationSec, sec) : sec);
    if (hasVideo && videoRef.current) {
      videoRef.current.currentTime = safeSec;
      setCurrentTimeSec(safeSec);
      if (shouldPlay && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
    } else if (waveformPlayerRef.current) {
      waveformPlayerRef.current.seekTo(safeSec, shouldPlay);
    } else {
      setCurrentTimeSec(safeSec);
    }
  };

  const toggleVideoPlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  const handleApplyWrapping = (nextMaxChars: number, nextMaxLines: 1 | 2) => {
    setMaxCharsPerLine(nextMaxChars);
    setMaxLines(nextMaxLines);
    setCues((prev) => rewrapSubtitleCues(prev, nextMaxChars, nextMaxLines, includeSpeaker));
  };

  const handleOffsetChange = (nextOffsetMs: number) => {
    const deltaMs = nextOffsetMs - offsetMs;
    setOffsetMs(nextOffsetMs);
    if (deltaMs !== 0) {
      setCues((prev) => normalizeCueTimeline(prev, deltaMs));
    }
  };

  const handleCueTextChange = (cueId: string, nextText: string) => {
    setCues((prev) =>
      prev.map((c) => {
        if (c.id !== cueId) return c;
        const lines = wrapPlainTextLines(nextText, maxCharsPerLine, maxLines);
        return {
          ...c,
          text: nextText,
          lines: nextText.includes("\n")
            ? nextText
                .split(/\r?\n/)
                .map((l) => l.trim())
                .filter(Boolean)
            : lines,
          words: undefined,
        };
      })
    );
  };

  const handleCueTimeChange = (cueId: string, field: "startSec" | "endSec", rawValue: string) => {
    const val = parseFloat(rawValue);
    if (!Number.isFinite(val) || val < 0) return;
    setCues((prev) =>
      prev.map((c) => {
        if (c.id !== cueId) return c;
        if (field === "startSec") {
          const nextStart = Math.max(0, Math.round(val * 100) / 100);
          return {
            ...c,
            startSec: nextStart,
            endSec: Math.max(nextStart + 0.2, c.endSec),
          };
        }
        return {
          ...c,
          endSec: Math.max(c.startSec + 0.2, Math.round(val * 100) / 100),
        };
      })
    );
  };

  const handleAddCue = () => {
    setCues((prev) => {
      const lastEnd = prev.length > 0 ? prev[prev.length - 1].endSec : 0;
      const startSec = Math.round((lastEnd + 0.1) * 100) / 100;
      const endSec = Math.round((startSec + 2.4) * 100) / 100;
      const newCue: SubtitleCue = {
        id: `sub-add-${Date.now()}`,
        index: prev.length + 1,
        startSec,
        endSec,
        text: "បញ្ចូលអត្ថបទចំណងជើងរងនៅទីនេះ",
        lines: ["បញ្ចូលអត្ថបទចំណងជើងរងនៅទីនេះ"],
      };
      return [...prev, newCue];
    });
  };

  const handleExport = (fmt: SubtitleExportFormat) => {
    if (cues.length === 0) return;
    const content = formatSubtitleExport(cues, fmt, {
      title: projectTitle,
      includeSpeaker,
      fontSizePx,
    });
    const mime =
      fmt === "vtt"
        ? "text/vtt;charset=utf-8"
        : fmt === "json"
        ? "application/json;charset=utf-8"
        : "text/plain;charset=utf-8";
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const baseName = projectTitle
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9\u1780-\u17FF_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "saktts-subtitles";
    const a = document.createElement("a");
    a.href = url;
    a.download = `${baseName}.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage(`Exported ${cues.length} cues as ${fmt.toUpperCase()}.`);
  };

  const handleCopySrt = async () => {
    if (cues.length === 0) return;
    const srt = formatSubtitleExport(cues, "srt", {
      title: projectTitle,
      includeSpeaker,
    });
    try {
      await navigator.clipboard.writeText(srt);
      setCopiedFormat("srt");
      setStatusMessage("Copied SRT subtitles to clipboard.");
      setTimeout(() => setCopiedFormat(null), 1800);
    } catch {
      setError("Clipboard permission blocked; use Download SRT instead.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 overflow-x-hidden px-4 py-6 sm:px-8">
      {/* Header + Primary Export Actions */}
      <header className="flex min-w-0 flex-col justify-between gap-4 border-b border-border/50 pb-5 sm:flex-row sm:items-end">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card px-3 py-1 text-[11px] font-medium text-muted-foreground">
            <Captions className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Khmer &amp; English Subtitle Generator</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Subtitle Studio</h1>
          <p className="text-muted-foreground max-w-2xl text-xs sm:text-sm">
            Generate word-aware Khmer and English captions from Studio speech, video/audio uploads,
            or pasted scripts — preview synced over playback and export to SRT, WebVTT, ASS, TXT,
            or JSON.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={cues.length === 0}
            onClick={() => handleExport("srt")}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors disabled:opacity-40"
          >
            <Download className="h-3.5 w-3.5" aria-hidden="true" />
            Download .SRT
          </button>

          {(["vtt", "ass", "txt", "json"] as const).map((fmt) => (
            <button
              key={fmt}
              type="button"
              disabled={cues.length === 0}
              onClick={() => handleExport(fmt)}
              className="bg-card border-border/75 hover:bg-foreground/[0.05] inline-flex min-h-10 items-center gap-1 rounded-xl border px-3 font-mono text-xs font-medium uppercase transition-colors disabled:opacity-40"
            >
              .{fmt}
            </button>
          ))}

          <button
            type="button"
            disabled={cues.length === 0}
            onClick={handleCopySrt}
            className="bg-card border-border/75 hover:bg-foreground/[0.05] inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors disabled:opacity-40"
          >
            {copiedFormat === "srt" ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                Copy SRT
              </>
            )}
          </button>
        </div>
      </header>

      {/* Polite status announcer for exports & completions */}
      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="border-border/60 bg-card flex items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-xs"
        >
          <span className="flex items-center gap-2 font-medium">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage("")}
            className="text-muted-foreground hover:text-foreground text-[11px]"
          >
            Dismiss
          </button>
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive rounded-2xl border px-4 py-3 text-xs font-medium"
        >
          {error}
        </div>
      )}

      {/* Source Tabs */}
      <section aria-labelledby={`${formUid}-source-heading`} className="space-y-4">
        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
          <h2 id={`${formUid}-source-heading`} className="text-sm font-semibold">
            1. Choose Subtitle Source
          </h2>
          <div
            role="tablist"
            aria-label="Subtitle input source"
            className="bg-foreground/[0.06] flex w-full flex-wrap gap-1 rounded-2xl p-1 sm:inline-flex sm:w-auto"
          >
            {[
              { id: "history" as const, label: "From Studio History", icon: HistoryIcon },
              { id: "upload" as const, label: "Upload Video / Audio", icon: Film },
              { id: "script" as const, label: "Paste Script", icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const selected = sourceTab === tab.id;
              return (
                <button
                  key={tab.id}
                  role="tab"
                  type="button"
                  aria-selected={selected}
                  onClick={() => setSourceTab(tab.id)}
                  className={`inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    selected
                      ? "bg-card text-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Panel: Studio History */}
        {sourceTab === "history" && (
          <div className="bg-card border-border/65 rounded-2xl border p-4 sm:p-5">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <FileAudio2 className="text-muted-foreground h-6 w-6" aria-hidden="true" />
                <p className="text-sm font-medium">No generated clips in Studio History yet</p>
                <p className="text-muted-foreground max-w-md text-xs">
                  Generate voice in Text to Speech first, or switch tabs above to upload a video /
                  audio file or paste a script directly.
                </p>
                <Link
                  href="/dashboard"
                  className="bg-primary text-primary-foreground mt-2 inline-flex min-h-9 items-center gap-1.5 rounded-xl px-4 text-xs font-semibold"
                >
                  Open Text to Speech Studio
                </Link>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1 space-y-1.5 overflow-hidden">
                  <label htmlFor={`${formUid}-hist-select`} className="block text-xs font-medium">
                    Select synthesized audio or transcription clip
                  </label>
                  <select
                    id={`${formUid}-hist-select`}
                    value={selectedHistoryId}
                    onChange={(e) => generateFromHistory(e.target.value)}
                    className="bg-background border-border/75 block min-h-10 w-0 min-w-full max-w-full truncate rounded-xl border px-3 text-base sm:text-xs outline-none"
                  >
                    {history.map((item) => {
                      const shortTitle =
                        item.title.length > 42 ? `${item.title.slice(0, 42)}…` : item.title;
                      return (
                        <option key={item.id} value={item.id}>
                          [{item.type.toUpperCase()}] {shortTitle} · {item.durationSec.toFixed(1)}s
                          {item.voiceName ? ` (${item.voiceName})` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!selectedHistoryId || generating}
                  onClick={() => generateFromHistory(selectedHistoryId)}
                  className="bg-foreground text-background inline-flex min-h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl px-4 text-xs font-semibold hover:opacity-90 disabled:opacity-45"
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Building…
                    </>
                  ) : (
                    <>
                      <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                      Regenerate Cues (Free)
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Panel: Upload Video / Audio */}
        {sourceTab === "upload" && (
          <form
            onSubmit={handleUploadSubmit}
            className="bg-card border-border/65 space-y-4 rounded-2xl border p-4 sm:p-5"
          >
            <fieldset className="grid grid-cols-1 gap-4 lg:grid-cols-12">
              <legend className="sr-only">Upload audio or video for subtitle timing</legend>

              <div className="space-y-2 lg:col-span-5">
                <label htmlFor={`${formUid}-media-file`} className="block text-xs font-medium">
                  Video or Audio File (MP4, MOV, WEBM, MP3, WAV, M4A)
                </label>
                <span id={`${formUid}-media-hint`} className="text-muted-foreground block text-[11px]">
                  Processed locally with ffmpeg silence detection; video previews privately in-browser.
                </span>
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <input
                    ref={fileInputRef}
                    id={`${formUid}-media-file`}
                    name="mediaFile"
                    type="file"
                    aria-describedby={`${formUid}-media-hint`}
                    accept="video/*,audio/*,.mp4,.mov,.mkv,.webm,.mp3,.wav,.m4a,.ogg,.flac"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setUploadFile(f);
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor={`${formUid}-media-file`}
                    className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl px-4 text-xs font-semibold transition-colors"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                    {uploadFile ? "Change Media File" : "Choose Audio / Video"}
                  </label>
                  {uploadFile && (
                    <span className="text-foreground truncate text-xs font-medium">
                      {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)
                    </span>
                  )}
                </div>

                <div className="space-y-1.5 pt-2">
                  <label htmlFor={`${formUid}-upload-lang`} className="block text-xs font-medium">
                    Spoken Language
                  </label>
                  <select
                    id={`${formUid}-upload-lang`}
                    name="language"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "auto" | "km" | "en")}
                    className="bg-background border-border/75 min-h-10 w-full rounded-xl border px-3 text-base sm:text-xs outline-none"
                  >
                    <option value="auto">Auto (Khmer + English)</option>
                    <option value="km">Khmer (ភាសាខ្មែរ)</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2 lg:col-span-7">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label htmlFor={`${formUid}-upload-script`} className="text-xs font-medium">
                    Spoken Script / Transcript (Recommended for forced alignment)
                  </label>
                  <button
                    type="button"
                    onClick={toggleDictation}
                    className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition-colors ${
                      dictating
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "bg-foreground/[0.06] hover:bg-foreground/[0.1]"
                    }`}
                  >
                    {dictating ? (
                      <>
                        <Square className="h-3 w-3 fill-current" aria-hidden="true" />
                        Stop Mic Dictation
                      </>
                    ) : (
                      <>
                        <Mic className="h-3 w-3" aria-hidden="true" />
                        Dictate via Mic
                      </>
                    )}
                  </button>
                </div>
                <span
                  id={`${formUid}-script-hint`}
                  className="text-muted-foreground block text-[11px]"
                >
                  Paste your Khmer or English script to snap sentences to real speech activity spans,
                  or leave blank to generate editable cue slots along detected pauses.
                </span>
                <textarea
                  id={`${formUid}-upload-script`}
                  name="scriptText"
                  aria-describedby={`${formUid}-script-hint`}
                  rows={4}
                  value={uploadScript}
                  onChange={(e) => setUploadScript(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                  }}
                  placeholder="ឧទាហរណ៍៖ សួស្តីអ្នកទាំងអស់គ្នា! ថ្ងៃនេះយើងនឹងបង្ហាញពីរបៀបប្រើប្រាស់ SAKTTS។"
                  className="bg-background border-border/75 w-full resize-y rounded-xl border p-3 text-base leading-relaxed outline-none sm:text-sm"
                />
              </div>
            </fieldset>

            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/45 pt-3">
              <span className="text-muted-foreground font-mono text-[11px]">
                ~2 credits / sec analyzed
              </span>
              <button
                type="submit"
                disabled={generating}
                className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 items-center gap-2 rounded-xl px-5 text-xs font-semibold disabled:opacity-50"
              >
                {generating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                    Detecting Speech &amp; Aligning…
                  </>
                ) : (
                  <>
                    <Captions className="h-3.5 w-3.5" aria-hidden="true" />
                    Generate Subtitles from Media
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Panel: Paste Script */}
        {sourceTab === "script" && (
          <form
            onSubmit={handleScriptSubmit}
            className="bg-card border-border/65 space-y-4 rounded-2xl border p-4 sm:p-5"
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div className="space-y-1.5 sm:col-span-3">
                <label htmlFor={`${formUid}-plain-script`} className="block text-xs font-medium">
                  Khmer / English Narration Script
                </label>
                <span id={`${formUid}-plain-hint`} className="text-muted-foreground block text-[11px]">
                  Automatically tokenizes Khmer words with Intl.Segmenter(&quot;km&quot;) without cutting consonant clusters.
                </span>
                <textarea
                  id={`${formUid}-plain-script`}
                  name="pastedScript"
                  aria-describedby={`${formUid}-plain-hint`}
                  rows={4}
                  required
                  value={pastedScript}
                  onChange={(e) => setPastedScript(e.target.value)}
                  className="bg-background border-border/75 w-full resize-y rounded-xl border p-3 text-base leading-relaxed outline-none sm:text-sm"
                />
              </div>

              <div className="space-y-3 sm:col-span-1">
                <div className="space-y-1.5">
                  <label htmlFor={`${formUid}-target-sec`} className="block text-xs font-medium">
                    Target Duration (sec)
                  </label>
                  <span id={`${formUid}-dur-hint`} className="text-muted-foreground block text-[11px]">
                    Enter 0 for auto reading speed
                  </span>
                  <input
                    id={`${formUid}-target-sec`}
                    name="targetScriptSec"
                    type="text"
                    inputMode="decimal"
                    aria-describedby={`${formUid}-dur-hint`}
                    value={targetScriptSec}
                    onChange={(e) => setTargetScriptSec(e.target.value)}
                    className="bg-background border-border/75 min-h-10 w-full rounded-xl border px-3 font-mono text-base sm:text-xs outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-4 text-xs font-semibold disabled:opacity-50"
                >
                  {generating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                  )}
                  Generate Timed Cues
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* Main Workspace: Preview Stage + Controls (Left) & Cue Editor (Right) */}
      <section className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left: Cinema Stage & Style Settings */}
        <div className="min-w-0 space-y-4 lg:col-span-6">
          <div className="saktts-cinema-stage relative overflow-hidden rounded-3xl border border-white/10 shadow-xl">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-xs text-zinc-300">
              <span className="truncate font-medium">{projectTitle}</span>
              <span className="font-mono text-[11px] tabular-nums text-zinc-400">
                {formatTimeDisplay(currentTimeSec)} / {formatTimeDisplay(durationSec)}
              </span>
            </div>

            <div className="relative flex aspect-video w-full items-center justify-center bg-zinc-950">
              {hasVideo && mediaUrl ? (
                <video
                  ref={videoRef}
                  src={mediaUrl}
                  controls
                  playsInline
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onLoadedMetadata={(e) => {
                    const d = e.currentTarget.duration;
                    if (Number.isFinite(d) && d > 0) setDurationSec(d);
                  }}
                  onTimeUpdate={(e) => setCurrentTimeSec(e.currentTarget.currentTime)}
                  className="h-full w-full bg-black object-contain"
                >
                  {vttBlobUrl && (
                    <track
                      kind="captions"
                      src={vttBlobUrl}
                      srcLang={language === "en" ? "en" : "km"}
                      label="SAKTTS Subtitles"
                      default
                    />
                  )}
                </video>
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.16),_transparent_58%)] px-6 text-center">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                    Live Subtitle Preview Stage
                  </p>
                  {cues.length === 0 && (
                    <p className="max-w-xs text-xs text-zinc-400">
                      Choose a Studio clip, upload a video/audio file, or paste a script above to
                      preview timed Khmer &amp; English captions.
                    </p>
                  )}
                </div>
              )}

              {/* Live Stylized Subtitle Overlay */}
              {activeCue && (
                <div
                  className={`pointer-events-none absolute inset-x-4 flex justify-center text-center ${
                    hasVideo ? "bottom-12" : "bottom-6"
                  }`}
                >
                  <div
                    className={`max-w-[92%] leading-relaxed whitespace-pre-line transition-all ${
                      backdropStyle === "pill"
                        ? "rounded-xl bg-black/78 px-4 py-2 text-white shadow-lg backdrop-blur-xs"
                        : backdropStyle === "outline"
                        ? "px-2 py-1 text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.95)]"
                        : "rounded-lg bg-zinc-900/55 px-3 py-1.5 text-zinc-100"
                    }`}
                    style={{
                      fontSize: `${fontSizePx}px`,
                      fontWeight: 600,
                      textShadow:
                        backdropStyle === "outline"
                          ? "0 2px 6px #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000"
                          : "0 1px 2px rgba(0,0,0,0.65)",
                    }}
                  >
                    {karaokeEnabled && activeCue.words && activeCue.words.length > 0 ? (
                      <>
                        {includeSpeaker && activeCue.speaker && (
                          <span className="mr-1.5 text-amber-300">[{activeCue.speaker}]</span>
                        )}
                        {activeCue.words.map((w, wi) => {
                          const spoken = currentTimeSec >= w.startSec;
                          const activeWord =
                            currentTimeSec >= w.startSec && currentTimeSec <= w.endSec + 0.08;
                          return (
                            <span
                              key={`${activeCue.id}-w-${wi}`}
                              className={
                                activeWord
                                  ? "rounded bg-amber-400/30 px-0.5 text-amber-300"
                                  : spoken
                                  ? "text-white"
                                  : "text-white/70"
                              }
                            >
                              {wi > 0 ? w.leadingSep ?? "" : ""}
                              {w.text}
                            </span>
                          );
                        })}
                      </>
                    ) : (
                      <>
                        {includeSpeaker && activeCue.speaker ? `[${activeCue.speaker}] ` : ""}
                        {activeCue.lines.join("\n")}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Audio / Video Scrubber */}
            <div className="border-t border-white/10 bg-zinc-900/95 px-4 py-3">
              {hasVideo && mediaUrl ? (
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={toggleVideoPlay}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full bg-white px-4 text-xs font-semibold text-zinc-950 hover:opacity-90"
                  >
                    {isPlaying ? (
                      <>
                        <Pause className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Pause Video
                      </>
                    ) : (
                      <>
                        <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                        Play Video Preview
                      </>
                    )}
                  </button>
                  <span className="text-[11px] text-zinc-400">
                    Native WebVTT &lt;track&gt; captions active
                  </span>
                </div>
              ) : (
                <WaveformPlayer
                  ref={waveformPlayerRef}
                  audioUrl={mediaUrl}
                  waveform={waveform}
                  durationHint={durationSec}
                  downloadName={`${projectTitle.replace(/\s+/g, "-").toLowerCase()}.mp3`}
                  onTimeUpdate={setCurrentTimeSec}
                  onPlayStateChange={setIsPlaying}
                />
              )}
            </div>
          </div>

          {/* Subtitle Wrapping & Visual Formatting Controls */}
          <fieldset className="bg-card border-border/65 space-y-4 rounded-2xl border p-5">
            <legend className="text-sm font-semibold">Caption Formatting &amp; Timing</legend>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor={`${formUid}-max-chars`} className="font-medium">
                    Max Chars / Line
                  </label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {maxCharsPerLine} chars
                  </span>
                </div>
                <input
                  id={`${formUid}-max-chars`}
                  type="range"
                  min={20}
                  max={64}
                  step={2}
                  value={maxCharsPerLine}
                  aria-valuetext={`${maxCharsPerLine} characters per line`}
                  onChange={(e) => handleApplyWrapping(parseInt(e.target.value, 10), maxLines)}
                  style={
                    {
                      "--attr-min": 20,
                      "--attr-max": 64,
                      "--control-value": maxCharsPerLine,
                    } as React.CSSProperties
                  }
                  className="saktts-range-slider"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <label htmlFor={`${formUid}-font-size`} className="font-medium">
                    Preview Text Size
                  </label>
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {fontSizePx} px
                  </span>
                </div>
                <input
                  id={`${formUid}-font-size`}
                  type="range"
                  min={16}
                  max={36}
                  step={1}
                  value={fontSizePx}
                  aria-valuetext={`${fontSizePx} pixels`}
                  onChange={(e) => setFontSizePx(parseInt(e.target.value, 10))}
                  style={
                    {
                      "--attr-min": 16,
                      "--attr-max": 36,
                      "--control-value": fontSizePx,
                    } as React.CSSProperties
                  }
                  className="saktts-range-slider"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor={`${formUid}-offset-ms`} className="font-medium">
                  Global Timing Offset
                </label>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-muted-foreground tabular-nums">
                    {offsetMs > 0 ? `+${offsetMs}` : offsetMs} ms
                  </span>
                  {offsetMs !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleOffsetChange(0)}
                      className="text-foreground text-[11px] underline underline-offset-2"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>
              <input
                id={`${formUid}-offset-ms`}
                type="range"
                min={-2000}
                max={2000}
                step={50}
                value={offsetMs}
                aria-valuetext={`${offsetMs} milliseconds`}
                onChange={(e) => handleOffsetChange(parseInt(e.target.value, 10))}
                style={
                  {
                    "--attr-min": -2000,
                    "--attr-max": 2000,
                    "--control-value": offsetMs,
                  } as React.CSSProperties
                }
                className="saktts-range-slider"
              />
            </div>

            {/* Exclusive radio groups */}
            <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-2">
              <fieldset className="space-y-1.5">
                <legend className="text-xs font-medium">Max Lines per Cue</legend>
                <div className="bg-foreground/[0.05] grid grid-cols-2 gap-1 rounded-xl p-1">
                  {([1, 2] as const).map((n) => (
                    <label
                      key={n}
                      className={`flex min-h-8 cursor-pointer items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                        maxLines === n
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${formUid}-maxLines`}
                        value={n}
                        checked={maxLines === n}
                        onChange={() => handleApplyWrapping(maxCharsPerLine, n)}
                        className="sr-only"
                      />
                      <span>{n === 1 ? "1 Line" : "2 Lines"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="space-y-1.5">
                <legend className="text-xs font-medium">Preview Style</legend>
                <div className="bg-foreground/[0.05] grid grid-cols-3 gap-1 rounded-xl p-1">
                  {(["pill", "outline", "minimal"] as const).map((st) => (
                    <label
                      key={st}
                      className={`flex min-h-8 cursor-pointer items-center justify-center rounded-lg text-xs capitalize transition-colors ${
                        backdropStyle === st
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`${formUid}-backdropStyle`}
                        value={st}
                        checked={backdropStyle === st}
                        onChange={() => setBackdropStyle(st)}
                        className="sr-only"
                      />
                      <span>{st}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs">
              <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={karaokeEnabled}
                  onChange={(e) => setKaraokeEnabled(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>Highlight active word (Karaoke preview)</span>
              </label>

              <label className="inline-flex min-h-8 cursor-pointer items-center gap-2 font-medium">
                <input
                  type="checkbox"
                  checked={includeSpeaker}
                  onChange={(e) => setIncludeSpeaker(e.target.checked)}
                  className="h-4 w-4 rounded"
                />
                <span>Include [Speaker] label in export</span>
              </label>
            </div>
          </fieldset>
        </div>

        {/* Right: Editable Subtitle Timeline Cues */}
        <div className="bg-card border-border/65 flex min-h-[480px] min-w-0 flex-col rounded-2xl border lg:col-span-6">
          <div className="border-border/55 flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold">
                2. Subtitle Timeline ({cues.length} cues)
              </h2>
              <p className="text-muted-foreground text-[11px]">
                Click a timestamp to jump playback, or edit lines and split cues below.
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCue}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex min-h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-colors"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Add Cue
            </button>
          </div>

          <div className="max-h-[680px] flex-1 overflow-y-auto p-4">
            {cues.length === 0 ? (
              <div className="text-muted-foreground flex h-64 flex-col items-center justify-center text-center text-xs">
                <Captions className="mb-2 h-6 w-6 opacity-60" aria-hidden="true" />
                <p>No subtitle cues loaded yet.</p>
              </div>
            ) : (
              <ol className="space-y-3">
                {cues.map((cue, idx) => {
                  const isActive = activeCue?.id === cue.id;
                  const cueDur = Math.max(0.1, cue.endSec - cue.startSec);
                  return (
                    <li
                      key={cue.id}
                      className={`rounded-2xl border p-3.5 transition-colors ${
                        isActive
                          ? "border-foreground bg-foreground/[0.05] ring-1 ring-foreground/20"
                          : "border-border/60 bg-background/60"
                      }`}
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => seekMediaTo(cue.startSec, true)}
                            aria-label={`Play from cue ${idx + 1}`}
                            className={`inline-flex min-h-7 items-center gap-1 rounded-lg px-2 font-mono text-[11px] font-semibold transition-colors ${
                              isActive
                                ? "bg-foreground text-background"
                                : "bg-foreground/[0.07] hover:bg-foreground/[0.13]"
                            }`}
                          >
                            <Play className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                            #{idx + 1}
                          </button>

                          <div className="flex items-center gap-1 font-mono text-[11px]">
                            <label htmlFor={`cue-start-${cue.id}`} className="sr-only">
                              Cue {idx + 1} start seconds
                            </label>
                            <input
                              id={`cue-start-${cue.id}`}
                              type="number"
                              min={0}
                              step={0.1}
                              value={cue.startSec.toFixed(2)}
                              onChange={(e) => handleCueTimeChange(cue.id, "startSec", e.target.value)}
                              className="border-border/70 bg-card w-16 rounded-lg border px-1.5 py-0.5 text-center text-[11px] tabular-nums outline-none"
                            />
                            <span className="text-muted-foreground">→</span>
                            <label htmlFor={`cue-end-${cue.id}`} className="sr-only">
                              Cue {idx + 1} end seconds
                            </label>
                            <input
                              id={`cue-end-${cue.id}`}
                              type="number"
                              min={0.1}
                              step={0.1}
                              value={cue.endSec.toFixed(2)}
                              onChange={(e) => handleCueTimeChange(cue.id, "endSec", e.target.value)}
                              className="border-border/70 bg-card w-16 rounded-lg border px-1.5 py-0.5 text-center text-[11px] tabular-nums outline-none"
                            />
                          </div>

                          <span className="text-muted-foreground inline-flex items-center gap-1 font-mono text-[11px]">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            {cueDur.toFixed(1)}s
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              setCues((prev) =>
                                splitCueInHalf(prev, cue.id, { maxCharsPerLine, maxLines })
                              )
                            }
                            aria-label={`Split cue ${idx + 1} into two`}
                            title="Split cue in half"
                            className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] inline-flex min-h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px]"
                          >
                            <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          {idx < cues.length - 1 && (
                            <button
                              type="button"
                              onClick={() =>
                                setCues((prev) =>
                                  mergeCueWithNext(prev, cue.id, { maxCharsPerLine, maxLines })
                                )
                              }
                              aria-label={`Merge cue ${idx + 1} with next cue`}
                              title="Merge with next cue"
                              className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] inline-flex min-h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px]"
                            >
                              <Merge className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setCues((prev) =>
                                prev
                                  .filter((c) => c.id !== cue.id)
                                  .map((c, i) => ({ ...c, index: i + 1 }))
                              )
                            }
                            aria-label={`Delete cue ${idx + 1}`}
                            title="Delete cue"
                            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 inline-flex min-h-7 min-w-7 items-center justify-center rounded-lg px-1.5 text-[11px]"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      </div>

                      <label htmlFor={`cue-text-${cue.id}`} className="sr-only">
                        Subtitle cue {idx + 1} text
                      </label>
                      <textarea
                        id={`cue-text-${cue.id}`}
                        rows={cue.lines.length >= 2 ? 2 : 1}
                        value={cue.lines.join("\n")}
                        onChange={(e) => handleCueTextChange(cue.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.nativeEvent.isComposing) return;
                        }}
                        className="bg-card/70 border-border/55 w-full resize-none rounded-xl border px-3 py-2 text-base leading-relaxed outline-none focus:ring-2 focus:ring-foreground/20 sm:text-sm"
                      />
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function SubtitleStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto flex w-full max-w-7xl items-center justify-center py-20 text-xs text-muted-foreground">
          Loading Subtitle Studio…
        </div>
      }
    >
      <SubtitleStudioWorkspace />
    </Suspense>
  );
}
