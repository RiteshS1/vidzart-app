// Where things go on the timeline, which shows OUTPUT time: cut parts are
// gone (like in CapCut/VN) and sped-up parts are shorter. Segments are
// stored in source time, so every block is mapped through the time map.

import type { TrimSegment } from "@/lib/project/types";
import { sourceToOutput, type TimeMap } from "./timeMap";

export interface Span {
  /** Output ms. */
  start: number;
  end: number;
}

/**
 * The output span of a source range. Parts inside cuts collapse away; a
 * range that is entirely cut returns null (nothing to show).
 */
export function outputSpan(map: TimeMap, start: number, end: number): Span | null {
  const s = sourceToOutput(map, start);
  const e = sourceToOutput(map, end);
  return e - s > 0.5 ? { start: s, end: e } : null;
}

export interface Seam {
  /** Output ms where the cut footage used to be. */
  at: number;
  trim: TrimSegment;
}

/** One seam per cut: the point on the output timeline where it was removed. */
export function cutSeams(map: TimeMap, trims: readonly TrimSegment[]): Seam[] {
  return trims.map((trim) => ({ at: sourceToOutput(map, trim.start), trim })).sort((a, b) => a.at - b.at);
}
