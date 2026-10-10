import { describe, expect, it } from "vitest";
import { addTrim, removeSegment, trimsOf } from "./segments";

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
