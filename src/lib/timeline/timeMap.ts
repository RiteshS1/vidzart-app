// Source time ↔ output time.
//
// The recording ("source") never changes. Trim segments cut ranges out and
// speed segments play ranges faster/slower, so a moment in the source lands
// at a different moment in the exported video ("output"). Everything that
// shows or uses time (timeline, preview, export) converts through here, so
// the rules live in exactly one place.
//
// We precompute a TimeMap: the source split into "pieces" that survive the
// trims, each with its own playback rate and its position on the output
// timeline. Example, 10s source with a trim from 2s–4s:
//
//   source  |0────2|xxxx|4──────────10|
//   output  |0────2|4−2=2──────────8|      (pieces: [0,2)→[0,2), [4,10)→[2,8))

import type { Segment } from "@/lib/project/types";

export interface TimePiece {
  sourceStart: number;
  sourceEnd: number;
  outputStart: number;
  outputEnd: number;
  /** Playback rate: 2 = twice as fast, so the piece is half as long in the output. */
  rate: number;
}

export interface TimeMap {
  pieces: TimePiece[];
  sourceDuration: number;
  outputDuration: number;
}

export function buildTimeMap(sourceDuration: number, segments: readonly Segment[]): TimeMap {
  const clamp = (t: number) => Math.min(Math.max(t, 0), sourceDuration);
  const trims = segments.filter((s) => s.type === "trim");
  const speeds = segments.filter((s) => s.type === "speed");

  // Every place where the rules can change is a boundary.
  const boundaries = new Set<number>([0, sourceDuration]);
  for (const s of [...trims, ...speeds]) {
    boundaries.add(clamp(s.start));
    boundaries.add(clamp(s.end));
  }
  const sorted = [...boundaries].sort((a, b) => a - b);

  const pieces: TimePiece[] = [];
  let output = 0;
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i]!;
    const end = sorted[i + 1]!;
    if (end <= start) continue;
    // The rules are constant inside an interval, so testing its midpoint is enough.
    const mid = (start + end) / 2;
    if (trims.some((t) => t.start <= mid && mid < t.end)) continue;
    const rate = speeds.find((s) => s.start <= mid && mid < s.end)?.rate ?? 1;
    const length = (end - start) / rate;

    const previous = pieces.at(-1);
    if (previous && previous.sourceEnd === start && previous.rate === rate) {
      // Same rate and touching: extend instead of adding a piece.
      previous.sourceEnd = end;
      previous.outputEnd += length;
    } else {
      pieces.push({ sourceStart: start, sourceEnd: end, outputStart: output, outputEnd: output + length, rate });
    }
    output += length;
  }

  return { pieces, sourceDuration, outputDuration: output };
}

/**
 * Where a source moment appears in the output. A moment inside a trimmed
 * range maps to the cut point (the start of the next kept piece).
 */
export function sourceToOutput(map: TimeMap, sourceTime: number): number {
  for (const piece of map.pieces) {
    if (sourceTime < piece.sourceStart) return piece.outputStart; // inside a cut before this piece
    if (sourceTime <= piece.sourceEnd) {
      return piece.outputStart + (sourceTime - piece.sourceStart) / piece.rate;
    }
  }
  return map.outputDuration;
}

/** Which source moment is shown at an output moment. */
export function outputToSource(map: TimeMap, outputTime: number): number {
  const { pieces } = map;
  if (pieces.length === 0) return 0;
  const t = Math.min(Math.max(outputTime, 0), map.outputDuration);
  // Half-open [outputStart, outputEnd): at a cut point we want the *next*
  // piece's first frame, not the frame just before the cut.
  const piece =
    pieces.find((p) => t >= p.outputStart && t < p.outputEnd) ?? pieces.at(-1)!;
  return piece.sourceStart + (t - piece.outputStart) * piece.rate;
}

/**
 * The piece containing a source moment, or null if it's trimmed away.
 * Used by playback to skip cuts and to set the playback rate.
 */
export function pieceAtSource(map: TimeMap, sourceTime: number): TimePiece | null {
  return (
    map.pieces.find((p) => sourceTime >= p.sourceStart && sourceTime < p.sourceEnd) ?? null
  );
}

/** First kept source moment at or after `sourceTime`, or null if none remain. */
export function nextKeptSource(map: TimeMap, sourceTime: number): number | null {
  for (const piece of map.pieces) {
    if (sourceTime < piece.sourceEnd) return Math.max(sourceTime, piece.sourceStart);
  }
  return null;
}
