import type { ProjectSettings, VidzProject } from "./types";

export const DEFAULT_SETTINGS: ProjectSettings = {
  aspectRatio: "16:9",
  background: { type: "color", color: "#26262b" }, // "Studio"
  padding: 0.08,
  cornerRadius: 0.02,
  shadow: { enabled: true, blur: 0.04, opacity: 0.45, offsetY: 0.012 },
  cursor: { visible: true, scale: 1, smoothing: 0.5 },
  clickEffect: { type: "ripple", color: "#ffffff" },
};

export function createProject(source: VidzProject["source"]): VidzProject {
  return {
    version: 1,
    source,
    // structuredClone so editing one project can never mutate the defaults.
    settings: structuredClone(DEFAULT_SETTINGS),
    segments: [],
  };
}
