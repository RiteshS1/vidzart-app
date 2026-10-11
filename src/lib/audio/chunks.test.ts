import { describe, expect, it } from "vitest";
import { quietSplitPoints } from "./chunks";

const RATE = 1000; // low rate keeps the test arrays small

describe("quietSplitPoints", () => {
  it("doesn't split short audio", () => {
    expect(quietSplitPoints(new Float32Array(10 * RATE), RATE)).toEqual([0, 10 * RATE]);
  });

  it("splits long audio at the quietest moment between 20s and 29s", () => {
    // 60 s of "speech" with a quiet gap at 24 s and another at 47 s.
    const samples = new Float32Array(60 * RATE).map((_, i) => 0.3 * Math.sin(i));
    for (const gap of [24, 47]) samples.fill(0, gap * RATE, gap * RATE + 200);
    const points = quietSplitPoints(samples, RATE);
    expect(points[0]).toBe(0);
    expect(points.at(-1)).toBe(60 * RATE);
    expect(points[1]! / RATE).toBeGreaterThanOrEqual(24);
    expect(points[1]! / RATE).toBeLessThan(24.2);
    expect(points[2]! / RATE).toBeGreaterThanOrEqual(47);
    expect(points[2]! / RATE).toBeLessThan(47.2);
  });
});
