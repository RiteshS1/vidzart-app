// Arrows, boxes, circles and spotlights: annotations that point at things
// in the recording. Like blur boxes they live in SOURCE frame space, so an
// arrow keeps pointing at its button while a zoom moves the camera.
//
// Outlines "draw themselves" when they appear (a growing line dash), and
// everything fades out at the end, so annotations feel deliberate rather
// than popping in and out.

import type { Viewport } from "@/lib/effects/camera";
import { clamp01, easeInOutCubic, easeOutCubic } from "@/lib/effects/easing";
import type { Segment, ShapeSegment } from "@/lib/project/types";
import type { Rect } from "./layout";
import type { Ctx2D } from "./renderFrame";

const DRAW_MS = 400;
const FADE_OUT_MS = 250;

export function drawShapes(
  ctx: Ctx2D,
  segments: readonly Segment[],
  sourceTime: number,
  video: Rect,
  crop: Viewport,
  unit: number,
): void {
  const toCanvas = (x: number, y: number) => ({
    x: video.x + ((x - crop.x) / crop.width) * video.width,
    y: video.y + ((y - crop.y) / crop.height) * video.height,
  });
  for (const s of segments) {
    if (s.type !== "shape" || sourceTime < s.start || sourceTime >= s.end) continue;
    const length = s.end - s.start;
    const fit = Math.min(1, length / (DRAW_MS + FADE_OUT_MS));
    const drawn = easeInOutCubic(clamp01((sourceTime - s.start) / (DRAW_MS * fit)));
    const alpha = easeOutCubic(clamp01((s.end - sourceTime) / (FADE_OUT_MS * fit)));
    const a = toCanvas(s.rect.x, s.rect.y);
    const b = toCanvas(s.rect.x + s.rect.width, s.rect.y + s.rect.height);
    // Strokes scale with the zoom, like the content they annotate.
    const stroke = Math.max(1.5, s.style.stroke * unit) / Math.min(crop.width, crop.height);

    ctx.save();
    ctx.globalAlpha *= alpha;
    if (s.kind === "spotlight") drawSpotlight(ctx, s, a, b, video, drawn);
    else drawOutline(ctx, s, a, b, stroke, drawn);
    ctx.restore();
  }
}

type P = { x: number; y: number };

function drawSpotlight(ctx: Ctx2D, s: ShapeSegment, a: P, b: P, video: Rect, shown: number) {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  // Dim everything except a soft-cornered hole: "even-odd" fill leaves the
  // inner shape unpainted.
  ctx.beginPath();
  ctx.rect(video.x, video.y, video.width, video.height);
  ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.12);
  ctx.globalAlpha *= 0.62 * shown;
  ctx.fillStyle = s.style.color;
  ctx.fill("evenodd");
}

function drawOutline(ctx: Ctx2D, s: ShapeSegment, a: P, b: P, stroke: number, drawn: number) {
  ctx.lineWidth = stroke;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = s.style.color;
  // A dark glow keeps bright strokes visible on light pages.
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = stroke * 1.5;

  if (s.kind === "arrow") {
    const end = { x: a.x + (b.x - a.x) * drawn, y: a.y + (b.y - a.y) * drawn };
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    // The head grows in over the last part of the draw.
    const head = clamp01((drawn - 0.6) / 0.4) * stroke * 4.5;
    if (head > 0) {
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      ctx.beginPath();
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - head * Math.cos(angle - 0.5), end.y - head * Math.sin(angle - 0.5));
      ctx.moveTo(end.x, end.y);
      ctx.lineTo(end.x - head * Math.cos(angle + 0.5), end.y - head * Math.sin(angle + 0.5));
      ctx.stroke();
    }
    return;
  }

  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(b.x - a.x);
  const h = Math.abs(b.y - a.y);
  ctx.beginPath();
  let perimeter: number;
  if (s.kind === "ellipse") {
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, -Math.PI / 2, (3 * Math.PI) / 2);
    // Ramanujan's approximation of an ellipse's circumference.
    const rx = w / 2;
    const ry = h / 2;
    perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
  } else {
    ctx.roundRect(x, y, w, h, Math.min(w, h) * 0.08);
    perimeter = 2 * (w + h);
  }
  // Draw-on: a dash as long as the drawn part, then a gap for the rest.
  if (drawn < 1) ctx.setLineDash([perimeter * drawn, perimeter]);
  ctx.stroke();
}
