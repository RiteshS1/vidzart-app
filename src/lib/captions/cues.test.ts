import { describe, expect, it } from "vitest";
import { cueAt, wordsToCues } from "./cues";

let n = 0;
const id = () => `c${++n}`;
const w = (start: number, end: number, text: string) => ({ start, end, text });

describe("wordsToCues", () => {
  it("breaks at sentence ends and pauses, trimming spaces", () => {
    n = 0;
    const cues = wordsToCues(
      [
        w(0, 300, " Welcome"), w(300, 500, " to"), w(500, 900, " the"), w(900, 1400, " Vidzart demo."),
        w(1500, 1800, " Click"), w(1800, 2000, " here."),
        w(4000, 4300, " Then"), w(4300, 4600, " save."),
      ],
      id,
    );
    expect(cues.map((c) => [c.text, c.start, c.end])).toEqual([
      ["Welcome to the Vidzart demo.", 0, 1400],
      ["Click here.", 1500, 2000],
      ["Then save.", 4000, 4600], // the 2s pause starts a new cue too
    ]);
    expect(cues[0]!.words).toHaveLength(4);
  });

  it("keeps cues under 42 characters", () => {
    const words = "this is a fairly long sentence without any punctuation that keeps going on"
      .split(" ")
      .map((text, i) => w(i * 200, i * 200 + 180, text));
    const cues = wordsToCues(words, id);
    expect(cues.length).toBeGreaterThan(1);
    for (const cue of cues) expect(cue.text.length).toBeLessThanOrEqual(42);
    expect(cues.map((c) => c.text).join(" ")).toBe(words.map((x) => x.text).join(" "));
  });

  it("removes overlaps between cues", () => {
    const cues = wordsToCues([w(0, 1000, "One."), w(1100, 1500, "x"), w(900, 2000, "Two. three four five six seven eight")], id);
    for (let i = 1; i < cues.length; i++) expect(cues[i]!.start).toBeGreaterThanOrEqual(cues[i - 1]!.end);
  });
});

describe("cueAt", () => {
  it("finds the cue showing at a time, end exclusive", () => {
    const cues = [
      { id: "a", start: 0, end: 1000, text: "a" },
      { id: "b", start: 2000, end: 3000, text: "b" },
    ];
    expect(cueAt(cues, 500)?.id).toBe("a");
    expect(cueAt(cues, 1000)).toBeUndefined();
    expect(cueAt(cues, 1500)).toBeUndefined();
    expect(cueAt(cues, 2999)?.id).toBe("b");
  });
});
