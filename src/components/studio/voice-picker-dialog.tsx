"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Play, Plus, Search, Square } from "lucide-react";
import { VoiceProfile } from "@/lib/voices";
import { useStudio } from "@/components/providers";
import { VoiceOrb } from "@/components/voice-orb";
import { ModalDialog } from "@/components/ui/modal-dialog";

interface VoicePickerDialogProps {
  open: boolean;
  onClose: () => void;
  selectedVoiceId?: string;
  onSelect: (voice: VoiceProfile) => void;
}

export function VoicePickerDialog({
  open,
  onClose,
  selectedVoiceId,
  onSelect,
}: VoicePickerDialogProps) {
  const { voices } = useStudio();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"All" | "Khmer" | "English" | "Custom">("All");
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [audioEl, setAudioEl] = useState<HTMLAudioElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return voices.filter((v) => {
      if (filter === "Khmer" && v.language !== "Khmer") return false;
      if (filter === "English" && v.language !== "English") return false;
      if (filter === "Custom" && v.category !== "Cloned" && v.category !== "Designed") {
        return false;
      }
      if (!q) return true;
      return (
        v.name.toLowerCase().includes(q) ||
        v.description.toLowerCase().includes(q) ||
        v.category.toLowerCase().includes(q) ||
        v.language.toLowerCase().includes(q)
      );
    });
  }, [voices, query, filter]);

  const handlePreview = async (e: React.MouseEvent, voice: VoiceProfile) => {
    e.stopPropagation();
    if (playingId === voice.id && audioEl) {
      audioEl.pause();
      setPlayingId(null);
      return;
    }
    if (audioEl) {
      audioEl.pause();
    }

    if (voice.customSampleUrl) {
      const a = new Audio(voice.customSampleUrl);
      a.onended = () => setPlayingId(null);
      setAudioEl(a);
      setPlayingId(voice.id);
      a.play().catch(() => setPlayingId(null));
      return;
    }

    setPreviewingId(voice.id);
    try {
      const res = await fetch("/api/v1/audio/speech?meta=1", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saktts-client": "studio",
        },
        body: JSON.stringify({
          voice: voice.name,
          input:
            voice.language === "English"
              ? `Hi, I am ${voice.name}. Ready for your next voiceover.`
              : `សួស្តី! ខ្ញុំឈ្មោះ ${voice.name}។ នេះជាសំឡេងគំរូរបស់ខ្ញុំ។`,
          skipCredits: true,
        }),
      });
      const data = await res.json();
      if (data.audioUrl) {
        const a = new Audio(data.audioUrl);
        a.onended = () => setPlayingId(null);
        setAudioEl(a);
        setPlayingId(voice.id);
        await a.play();
      }
    } finally {
      setPreviewingId(null);
    }
  };

  return (
    <ModalDialog
      open={open}
      onClose={() => {
        audioEl?.pause();
        setPlayingId(null);
        onClose();
      }}
      title="Explore Voices"
      description="Choose from 23 natural Khmer and English voices, or your custom cloned voices."
      maxWidthClass="max-w-3xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search voices by name, language, or style…"
              autoFocus
              className="bg-foreground/[0.04] border-border/60 focus:ring-foreground/15 h-10 w-full rounded-full border pr-4 pl-10 text-sm outline-none focus:ring-2"
            />
          </div>

          <div className="bg-foreground/[0.05] flex items-center gap-1 rounded-full p-1">
            {(["All", "Khmer", "English", "Custom"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilter(tab)}
                className={`h-8 rounded-full px-3 text-xs font-medium transition-colors ${
                  filter === tab
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2.5 sm:grid-cols-2">
          {filtered.map((voice) => {
            const selected = voice.id === selectedVoiceId;
            const isLoading = previewingId === voice.id;
            const isPlaying = playingId === voice.id;
            return (
              <div
                key={voice.id}
                onClick={() => onSelect(voice)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(voice);
                  }
                }}
                className={`group flex cursor-pointer items-center justify-between gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                  selected
                    ? "border-foreground bg-foreground/[0.05]"
                    : "border-border/60 hover:bg-foreground/[0.04]"
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <VoiceOrb orb={voice.orb} size={36} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-semibold">{voice.name}</span>
                      <span className="bg-foreground/[0.06] text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-medium capitalize">
                        {voice.gender}
                      </span>
                      {(voice.category === "Cloned" || voice.category === "Designed") && (
                        <span className="bg-foreground text-background rounded-full px-2 py-0.5 text-[10px] font-semibold">
                          {voice.category}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-0.5 truncate text-xs">
                      {voice.language}
                      {voice.pitchHz ? ` · ${Math.round(voice.pitchHz)} Hz` : ""} · {voice.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(e) => handlePreview(e, voice)}
                    aria-label={`Preview ${voice.name}`}
                    className="bg-foreground/[0.07] hover:bg-foreground/[0.14] flex h-8 w-8 items-center justify-center rounded-full transition-colors"
                  >
                    {isLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : isPlaying ? (
                      <Square className="h-3 w-3 fill-current" />
                    ) : (
                      <Play className="h-3.5 w-3.5 translate-x-[1px] fill-current" />
                    )}
                  </button>
                  {selected && (
                    <span className="bg-foreground text-background flex h-6 w-6 items-center justify-center rounded-full">
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-border/60 flex items-center justify-between border-t pt-4">
          <p className="text-muted-foreground text-xs">
            Need your own voice? Clone from 10s of audio or design one from text.
          </p>
          <Link
            href="/dashboard/voice-clones"
            onClick={onClose}
            className="bg-primary text-primary-foreground inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-xs font-semibold"
          >
            <Plus className="h-3.5 w-3.5" /> Clone or Design Voice
          </Link>
        </div>
      </div>
    </ModalDialog>
  );
}
