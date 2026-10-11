// Subtitle files (SRT and WebVTT) for the EXPORTED video.
//
// Cues are stored on the source timeline, but a subtitle file must match
// the output video, where trims removed time and speed changes stretched
// it. Each cue is intersected with the kept pieces of the time map: a cue
// entirely inside a cut disappears; a partly cut cue is shortened.

import type { CaptionCue } from "@/lib/project/types";
import type { TimeMap } from "@/lib/timeline/timeMap";

export interface OutputCue {
  start: number;
  end: number;
  text: string;
}

export function cuesToOutput(cues: readonly CaptionCue[], map: TimeMap): OutputCue[] {
  const out: OutputCue[] = [];
  for (const cue of cues) {
    let start = Infinity;
    let end = -Infinity;
    for (const piece of map.pieces) {
      const from = Math.max(cue.start, piece.sourceStart);
      const to = Math.min(cue.end, piece.sourceEnd);
      if (to <= from) continue;
      start = Math.min(start, piece.outputStart + (from - piece.sourceStart) / piece.rate);
      end = Math.max(end, piece.outputStart + (to - piece.sourceStart) / piece.rate);
    }
    // Under 1/10 s left: not readable, drop it.
    if (end - start >= 100) out.push({ start, end, text: cue.text });
  }
  return out;
}

function timestamp(ms: number, decimal: "," | "."): string {
  const total = Math.max(0, Math.round(ms));
  const h = Math.floor(total / 3_600_000);
  const m = Math.floor(total / 60_000) % 60;
  const s = Math.floor(total / 1000) % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}${decimal}${pad(total % 1000, 3)}`;
}

/** SubRip: numbered blocks, comma before the milliseconds. */
export function toSrt(cues: readonly OutputCue[]): string {
  return cues
    .map((cue, i) => `${i + 1}\n${timestamp(cue.start, ",")} --> ${timestamp(cue.end, ",")}\n${cue.text}\n`)
    .join("\n");
}

/** WebVTT: what <track> elements and most web players read. */
export function toVtt(cues: readonly OutputCue[]): string {
  const body = cues.map((cue) => `${timestamp(cue.start, ".")} --> ${timestamp(cue.end, ".")}\n${cue.text}\n`).join("\n");
  return `WEBVTT\n\n${body}`;
}
