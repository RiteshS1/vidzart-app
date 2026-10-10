// Pure helpers that return a NEW segments array (never mutate): the editor
// store keeps old arrays around for undo, so mutation would corrupt history.

import type { Segment, TrimSegment } from "./types";

/** Cuts shorter than this are almost certainly a mis-drag. */
export const MIN_TRIM_MS = 50;

export function newSegmentId(): string {
  return crypto.randomUUID();
}

/**
 * Adds a trim [start, end), merging it with trims it overlaps or touches, so
 * there is never more than one trim covering a moment (spec: trims must not
 * overlap each other).
 */
export function addTrim(
  segments: readonly Segment[],
  start: number,
  end: number,
  duration: number,
  id: string = newSegmentId(),
): Segment[] {
  let s = Math.max(0, Math.min(start, end));
  let e = Math.min(duration, Math.max(start, end));
  if (e - s < MIN_TRIM_MS) return [...segments];

  const kept: Segment[] = [];
  for (const segment of segments) {
    if (segment.type === "trim" && segment.start <= e && segment.end >= s) {
      s = Math.min(s, segment.start);
      e = Math.max(e, segment.end);
    } else {
      kept.push(segment);
    }
  }
  const trim: TrimSegment = { id, type: "trim", start: s, end: e };
  return [...kept, trim];
}

export function removeSegment(segments: readonly Segment[], id: string): Segment[] {
  return segments.filter((s) => s.id !== id);
}

export function trimsOf(segments: readonly Segment[]): TrimSegment[] {
  return segments
    .filter((s): s is TrimSegment => s.type === "trim")
    .sort((a, b) => a.start - b.start);
}
