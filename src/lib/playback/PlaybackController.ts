// Plays the source <video> as if the edits were already applied.
//
// The <video> element only knows the source timeline. While playing, tick()
// (called once per animation frame by the preview loop) checks where the
// element is:
//   - inside a trimmed range → jump to the next kept moment
//   - inside a speed segment → set element.playbackRate to that rate
//   - past the last kept moment → pause, we've reached the output's end
//
// Checking once per frame means up to ~16ms of a cut can flash by before the
// jump, plus the seek's own latency. That's fine for a preview; the export
// (Phase 3) decodes exactly the frames it needs and never shows cut frames.
//
// The current time is NOT kept in React state: callers read it with
// getOutputTime() from their own animation-frame loops.

import {
  nextKeptSource,
  outputToSource,
  pieceAtSource,
  sourceToOutput,
  type TimeMap,
} from "@/lib/timeline/timeMap";

export class PlaybackController {
  private listeners = new Set<() => void>();
  private _playing = false;

  constructor(
    private readonly video: HTMLVideoElement,
    private readonly getTimeMap: () => TimeMap,
  ) {
    // Keep our flag in sync if the element stops on its own (end of file,
    // decode error, or the browser pausing a background tab).
    video.addEventListener("pause", () => this.setPlaying(false));
    video.addEventListener("play", () => this.setPlaying(true));
  }

  get playing(): boolean {
    return this._playing;
  }

  /** Subscribe to play/pause changes (human-speed events only). */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getPlaying = (): boolean => this._playing;

  getSourceTime(): number {
    return this.video.currentTime * 1000;
  }

  getOutputTime(): number {
    return sourceToOutput(this.getTimeMap(), this.getSourceTime());
  }

  async play(): Promise<void> {
    const map = this.getTimeMap();
    if (map.pieces.length === 0) return; // everything is trimmed
    // Pressing play at the end starts over, like every video player.
    if (this.getOutputTime() >= map.outputDuration - 1) this.seekOutput(0);
    this.applyRules();
    try {
      await this.video.play();
    } catch (error) {
      // play() rejects with AbortError if a pause() arrives before playback
      // actually started. That's expected when toggling quickly.
      if (!(error instanceof DOMException && error.name === "AbortError")) throw error;
    }
  }

  pause(): void {
    this.video.pause();
  }

  toggle(): void {
    if (this._playing) this.pause();
    else void this.play();
  }

  seekOutput(outputMs: number): void {
    this.setSourceTime(outputToSource(this.getTimeMap(), outputMs));
  }

  /** Seek to a source moment; inside a cut, snaps to the end of the cut. */
  seekSource(sourceMs: number): void {
    const map = this.getTimeMap();
    const kept = nextKeptSource(map, sourceMs);
    const last = map.pieces.at(-1);
    this.setSourceTime(kept ?? last?.sourceEnd ?? 0);
  }

  /** Call once per animation frame. */
  tick(): void {
    if (this._playing) this.applyRules();
  }

  private applyRules(): void {
    const map = this.getTimeMap();
    const now = this.getSourceTime();
    const piece = pieceAtSource(map, now);
    if (piece) {
      if (this.video.playbackRate !== piece.rate) this.video.playbackRate = piece.rate;
      return;
    }
    const next = nextKeptSource(map, now);
    if (next === null) {
      // Past the last kept moment: stop exactly at the output's end.
      this.pause();
      const last = map.pieces.at(-1);
      if (last) this.setSourceTime(last.sourceEnd);
    } else {
      this.setSourceTime(next);
    }
  }

  private setSourceTime(sourceMs: number): void {
    this.video.currentTime = Math.max(0, sourceMs) / 1000;
  }

  private setPlaying(playing: boolean): void {
    if (playing === this._playing) return;
    this._playing = playing;
    for (const listener of this.listeners) listener();
  }
}
