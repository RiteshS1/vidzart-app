// TypeScript mirror of the .vidz `project.json` format (CLAUDE.md → Project
// file format). Keep this in sync with the spec; the spec is the source of
// truth. All times are milliseconds on the SOURCE timeline.

export type AspectRatio = "source" | "16:9" | "9:16" | "1:1" | "4:3";

export type Background =
  | { type: "color"; color: string }
  | { type: "gradient"; from: string; to: string; angle: number }
  | { type: "image"; src: string };

export interface ProjectSettings {
  aspectRatio: AspectRatio;
  background: Background;
  /** Fraction of the output canvas's shorter side, 0–0.5. */
  padding: number;
  /** Same unit as padding. */
  cornerRadius: number;
  shadow: { enabled: boolean; blur: number; opacity: number; offsetY: number };
  cursor: { visible: boolean; scale: number; smoothing: number; hideWhenIdleMs?: number };
  clickEffect: { type: "none" | "ripple" | "pulse"; color: string };
  /** "⌘K"-style badges from the key events in events.json; absent = hidden. */
  keystrokes?: { visible: boolean; position: "bottom" | "top" };
  /** A color look for the video; intensity 0–1. Absent = none. */
  filter?: { preset: FilterPreset; intensity: number };
  /** Fade from/to black at the start/end of the output. */
  fade?: { inMs: number; outMs: number };
  /** An effect centered on every cut (where trimmed footage was removed). */
  transition?: { type: TransitionType; durationMs: number };
}

export type FilterPreset = "none" | "vivid" | "warm" | "cool" | "mono" | "cinematic";
export type TransitionType = "none" | "dip-to-black" | "blur" | "zoom-punch";

export interface ZoomSegment {
  id: string;
  type: "zoom";
  start: number;
  end: number;
  scale: number;
  target: { mode: "fixed"; x: number; y: number } | { mode: "follow" };
  easeInMs: number;
  easeOutMs: number;
  origin?: "manual" | "auto";
}

/** The range [start, end) is cut out of the output. */
export interface TrimSegment {
  id: string;
  type: "trim";
  start: number;
  end: number;
}

export interface SpeedSegment {
  id: string;
  type: "speed";
  start: number;
  end: number;
  rate: number;
}

export interface BlurSegment {
  id: string;
  type: "blur";
  start: number;
  end: number;
  rect: { x: number; y: number; width: number; height: number };
}

export type TextAnimation = "none" | "fade" | "slide-up" | "pop" | "typewriter";

export interface TextStyle {
  /** Generic family; each renderer maps it to a font it has (see render/text.ts). */
  font: "sans" | "serif" | "mono" | "rounded";
  /** Text height as a fraction of the output canvas's shorter side. */
  size: number;
  weight: 400 | 600 | 800;
  color: string;
  /** Color of a rounded box behind the text; none if absent. */
  background?: string;
  align: "left" | "center" | "right";
}

/** A text overlay, positioned in OUTPUT canvas space (it doesn't move with zooms). */
export interface TextSegment {
  id: string;
  type: "text";
  start: number;
  end: number;
  text: string;
  /** Center of the text block, normalized 0–1 of the output canvas. */
  x: number;
  y: number;
  style: TextStyle;
  animation: { in: TextAnimation; out: TextAnimation };
}

/** An arrow, box, circle or spotlight, in SOURCE frame space (moves with zooms). */
export interface ShapeSegment {
  id: string;
  type: "shape";
  start: number;
  end: number;
  kind: "arrow" | "rect" | "ellipse" | "spotlight";
  /** Normalized 0–1. Arrows go from (x, y) to (x + width, y + height), so width/height may be negative. */
  rect: { x: number; y: number; width: number; height: number };
  /** stroke: fraction of the output canvas's shorter side. */
  style: { color: string; stroke: number };
}

export type Segment = ZoomSegment | TrimSegment | SpeedSegment | BlurSegment | TextSegment | ShapeSegment;

export interface CaptionWord {
  start: number;
  end: number;
  text: string;
}

export interface CaptionCue {
  id: string;
  /** Source-timeline ms. */
  start: number;
  end: number;
  text: string;
  words?: CaptionWord[];
}

export interface CaptionStyle {
  /** Text height as a fraction of the output canvas's shorter side. */
  size: number;
  position: "bottom" | "middle" | "top";
  font?: "sans" | "serif" | "mono" | "rounded";
  weight?: 400 | 600 | 800;
  color?: string;
  /** Box behind the text (CSS color, alpha ok). Absent/null = no box. */
  background?: string | null;
  /** Dark outline + shadow, for text without a box. */
  outline?: boolean;
  uppercase?: boolean;
  /** Color of the word being spoken (needs cue.words). */
  highlight?: string;
}

export interface Captions {
  visible: boolean;
  /** BCP 47 tag of the spoken language, e.g. "en". */
  language?: string;
  style: CaptionStyle;
  /** Sorted by start, non-overlapping. */
  cues: CaptionCue[];
}

export interface VidzProject {
  version: 1;
  source: {
    duration: number;
    width: number;
    height: number;
    fps: number;
    eventsOffsetMs?: number;
  };
  settings: ProjectSettings;
  segments: Segment[];
  /** Optional: absent until the user generates or adds captions. */
  captions?: Captions;
  audio?: ProjectAudio;
}

export interface MusicTrack {
  /** "assets/<file>" inside the .vidz. */
  src: string;
  name?: string;
  volume: number;
  fadeInMs: number;
  fadeOutMs: number;
  loop: boolean;
  /** Turn the music down while someone speaks. */
  duckUnderVoice: boolean;
}

export interface ProjectAudio {
  /** 0–1, the recording's own sound; default 1. */
  sourceVolume?: number;
  music?: MusicTrack;
}
