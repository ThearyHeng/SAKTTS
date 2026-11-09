"use client";

import React, { useEffect, useImperativeHandle, useRef, useState } from "react";
import { Download, Pause, Play, RotateCcw, RotateCw } from "lucide-react";

export interface WaveformPlayerHandle {
  seekTo: (timeSec: number, shouldPlay?: boolean) => void;
}

interface WaveformPlayerProps {
  ref?: React.Ref<WaveformPlayerHandle>;
  audioUrl?: string | null;
  waveform?: number[];
  durationHint?: number;
  autoPlay?: boolean;
  compact?: boolean;
  downloadName?: string;
  onTimeUpdate?: (timeSec: number) => void;
  onPlayStateChange?: (playing: boolean) => void;
}

const DEFAULT_WAVEFORM = [
  32, 48, 62, 45, 72, 86, 65, 48, 76, 92, 64, 52, 70, 82, 58, 40, 66, 88, 74, 56, 42, 69, 81, 50,
  38, 62, 79, 68, 45, 71, 84, 59, 43, 67, 75, 53, 41, 65, 78, 55, 39, 60, 72, 48, 34, 46, 38, 26,
];

export function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function WaveformPlayer({
  ref,
  audioUrl,
  waveform = DEFAULT_WAVEFORM,
  durationHint = 0,
  autoPlay = false,
  compact = false,
  downloadName = "saktts-speech.mp3",
  onTimeUpdate,
  onPlayStateChange,
}: WaveformPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationHint);
  const [playbackRate, setPlaybackRate] = useState(1.0);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onPlayStateChangeRef = useRef(onPlayStateChange);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onPlayStateChangeRef.current = onPlayStateChange;
  }, [onTimeUpdate, onPlayStateChange]);

  useEffect(() => {
    setDuration(durationHint);
  }, [durationHint]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !audioUrl) {
      setPlaying(false);
      setCurrentTime(0);
      onPlayStateChangeRef.current?.(false);
      return;
    }
    setCurrentTime(0);
    setPlaying(false);
    onTimeUpdateRef.current?.(0);
    onPlayStateChangeRef.current?.(false);
    el.load();
    el.playbackRate = playbackRate;
    if (autoPlay) {
      el.play().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl, autoPlay]);

  // Smooth 60fps time telemetry while audio plays for crisp word-by-word selection sync
  useEffect(() => {
    if (!playing) return;
    let rafId = 0;
    const tick = () => {
      const el = audioRef.current;
      if (el && !el.paused) {
        const t = el.currentTime;
        setCurrentTime(t);
        onTimeUpdateRef.current?.(t);
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [playing]);

  useImperativeHandle(
    ref,
    () => ({
      seekTo(timeSec: number, shouldPlay = true) {
        const el = audioRef.current;
        if (!el || !audioUrl) return;
        const maxDur = el.duration && Number.isFinite(el.duration) ? el.duration : duration;
        const clamped = Math.max(0, maxDur > 0 ? Math.min(maxDur, timeSec) : timeSec);
        el.currentTime = clamped;
        setCurrentTime(clamped);
        onTimeUpdateRef.current?.(clamped);
        if (shouldPlay && el.paused) {
          el.play().catch(() => {});
        }
      },
    }),
    [audioUrl, duration]
  );

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el || !audioUrl) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const seekToRatio = (ratio: number) => {
    const el = audioRef.current;
    const total = el?.duration && Number.isFinite(el.duration) ? el.duration : duration;
    if (!el || !total) return;
    const target = Math.max(0, Math.min(total, total * ratio));
    el.currentTime = target;
    setCurrentTime(target);
    onTimeUpdateRef.current?.(target);
  };

  const skip = (delta: number) => {
    const el = audioRef.current;
    if (!el) return;
    const target = Math.max(0, Math.min(el.duration || duration, el.currentTime + delta));
    el.currentTime = target;
    setCurrentTime(target);
    onTimeUpdateRef.current?.(target);
  };

  const cycleSpeed = () => {
    const rates = [1.0, 1.25, 1.5, 0.85];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="flex w-full items-center gap-3">
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          preload="metadata"
          onPlay={() => {
            setPlaying(true);
            onPlayStateChangeRef.current?.(true);
          }}
          onPause={() => {
            setPlaying(false);
            onPlayStateChangeRef.current?.(false);
          }}
          onEnded={() => {
            setPlaying(false);
            setCurrentTime(0);
            onPlayStateChangeRef.current?.(false);
            onTimeUpdateRef.current?.(0);
          }}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;
            if (Number.isFinite(d) && d > 0) setDuration(d);
          }}
          onTimeUpdate={(e) => {
            const t = e.currentTarget.currentTime;
            setCurrentTime(t);
            onTimeUpdateRef.current?.(t);
          }}
        />
      )}

      <button
        type="button"
        onClick={togglePlay}
        disabled={!audioUrl}
        aria-label={playing ? "Pause audio" : "Play audio"}
        className="bg-foreground text-background hover:opacity-90 flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:opacity-40"
      >
        {playing ? (
          <Pause className="h-4 w-4 fill-current" />
        ) : (
          <Play className="h-4 w-4 translate-x-[1px] fill-current" />
        )}
      </button>

      {!compact && (
        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => skip(-5)}
            disabled={!audioUrl}
            aria-label="Back 5 seconds"
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition-colors disabled:opacity-40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => skip(5)}
            disabled={!audioUrl}
            aria-label="Forward 5 seconds"
            className="text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06] flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition-colors disabled:opacity-40"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div
        role="slider"
        tabIndex={0}
        aria-label="Audio progress"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration || 100)}
        aria-valuenow={Math.round(currentTime)}
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          seekToRatio((e.clientX - rect.left) / rect.width);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") skip(2);
          if (e.key === "ArrowLeft") skip(-2);
        }}
        className="flex h-9 flex-1 cursor-pointer items-center gap-[2px] select-none"
      >
        {waveform.map((height, idx) => {
          const barRatio = idx / Math.max(1, waveform.length - 1);
          const active = audioUrl && barRatio <= progress;
          return (
            <span
              key={idx}
              className={`pointer-events-none w-full rounded-full transition-colors duration-150 ${
                active ? "bg-foreground" : "bg-foreground/20"
              }`}
              style={{ height: `${height}%` }}
            />
          );
        })}
      </div>

      <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
        {formatTime(currentTime)}
        {duration > 0 ? ` / ${formatTime(duration)}` : ""}
      </span>

      {!compact && (
        <button
          type="button"
          onClick={cycleSpeed}
          disabled={!audioUrl}
          className="text-muted-foreground hover:text-foreground bg-foreground/[0.05] hover:bg-foreground/[0.1] hidden h-7 rounded-full px-2.5 font-mono text-[11px] font-medium transition-colors sm:inline-flex sm:items-center disabled:opacity-40"
        >
          {playbackRate.toFixed(2).replace(/\.00$/, ".0")}x
        </button>
      )}

      {audioUrl && (
        <a
          href={audioUrl}
          download={downloadName}
          aria-label="Download audio"
          className="text-muted-foreground hover:text-foreground bg-foreground/[0.05] hover:bg-foreground/[0.1] flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors"
        >
          <Download className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}
