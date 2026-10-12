import { describe, expect, it } from "vitest";
import { simulateFollowPath } from "./cameraPath";

const zoom = { start: 0, end: 4000, scale: 2 };

describe("simulateFollowPath", () => {
  it("doesn't move for small cursor movements inside the dead zone", () => {
    // Jitter of ±0.05 around the middle; at 2× the free zone is ±0.125.
    const path = simulateFollowPath(zoom, (t) => ({ x: 0.5 + 0.05 * Math.sin(t / 50), y: 0.5 }));
    for (let t = 0; t <= 4000; t += 100) expect(path.at(t).x).toBeCloseTo(0.5, 2);
  });

  it("pans smoothly to a cursor that moved away, without overshooting", () => {
    // Cursor jumps from the middle to x = 0.9 at t = 500.
    const path = simulateFollowPath(zoom, (t) => ({ x: t < 500 ? 0.5 : 0.9, y: 0.5 }));
    const target = 0.9 - 0.125; // just enough to bring it back into the dead zone
    expect(path.at(500).x).toBeCloseTo(0.5, 2);
    expect(path.at(700).x).toBeGreaterThan(0.55); // moving…
    expect(path.at(700).x).toBeLessThan(target);
    let previous = 0;
    for (let t = 500; t <= 4000; t += 50) {
      const x = path.at(t).x;
      expect(x).toBeGreaterThanOrEqual(previous - 1e-9); // monotonic: no wobble
      expect(x).toBeLessThanOrEqual(target + 1e-6); // no overshoot
      previous = x;
    }
    expect(path.at(4000).x).toBeCloseTo(target, 2); // settled
  });

  it("starts aimed at the cursor", () => {
    const path = simulateFollowPath(zoom, () => ({ x: 0.2, y: 0.8 }));
    expect(path.at(0)).toEqual({ x: 0.2, y: 0.8 });
  });
});
