// Draws the cursor and click effects on top of the (possibly zoomed) video.
//
// Positions come from a CursorTrack in normalized source coordinates (0–1
// of the recorded frame). The camera shows only a crop of that frame,
// stretched over the video rect, so a point maps as:
//
//   canvasX = video.x + (p.x - crop.x) / crop.width * video.width
//
// Sizes are in CSS px of the recorded page (an arrow ~20px tall), scaled
// the same way, so the cursor grows with a zoom just like the page does.

import type { Point, Viewport } from "@/lib/effects/camera";
import type { CursorTrack } from "@/lib/effects/cursorTrack";
import { easeOutCubic } from "@/lib/effects/easing";
import type { ProjectSettings } from "@/lib/project/types";
import type { Rect } from "./layout";
import type { Ctx2D } from "./renderFrame";

const RIPPLE_MS = 550;
const PULSE_MS = 420;
const EFFECT_MS = Math.max(RIPPLE_MS, PULSE_MS);

// A classic arrow pointer, tip at (0, 0), in CSS px.
const ARROW: readonly [number, number][] = [
  [0, 0],
  [0, 17],
  [4.3, 13.1],
  [7.2, 19.6],
  [10, 18.4],
  [7.2, 12],
  [12.8, 12],
];

export function drawCursorLayer(
  ctx: Ctx2D,
  track: CursorTrack,
  settings: Pick<ProjectSettings, "cursor" | "clickEffect">,
  sourceTime: number,
  video: Rect,
  crop: Viewport,
): void {
  const toCanvas = (p: Point) => ({
    x: video.x + ((p.x - crop.x) / crop.width) * video.width,
    y: video.y + ((p.y - crop.y) / crop.height) * video.height,
  });
  // Canvas pixels per CSS pixel of the recorded page, right now.
  const css = track.cssPixelAt(sourceTime);
  const px = ((css.x * video.width) / crop.width + (css.y * video.height) / crop.height) / 2;

  if (settings.clickEffect.type !== "none") {
    for (const click of track.clicksIn(sourceTime - EFFECT_MS, sourceTime)) {
      const age = sourceTime - click.t;
      const at = toCanvas(click);
      if (settings.clickEffect.type === "ripple") drawRipple(ctx, at, age / RIPPLE_MS, px, settings.clickEffect.color);
      else drawPulse(ctx, at, age / PULSE_MS, px, settings.clickEffect.color);
    }
  }

  if (settings.cursor.visible) {
    const state = track.at(sourceTime);
    if (state.opacity > 0) {
      // Pressing squeezes the arrow a little: a subtle "I clicked" cue.
      const scale = settings.cursor.scale * px * (1 - 0.15 * state.pressed);
      drawArrow(ctx, toCanvas(state), scale, state.opacity);
    }
  }
}

function drawArrow(ctx: Ctx2D, tip: Point, scale: number, opacity: number) {
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.translate(tip.x, tip.y);
  ctx.scale(scale, scale);
  ctx.beginPath();
  for (const [x, y] of ARROW) ctx.lineTo(x, y);
  ctx.closePath();
  ctx.lineJoin = "round";
  // A soft drop shadow lifts the cursor off busy or white pages.
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 3 * scale;
  ctx.shadowOffsetY = 1 * scale;
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.shadowColor = "transparent";
  // Black arrow with a white outline, like macOS: visible on any background.
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = "#fff";
  ctx.stroke();
  ctx.restore();
}

function drawRipple(ctx: Ctx2D, at: Point, progress: number, px: number, color: string) {
  if (progress < 0 || progress >= 1) return;
  const eased = easeOutCubic(progress);
  const radius = (6 + 26 * eased) * px;
  ctx.save();
  ctx.globalAlpha = (1 - progress) * 0.9;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.globalAlpha *= 0.25;
  ctx.fill();
  ctx.globalAlpha /= 0.25;
  ctx.lineWidth = 3 * px * (1 - progress * 0.5);
  ctx.strokeStyle = color;
  // A faint dark halo so a white ripple still shows on a white page.
  ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
  ctx.shadowBlur = 4 * px;
  ctx.stroke();
  ctx.restore();
}

function drawPulse(ctx: Ctx2D, at: Point, progress: number, px: number, color: string) {
  if (progress < 0 || progress >= 1) return;
  // Grows quickly then shrinks away: a soft "tap" dot.
  const size = Math.sin(Math.PI * Math.min(1, progress * 1.2)) * 18 * px;
  if (size <= 0) return;
  ctx.save();
  ctx.globalAlpha = 0.45 * (1 - progress);
  ctx.beginPath();
  ctx.arc(at.x, at.y, size, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 4 * px;
  ctx.fill();
  ctx.restore();
}
