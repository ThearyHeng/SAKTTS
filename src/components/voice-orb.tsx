import React from "react";
import { VoiceProfile } from "@/lib/voices";

interface VoiceOrbProps {
  orb: VoiceProfile["orb"];
  size?: number;
  className?: string;
}

export function VoiceOrb({ orb, size = 20, className = "" }: VoiceOrbProps) {
  const blurPx = Math.max(1.8, size * 0.12);
  return (
    <span
      aria-hidden="true"
      className={`relative block shrink-0 overflow-hidden rounded-full select-none ${className}`}
      style={{ width: size, height: size, background: orb.base }}
    >
      <span
        className="absolute -inset-1/4"
        style={{
          background: `radial-gradient(circle at 33% 71%, ${orb.primary} 0%, transparent 62%), radial-gradient(circle at 67% 29%, ${orb.secondary} 0%, transparent 48%), linear-gradient(${orb.angle}deg, ${orb.base}, ${orb.primary} 140%)`,
          filter: `blur(${blurPx}px)`,
        }}
      />
    </span>
  );
}
