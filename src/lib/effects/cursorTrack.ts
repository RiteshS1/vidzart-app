// Everything the renderer needs to draw the cursor at a given source time:
// where it is (smoothed), whether a button is held, whether it should be
// faded out for being idle, and which clicks to draw effects for.
//
// Tab recordings don't contain the real mouse pointer (Chrome's tab capture
// leaves it out), so the editor draws one from events.json. That's also what
// makes it smooth: we draw the path we choose, not the jittery real one.
//
// Built once per (events, cursor settings), then queried every frame, so
// every query is a binary search or a lookup, never a scan of all events.

import { createCursorLookup } from "@/lib/events/cursor";
import type { MouseButton, VidzEvents } from "@/lib/events/types";
import type { VidzProject } from "@/lib/project/types";
import type { Point } from "./camera";
import { clamp01, easeInOutCubic, lerp } from "./easing";

/** settings.cursor.smoothing 1 = this wide a moving-average window. */
const MAX_SMOOTH_MS = 400;
/** Press/release animates over this long (cursor shrinks while pressed). */
const PRESS_MS = 80;
/** Idle fade-out duration once hideWhenIdleMs has passed. */
const FADE_MS = 300;

export interface CursorState extends Point {
  /** 0 = up, 1 = fully pressed. */
  pressed: number;
  /** 0–1, for hide-when-idle. */
  opacity: number;
}

export interface ClickMark extends Point {
  /** Source time (offset applied). */
  t: number;
  button: MouseButton;
}

export interface CursorTrack {
  at(sourceMs: number): CursorState;
  /** Clicks with from < t <= to, oldest first. */
  clicksIn(fromMs: number, toMs: number): ClickMark[];
  /** Size of one CSS pixel of the recorded page, normalized to the frame (it changes on resize). */
  cssPixelAt(sourceMs: number): Point;
}

export interface CursorTrackOptions {
  /** settings.cursor.smoothing, 0–1. */
  smoothing: number;
  /** project.source.eventsOffsetMs */
  offsetMs?: number;
  /** settings.cursor.hideWhenIdleMs; undefined = never hide. */
  hideWhenIdleMs?: number;
}

export function createCursorTrack(log: VidzEvents, options: CursorTrackOptions): CursorTrack | undefined {
  const offset = options.offsetMs ?? 0;
  const smoothMs = clamp01(options.smoothing) * MAX_SMOOTH_MS;
  const smooth = createCursorLookup(log, { smoothMs, offsetMs: offset });
  const raw = createCursorLookup(log, { smoothMs: 0, offsetMs: offset });
  if (!smooth || !raw) return undefined;

  // Viewport over time, for normalizing positions and the cursor's size.
  const viewports: { t: number; width: number; height: number }[] = [{ t: -Infinity, ...log.viewport }];
  // Presses: the ripple starts on "down" (feels instant), falling back to
  // "click" for logs that only have clicks.
  const downs: ClickMark[] = [];
  const clicks: ClickMark[] = [];
  const ups: { t: number; button: MouseButton }[] = [];
  const moves: number[] = [];
  for (const event of log.events) {
    const t = event.t + offset;
    if (event.type === "resize") {
      viewports.push({ t, width: event.width, height: event.height });
      continue;
    }
    const vp = viewports.at(-1)!;
    const point = { x: clamp01(event.x / vp.width), y: clamp01(event.y / vp.height) };
    if (event.type === "down") downs.push({ t, button: event.button, ...point });
    else if (event.type === "click") clicks.push({ t, button: event.button, ...point });
    else if (event.type === "up") ups.push({ t, button: event.button });
    if (event.type === "move" || event.type === "down") moves.push(t);
  }
  const marks = downs.length > 0 ? downs : clicks;

  // Smoothing makes the cursor lag/lead around a click, so the ripple would
  // appear next to it instead of under it. Near each press we blend from
  // the smoothed path to the exact one, so it lands precisely on target.
  const snapMs = Math.max(60, smoothMs * 0.6);
  const snapWeight = (t: number) => {
    let weight = 0;
    // Only presses within ±snapMs matter: binary search to the nearest ones.
    for (let i = Math.max(0, upperBound(marks, t - snapMs) - 1); i < marks.length && marks[i]!.t <= t + snapMs; i++) {
      weight = Math.max(weight, 1 - Math.abs(t - marks[i]!.t) / snapMs);
    }
    return easeInOutCubic(weight);
  };

  // Pressed amount: is there a down without its matching up before t?
  const pressedAt = (t: number) => {
    const i = upperBound(downs, t) - 1;
    if (i < 0) return 0;
    const down = downs[i]!;
    const up = ups.find((u) => u.t >= down.t && u.button === down.button);
    const pressIn = clamp01((t - down.t) / PRESS_MS);
    if (!up || t < up.t) return pressIn;
    return Math.min(pressIn, 1 - clamp01((t - up.t) / PRESS_MS));
  };

  const opacityAt = (t: number) => {
    if (options.hideWhenIdleMs === undefined) return 1;
    const i = upperBound(moves, t) - 1;
    if (i < 0) return 1;
    const idle = t - moves[i]!;
    return 1 - clamp01((idle - options.hideWhenIdleMs) / FADE_MS);
  };

  return {
    at(t) {
      const s = smooth(t);
      const r = raw(t);
      const w = smoothMs > 0 ? snapWeight(t) : 0;
      return { x: lerp(s.x, r.x, w), y: lerp(s.y, r.y, w), pressed: pressedAt(t), opacity: opacityAt(t) };
    },
    clicksIn(from, to) {
      return marks.slice(upperBound(marks, from), upperBound(marks, to));
    },
    cssPixelAt(t) {
      const vp = viewports[upperBound(viewports, t) - 1] ?? viewports[0]!;
      return { x: 1 / vp.width, y: 1 / vp.height };
    },
  };
}

/** Index of the first item with time > t (items sorted by time). */
function upperBound(items: readonly (number | { t: number })[], t: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const item = items[mid]!;
    if ((typeof item === "number" ? item : item.t) <= t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Remembers the last track, rebuilding only when the inputs change. The
 * preview asks every frame; building is O(events), asking is O(log n).
 */
export function cursorTrackCache(log: VidzEvents | null) {
  let key = "";
  let track: CursorTrack | undefined;
  return (project: VidzProject): CursorTrack | undefined => {
    if (!log) return undefined;
    const { smoothing, hideWhenIdleMs } = project.settings.cursor;
    const offsetMs = project.source.eventsOffsetMs ?? 0;
    const next = `${smoothing}|${hideWhenIdleMs}|${offsetMs}`;
    if (next !== key) {
      key = next;
      track = createCursorTrack(log, { smoothing, hideWhenIdleMs, offsetMs });
    }
    return track;
  };
}
