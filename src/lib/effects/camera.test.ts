import { describe, expect, it } from "vitest";
import type { ZoomSegment } from "@/lib/project/types";
import { cameraAt, cameraViewport, clampCenter, zoomAmount } from "./camera";
import { easeInOutCubic } from "./easing";

const zoom = (overrides: Partial<ZoomSegment> = {}): ZoomSegment => ({
  id: "z",
  type: "zoom",
  start: 1_000,
  end: 5_000,
  scale: 2,
  target: { mode: "fixed", x: 0.5, y: 0.5 },
  easeInMs: 500,
  easeOutMs: 500,
  ...overrides,
});

describe("easeInOutCubic", () => {
  it("starts at 0, ends at 1, is symmetric", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
    expect(easeInOutCubic(0.25) + easeInOutCubic(0.75)).toBeCloseTo(1);
  });
});

describe("zoomAmount", () => {
  it("eases in, holds, eases out", () => {
    const z = zoom();
    expect(zoomAmount(z, 900)).toBe(0);
    expect(zoomAmount(z, 1_250)).toBe(0.5);
    expect(zoomAmount(z, 3_000)).toBe(1);
    expect(zoomAmount(z, 4_750)).toBe(0.5);
    expect(zoomAmount(z, 5_000)).toBe(0);
  });

  it("shrinks the easing for very short segments", () => {
    const z = zoom({ start: 0, end: 400 }); // shorter than 500 + 500
    expect(zoomAmount(z, 200)).toBeCloseTo(1);
    expect(zoomAmount(z, 100)).toBeGreaterThan(0);
  });
});

describe("cameraAt", () => {
  it("is the identity outside zooms", () => {
    expect(cameraAt([zoom()], 500)).toEqual({ scale: 1, center: { x: 0.5, y: 0.5 } });
  });

  it("reaches the full scale at the hold", () => {
    expect(cameraAt([zoom({ scale: 3 })], 3_000).scale).toBe(3);
  });

  it("clamps the target so the crop stays inside the frame", () => {
    const camera = cameraAt([zoom({ target: { mode: "fixed", x: 0.95, y: 0.02 } })], 3_000);
    expect(camera.center).toEqual({ x: 0.75, y: 0.25 });
    const viewport = cameraViewport(camera);
    expect(viewport.x + viewport.width).toBeCloseTo(1);
    expect(viewport.y).toBeCloseTo(0);
  });

  it("follows the cursor when asked, or centers without events", () => {
    const follow = zoom({ target: { mode: "follow" } });
    expect(cameraAt([follow], 3_000, () => ({ x: 0.3, y: 0.6 })).center).toEqual({ x: 0.3, y: 0.6 });
    expect(cameraAt([follow], 3_000).center).toEqual({ x: 0.5, y: 0.5 });
  });
});

describe("clampCenter", () => {
  it("allows any center at scale 1 only at the middle", () => {
    expect(clampCenter({ x: 0, y: 1 }, 1)).toEqual({ x: 0.5, y: 0.5 });
  });
});
