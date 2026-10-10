// Turns the raw event log into a smooth "where is the cursor" function.
//
// 1. Normalize: events are viewport CSS px; the video shows the viewport, so
//    a position in the frame (0–1) is simply x / viewport.width. The
//    viewport can change mid-recording (resize events), so we track it.
// 2. Resample to a fixed rate (60/s) by linear interpolation. Raw events
//    are irregular: none while the mouse rests, bursts while it moves.
// 3. Smooth with a centered moving average. Unlike a live app, we know the
//    future, so we can average both sides of t: smooth AND lag-free.

import type { Point } from "@/lib/effects/camera";
import type { VidzEvent, VidzEvents } from "./types";

const SAMPLE_MS = 1000 / 60;

export interface CursorSample extends Point {
  t: number;
  /** The event this position came from (move, click, …). */
  type: Exclude<VidzEvent["type"], "resize">;
}

/** Pointer positions from the log, normalized to 0–1 of the frame. */
export function normalizedSamples(log: VidzEvents): CursorSample[] {
  let { width, height } = log.viewport;
  const samples: CursorSample[] = [];
  for (const event of log.events) {
    if (event.type === "resize") {
      width = event.width;
      height = event.height;
      continue;
    }
    if (width <= 0 || height <= 0) continue;
    samples.push({
      t: event.t,
      type: event.type,
      x: Math.min(1, Math.max(0, event.x / width)),
      y: Math.min(1, Math.max(0, event.y / height)),
    });
  }
  return samples;
}

export interface CursorTrackOptions {
  /** Width of the smoothing window in ms (0 = raw). */
  smoothMs?: number;
  /** project.source.eventsOffsetMs: shifts event times onto the video. */
  offsetMs?: number;
}

/**
 * Returns undefined when the log has no pointer positions at all. (The
 * returned function never returns null, so it's also a valid CursorLookup.)
 */
export function createCursorLookup(
  log: VidzEvents,
  options: CursorTrackOptions = {},
): ((sourceMs: number) => Point) | undefined {
  const samples = normalizedSamples(log);
  if (samples.length === 0) return undefined;
  const smoothMs = options.smoothMs ?? 250;
  const offset = options.offsetMs ?? 0;

  // --- resample at a fixed rate -------------------------------------------
  const t0 = samples[0]!.t;
  const t1 = samples.at(-1)!.t;
  // ceil + 1 so the last sample lands exactly on the last event (clamped
  // below); floor would stop up to one sample short of it.
  const count = Math.max(1, Math.ceil((t1 - t0) / SAMPLE_MS) + 1);
  const xs = new Float64Array(count);
  const ys = new Float64Array(count);
  let j = 0;
  for (let i = 0; i < count; i++) {
    const t = Math.min(t0 + i * SAMPLE_MS, t1);
    while (j < samples.length - 2 && samples[j + 1]!.t <= t) j++;
    const a = samples[j]!;
    const b = samples[Math.min(j + 1, samples.length - 1)]!;
    const f = b.t > a.t ? Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t))) : 0;
    xs[i] = a.x + (b.x - a.x) * f;
    ys[i] = a.y + (b.y - a.y) * f;
  }

  // --- centered moving average via prefix sums (O(n)) ------------------------
  const half = Math.round(smoothMs / 2 / SAMPLE_MS);
  const smooth = (values: Float64Array) => {
    if (half === 0) return values;
    const prefix = new Float64Array(values.length + 1);
    for (let i = 0; i < values.length; i++) prefix[i + 1] = prefix[i]! + values[i]!;
    const out = new Float64Array(values.length);
    for (let i = 0; i < values.length; i++) {
      const lo = Math.max(0, i - half);
      const hi = Math.min(values.length - 1, i + half);
      out[i] = (prefix[hi + 1]! - prefix[lo]!) / (hi - lo + 1);
    }
    return out;
  };
  const sx = smooth(xs);
  const sy = smooth(ys);

  return (sourceMs: number): Point => {
    // event time = source time - offset
    const position = Math.min((sourceMs - offset - t0) / SAMPLE_MS, count - 1);
    if (position <= 0) return { x: sx[0]!, y: sy[0]! };
    if (position >= count - 1) return { x: sx[count - 1]!, y: sy[count - 1]! };
    const i = Math.floor(position);
    const f = position - i;
    return { x: sx[i]! + (sx[i + 1]! - sx[i]!) * f, y: sy[i]! + (sy[i + 1]! - sy[i]!) * f };
  };
}
