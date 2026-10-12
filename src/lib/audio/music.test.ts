import { describe, expect, it } from "vitest";
import { buildTimeMap } from "@/lib/timeline/timeMap";
import { DUCKED, duckAt, duckCurve, musicGain, musicPosition } from "./music";

const music = { volume: 0.8, fadeInMs: 1000, fadeOutMs: 1000, loop: false };

describe("music", () => {
  it("loops or stops at the end of the track", () => {
    expect(musicPosition({ loop: true }, 25_000, 10_000)).toBe(5_000);
    expect(musicPosition({ loop: false }, 5_000, 10_000)).toBe(5_000);
    expect(musicPosition({ loop: false }, 12_000, 10_000)).toBeNull();
  });

  it("applies volume and fades at the start and the end", () => {
    expect(musicGain(music, 0, 60_000, 30_000)).toBe(0);
    expect(musicGain(music, 10_000, 60_000, 30_000)).toBeCloseTo(0.8);
    expect(musicGain(music, 29_500, 60_000, 30_000)).toBeLessThan(0.8); // fading out with the video
    expect(musicGain(music, 9_500, 10_000, 30_000)).toBeLessThan(0.8); // …or with a shorter track
    expect(musicGain(music, 12_000, 10_000, 30_000)).toBe(0);
  });

  it("ducks under speech: quickly down, slowly back up", () => {
    // 10 s; speech from 2 s to 4 s (20 ms windows).
    const mask = new Uint8Array(500);
    mask.fill(1, 100, 200);
    const curve = duckCurve({ mask, windowMs: 20 }, buildTimeMap(10_000, []));
    expect(duckAt(curve, 1_000)).toBe(1);
    expect(duckAt(curve, 3_000)).toBeCloseTo(DUCKED, 5);
    expect(duckAt(curve, 4_200)).toBeGreaterThan(DUCKED); // releasing…
    expect(duckAt(curve, 4_200)).toBeLessThan(1);
    expect(duckAt(curve, 6_000)).toBe(1);
  });

  it("follows cuts: speech in cut footage doesn't duck", () => {
    const mask = new Uint8Array(500);
    mask.fill(1, 100, 200); // speech at 2–4 s, which is cut below
    const curve = duckCurve({ mask, windowMs: 20 }, buildTimeMap(10_000, [{ id: "t", type: "trim", start: 1_500, end: 4_500 }]));
    expect(Math.min(...curve)).toBe(1);
  });
});
