import { normalizeTextWithRanges } from "./khmer-normalizer";

export interface SpeechCue {
  paragraphIndex: number;
  text: string;
  startSec: number;
  endSec: number;
  curve?: Array<[number, number]>;
}

export interface WordTokenTiming {
  startChar: number;
  endChar: number;
  sentenceStart: number;
  sentenceEnd: number;
  startSec: number;
  endSec: number;
}

export interface SentenceSpan {
  startChar: number;
  endChar: number;
  startSec: number;
  endSec: number;
}

export interface ParagraphWordTimeline {
  paragraphIndex: number;
  words: WordTokenTiming[];
  sentences: SentenceSpan[];
}

export interface ActiveTextSelection {
  sentenceStart: number;
  sentenceEnd: number;
  wordStart: number;
  wordEnd: number;
}

const BREAK_TAG_RE = /\[break=\d+(?:\.\d+)?(?:ms|s)\]/gi;
const KHMER_PUNCT_RE = /^[\s\u200B-\u200D\uFEFF.,!?;:\u17D4\u17D5\u17D6\u17D7\u17D9\u17DA"'()[\]{}\-–—/]+$/;
const IGNORED_ALIGN_CHAR_RE = /[\s\u200B\uFEFF]/;

let cachedWordSegmenter: Intl.Segmenter | null | undefined;

function getWordSegmenter(): Intl.Segmenter | null {
  if (cachedWordSegmenter !== undefined) return cachedWordSegmenter;
  try {
    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      cachedWordSegmenter = new Intl.Segmenter("km", { granularity: "word" });
    } else {
      cachedWordSegmenter = null;
    }
  } catch {
    cachedWordSegmenter = null;
  }
  return cachedWordSegmenter;
}

function getProtectedBreakRanges(text: string): Array<[number, number]> {
  const ranges: Array<[number, number]> = [];
  const re = new RegExp(BREAK_TAG_RE.source, "gi");
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    ranges.push([m.index, m.index + m[0].length]);
  }
  return ranges;
}

function overlapsProtected(start: number, end: number, protectedRanges: Array<[number, number]>): boolean {
  for (const [ps, pe] of protectedRanges) {
    if (start < pe && end > ps) return true;
  }
  return false;
}

function compactMapForRange(
  rawText: string,
  fromOffset: number,
  protectedRanges: Array<[number, number]>
): { compact: string; rawIndices: number[] } {
  let compact = "";
  const rawIndices: number[] = [];
  let pIdx = 0;

  for (let i = fromOffset; i < rawText.length; i++) {
    while (pIdx < protectedRanges.length && i >= protectedRanges[pIdx][1]) {
      pIdx++;
    }
    if (pIdx < protectedRanges.length && i >= protectedRanges[pIdx][0] && i < protectedRanges[pIdx][1]) {
      continue;
    }
    const ch = rawText[i];
    if (IGNORED_ALIGN_CHAR_RE.test(ch)) continue;
    compact += ch.toLowerCase();
    rawIndices.push(i);
  }
  return { compact, rawIndices };
}

function normalizedCompactMapForRange(
  rawText: string,
  fromOffset: number,
  protectedRanges: Array<[number, number]>
): { compact: string; rawSpans: Array<[number, number]> } {
  const pieces = normalizeTextWithRanges(rawText, true);
  let compact = "";
  const rawSpans: Array<[number, number]> = [];

  for (const piece of pieces) {
    if (piece.rawEnd <= fromOffset) continue;
    if (overlapsProtected(piece.rawStart, piece.rawEnd, protectedRanges)) continue;
    for (const ch of piece.spoken) {
      if (IGNORED_ALIGN_CHAR_RE.test(ch)) continue;
      compact += ch.toLowerCase();
      rawSpans.push([Math.max(fromOffset, piece.rawStart), piece.rawEnd]);
    }
  }
  return { compact, rawSpans };
}

function normalizeCompactQuery(text: string): string {
  return text.replace(BREAK_TAG_RE, "").replace(/[\s\u200B\uFEFF]+/g, "").toLowerCase();
}

/**
 * Evaluates where inside [0, 1] spoken progress sits at time fraction tFrac [0, 1]
 * using the backend voiced-energy curve [[timeFrac, progressFrac], ...].
 */
function evalCurve(curve: Array<[number, number]> | undefined, tFrac: number): number {
  const clamped = Math.max(0, Math.min(1, tFrac));
  if (!curve || curve.length < 2) return clamped;

  for (let i = 1; i < curve.length; i++) {
    const [t1, p1] = curve[i];
    if (clamped <= t1 || i === curve.length - 1) {
      const [t0, p0] = curve[i - 1];
      const span = Math.max(1e-6, t1 - t0);
      const local = Math.max(0, Math.min(1, (clamped - t0) / span));
      return p0 + (p1 - p0) * local;
    }
  }
  return clamped;
}

/**
 * Inverts a monotone energy-progress curve [[timeFrac, progressFrac], ...]
 * to find the time fraction corresponding to a target spoken progress [0, 1].
 */
function invertCurve(curve: Array<[number, number]> | undefined, pFrac: number): number {
  const clamped = Math.max(0, Math.min(1, pFrac));
  if (!curve || curve.length < 2) return clamped;

  for (let i = 1; i < curve.length; i++) {
    const [t1, p1] = curve[i];
    if (clamped <= p1 || i === curve.length - 1) {
      const [t0, p0] = curve[i - 1];
      const span = Math.max(1e-6, p1 - p0);
      const local = Math.max(0, Math.min(1, (clamped - p0) / span));
      return t0 + (t1 - t0) * local;
    }
  }
  return clamped;
}

function estimateSpokenWeight(token: string): number {
  const spoken = normalizeTextWithRanges(token, true)
    .map((p) => p.spoken)
    .join("");
  // Strip subscript coeng \u17D2, ZWSP, and punctuation to weight spoken syllable clusters evenly
  const base = spoken.replace(/[\u17D2\s\u200B\uFEFF.,!?;:\u17D4\u17D5\u17D6\u17D7]/g, "");
  return Math.max(1, base.length);
}

function segmentWordsInSpan(
  rawText: string,
  spanStart: number,
  spanEnd: number,
  protectedRanges: Array<[number, number]>
): Array<{ startChar: number; endChar: number; weight: number }> {
  const slice = rawText.slice(spanStart, spanEnd);
  if (!slice) return [];

  const tokens: Array<{ startChar: number; endChar: number; weight: number }> = [];
  const seg = getWordSegmenter();

  if (seg) {
    for (const part of seg.segment(slice)) {
      const s = spanStart + part.index;
      const e = s + part.segment.length;
      if (overlapsProtected(s, e, protectedRanges)) continue;

      const trimmed = part.segment.trim();
      if (!trimmed) continue;

      // Merge standalone Khmer repetition mark "ៗ" into previous word
      if (trimmed === "\u17D7" && tokens.length > 0 && tokens[tokens.length - 1].endChar === s) {
        tokens[tokens.length - 1].endChar = e;
        tokens[tokens.length - 1].weight += 1;
        continue;
      }

      if (!part.isWordLike && KHMER_PUNCT_RE.test(trimmed)) {
        continue;
      }

      if (part.isWordLike || /[\p{L}\p{N}]/u.test(trimmed)) {
        tokens.push({
          startChar: s,
          endChar: e,
          weight: estimateSpokenWeight(trimmed),
        });
      }
    }
  } else {
    const wordRe = /\S+/g;
    let m: RegExpExecArray | null;
    while ((m = wordRe.exec(slice)) !== null) {
      const s = spanStart + m.index;
      const e = s + m[0].length;
      if (overlapsProtected(s, e, protectedRanges)) continue;
      if (KHMER_PUNCT_RE.test(m[0])) continue;
      tokens.push({
        startChar: s,
        endChar: e,
        weight: estimateSpokenWeight(m[0]),
      });
    }
  }

  return tokens;
}

function extractRawSentenceSpans(
  rawText: string,
  protectedRanges: Array<[number, number]>
): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  const boundaries: Array<[number, number]> = [[0, rawText.length]];
  // Break first along [break=...] tags cleanly
  if (protectedRanges.length > 0) {
    boundaries.length = 0;
    let cursor = 0;
    for (const [ps, pe] of protectedRanges) {
      if (ps > cursor) boundaries.push([cursor, ps]);
      cursor = pe;
    }
    if (cursor < rawText.length) boundaries.push([cursor, rawText.length]);
  }

  const sentDelim = /[\n។៕!?]+|\.(?=\s|$)/g;
  for (const [bs, be] of boundaries) {
    const sub = rawText.slice(bs, be);
    let last = 0;
    let m: RegExpExecArray | null;
    const re = new RegExp(sentDelim.source, "g");
    while ((m = re.exec(sub)) !== null) {
      if (re.lastIndex <= m.index) {
        re.lastIndex = m.index + 1;
      }
      const endPos = re.lastIndex;
      const chunk = sub.slice(last, endPos);
      if (chunk.trim()) {
        const leadingWs = chunk.search(/\S/);
        const trailingTrimmed = chunk.trimEnd().length;
        spans.push([bs + last + Math.max(0, leadingWs), bs + last + trailingTrimmed]);
      }
      last = endPos;
    }
    const tail = sub.slice(last);
    if (tail.trim()) {
      const leadingWs = tail.search(/\S/);
      spans.push([bs + last + Math.max(0, leadingWs), bs + last + tail.trimEnd().length]);
    }
  }

  return spans;
}

export function buildParagraphTimeline(
  paragraphText: string,
  paragraphIndex: number,
  cues: SpeechCue[] | undefined,
  totalDurationSec: number
): ParagraphWordTimeline {
  const trimmedAll = paragraphText.trim();
  if (!trimmedAll) {
    return { paragraphIndex, words: [], sentences: [] };
  }

  const protectedRanges = getProtectedBreakRanges(paragraphText);
  const paraCues = (cues ?? []).filter((c) => c.paragraphIndex === paragraphIndex && c.text.trim());

  // Fallback when playing legacy history items that lack stored cue arrays
  const effectiveCues: SpeechCue[] =
    paraCues.length > 0
      ? paraCues
      : totalDurationSec > 0
      ? [
          {
            paragraphIndex,
            text: paragraphText,
            startSec: 0,
            endSec: totalDurationSec,
          },
        ]
      : [];

  if (effectiveCues.length === 0) {
    return { paragraphIndex, words: [], sentences: [] };
  }

  const words: WordTokenTiming[] = [];
  const sentences: SentenceSpan[] = [];
  const fallbackRawSpans = extractRawSentenceSpans(paragraphText, protectedRanges);
  let fallbackIdx = 0;
  let searchCursor = 0;
  let lastNormRawSpan: [number, number] | null = null;

  const avgCueChars =
    effectiveCues.reduce((sum, c) => sum + normalizeCompactQuery(c.text).length, 0) /
    Math.max(1, effectiveCues.length);
  const wordLevelMode =
    effectiveCues.length > Math.max(2, fallbackRawSpans.length * 1.5) &&
    avgCueChars <= 20 &&
    effectiveCues.every((c) => !c.curve);

  for (let cIdx = 0; cIdx < effectiveCues.length; cIdx++) {
    const cue = effectiveCues[cIdx];
    const queryCompact = normalizeCompactQuery(cue.text);
    if (!queryCompact) continue;

    // If previous cue mapped to a multi-word spoken normalization (e.g. "$12.50" -> "ដប់ពីរ ចុចប្រាំ ដុល្លារ"),
    // extend that word's endSec through its remaining spoken tokens.
    if (lastNormRawSpan && words.length > 0) {
      const sliceNorm = normalizedCompactMapForRange(
        paragraphText.slice(0, lastNormRawSpan[1]),
        lastNormRawSpan[0],
        protectedRanges
      );
      if (sliceNorm.compact.includes(queryCompact)) {
        const lastWord = words[words.length - 1];
        if (lastWord.startChar >= lastNormRawSpan[0] && lastWord.endChar <= lastNormRawSpan[1]) {
          lastWord.endSec = Math.max(lastWord.endSec, cue.endSec);
          continue;
        }
      }
      lastNormRawSpan = null;
    }

    let matchStart = -1;
    let matchEnd = -1;
    let matchedViaNorm = false;

    const maxJump = wordLevelMode && queryCompact.length < 15 ? 90 : Infinity;

    const { compact, rawIndices } = compactMapForRange(
      paragraphText,
      searchCursor,
      protectedRanges
    );
    const hitIdx = compact.indexOf(queryCompact);

    if (hitIdx !== -1 && hitIdx <= maxJump && hitIdx + queryCompact.length - 1 < rawIndices.length) {
      matchStart = rawIndices[hitIdx];
      matchEnd = rawIndices[hitIdx + queryCompact.length - 1] + 1;
    } else {
      const { compact: normCompact, rawSpans: normSpans } = normalizedCompactMapForRange(
        paragraphText,
        searchCursor,
        protectedRanges
      );
      const normHit = normCompact.indexOf(queryCompact);
      if (
        normHit !== -1 &&
        normHit <= maxJump * 3 &&
        normHit + queryCompact.length - 1 < normSpans.length
      ) {
        matchStart = normSpans[normHit][0];
        matchEnd = normSpans[normHit + queryCompact.length - 1][1];
        matchedViaNorm = true;
      } else if (!wordLevelMode && fallbackIdx < fallbackRawSpans.length) {
        // Only fall back to sentence spans when cues represent sentence/segment chunks
        while (
          fallbackIdx < fallbackRawSpans.length &&
          fallbackRawSpans[fallbackIdx][1] <= searchCursor
        ) {
          fallbackIdx++;
        }
        if (fallbackIdx < fallbackRawSpans.length) {
          [matchStart, matchEnd] = fallbackRawSpans[fallbackIdx];
          fallbackIdx++;
        }
      }
    }

    if (matchStart === -1 || matchEnd <= matchStart) {
      continue;
    }

    searchCursor = matchEnd;

    const sentenceStart = matchStart;
    const sentenceEnd = matchEnd;
    sentences.push({
      startChar: sentenceStart,
      endChar: sentenceEnd,
      startSec: cue.startSec,
      endSec: cue.endSec,
    });

    const tokens = segmentWordsInSpan(paragraphText, matchStart, matchEnd, protectedRanges);
    if (tokens.length === 0) continue;

    // Only keep as a single merged word when a short word-level cue matched a single normalized expression (e.g. "$12.50")
    const isSingleNormalizedExpr =
      matchedViaNorm &&
      wordLevelMode &&
      tokens.length <= 2 &&
      queryCompact.length <= 24 &&
      matchEnd - matchStart <= 18 &&
      !/[។៕!?]/.test(cue.text);

    if (isSingleNormalizedExpr) {
      lastNormRawSpan = [matchStart, matchEnd];
      words.push({
        startChar: matchStart,
        endChar: matchEnd,
        sentenceStart,
        sentenceEnd,
        startSec: cue.startSec,
        endSec: cue.endSec,
      });
      continue;
    }
    lastNormRawSpan = null;

    const totalWeight = tokens.reduce((acc, tk) => acc + tk.weight, 0);
    const cueDur = Math.max(0.05, cue.endSec - cue.startSec);

    let accWeight = 0;
    for (let i = 0; i < tokens.length; i++) {
      const tk = tokens[i];
      const wStart = accWeight / totalWeight;
      accWeight += tk.weight;
      const wEnd = accWeight / totalWeight;

      const tStartFrac = invertCurve(cue.curve, wStart);
      const tEndFrac = invertCurve(cue.curve, wEnd);

      words.push({
        startChar: tk.startChar,
        endChar: tk.endChar,
        sentenceStart,
        sentenceEnd,
        startSec: cue.startSec + cueDur * tStartFrac,
        endSec: cue.startSec + cueDur * tEndFrac,
      });
    }
  }

  // Refine sentence underlines for both single-word cues (Edge EN) and multi-sentence clause cues (Edge KM)
  if (fallbackRawSpans.length > 0) {
    for (const w of words) {
      const enclosing = fallbackRawSpans.find(([rs, re]) => w.startChar >= rs && w.endChar <= re);
      if (enclosing && (wordLevelMode || w.sentenceEnd - w.sentenceStart > enclosing[1] - enclosing[0])) {
        w.sentenceStart = enclosing[0];
        w.sentenceEnd = enclosing[1];
      }
    }
  }

  // Ensure monotonic non-overlapping times across words in sequence
  for (let i = 1; i < words.length; i++) {
    if (words[i].startSec < words[i - 1].startSec) {
      words[i].startSec = words[i - 1].startSec;
    }
    if (words[i].endSec < words[i].startSec) {
      words[i].endSec = words[i].startSec + 0.04;
    }
  }

  return { paragraphIndex, words, sentences };
}

export function findActiveRangeAtTime(
  timeline: ParagraphWordTimeline,
  timeSec: number
): ActiveTextSelection | null {
  const { words } = timeline;
  if (words.length === 0 || timeSec < 0) return null;

  const first = words[0];
  const last = words[words.length - 1];
  if (timeSec < Math.max(0, first.startSec - 0.08) || timeSec > last.endSec + 0.15) {
    return null;
  }

  // Binary search last word with startSec <= timeSec
  let lo = 0;
  let hi = words.length - 1;
  let best = 0;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].startSec <= timeSec) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  const candidate = words[best];
  // If audio is sitting in a pause (> 0.65s between words/paragraphs), don't leave a stale word stuck on pause
  if (timeSec > candidate.endSec + 0.65) {
    return null;
  }

  return {
    sentenceStart: candidate.sentenceStart,
    sentenceEnd: candidate.sentenceEnd,
    wordStart: candidate.startChar,
    wordEnd: candidate.endChar,
  };
}

export function findSeekTimeAtCharOffset(
  timeline: ParagraphWordTimeline,
  charOffset: number
): number | null {
  const { words } = timeline;
  if (words.length === 0) return null;

  for (const w of words) {
    if (charOffset >= w.startChar && charOffset <= w.endChar) {
      return Math.max(0, w.startSec);
    }
  }

  // Closest preceding or following word if user clicked a space/punctuation
  let closest = words[0];
  let bestDist = Infinity;
  for (const w of words) {
    const dist =
      charOffset < w.startChar
        ? w.startChar - charOffset
        : charOffset > w.endChar
        ? charOffset - w.endChar
        : 0;
    if (dist < bestDist) {
      bestDist = dist;
      closest = w;
    }
  }
  return Math.max(0, closest.startSec);
}

export { evalCurve };
