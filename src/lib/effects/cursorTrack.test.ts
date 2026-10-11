import { describe, expect, it } from "vitest";
import type { VidzEvent, VidzEvents } from "@/lib/events/types";
import { createCursorTrack } from "./cursorTrack";

const log = (events: VidzEvent[]): VidzEvents => ({
  version: 1,
  viewport: { width: 1000, height: 500, devicePixelRatio: 1 },
  startedAt: 0,
  events,
});

// Cursor sweeps right, then clicks at (900, 250) at t=1000.
const sweep: VidzEvent[] = [
  ...Array.from({ length: 11 }, (_, i): VidzEvent => ({ t: i * 100, type: "move", x: i * 90, y: 250 })),
  { t: 1000, type: "down", x: 900, y: 250, button: 0 },
  { t: 1100, type: "up", x: 900, y: 250, button: 0 },
  { t: 1100, type: "click", x: 900, y: 250, button: 0 },
  { t: 3000, type: "move", x: 900, y: 250 },
];

describe("createCursorTrack", () => {
  it("is undefined without pointer events", () => {
    expect(createCursorTrack(log([]), { smoothing: 0.5 })).toBeUndefined();
  });

  it("lands exactly on the click even with heavy smoothing", () => {
    const track = createCursorTrack(log(sweep), { smoothing: 1 })!;
    const at = track.at(1000);
    expect(at.x).toBeCloseTo(0.9, 3);
    expect(at.y).toBeCloseTo(0.5, 3);
    // Away from clicks it IS smoothed: mid-sweep it trails a bit behind
    // a straight interpolation near the start of the motion.
    expect(track.at(100).x).not.toBeCloseTo(0.09, 2);
  });

  it("reports the button as pressed between down and up", () => {
    const track = createCursorTrack(log(sweep), { smoothing: 0 })!;
    expect(track.at(990).pressed).toBe(0);
    expect(track.at(1050).pressed).toBeCloseTo(50 / 80); // animating in
    expect(track.at(1095).pressed).toBe(1);
    expect(track.at(1300).pressed).toBe(0);
  });

  it("uses downs (not clicks) for click effects, with the offset applied", () => {
    const track = createCursorTrack(log(sweep), { smoothing: 0, offsetMs: 50 })!;
    expect(track.clicksIn(0, 2000)).toEqual([{ t: 1050, button: 0, x: 0.9, y: 0.5 }]);
    expect(track.clicksIn(1050, 2000)).toEqual([]); // from is exclusive
  });

  it("falls back to click events when there are no downs", () => {
    const track = createCursorTrack(log([{ t: 0, type: "move", x: 0, y: 0 }, { t: 500, type: "click", x: 500, y: 250, button: 0 }]), {
      smoothing: 0,
    })!;
    expect(track.clicksIn(0, 1000)).toHaveLength(1);
  });

  it("fades out when idle, if asked to", () => {
    const keep = createCursorTrack(log(sweep), { smoothing: 0 })!;
    expect(keep.at(2500).opacity).toBe(1);
    const hide = createCursorTrack(log(sweep), { smoothing: 0, hideWhenIdleMs: 1000 })!;
    expect(hide.at(1500).opacity).toBe(1); // last down at 1000
    expect(hide.at(2500).opacity).toBe(0);
    expect(hide.at(3000).opacity).toBe(1); // moved again
  });

  it("knows the CSS pixel size, following resizes", () => {
    const track = createCursorTrack(
      log([{ t: 0, type: "move", x: 0, y: 0 }, { t: 100, type: "resize", width: 500, height: 250, devicePixelRatio: 2 }]),
      { smoothing: 0 },
    )!;
    expect(track.cssPixelAt(50)).toEqual({ x: 1 / 1000, y: 1 / 500 });
    expect(track.cssPixelAt(150)).toEqual({ x: 1 / 500, y: 1 / 250 });
  });
});
