"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Loader2,
  Mic,
  Play,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import { useStudio } from "@/components/providers";
import { VoiceOrb } from "@/components/voice-orb";
import { WaveformPlayer } from "@/components/waveform-player";

export default function VoiceLibraryPage() {
  const { voices, customVoices, refreshStore } = useStudio();
  const [tab, setTab] = useState<"clone" | "design" | "library">("clone");

  // Instant Voice Clone state
  const [cloneName, setCloneName] = useState("");
  const [cloneDesc, setCloneDesc] = useState("");
  const [clonePromptText, setClonePromptText] = useState("");
  const [cloneControlInstruct, setCloneControlInstruct] = useState("");
  const [cloneLang, setCloneLang] = useState<"Bilingual" | "Khmer" | "English">("Bilingual");
  const [cloneGender, setCloneGender] = useState<"auto" | "female" | "male">("auto");
  const [sampleBlob, setSampleBlob] = useState<Blob | File | null>(null);
  const [sampleName, setSampleName] = useState<string>("");
  const [samplePreviewUrl, setSamplePreviewUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSec, setRecordSec] = useState(0);
  const [creatingClone, setCreatingClone] = useState(false);
  const [cloneMessage, setCloneMessage] = useState<string | null>(null);
  const [cloneError, setCloneError] = useState<string | null>(null);
  const [lastCreatedVoice, setLastCreatedVoice] = useState<{
    id: string;
    name: string;
    audioUrl?: string;
    pitchHz?: number;
    gender?: string;
  } | null>(null);

  const mrRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  // Voice Design state
  const [designName, setDesignName] = useState("");
  const [designPrompt, setDesignPrompt] = useState(
    "Warm, calm Cambodian female narrator, natural medium pace, rich studio tone"
  );
  const [designGender, setDesignGender] = useState<"female" | "male">("female");
  const [designLang, setDesignLang] = useState<"Bilingual" | "Khmer" | "English">("Bilingual");
  const [designPitch, setDesignPitch] = useState(0);
  const [designSpeed, setDesignSpeed] = useState(1.0);
  const [creatingDesign, setCreatingDesign] = useState(false);

  // Preview audio
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [engineStatus, setEngineStatus] = useState<{
    ready: boolean;
    loading?: boolean;
    device?: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.voiceEngine) setEngineStatus(d.voiceEngine);
      })
      .catch(() => undefined);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const toggleMicRecord = async () => {
    if (recording) {
      mrRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      setRecordSec(0);
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setSampleBlob(blob);
        setSampleName("mic-reference.webm");
        setSamplePreviewUrl(URL.createObjectURL(blob));
      };
      mrRef.current = mr;
      mr.start();
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setRecordSec((s) => s + 1);
      }, 1000);
    } catch {
      setCloneMessage("Microphone permission is required to record a reference clip.");
    }
  };

  const handleCreateClone = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloneMessage(null);
    setCloneError(null);
    if (!cloneName.trim()) {
      setCloneError("Please enter a Voice Name before creating your clone.");
      document.getElementById("clone-name")?.focus();
      return;
    }
    if (!sampleBlob) {
      setCloneError("Please record or upload 10–30 seconds of reference speech first.");
      return;
    }
    setCreatingClone(true);
    setLastCreatedVoice(null);
    try {
      const fd = new FormData();
      fd.append("mode", "clone");
      fd.append("name", cloneName.trim());
      fd.append("description", cloneDesc.trim());
      fd.append("language", cloneLang);
      if (cloneGender !== "auto") fd.append("gender", cloneGender);
      if (clonePromptText.trim()) fd.append("promptText", clonePromptText.trim());
      if (cloneControlInstruct.trim()) fd.append("controlInstruction", cloneControlInstruct.trim());
      fd.append("file", sampleBlob, sampleName || "reference.webm");

      const res = await fetch("/api/voice-clones", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to clone voice");
      await refreshStore();
      setCloneName("");
      setCloneDesc("");
      setClonePromptText("");
      setCloneControlInstruct("");
      setSampleBlob(null);
      setSamplePreviewUrl(null);
      const pitchNote = data.voice?.pitchHz
        ? ` · ${Math.round(data.voice.pitchHz)} Hz (${data.voice.gender})`
        : "";
      setCloneMessage(
        `Khmer Natural Voice 48 kHz clone saved: ${data.voice.name}${pitchNote}. Ready to speak Khmer & English.`
      );
      setLastCreatedVoice({
        id: data.voice.id,
        name: data.voice.name,
        audioUrl: data.voice.customSampleUrl,
        pitchHz: data.voice.pitchHz,
        gender: data.voice.gender,
      });
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "Voice cloning failed");
    } finally {
      setCreatingClone(false);
    }
  };

  const handleCreateDesign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCloneMessage(null);
    setCloneError(null);
    if (!designName.trim()) {
      setCloneError("Please enter a Voice Name before designing a voice.");
      document.getElementById("design-name")?.focus();
      return;
    }
    setCreatingDesign(true);
    try {
      const res = await fetch("/api/voice-clones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "design",
          name: designName.trim(),
          prompt: designPrompt.trim(),
          gender: designGender,
          language: designLang,
          pitch: designPitch,
          speed: designSpeed,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Voice design failed");
      await refreshStore();
      setDesignName("");
      setCloneMessage(`Designed voice created: ${data.voice.name}`);
      setLastCreatedVoice({
        id: data.voice.id,
        name: data.voice.name,
        audioUrl: data.voice.customSampleUrl,
        gender: data.voice.gender,
      });
    } catch (err) {
      setCloneError(err instanceof Error ? err.message : "Voice design failed");
    } finally {
      setCreatingDesign(false);
    }
  };

  const deleteCustomVoice = async (id: string) => {
    await fetch(`/api/voice-clones?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    refreshStore();
  };

  const playVoice = async (vId: string, name: string, sampleUrl?: string) => {
    if (playingId === vId && audioRef.current) {
      audioRef.current.pause();
      setPlayingId(null);
      return;
    }
    audioRef.current?.pause();
    if (sampleUrl) {
      const a = new Audio(sampleUrl);
      a.onended = () => setPlayingId(null);
      audioRef.current = a;
      setPlayingId(vId);
      a.play().catch(() => setPlayingId(null));
      return;
    }
    setPlayingId(vId);
    const res = await fetch("/api/v1/audio/speech?meta=1", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-saktts-client": "studio" },
      body: JSON.stringify({
        voice: name,
        input: `សួស្តី! នេះជាសំឡេងរបស់ ${name}។ Hello from SAKTTS.`,
        skipCredits: true,
      }),
    });
    const data = await res.json();
    if (data.audioUrl) {
      const a = new Audio(data.audioUrl);
      a.onended = () => setPlayingId(null);
      audioRef.current = a;
      a.play().catch(() => setPlayingId(null));
    } else {
      setPlayingId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Voice Clones & Library
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Clone a voice from 10 seconds of audio, design a new voice from a prompt, or browse all{" "}
            {voices.length} voices.
          </p>
        </div>

        <div className="bg-foreground/[0.06] flex w-fit rounded-full p-1">
          {(
            [
              { id: "clone", label: "Clone a Voice" },
              { id: "design", label: "Voice Design" },
              { id: "library", label: `All Voices (${voices.length})` },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`h-9 rounded-full px-4 text-xs font-semibold transition-colors ${
                tab === item.id
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {engineStatus && !engineStatus.ready && (
        <div
          role="status"
          className="border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-2.5 text-xs font-medium"
        >
          <span>
            Khmer Natural Voice 48 kHz engine is offline on this host — cloning uses Edge TTS fallback until{" "}
            <code className="font-mono">SAKTTS_VOICE_ENGINE_URL</code> is connected.
          </span>
          <span className="font-mono opacity-80">device: {engineStatus.device || "offline"}</span>
        </div>
      )}

      {cloneError && (
        <div
          role="alert"
          className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium"
        >
          {cloneError}
        </div>
      )}

      {cloneMessage && (
        <div
          role="status"
          aria-live="polite"
          className="bg-card border-border/70 space-y-3 rounded-2xl border px-4 py-3 text-sm font-medium"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Check className="h-4 w-4 text-emerald-500" />
              {cloneMessage}
            </span>
            {lastCreatedVoice && (
              <Link
                href={`/dashboard/voice-cloning?voice=${encodeURIComponent(lastCreatedVoice.id)}`}
                className="bg-foreground text-background inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold"
              >
                Open in Cloning Studio →
              </Link>
            )}
          </div>
          {lastCreatedVoice?.audioUrl && (
            <WaveformPlayer
              audioUrl={lastCreatedVoice.audioUrl}
              compact={true}
              downloadName={`${lastCreatedVoice.name.toLowerCase()}-preview.mp3`}
            />
          )}
        </div>
      )}

      {tab === "clone" && (
        <form
          onSubmit={handleCreateClone}
          noValidate
          className="bg-card grid gap-6 rounded-3xl p-6 ring-1 ring-black/[0.04] lg:grid-cols-2 dark:ring-white/[0.06]"
        >
          <div className="space-y-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Mic className="h-4 w-4" /> 1. Record or upload reference audio
            </h2>
            <p id="clone-upload-hint" className="text-muted-foreground text-xs leading-relaxed">
              Provide 10–30 seconds of clean speech without background music. SAKTTS measures true
              pitch (F0 Hz) and clones vocal timbre natively at 48 kHz using Khmer Natural Voice Neural AI.
            </p>

            <div className="bg-foreground/[0.03] border-border/70 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  type="button"
                  onClick={toggleMicRecord}
                  className={`inline-flex h-10 items-center gap-2 rounded-full px-5 text-xs font-semibold transition-all ${
                    recording
                      ? "bg-destructive text-destructive-foreground animate-pulse"
                      : "bg-primary text-primary-foreground"
                  }`}
                >
                  {recording ? (
                    <>
                      <Square className="h-3.5 w-3.5 fill-current" />
                      Stop ({recordSec}s)
                    </>
                  ) : (
                    <>
                      <Mic className="h-4 w-4" />
                      Record Microphone
                    </>
                  )}
                </button>

                <label className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 text-xs font-medium">
                  <Upload className="h-4 w-4" /> Upload Audio
                  <input
                    type="file"
                    name="file"
                    aria-describedby="clone-upload-hint"
                    accept="audio/*,.mp3,.wav,.m4a,.webm"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) {
                        setSampleBlob(f);
                        setSampleName(f.name);
                        setSamplePreviewUrl(URL.createObjectURL(f));
                        setCloneError(null);
                      }
                    }}
                  />
                </label>
              </div>

              {sampleName && (
                <p className="text-foreground text-xs font-medium">Selected: {sampleName}</p>
              )}
            </div>

            {samplePreviewUrl && (
              <WaveformPlayer
                audioUrl={samplePreviewUrl}
                compact={true}
                downloadName={sampleName || "sample.webm"}
              />
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">2. Name & configure profile</h2>

            <div className="space-y-1.5">
              <label htmlFor="clone-name" className="text-xs font-medium">
                Voice Name
              </label>
              <input
                id="clone-name"
                name="name"
                required
                aria-invalid={cloneError && !cloneName.trim() ? "true" : undefined}
                value={cloneName}
                onChange={(e) => {
                  setCloneName(e.target.value);
                  if (cloneError) setCloneError(null);
                }}
                placeholder="e.g., Sophea Studio Voice"
                className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3.5 text-sm outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="clone-lang" className="text-xs font-medium">
                  Primary Language
                </label>
                <select
                  id="clone-lang"
                  name="language"
                  value={cloneLang}
                  onChange={(e) =>
                    setCloneLang(e.target.value as "Bilingual" | "Khmer" | "English")
                  }
                  className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3 text-sm outline-none"
                >
                  <option value="Bilingual">Bilingual (KM + EN)</option>
                  <option value="Khmer">Khmer</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="clone-gender" className="text-xs font-medium">
                  Vocal Register
                </label>
                <select
                  id="clone-gender"
                  name="gender"
                  value={cloneGender}
                  onChange={(e) =>
                    setCloneGender(e.target.value as "auto" | "female" | "male")
                  }
                  className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3 text-sm outline-none"
                >
                  <option value="auto">Auto-detect</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="clone-desc" className="text-xs font-medium">
                Voice Description (optional)
              </label>
              <input
                id="clone-desc"
                name="description"
                value={cloneDesc}
                onChange={(e) => setCloneDesc(e.target.value)}
                placeholder="Warm conversational narrator for podcasts"
                className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3.5 text-sm outline-none"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="clone-control-instruct" className="text-xs font-medium">
                Style / Control Instruction (optional)
              </label>
              <input
                id="clone-control-instruct"
                name="controlInstruction"
                aria-describedby="clone-control-hint"
                value={cloneControlInstruct}
                onChange={(e) => setCloneControlInstruct(e.target.value)}
                placeholder="e.g., Warm, calm storytelling delivery"
                className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3.5 text-sm outline-none"
              />
              <p id="clone-control-hint" className="text-muted-foreground text-[11px]">
                Shapes emotion, pace, and tone in Khmer Natural Voice Controllable Cloning.
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="clone-prompt-text" className="text-xs font-medium">
                Reference Transcript — Ultimate Hi-Fi Mode (optional)
              </label>
              <textarea
                id="clone-prompt-text"
                name="promptText"
                rows={2}
                aria-describedby="clone-prompt-hint"
                value={clonePromptText}
                onChange={(e) => setClonePromptText(e.target.value)}
                placeholder="Paste the exact spoken words in your reference audio to enable Ultimate continuation cloning…"
                className="bg-foreground/[0.04] border-border/60 w-full resize-y rounded-2xl border p-3 text-sm outline-none"
              />
              <p id="clone-prompt-hint" className="text-muted-foreground text-[11px]">
                Leave blank for Controllable Cloning; fill exact transcript for maximum accent & cadence fidelity.
              </p>
            </div>

            <button
              type="submit"
              disabled={creatingClone}
              className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 w-full items-center justify-center gap-2 rounded-full text-sm font-semibold disabled:opacity-50"
            >
              {creatingClone ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing & Rendering Neural Preview…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create Voice Clone
                </>
              )}
            </button>
          </div>
        </form>
      )}

      {tab === "design" && (
        <form
          onSubmit={handleCreateDesign}
          noValidate
          className="bg-card space-y-5 rounded-3xl p-6 ring-1 ring-black/[0.04] dark:ring-white/[0.06]"
        >
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Wand2 className="h-4 w-4" /> Design a Voice from Words (Khmer Natural Voice 48 kHz)
            </h2>
            <p className="text-muted-foreground mt-1 text-xs">
              Describe tone, age, pace, and mood — Khmer Natural Voice generates a brand-new 48 kHz voice
              directly from your prompt without needing any audio upload.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label htmlFor="design-name" className="text-xs font-medium">
                Voice Name
              </label>
              <input
                id="design-name"
                name="name"
                required
                aria-invalid={cloneError && !designName.trim() ? "true" : undefined}
                value={designName}
                onChange={(e) => {
                  setDesignName(e.target.value);
                  if (cloneError) setCloneError(null);
                }}
                placeholder="e.g., Angkor Storyteller"
                className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3.5 text-sm outline-none"
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="design-gender" className="text-xs font-medium">
                Gender
              </label>
              <select
                id="design-gender"
                value={designGender}
                onChange={(e) => setDesignGender(e.target.value as "female" | "male")}
                className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3 text-sm outline-none"
              >
                <option value="female">Female</option>
                <option value="male">Male</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="design-lang" className="text-xs font-medium">
                Language
              </label>
              <select
                id="design-lang"
                value={designLang}
                onChange={(e) =>
                  setDesignLang(e.target.value as "Bilingual" | "Khmer" | "English")
                }
                className="bg-foreground/[0.04] border-border/60 h-10 w-full rounded-2xl border px-3 text-sm outline-none"
              >
                <option value="Bilingual">Bilingual (KM + EN)</option>
                <option value="Khmer">Khmer</option>
                <option value="English">English</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="design-prompt" className="text-xs font-medium">
              Voice Description Prompt
            </label>
            <textarea
              id="design-prompt"
              name="prompt"
              rows={3}
              value={designPrompt}
              onChange={(e) => setDesignPrompt(e.target.value)}
              className="bg-foreground/[0.04] border-border/60 w-full resize-y rounded-2xl border p-3.5 text-sm outline-none"
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="design-pitch">Tone Pitch</label>
                <span className="font-mono">{designPitch > 0 ? `+${designPitch}` : designPitch} st</span>
              </div>
              <input
                id="design-pitch"
                name="pitch"
                type="range"
                min={-4}
                max={4}
                step={0.5}
                value={designPitch}
                onChange={(e) => setDesignPitch(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <label htmlFor="design-speed">Speaking Pace</label>
                <span className="font-mono">{designSpeed.toFixed(2)}x</span>
              </div>
              <input
                id="design-speed"
                name="speed"
                type="range"
                min={0.8}
                max={1.2}
                step={0.05}
                value={designSpeed}
                onChange={(e) => setDesignSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={creatingDesign}
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold disabled:opacity-50"
          >
            {creatingDesign ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating & Saving Voice…
              </>
            ) : (
              <>
                <Wand2 className="h-4 w-4" />
                Design & Save Voice
              </>
            )}
          </button>
        </form>
      )}

      {/* Custom Cloned & Designed Voices Section */}
      {customVoices.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Your Custom Voices ({customVoices.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {customVoices.map((v) => (
              <div
                key={v.id}
                className="bg-card border-border/60 flex flex-col justify-between gap-4 rounded-3xl border p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <VoiceOrb orb={v.orb} size={38} />
                    <div>
                      <p className="text-sm font-semibold">{v.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {v.category} · {v.language} · {v.gender}
                        {v.pitchHz ? ` · ${Math.round(v.pitchHz)} Hz` : ""}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteCustomVoice(v.id)}
                    aria-label={`Delete ${v.name}`}
                    className="text-muted-foreground hover:text-destructive p-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-muted-foreground text-xs leading-relaxed">{v.description}</p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => playVoice(v.id, v.name, v.customSampleUrl)}
                    className="bg-foreground/[0.06] hover:bg-foreground/[0.11] inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium"
                  >
                    {playingId === v.id ? (
                      <Square className="h-3 w-3 fill-current" />
                    ) : (
                      <Play className="h-3 w-3 fill-current" />
                    )}
                    Preview
                  </button>
                  <Link
                    href={`/dashboard/voice-cloning?voice=${encodeURIComponent(v.id)}`}
                    className="bg-foreground text-background inline-flex h-8 items-center rounded-full px-3.5 text-xs font-semibold"
                  >
                    Use Voice
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Full Library Grid when Library tab or below */}
      {(tab === "library" || customVoices.length === 0) && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Built-in SAKTTS Voice Library ({voices.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {voices.map((v) => (
              <div
                key={v.id}
                className="bg-card border-border/60 flex items-center justify-between gap-3 rounded-2xl border p-3.5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <VoiceOrb orb={v.orb} size={34} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{v.name}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {v.language} · {v.gender} · {v.category}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => playVoice(v.id, v.name, v.customSampleUrl)}
                  aria-label={`Play ${v.name}`}
                  className="bg-foreground/[0.06] hover:bg-foreground/[0.12] flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
                >
                  {playingId === v.id ? (
                    <Square className="h-3 w-3 fill-current" />
                  ) : (
                    <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
