// Keyboard shortcut badges ("⌘ ⇧ K"), from the key events in events.json
// (shortcuts only: plain typing is never recorded). Viewers of a demo can't
// see the keyboard, so pressed shortcuts are shown as keycaps for a moment.

import type { CursorTrack } from "@/lib/effects/cursorTrack";
import { clamp01 } from "@/lib/effects/easing";
import type { ProjectSettings } from "@/lib/project/types";
import type { Rect } from "./layout";
import type { Ctx2D } from "./renderFrame";

const SHOW_MS = 1500;
const FADE_IN_MS = 120;
const FADE_OUT_MS = 300;

const SYMBOLS: Record<string, string> = {
  Meta: "⌘",
  Ctrl: "⌃",
  Alt: "⌥",
  Shift: "⇧",
  Enter: "↵",
  Backspace: "⌫",
  Delete: "⌦",
  Escape: "esc",
  Tab: "⇥",
  ArrowLeft: "←",
  ArrowRight: "→",
  ArrowUp: "↑",
  ArrowDown: "↓",
  Space: "space",
};

/** "Meta+Shift+K" → ["⌘", "⇧", "K"] */
export function keycaps(combo: string): string[] {
  return combo.split("+").map((part) => SYMBOLS[part] ?? part);
}

export function drawKeystrokes(
  ctx: Ctx2D,
  track: CursorTrack,
  settings: Pick<ProjectSettings, "keystrokes">,
  sourceTime: number,
  video: Rect,
  unit: number,
): void {
  if (!settings.keystrokes?.visible) return;
  // The latest shortcut pressed within the last SHOW_MS.
  const press = track.keysIn(sourceTime - SHOW_MS, sourceTime).at(-1);
  if (!press) return;
  const age = sourceTime - press.t;
  const alpha = Math.min(clamp01(age / FADE_IN_MS), clamp01((SHOW_MS - age) / FADE_OUT_MS));
  if (alpha <= 0) return;

  const caps = keycaps(press.combo);
  const fontPx = Math.max(10, unit * 0.04);
  const pad = fontPx * 0.45;
  const gap = fontPx * 0.3;
  const height = fontPx * 1.7;
  ctx.save();
  ctx.font = `600 ${Math.round(fontPx)}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const widths = caps.map((c) => Math.max(height, ctx.measureText(c).width + pad * 2));
  const total = widths.reduce((a, b) => a + b, 0) + gap * (caps.length - 1);
  const margin = Math.max(fontPx, video.height * 0.05);
  const y = settings.keystrokes.position === "top" ? video.y + margin : video.y + video.height - margin - height;
  let x = video.x + video.width / 2 - total / 2;

  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  caps.forEach((cap, i) => {
    const w = widths[i]!;
    ctx.fillStyle = "rgba(17, 17, 24, 0.82)";
    ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
    ctx.shadowBlur = fontPx * 0.4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, height, fontPx * 0.35);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
    ctx.lineWidth = Math.max(1, fontPx * 0.06);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.fillText(cap, x + w / 2, y + height / 2);
    x += w + gap;
  });
  ctx.restore();
}
