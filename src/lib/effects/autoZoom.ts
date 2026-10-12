// Generates zoom segments from the clicks in events.json.
//
// The idea (what a human editor would do): when someone clicks, the viewer
// should be looking closely at where the click happens. So:
//
//   1. Group clicks that are close in time AND in space: a burst of clicks
//      in one form becomes one zoom instead of a jittery series.
//   2. For each group, zoom in a little BEFORE the first click (so the ease-in
//      has finished when the click happens) and hold a little AFTER the last.
//   3. Follow the cursor while zoomed in (the Cursorful / Screen Studio
//      feel; see cameraPath.ts), or with `follow: false` aim at the middle of
//      the group, capping the scale so every click in it stays on screen.
//   4. Never overlap: if two groups' zooms would overlap, split the time
//      between them at the midpoint.

import { normalizedSamples } from "@/lib/events/cursor";
import type { VidzEvents } from "@/lib/events/types";
import { newSegmentId } from "@/lib/project/segments";
import type { ZoomSegment } from "@/lib/project/types";

export interface AutoZoomOptions {
  /** Desired zoom level. Lowered per group if its clicks are spread out. */
  scale: number;
  /** Start zooming this long before the first click. */
  leadInMs: number;
  /** Keep the zoom this long after the last click. */
  holdMs: number;
  /** Clicks further apart in time than this start a new zoom. */
  mergeGapMs: number;
  /** Clicks further apart in space than this (fraction of frame) start a new zoom. */
  maxSpread: number;
  /** Extra room around a group's clicks, as a fraction of the frame. */
  margin: number;
  /** Groups that would zoom less than this are skipped (not worth it). */
  minScale: number;
  easeMs: number;
  /** project.source.eventsOffsetMs */
  offsetMs: number;
  /** Zooms follow the cursor (true) or point at the middle of their clicks. */
  follow: boolean;
}

export const DEFAULT_AUTO_ZOOM: AutoZoomOptions = {
  scale: 1.8,
  leadInMs: 800,
  holdMs: 1_800,
  mergeGapMs: 2_500,
  maxSpread: 0.35,
  margin: 0.2,
  minScale: 1.25,
  easeMs: 700,
  offsetMs: 0,
  follow: true,
};

interface Click {
  t: number;
  x: number;
  y: number;
}

export function generateAutoZooms(
  log: VidzEvents,
  durationMs: number,
  options: Partial<AutoZoomOptions> = {},
): ZoomSegment[] {
  const o = { ...DEFAULT_AUTO_ZOOM, ...options };

  // Normalized press positions (normalizedSamples accounts for resizes),
  // shifted onto the video's timeline. Button presses ("down") rather than
  // "click" events: a double or triple click is several presses a few
  // hundred ms apart, which the grouping below turns into ONE zoom. Logs
  // without "down" events (older/hand-made ones) fall back to clicks.
  const samples = normalizedSamples(log);
  const pressType = samples.some((s) => s.type === "down") ? "down" : "click";
  const clicks: Click[] = samples
    .filter((sample) => sample.type === pressType)
    .map((sample) => ({ t: sample.t + o.offsetMs, x: sample.x, y: sample.y }))
    .filter((click) => click.t >= 0 && click.t <= durationMs);

  // 1. group
  const groups: Click[][] = [];
  for (const click of clicks) {
    const group = groups.at(-1);
    if (group && click.t - group.at(-1)!.t <= o.mergeGapMs && spread([...group, click]) <= o.maxSpread) {
      group.push(click);
    } else {
      groups.push([click]);
    }
  }

  // 2–3. one zoom per group
  const zooms: ZoomSegment[] = [];
  for (const group of groups) {
    const box = bounds(group);
    // Following the cursor keeps every click in view by moving the camera,
    // so the scale only needs capping when the camera stays put.
    const scale = o.follow ? o.scale : Math.min(o.scale, 1 / (Math.max(box.width, box.height) + o.margin));
    if (scale < o.minScale) continue;
    zooms.push({
      id: newSegmentId(),
      type: "zoom",
      start: Math.max(0, group[0]!.t - o.leadInMs),
      end: Math.min(durationMs, group.at(-1)!.t + o.holdMs),
      scale: Math.round(scale * 10) / 10,
      target: o.follow ? { mode: "follow" } : { mode: "fixed", x: box.x + box.width / 2, y: box.y + box.height / 2 },
      easeInMs: o.easeMs,
      easeOutMs: o.easeMs,
      origin: "auto",
    });
  }

  // 4. resolve overlaps between neighbors: meet in the middle of the gap
  // between the earlier group's last click and the later group's first.
  for (let i = 1; i < zooms.length; i++) {
    const prev = zooms[i - 1]!;
    const next = zooms[i]!;
    if (next.start < prev.end) {
      const middle = (groups[i - 1]!.at(-1)!.t + groups[i]![0]!.t) / 2;
      prev.end = Math.max(prev.start, middle);
      next.start = Math.min(next.end, middle);
    }
  }
  return zooms.filter((z) => z.end - z.start >= 300);
}

function bounds(clicks: readonly Click[]) {
  const xs = clicks.map((c) => c.x);
  const ys = clicks.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

function spread(clicks: readonly Click[]): number {
  const box = bounds(clicks);
  return Math.max(box.width, box.height);
}
