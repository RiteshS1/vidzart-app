// Whole-picture effects: color filters, fades and transitions at cuts.
// Pure functions of settings and time, shared by the preview and the export.
//
// Transitions here are the kind that only need ONE frame at a time (dip to
// black, blur, zoom punch): the export decodes exactly one source frame per
// output frame, and a crossfade would need two.

import { clamp01, easeInOutCubic } from "@/lib/effects/easing";
import type { FilterPreset, ProjectSettings } from "@/lib/project/types";

/** A CSS/canvas filter string for a color look; "none" at intensity 0. */
export function filterCss(filter: ProjectSettings["filter"]): string {
  if (!filter || filter.preset === "none" || filter.intensity <= 0) return "none";
  const i = clamp01(filter.intensity);
  const n = (v: number) => Math.round(v * 1000) / 1000;
  const looks: Record<Exclude<FilterPreset, "none">, string> = {
    vivid: `saturate(${n(1 + 0.6 * i)}) contrast(${n(1 + 0.12 * i)})`,
    warm: `sepia(${n(0.35 * i)}) saturate(${n(1 + 0.25 * i)}) hue-rotate(${n(-8 * i)}deg)`,
    cool: `saturate(${n(1 + 0.1 * i)}) hue-rotate(${n(14 * i)}deg) brightness(${n(1 + 0.03 * i)})`,
    mono: `grayscale(${n(i)}) contrast(${n(1 + 0.15 * i)})`,
    cinematic: `contrast(${n(1 + 0.22 * i)}) saturate(${n(1 - 0.25 * i)}) brightness(${n(1 - 0.06 * i)})`,
  };
  return looks[filter.preset];
}

/** 0 = fully black, 1 = fully visible, for the fade in/out at the output's ends. */
export function fadeVisibility(fade: ProjectSettings["fade"], outputMs: number, outputDuration: number): number {
  if (!fade) return 1;
  const fadeIn = fade.inMs > 0 ? clamp01(outputMs / fade.inMs) : 1;
  const fadeOut = fade.outMs > 0 ? clamp01((outputDuration - outputMs) / fade.outMs) : 1;
  return easeInOutCubic(Math.min(fadeIn, fadeOut));
}

/** How strongly a cut transition applies now: 1 at a cut, 0 beyond half the duration away. */
export function transitionAmount(transition: ProjectSettings["transition"], cuts: readonly number[], outputMs: number): number {
  if (!transition || transition.type === "none" || transition.durationMs <= 0 || cuts.length === 0) return 0;
  const half = transition.durationMs / 2;
  let nearest = Infinity;
  for (const cut of cuts) nearest = Math.min(nearest, Math.abs(outputMs - cut));
  return easeInOutCubic(clamp01(1 - nearest / half));
}
