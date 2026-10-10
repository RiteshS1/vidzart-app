import type { Background } from "@/lib/project/types";

/** Built-in backgrounds shown as swatches in the settings panel. */
export const BACKGROUND_PRESETS: { name: string; background: Background }[] = [
  { name: "Dusk", background: { type: "gradient", from: "#6d5dfc", to: "#d16ba5", angle: 135 } },
  { name: "Ocean", background: { type: "gradient", from: "#2193b0", to: "#6dd5ed", angle: 135 } },
  { name: "Sunset", background: { type: "gradient", from: "#f7971e", to: "#ffd200", angle: 135 } },
  { name: "Forest", background: { type: "gradient", from: "#134e5e", to: "#71b280", angle: 135 } },
  { name: "Midnight", background: { type: "gradient", from: "#0f2027", to: "#2c5364", angle: 160 } },
  { name: "Peach", background: { type: "gradient", from: "#ffecd2", to: "#fcb69f", angle: 135 } },
  { name: "Graphite", background: { type: "color", color: "#1f1f24" } },
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
