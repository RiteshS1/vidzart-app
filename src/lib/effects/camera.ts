// The "camera": which part of the recording is visible at a given moment.
//
// A zoom segment doesn't scale the whole composition; it crops the
// recording and stretches the crop to fill the same rounded frame (like a
// camera pushing in). Background, padding and corners stay put.
//
// For a zoom from `start` to `end` with scale S:
//
//   scale  1 ──ease in──▶ S ───────hold───────▶ S ──ease out──▶ 1
//          start   start+easeIn            end-easeOut        end
//
// The visible region is (1/scale) of the frame, centered on the target and
// clamped so it never goes past the frame's edges (no black borders).

import type { Segment, ZoomSegment } from "@/lib/project/types";
import { easeInOutCubic, lerp } from "./easing";

/** Normalized point: 0–1 across the source frame. */
export interface Point {
  x: number;
  y: number;
}

export interface Camera {
  /** 1 = whole frame visible; 2 = half the width/height visible. */
  scale: number;
  /** Center of the visible region, normalized and already clamped. */
  center: Point;
}

/** A crop of the source frame, normalized (0–1). */
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const IDENTITY_CAMERA: Camera = { scale: 1, center: { x: 0.5, y: 0.5 } };

/** Returns the cursor position at a source time, if an event log exists. */
export type CursorLookup = (sourceMs: number) => Point | null;

/** How far into its zoom-in (0→1→0) a segment is at time t. */
export function zoomAmount(zoom: ZoomSegment, t: number): number {
  if (t <= zoom.start || t >= zoom.end) return 0;
  const length = zoom.end - zoom.start;
  // If the segment is shorter than easeIn + easeOut, shrink both
  // proportionally so it still reaches (most of) its zoom and comes back.
  const fit = Math.min(1, length / Math.max(1, zoom.easeInMs + zoom.easeOutMs));
  const easeIn = zoom.easeInMs * fit;
  const easeOut = zoom.easeOutMs * fit;
  if (t < zoom.start + easeIn) return easeInOutCubic((t - zoom.start) / easeIn);
  if (t > zoom.end - easeOut) return easeInOutCubic((zoom.end - t) / easeOut);
  return 1;
}

export function cameraAt(
  segments: readonly Segment[],
  sourceMs: number,
  cursorAt?: CursorLookup,
): Camera {
  // Zooms don't overlap (spec), so at most one is active.
  const zoom = segments.find(
    (s): s is ZoomSegment => s.type === "zoom" && sourceMs > s.start && sourceMs < s.end,
  );
  if (!zoom) return IDENTITY_CAMERA;

  const amount = zoomAmount(zoom, sourceMs);
  const scale = lerp(1, zoom.scale, amount);
  const target =
    zoom.target.mode === "fixed"
      ? { x: zoom.target.x, y: zoom.target.y }
      : (cursorAt?.(sourceMs) ?? { x: 0.5, y: 0.5 }); // follow without events → center
  return { scale, center: clampCenter(target, scale) };
}

/** Keeps the visible region inside the frame. */
export function clampCenter(center: Point, scale: number): Point {
  const half = 0.5 / Math.max(1, scale);
  return {
    x: Math.min(1 - half, Math.max(half, center.x)),
    y: Math.min(1 - half, Math.max(half, center.y)),
  };
}

export function cameraViewport(camera: Camera): Viewport {
  const size = 1 / Math.max(1, camera.scale);
  return {
    x: camera.center.x - size / 2,
    y: camera.center.y - size / 2,
    width: size,
    height: size,
  };
}
