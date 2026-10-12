// Draws the caption showing at a source time, burned into the video: text
// (optionally upper-cased), on a box or with an outline, at the top, middle
// or bottom of the video, with the spoken word highlighted if asked. Part of
// renderFrame, so the export matches the preview.

import { cueAt } from "@/lib/captions/cues";
import type { CaptionCue, CaptionStyle, Captions } from "@/lib/project/types";
import type { Rect } from "./layout";
import type { Ctx2D } from "./renderFrame";
import { fontString } from "./text";

const DEFAULT_BOX = "rgba(0, 0, 0, 0.72)";

interface Token {
  text: string;
  /** Index into cue.words, for highlighting; -1 when there's no timing. */
  word: number;
}

export function drawCaption(ctx: Ctx2D, captions: Captions, sourceTime: number, video: Rect, unit: number): void {
  if (!captions.visible) return;
  const cue = cueAt(captions.cues, sourceTime);
  if (!cue?.text.trim()) return;
  const style = captions.style;

  const size = Math.max(8, style.size * unit);
  ctx.save();
  ctx.font = fontString({ font: style.font ?? "sans", weight: style.weight ?? 600, size: 0, color: "", align: "center" }, size);
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";

  const tokens = tokensOf(cue, style);
  const lines = balancedLines(ctx, tokens, video.width * 0.86);
  const lineHeight = size * 1.3;
  // Captions made before styles existed have neither a background nor an
  // outline: they get the classic dark box they always had.
  const box = style.background === undefined ? (style.outline ? null : DEFAULT_BOX) : style.background;
  const hasBox = Boolean(box);
  const padX = hasBox ? size * 0.6 : 0;
  const padY = hasBox ? size * 0.35 : 0;
  const widths = lines.map((line) => lineWidth(ctx, line));
  const boxWidth = Math.max(...widths) + padX * 2;
  const boxHeight = lines.length * lineHeight + padY * 2;
  const margin = Math.max(size * 0.8, video.height * 0.05);
  const cx = video.x + video.width / 2;
  const top =
    style.position === "top"
      ? video.y + margin
      : style.position === "middle"
        ? video.y + (video.height - boxHeight) / 2
        : video.y + video.height - margin - boxHeight;

  if (hasBox) {
    ctx.fillStyle = box!;
    ctx.beginPath();
    ctx.roundRect(cx - boxWidth / 2, top, boxWidth, boxHeight, size * 0.3);
    ctx.fill();
  }

  const color = style.color ?? "#ffffff";
  const timed = cue.words && cue.words.length > 0 ? cue.words : null;
  lines.forEach((line, row) => {
    let x = cx - widths[row]! / 2;
    const y = top + padY + lineHeight * (row + 0.5);
    for (const token of line) {
      const spoken = timed && style.highlight && token.word >= 0 ? timed[token.word] : null;
      const active = spoken ? sourceTime >= spoken.start && sourceTime < spoken.end : false;
      drawToken(ctx, token.text, x, y, active && style.highlight ? style.highlight : color, !hasBox, size);
      x += ctx.measureText(token.text).width;
    }
  });
  ctx.restore();
}

function drawToken(ctx: Ctx2D, text: string, x: number, y: number, color: string, outlined: boolean, size: number) {
  if (outlined) {
    // A dark stroke under the fill reads on bright and busy frames alike.
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(2, size * 0.18);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.85)";
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** Words of the cue (with trailing spaces), uppercased if asked. */
function tokensOf(cue: CaptionCue, style: CaptionStyle): Token[] {
  const fix = (t: string) => (style.uppercase ? t.toUpperCase() : t);
  if (cue.words && cue.words.length > 0 && style.highlight) {
    // Word timings may differ from the edited cue text (user fixed a typo):
    // only use them when the word count still matches, else no highlight.
    const shown = cue.text.trim().split(/\s+/);
    if (shown.length === cue.words.length) return shown.map((w, i) => ({ text: fix(w) + " ", word: i }));
  }
  return cue.text
    .trim()
    .split(/\s+/)
    .map((w) => ({ text: fix(w) + " ", word: -1 }));
}

function lineWidth(ctx: Ctx2D, line: Token[]): number {
  // Trailing space of the last token isn't visible, so it isn't counted.
  const full = line.reduce((sum, t) => sum + ctx.measureText(t.text).width, 0);
  const last = line.at(-1);
  return last ? full - ctx.measureText(" ").width : full;
}

/** Greedy wrap, then the narrowest width that needs no extra lines (balanced lines). */
function balancedLines(ctx: Ctx2D, tokens: Token[], maxWidth: number): Token[][] {
  const lines = greedy(ctx, tokens, maxWidth);
  if (lines.length < 2) return lines;
  let lo = 0;
  let hi = maxWidth;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (greedy(ctx, tokens, mid).length <= lines.length) hi = mid;
    else lo = mid;
  }
  return greedy(ctx, tokens, hi);
}

function greedy(ctx: Ctx2D, tokens: Token[], maxWidth: number): Token[][] {
  const lines: Token[][] = [];
  let line: Token[] = [];
  for (const token of tokens) {
    const next = [...line, token];
    if (line.length > 0 && lineWidth(ctx, next) > maxWidth) {
      lines.push(line);
      line = [token];
    } else line = next;
  }
  if (line.length > 0) lines.push(line);
  return lines;
}
