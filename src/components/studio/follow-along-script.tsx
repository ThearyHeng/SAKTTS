"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ActiveTextSelection,
  SpeechCue,
  buildParagraphTimeline,
  findActiveRangeAtTime,
  findSeekTimeAtCharOffset,
} from "@/lib/text-alignment";

interface FollowAlongScriptProps {
  text: string;
  paragraphIndex?: number;
  cues?: SpeechCue[];
  totalDurationSec: number;
  currentTimeSec: number;
  isPlaying: boolean;
  onSeekToTime?: (timeSec: number) => void;
  className?: string;
}

let activeHighlightOwner: string | null = null;

function clearOwnedHighlights(ownerId: string) {
  if (typeof CSS === "undefined" || !("highlights" in CSS)) return;
  if (activeHighlightOwner === ownerId) {
    CSS.highlights.delete("saktts-active-sentence");
    CSS.highlights.delete("saktts-active-word");
    activeHighlightOwner = null;
  }
}

function collectTextNodes(root: HTMLElement): Text[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let node = walker.nextNode();
  while (node) {
    nodes.push(node as Text);
    node = walker.nextNode();
  }
  return nodes;
}

function createRangeForTextOffsets(
  textNodes: Text[],
  startOffset: number,
  endOffset: number
): Range | null {
  if (textNodes.length === 0 || endOffset <= startOffset) return null;

  let startNode: Text | null = null;
  let startLocal = 0;
  let endNode: Text | null = null;
  let endLocal = 0;
  let acc = 0;

  for (const node of textNodes) {
    const len = node.data.length;
    if (!startNode && acc + len >= startOffset) {
      startNode = node;
      startLocal = Math.max(0, startOffset - acc);
    }
    if (acc + len >= endOffset) {
      endNode = node;
      endLocal = Math.max(0, Math.min(len, endOffset - acc));
      break;
    }
    acc += len;
  }

  if (!startNode || !endNode) return null;
  const range = new Range();
  range.setStart(startNode, startLocal);
  range.setEnd(endNode, endLocal);
  return range;
}

function globalOffsetFromNode(textNodes: Text[], targetNode: Node, localOffset: number): number | null {
  let acc = 0;
  for (const node of textNodes) {
    if (node === targetNode) {
      return acc + Math.max(0, Math.min(node.data.length, localOffset));
    }
    acc += node.data.length;
  }
  return null;
}

function renderFallbackSegments(text: string, sel: ActiveTextSelection | null): React.ReactNode {
  if (!sel) return text;
  const clamp = (n: number) => Math.max(0, Math.min(text.length, n));
  const s0 = clamp(sel.sentenceStart);
  const w0 = clamp(Math.max(s0, sel.wordStart));
  const w1 = clamp(Math.max(w0, sel.wordEnd));
  const s1 = clamp(Math.max(w1, sel.sentenceEnd));

  return (
    <>
      {s0 > 0 ? text.slice(0, s0) : null}
      {w0 > s0 ? <mark data-saktts-highlight="sentence">{text.slice(s0, w0)}</mark> : null}
      {w1 > w0 ? <mark data-saktts-highlight="word">{text.slice(w0, w1)}</mark> : null}
      {s1 > w1 ? <mark data-saktts-highlight="sentence">{text.slice(w1, s1)}</mark> : null}
      {s1 < text.length ? text.slice(s1) : null}
    </>
  );
}

export function FollowAlongScript({
  text,
  paragraphIndex = 0,
  cues,
  totalDurationSec,
  currentTimeSec,
  isPlaying,
  onSeekToTime,
  className = "",
}: FollowAlongScriptProps) {
  const instanceId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cachedNodesRef = useRef<Text[]>([]);
  const lastScrolledWordKeyRef = useRef<string>("");
  const [supportsCustomHighlight, setSupportsCustomHighlight] = useState<boolean>(true);

  useEffect(() => {
    setSupportsCustomHighlight(typeof CSS !== "undefined" && "highlights" in CSS);
  }, []);

  const timeline = useMemo(
    () => buildParagraphTimeline(text, paragraphIndex, cues, totalDurationSec),
    [text, paragraphIndex, cues, totalDurationSec]
  );

  const activeSelection = useMemo(() => {
    if (!isPlaying && currentTimeSec <= 0) return null;
    return findActiveRangeAtTime(timeline, currentTimeSec);
  }, [timeline, currentTimeSec, isPlaying]);

  // Cache text nodes via TreeWalker when text DOM changes (avoids walking on every frame)
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !supportsCustomHighlight) {
      cachedNodesRef.current = [];
      return;
    }
    cachedNodesRef.current = collectTextNodes(el);
  }, [text, supportsCustomHighlight]);

  // Paint CSS Custom Highlights without mutating the DOM or breaking Khmer shaping
  useEffect(() => {
    if (!supportsCustomHighlight || typeof CSS === "undefined" || !("highlights" in CSS)) {
      return;
    }

    if (!activeSelection) {
      clearOwnedHighlights(instanceId);
      return;
    }

    const el = containerRef.current;
    if (!el) return;
    const nodes = cachedNodesRef.current.length > 0 ? cachedNodesRef.current : collectTextNodes(el);

    const sentenceRange = createRangeForTextOffsets(
      nodes,
      activeSelection.sentenceStart,
      activeSelection.sentenceEnd
    );
    const wordRange = createRangeForTextOffsets(
      nodes,
      activeSelection.wordStart,
      activeSelection.wordEnd
    );

    if (!wordRange && !sentenceRange) {
      clearOwnedHighlights(instanceId);
      return;
    }

    // Clear stale ranges owned previously before setting new highlights
    CSS.highlights.delete("saktts-active-sentence");
    CSS.highlights.delete("saktts-active-word");

    if (sentenceRange) {
      const sentenceHl = new Highlight(sentenceRange);
      sentenceHl.priority = 0;
      CSS.highlights.set("saktts-active-sentence", sentenceHl);
    }

    if (wordRange) {
      const wordHl = new Highlight(wordRange);
      wordHl.priority = 1;
      CSS.highlights.set("saktts-active-word", wordHl);

      const wordKey = `${instanceId}:${activeSelection.wordStart}-${activeSelection.wordEnd}`;
      if (isPlaying && lastScrolledWordKeyRef.current !== wordKey) {
        lastScrolledWordKeyRef.current = wordKey;
        const rect = wordRange.getBoundingClientRect();
        if (rect.height > 0 && (rect.top < 72 || rect.bottom > window.innerHeight - 96)) {
          const reduced =
            typeof window !== "undefined" &&
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
          const scrollEl = el.closest(".overflow-y-auto") as HTMLElement | null;
          if (scrollEl) {
            const box = scrollEl.getBoundingClientRect();
            const delta = rect.top - box.top - box.height * 0.35;
            scrollEl.scrollBy({
              top: delta,
              behavior: reduced ? "auto" : "smooth",
            });
          } else {
            el.scrollIntoView({
              block: "nearest",
              behavior: reduced ? "auto" : "smooth",
            });
          }
        }
      }
    }

    activeHighlightOwner = instanceId;
  }, [activeSelection, instanceId, isPlaying, supportsCustomHighlight]);

  useEffect(() => {
    return () => {
      clearOwnedHighlights(instanceId);
    };
  }, [instanceId]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeekToTime) return;
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed) return;

    const el = containerRef.current;
    if (!el) return;

    let caretNode: Node | null = null;
    let caretOffset = 0;

    const doc = document as Document & {
      caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };

    if (typeof doc.caretPositionFromPoint === "function") {
      const pos = doc.caretPositionFromPoint(e.clientX, e.clientY);
      if (pos) {
        caretNode = pos.offsetNode;
        caretOffset = pos.offset;
      }
    } else if (typeof doc.caretRangeFromPoint === "function") {
      const range = doc.caretRangeFromPoint(e.clientX, e.clientY);
      if (range) {
        caretNode = range.startContainer;
        caretOffset = range.startOffset;
      }
    }

    if (!caretNode || !el.contains(caretNode)) return;
    const nodes = supportsCustomHighlight && cachedNodesRef.current.length > 0
      ? cachedNodesRef.current
      : collectTextNodes(el);
    const charOffset = globalOffsetFromNode(nodes, caretNode, caretOffset);
    if (charOffset === null) return;

    const seekSec = findSeekTimeAtCharOffset(timeline, charOffset);
    if (seekSec !== null) {
      onSeekToTime(seekSec);
    }
  };

  return (
    <div
      ref={containerRef}
      data-paragraph-index={paragraphIndex}
      onClick={handleClick}
      title={onSeekToTime ? "Click any word to jump playback here" : undefined}
      className={`w-full cursor-pointer px-1 text-[15.5px] leading-[1.85] whitespace-pre-wrap break-words select-text ${className}`}
    >
      {supportsCustomHighlight ? text : renderFallbackSegments(text, activeSelection)}
    </div>
  );
}
