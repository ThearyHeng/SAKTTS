import type { HistoryItem } from "./store";
import type { SttSegment } from "./presets";
import { buildParagraphTimeline, type SpeechCue } from "./text-alignment";

export interface SubtitleWord {
  text: string;
  leadingSep?: string;
  startSec: number;
  endSec: number;
}

export interface SubtitleCue {
  id: string;
  index: number;
  startSec: number;
  endSec: number;
  text: string;
  lines: string[];
  speaker?: string;
  words?: SubtitleWord[];
}

export interface SubtitleBuildOptions {
  maxCharsPerLine: number;
  maxLines: 1 | 2;
  minCueSec: number;
  maxCueSec: number;
  offsetMs: number;
  includeSpeaker: boolean;
}

export const DEFAULT_SUBTITLE_OPTIONS: SubtitleBuildOptions = {
  maxCharsPerLine: 40,
  maxLines: 2,
  minCueSec: 1.0,
  maxCueSec: 5.5,
  offsetMs: 0,
  includeSpeaker: false,
};

export type SubtitleExportFormat = "srt" | "vtt" | "ass" | "txt" | "json";

const BREAK_TAG_RE = /\[break=\d+(?:\.\d+)?(?:ms|s)\]/gi;
const ATTACH_PUNCT_RE = /^[.,!?;:\u17D4\u17D5\u17D6\u17D7\u17D9\u17DA"')\]}…–—]+$/;
const SENTENCE_END_RE = /[.!?\u17D4\u17D5…]$/;
const CLAUSE_PAUSE_RE = /[,;:\u17D6\u2014]$/;

let cachedKmSegmenter: Intl.Segmenter | null | undefined;

function getKmSegmenter(): Intl.Segmenter | null {
  if (cachedKmSegmenter !== undefined) return cachedKmSegmenter;
  try {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      cachedKmSegmenter = new Intl.Segmenter("km", { granularity: "word" });
    } else {
      cachedKmSegmenter = null;
    }
  } catch {
    cachedKmSegmenter = null;
  }
  return cachedKmSegmenter;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function stripBreakTags(text: string): string {
  return text.replace(BREAK_TAG_RE, " ").replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Estimates horizontal visual display width so Khmer subscript clusters (\u17D2)
 * and stacked vowels (\u17B7-\u17BD, \u17C6, etc.) don't trigger false early wrapping.
 */
export function visualTextLength(text: string): number {
  let width = 0;
  for (const ch of text) {
    if (/[\u200B-\u200D\uFEFF\u17D2]/.test(ch)) continue;
    if (/[\u17B7-\u17BD\u17C6\u17C9-\u17D1\u17DD]/.test(ch)) {
      width += 0.25;
    } else {
      width += 1;
    }
  }
  return Math.ceil(width);
}

interface RawWordPiece {
  text: string;
  leadingSep: string;
  startChar: number;
  endChar: number;
  weight: number;
}

function estimateTokenWeight(token: string): number {
  const base = token.replace(/[\u17D2\s\u200B-\u200D\uFEFF.,!?;:\u17D4-\u17DA]/g, "");
  return Math.max(1, base.length);
}

/**
 * Segments raw text into Khmer/English word tokens while strictly preserving
 * authentic whitespace/separator behavior (never inserts artificial spaces inside Khmer runs).
 */
export function segmentSubtitleTokens(rawText: string): RawWordPiece[] {
  const clean = stripBreakTags(rawText);
  if (!clean) return [];

  const tokens: RawWordPiece[] = [];
  const seg = getKmSegmenter();

  if (seg) {
    let prevEnd = 0;
    for (const part of seg.segment(clean)) {
      const s = part.index;
      const e = s + part.segment.length;
      const segText = part.segment;

      if (/^[\s\u200B\uFEFF]+$/.test(segText)) {
        continue;
      }

      const rawGap = clean.slice(prevEnd, s);
      const hasSpace = /[ \t\n\r]/.test(rawGap);
      const leadingSep = tokens.length === 0 ? "" : hasSpace ? " " : "";

      if (ATTACH_PUNCT_RE.test(segText) && tokens.length > 0) {
        const last = tokens[tokens.length - 1];
        last.text += (hasSpace ? " " : "") + segText;
        last.endChar = e;
        prevEnd = e;
        continue;
      }

      tokens.push({
        text: segText,
        leadingSep,
        startChar: s,
        endChar: e,
        weight: estimateTokenWeight(segText),
      });
      prevEnd = e;
    }
  } else {
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(clean)) !== null) {
      tokens.push({
        text: m[0],
        leadingSep: tokens.length === 0 ? "" : " ",
        startChar: m.index,
        endChar: m.index + m[0].length,
        weight: estimateTokenWeight(m[0]),
      });
    }
  }

  return tokens;
}

function joinWordsCleanly(words: Array<{ text: string; leadingSep?: string }>): string {
  let out = "";
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (i === 0) {
      out += w.text;
    } else {
      out += (w.leadingSep ?? "") + w.text;
    }
  }
  return out.trim();
}

/**
 * Wraps subtitle words across 1 or 2 visually balanced lines without splitting Khmer words.
 */
export function wrapWordsIntoLines(
  words: Array<{ text: string; leadingSep?: string }>,
  maxCharsPerLine: number,
  maxLines: 1 | 2
): string[] {
  if (words.length === 0) return [];
  const full = joinWordsCleanly(words);
  if (maxLines === 1 || visualTextLength(full) <= maxCharsPerLine || words.length === 1) {
    return [full];
  }

  // Pick word split index closest to half the visual width while fitting line 1 <= maxCharsPerLine
  const fullVis = visualTextLength(full);
  const targetHalf = fullVis / 2;
  let bestSplit = -1;
  let bestScore = Infinity;

  for (let i = 1; i < words.length; i++) {
    const l1 = joinWordsCleanly(words.slice(0, i));
    const l2 = joinWordsCleanly(words.slice(i));
    const v1 = visualTextLength(l1);
    const v2 = visualTextLength(l2);
    const overflowPenalty =
      (v1 > maxCharsPerLine ? (v1 - maxCharsPerLine) * 8 : 0) +
      (v2 > maxCharsPerLine ? (v2 - maxCharsPerLine) * 8 : 0);
    const pauseBonus = CLAUSE_PAUSE_RE.test(l1) || SENTENCE_END_RE.test(l1) ? -4 : 0;
    const balanceDiff = Math.abs(v1 - targetHalf);
    const score = balanceDiff + overflowPenalty + pauseBonus;
    if (score < bestScore) {
      bestScore = score;
      bestSplit = i;
    }
  }

  if (bestSplit <= 0) return [full];
  const line1 = joinWordsCleanly(words.slice(0, bestSplit));
  const line2 = joinWordsCleanly(words.slice(bestSplit));
  return line2 ? [line1, line2] : [line1];
}

export function wrapPlainTextLines(
  text: string,
  maxCharsPerLine: number,
  maxLines: 1 | 2
): string[] {
  const manualLines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (manualLines.length >= 2 && maxLines === 2) {
    return manualLines.slice(0, 2);
  }
  const tokens = segmentSubtitleTokens(text);
  return wrapWordsIntoLines(tokens, maxCharsPerLine, maxLines);
}

/**
 * Groups chronologically timed words into crisp subtitle cues respecting
 * reading capacity, max/min duration, and natural punctuation breaks.
 */
export function chunkTimedWordsIntoCues(
  words: SubtitleWord[],
  options: Partial<SubtitleBuildOptions> = {},
  speaker?: string
): SubtitleCue[] {
  const opts = { ...DEFAULT_SUBTITLE_OPTIONS, ...options };
  if (words.length === 0) return [];

  const maxCap = Math.max(16, opts.maxCharsPerLine * opts.maxLines);
  const cues: SubtitleCue[] = [];
  let bucket: SubtitleWord[] = [];

  const flushBucket = (nextStartSec?: number) => {
    if (bucket.length === 0) return;
    const rawStart = Math.max(0, bucket[0].startSec);
    let rawEnd = Math.max(rawStart + 0.15, bucket[bucket.length - 1].endSec);

    if (rawEnd - rawStart < opts.minCueSec) {
      const targetEnd = rawStart + opts.minCueSec;
      rawEnd = nextStartSec !== undefined ? Math.min(nextStartSec - 0.02, targetEnd) : targetEnd;
      rawEnd = Math.max(rawStart + 0.18, rawEnd);
    }

    const lines = wrapWordsIntoLines(bucket, opts.maxCharsPerLine, opts.maxLines);
    const text = lines.join("\n");
    cues.push({
      id: `sub-${cues.length + 1}`,
      index: cues.length + 1,
      startSec: round3(rawStart),
      endSec: round3(rawEnd),
      text,
      lines,
      ...(speaker ? { speaker } : {}),
      words: bucket.map((w, idx) => ({
        ...w,
        leadingSep: idx === 0 ? "" : w.leadingSep ?? "",
      })),
    });
    bucket = [];
  };

  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (bucket.length === 0) {
      bucket.push({ ...w, leadingSep: "" });
      continue;
    }

    const pauseGap = w.startSec - bucket[bucket.length - 1].endSec;
    const candidate = [...bucket, w];
    const candidateStr = joinWordsCleanly(candidate);
    const candidateVis = visualTextLength(candidateStr);
    const currentDur = bucket[bucket.length - 1].endSec - bucket[0].startSec;
    const nextDur = w.endSec - bucket[0].startSec;
    const prevText = bucket[bucket.length - 1].text;
    const endedSentence = SENTENCE_END_RE.test(prevText);

    const shouldSplitBefore =
      pauseGap > 0.72 ||
      candidateVis > maxCap ||
      nextDur > opts.maxCueSec ||
      (endedSentence && currentDur >= Math.max(0.8, opts.minCueSec * 0.85)) ||
      (CLAUSE_PAUSE_RE.test(prevText) &&
        visualTextLength(joinWordsCleanly(bucket)) >= Math.floor(maxCap * 0.6) &&
        currentDur >= opts.minCueSec);

    if (shouldSplitBefore) {
      flushBucket(w.startSec);
      bucket.push({ ...w, leadingSep: "" });
    } else {
      bucket.push(w);
    }
  }

  flushBucket();
  return normalizeCueTimeline(cues, opts.offsetMs);
}

/**
 * Ensures monotonic, non-overlapping cue indices and optional global timing offset.
 */
export function normalizeCueTimeline(cues: SubtitleCue[], offsetMs = 0): SubtitleCue[] {
  const offsetSec = offsetMs / 1000;
  const shifted = cues
    .map((c, idx) => {
      const startSec = Math.max(0, round3(c.startSec + offsetSec));
      const endSec = Math.max(startSec + 0.15, round3(c.endSec + offsetSec));
      return {
        ...c,
        id: c.id || `sub-${idx + 1}`,
        index: idx + 1,
        startSec,
        endSec,
        words: c.words?.map((w) => {
          const ws = Math.max(0, round3(w.startSec + offsetSec));
          return {
            ...w,
            startSec: ws,
            endSec: Math.max(ws + 0.04, round3(w.endSec + offsetSec)),
          };
        }),
      };
    })
    .sort((a, b) => a.startSec - b.startSec);

  for (let i = 1; i < shifted.length; i++) {
    const prev = shifted[i - 1];
    const curr = shifted[i];
    if (prev.endSec > curr.startSec - 0.02) {
      if (curr.startSec - prev.startSec >= 0.25) {
        prev.endSec = round3(Math.max(prev.startSec + 0.15, curr.startSec - 0.02));
      } else {
        curr.startSec = round3(prev.endSec + 0.02);
        curr.endSec = Math.max(curr.startSec + 0.2, curr.endSec);
      }
    }
  }

  return shifted.map((c, idx) => ({ ...c, index: idx + 1 }));
}

function buildTimedWordsForParagraph(
  paragraphText: string,
  pIndex: number,
  cues: SpeechCue[] | undefined,
  durationSec: number
): SubtitleWord[] {
  const tokens = segmentSubtitleTokens(paragraphText);
  if (tokens.length === 0) return [];

  const cleanText = stripBreakTags(paragraphText);
  const paraCues = (cues ?? []).filter((c) => c.paragraphIndex === pIndex && c.text.trim());

  if (paraCues.length > 0) {
    const timeline = buildParagraphTimeline(cleanText, pIndex, paraCues, durationSec);
    if (timeline.words.length > 0) {
      // Align our clean segmented tokens onto word timeline spans
      const result: SubtitleWord[] = [];
      let tlCursor = 0;
      const fallbackStart = paraCues[0].startSec;
      const fallbackEnd = paraCues[paraCues.length - 1].endSec;

      for (const tk of tokens) {
        while (
          tlCursor < timeline.words.length - 1 &&
          timeline.words[tlCursor].endChar <= tk.startChar
        ) {
          tlCursor++;
        }
        const matched = timeline.words[tlCursor];
        if (
          matched &&
          tk.startChar < matched.endChar &&
          tk.endChar > matched.startChar
        ) {
          result.push({
            text: tk.text,
            leadingSep: tk.leadingSep,
            startSec: matched.startSec,
            endSec: matched.endSec,
          });
        } else {
          const prevEnd =
            result.length > 0 ? result[result.length - 1].endSec : fallbackStart;
          const totalW = tokens.reduce((a, t) => a + t.weight, 0);
          const span = Math.max(0.4, fallbackEnd - fallbackStart);
          const dur = (tk.weight / totalW) * span;
          result.push({
            text: tk.text,
            leadingSep: tk.leadingSep,
            startSec: round3(prevEnd),
            endSec: round3(prevEnd + Math.max(0.08, dur)),
          });
        }
      }
      return result;
    }
  }

  // Fallback proportional weight distribution when no cues are present
  const totalWeight = tokens.reduce((acc, t) => acc + t.weight, 0);
  const safeDur = Math.max(1.2, durationSec);
  let acc = 0;
  return tokens.map((tk) => {
    const startSec = round3((acc / totalWeight) * safeDur);
    acc += tk.weight;
    const endSec = round3((acc / totalWeight) * safeDur);
    return {
      text: tk.text,
      leadingSep: tk.leadingSep,
      startSec,
      endSec: Math.max(startSec + 0.08, endSec),
    };
  });
}

/**
 * Builds subtitles directly from any existing SAKTTS Studio HistoryItem (TTS, Voice Clone, or STT).
 */
export function generateSubtitlesFromHistoryItem(
  item: HistoryItem,
  options: Partial<SubtitleBuildOptions> = {}
): SubtitleCue[] {
  const opts = { ...DEFAULT_SUBTITLE_OPTIONS, ...options };

  // STT items with speaker segments
  if (item.segments && item.segments.length > 0) {
    const allCues: SubtitleCue[] = [];
    for (const seg of item.segments) {
      const segWords: SubtitleWord[] = seg.words.map((w, idx) => ({
        text: w.text,
        leadingSep:
          idx === 0
            ? ""
            : /^[\u1780-\u17FF]+$/.test(w.text) &&
              /^[\u1780-\u17FF]+$/.test(seg.words[idx - 1]?.text || "")
            ? ""
            : " ",
        startSec: w.start,
        endSec: w.end,
      }));
      const segCues = chunkTimedWordsIntoCues(
        segWords,
        { ...opts, offsetMs: 0 },
        opts.includeSpeaker ? seg.speaker : undefined
      );
      allCues.push(...segCues);
    }
    return normalizeCueTimeline(allCues, opts.offsetMs);
  }

  // Multi-paragraph TTS / Voice Clone items
  const rawParagraphs = (item.text || "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  if (rawParagraphs.length === 0) return [];

  if (rawParagraphs.length === 1 || !(item.cues && item.cues.length > 0)) {
    const singleDur = Math.max(1.2, item.durationSec || 5);
    const words = buildTimedWordsForParagraph(item.text, 0, item.cues, singleDur);
    return chunkTimedWordsIntoCues(words, opts);
  }

  const totalDur = Math.max(1.5, item.durationSec || 5);
  const totalChars = rawParagraphs.reduce((s, p) => s + Math.max(1, stripBreakTags(p).length), 0);
  let fallbackCursor = 0;
  const combinedWords: SubtitleWord[] = [];

  for (let pIndex = 0; pIndex < rawParagraphs.length; pIndex++) {
    const p = rawParagraphs[pIndex];
    const paraCues = (item.cues ?? []).filter((c) => c.paragraphIndex === pIndex);
    const estDur = (Math.max(1, stripBreakTags(p).length) / totalChars) * totalDur;

    const pWords = buildTimedWordsForParagraph(p, pIndex, paraCues, estDur);
    if (paraCues.length === 0) {
      for (const w of pWords) {
        combinedWords.push({
          ...w,
          startSec: round3(fallbackCursor + w.startSec),
          endSec: round3(fallbackCursor + w.endSec),
        });
      }
      fallbackCursor += estDur;
    } else {
      combinedWords.push(...pWords);
      fallbackCursor = Math.max(
        fallbackCursor,
        paraCues[paraCues.length - 1]?.endSec ?? fallbackCursor
      );
    }
  }

  return chunkTimedWordsIntoCues(combinedWords, opts);
}

/**
 * Aligns a user script (or starter script if missing) onto ffmpeg silence-detected speech spans.
 */
export function generateSubtitlesFromSpeechWindows(
  speechWindows: Array<{ start: number; end: number }>,
  scriptText: string,
  durationSec: number,
  language: string,
  options: Partial<SubtitleBuildOptions> = {}
): SubtitleCue[] {
  const opts = { ...DEFAULT_SUBTITLE_OPTIONS, ...options };
  const safeDur = Math.max(1.0, durationSec);
  const windows =
    speechWindows.length > 0
      ? speechWindows
      : [{ start: 0, end: safeDur }];

  const cleanScript = stripBreakTags(scriptText || "");
  const fallbackScript =
    language === "km"
      ? "សួស្តី! សូមស្វាគមន៍មកកាន់ស្ទូឌីយោបង្កើតចំណងជើងរង SAKTTS។\nអ្នកអាចកែសម្រួលអត្ថបទ ពេលវេលា និងទាញយកជា SRT ឬ VTT បានភ្លាមៗ។"
      : "Welcome to SAKTTS Subtitle Studio.\nEdit any caption line, fine-tune timestamps, and export straight to SRT, VTT, or ASS.";

  const effectiveScript = cleanScript || fallbackScript;
  const tokens = segmentSubtitleTokens(effectiveScript);
  if (tokens.length === 0) return [];

  // Map weighted tokens monotonically across the active speech windows (skipping detected silences!)
  const totalSpeechSec = windows.reduce((sum, w) => sum + Math.max(0.2, w.end - w.start), 0);
  const totalWeight = tokens.reduce((sum, t) => sum + t.weight, 0);

  const mapProgressToSpeechTime = (progressFrac: number): number => {
    const targetSpeechOffset = Math.max(0, Math.min(1, progressFrac)) * totalSpeechSec;
    let walked = 0;
    for (const w of windows) {
      const wDur = Math.max(0.2, w.end - w.start);
      if (walked + wDur >= targetSpeechOffset || w === windows[windows.length - 1]) {
        const local = targetSpeechOffset - walked;
        return Math.min(w.end, w.start + Math.max(0, local));
      }
      walked += wDur;
    }
    return windows[windows.length - 1].end;
  };

  let accWeight = 0;
  const timedWords: SubtitleWord[] = tokens.map((tk) => {
    const p0 = accWeight / totalWeight;
    accWeight += tk.weight;
    const p1 = accWeight / totalWeight;
    const s = round3(mapProgressToSpeechTime(p0));
    const e = round3(Math.max(s + 0.08, mapProgressToSpeechTime(p1)));
    return {
      text: tk.text,
      leadingSep: tk.leadingSep,
      startSec: s,
      endSec: e,
    };
  });

  return chunkTimedWordsIntoCues(timedWords, opts);
}

/**
 * Generates subtitles purely from pasted text and estimated reading/target duration.
 */
export function generateSubtitlesFromPlainScript(
  scriptText: string,
  durationSec: number,
  options: Partial<SubtitleBuildOptions> = {}
): SubtitleCue[] {
  const opts = { ...DEFAULT_SUBTITLE_OPTIONS, ...options };
  const tokens = segmentSubtitleTokens(scriptText);
  if (tokens.length === 0) return [];
  const estimatedDur =
    durationSec > 0
      ? durationSec
      : Math.max(2.5, Math.round((visualTextLength(scriptText) / 14) * 10) / 10);
  const totalWeight = tokens.reduce((s, t) => s + t.weight, 0);
  let acc = 0;
  const words: SubtitleWord[] = tokens.map((tk) => {
    const s = round3((acc / totalWeight) * estimatedDur);
    acc += tk.weight;
    const e = round3(Math.max(s + 0.08, (acc / totalWeight) * estimatedDur));
    return {
      text: tk.text,
      leadingSep: tk.leadingSep,
      startSec: s,
      endSec: e,
    };
  });
  return chunkTimedWordsIntoCues(words, opts);
}

/**
 * Generates subtitles from an array of SttSegments directly.
 */
export function generateSubtitlesFromSegments(
  segments: SttSegment[],
  options: Partial<SubtitleBuildOptions> = {}
): SubtitleCue[] {
  const opts = { ...DEFAULT_SUBTITLE_OPTIONS, ...options };
  const out: SubtitleCue[] = [];
  for (const seg of segments) {
    const words: SubtitleWord[] = seg.words.map((w, idx) => ({
      text: w.text,
      leadingSep:
        idx === 0
          ? ""
          : /^[\u1780-\u17FF]+$/.test(w.text) &&
            /^[\u1780-\u17FF]+$/.test(seg.words[idx - 1]?.text || "")
          ? ""
          : " ",
      startSec: w.start,
      endSec: w.end,
    }));
    out.push(
      ...chunkTimedWordsIntoCues(
        words,
        { ...opts, offsetMs: 0 },
        opts.includeSpeaker ? seg.speaker : undefined
      )
    );
  }
  return normalizeCueTimeline(out, opts.offsetMs);
}

/**
 * Re-wraps existing editable cues when line width or max lines changes.
 */
export function rewrapSubtitleCues(
  cues: SubtitleCue[],
  maxCharsPerLine: number,
  maxLines: 1 | 2,
  includeSpeaker = false
): SubtitleCue[] {
  return cues.map((cue, idx) => {
    const rawBody = cue.text;
    const prefixed = includeSpeaker && cue.speaker ? `[${cue.speaker}] ${rawBody}` : rawBody;
    const lines = wrapPlainTextLines(prefixed, maxCharsPerLine, maxLines);
    return {
      ...cue,
      index: idx + 1,
      lines,
    };
  });
}

/**
 * Splits a single cue in half cleanly on a word/line boundary for finer manual pacing.
 */
export function splitCueInHalf(
  cues: SubtitleCue[],
  cueId: string,
  options: Pick<SubtitleBuildOptions, "maxCharsPerLine" | "maxLines">
): SubtitleCue[] {
  const idx = cues.findIndex((c) => c.id === cueId);
  if (idx === -1) return cues;
  const target = cues[idx];
  const tokens = segmentSubtitleTokens(target.text);
  if (tokens.length < 2) return cues;

  const mid = Math.ceil(tokens.length / 2);
  const firstTokens = tokens.slice(0, mid);
  const secondTokens = tokens.slice(mid);
  const w1 = firstTokens.reduce((s, t) => s + t.weight, 0);
  const w2 = secondTokens.reduce((s, t) => s + t.weight, 0);
  const totalW = Math.max(1, w1 + w2);
  const dur = Math.max(0.4, target.endSec - target.startSec);
  const midSec = round3(target.startSec + (w1 / totalW) * dur);

  const linesA = wrapWordsIntoLines(firstTokens, options.maxCharsPerLine, options.maxLines);
  const linesB = wrapWordsIntoLines(secondTokens, options.maxCharsPerLine, options.maxLines);

  const cueA: SubtitleCue = {
    ...target,
    id: `${target.id}-a-${Date.now().toString(36)}`,
    endSec: Math.max(target.startSec + 0.15, round3(midSec - 0.02)),
    text: linesA.join("\n"),
    lines: linesA,
    words: undefined,
  };
  const cueB: SubtitleCue = {
    ...target,
    id: `${target.id}-b-${Date.now().toString(36)}`,
    startSec: midSec,
    endSec: Math.max(midSec + 0.15, target.endSec),
    text: linesB.join("\n"),
    lines: linesB,
    words: undefined,
  };

  const next = [...cues.slice(0, idx), cueA, cueB, ...cues.slice(idx + 1)];
  return next.map((c, i) => ({ ...c, index: i + 1 }));
}

export function mergeCueWithNext(
  cues: SubtitleCue[],
  cueId: string,
  options: Pick<SubtitleBuildOptions, "maxCharsPerLine" | "maxLines">
): SubtitleCue[] {
  const idx = cues.findIndex((c) => c.id === cueId);
  if (idx === -1 || idx >= cues.length - 1) return cues;
  const a = cues[idx];
  const b = cues[idx + 1];
  const sep =
    /[\u1780-\u17FF]$/.test(a.text.trim()) && /^[\u1780-\u17FF]/.test(b.text.trim())
      ? ""
      : " ";
  const combinedText = `${a.text.replace(/\n/g, " ").trim()}${sep}${b.text
    .replace(/\n/g, " ")
    .trim()}`;
  const lines = wrapPlainTextLines(combinedText, options.maxCharsPerLine, options.maxLines);
  const merged: SubtitleCue = {
    ...a,
    endSec: Math.max(a.startSec + 0.2, b.endSec),
    text: lines.join("\n"),
    lines,
    words: undefined,
  };
  const next = [...cues.slice(0, idx), merged, ...cues.slice(idx + 2)];
  return next.map((c, i) => ({ ...c, index: i + 1 }));
}

function pad2(n: number): string {
  return String(Math.floor(n)).padStart(2, "0");
}

export function formatTimeSrt(sec: number): string {
  const safe = Math.max(0, sec);
  const totalMs = Math.round(safe * 1000);
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${String(ms).padStart(3, "0")}`;
}

export function formatTimeVtt(sec: number): string {
  return formatTimeSrt(sec).replace(",", ".");
}

export function formatTimeAss(sec: number): string {
  const safe = Math.max(0, sec);
  const totalCs = Math.round(safe * 100);
  const h = Math.floor(totalCs / 360000);
  const m = Math.floor((totalCs % 360000) / 6000);
  const s = Math.floor((totalCs % 6000) / 100);
  const cs = totalCs % 100;
  return `${h}:${pad2(m)}:${pad2(s)}.${pad2(cs)}`;
}

export function formatTimeDisplay(sec: number): string {
  const safe = Math.max(0, sec);
  const totalMs = Math.round(safe * 1000);
  const m = Math.floor(totalMs / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const t = Math.floor((totalMs % 1000) / 100);
  return `${pad2(m)}:${pad2(s)}.${t}`;
}

export function formatSubtitleExport(
  cues: SubtitleCue[],
  format: SubtitleExportFormat,
  meta: { title?: string; includeSpeaker?: boolean; fontName?: string; fontSizePx?: number } = {}
): string {
  const normalized = cues.map((c, idx) => ({
    ...c,
    index: idx + 1,
    renderedText:
      meta.includeSpeaker && c.speaker
        ? `[${c.speaker}] ${c.lines?.join("\n") || c.text}`
        : c.lines?.join("\n") || c.text,
  }));

  if (format === "srt") {
    return normalized
      .map(
        (c) =>
          `${c.index}\n${formatTimeSrt(c.startSec)} --> ${formatTimeSrt(c.endSec)}\n${c.renderedText}`
      )
      .join("\n\n");
  }

  if (format === "vtt") {
    return (
      "WEBVTT\n\n" +
      normalized
        .map((c) => {
          const body =
            meta.includeSpeaker && c.speaker
              ? `<v ${c.speaker}>${c.lines?.join("\n") || c.text}`
              : c.lines?.join("\n") || c.text;
          return `${c.index}\n${formatTimeVtt(c.startSec)} --> ${formatTimeVtt(c.endSec)}\n${body}`;
        })
        .join("\n\n")
    );
  }

  if (format === "ass") {
    const title = meta.title || "SAKTTS Subtitles";
    const fontName = meta.fontName || "Noto Sans Khmer";
    const fontSize = Math.round((meta.fontSizePx ?? 24) * 2.2);
    const header = [
      "[Script Info]",
      `; Generated by SAKTTS Subtitle Studio`,
      `Title: ${title}`,
      "ScriptType: v4.00+",
      "WrapStyle: 0",
      "ScaledBorderAndShadow: yes",
      "PlayResX: 1920",
      "PlayResY: 1080",
      "",
      "[V4+ Styles]",
      "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
      `Style: Default,${fontName},${fontSize},&H00FFFFFF,&H0000FFFF,&H00121212,&H7F000000,-1,0,0,0,100,100,0,0,1,3,1,2,48,48,54,1`,
      "",
      "[Events]",
      "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ].join("\n");

    const lines = normalized.map((c) => {
      const assText = c.renderedText.replace(/\r?\n/g, "\\N");
      const actor = c.speaker ? c.speaker.replace(/,/g, " ") : "";
      return `Dialogue: 0,${formatTimeAss(c.startSec)},${formatTimeAss(c.endSec)},Default,${actor},0,0,0,,${assText}`;
    });

    return `${header}\n${lines.join("\n")}\n`;
  }

  if (format === "json") {
    return JSON.stringify(
      {
        generator: "SAKTTS Subtitle Studio",
        title: meta.title || "Subtitles",
        count: normalized.length,
        cues: normalized.map((c) => ({
          index: c.index,
          startSec: c.startSec,
          endSec: c.endSec,
          text: c.renderedText,
          lines: c.lines,
          ...(c.speaker ? { speaker: c.speaker } : {}),
        })),
      },
      null,
      2
    );
  }

  // Plain timecoded TXT
  return normalized
    .map(
      (c) =>
        `[${formatTimeDisplay(c.startSec)} -> ${formatTimeDisplay(c.endSec)}] ${c.renderedText.replace(/\n/g, " ")}`
    )
    .join("\n");
}
