"use client";

import { useEffect, useRef, useState } from "react";
import type { RunningTask } from "@/lib/ai/aiClient";
import { button } from "./styles";

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
