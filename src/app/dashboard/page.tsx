"use client";

import React, { useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Captions,
  ChevronDown,
  Clock,
  Globe,
  History as HistoryIcon,
  Languages,
  Loader2,
  MessageSquare,
  PauseCircle,
  Pencil,
  Plus,
  RotateCcw,
  Settings2,
  ShoppingBag,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  Zap,
} from "lucide-react";
import { useStudio } from "@/components/providers";
import { STUDIO_PRESETS, StudioPreset } from "@/lib/presets";
import { VoiceOrb } from "@/components/voice-orb";
import { WaveformPlayer, WaveformPlayerHandle } from "@/components/waveform-player";
import { VoicePickerDialog } from "@/components/studio/voice-picker-dialog";
import { FollowAlongScript } from "@/components/studio/follow-along-script";
import type { SpeechCue } from "@/lib/text-alignment";

interface ParagraphBlock {
  id: string;
  voiceId: string;
  text: string;
}

const PRESET_ICONS = {
  book: BookOpen,
  messages: MessageSquare,
  globe: Globe,
  languages: Languages,
  zap: Zap,
  sparkles: Sparkles,
  bag: ShoppingBag,
};

export default function DashboardGeneratePage() {
  const { voices, history, refreshStore } = useStudio();

  const defaultVoice = voices[0];
  const [paragraphs, setParagraphs] = useState<ParagraphBlock[]>([
    { id: "p-1", voiceId: defaultVoice.id, text: "" },
  ]);
  const [pickerTargetBlockId, setPickerTargetBlockId] = useState<string | null>(null);

  // Studio Settings Rail
  const [railTab, setRailTab] = useState<"settings" | "history">("settings");
  const [model, setModel] = useState("khmer-natural-voice");
  const [stability, setStability] = useState(1.7);
  const [speed, setSpeed] = useState(1.0);
  const [emotion, setEmotion] = useState<
    "neutral" | "warm" | "calm" | "news" | "energetic" | "whisper"
  >("neutral");
  const [generationMode, setGenerationMode] = useState<"runsync" | "stream" | "run">("runsync");
  const [format, setFormat] = useState<"mp3" | "wav">("mp3");
  const [autoPlay, setAutoPlay] = useState(true);
  const [normalizeNumbers, setNormalizeNumbers] = useState(true);

  // Output player state
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeAudioUrl, setActiveAudioUrl] = useState<string | null>(null);
  const [activeWaveform, setActiveWaveform] = useState<number[] | undefined>(undefined);
  const [activeDuration, setActiveDuration] = useState(0);
  const [playerAutoPlay, setPlayerAutoPlay] = useState(true);
  const [activeTimeSec, setActiveTimeSec] = useState(0);
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [generatedSnapshot, setGeneratedSnapshot] = useState<{
    historyId?: string;
    items: Array<{ blockId: string; text: string; synthIndex: number }>;
    cues: SpeechCue[];
    durationSec: number;
  } | null>(null);
  const [editingBlocks, setEditingBlocks] = useState<Record<string, boolean>>({});
  const [manualFollowBlocks, setManualFollowBlocks] = useState<Record<string, boolean>>({});
  const playerRef = useRef<WaveformPlayerHandle | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"all" | "tts" | "clone">("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const totalChars = useMemo(
    () => paragraphs.reduce((sum, p) => sum + p.text.length, 0),
    [paragraphs]
  );

  const getVoiceById = (id: string) => voices.find((v) => v.id === id) ?? voices[0];

  const applyPreset = (preset: StudioPreset) => {
    const blocks: ParagraphBlock[] = preset.lines.map((line, i) => {
      const castName = preset.cast?.[i % preset.cast.length];
      const matchedVoice = castName
        ? voices.find((v) => v.name.toLowerCase() === castName.toLowerCase()) ?? voices[0]
        : voices[0];
      return {
        id: `p-${Date.now()}-${i}`,
        voiceId: matchedVoice.id,
        text: line,
      };
    });
    setParagraphs(blocks);
  };

  const addParagraph = () => {
    const last = paragraphs[paragraphs.length - 1];
    setParagraphs((prev) => [
      ...prev,
      { id: `p-${Date.now()}`, voiceId: last?.voiceId ?? voices[0].id, text: "" },
    ]);
  };

  const insertPause = (blockId?: string) => {
    const targetId = blockId ?? paragraphs[paragraphs.length - 1]?.id;
    setParagraphs((prev) =>
      prev.map((p) =>
        p.id === targetId
          ? { ...p, text: p.text ? `${p.text.trimEnd()} [break=2s] ` : "[break=2s] " }
          : p
      )
    );
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const raw = await file.text();
    const lines = raw
      .split(/\n{2,}/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (lines.length > 0) {
      setParagraphs(
        lines.map((text, i) => ({
          id: `imp-${Date.now()}-${i}`,
          voiceId: paragraphs[0]?.voiceId ?? voices[0].id,
          text,
        }))
      );
    }
    e.target.value = "";
  };

  const resetValues = () => {
    setModel("khmer-natural-voice");
    setStability(1.7);
    setSpeed(1.0);
    setEmotion("neutral");
    setGenerationMode("runsync");
    setFormat("mp3");
    setAutoPlay(true);
    setNormalizeNumbers(true);
  };

  const handleGenerate = async () => {
    const nonEmpty = paragraphs.filter((p) => p.text.trim().length > 0);
    if (nonEmpty.length === 0) return;

    setGenerating(true);
    setError(null);
    try {
      const payload = {
        model,
        voice: getVoiceById(nonEmpty[0].voiceId).name,
        paragraphs: nonEmpty.map((p) => ({
          text: p.text,
          voice: getVoiceById(p.voiceId).name,
        })),
        speed,
        stability,
        emotion,
        normalize_text: normalizeNumbers,
        response_format: format,
      };

      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saktts-client": "studio",
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Synthesis failed");
      setActiveAudioUrl(data.audioUrl);
      setActiveWaveform(data.waveform);
      setActiveDuration(data.durationSec);
      setPlayerAutoPlay(autoPlay);
      setActiveTimeSec(0);
      setGeneratedSnapshot({
        historyId: data.historyItem?.id ?? data.id,
        items: nonEmpty.map((p, synthIndex) => ({
          blockId: p.id,
          text: p.text.trim(),
          synthIndex,
        })),
        cues: Array.isArray(data.cues) ? data.cues : [],
        durationSec: Number(data.durationSec ?? 0),
      });
      setEditingBlocks({});
      setManualFollowBlocks({});
      await refreshStore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate audio");
    } finally {
      setGenerating(false);
    }
  };

  const deleteHistoryItem = async (id: string) => {
    await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    refreshStore();
  };

  const filteredHistory = history.filter((item) => {
    if (historyFilter === "all") return item.type === "tts" || item.type === "clone";
    return item.type === historyFilter;
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
      {/* Left: Editor Canvas */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {/* Top mobile rail toggle */}
        <div className="flex items-center justify-between gap-2 px-4 pt-3 lg:hidden">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="bg-card border-border/60 flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <div className="bg-foreground/[0.06] flex rounded-full p-0.5">
            <button
              type="button"
              onClick={() => setRailTab("settings")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                railTab === "settings" ? "bg-card shadow-xs" : "text-muted-foreground"
              }`}
            >
              Settings
            </button>
            <button
              type="button"
              onClick={() => setRailTab("history")}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                railTab === "history" ? "bg-card shadow-xs" : "text-muted-foreground"
              }`}
            >
              History
            </button>
          </div>
        </div>

        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-y-auto px-4 pt-6 pb-4 sm:px-6 sm:pt-10">
          <div className="space-y-3">
            {paragraphs.map((block, index) => {
              const voice = getVoiceById(block.voiceId);
              const snapItem = generatedSnapshot?.items.find(
                (item) => item.blockId === block.id && item.text === block.text.trim()
              );
              const canFollow = Boolean(activeAudioUrl && snapItem);
              const isFollowMode =
                canFollow &&
                !editingBlocks[block.id] &&
                (isAudioPlaying || activeTimeSec > 0 || manualFollowBlocks[block.id]);

              return (
                <div
                  key={block.id}
                  className="bg-card rounded-3xl p-4 ring-1 ring-black/[0.04] transition-shadow focus-within:ring-2 focus-within:ring-foreground/15 dark:ring-white/[0.06]"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setPickerTargetBlockId(block.id)}
                      className="bg-foreground/[0.05] hover:bg-foreground/[0.09] flex h-8 items-center gap-2 rounded-full pr-3 pl-2 text-xs font-medium transition-colors"
                    >
                      <VoiceOrb orb={voice.orb} size={18} />
                      <span>{voice.name}</span>
                      <ChevronDown className="h-3 w-3 opacity-60" />
                    </button>

                    <div className="flex items-center gap-2">
                      {canFollow && (
                        <button
                          type="button"
                          onClick={() => {
                            if (isFollowMode) {
                              setEditingBlocks((prev) => ({ ...prev, [block.id]: true }));
                              setManualFollowBlocks((prev) => ({ ...prev, [block.id]: false }));
                            } else {
                              setEditingBlocks((prev) => ({ ...prev, [block.id]: false }));
                              setManualFollowBlocks((prev) => ({ ...prev, [block.id]: true }));
                            }
                          }}
                          className={`inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11px] font-medium transition-colors ${
                            isFollowMode
                              ? "bg-foreground text-background"
                              : "bg-foreground/[0.06] text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {isFollowMode ? (
                            <>
                              <Pencil className="h-3 w-3" /> Edit text
                            </>
                          ) : (
                            <>
                              <Volume2 className="h-3 w-3" /> Follow audio
                            </>
                          )}
                        </button>
                      )}
                      <span className="text-muted-foreground font-mono text-[11px] tabular-nums">
                        Paragraph {index + 1} · {block.text.length} chars
                      </span>
                      {paragraphs.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setParagraphs((prev) => prev.filter((p) => p.id !== block.id))
                          }
                          aria-label="Remove paragraph"
                          className="text-muted-foreground hover:text-destructive flex h-7 w-7 items-center justify-center rounded-full transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {isFollowMode && snapItem ? (
                    <FollowAlongScript
                      text={block.text}
                      paragraphIndex={snapItem.synthIndex}
                      cues={generatedSnapshot?.cues}
                      totalDurationSec={generatedSnapshot?.durationSec || activeDuration}
                      currentTimeSec={activeTimeSec}
                      isPlaying={isAudioPlaying}
                      onSeekToTime={(sec) => playerRef.current?.seekTo(sec, true)}
                      className={paragraphs.length > 1 ? "min-h-[86px]" : "min-h-[172px]"}
                    />
                  ) : (
                    <textarea
                      aria-label={`Paragraph ${index + 1} script`}
                      value={block.text}
                      onChange={(e) => {
                        const val = e.target.value;
                        setParagraphs((prev) =>
                          prev.map((p) => (p.id === block.id ? { ...p, text: val } : p))
                        );
                      }}
                      rows={paragraphs.length > 1 ? 3 : 6}
                      placeholder="Type or paste your text here... Tip: [break=2s] adds a pause."
                      className="w-full resize-none bg-transparent px-1 text-[15.5px] leading-[1.85] outline-none placeholder:text-muted-foreground/50"
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Paragraph & Pause Divider Buttons */}
          <div className="relative flex items-center justify-center px-1 py-4">
            <div className="border-border/50 absolute inset-x-1 top-1/2 border-t" />
            <div className="relative flex items-center gap-2">
              <button
                type="button"
                onClick={addParagraph}
                className="bg-workspace text-muted-foreground hover:text-foreground border-border/70 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              >
                <Plus className="h-3 w-3" /> Paragraph
              </button>
              <button
                type="button"
                onClick={() => insertPause()}
                className="bg-workspace text-muted-foreground hover:text-foreground border-border/70 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors"
              >
                <PauseCircle className="h-3 w-3" /> Pause
              </button>
            </div>
          </div>

          {/* Get Started With Preset Chips */}
          <div className="mt-auto pt-4">
            <p className="text-muted-foreground mb-2.5 text-xs">Get started with</p>
            <div className="flex flex-wrap gap-2">
              {STUDIO_PRESETS.map((preset) => {
                const Icon = PRESET_ICONS[preset.icon];
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="bg-card hover:bg-foreground/[0.06] border-border/50 flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition-colors"
                  >
                    <Icon className="h-3.5 w-3.5 opacity-70" />
                    <span>{preset.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Audio Player Bar */}
          {(activeAudioUrl || error) && (
            <div className="bg-card border-border/70 mt-5 rounded-3xl border p-4 shadow-sm">
              {error ? (
                <p className="text-destructive text-sm font-medium">{error}</p>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <WaveformPlayer
                      ref={playerRef}
                      audioUrl={activeAudioUrl}
                      waveform={activeWaveform}
                      durationHint={activeDuration}
                      autoPlay={playerAutoPlay}
                      downloadName={`saktts-studio.${format}`}
                      onTimeUpdate={setActiveTimeSec}
                      onPlayStateChange={setIsAudioPlaying}
                    />
                  </div>
                  <Link
                    href={
                      generatedSnapshot?.historyId
                        ? `/dashboard/subtitles?historyId=${encodeURIComponent(
                            generatedSnapshot.historyId
                          )}`
                        : "/dashboard/subtitles"
                    }
                    className="border-border/75 bg-foreground/[0.05] hover:bg-foreground/[0.1] inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold transition-colors"
                  >
                    <Captions className="h-3.5 w-3.5" aria-hidden="true" />
                    Generate Subtitle
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom Action Bar */}
        <div className="border-border/50 bg-workspace/80 mx-auto flex w-full max-w-3xl items-center gap-3 border-t px-4 py-3 backdrop-blur-sm sm:px-6 sm:py-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.srt"
            className="sr-only"
            onChange={handleImportFile}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] hidden h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors sm:inline-flex"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <button
            type="button"
            onClick={() =>
              setParagraphs([{ id: `p-${Date.now()}`, voiceId: paragraphs[0]?.voiceId ?? voices[0].id, text: "" }])
            }
            disabled={totalChars === 0}
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear
          </button>

          <div className="flex-1" />

          <span className="text-muted-foreground font-mono text-xs tabular-nums">
            ~{Math.max(0, Math.round(totalChars * 1.1))} credits
          </span>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || totalChars === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 min-w-[175px] items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Generate Speech
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Rail: Settings / History */}
      <aside className="border-foreground/[0.075] bg-workspace/50 flex w-full shrink-0 flex-col border-t lg:h-full lg:w-[360px] lg:border-t-0 lg:border-l xl:w-[410px]">
        <div className="border-border/50 hidden h-14 flex-none items-center border-b px-4 lg:flex">
          <div className="bg-foreground/[0.06] flex items-center rounded-full p-1">
            <button
              type="button"
              onClick={() => setRailTab("settings")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                railTab === "settings"
                  ? "bg-card text-foreground font-semibold shadow-xs dark:bg-foreground/[0.14]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Settings2 className="h-3.5 w-3.5" /> Settings
            </button>
            <button
              type="button"
              onClick={() => setRailTab("history")}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                railTab === "history"
                  ? "bg-card text-foreground font-semibold shadow-xs dark:bg-foreground/[0.14]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <HistoryIcon className="h-3.5 w-3.5" /> History ({filteredHistory.length})
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
          {railTab === "settings" ? (
            <div className="space-y-6">
              {/* Model */}
              <div className="space-y-2">
                <label htmlFor="studio-model" className="block text-[14px] font-medium">
                  Model
                </label>
                <select
                  id="studio-model"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="bg-card border-border/70 h-10 w-full rounded-2xl border px-3 text-sm outline-none"
                >
                  <option value="khmer-natural-voice">
                    Khmer Natural Voice (48 kHz Native Neural)
                  </option>
                </select>
              </div>

              {/* Stability */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="stability-slider" className="text-[14px] font-medium">
                    Stability
                  </label>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {stability.toFixed(2)}
                  </span>
                </div>
                <input
                  id="stability-slider"
                  type="range"
                  min={0.1}
                  max={2.5}
                  step={0.05}
                  value={stability}
                  onChange={(e) => setStability(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>Creative</span>
                  <span>Robust</span>
                </div>
              </div>

              {/* Speed */}
              <div className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <label htmlFor="speed-slider" className="text-[14px] font-medium">
                    Speed
                  </label>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">
                    {speed.toFixed(2)}x
                  </span>
                </div>
                <input
                  id="speed-slider"
                  type="range"
                  min={0.7}
                  max={1.2}
                  step={0.05}
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-muted-foreground flex justify-between text-xs">
                  <span>Slower</span>
                  <span>Faster</span>
                </div>
              </div>

              {/* Speaking Style / Emotion */}
              <div className="space-y-2">
                <p className="text-[14px] font-medium">Speaking style</p>
                <div className="flex flex-wrap gap-1.5">
                  {(["neutral", "warm", "calm", "news", "energetic", "whisper"] as const).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setEmotion(st)}
                        className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                          emotion === st
                            ? "bg-foreground text-background font-semibold"
                            : "bg-card border-border/60 text-muted-foreground hover:text-foreground border"
                        }`}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Global Settings */}
              <div className="border-border/50 space-y-4 border-t pt-4">
                <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
                  Global settings
                </p>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium">Generation mode</span>
                  <select
                    aria-label="Generation mode"
                    value={generationMode}
                    onChange={(e) =>
                      setGenerationMode(e.target.value as "runsync" | "stream" | "run")
                    }
                    className="bg-card border-border/70 h-9 rounded-full border px-3 text-xs font-medium outline-none"
                  >
                    <option value="runsync">Instant</option>
                    <option value="stream">Streaming</option>
                    <option value="run">Background</option>
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-[14px] font-medium">Output format</span>
                  <div className="bg-foreground/[0.06] flex rounded-full p-0.5">
                    {(["mp3", "wav"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => setFormat(fmt)}
                        className={`rounded-full px-3 py-1 font-mono text-xs uppercase ${
                          format === fmt ? "bg-card font-semibold shadow-xs" : "text-muted-foreground"
                        }`}
                      >
                        {fmt}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="text-[14px] font-medium">Auto-play after generating</span>
                  <input
                    type="checkbox"
                    checked={autoPlay}
                    onChange={(e) => setAutoPlay(e.target.checked)}
                    className="h-4 w-4 rounded"
                  />
                </label>

                <label className="flex cursor-pointer items-start justify-between gap-3">
                  <div>
                    <span className="block text-[14px] font-medium">Read numbers as words</span>
                    <span className="text-muted-foreground text-xs">
                      Says 12.5 → “ដប់ពីរចុចប្រាំ”
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={normalizeNumbers}
                    onChange={(e) => setNormalizeNumbers(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded"
                  />
                </label>
              </div>

              <div className="flex justify-center pt-2">
                <button
                  type="button"
                  onClick={resetValues}
                  className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reset values
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-foreground/[0.05] flex gap-1 rounded-full p-1">
                {(["all", "tts", "clone"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setHistoryFilter(f)}
                    className={`flex-1 rounded-full py-1 text-xs capitalize ${
                      historyFilter === f
                        ? "bg-card font-semibold shadow-xs"
                        : "text-muted-foreground"
                    }`}
                  >
                    {f === "all" ? "All" : f === "tts" ? "Speech" : "Clones"}
                  </button>
                ))}
              </div>

              {filteredHistory.length === 0 ? (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No generated clips yet. Generate your first audio on the left!
                </p>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-card border-border/60 space-y-2 rounded-2xl border p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{item.title}</p>
                        <p className="text-muted-foreground flex items-center gap-2 text-xs">
                          <span>{item.voiceName}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1 font-mono">
                            <Clock className="h-3 w-3" /> {item.durationSec.toFixed(1)}s
                          </span>
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteHistoryItem(item.id)}
                        aria-label="Delete history item"
                        className="text-muted-foreground hover:text-destructive p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {item.audioUrl && (
                      <WaveformPlayer
                        audioUrl={item.audioUrl}
                        waveform={item.waveform}
                        durationHint={item.durationSec}
                        compact={true}
                        downloadName={`${item.id}.${item.format || "mp3"}`}
                      />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const newId = `reload-${Date.now()}`;
                        setParagraphs([
                          {
                            id: newId,
                            voiceId: item.voiceId || voices[0].id,
                            text: item.text,
                          },
                        ]);
                        setEditingBlocks({});
                        setManualFollowBlocks({});
                        if (item.audioUrl) {
                          setActiveAudioUrl(item.audioUrl);
                          setActiveWaveform(item.waveform);
                          setActiveDuration(item.durationSec);
                          setPlayerAutoPlay(false);
                          setActiveTimeSec(0);
                          setGeneratedSnapshot({
                            historyId: item.id,
                            items: [
                              {
                                blockId: newId,
                                text: item.text.trim(),
                                synthIndex: 0,
                              },
                            ],
                            cues: item.cues ?? [],
                            durationSec: item.durationSec,
                          });
                        }
                      }}
                      className="text-muted-foreground hover:text-foreground text-xs font-medium underline-offset-4 hover:underline"
                    >
                      Load script into editor
                    </button>
                    <Link
                      href={`/dashboard/subtitles?historyId=${encodeURIComponent(item.id)}`}
                      className="text-muted-foreground hover:text-foreground ml-3 inline-flex items-center gap-1 text-xs font-medium underline-offset-4 hover:underline"
                    >
                      <Captions className="h-3 w-3" aria-hidden="true" />
                      Subtitle
                    </Link>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </aside>

      <VoicePickerDialog
        open={pickerTargetBlockId !== null}
        onClose={() => setPickerTargetBlockId(null)}
        selectedVoiceId={
          pickerTargetBlockId
            ? paragraphs.find((p) => p.id === pickerTargetBlockId)?.voiceId
            : undefined
        }
        onSelect={(voice) => {
          if (pickerTargetBlockId) {
            setParagraphs((prev) =>
              prev.map((p) =>
                p.id === pickerTargetBlockId ? { ...p, voiceId: voice.id } : p
              )
            );
          }
          setPickerTargetBlockId(null);
        }}
      />
    </div>
  );
}
