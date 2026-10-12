// Reads subtitle files (SubRip .srt and WebVTT .vtt) into caption cues, so
// captions made elsewhere (or exported earlier) can be dropped in and the
// editor's captions autofill.
//
// Both formats are text blocks separated by blank lines:
//
//   1                                  ← SRT index (optional in VTT)
//   00:00:01,000 --> 00:00:03,500      ← times (',' in SRT, '.' in VTT)
//   Hello there.                       ← one or more text lines
//
// We're forgiving on purpose: files in the wild have BOMs, CRLFs, missing
// hours, notes, styling tags and positioning cues.

import { newSegmentId } from "@/lib/project/segments";
import type { CaptionCue } from "@/lib/project/types";

const TIME = /(?:(\d+):)?(\d{1,2}):(\d{2})(?:[.,](\d{1,3}))?/;
const ARROW = new RegExp(`(${TIME.source})\\s*-->\\s*(${TIME.source})`);

function toMs(h: string | undefined, m: string, s: string, frac: string | undefined): number {
  const ms = frac ? Number(frac.padEnd(3, "0")) : 0;
  return (Number(h ?? 0) * 3600 + Number(m) * 60 + Number(s)) * 1000 + ms;
}

/** Plain text of one cue: styling tags and positioning commands removed. */
function cleanText(lines: string[]): string {
  return lines
    .join(" ")
    .replace(/\{\\[^}]*\}/g, "") // ASS-style {\an8} positioning
    .replace(/<[^>]+>/g, "") // <i>, <b>, <c.color>, <00:00:01.000> karaoke stamps
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export class SubtitleParseError extends Error {}

export function parseSubtitles(input: string, makeId: () => string = newSegmentId): CaptionCue[] {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const blocks = text.split(/\n{2,}/);
  const cues: CaptionCue[] = [];

  for (const block of blocks) {
    const lines = block.split("\n");
    // Skip WEBVTT header, NOTE, STYLE and REGION blocks (no time arrow).
    const at = lines.findIndex((l) => ARROW.test(l));
    if (at < 0) continue;
    const m = ARROW.exec(lines[at]!)!;
    // Groups: 1 = whole start, 2..5 = its parts; 6 = whole end, 7..10 = its parts.
    const start = toMs(m[2], m[3]!, m[4]!, m[5]);
    const end = toMs(m[7], m[8]!, m[9]!, m[10]);
    const body = cleanText(lines.slice(at + 1));
    if (!body || end <= start) continue;
    cues.push({ id: makeId(), start, end, text: body });
  }

  if (cues.length === 0) {
    throw new SubtitleParseError("No captions found. Use an .srt or .vtt file with lines like 00:00:01,000 --> 00:00:03,000.");
  }
  cues.sort((a, b) => a.start - b.start);
  // Cues must not overlap (spec): trim an earlier cue back to where the next starts.
  for (let i = 1; i < cues.length; i++) {
    if (cues[i]!.start < cues[i - 1]!.end) cues[i - 1]!.end = Math.max(cues[i - 1]!.start + 1, cues[i]!.start);
  }
  return cues;
}

/** Drops cues past the end of the video and shortens the one that crosses it. */
export function fitCuesToDuration(cues: readonly CaptionCue[], durationMs: number): CaptionCue[] {
  return cues
    .filter((c) => c.start < durationMs)
    .map((c) => (c.end > durationMs ? { ...c, end: durationMs } : c));
}
