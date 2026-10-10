import { describe, expect, it } from "vitest";
import type { Segment } from "@/lib/project/types";
import {
  buildTimeMap,
  nextKeptSource,
  outputToSource,
  pieceAtSource,
  sourceToOutput,
} from "./timeMap";

const trim = (start: number, end: number): Segment => ({ id: `t${start}`, type: "trim", start, end });
const speed = (start: number, end: number, rate: number): Segment => ({
  id: `s${start}`,
  type: "speed",
  start,
  end,
  rate,
});

describe("buildTimeMap", () => {
  it("is the identity without segments", () => {
    const map = buildTimeMap(10_000, []);
    expect(map.outputDuration).toBe(10_000);
    expect(map.pieces).toEqual([
      { sourceStart: 0, sourceEnd: 10_000, outputStart: 0, outputEnd: 10_000, rate: 1 },
    ]);
  });

  it("removes trimmed time", () => {
    const map = buildTimeMap(10_000, [trim(2_000, 4_000)]);
    expect(map.outputDuration).toBe(8_000);
    expect(map.pieces).toHaveLength(2);
  });

  it("handles overlapping trims and trims at the edges", () => {
    const map = buildTimeMap(10_000, [trim(0, 1_000), trim(3_000, 5_000), trim(4_000, 6_000), trim(9_000, 12_000)]);
    // kept: [1,3) + [6,9) = 2s + 3s
    expect(map.outputDuration).toBe(5_000);
    expect(map.pieces.map((p) => [p.sourceStart, p.sourceEnd])).toEqual([
      [1_000, 3_000],
      [6_000, 9_000],
    ]);
  });

  it("applies speed segments", () => {
    const map = buildTimeMap(10_000, [speed(2_000, 6_000, 2)]);
    // 2s + 4s/2 + 4s
    expect(map.outputDuration).toBe(8_000);
  });

  it("has no pieces when everything is trimmed", () => {
    const map = buildTimeMap(5_000, [trim(0, 5_000)]);
    expect(map.pieces).toEqual([]);
    expect(map.outputDuration).toBe(0);
    expect(outputToSource(map, 1_000)).toBe(0);
  });
});

describe("source ↔ output mapping", () => {
  const map = buildTimeMap(10_000, [trim(2_000, 4_000), speed(6_000, 8_000, 2)]);
  // pieces: [0,2)→[0,2)  [4,6)→[2,4)  [6,8)@2x→[4,5)  [8,10)→[5,7)

  it("maps source to output", () => {
    expect(sourceToOutput(map, 1_000)).toBe(1_000);
    expect(sourceToOutput(map, 4_500)).toBe(2_500);
    expect(sourceToOutput(map, 7_000)).toBe(4_500);
    expect(sourceToOutput(map, 10_000)).toBe(7_000);
  });

  it("maps a trimmed source moment to the cut point", () => {
    expect(sourceToOutput(map, 3_000)).toBe(2_000);
  });

  it("maps output to source", () => {
    expect(outputToSource(map, 1_000)).toBe(1_000);
    expect(outputToSource(map, 2_000)).toBe(4_000); // the cut point shows the next piece
    expect(outputToSource(map, 4_500)).toBe(7_000);
    expect(outputToSource(map, 7_000)).toBe(10_000);
    expect(outputToSource(map, 99_000)).toBe(10_000); // clamped
  });

  it("round-trips kept moments", () => {
    for (const t of [0, 500, 4_000, 5_999, 6_500, 9_000]) {
      expect(outputToSource(map, sourceToOutput(map, t))).toBeCloseTo(t);
    }
  });

  it("finds pieces and the next kept moment", () => {
    expect(pieceAtSource(map, 3_000)).toBeNull();
    expect(pieceAtSource(map, 7_000)?.rate).toBe(2);
    expect(nextKeptSource(map, 3_000)).toBe(4_000);
    expect(nextKeptSource(map, 4_500)).toBe(4_500);
    expect(nextKeptSource(map, 10_000)).toBeNull();
  });
});
