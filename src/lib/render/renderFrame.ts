// Draws one composed output frame: background → shadow → rounded video →
// blur boxes → shapes → cursor and click effects → shortcut badges → text
// overlays → captions → fades/transitions (black over everything).
//
// This is THE render function. The preview calls it on every animation frame
// with a <video> element as the source; the export worker (Phase 3) will call
// it with WebCodecs VideoFrames on an OffscreenCanvas. One function means the
// preview can't drift from the export.
//
// It must stay free of React, DOM lookups and globals so it can run in a
// worker: everything it needs comes in through its arguments.

import { cameraAt, cameraViewport, clampCenter, type CursorLookup } from "@/lib/effects/camera";
import type { CursorTrack } from "@/lib/effects/cursorTrack";
import type { Background, VidzProject } from "@/lib/project/types";
import { drawBlurs } from "./blur";
import { drawCaption } from "./captions";
import { fadeVisibility, filterCss, transitionAmount } from "./effects";
import { drawCursorLayer } from "./cursor";
import { drawKeystrokes } from "./keystrokes";
import { layoutFrame, type Size } from "./layout";
import { drawShapes } from "./shapes";
import { drawTexts } from "./text";

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface FrameInput {
  /** The decoded source frame, or null if none is available yet. */
  image: CanvasImageSource | null;
  /**
   * Its intrinsic size in pixels (CanvasImageSource has no uniform way to
   * ask). drawImage's source rectangle is measured in these pixels.
   */
  size: Size;
}

export interface FrameTiming {
  /** Source time of `frame`, used for time-based effects like zooms. */
  sourceTime: number;
  /** Cursor position lookup from events.json, for "follow" zooms. */
  cursorAt?: CursorLookup;
  /** The drawn cursor and click effects; absent for videos without events. */
  cursor?: CursorTrack;
  /**
   * Output time (after cuts/speed), its total, and the output moments of
   * cuts: fades and transitions happen in the edited video's time. Absent
   * = no fades/transitions (e.g. in thumbnails).
   */
  output?: { time: number; duration: number; cuts: readonly number[] };
}

export function renderFrame(
  ctx: Ctx2D,
  canvas: Size,
  frame: FrameInput,
  project: VidzProject,
  timing: FrameTiming,
): void {
  const { settings } = project;
  const layout = layoutFrame(canvas, frame.size, settings);
  const { video, cornerRadius, unit } = layout;

  ctx.save();
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  fillBackground(ctx, canvas, settings.background);

  // Shadow: Canvas only draws a shadow *with* a shape, so we fill the video's
  // rounded rect in black with the shadow enabled. The video drawn on top
  // covers the black fill; only the shadow around it stays visible.
  if (settings.shadow.enabled && settings.shadow.opacity > 0) {
    ctx.save();
    ctx.shadowColor = `rgba(0, 0, 0, ${settings.shadow.opacity})`;
    ctx.shadowBlur = settings.shadow.blur * unit;
    ctx.shadowOffsetY = settings.shadow.offsetY * unit;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.roundRect(video.x, video.y, video.width, video.height, cornerRadius);
    ctx.fill();
    ctx.restore();
  }

  // Rounded corners: clip to the rounded rect, then draw the frame into it.
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(video.x, video.y, video.width, video.height, cornerRadius);
  ctx.clip();
  const transition = timing.output
    ? transitionAmount(settings.transition, timing.output.cuts, timing.output.time)
    : 0;
  if (frame.image) {
    // The camera picks which part of the source is visible (zooms). We draw
    // only that crop, stretched over the whole video rect.
    let camera = cameraAt(project.segments, timing.sourceTime, timing.cursorAt);
    if (transition > 0 && settings.transition?.type === "zoom-punch") {
      // A quick push-in that peaks right at the cut and hides the jump.
      const scale = camera.scale * (1 + 0.18 * transition);
      camera = { scale, center: clampCenter(camera.center, scale) };
    }
    const crop = cameraViewport(camera);
    ctx.imageSmoothingQuality = "high";
    // Color look (+ a blur peaking on cuts) applies to the video only, not
    // the background around it.
    const blurPx = settings.transition?.type === "blur" ? transition * unit * 0.025 : 0;
    const look = filterCss(settings.filter);
    const filters = [look === "none" ? "" : look, blurPx > 0.3 ? `blur(${blurPx.toFixed(1)}px)` : ""].filter(Boolean).join(" ");
    if (filters) ctx.filter = filters;
    ctx.drawImage(
      frame.image,
      crop.x * frame.size.width,
      crop.y * frame.size.height,
      crop.width * frame.size.width,
      crop.height * frame.size.height,
      video.x,
      video.y,
      video.width,
      video.height,
    );
    ctx.filter = "none";
    // Blur boxes hide parts of the recording; they're under the cursor, so
    // the cursor stays visible while moving over a hidden area.
    drawBlurs(ctx, frame.image, frame.size, project.segments, timing.sourceTime, video, crop);
    // Arrows, boxes, spotlights: also in source space, under the cursor.
    drawShapes(ctx, project.segments, timing.sourceTime, video, crop, unit);
    // Cursor + click effects go on top of the video, inside the same rounded
    // clip, and through the same camera so they zoom with the page.
    if (timing.cursor) drawCursorLayer(ctx, timing.cursor, settings, timing.sourceTime, video, crop);
  } else {
    ctx.fillStyle = "#111";
    ctx.fillRect(video.x, video.y, video.width, video.height);
  }
  ctx.restore();

  // Shortcut badges ("⌘K") from the event log.
  if (timing.cursor) drawKeystrokes(ctx, timing.cursor, settings, timing.sourceTime, video, unit);

  // Text overlays: output-space, so outside the video clip and the camera.
  drawTexts(ctx, canvas, project.segments, timing.sourceTime);

  // Captions sit on top of everything and don't zoom with the camera.
  if (project.captions) drawCaption(ctx, project.captions, timing.sourceTime, video, unit);

  // Fade from/to black at the ends, and the dip-to-black transition at cuts:
  // black over the whole frame, so they work like a film edit.
  if (timing.output) {
    const visible = fadeVisibility(settings.fade, timing.output.time, timing.output.duration);
    const dip = settings.transition?.type === "dip-to-black" ? transition : 0;
    const black = 1 - visible * (1 - dip);
    if (black > 0.001) {
      ctx.fillStyle = `rgba(0, 0, 0, ${black})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  ctx.restore();
}

function fillBackground(ctx: Ctx2D, canvas: Size, background: Background): void {
  switch (background.type) {
    case "color":
      ctx.fillStyle = background.color;
      break;
    case "gradient": {
      // Same geometry as CSS linear-gradient(angle): 0° points up, 90° right,
      // and the gradient line is just long enough to reach the corners.
      const radians = (background.angle * Math.PI) / 180;
      const dx = Math.sin(radians);
      const dy = -Math.cos(radians);
      const half = (Math.abs(canvas.width * dx) + Math.abs(canvas.height * dy)) / 2;
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const gradient = ctx.createLinearGradient(cx - dx * half, cy - dy * half, cx + dx * half, cy + dy * half);
      gradient.addColorStop(0, background.from);
      gradient.addColorStop(1, background.to);
      ctx.fillStyle = gradient;
      break;
    }
    case "image":
      // Image backgrounds need the decoded image passed in; until that lands,
      // fall back to a neutral color rather than failing.
      ctx.fillStyle = "#1f1f24";
      break;
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
