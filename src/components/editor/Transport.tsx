"use client";

import { useEffect, useMemo, useRef } from "react";
import { buildTimeMap } from "@/lib/timeline/timeMap";
import { formatTime } from "@/lib/time/formatTime";
import { useEditor, useEditorContext, usePlaying } from "./EditorContext";
import { iconButton } from "./styles";

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
    <div className="flex items-center gap-2">
      <button
        type="button"
        className={iconButton}
        onClick={() => controller.seekOutput(0)}
        aria-label="Go to start"
        title="Go to start (Home)"
      >
        ⏮
      </button>
      <button
        type="button"
        className={`${iconButton} w-12`}
        onClick={() => controller.toggle()}
        aria-label={playing ? "Pause" : "Play"}
        title="Play / pause (Space)"
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <button
        type="button"
        className={iconButton}
        onClick={() => controller.seekOutput(outputDuration)}
        aria-label="Go to end"
        title="Go to end (End)"
      >
        ⏭
      </button>
      <span className="ml-2 font-mono text-sm tabular-nums">
        <span ref={currentRef} data-testid="current-time">
          0:00.0
        </span>
        <span className="opacity-50"> / </span>
        <span data-testid="output-duration" className="opacity-70">
          {formatTime(outputDuration)}
        </span>
      </span>
    </div>
  );
}
