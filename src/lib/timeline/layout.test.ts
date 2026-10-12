import { describe, expect, it } from "vitest";
import type { Segment, TrimSegment } from "@/lib/project/types";
import { cutSeams, outputSpan } from "./layout";
import { buildTimeMap } from "./timeMap";

const trim = (id: string, start: number, end: number): TrimSegment => ({ id, type: "trim", start, end });

describe("timeline layout in output time", () => {
  // 10 s: 2–4 s cut, 6–8 s at 2× (so 1 s long in the output). Output = 7 s.
  const segments: Segment[] = [trim("t", 2000, 4000), { id: "s", type: "speed", start: 6000, end: 8000, rate: 2 }];
  const map = buildTimeMap(10_000, segments);

  it("places ranges after a cut earlier, and shrinks sped-up ones", () => {
    expect(map.outputDuration).toBe(7000);
    expect(outputSpan(map, 0, 1000)).toEqual({ start: 0, end: 1000 });
    expect(outputSpan(map, 5000, 6000)).toEqual({ start: 3000, end: 4000 });
    expect(outputSpan(map, 6000, 8000)).toEqual({ start: 4000, end: 5000 });
  });

  it("clips ranges that overlap a cut and hides ones entirely inside it", () => {
    expect(outputSpan(map, 1000, 5000)).toEqual({ start: 1000, end: 3000 });
    expect(outputSpan(map, 2500, 3500)).toBeNull();
  });

  it("puts each cut's seam where the footage was removed", () => {
    const trims = [trim("end", 9000, 10_000), trim("t", 2000, 4000)];
    const withEnd = buildTimeMap(10_000, [...trims, segments[1]!]);
    expect(withEnd.outputDuration).toBe(6000);
    const seams = cutSeams(withEnd, trims);
    expect(seams.map((s) => [s.trim.id, s.at])).toEqual([
      ["t", 2000],
      ["end", 6000], // a cut at the very end sits at the end
    ]);
  });
});
