import { describe, expect, it } from "vitest";
import { findFillers, withoutFillers } from "./fillers";

const cue = {
  id: "a",
  start: 0,
  end: 2000,
  text: "Um, so click here.",
  words: [
    { start: 0, end: 300, text: "Um," },
    { start: 320, end: 500, text: "so" },
    { start: 500, end: 800, text: "click" },
    { start: 900, end: 1100, text: "uh" },
    { start: 1300, end: 1600, text: "here." },
  ],
};

describe("fillers", () => {
  it("finds fillers with a margin that never reaches the neighbors", () => {
    expect(findFillers([cue])).toEqual([
      { start: 0, end: 320, word: "Um," }, // capped at "so" (320)
      { start: 860, end: 1140, word: "uh" },
    ]);
  });

  it("rebuilds caption text without them", () => {
    expect(withoutFillers([cue])[0]!.text).toBe("So click here.");
    expect(withoutFillers([{ ...cue, text: "Um", words: [cue.words[0]!] }])).toEqual([]);
  });

  it("doesn't flag words that merely contain a filler", () => {
    expect(findFillers([{ ...cue, words: [{ start: 0, end: 1, text: "umbrella" }, { start: 2, end: 3, text: "Ahh!" }] }])).toEqual([]);
  });
});
