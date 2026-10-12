// Pure helpers that return a NEW segments array (never mutate): the editor
// store keeps old arrays around for undo, so mutation would corrupt history.

import type { BlurSegment, Segment, ShapeSegment, SpeedSegment, TextSegment, TrimSegment, ZoomSegment } from "./types";

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

// --- zooms ---------------------------------------------------------------

/** Zooms shorter than this can't ease in and out visibly. */
export const MIN_ZOOM_MS = 300;

export const DEFAULT_ZOOM: Omit<ZoomSegment, "id" | "start" | "end"> = {
  type: "zoom",
  scale: 2,
  target: { mode: "fixed", x: 0.5, y: 0.5 },
  easeInMs: 600,
  easeOutMs: 600,
  origin: "manual",
};

export function zoomsOf(segments: readonly Segment[]): ZoomSegment[] {
  return segments
    .filter((s): s is ZoomSegment => s.type === "zoom")
    .sort((a, b) => a.start - b.start);
}

/**
 * The free gap around `at` between other segments of the same type
 * (excluding `ignoreId`, the segment being moved). Segments of one type
 * must not overlap, so this is where a segment is allowed to be.
 */
export function freeGap(
  segments: readonly Segment[],
  type: Segment["type"],
  at: number,
  duration: number,
  ignoreId?: string,
): { start: number; end: number } | null {
  let start = 0;
  let end = duration;
  for (const s of segments) {
    if (s.type !== type || s.id === ignoreId) continue;
    if (at >= s.start && at < s.end) return null; // `at` is inside another one
    if (s.end <= at) start = Math.max(start, s.end);
    if (s.start > at) end = Math.min(end, s.start);
  }
  return { start, end };
}

/**
 * Adds a zoom over [start, end), shrunk to fit the free gap at `start` so it
 * never overlaps another zoom. Returns the input unchanged if there's no room.
 */
export function addZoom(
  segments: readonly Segment[],
  start: number,
  end: number,
  duration: number,
  overrides: Partial<Omit<ZoomSegment, "type" | "start" | "end">> = {},
): Segment[] {
  const s0 = Math.max(0, Math.min(start, end));
  const gap = freeGap(segments, "zoom", s0, duration);
  if (!gap) return [...segments];
  const s = Math.max(s0, gap.start);
  const e = Math.min(Math.max(start, end), gap.end);
  if (e - s < MIN_ZOOM_MS) return [...segments];
  const zoom: ZoomSegment = { ...DEFAULT_ZOOM, id: newSegmentId(), ...overrides, start: s, end: e };
  return [...segments, zoom];
}

/** Returns a new array with one segment's fields replaced. */
export function updateSegment<T extends Segment>(
  segments: readonly Segment[],
  id: string,
  patch: Partial<Omit<T, "id" | "type">>,
): Segment[] {
  return segments.map((s) => (s.id === id ? ({ ...s, ...patch } as Segment) : s));
}

// --- speed and blur -------------------------------------------------------

/** Shorter speed changes or blurs are almost certainly a mis-drag. */
export const MIN_RANGE_MS = 300;
export const SPEED_RATES = [1.5, 2, 4, 8] as const;
/** A centered box, a sensible start before the user draws the real one. */
export const DEFAULT_BLUR_RECT = { x: 0.35, y: 0.4, width: 0.3, height: 0.2 };

export function speedsOf(segments: readonly Segment[]): SpeedSegment[] {
  return segments.filter((s): s is SpeedSegment => s.type === "speed").sort((a, b) => a.start - b.start);
}

export function blursOf(segments: readonly Segment[]): BlurSegment[] {
  return segments.filter((s): s is BlurSegment => s.type === "blur").sort((a, b) => a.start - b.start);
}

/**
 * Adds a speed-up over [start, end), shrunk to the free gap at `start`
 * (speed segments must not overlap). Unchanged input if there's no room.
 */
export function addSpeed(segments: readonly Segment[], start: number, end: number, duration: number, rate = 2): Segment[] {
  const s0 = Math.max(0, Math.min(start, end));
  const gap = freeGap(segments, "speed", s0, duration);
  if (!gap) return [...segments];
  const s = Math.max(s0, gap.start);
  const e = Math.min(Math.max(start, end), gap.end);
  if (e - s < MIN_RANGE_MS) return [...segments];
  return [...segments, { id: newSegmentId(), type: "speed", start: s, end: e, rate }];
}

/** Adds a blur box over [start, end). Blurs MAY overlap (two things to hide at once). */
export function addBlur(
  segments: readonly Segment[],
  start: number,
  end: number,
  duration: number,
  rect = DEFAULT_BLUR_RECT,
): Segment[] {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(duration, Math.max(start, end));
  if (e - s < MIN_RANGE_MS) return [...segments];
  return [...segments, { id: newSegmentId(), type: "blur", start: s, end: e, rect: { ...rect } }];
}

// --- text -------------------------------------------------------------------

/** Ready-made text styles, offered as one-click presets in the Text tool. */
export const TEXT_PRESETS: { name: string; segment: Omit<TextSegment, "id" | "type" | "start" | "end"> }[] = [
  {
    name: "Title",
    segment: {
      text: "Your title",
      x: 0.5,
      y: 0.5,
      style: { font: "sans", size: 0.1, weight: 800, color: "#ffffff", align: "center" },
      animation: { in: "pop", out: "fade" },
    },
  },
  {
    name: "Subtitle",
    segment: {
      text: "A short subtitle",
      x: 0.5,
      y: 0.62,
      style: { font: "sans", size: 0.05, weight: 600, color: "#ffffff", align: "center" },
      animation: { in: "slide-up", out: "fade" },
    },
  },
  {
    name: "Callout",
    segment: {
      text: "Click here",
      x: 0.5,
      y: 0.2,
      style: { font: "rounded", size: 0.045, weight: 600, color: "#111118", background: "#ffffff", align: "center" },
      animation: { in: "pop", out: "fade" },
    },
  },
  {
    name: "Lower third",
    segment: {
      text: "Your name\nYour role",
      x: 0.24,
      y: 0.84,
      style: { font: "sans", size: 0.04, weight: 600, color: "#ffffff", background: "#6d5dfc", align: "left" },
      animation: { in: "slide-up", out: "fade" },
    },
  },
  {
    name: "Typewriter",
    segment: {
      text: "Let's build something",
      x: 0.5,
      y: 0.5,
      style: { font: "mono", size: 0.06, weight: 400, color: "#ffffff", align: "center" },
      animation: { in: "typewriter", out: "fade" },
    },
  },
];

export const DEFAULT_TEXT_MS = 3_000;

export function textsOf(segments: readonly Segment[]): TextSegment[] {
  return segments.filter((s): s is TextSegment => s.type === "text").sort((a, b) => a.start - b.start);
}

/** Adds a text overlay over [start, end). Texts may overlap each other. */
export function addText(
  segments: readonly Segment[],
  start: number,
  end: number,
  duration: number,
  preset = TEXT_PRESETS[0]!.segment,
): Segment[] {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(duration, Math.max(start, end));
  if (e - s < MIN_RANGE_MS) return [...segments];
  return [...segments, { id: newSegmentId(), type: "text", start: s, end: e, ...structuredClone(preset) }];
}

// --- shapes & highlights -------------------------------------------------------

export const SHAPE_KINDS: { kind: ShapeSegment["kind"]; label: string }[] = [
  { kind: "arrow", label: "Arrow" },
  { kind: "rect", label: "Box" },
  { kind: "ellipse", label: "Circle" },
  { kind: "spotlight", label: "Spotlight" },
];

const DEFAULT_SHAPE_RECT: Record<ShapeSegment["kind"], ShapeSegment["rect"]> = {
  // Arrows point down-right into the middle of the frame.
  arrow: { x: 0.3, y: 0.3, width: 0.15, height: 0.12 },
  rect: { x: 0.38, y: 0.4, width: 0.24, height: 0.2 },
  ellipse: { x: 0.4, y: 0.38, width: 0.2, height: 0.24 },
  spotlight: { x: 0.33, y: 0.33, width: 0.34, height: 0.34 },
};

export function shapesOf(segments: readonly Segment[]): ShapeSegment[] {
  return segments.filter((s): s is ShapeSegment => s.type === "shape").sort((a, b) => a.start - b.start);
}

/** Adds a shape over [start, end). Shapes may overlap each other. */
export function addShape(
  segments: readonly Segment[],
  start: number,
  end: number,
  duration: number,
  kind: ShapeSegment["kind"] = "rect",
): Segment[] {
  const s = Math.max(0, Math.min(start, end));
  const e = Math.min(duration, Math.max(start, end));
  if (e - s < MIN_RANGE_MS) return [...segments];
  const shape: ShapeSegment = {
    id: newSegmentId(),
    type: "shape",
    start: s,
    end: e,
    kind,
    rect: { ...DEFAULT_SHAPE_RECT[kind] },
    style: { color: kind === "spotlight" ? "#000000" : "#facc15", stroke: 0.008 },
  };
  return [...segments, shape];
}
