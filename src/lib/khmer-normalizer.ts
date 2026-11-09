const KHMER_DIGITS = ["សូន្យ", "មួយ", "ពីរ", "បី", "បួន", "ប្រាំ", "ប្រាំមួយ", "ប្រាំពីរ", "ប្រាំបី", "ប្រាំបួន"];

const KHMER_SCALES: [number, string][] = [
  [1_000_000, "លាន"],
  [100_000, "សែន"],
  [10_000, "ម៉ឺន"],
  [1_000, "ពាន់"],
  [100, "រយ"],
];

const KHMER_TENS = [
  "",
  "ដប់",
  "ម្ភៃ",
  "សាមសិប",
  "សែសិប",
  "ហាសិប",
  "ហុកសិប",
  "ចិតសិប",
  "ប៉ែតសិប",
  "កៅសិប",
];

function khmerIntToWords(n: number): string {
  if (n === 0) return KHMER_DIGITS[0];
  if (n < 0) return "ដក" + khmerIntToWords(Math.abs(n));
  let rem = Math.floor(n);
  let out = "";

  for (const [scale, label] of KHMER_SCALES) {
    if (rem >= scale) {
      const q = Math.floor(rem / scale);
      out += khmerIntToWords(q) + label;
      rem %= scale;
    }
  }

  if (rem >= 10) {
    const t = Math.floor(rem / 10);
    out += KHMER_TENS[t];
    rem %= 10;
  }

  if (rem > 0) {
    out += KHMER_DIGITS[rem];
  }

  return out;
}

export function hasKhmerText(text: string): boolean {
  return /[\u1780-\u17FF]/.test(text);
}

/**
 * Normalizes numbers and prices into spoken Khmer when Khmer script is present
 * (e.g., 12.5 -> "ដប់ពីរចុចប្រាំ"), or preserves clean readable spacing.
 */
export function normalizeTextForSpeech(input: string, enabled: boolean): string {
  if (!enabled) return input;
  let out = input;

  // Replace Khmer numerals \u17E0-\u17E9 with ASCII digits first for uniform parsing
  out = out.replace(/[\u17E0-\u17E9]/g, (ch) =>
    String(ch.charCodeAt(0) - 0x17e0)
  );

  if (hasKhmerText(out)) {
    // Currency $12.50 -> ដប់ពីរចុចប្រាំដុល្លារ
    out = out.replace(/\$(\d+(?:\.\d+)?)/g, (_, numStr: string) => {
      return `${decimalToKhmer(numStr)}ដុល្លារ`;
    });
    // Percentages 50% -> ហាសិបភាគរយ
    out = out.replace(/(\d+(?:\.\d+)?)%/g, (_, numStr: string) => {
      return `${decimalToKhmer(numStr)}ភាគរយ`;
    });
    // Plain numbers / decimals
    out = out.replace(/\b(\d+(?:\.\d+)?)\b/g, (_, numStr: string) => {
      return decimalToKhmer(numStr);
    });
  } else {
    out = out.replace(/\$(\d+(?:\.\d+)?)/g, "$1 dollars");
    out = out.replace(/(\d+(?:\.\d+)?)%/g, "$1 percent");
  }

  return out;
}

function decimalToKhmer(numStr: string): string {
  const parts = numStr.split(".");
  const intVal = parseInt(parts[0], 10);
  if (Number.isNaN(intVal)) return numStr;
  let words = khmerIntToWords(intVal);
  if (parts[1]) {
    const fracDigits = parts[1].replace(/0+$/, "") || "0";
    // If single or multi-digit fractional part: read digits or decimal
    if (fracDigits.length === 1) {
      words += "ចុច" + KHMER_DIGITS[parseInt(fracDigits, 10)];
    } else {
      words +=
        "ចុច" +
        fracDigits
          .split("")
          .map((d) => KHMER_DIGITS[parseInt(d, 10)] ?? d)
          .join("");
    }
  }
  return words;
}

export interface SpeechChunk {
  type: "text" | "pause";
  text?: string;
  lang?: "km" | "en";
  pauseMs?: number;
}

/**
 * Splits bilingual text into language-homogeneous chunks and [break=Xs] pauses
 * so Khmer and English phrases switch seamlessly mid-sentence.
 */
export function parseSpeechChunks(input: string): SpeechChunk[] {
  const tokens = input.split(/(\[break=\d+(?:\.\d+)?(?:ms|s)\])/gi);
  const chunks: SpeechChunk[] = [];

  for (const token of tokens) {
    if (!token) continue;
    const pauseMatch = token.match(/^\[break=(\d+(?:\.\d+)?)(ms|s)\]$/i);
    if (pauseMatch) {
      const val = parseFloat(pauseMatch[1]);
      const ms = pauseMatch[2].toLowerCase() === "ms" ? val : val * 1000;
      chunks.push({ type: "pause", pauseMs: Math.min(Math.max(ms, 100), 10000) });
      continue;
    }

    // Split by sentence/script runs so Khmer and English segments get native neural voices
    const segments = token.match(/([\u1780-\u17FF\u19E0-\u19FF\s0-9.,!?;:—\-–"'()]+|[^\u1780-\u17FF\u19E0-\u19FF]+)/g) || [token];
    for (const seg of segments) {
      const trimmed = seg.trim();
      if (!trimmed) continue;
      const isKm = hasKhmerText(trimmed);
      const prev = chunks[chunks.length - 1];
      const lang: "km" | "en" = isKm ? "km" : "en";
      if (prev && prev.type === "text" && prev.lang === lang) {
        prev.text = `${prev.text} ${trimmed}`;
      } else {
        chunks.push({ type: "text", text: trimmed, lang });
      }
    }
  }

  return chunks;
}
