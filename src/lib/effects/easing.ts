// Easing curves map linear progress (0→1) to "felt" progress (0→1).
// Ease-in-out starts slow, speeds up, and settles gently, the motion
// people read as smooth and intentional (it's what camera operators do).

export type Easing = (t: number) => number;

export const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Cubic ease-in-out: gentle start and end, quick middle. */
export const easeInOutCubic: Easing = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
};

/** Linear interpolation between a and b. */
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Cubic ease-out: fast start, gentle stop (expanding ripples). */
export const easeOutCubic: Easing = (t) => 1 - (1 - clamp01(t)) ** 3;
