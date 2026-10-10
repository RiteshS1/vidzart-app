// Geometry for the composed frame: how big the output canvas is and where
// the recording sits inside it. Pure math, shared by preview and export.

import type { AspectRatio, ProjectSettings } from "@/lib/project/types";

export interface Size {
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Width ÷ height of the output for an aspect-ratio setting. */
export function outputAspect(aspectRatio: AspectRatio, source: Size): number {
  switch (aspectRatio) {
    case "16:9":
      return 16 / 9;
    case "9:16":
      return 9 / 16;
    case "1:1":
      return 1;
    case "4:3":
      return 4 / 3;
    case "source":
      return source.width / source.height;
  }
}

/**
 * Output size in pixels for a given aspect, with the longer side equal to
 * `longSide` and both sides even (H.264 encoders require even dimensions).
 */
export function outputSize(aspect: number, longSide: number): Size {
  const even = (n: number) => Math.max(2, Math.round(n / 2) * 2);
  return aspect >= 1
    ? { width: even(longSide), height: even(longSide / aspect) }
    : { width: even(longSide * aspect), height: even(longSide) };
}

/** Largest rect of aspect `inner` that fits inside `outer`, centered. */
export function fitRect(outer: Rect, inner: Size): Rect {
  const scale = Math.min(outer.width / inner.width, outer.height / inner.height);
  const width = inner.width * scale;
  const height = inner.height * scale;
  return {
    x: outer.x + (outer.width - width) / 2,
    y: outer.y + (outer.height - height) / 2,
    width,
    height,
  };
}

export interface FrameLayout {
  /** Where the recording is drawn on the canvas. */
  video: Rect;
  cornerRadius: number;
  /** Converts a "fraction of the shorter side" setting into canvas pixels. */
  unit: number;
}

export function layoutFrame(canvas: Size, source: Size, settings: ProjectSettings): FrameLayout {
  // Settings are fractions of the canvas's shorter side, so a project looks
  // identical in a 600px preview and a 4K export.
  const unit = Math.min(canvas.width, canvas.height);
  const pad = settings.padding * unit;
  const area: Rect = {
    x: pad,
    y: pad,
    width: Math.max(1, canvas.width - pad * 2),
    height: Math.max(1, canvas.height - pad * 2),
  };
  const video = fitRect(area, source);
  // A radius larger than half the short side would make the shape invalid.
  const cornerRadius = Math.min(settings.cornerRadius * unit, Math.min(video.width, video.height) / 2);
  return { video, cornerRadius, unit };
}
