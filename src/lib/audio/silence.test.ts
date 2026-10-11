import { describe, expect, it } from "vitest";
import { detectSilences } from "./silence";

const RATE = 16_000;

/** Builds audio from [durationMs, loud?] parts: loud = a 220 Hz tone, quiet = faint noise. */
function audio(parts: [number, boolean][]): Float32Array {
  const total = parts.reduce((sum, [ms]) => sum + ms, 0);
  const out = new Float32Array((total * RATE) / 1000);
  let i = 0;
  let seed = 1;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5) * 0.002; // ≈ -60 dB
  for (const [ms, loud] of parts) {
    for (let n = 0; n < (ms * RATE) / 1000; n++, i++) {
      out[i] = (loud ? 0.3 * Math.sin((2 * Math.PI * 220 * i) / RATE) : 0) + noise();
    }
  }
  return out;
}

describe("detectSilences", () => {
  it("finds long pauses, keeping padding around speech", () => {
    const ranges = detectSilences(audio([[1000, true], [2000, false], [1000, true], [300, false], [1000, true]]), RATE);
    // Only the 2s pause (1000–3000) is long enough; 150 ms padding each side.
    expect(ranges).toEqual([{ start: 1150, end: 2850 }]);
  });

  it("cuts leading and trailing silence without padding at the edges", () => {
    const ranges = detectSilences(audio([[1000, false], [1000, true], [1000, false]]), RATE);
    expect(ranges).toEqual([
      { start: 0, end: 850 },
      { start: 2150, end: 3000 },
    ]);
  });

  it("does nothing without contrast (all silence or all sound)", () => {
    expect(detectSilences(audio([[3000, false]]), RATE)).toEqual([]);
    expect(detectSilences(audio([[3000, true]]), RATE)).toEqual([]);
  });

  it("respects minSilenceMs", () => {
    const pause = audio([[1000, true], [600, false], [1000, true]]);
    expect(detectSilences(pause, RATE)).toEqual([]);
    expect(detectSilences(pause, RATE, { minSilenceMs: 500 })).toHaveLength(1);
  });
});
