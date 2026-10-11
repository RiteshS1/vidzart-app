// Draws the caption showing at a source time: white text on a dark rounded
// box, centered near the bottom (or top) of the video, like burned-in
// subtitles. Part of renderFrame, so the export matches the preview.

import { cueAt } from "@/lib/captions/cues";
import type { Captions } from "@/lib/project/types";
import type { Rect } from "./layout";
import type { Ctx2D } from "./renderFrame";

const FONT = '600 {size}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

export function drawCaption(ctx: Ctx2D, captions: Captions, sourceTime: number, video: Rect, unit: number): void {
  if (!captions.visible) return;
  const cue = cueAt(captions.cues, sourceTime);
  if (!cue?.text.trim()) return;

  const size = Math.max(8, captions.style.size * unit);
  ctx.save();
  ctx.font = FONT.replace("{size}", String(Math.round(size)));
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const lines = wrap(ctx, cue.text.trim(), video.width * 0.86);
  const lineHeight = size * 1.3;
  const padX = size * 0.6;
  const padY = size * 0.35;
  const boxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width)) + padX * 2;
  const boxHeight = lines.length * lineHeight + padY * 2;
  const margin = Math.max(size * 0.8, video.height * 0.05);
  const cx = video.x + video.width / 2;
  const top = captions.style.position === "top" ? video.y + margin : video.y + video.height - margin - boxHeight;

  ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
  ctx.beginPath();
  ctx.roundRect(cx - boxWidth / 2, top, boxWidth, boxHeight, size * 0.3);
  ctx.fill();
  ctx.fillStyle = "#fff";
  lines.forEach((line, i) => ctx.fillText(line, cx, top + padY + lineHeight * (i + 0.5)));
  ctx.restore();
}

/** Greedy word wrap to a maximum line width (in the current font). */
function wrap(ctx: Ctx2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}
