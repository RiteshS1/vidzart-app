import type { CaptionStyle } from "@/lib/project/types";

// Ready-made caption looks. A preset only fills the style; every field can
// still be changed afterwards. Size and position are kept when picking one
// (so choosing a look doesn't move captions you already placed).

export interface CaptionPreset {
  id: string;
  label: string;
  style: Omit<CaptionStyle, "size" | "position">;
}

export const CAPTION_PRESETS: CaptionPreset[] = [
  {
    id: "classic",
    label: "Classic",
    style: { font: "sans", weight: 600, color: "#ffffff", background: "rgba(0,0,0,0.72)", outline: false, uppercase: false },
  },
  {
    id: "clean",
    label: "Clean",
    style: { font: "sans", weight: 600, color: "#ffffff", background: null, outline: true, uppercase: false },
  },
  {
    id: "bold",
    label: "Bold",
    style: { font: "sans", weight: 800, color: "#ffffff", background: null, outline: true, uppercase: true },
  },
  {
    id: "highlight",
    label: "Karaoke",
    style: { font: "sans", weight: 800, color: "#ffffff", background: null, outline: true, uppercase: true, highlight: "#ffb224" },
  },
  {
    id: "label",
    label: "Label",
    style: { font: "rounded", weight: 600, color: "#111118", background: "#ffffff", outline: false, uppercase: false },
  },
  {
    id: "typed",
    label: "Mono",
    style: { font: "mono", weight: 400, color: "#e5ffe5", background: "rgba(0,0,0,0.8)", outline: false, uppercase: false },
  },
];

export const DEFAULT_CAPTION_STYLE: CaptionStyle = { size: 0.045, position: "bottom", ...CAPTION_PRESETS[0]!.style };

/** Applies a preset to a style, keeping its size and position. */
export function applyCaptionPreset(style: CaptionStyle, preset: CaptionPreset): CaptionStyle {
  const next: CaptionStyle = { size: style.size, position: style.position, ...preset.style };
  if (!preset.style.highlight) delete next.highlight;
  return next;
}
