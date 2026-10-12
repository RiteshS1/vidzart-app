// Background music: where in the music file we are at an output moment, how
// loud it should be (volume, fades, ducking under speech). Pure functions,
// shared by the preview's <audio> element and the export's mixer, so both
// sound the same.

import { clamp01, easeInOutCubic } from "@/lib/effects/easing";
import type { MusicTrack } from "@/lib/project/types";
import { outputToSource, type TimeMap } from "@/lib/timeline/timeMap";

/** Music ms at an output moment, or null once a non-looping track has ended. */
export function musicPosition(music: Pick<MusicTrack, "loop">, outputMs: number, musicMs: number): number | null {
  if (musicMs <= 0 || outputMs < 0) return null;
  if (music.loop) return outputMs % musicMs;
  return outputMs < musicMs ? outputMs : null;
}

/** Volume × fades (the fade-out ends where the music or the video ends, whichever is first). */
export function musicGain(
  music: Pick<MusicTrack, "volume" | "fadeInMs" | "fadeOutMs" | "loop">,
  outputMs: number,
  musicMs: number,
  outputDuration: number,
): number {
  const end = music.loop ? outputDuration : Math.min(outputDuration, musicMs);
  if (outputMs < 0 || outputMs >= end) return 0;
  const fadeIn = music.fadeInMs > 0 ? clamp01(outputMs / music.fadeInMs) : 1;
  const fadeOut = music.fadeOutMs > 0 ? clamp01((end - outputMs) / music.fadeOutMs) : 1;
  return clamp01(music.volume) * easeInOutCubic(Math.min(fadeIn, fadeOut));
}

/** How far ducking turns the music down while someone speaks. */
export const DUCKED = 0.3;
export const DUCK_STEP_MS = 50;
const ATTACK_MS = 150; // how quickly it goes down when speech starts
const RELEASE_MS = 500; // how slowly it comes back after

/**
 * Ducking gain along the OUTPUT timeline, one value per DUCK_STEP_MS: 1
 * where nobody speaks, DUCKED during speech, with smooth transitions (fast
 * down, slow up, like a radio host's fader).
 */
export function duckCurve(speech: { mask: Uint8Array; windowMs: number }, map: TimeMap): Float32Array {
  const steps = Math.max(1, Math.ceil(map.outputDuration / DUCK_STEP_MS));
  const curve = new Float32Array(steps);
  let level = 0; // 0 = music full, 1 = fully ducked
  for (let i = 0; i < steps; i++) {
    const source = outputToSource(map, i * DUCK_STEP_MS);
    const talking = speech.mask[Math.floor(source / speech.windowMs)] === 1 ? 1 : 0;
    const rate = DUCK_STEP_MS / (talking > level ? ATTACK_MS : RELEASE_MS);
    level += Math.max(-rate, Math.min(rate, talking - level));
    curve[i] = 1 - (1 - DUCKED) * level;
  }
  return curve;
}

export function duckAt(curve: Float32Array | null, outputMs: number): number {
  if (!curve || curve.length === 0) return 1;
  return curve[Math.min(curve.length - 1, Math.max(0, Math.floor(outputMs / DUCK_STEP_MS)))]!;
}
