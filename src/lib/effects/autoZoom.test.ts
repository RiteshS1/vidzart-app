import { describe, expect, it } from "vitest";
import type { VidzEvent, VidzEvents } from "@/lib/events/types";
import { generateAutoZooms } from "./autoZoom";

const click = (t: number, x: number, y: number): VidzEvent => ({ t, type: "click", x, y, button: 0 });
const log = (events: VidzEvent[]): VidzEvents => ({
  version: 1,
  viewport: { width: 1000, height: 1000, devicePixelRatio: 1 },
  startedAt: 0,
  events,
});

describe("generateAutoZooms", () => {
  it("creates nothing without clicks", () => {
    expect(generateAutoZooms(log([{ t: 0, type: "move", x: 1, y: 1 }]), 10_000)).toEqual([]);
  });

  it("zooms in before a click and holds after it", () => {
    const [zoom] = generateAutoZooms(log([click(3_000, 250, 750)]), 10_000);
    expect(zoom).toMatchObject({
      type: "zoom",
      origin: "auto",
      start: 2_200,
      end: 4_800,
      target: { mode: "fixed", x: 0.25, y: 0.75 },
    });
    expect(zoom!.scale).toBeGreaterThan(1.25);
  });

  it("groups nearby clicks into one zoom aimed at their middle", () => {
    const zooms = generateAutoZooms(log([click(1_000, 400, 400), click(2_000, 500, 400), click(3_000, 450, 500)]), 10_000);
    expect(zooms).toHaveLength(1);
    expect(zooms[0]!.target).toEqual({ mode: "fixed", x: 0.45, y: 0.45 });
    // spread 0.1 + margin 0.2 → visible 0.3 → scale capped by the 1.8 default
    expect(zooms[0]!.scale).toBe(1.8);
  });

  it("splits groups far apart in time or space", () => {
    const zooms = generateAutoZooms(
      log([click(1_000, 100, 100), click(1_500, 900, 900), click(9_000, 900, 900)]),
      12_000,
    );
    expect(zooms).toHaveLength(3);
    // adjacent zooms never overlap
    for (let i = 1; i < zooms.length; i++) expect(zooms[i]!.start).toBeGreaterThanOrEqual(zooms[i - 1]!.end);
  });

  it("lowers the scale so spread-out clicks all stay visible", () => {
    const [zoom] = generateAutoZooms(log([click(1_000, 300, 500), click(1_500, 600, 500)]), 10_000);
    // spread 0.3 + margin 0.2 = 0.5 visible → scale 2 capped to default 1.8; check the cap math
    expect(zoom!.scale).toBeLessThanOrEqual(1 / 0.5);
  });

  it("clamps to the video and applies the events offset", () => {
    const [zoom] = generateAutoZooms(log([click(200, 500, 500)]), 1_500, { offsetMs: 100 });
    expect(zoom!.start).toBe(0);
    expect(zoom!.end).toBe(1_500);
  });

  it("follows resizes when normalizing click positions", () => {
    const [zoom] = generateAutoZooms(
      log([{ t: 0, type: "resize", width: 2000, height: 1000, devicePixelRatio: 1 }, click(2_000, 1500, 500)]),
      10_000,
    );
    expect(zoom!.target).toEqual({ mode: "fixed", x: 0.75, y: 0.5 });
  });
});
