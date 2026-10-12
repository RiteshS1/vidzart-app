import { describe, expect, it } from "vitest";
import { keycaps } from "./keystrokes";

describe("keycaps", () => {
  it("turns combos into keycap labels", () => {
    expect(keycaps("Meta+Shift+K")).toEqual(["⌘", "⇧", "K"]);
    expect(keycaps("Ctrl+Enter")).toEqual(["⌃", "↵"]);
    expect(keycaps("Alt+F4")).toEqual(["⌥", "F4"]);
  });
});
