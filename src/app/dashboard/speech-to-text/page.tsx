"use client";

import React, { useRef, useState } from "react";
import { Download, Loader2, Mic, Square, Upload } from "lucide-react";
import { useStudio } from "@/components/providers";
import { SttSegment } from "@/lib/presets";
import { WaveformPlayer } from "@/components/waveform-player";

const SPEAKER_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function SpeechToTextStudioPage() {
  const { refreshStore } = useStudio();
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [language, setLanguage] = useState("auto");
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[] | undefined>(undefined);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [segments, setSegments] = useState<SttSegment[]>([]);
  const [liveHint, setLiveHint] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const speechRecRef = useRef<{ stop: () => void } | null>(null);

  const runTranscription = async (file: File | Blob, name: string, hint = "") => {
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file, name);
      fd.append("language", language);
      if (hint) fd.append("hintText", hint);

      const res = await fetch("/api/v1/audio/transcriptions", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      setAudioUrl(data.audioUrl);
      setWaveform(data.waveform);
      setDuration(data.durationSec);
      setSegments(data.segments ?? []);
      refreshStore();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to transcribe audio");
    } finally {
      setLoading(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mrRef.current?.stop();
      speechRecRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      setError(null);
      setLiveHint("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      let capturedText = "";

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
          rec.lang = language === "km" ? "km-KH" : "en-US";
          rec.onresult = (e) => {
            const parts: string[] = [];
            for (let i = 0; i < e.results.length; i++) {
              parts.push(e.results[i][0].transcript);
            }
            capturedText = parts.join(" ");
            setLiveHint(capturedText);
          };
          rec.start();
          speechRecRef.current = rec;
        } catch {
          // ignore
        }
      }

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        runTranscription(blob, "studio-recording.webm", capturedText);
      };
      mrRef.current = mr;
      mr.start();
      setRecording(true);
    } catch {
      setError("Microphone permission denied or unavailable.");
    }
  };

  const updateSegmentText = (id: string, nextText: string) => {
    setSegments((prev) =>
      prev.map((s) => {
        if (s.id !== id) return s;
        const words = nextText.split(/\s+/).filter(Boolean);
        const dur = Math.max(0.4, s.end - s.start) / Math.max(1, words.length);
        return {
          ...s,
          words: words.map((text, idx) => ({
            text,
            start: s.start + idx * dur,
            end: s.start + (idx + 1) * dur,
          })),
        };
      })
    );
  };

  const exportFormat = (fmt: "SRT" | "VTT" | "JSON" | "TXT" | "CSV") => {
    if (segments.length === 0) return;
    const pad = (n: number) => String(Math.floor(n)).padStart(2, "0");
    const ts = (sec: number, sep: string) =>
      `00:${pad(sec / 60)}:${pad(sec % 60)}${sep}${String(Math.round((sec % 1) * 1000)).padStart(3, "0")}`;

    let out = "";
    if (fmt === "SRT") {
      out = segments
        .map(
          (s, i) =>
            `${i + 1}\n${ts(s.start, ",")} --> ${ts(s.end, ",")}\n[${s.speaker}] ${s.words
              .map((w) => w.text)
              .join(" ")}`
        )
        .join("\n\n");
    } else if (fmt === "VTT") {
      out =
        "WEBVTT\n\n" +
        segments
          .map(
            (s) =>
              `${ts(s.start, ".")} --> ${ts(s.end, ".")}\n<v ${s.speaker}>${s.words
                .map((w) => w.text)
                .join(" ")}`
          )
          .join("\n\n");
    } else if (fmt === "JSON") {
      out = JSON.stringify({ durationSec: duration, segments }, null, 2);
    } else if (fmt === "CSV") {
      out =
        "speaker,start,end,text\n" +
        segments
          .map(
            (s) =>
              `"${s.speaker}",${s.start.toFixed(3)},${s.end.toFixed(3)},"${s.words
                .map((w) => w.text)
                .join(" ")
                .replace(/"/g, '""')}"`
          )
          .join("\n");
    } else {
      out = segments
        .map((s) => `[${s.speaker} ${s.start.toFixed(1)}s]: ${s.words.map((w) => w.text).join(" ")}`)
        .join("\n");
    }

    const blob = new Blob([out], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saktts-transcript.${fmt.toLowerCase()}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Speech to Text Studio
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Upload or record audio for speaker-labeled transcripts with SRT, VTT, JSON, TXT, and CSV
            exports.
          </p>
        </div>

        <select
          aria-label="Transcription language"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-card border-border/70 h-10 rounded-full border px-4 text-sm font-medium outline-none"
        >
          <option value="auto">Auto-detect (Khmer & English)</option>
          <option value="km">Khmer (ភាសាខ្មែរ)</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* Upload / Record Zone */}
      <div className="bg-card border-border/70 flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed p-8 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={toggleRecording}
            className={`inline-flex h-11 items-center gap-2 rounded-full px-6 text-sm font-semibold transition-all ${
              recording
                ? "bg-destructive text-destructive-foreground animate-pulse"
                : "bg-primary text-primary-foreground"
            }`}
          >
            {recording ? (
              <>
                <Square className="h-4 w-4 fill-current" /> Stop Recording
              </>
            ) : (
              <>
                <Mic className="h-4 w-4" /> Record Microphone
              </>
            )}
          </button>

          <label className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-6 text-sm font-medium">
            <Upload className="h-4 w-4" /> Upload Audio File
            <input
              type="file"
              accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) runTranscription(file, file.name);
              }}
            />
          </label>
        </div>
        <p className="text-muted-foreground text-xs">
          Supports MP3, WAV, M4A, WEBM, OGG · Automatic silence segmentation & speaker detection
        </p>
        {liveHint && (
          <p className="bg-foreground/[0.04] max-w-xl rounded-2xl px-4 py-2 text-xs">
            Live capture: {liveHint}
          </p>
        )}
      </div>

      {loading && (
        <div className="text-muted-foreground flex items-center justify-center gap-2 py-8 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" />
          Analyzing waveform & diarizing speakers…
        </div>
      )}

      {error && <p className="text-destructive text-sm font-medium">{error}</p>}

      {audioUrl && (
        <div className="bg-card rounded-3xl p-4 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <WaveformPlayer
            audioUrl={audioUrl}
            waveform={waveform}
            durationHint={duration}
            onTimeUpdate={setCurrentTime}
            downloadName="stt-source.webm"
          />
        </div>
      )}

      {segments.length > 0 && (
        <div className="bg-card space-y-4 rounded-3xl p-5 ring-1 ring-black/[0.04] sm:p-6 dark:ring-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Editable Transcript</h2>
            <div className="flex flex-wrap gap-1.5">
              {(["SRT", "VTT", "JSON", "TXT", "CSV"] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => exportFormat(fmt)}
                  className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex h-8 items-center gap-1.5 rounded-full px-3 font-mono text-xs font-medium"
                >
                  <Download className="h-3.5 w-3.5" /> {fmt}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {segments.map((seg) => {
              const isActive = currentTime >= seg.start && currentTime <= seg.end;
              return (
                <div
                  key={seg.id}
                  className={`rounded-2xl border p-4 transition-colors ${
                    isActive
                      ? "border-foreground bg-foreground/[0.04]"
                      : "border-border/60 bg-foreground/[0.02]"
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        aria-label="Cycle speaker color"
                        onClick={() => {
                          const nextColor =
                            SPEAKER_COLORS[
                              (SPEAKER_COLORS.indexOf(seg.color) + 1) % SPEAKER_COLORS.length
                            ];
                          setSegments((prev) =>
                            prev.map((s) => (s.id === seg.id ? { ...s, color: nextColor } : s))
                          );
                        }}
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      <input
                        aria-label="Speaker name"
                        value={seg.speaker}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSegments((prev) =>
                            prev.map((s) => (s.id === seg.id ? { ...s, speaker: val } : s))
                          );
                        }}
                        className="bg-transparent font-semibold outline-none focus:underline"
                      />
                    </div>
                    <span className="text-muted-foreground font-mono tabular-nums">
                      {seg.start.toFixed(2)}s – {seg.end.toFixed(2)}s
                    </span>
                  </div>
                  <textarea
                    aria-label="Segment transcript text"
                    rows={2}
                    value={seg.words.map((w) => w.text).join(" ")}
                    onChange={(e) => updateSegmentText(seg.id, e.target.value)}
                    className="w-full resize-none bg-transparent text-sm leading-relaxed outline-none"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
