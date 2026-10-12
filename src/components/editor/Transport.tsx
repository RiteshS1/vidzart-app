"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { buildTimeMap } from "@/lib/timeline/timeMap";
import { formatTime } from "@/lib/time/formatTime";
import { useEditor, useEditorContext, usePlaying } from "./EditorContext";
import { ghostButton } from "./styles";

// Play/pause and the time readout. The readout is written to the DOM from an
// animation-frame loop; only the play/pause icon goes through React.
export function Transport() {
  const { controller } = useEditorContext();
  const playing = usePlaying();
  const segments = useEditor((s) => s.project.segments);
  const duration = useEditor((s) => s.project.source.duration);
  const outputDuration = useMemo(
    () => buildTimeMap(duration, segments).outputDuration,
    [duration, segments],
  );
  const currentRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;
    let last = "";
    const loop = () => {
      const text = formatTime(controller.getOutputTime());
      // Only touch the DOM when the visible text changes (10×/s, not 60×/s).
      if (text !== last && currentRef.current) {
        currentRef.current.textContent = text;
        last = text;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [controller]);

  return (
    <div className="flex items-center gap-1 rounded-full border border-line bg-surface px-2 py-1.5 shadow-lg shadow-black/30">
      <button
        type="button"
        className={`${ghostButton} size-9 rounded-full px-0`}
        onClick={() => controller.seekOutput(0)}
        aria-label="Go to start"
        title="Go to start (Home)"
      >
        <SkipBack className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        className="bg-brand flex size-10 cursor-pointer items-center justify-center rounded-full text-white shadow-[0_0_20px_-6px_var(--accent)] transition hover:brightness-110"
        onClick={() => controller.toggle()}
        aria-label={playing ? "Pause" : "Play"}
        title="Play / pause (Space)"
      >
        {playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden />}
      </button>
      <button
        type="button"
        className={`${ghostButton} size-9 rounded-full px-0`}
        onClick={() => controller.seekOutput(outputDuration)}
        aria-label="Go to end"
        title="Go to end (End)"
      >
        <SkipForward className="size-4" aria-hidden />
      </button>
      <span className="mx-2 font-mono text-sm tabular-nums">
        <span ref={currentRef} data-testid="current-time">
          0:00.0
        </span>
        <span className="text-ink-faint"> / </span>
        <span data-testid="output-duration" className="text-ink-muted">
          {formatTime(outputDuration)}
        </span>
      </span>
    </div>
  );
}
