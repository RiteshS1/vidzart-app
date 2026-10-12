"use client";

import { useEffect } from "react";
import { runAiTask } from "@/lib/ai/aiClient";
import { duckAt, duckCurve, musicGain, musicPosition } from "@/lib/audio/music";
import type { TimeMap } from "@/lib/timeline/timeMap";
import type { EditorContextValue } from "./EditorContext";

/** How far the <audio> element may drift from where it should be before we re-seek it. */
const MAX_DRIFT_MS = 200;

/**
 * Plays the background music along with the preview, using the same math as
 * the export (musicPosition, musicGain, duckCurve), so you hear the mix you
 * will get. Also applies the recording's volume to the <video>.
 *
 * Runs in an animation-frame loop that reads the playhead from the
 * controller, like the canvas preview, never from React state.
 */
export function useMusicPreview({ store, assets, controller, video, getTimeMap }: EditorContextValue, source: Blob) {
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "auto";
    let src: string | null = null; // the asset path currently loaded
    let url: string | null = null;
    let musicMs = 0;
    audio.addEventListener("loadedmetadata", () => {
      musicMs = Number.isFinite(audio.duration) ? audio.duration * 1000 : 0;
    });

    // When someone speaks in the recording (for ducking): computed once in
    // the worker, turned into a gain curve per time map (it follows cuts).
    let speech: { mask: Uint8Array; windowMs: number } | null = null;
    let speechTask: ReturnType<typeof runAiTask<"speech">> | null = null;
    let curve: { map: TimeMap; gains: Float32Array } | null = null;

    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const { project } = store.getState();
      const sourceVolume = project.audio?.sourceVolume ?? 1;
      if (video.volume !== sourceVolume) video.volume = sourceVolume;

      const music = project.audio?.music;
      if (music?.src !== src) {
        src = music?.src ?? null;
        if (url) URL.revokeObjectURL(url);
        url = null;
        musicMs = 0;
        const file = src ? assets.get(src) : undefined;
        if (file) {
          url = URL.createObjectURL(file);
          audio.src = url;
        } else {
          audio.removeAttribute("src");
        }
      }
      if (!music || !url || musicMs === 0) {
        if (!audio.paused) audio.pause();
        return;
      }

      const map = getTimeMap();
      let duck = 1;
      if (music.duckUnderVoice) {
        if (!speech && !speechTask) {
          speechTask = runAiTask({ type: "speech", video: source });
          speechTask.done.then((s) => (speech = s), () => {});
        }
        if (speech && curve?.map !== map) curve = { map, gains: duckCurve(speech, map) };
        if (curve) duck = duckAt(curve.gains, controller.getOutputTime());
      }

      // Native looping: a seek at every wrap would leave an audible gap.
      if (audio.loop !== music.loop) audio.loop = music.loop;
      const t = controller.getOutputTime();
      const pos = musicPosition(music, t, musicMs);
      const gain = musicGain(music, t, musicMs, map.outputDuration) * duck;
      audio.volume = Math.min(1, Math.max(0, gain));
      if (!controller.playing || pos === null) {
        if (!audio.paused) audio.pause();
        return;
      }
      if (audio.paused || Math.abs(audio.currentTime * 1000 - pos) > MAX_DRIFT_MS) audio.currentTime = pos / 1000;
      if (audio.paused) void audio.play().catch(() => {});
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      speechTask?.cancel();
      audio.pause();
      audio.removeAttribute("src");
      if (url) URL.revokeObjectURL(url);
    };
  }, [store, assets, controller, video, getTimeMap, source]);
}
