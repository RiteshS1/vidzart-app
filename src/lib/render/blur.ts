// Blur boxes: hide an email, a token or a customer name in part of the
// recording. Each box is a normalized rect of the SOURCE frame, so it sticks
// to the content when a zoom moves the camera.
//
// Only the box's own region is redrawn through a blur filter (not the whole
// frame), which keeps it cheap enough for 60 fps preview.

import type { Viewport } from "@/lib/effects/camera";
import type { Segment } from "@/lib/project/types";
import type { Rect, Size } from "./layout";
import type { Ctx2D } from "./renderFrame";

export function drawBlurs(
  ctx: Ctx2D,
  image: CanvasImageSource,
  imageSize: Size,
  segments: readonly Segment[],
  sourceTime: number,
  video: Rect,
  crop: Viewport,
): void {
  for (const s of segments) {
    if (s.type !== "blur" || sourceTime < s.start || sourceTime >= s.end) continue;
    // Source rect → canvas rect, through the camera crop.
    const x = video.x + ((s.rect.x - crop.x) / crop.width) * video.width;
    const y = video.y + ((s.rect.y - crop.y) / crop.height) * video.height;
    const w = (s.rect.width / crop.width) * video.width;
    const h = (s.rect.height / crop.height) * video.height;
    if (w <= 0 || h <= 0) continue;
    // Strong enough that text is unreadable at any size: relative to the box.
    const radius = Math.max(6, Math.min(w, h) * 0.15);

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.filter = `blur(${radius}px)`;
    // Draw a slightly larger area than the box, so the blur near its edges
    // averages real pixels instead of fading to transparent.
    const m = radius * 2;
    const sx = (s.rect.x - (m / video.width) * crop.width) * imageSize.width;
    const sy = (s.rect.y - (m / video.height) * crop.height) * imageSize.height;
    const sw = (s.rect.width + ((2 * m) / video.width) * crop.width) * imageSize.width;
    const sh = (s.rect.height + ((2 * m) / video.height) * crop.height) * imageSize.height;
    ctx.drawImage(image, sx, sy, sw, sh, x - m, y - m, w + 2 * m, h + 2 * m);
    ctx.restore();
  }
}
