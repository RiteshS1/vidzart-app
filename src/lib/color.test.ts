import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex, luminance, parseHex, toHex } from "./color";

describe("color", () => {
  it("parses short and long hex, with or without #", () => {
    expect(parseHex("#fff")).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseHex("1e4d5c")).toEqual({ r: 30, g: 77, b: 92 });
    expect(parseHex("nope")).toBeNull();
    expect(parseHex("#12345")).toBeNull();
  });

  it("round-trips through HSV", () => {
    for (const hex of ["#ff0000", "#00ff00", "#0000ff", "#1e4d5c", "#ffb224", "#808080", "#000000", "#ffffff"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("knows primary hues", () => {
    expect(hexToHsv("#ff0000").h).toBe(0);
    expect(hexToHsv("#00ff00").h).toBe(120);
    expect(hexToHsv("#0000ff").h).toBe(240);
    expect(toHex({ r: 300, g: -5, b: 0.4 })).toBe("#ff0000");
  });

  it("orders luminance", () => {
    expect(luminance("#000000")).toBe(0);
    expect(luminance("#ffffff")).toBeCloseTo(1, 5);
    expect(luminance("#ffb224")).toBeGreaterThan(luminance("#1e4d5c"));
  });
});
