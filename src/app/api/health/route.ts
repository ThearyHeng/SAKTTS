import { NextResponse } from "next/server";
import { fetchEngineHealth } from "@/lib/voice-engine-client";

export async function GET() {
  const voiceEngine = await fetchEngineHealth(600);
  return NextResponse.json({
    status: "ok",
    service: "saktts",
    voiceEngine: voiceEngine
      ? {
          ready: voiceEngine.ready,
          device: voiceEngine.device ?? "mlx",
          model: voiceEngine.model ?? "mlx-community/VoxCPM2-8bit",
          sampleRate: voiceEngine.sample_rate ?? 48000,
        }
      : { ready: false, device: "offline" },
    timestamp: new Date().toISOString(),
  });
}
