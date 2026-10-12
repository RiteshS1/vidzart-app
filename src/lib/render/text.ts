// Text overlays (titles, callouts, lower thirds), drawn by renderFrame.
//
// Positions are in OUTPUT canvas space, so a title stays put while a zoom
// moves the camera underneath it. Sizes are fractions of the canvas's shorter
// side, so the same project looks the same at 720p and 4K.
//
// Fonts: the export runs in a worker, which can't use the page's web fonts
// without loading them separately. Generic system font stacks render the
// same in the page and the worker on one machine, so preview = export.

import type { Segment, TextSegment, TextStyle } from "@/lib/project/types";
import type { Size } from "./layout";
import type { Ctx2D } from "./renderFrame";
import { textState } from "./textAnimation";

const FONT_STACKS: Record<TextStyle["font"], string> = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: 'Georgia, "Times New Roman", Times, serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
  rounded: 'ui-rounded, "SF Pro Rounded", "Arial Rounded MT Bold", system-ui, sans-serif',
};

export interface TextLayout {
  lines: string[];
  /** Each line's width in px. */
  widths: number[];
  fontPx: number;
  lineHeight: number;
  padX: number;
  padY: number;
  /** The block (incl. background padding), in canvas px, before animation. */
  box: { x: number; y: number; width: number; height: number };
}

export function layoutText(ctx: Ctx2D, segment: TextSegment, canvas: Size): TextLayout {
  const unit = Math.min(canvas.width, canvas.height);
  const fontPx = Math.max(6, segment.style.size * unit);
  ctx.font = fontString(segment.style, fontPx);
  const maxWidth = canvas.width * 0.86;
  const lines = segment.text.split("\n").flatMap((line) => wrap(ctx, line, maxWidth));
  const widths = lines.map((l) => ctx.measureText(l).width);
  const lineHeight = fontPx * 1.2;
  const hasBox = Boolean(segment.style.background);
  const padX = hasBox ? fontPx * 0.5 : 0;
  const padY = hasBox ? fontPx * 0.28 : 0;
  const width = Math.max(1, ...widths) + padX * 2;
  const height = lines.length * lineHeight + padY * 2;
  const cx = segment.x * canvas.width;
  const cy = segment.y * canvas.height;
  return { lines, widths, fontPx, lineHeight, padX, padY, box: { x: cx - width / 2, y: cy - height / 2, width, height } };
}

export function drawTexts(ctx: Ctx2D, canvas: Size, segments: readonly Segment[], sourceTime: number): void {
  for (const segment of segments) {
    if (segment.type !== "text" || !segment.text.trim()) continue;
    const state = textState(segment, sourceTime);
    if (!state || state.alpha <= 0) continue;

    ctx.save();
    const layout = layoutText(ctx, segment, canvas);
    const { box, fontPx, lineHeight, padX, padY } = layout;
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    // Animate around the block's center.
    ctx.globalAlpha *= state.alpha;
    ctx.translate(cx, cy + state.dy * fontPx);
    ctx.scale(state.scale, state.scale);
    ctx.translate(-cx, -cy);

    if (segment.style.background) {
      ctx.fillStyle = segment.style.background;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.width, box.height, fontPx * 0.35);
      ctx.fill();
    } else {
      // No box: a soft shadow keeps white text readable on any frame.
      ctx.shadowColor = "rgba(0, 0, 0, 0.45)";
      ctx.shadowBlur = fontPx * 0.25;
      ctx.shadowOffsetY = fontPx * 0.05;
    }

    ctx.fillStyle = segment.style.color;
    ctx.textBaseline = "middle";
    ctx.textAlign = segment.style.align;
    const anchorX =
      segment.style.align === "left" ? box.x + padX : segment.style.align === "right" ? box.x + box.width - padX : cx;
    let remaining = state.chars;
    layout.lines.forEach((line, i) => {
      if (remaining <= 0) return;
      const visible = remaining === Infinity ? line : line.slice(0, remaining);
      if (remaining !== Infinity) remaining -= line.length;
      ctx.fillText(visible, anchorX, box.y + padY + lineHeight * (i + 0.5));
    });
    ctx.restore();
  }
}

export function fontString(style: TextStyle, px: number): string {
  return `${style.weight} ${Math.round(px)}px ${FONT_STACKS[style.font]}`;
}

function wrap(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/ +/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  lines.push(line);
  return lines;
}
