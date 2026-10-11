import { describe, expect, it } from "vitest";
import { buildTimeMap } from "@/lib/timeline/timeMap";
import { cuesToOutput, toSrt, toVtt } from "./subtitles";

const cue = (id: string, start: number, end: number, text: string) => ({ id, start, end, text });

describe("subtitles", () => {
  // 10 s video with 2–4 s cut out.
  const map = buildTimeMap(10_000, [{ id: "t", type: "trim", start: 2000, end: 4000 }]);

  it("maps cues to output time, dropping or shortening cut ones", () => {
    const out = cuesToOutput(
      [cue("a", 0, 1500, "Before"), cue("b", 2500, 3500, "Cut away"), cue("c", 3000, 6000, "Half cut"), cue("d", 7000, 8000, "After")],
      map,
    );
    expect(out).toEqual([
      { start: 0, end: 1500, text: "Before" },
      { start: 2000, end: 4000, text: "Half cut" },
      { start: 5000, end: 6000, text: "After" },
    ]);
  });

  it("formats SRT and WebVTT", () => {
    const out = [{ start: 61_234.4, end: 3_723_456, text: "Hello" }];
    expect(toSrt(out)).toBe("1\n00:01:01,234 --> 01:02:03,456\nHello\n");
    expect(toVtt(out)).toBe("WEBVTT\n\n00:01:01.234 --> 01:02:03.456\nHello\n");
  });
});
