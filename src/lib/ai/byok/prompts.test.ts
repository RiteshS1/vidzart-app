import { describe, expect, it } from "vitest";
import { parseChapters, parseTranslation, transcriptForPrompt, translationPrompt } from "./prompts";

describe("BYOK prompts", () => {
  it("formats the transcript with output timestamps", () => {
    expect(transcriptForPrompt([{ start: 0, end: 1, text: "Hi" }, { start: 75_500, end: 80_000, text: "Export" }])).toBe(
      "[0:00] Hi\n[1:15] Export",
    );
  });

  it("parses chapters, tolerating bullets and dashes, forcing 0:00 first", () => {
    expect(parseChapters("Here you go:\n- 0:05 Intro\n1:30 – Exporting\n0:45 Recording\nnot a chapter")).toEqual([
      "0:00 Intro",
      "0:45 Recording",
      "1:30 Exporting",
    ]);
  });

  it("round-trips numbered caption translations", () => {
    expect(translationPrompt(["Hello", "Two\nlines"], "Spanish")).toContain("1|Hello\n2|Two lines");
    expect(parseTranslation("1|Hola\n2| Dos líneas \n", 2)).toEqual(["Hola", "Dos líneas"]);
    expect(() => parseTranslation("1|Hola", 2)).toThrow("missing line 2");
  });
});
