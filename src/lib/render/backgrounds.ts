import type { Background } from "@/lib/project/types";

/**
 * Built-in backgrounds shown as swatches in the settings panel: calm, flat
 * "studio backdrop" colors that let the recording be the star. (Gradients are
 * still supported by the format and renderer; projects that use them keep
 * working.)
 */
export const BACKGROUND_PRESETS: { name: string; background: Background }[] = [
  { name: "Studio", background: { type: "color", color: "#26262b" } },
  { name: "Graphite", background: { type: "color", color: "#1f1f24" } },
  { name: "Slate", background: { type: "color", color: "#3a4150" } },
  { name: "Ocean", background: { type: "color", color: "#1e4d5c" } },
  { name: "Sage", background: { type: "color", color: "#66775f" } },
  { name: "Clay", background: { type: "color", color: "#a5583e" } },
  { name: "Sand", background: { type: "color", color: "#d8d0c2" } },
  { name: "White", background: { type: "color", color: "#f5f5f7" } },
];

/** CSS for a swatch, so the UI preview matches what the canvas draws. */
export function backgroundToCss(background: Background): string {
  switch (background.type) {
    case "color":
      return background.color;
    case "gradient":
      return `linear-gradient(${background.angle}deg, ${background.from}, ${background.to})`;
    case "image":
      return "#1f1f24";
  }
}
