import { NextResponse } from "next/server";
import { fetchEngineHealth } from "@/lib/voice-engine-client";

export async function GET() {
  const voiceEngine = await fetchEngineHealth();
  return NextResponse.json({
    status: "ok",
    service: "saktts",
    voiceEngine: voiceEngine
      ? {
          ready: voiceEngine.ready,
          loading: voiceEngine.loading ?? false,
          device: voiceEngine.device ?? "unknown",
          model: voiceEngine.model ?? "VoxCPM2",
          sampleRate: voiceEngine.sample_rate ?? 48000,
        }
      : { ready: false, device: "offline" },
    timestamp: new Date().toISOString(),
  });
}
