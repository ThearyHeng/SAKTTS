"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, Mic, Plus, Sparkles, Volume2 } from "lucide-react";
import { useStudio } from "@/components/providers";
import { VoiceOrb } from "@/components/voice-orb";
import { WaveformPlayer } from "@/components/waveform-player";
import { VoicePickerDialog } from "@/components/studio/voice-picker-dialog";

export default function VoiceCloningStudioPage() {
  const { voices, customVoices, refreshStore } = useStudio();
  const initialVoice = customVoices[0] ?? voices[0];

  const [selectedVoiceId, setSelectedVoiceId] = useState(initialVoice.id);
  const userPickedRef = useRef(false);
  const [text, setText] = useState(
    "សួស្តី! នេះគឺជាសំឡេងដែលបានក្លូនឡើងវិញ។ Hello, I can speak naturally in both Khmer and English."
  );
  const [matchingMode, setMatchingMode] = useState<"precise" | "natural">("precise");
  const [emotion, setEmotion] = useState<
    "neutral" | "warm" | "calm" | "news" | "energetic" | "whisper"
  >("neutral");
  const [controlInstruction, setControlInstruction] = useState("");
  const [stability, setStability] = useState(1.7);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0);
  const [loading, setLoading] = useState(false);
  const [synthError, setSynthError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[] | undefined>(undefined);
  const [duration, setDuration] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (userPickedRef.current) return;
    try {
      const requestedVoice = new URLSearchParams(window.location.search).get("voice");
      if (requestedVoice) {
        const match = voices.find(
          (v) => v.id === requestedVoice || v.name.toLowerCase() === requestedVoice.toLowerCase()
        );
        if (match) {
          setSelectedVoiceId(match.id);
          return;
        }
      }
    } catch {
      // ignore
    }
    if (customVoices.length > 0 && !customVoices.some((v) => v.id === selectedVoiceId)) {
      setSelectedVoiceId(customVoices[0].id);
    }
  }, [voices, customVoices, selectedVoiceId]);

  const selectedVoice = voices.find((v) => v.id === selectedVoiceId) ?? voices[0];

  const handleSynthesize = async () => {
    if (!text.trim()) {
      setSynthError("Please enter text in Khmer or English to synthesize.");
      return;
    }
    setLoading(true);
    setSynthError(null);
    try {
      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saktts-client": "studio",
        },
        body: JSON.stringify({
          voice: selectedVoice.name,
          input: text,
          speed,
          stability,
          pitch,
          emotion,
          control_instruction: controlInstruction.trim() || undefined,
          matching_mode: matchingMode,
          normalize_text: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to generate cloned speech");
      }
      if (data.audioUrl) {
        setAudioUrl(data.audioUrl);
        setWaveform(data.waveform);
        setDuration(data.durationSec);
        refreshStore();
      }
    } catch (err) {
      setSynthError(err instanceof Error ? err.message : "Failed to generate speech");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Voice Cloning Studio</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Synthesize Khmer and English speech using your custom cloned or designed voices.
          </p>
        </div>
        <Link
          href="/dashboard/voice-clones"
          className="bg-primary text-primary-foreground inline-flex h-10 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold"
        >
          <Plus className="h-4 w-4" /> New Voice Clone
        </Link>
      </div>

      {customVoices.length === 0 && (
        <div className="bg-card border-border/70 flex flex-col items-start justify-between gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <span className="bg-foreground/[0.06] flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
              <Mic className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold">No custom cloned voices yet</p>
              <p className="text-muted-foreground text-xs">
                Clone any voice from 10 seconds of audio or design one from a prompt, or test with
                built-in voices below.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard/voice-clones"
            className="bg-foreground/[0.07] hover:bg-foreground/[0.12] shrink-0 rounded-full px-4 py-2 text-xs font-semibold"
          >
            Create Voice Clone →
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
        <div className="bg-card space-y-4 rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="bg-foreground/[0.06] hover:bg-foreground/[0.1] flex h-10 items-center gap-2.5 rounded-full pr-4 pl-2.5 text-sm font-semibold transition-colors"
            >
              <VoiceOrb orb={selectedVoice.orb} size={24} />
              <span>{selectedVoice.name}</span>
              <span className="text-muted-foreground text-xs font-normal">
                ({selectedVoice.category}
                {selectedVoice.pitchHz ? ` · ${Math.round(selectedVoice.pitchHz)} Hz` : ""})
              </span>
              <ChevronDown className="h-4 w-4 opacity-60" />
            </button>
            <span className="text-muted-foreground font-mono text-xs tabular-nums">
              {text.length} chars
            </span>
          </div>

          <textarea
            aria-label="Voice cloning script"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder="Write a script in Khmer or English for your cloned voice to speak..."
            className="bg-foreground/[0.03] border-border/60 focus:ring-foreground/15 w-full resize-none rounded-2xl border p-4 text-[15.5px] leading-[1.85] outline-none focus:ring-2"
          />

          {synthError && (
            <div
              role="alert"
              className="border-destructive/40 bg-destructive/10 text-destructive rounded-2xl border px-3.5 py-2.5 text-xs font-medium"
            >
              {synthError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <WaveformPlayer
                audioUrl={audioUrl}
                waveform={waveform}
                durationHint={duration}
                autoPlay={true}
                downloadName={`cloned-${selectedVoice.name.toLowerCase()}.mp3`}
              />
            </div>
            <button
              type="button"
              onClick={handleSynthesize}
              disabled={loading || !text.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Cloning Speech…
                </>
              ) : (
                <>
                  <Volume2 className="h-4 w-4" />
                  Generate Cloned Speech
                </>
              )}
            </button>
          </div>
        </div>

        {/* Clone Controls */}
        <div className="bg-card space-y-5 rounded-3xl p-5 ring-1 ring-black/[0.04] dark:ring-white/[0.06]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4" /> VoxCPM2 48 kHz Controls
            </div>
            <span className="bg-foreground/[0.06] text-muted-foreground rounded-full px-2.5 py-0.5 font-mono text-[10px] font-medium">
              {selectedVoice.promptText
                ? "Ultimate"
                : selectedVoice.category === "Designed"
                ? "Voice Design"
                : "Controllable"}
            </span>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Voice matching</p>
            <div className="bg-foreground/[0.06] grid grid-cols-2 rounded-full p-1">
              {(["precise", "natural"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMatchingMode(m)}
                  className={`rounded-full py-1.5 text-xs capitalize transition-colors ${
                    matchingMode === m
                      ? "bg-card font-semibold shadow-xs"
                      : "text-muted-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-medium">Delivery / Emotion</p>
            <div className="flex flex-wrap gap-1.5">
              {(["neutral", "warm", "calm", "news", "energetic", "whisper"] as const).map((em) => (
                <button
                  key={em}
                  type="button"
                  onClick={() => setEmotion(em)}
                  className={`rounded-full px-2.5 py-1 text-[11px] capitalize transition-colors ${
                    emotion === em
                      ? "bg-foreground text-background font-semibold"
                      : "bg-foreground/[0.05] text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="clone-style-override" className="text-xs font-medium">
              Style Control Prompt (optional)
            </label>
            <input
              id="clone-style-override"
              name="controlInstruction"
              aria-describedby="clone-style-hint"
              value={controlInstruction}
              onChange={(e) => setControlInstruction(e.target.value)}
              placeholder={selectedVoice.controlInstruction || "e.g., Warm, calm storytelling tone"}
              className="bg-foreground/[0.04] border-border/60 h-9 w-full rounded-2xl border px-3 text-xs outline-none"
            />
            <p id="clone-style-hint" className="text-muted-foreground text-[11px] leading-snug">
              {selectedVoice.promptText
                ? "Ultimate transcript mode locks directly to reference cadence."
                : "Guides VoxCPM2 emotion, energy, and speaking nuance."}
            </p>
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="clone-pitch-slider">Pitch shift</label>
              <span className="font-mono">{pitch > 0 ? `+${pitch}` : pitch} st</span>
            </div>
            <input
              id="clone-pitch-slider"
              name="pitch"
              type="range"
              min={-5}
              max={5}
              step={0.5}
              value={pitch}
              onChange={(e) => setPitch(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="clone-stability-slider">Stability</label>
              <span className="font-mono">{stability.toFixed(2)}</span>
            </div>
            <input
              id="clone-stability-slider"
              name="stability"
              type="range"
              min={0.1}
              max={2.5}
              step={0.05}
              value={stability}
              onChange={(e) => setStability(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between text-xs">
              <label htmlFor="clone-speed-slider">Speed</label>
              <span className="font-mono">{speed.toFixed(2)}x</span>
            </div>
            <input
              id="clone-speed-slider"
              name="speed"
              type="range"
              min={0.7}
              max={1.2}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              className="w-full"
            />
          </div>
        </div>
      </div>

      <VoicePickerDialog
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        selectedVoiceId={selectedVoice.id}
        onSelect={(v) => {
          userPickedRef.current = true;
          setSelectedVoiceId(v.id);
          setPickerOpen(false);
        }}
      />
    </div>
  );
}
