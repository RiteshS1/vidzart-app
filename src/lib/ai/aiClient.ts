// Main-thread side of the AI worker: one worker per task, a Promise for the
// result, progress callbacks, and cancel = terminate.

import type { AiResponse, AiResults, AiTask } from "./protocol";

export interface RunningTask<T> {
  /** Rejects with an AbortError when canceled. */
  done: Promise<T>;
  cancel(): void;
}

export function runAiTask<K extends AiTask["type"]>(
  task: Extract<AiTask, { type: K }>,
  onProgress?: (stage: string, fraction?: number) => void,
): RunningTask<AiResults[K]> {
  const worker = new Worker(new URL("../../workers/ai.worker.ts", import.meta.url), { type: "module" });
  let rejectDone: (error: Error) => void = () => {};
  const done = new Promise<AiResults[K]>((resolve, reject) => {
    rejectDone = reject;
    worker.onmessage = (event: MessageEvent<AiResponse>) => {
      const message = event.data;
      if (message.type === "progress") {
        onProgress?.(message.stage, message.fraction);
        return;
      }
      if (message.type === "done") resolve(message.result as AiResults[K]);
      else reject(new Error(message.message));
      worker.terminate();
    };
    worker.onerror = (event) => {
      reject(new Error(event.message || "The AI worker crashed."));
      worker.terminate();
    };
  });
  worker.postMessage(task);
  return {
    done,
    cancel: () => {
      worker.terminate();
      rejectDone(new DOMException("Canceled", "AbortError"));
    },
  };
}
