"use client";

import { useEffect, useRef, useState } from "react";
import { runAiTask, type RunningTask } from "@/lib/ai/aiClient";
import { cutRanges } from "@/lib/editor/actions";
import { useEditorContext } from "./EditorContext";
import { button, panelLabel } from "./styles";

// The "AI" tab: tools that analyze the recording. Everything here runs on
// this device (in a worker) unless it says it uses your own API key.

export function AiPanel({ video }: { video: Blob }) {
  return (
    <div className="flex flex-col gap-6">
      <SilenceTool video={video} />
    </div>
  );
}

/** Progress state for a running worker task, shared by the tools. */
export function useTask() {
  const running = useRef<RunningTask<unknown> | null>(null);
  const [progress, setProgress] = useState<{ stage: string; fraction?: number } | null>(null);
  useEffect(() => () => running.current?.cancel(), []);

  async function run<T>(start: (onProgress: (stage: string, fraction?: number) => void) => RunningTask<T>): Promise<T | null> {
    setProgress({ stage: "Starting…" });
    const task = start((stage, fraction) => setProgress({ stage, fraction }));
    running.current = task;
    try {
      return await task.done;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      throw error;
    } finally {
      running.current = null;
      setProgress(null);
    }
  }
  return { run, progress, cancel: () => running.current?.cancel() };
}

export function TaskProgress({ progress, onCancel }: { progress: { stage: string; fraction?: number }; onCancel: () => void }) {
  return (
    <div className="flex flex-col gap-2" role="status" aria-live="polite">
      <div className="flex justify-between text-xs opacity-70">
        <span>{progress.stage}</span>
        {progress.fraction !== undefined && <span>{Math.round(progress.fraction * 100)}%</span>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <div
          className={`h-full bg-violet-500 ${progress.fraction === undefined ? "w-1/3 animate-pulse" : ""}`}
          style={progress.fraction === undefined ? undefined : { width: `${progress.fraction * 100}%` }}
        />
      </div>
      <button type="button" className={`${button} self-start`} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

const PAUSE_OPTIONS = [
  { label: "0.5s", ms: 500 },
  { label: "1s", ms: 1000 },
  { label: "2s", ms: 2000 },
];

function SilenceTool({ video }: { video: Blob }) {
  const { store } = useEditorContext();
  const { run, progress, cancel } = useTask();
  const [minSilenceMs, setMinSilenceMs] = useState(1000);
  const [message, setMessage] = useState<string | null>(null);

  const removeSilences = async () => {
    setMessage(null);
    try {
      const result = await run((onProgress) => runAiTask({ type: "silences", video, options: { minSilenceMs } }, onProgress));
      if (!result) return;
      if (!result.hasAudio) return setMessage("This video has no audio track.");
      const cut = cutRanges(store, result.ranges);
      setMessage(
        cut > 0
          ? `Cut ${result.ranges.length} pause${result.ranges.length === 1 ? "" : "s"} (${(cut / 1000).toFixed(1)}s). Undo brings them back.`
          : "No pauses that long to cut.",
      );
    } catch (error) {
      setMessage(`Couldn't analyze the audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby="silence-title">
      <h3 id="silence-title" className={panelLabel}>
        Remove silences
      </h3>
      <p className="text-xs opacity-60">Cuts pauses where nobody speaks. Runs on your device.</p>
      <div className="flex items-center gap-2 text-xs" role="group" aria-label="Shortest pause to cut">
        <span className="opacity-60">Pauses longer than</span>
        {PAUSE_OPTIONS.map((o) => (
          <button
            key={o.ms}
            type="button"
            aria-pressed={minSilenceMs === o.ms}
            onClick={() => setMinSilenceMs(o.ms)}
            className={`rounded px-2 py-1 font-medium ${
              minSilenceMs === o.ms ? "bg-foreground text-background" : "bg-black/[.05] dark:bg-white/[.07]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {progress ? (
        <TaskProgress progress={progress} onCancel={cancel} />
      ) : (
        <button type="button" className={`${button} self-start`} onClick={() => void removeSilences()}>
          Cut silences
        </button>
      )}
      {message && <p className="text-xs opacity-70">{message}</p>}
    </section>
  );
}
