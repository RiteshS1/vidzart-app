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
}

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

export type Segment = ZoomSegment | TrimSegment | SpeedSegment | BlurSegment;

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

export interface Captions {
  visible: boolean;
  /** BCP 47 tag of the spoken language, e.g. "en". */
  language?: string;
  style: {
    /** Text height as a fraction of the output canvas's shorter side. */
    size: number;
    position: "bottom" | "top";
  };
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
}
