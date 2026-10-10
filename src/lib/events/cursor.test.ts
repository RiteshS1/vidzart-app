import { describe, expect, it } from "vitest";
import { createCursorLookup, normalizedSamples } from "./cursor";
import type { VidzEvent, VidzEvents } from "./types";

const log = (events: VidzEvent[], width = 1000, height = 500): VidzEvents => ({
  version: 1,
  viewport: { width, height, devicePixelRatio: 1 },
  startedAt: 0,
  events,
});

describe("normalizedSamples", () => {
  it("divides by the viewport, following resizes", () => {
    const samples = normalizedSamples(
      log([
        { t: 0, type: "move", x: 500, y: 250 },
        { t: 10, type: "resize", width: 2000, height: 1000, devicePixelRatio: 1 },
        { t: 20, type: "click", x: 500, y: 250, button: 0 },
      ]),
    );
    expect(samples).toEqual([
      { t: 0, type: "move", x: 0.5, y: 0.5 },
      { t: 20, type: "click", x: 0.25, y: 0.25 },
    ]);
  });
});

describe("createCursorLookup", () => {
  it("returns undefined without pointer events", () => {
    expect(createCursorLookup(log([]))).toBeUndefined();
  });

  it("interpolates between events without smoothing", () => {
    const lookup = createCursorLookup(
      log([
        { t: 0, type: "move", x: 0, y: 0 },
        { t: 1000, type: "move", x: 1000, y: 500 },
      ]),
      { smoothMs: 0 },
    )!;
    expect(lookup(500).x).toBeCloseTo(0.5, 2);
    expect(lookup(-100)).toEqual({ x: 0, y: 0 }); // before the log: first position
    expect(lookup(5000)).toEqual({ x: 1, y: 1 }); // after: last position
  });

  it("smooths a sudden jump", () => {
    const events: VidzEvent[] = [
      { t: 0, type: "move", x: 0, y: 0 },
      { t: 999, type: "move", x: 0, y: 0 },
      { t: 1000, type: "move", x: 1000, y: 0 },
      { t: 2000, type: "move", x: 1000, y: 0 },
    ];
    const raw = createCursorLookup(log(events), { smoothMs: 0 })!;
    const smooth = createCursorLookup(log(events), { smoothMs: 400 })!;
    expect(raw(1000).x).toBeCloseTo(1, 1);
    expect(smooth(1000).x).toBeCloseTo(0.5, 1); // centered window: halfway through the jump
    expect(smooth(1500).x).toBeCloseTo(1, 2); // settled
  });

  it("applies the events offset", () => {
    const lookup = createCursorLookup(
      log([
        { t: 0, type: "move", x: 0, y: 0 },
        { t: 1000, type: "move", x: 1000, y: 0 },
      ]),
      { smoothMs: 0, offsetMs: 500 },
    )!;
    // Source time 1000 → event time 500.
    expect(lookup(1000).x).toBeCloseTo(0.5, 2);
  });
});
