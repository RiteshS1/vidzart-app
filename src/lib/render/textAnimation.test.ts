import { describe, expect, it } from "vitest";
import { textState } from "./textAnimation";

const seg = (animIn: "none" | "fade" | "slide-up" | "pop" | "typewriter", animOut: "none" | "fade" = "fade") => ({
  start: 1000,
  end: 4000,
  text: "Hello world",
  animation: { in: animIn, out: animOut },
});

describe("textState", () => {
  it("is null outside the segment", () => {
    expect(textState(seg("fade"), 999)).toBeNull();
    expect(textState(seg("fade"), 4000)).toBeNull();
  });

  it("fades in, holds, fades out", () => {
    expect(textState(seg("fade"), 1000)!.alpha).toBe(0);
    expect(textState(seg("fade"), 2500)).toEqual({ alpha: 1, dy: 0, scale: 1, chars: Infinity });
    expect(textState(seg("fade"), 3900)!.alpha).toBeLessThan(1);
  });

  it("slides up from below and pops with an overshoot", () => {
    expect(textState(seg("slide-up"), 1050)!.dy).toBeGreaterThan(0.3);
    expect(textState(seg("slide-up"), 2000)!.dy).toBe(0);
    const scales = [1050, 1200, 1300, 1400, 1449].map((t) => textState(seg("pop"), t)!.scale);
    expect(scales[0]).toBeLessThan(0.8);
    expect(Math.max(...scales)).toBeGreaterThan(1); // overshoot…
    expect(textState(seg("pop"), 2000)!.scale).toBe(1); // …then settles
  });

  it("types characters one by one", () => {
    expect(textState(seg("typewriter"), 1000)!.chars).toBe(0);
    const mid = textState(seg("typewriter"), 1200)!.chars;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(11);
    expect(textState(seg("typewriter"), 2500)!.chars).toBeGreaterThanOrEqual(11);
  });
});
