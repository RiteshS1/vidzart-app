import { describe, expect, it } from "vitest";
import { buildTimeMap, cutPoints } from "@/lib/timeline/timeMap";
import { fadeVisibility, filterCss, transitionAmount } from "./effects";

describe("effects", () => {
  it("builds filter strings that scale with intensity", () => {
    expect(filterCss(undefined)).toBe("none");
    expect(filterCss({ preset: "mono", intensity: 0 })).toBe("none");
    expect(filterCss({ preset: "mono", intensity: 1 })).toBe("grayscale(1) contrast(1.15)");
    expect(filterCss({ preset: "mono", intensity: 0.5 })).toBe("grayscale(0.5) contrast(1.075)");
  });

  it("fades in from and out to black", () => {
    const fade = { inMs: 1000, outMs: 500 };
    expect(fadeVisibility(fade, 0, 10_000)).toBe(0);
    expect(fadeVisibility(fade, 500, 10_000)).toBeCloseTo(0.5, 5);
    expect(fadeVisibility(fade, 5000, 10_000)).toBe(1);
    expect(fadeVisibility(fade, 10_000, 10_000)).toBe(0);
    expect(fadeVisibility(undefined, 0, 10_000)).toBe(1);
  });

  it("finds cuts (not speed changes) and peaks transitions on them", () => {
    const map = buildTimeMap(10_000, [
      { id: "t", type: "trim", start: 2000, end: 3000 },
      { id: "s", type: "speed", start: 5000, end: 6000, rate: 2 },
    ]);
    expect(cutPoints(map)).toEqual([2000]);
    const t = { type: "dip-to-black" as const, durationMs: 600 };
    expect(transitionAmount(t, [2000], 2000)).toBe(1);
    expect(transitionAmount(t, [2000], 2150)).toBeCloseTo(0.5, 5);
    expect(transitionAmount(t, [2000], 2400)).toBe(0);
    expect(transitionAmount({ type: "none", durationMs: 600 }, [2000], 2000)).toBe(0);
  });
});
