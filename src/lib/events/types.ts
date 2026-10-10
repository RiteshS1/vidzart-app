// TypeScript mirror of the .vidz `events.json` format (CLAUDE.md → Project
// file format). Coordinates are viewport CSS pixels; times are ms since
// `startedAt`.

export type MouseButton = 0 | 1 | 2;

export type VidzEvent =
  | { t: number; type: "move"; x: number; y: number }
  | { t: number; type: "down"; x: number; y: number; button: MouseButton }
  | { t: number; type: "up"; x: number; y: number; button: MouseButton }
  | { t: number; type: "click"; x: number; y: number; button: MouseButton }
  | { t: number; type: "scroll"; x: number; y: number; scrollX: number; scrollY: number }
  | { t: number; type: "key"; x: number; y: number; combo: string }
  | { t: number; type: "resize"; width: number; height: number; devicePixelRatio: number };

export interface Viewport {
  width: number;
  height: number;
  devicePixelRatio: number;
}

export interface VidzEvents {
  version: 1;
  viewport: Viewport;
  startedAt: number;
  events: VidzEvent[];
}
