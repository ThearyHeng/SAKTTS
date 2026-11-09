import { NextResponse } from "next/server";
import { getAllVoices } from "@/lib/store";

export async function GET() {
  const voices = getAllVoices();
  return NextResponse.json({
    object: "list",
    data: voices.map((v) => ({
      id: v.id,
      name: v.name,
      gender: v.gender,
      language: v.language,
      category: v.category,
      description: v.description,
      is_default: !!v.isDefault,
      ref_text: v.refText,
      orb: v.orb,
      custom_sample_url: v.customSampleUrl ?? null,
      reference_sample_url: v.referenceSampleUrl ?? null,
      pitch_hz: v.pitchHz ?? null,
      engine: v.engine ?? (v.category === "Cloned" ? "voxcpm2" : "edge-tts"),
      prompt_text: v.promptText ?? null,
      control_instruction: v.controlInstruction ?? null,
      design_prompt: v.designPrompt ?? null,
      created_at: v.createdAt ?? null,
    })),
  });
}
