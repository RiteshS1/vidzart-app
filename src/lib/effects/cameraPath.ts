// How a "follow cursor" zoom moves the camera: the Cursorful / Screen
// Studio feel.
//
// Pointing the camera straight at the cursor every frame feels nervous:
// every small hand movement shakes the whole picture. Instead:
//
//   1. Dead zone: the camera only moves when the cursor leaves the middle
//      part of what's visible (DEAD_ZONE of the view). Small movements
//      inside it don't move the camera at all.
//   2. Spring: when it does move, the center is pulled toward the target by
//      a critically damped spring: it starts quickly, then settles without
//      overshooting or wobbling (like a camera operator panning).
//
// The path is simulated once per zoom at 60 steps per second, from the
// zoom's start to its end, and then looked up (interpolated) per frame. So
// it's deterministic: the preview and the export show the same motion.

import type { ZoomSegment } from "@/lib/project/types";
import type { CursorLookup, Point } from "./camera";

const STEP_MS = 1000 / 60;
/** Fraction of the visible area (around its center) the cursor may roam freely. */
export const DEAD_ZONE = 0.5;
/** Spring stiffness (rad/s). Higher = snappier. ~6 settles in about half a second. */
const OMEGA = 6;

export interface CameraPath {
  at(sourceMs: number): Point;
}

export function simulateFollowPath(zoom: Pick<ZoomSegment, "start" | "end" | "scale">, cursorAt: CursorLookup): CameraPath {
  const steps = Math.max(1, Math.ceil((zoom.end - zoom.start) / STEP_MS) + 1);
  const xs = new Float64Array(steps);
  const ys = new Float64Array(steps);
  // The dead zone's half-size in frame units: the view is 1/scale wide.
  const free = (0.5 / Math.max(1, zoom.scale)) * DEAD_ZONE;
  const dt = STEP_MS / 1000;

  const start = cursorAt(zoom.start) ?? { x: 0.5, y: 0.5 };
  let cx = start.x;
  let cy = start.y;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < steps; i++) {
    const cursor = cursorAt(zoom.start + i * STEP_MS) ?? { x: cx, y: cy };
    // Target = the nearest center that puts the cursor back inside the dead zone.
    const tx = cx + excess(cursor.x - cx, free);
    const ty = cy + excess(cursor.y - cy, free);
    // Critically damped spring (damping ratio 1): a = ω²·(target − x) − 2ω·v.
    vx += (OMEGA * OMEGA * (tx - cx) - 2 * OMEGA * vx) * dt;
    vy += (OMEGA * OMEGA * (ty - cy) - 2 * OMEGA * vy) * dt;
    cx += vx * dt;
    cy += vy * dt;
    xs[i] = cx;
    ys[i] = cy;
  }

  return {
    at(sourceMs) {
      const position = Math.min(Math.max((sourceMs - zoom.start) / STEP_MS, 0), steps - 1);
      const i = Math.floor(position);
      const j = Math.min(i + 1, steps - 1);
      const f = position - i;
      return { x: xs[i]! + (xs[j]! - xs[i]!) * f, y: ys[i]! + (ys[j]! - ys[i]!) * f };
    },
  };
}

/** How far `offset` is outside [-free, free] (0 inside). */
function excess(offset: number, free: number): number {
  if (offset > free) return offset - free;
  if (offset < -free) return offset + free;
  return 0;
}

/**
 * Paths are cached per zoom object. Segments are immutable (edits make new
 * objects), so a changed zoom is a new key and old ones are garbage
 * collected with it.
 */
const cache = new WeakMap<ZoomSegment, WeakMap<CursorLookup, CameraPath>>();
export function followPath(zoom: ZoomSegment, cursorAt: CursorLookup): CameraPath {
  let byCursor = cache.get(zoom);
  if (!byCursor) cache.set(zoom, (byCursor = new WeakMap()));
  let path = byCursor.get(cursorAt);
  if (!path) byCursor.set(cursorAt, (path = simulateFollowPath(zoom, cursorAt)));
  return path;
}
