"use client";

import React, { useRef, useState } from "react";
import Link from "next/link";
import {
  AudioLines,
  Download,
  FileAudio,
  Loader2,
  Mic,
  Play,
  Square,
  Upload,
  Volume2,
} from "lucide-react";
import { HERO_VOICES, VoiceProfile } from "@/lib/voices";
import { DEFAULT_HERO_TEXT } from "@/lib/i18n";
import { useLanguage, useStudio } from "@/components/providers";
import { VoiceOrb } from "@/components/voice-orb";
import { WaveformPlayer } from "@/components/waveform-player";
import { ModalDialog } from "@/components/ui/modal-dialog";
import type { SttSegment } from "@/lib/presets";

export function HeroPlayground() {
  const { t } = useLanguage();
  const { refreshStore } = useStudio();
  const [activeTab, setActiveTab] = useState<"tts" | "stt">("tts");

  // TTS state
  const [text, setText] = useState(DEFAULT_HERO_TEXT);
  const [selectedVoice, setSelectedVoice] = useState<VoiceProfile>(HERO_VOICES[0]);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [ttsWaveform, setTtsWaveform] = useState<number[] | undefined>(undefined);
  const [ttsDuration, setTtsDuration] = useState<number>(0);

  // STT state
  const [recording, setRecording] = useState(false);
  const [sttLoading, setSttLoading] = useState(false);
  const [sttSegments, setSttSegments] = useState<SttSegment[] | null>(null);
  const [sttAudioUrl, setSttAudioUrl] = useState<string | null>(null);
  const [sttDuration, setSttDuration] = useState<number>(0);
  const [sttError, setSttError] = useState<string | null>(null);
  const [liveHint, setLiveHint] = useState("");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);

  // Watch Demo modal
  const [demoOpen, setDemoOpen] = useState(false);

  const handleGenerateSpeech = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setTtsLoading(true);
    setTtsError(null);

    try {
      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saktts-client": "studio",
        },
        body: JSON.stringify({
          model: "saktts",
          voice: selectedVoice.name,
          input: trimmed.slice(0, 500),
          skipCredits: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate audio");
      setTtsAudioUrl(data.audioUrl);
      setTtsWaveform(data.waveform);
      setTtsDuration(data.durationSec);
      refreshStore();
    } catch (err) {
      setTtsError(err instanceof Error ? err.message : "Synthesis failed");
    } finally {
      setTtsLoading(false);
    }
  };

  const transcribeFile = async (file: File | Blob, fileName: string, hint = "") => {
    setSttLoading(true);
    setSttError(null);
    try {
      const fd = new FormData();
      fd.append("file", file, fileName);
      if (hint) fd.append("hintText", hint);
      const res = await fetch("/api/v1/audio/transcriptions", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      setSttSegments(data.segments);
      setSttAudioUrl(data.audioUrl);
      setSttDuration(data.durationSec);
      refreshStore();
    } catch (err) {
      setSttError(err instanceof Error ? err.message : "Transcription failed");
    } finally {
      setSttLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      speechRecRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      setSttError(null);
      setLiveHint("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];

      let accumulatedHint = "";
      // Optional Web Speech live recognition to pair real words with recorded audio
      const SpeechRec =
        (window as unknown as Record<string, unknown>).SpeechRecognition ||
        (window as unknown as Record<string, unknown>).webkitSpeechRecognition;

      if (typeof SpeechRec === "function") {
        try {
          const rec = new (SpeechRec as new () => {
            continuous: boolean;
            interimResults: boolean;
            lang: string;
            onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void;
            start: () => void;
            stop: () => void;
          })();
          rec.continuous = true;
          rec.interimResults = true;
          rec.lang = "en-US";
          rec.onresult = (e) => {
            const parts: string[] = [];
            for (let i = 0; i < e.results.length; i++) {
              parts.push(e.results[i][0].transcript);
            }
            accumulatedHint = parts.join(" ");
            setLiveHint(accumulatedHint);
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // ignore speech recognition unavailability
        }
      }

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        transcribeFile(blob, "mic-recording.webm", accumulatedHint);
      };

      mediaRecorderRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setSttError("Microphone permission denied or unavailable.");
    }
  };

  const downloadSubtitle = (fmt: "srt" | "vtt" | "txt") => {
    if (!sttSegments) return;
    let content = "";
    if (fmt === "txt") {
      content = sttSegments
        .map((s) => `[${s.speaker}] ${s.words.map((w) => w.text).join(" ")}`)
        .join("\n");
    } else if (fmt === "vtt") {
      content =
        "WEBVTT\n\n" +
        sttSegments
          .map(
            (s) =>
              `${s.start.toFixed(3).padStart(6, "0")} --> ${s.end.toFixed(3).padStart(6, "0")}\n${s.words.map((w) => w.text).join(" ")}`
          )
          .join("\n\n");
    } else {
      content = sttSegments
        .map(
          (s, i) =>
            `${i + 1}\n00:00:${String(Math.floor(s.start)).padStart(2, "0")},000 --> 00:00:${String(Math.floor(s.end)).padStart(2, "0")},000\n[${s.speaker}] ${s.words.map((w) => w.text).join(" ")}`
        )
        .join("\n\n");
    }
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transcript.${fmt}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6">
      <div className="animate-fade-in-up mx-auto flex max-w-4xl flex-col items-center space-y-8 text-center">
        <h1 className="text-foreground text-4xl leading-[1.06] font-semibold tracking-[-0.03em] sm:text-5xl md:text-6xl lg:text-7xl">
          {t("hero.title")}
        </h1>
        <p className="text-muted-foreground max-w-2xl text-[17px] leading-relaxed sm:text-xl">
          {t("hero.subtitle")}
        </p>

        <div className="flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
          <Link
            href="/dashboard"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-12 w-full items-center justify-center rounded-full px-6 text-[15px] font-semibold transition-all active:scale-[0.98] sm:h-11 sm:w-auto"
          >
            {t("hero.cta")}
          </Link>
          <button
            type="button"
            onClick={() => setDemoOpen(true)}
            className="bg-card text-foreground hover:opacity-80 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-[15px] font-medium shadow-sm ring-1 ring-black/[0.04] transition-all sm:h-11 sm:w-auto dark:ring-white/[0.06]"
          >
            <Play className="h-4 w-4 fill-current" />
            {t("hero.watchDemo")}
          </button>
        </div>
      </div>

      {/* Interactive Hero Playground */}
      <div className="mx-auto mt-14 max-w-3xl">
        <div className="bg-card/95 rounded-3xl p-4 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.05] backdrop-blur-xl sm:p-6 dark:shadow-[0_12px_40px_-12px_rgba(0,0,0,0.6)] dark:ring-white/[0.07]">
          {/* Mode Tabs */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Playground mode"
              className="bg-foreground/[0.06] inline-flex items-center rounded-full p-1"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "tts"}
                onClick={() => setActiveTab("tts")}
                className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                  activeTab === "tts"
                    ? "bg-card text-foreground shadow-sm dark:bg-foreground/[0.14]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Volume2 className="h-3.5 w-3.5" />
                {t("hero.tab.tts")}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeTab === "stt"}
                onClick={() => setActiveTab("stt")}
                className={`flex h-9 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold transition-colors ${
                  activeTab === "stt"
                    ? "bg-card text-foreground shadow-sm dark:bg-foreground/[0.14]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <AudioLines className="h-3.5 w-3.5" />
                {t("hero.tab.stt")}
              </button>
            </div>

            {activeTab === "tts" && (
              <span className="text-muted-foreground font-mono text-xs tabular-nums">
                {text.length} / 500
              </span>
            )}
          </div>

          {activeTab === "tts" ? (
            <div className="space-y-4">
              <textarea
                aria-label="Speech synthesis text"
                value={text}
                maxLength={500}
                onChange={(e) => setText(e.target.value)}
                rows={4}
                placeholder="Type Khmer or English text here..."
                className="bg-foreground/[0.03] border-border/60 focus:ring-foreground/15 w-full resize-none rounded-2xl border p-4 text-[15px] leading-relaxed outline-none focus:ring-2"
              />

              {/* Voice pills */}
              <div className="flex flex-wrap items-center gap-2">
                {HERO_VOICES.map((voice) => {
                  const selected = selectedVoice.id === voice.id;
                  return (
                    <button
                      key={voice.id}
                      type="button"
                      onClick={() => setSelectedVoice(voice)}
                      className={`flex h-8 items-center gap-2 rounded-full pr-3 pl-2 text-[13px] transition-all ${
                        selected
                          ? "bg-foreground text-background font-semibold shadow-sm"
                          : "bg-foreground/[0.05] text-foreground/85 hover:bg-foreground/[0.09]"
                      }`}
                    >
                      <VoiceOrb orb={voice.orb} size={18} />
                      <span>{voice.name}</span>
                    </button>
                  );
                })}
              </div>

              {ttsError && (
                <p className="text-destructive text-xs font-medium">{ttsError}</p>
              )}

              <div className="border-border/50 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <WaveformPlayer
                    audioUrl={ttsAudioUrl}
                    waveform={ttsWaveform}
                    durationHint={ttsDuration}
                    autoPlay={true}
                    compact={true}
                    downloadName={`saktts-${selectedVoice.name.toLowerCase()}.mp3`}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleGenerateSpeech}
                  disabled={ttsLoading || !text.trim()}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-[14px] font-semibold transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {ttsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t("hero.generating")}
                    </>
                  ) : (
                    t("hero.generate")
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-foreground/[0.03] border-border/70 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center">
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={toggleRecording}
                    className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-[13.5px] font-semibold transition-all ${
                      recording
                        ? "bg-destructive text-destructive-foreground animate-pulse"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                    }`}
                  >
                    {recording ? (
                      <>
                        <Square className="h-3.5 w-3.5 fill-current" />
                        Stop Recording
                      </>
                    ) : (
                      <>
                        <Mic className="h-4 w-4" />
                        Record Microphone
                      </>
                    )}
                  </button>

                  <label className="bg-foreground/[0.06] hover:bg-foreground/[0.1] inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-[13.5px] font-medium transition-colors">
                    <Upload className="h-4 w-4" />
                    Upload Audio
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.m4a,.webm"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) transcribeFile(file, file.name);
                      }}
                    />
                  </label>
                </div>
                <p className="text-muted-foreground text-xs">
                  MP3 · WAV · M4A · WEBM — instant speaker detection and timestamped segments
                </p>
                {liveHint && (
                  <p className="bg-card border-border/60 rounded-xl border px-3 py-1.5 text-xs">
                    Live capture: {liveHint}
                  </p>
                )}
              </div>

              {sttLoading && (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Transcribing audio & detecting speakers…
                </div>
              )}

              {sttError && (
                <p className="text-destructive text-xs font-medium">{sttError}</p>
              )}

              {sttSegments && (
                <div className="space-y-3">
                  {sttAudioUrl && (
                    <WaveformPlayer
                      audioUrl={sttAudioUrl}
                      durationHint={sttDuration}
                      compact={true}
                      downloadName="recording.webm"
                    />
                  )}
                  <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                    {sttSegments.map((seg) => (
                      <div
                        key={seg.id}
                        className="bg-foreground/[0.03] rounded-2xl p-3 text-left text-sm"
                      >
                        <div className="mb-1 flex items-center gap-2 text-xs">
                          <span
                            className="inline-block h-2 w-2 rounded-full"
                            style={{ backgroundColor: seg.color }}
                          />
                          <span className="font-semibold">{seg.speaker}</span>
                          <span className="text-muted-foreground font-mono tabular-nums">
                            {seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s
                          </span>
                        </div>
                        <p className="text-foreground/90 leading-relaxed">
                          {seg.words.map((w) => w.text).join(" ")}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-1.5">
                      {(["srt", "vtt", "txt"] as const).map((fmt) => (
                        <button
                          key={fmt}
                          type="button"
                          onClick={() => downloadSubtitle(fmt)}
                          className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex h-7 items-center gap-1 rounded-full px-2.5 font-mono text-[11px] font-medium uppercase"
                        >
                          <Download className="h-3 w-3" /> {fmt}
                        </button>
                      ))}
                    </div>
                    <Link
                      href="/dashboard/speech-to-text"
                      className="text-xs font-semibold underline-offset-4 hover:underline"
                    >
                      Open full STT Studio →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Watch Demo Modal */}
      <ModalDialog
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        title="SAKTTS Platform Walkthrough"
        description="Explore Khmer & English neural synthesis, 10-second voice cloning, and timestamped transcription."
      >
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              {
                title: "1. Text to Speech",
                desc: "Type Khmer, English, or switch mid-sentence. Control Stability (0.1–2.5), Speed, and [break=2s] pauses.",
                href: "/dashboard",
                icon: Volume2,
              },
              {
                title: "2. Voice Cloning",
                desc: "Record 10 seconds of speech or describe a voice prompt to add a reusable voice profile.",
                href: "/dashboard/voice-clones",
                icon: Mic,
              },
              {
                title: "3. Speech to Text",
                desc: "Upload or record audio for speaker-diarized transcripts exportable as SRT, VTT, JSON, TXT, or CSV.",
                href: "/dashboard/speech-to-text",
                icon: FileAudio,
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  onClick={() => setDemoOpen(false)}
                  className="bg-foreground/[0.04] hover:bg-foreground/[0.08] flex flex-col gap-2 rounded-2xl p-4 transition-colors"
                >
                  <span className="bg-card flex h-9 w-9 items-center justify-center rounded-xl shadow-sm">
                    <Icon className="h-4 w-4" />
                  </span>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {item.desc}
                  </p>
                </Link>
              );
            })}
          </div>
          <div className="flex justify-end">
            <Link
              href="/dashboard"
              onClick={() => setDemoOpen(false)}
              className="bg-primary text-primary-foreground inline-flex h-10 items-center rounded-full px-5 text-sm font-semibold"
            >
              Launch Studio →
            </Link>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
}
