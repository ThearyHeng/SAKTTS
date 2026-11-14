import { NextResponse } from "next/server";
import { fetchEngineHealth } from "@/lib/voice-engine-client";

export async function GET() {
  const voiceEngine = await fetchEngineHealth();
  return NextResponse.json({
    status: "ok",
    service: "saktts",
    defaultModel: "Khmer Natural Voice (48 kHz)",
    voiceEngine: voiceEngine
      ? {
          ready: voiceEngine.ready,
          loading: voiceEngine.loading ?? false,
          device: voiceEngine.device ?? "unknown",
          model: "Khmer Natural Voice",
          engineModel: voiceEngine.model ?? "mlx-community/VoxCPM2-8bit",
          sampleRate: voiceEngine.sample_rate ?? 48000,
        }
      : { ready: false, device: "offline" },
    timestamp: new Date().toISOString(),
  });
}
