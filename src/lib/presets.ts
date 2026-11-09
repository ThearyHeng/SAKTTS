export interface StudioPreset {
  id: string;
  label: string;
  icon: "book" | "messages" | "globe" | "languages" | "zap" | "sparkles" | "bag";
  cast?: string[];
  lines: string[];
}

export const STUDIO_PRESETS: StudioPreset[] = [
  {
    id: "story",
    label: "Tell a story",
    icon: "book",
    lines: [
      "The lighthouse had been dark for thirty years. No keeper, no fuel, no reason for it to work at all. And yet that night, just after the storm broke, the lamp turned once — slowly, deliberately — and swept its beam across the water as if it had never stopped.",
    ],
  },
  {
    id: "bilingual",
    label: "Bilingual dialogue",
    icon: "messages",
    cast: ["Maly", "Borey"],
    lines: [
      "Did you finish the recording for tomorrow's episode? The producer has been asking about it since this morning.",
      "បាទ រួចរាល់ហើយ។ ខ្ញុំគ្រាន់តែត្រូវការពិនិត្យផ្នែកចុងក្រោយម្តងទៀត ព្រោះមានសំឡេងរំខានបន្តិច។",
      "Perfect. Send it over when you're happy with it, and I'll get everything uploaded tonight.",
    ],
  },
  {
    id: "khmer",
    label: "Speak Khmer",
    icon: "globe",
    lines: [
      "សួស្តី! សូមស្វាគមន៍មកកាន់ SAKTTS។ សំឡេងដែលអ្នកកំពុងស្តាប់នេះ ត្រូវបានបង្កើតឡើងដោយបញ្ញាសិប្បនិម្មិត ដោយគ្រាន់តែវាយអត្ថបទចូលប៉ុណ្ណោះ។",
    ],
  },
  {
    id: "switch",
    label: "Switch mid-sentence",
    icon: "languages",
    lines: [
      "Welcome back to the show. ថ្ងៃនេះយើងនឹងនិយាយអំពីបច្ចេកវិទ្យាថ្មី ដែលកំពុងផ្លាស់ប្តូររបៀបដែលយើងធ្វើការជារៀងរាល់ថ្ងៃ។ So grab a coffee, settle in, and let us get started.",
    ],
  },
  {
    id: "sports",
    label: "Call the action",
    icon: "zap",
    lines: [
      "He beats one defender, turns back inside, and beats a second! The keeper is completely stranded now — and there it is, top corner, with barely ten seconds left on the clock. What a way to finish it.",
    ],
  },
  {
    id: "meditation",
    label: "Guide a meditation",
    icon: "sparkles",
    lines: [
      "Close your eyes, and let your breathing slow down on its own. Notice the weight of your shoulders, and let them soften. Whatever you were carrying a moment ago can wait. There is nowhere else you need to be right now.",
    ],
  },
  {
    id: "ad",
    label: "Advertise a product",
    icon: "bag",
    lines: [
      "Introducing the everyday bag that actually fits your life. Light enough that you forget you are carrying it, tough enough to trust with everything that matters. Available now, in four colours.",
    ],
  },
];

export interface SttSegment {
  id: string;
  speaker: string;
  color: string;
  start: number;
  end: number;
  words: { text: string; start: number; end: number }[];
}

export const DEMO_STT_SEGMENTS: SttSegment[] = [
  {
    id: "seg-1",
    speaker: "Speaker 1",
    color: "#3b82f6",
    start: 0.0,
    end: 4.2,
    words: [
      { text: "Welcome", start: 0.0, end: 0.55 },
      { text: "to", start: 0.55, end: 0.78 },
      { text: "SAKTTS.", start: 0.78, end: 1.65 },
      { text: "Let", start: 1.75, end: 2.0 },
      { text: "me", start: 2.0, end: 2.2 },
      { text: "walk", start: 2.2, end: 2.55 },
      { text: "you", start: 2.55, end: 2.8 },
      { text: "through", start: 2.8, end: 3.25 },
      { text: "the", start: 3.25, end: 3.5 },
      { text: "recording.", start: 3.5, end: 4.2 },
    ],
  },
  {
    id: "seg-2",
    speaker: "Speaker 2",
    color: "#10b981",
    start: 4.4,
    end: 8.8,
    words: [
      { text: "Sounds", start: 4.4, end: 4.9 },
      { text: "good", start: 4.9, end: 5.3 },
      { text: "—", start: 5.3, end: 5.5 },
      { text: "I", start: 5.5, end: 5.75 },
      { text: "have", start: 5.75, end: 6.15 },
      { text: "already", start: 6.15, end: 6.8 },
      { text: "uploaded", start: 6.8, end: 7.55 },
      { text: "the", start: 7.55, end: 7.9 },
      { text: "audio", start: 7.9, end: 8.35 },
      { text: "file.", start: 8.35, end: 8.8 },
    ],
  },
  {
    id: "seg-3",
    speaker: "Speaker 3",
    color: "#f59e0b",
    start: 9.0,
    end: 12.0,
    words: [
      { text: "Great,", start: 9.0, end: 9.45 },
      { text: "the", start: 9.45, end: 9.7 },
      { text: "transcript", start: 9.7, end: 10.45 },
      { text: "is", start: 10.45, end: 10.7 },
      { text: "ready", start: 10.7, end: 11.15 },
      { text: "to", start: 11.15, end: 11.4 },
      { text: "export.", start: 11.4, end: 12.0 },
    ],
  },
];
