import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "@/lib/project/defaults";
import { fitRect, layoutFrame, outputAspect, outputSize } from "./layout";

describe("outputAspect / outputSize", () => {
  it("uses the source aspect for 'source'", () => {
    expect(outputAspect("source", { width: 1000, height: 500 })).toBe(2);
  });

  it("produces even dimensions with the long side fixed", () => {
    expect(outputSize(16 / 9, 1920)).toEqual({ width: 1920, height: 1080 });
    expect(outputSize(9 / 16, 1920)).toEqual({ width: 1080, height: 1920 });
    const odd = outputSize(1.37, 1001);
    expect(odd.width % 2).toBe(0);
    expect(odd.height % 2).toBe(0);
  });
});

describe("fitRect", () => {
  it("letterboxes a wide source into a square", () => {
    expect(fitRect({ x: 0, y: 0, width: 100, height: 100 }, { width: 200, height: 100 })).toEqual({
      x: 0,
      y: 25,
      width: 100,
      height: 50,
    });
  });
});

describe("layoutFrame", () => {
  it("applies padding as a fraction of the shorter side", () => {
    const layout = layoutFrame(
      { width: 1920, height: 1080 },
      { width: 1920, height: 1080 },
      { ...DEFAULT_SETTINGS, padding: 0.1, cornerRadius: 0 },
    );
    // 10% of 1080 = 108px on every side; the 16:9 video then fits by height.
    expect(layout.video.y).toBeCloseTo(108);
    expect(layout.video.height).toBeCloseTo(864);
    expect(layout.video.width).toBeCloseTo(1536);
  });

  it("scales identically at different output sizes", () => {
    const source = { width: 1280, height: 720 };
    const small = layoutFrame({ width: 640, height: 360 }, source, DEFAULT_SETTINGS);
    const large = layoutFrame({ width: 3840, height: 2160 }, source, DEFAULT_SETTINGS);
    expect(large.video.x / 3840).toBeCloseTo(small.video.x / 640);
    expect(large.cornerRadius / 2160).toBeCloseTo(small.cornerRadius / 360);
  });
});
