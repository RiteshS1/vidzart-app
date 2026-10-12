import type { Background } from "@/lib/project/types";

const solid = (name: string, color: string) => ({ name, background: { type: "color", color } as Background });
const gradient = (name: string, from: string, to: string, angle = 135) => ({
  name,
  background: { type: "gradient", from, to, angle } as Background,
});

export interface BackgroundGenre {
  id: string;
  label: string;
  presets: { name: string; background: Background }[];
}

/**
 * Built-in backgrounds, grouped by genre like a template gallery. Each name
 * is unique across genres (names double as accessible labels).
 */
export const BACKGROUND_GENRES: BackgroundGenre[] = [
  {
    id: "studio",
    label: "Studio",
    presets: [
      solid("Studio", "#26262b"),
      solid("Graphite", "#1f1f24"),
      solid("Slate", "#3a4150"),
      solid("Ocean", "#1e4d5c"),
      solid("Sage", "#66775f"),
      solid("Clay", "#a5583e"),
      solid("Sand", "#d8d0c2"),
      solid("White", "#f5f5f7"),
    ],
  },
  {
    id: "aesthetic",
    label: "Aesthetic",
    presets: [
      gradient("Sunset Haze", "#ff9a9e", "#fecfef"),
      gradient("Lavender Haze", "#a18cd1", "#fbc2eb"),
      gradient("Mango Tango", "#f6d365", "#fda085"),
      gradient("Ice Cream", "#84fab0", "#8fd3f4"),
      gradient("Rose Water", "#ffdde1", "#ee9ca7"),
      gradient("Blush Sky", "#89f7fe", "#66a6ff"),
      gradient("Dream Pop", "#e0c3fc", "#8ec5fc"),
      gradient("Glow Up", "#fddb92", "#d1fdff"),
    ],
  },
  {
    id: "pastel",
    label: "Pastel",
    presets: [
      solid("Mint", "#cdeac0"),
      solid("Lilac", "#d9c8f0"),
      solid("Peach", "#ffd6c0"),
      solid("Butter", "#fff1b5"),
      solid("Sky", "#c6e2ff"),
      solid("Blush", "#ffd1dc"),
      solid("Fern", "#d1e0cf"),
      solid("Cloud", "#e8edf3"),
    ],
  },
  {
    id: "nature",
    label: "Nature",
    presets: [
      gradient("Forest", "#134e5e", "#71b280"),
      gradient("Meadow", "#56ab2f", "#a8e063"),
      gradient("Lagoon", "#43cea2", "#185a9d"),
      gradient("Reef", "#2193b0", "#6dd5ed"),
      gradient("Dune", "#c79081", "#dfa579"),
      gradient("Moss", "#3a6073", "#16222a"),
      gradient("Canyon", "#cb356b", "#bd3f32"),
      gradient("Alpine", "#e0eafc", "#cfdef3"),
    ],
  },
  {
    id: "warm",
    label: "Warm",
    presets: [
      gradient("Ember", "#f12711", "#f5af19"),
      gradient("Sunrise", "#ff512f", "#f09819"),
      gradient("Honey", "#f7971e", "#ffd200"),
      gradient("Coral", "#ff9966", "#ff5e62"),
      gradient("Amber Glow", "#ffb347", "#ffcc33"),
      gradient("Brick", "#cb2d3e", "#ef473a"),
      gradient("Apricot", "#ffecd2", "#fcb69f"),
      gradient("Cinnamon", "#a8542f", "#d9a066"),
    ],
  },
  {
    id: "cool",
    label: "Cool",
    presets: [
      gradient("Arctic", "#74ebd5", "#acb6e5"),
      gradient("Glacier", "#2980b9", "#6dd5fa"),
      gradient("Steel", "#bdc3c7", "#2c3e50"),
      gradient("Lake", "#0083b0", "#00b4db"),
      gradient("Frost", "#e0eafc", "#b9c6e0"),
      gradient("Teal Wave", "#11998e", "#38ef7d"),
      gradient("Cobalt", "#1c92d2", "#8fd3f4"),
      gradient("Mist", "#cfd9df", "#e2ebf0"),
    ],
  },
  {
    id: "neon",
    label: "Neon",
    presets: [
      gradient("Cyber", "#00f5a0", "#00d9f5"),
      gradient("Electric", "#7f00ff", "#e100ff"),
      gradient("Laser", "#ff0080", "#7928ca"),
      gradient("Toxic", "#b6ff00", "#00ff87"),
      gradient("Hot Wire", "#f857a6", "#ff5858"),
      gradient("Volt", "#f9f047", "#0fd850"),
      gradient("Ultra", "#4776e6", "#8e54e4"),
      gradient("Pulse", "#12c2e9", "#c471ed"),
    ],
  },
  {
    id: "night",
    label: "Night",
    presets: [
      gradient("Midnight", "#0f2027", "#2c5364", 160),
      gradient("Obsidian", "#141e30", "#243b55"),
      gradient("Void", "#000000", "#434343"),
      gradient("Deep Space", "#000428", "#004e92"),
      gradient("Eclipse", "#232526", "#414345"),
      gradient("Twilight", "#2c3e50", "#4ca1af"),
      gradient("Ink", "#0f0c29", "#302b63"),
      solid("Black", "#0b0b0c"),
    ],
  },
];

/** Every built-in background, flat (e.g. to look one up by name). */
export const BACKGROUND_PRESETS = BACKGROUND_GENRES.flatMap((g) => g.presets);

/** True when two backgrounds are the same look (preset highlight). */
export function sameBackground(a: Background, b: Background): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The genre a background belongs to, if it's a built-in one. */
export function genreOf(background: Background): BackgroundGenre | undefined {
  return BACKGROUND_GENRES.find((g) => g.presets.some((p) => sameBackground(p.background, background)));
}

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
