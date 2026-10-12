// How an animated text looks at a moment: pure math, shared by the preview
// and the export (and unit tested).

import { clamp01, easeOutCubic } from "@/lib/effects/easing";
import type { TextAnimation, TextSegment } from "@/lib/project/types";

export const IN_MS = 450;
export const OUT_MS = 300;
/** Typewriter speed: characters per second, but never longer than 1.5 s total. */
const TYPE_CPS = 28;

export interface TextState {
  alpha: number;
  /** Vertical offset as a fraction of the text size (slide-up starts below). */
  dy: number;
  scale: number;
  /** How many characters are visible (typewriter); Infinity = all. */
  chars: number;
}

/** "Back" easing: overshoots a little before settling, the "pop". */
const easeOutBack = (t: number) => {
  const c = 1.70158;
  const x = clamp01(t) - 1;
  return 1 + (c + 1) * x * x * x + c * x * x;
};

export function textState(segment: Pick<TextSegment, "start" | "end" | "text" | "animation">, t: number): TextState | null {
  if (t < segment.start || t >= segment.end) return null;
  const length = segment.end - segment.start;
  // Short texts get proportionally shorter animations.
  const fit = Math.min(1, length / (IN_MS + OUT_MS));
  const pIn = clamp01((t - segment.start) / (IN_MS * fit));
  const pOut = clamp01((segment.end - t) / (OUT_MS * fit));

  const state: TextState = { alpha: 1, dy: 0, scale: 1, chars: Infinity };
  apply(state, segment.animation.in, pIn, segment, t - segment.start);
  if (pOut < 1) apply(state, segment.animation.out, pOut, segment, Infinity);
  return state;
}

function apply(state: TextState, animation: TextAnimation, p: number, segment: Pick<TextSegment, "text">, elapsed: number) {
  switch (animation) {
    case "none":
      return;
    case "fade":
      state.alpha *= easeOutCubic(p);
      return;
    case "slide-up":
      state.alpha *= easeOutCubic(p);
      state.dy += (1 - easeOutCubic(p)) * 0.6;
      return;
    case "pop":
      state.alpha *= clamp01(p * 2);
      state.scale *= 0.6 + 0.4 * easeOutBack(p);
      return;
    case "typewriter": {
      if (elapsed === Infinity) {
        state.alpha *= easeOutCubic(p); // typing "out" just fades
        return;
      }
      const total = Math.min(1500, (segment.text.length / TYPE_CPS) * 1000);
      state.chars = Math.min(state.chars, Math.floor((elapsed / Math.max(1, total)) * segment.text.length));
      return;
    }
  }
}
