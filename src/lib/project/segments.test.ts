import { describe, expect, it } from "vitest";
import { addTrim, addZoom, freeGap, removeSegment, trimsOf, updateSegment, zoomsOf } from "./segments";
import type { ZoomSegment } from "./types";

describe("addTrim", () => {
  it("adds a trim and normalizes reversed ranges", () => {
    const segments = addTrim([], 4_000, 2_000, 10_000, "a");
    expect(segments).toEqual([{ id: "a", type: "trim", start: 2_000, end: 4_000 }]);
  });

  it("clamps to the source duration", () => {
    const [trim] = addTrim([], -500, 12_000, 10_000, "a");
    expect(trim).toMatchObject({ start: 0, end: 10_000 });
  });

  it("merges overlapping and touching trims", () => {
    let segments = addTrim([], 1_000, 2_000, 10_000, "a");
    segments = addTrim(segments, 5_000, 6_000, 10_000, "b");
    segments = addTrim(segments, 1_500, 5_000, 10_000, "c");
    expect(trimsOf(segments)).toEqual([{ id: "c", type: "trim", start: 1_000, end: 6_000 }]);
  });

  it("ignores accidental tiny ranges", () => {
    expect(addTrim([], 1_000, 1_010, 10_000)).toEqual([]);
  });

  it("does not mutate its input", () => {
    const original = addTrim([], 1_000, 2_000, 10_000, "a");
    const frozen = Object.freeze([...original]);
    addTrim(frozen, 1_500, 3_000, 10_000, "b");
    expect(frozen).toEqual(original);
  });
});

describe("removeSegment", () => {
  it("removes by id", () => {
    const segments = addTrim([], 1_000, 2_000, 10_000, "a");
    expect(removeSegment(segments, "a")).toEqual([]);
  });
});

describe("zooms", () => {
  it("adds a zoom with defaults", () => {
    const [z] = addZoom([], 1_000, 3_000, 10_000, { id: "z" });
    expect(z).toMatchObject({ id: "z", type: "zoom", start: 1_000, end: 3_000, scale: 2 });
  });

  it("shrinks a new zoom to the free gap instead of overlapping", () => {
    let segments = addZoom([], 4_000, 6_000, 10_000, { id: "a" });
    segments = addZoom(segments, 2_000, 5_000, 10_000, { id: "b" });
    expect(zoomsOf(segments).map((z) => [z.id, z.start, z.end])).toEqual([
      ["b", 2_000, 4_000],
      ["a", 4_000, 6_000],
    ]);
  });

  it("refuses to start inside another zoom or when there's no room", () => {
    const segments = addZoom([], 4_000, 6_000, 10_000, { id: "a" });
    expect(addZoom(segments, 5_000, 7_000, 10_000)).toHaveLength(1);
    expect(addZoom(segments, 3_900, 5_000, 10_000)).toHaveLength(1); // only 100ms free
  });

  it("finds the free gap, ignoring the segment being moved", () => {
    let segments = addZoom([], 1_000, 2_000, 10_000, { id: "a" });
    segments = addZoom(segments, 5_000, 6_000, 10_000, { id: "b" });
    expect(freeGap(segments, "zoom", 3_000, 10_000)).toEqual({ start: 2_000, end: 5_000 });
    expect(freeGap(segments, "zoom", 5_500, 10_000, "b")).toEqual({ start: 2_000, end: 10_000 });
    expect(freeGap(segments, "zoom", 5_500, 10_000)).toBeNull();
  });

  it("updates one segment immutably", () => {
    const segments = addZoom([], 1_000, 2_000, 10_000, { id: "a" });
    const next = updateSegment<ZoomSegment>(segments, "a", { scale: 3 });
    expect(zoomsOf(next)[0]!.scale).toBe(3);
    expect(zoomsOf(segments)[0]!.scale).toBe(2);
  });
});
