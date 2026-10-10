// Main-thread side of exporting: starts the worker and turns its messages
// into a Promise with progress callbacks and cancellation.

import type { ExportJob, ExportResult } from "./exportVideo";
import type { WorkerRequest, WorkerResponse } from "./protocol";

export interface RunningExport {
  /** Resolves with the result; resolves null if canceled; rejects on error. */
  done: Promise<ExportResult | null>;
  cancel(): void;
}

export function startExport(job: ExportJob, onProgress: (fraction: number) => void): RunningExport {
  // The `new URL(..., import.meta.url)` form is what bundlers (Turbopack here)
  // recognize to build the worker file as its own bundle.
  const worker = new Worker(new URL("../../workers/export.worker.ts", import.meta.url), { type: "module" });
  const send = (message: WorkerRequest) => worker.postMessage(message);

  const done = new Promise<ExportResult | null>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const message = event.data;
      switch (message.type) {
        case "progress":
          onProgress(message.fraction);
          return;
        case "done":
          resolve(message.result);
          break;
        case "canceled":
          resolve(null);
          break;
        case "error":
          reject(new Error(message.message));
          break;
      }
      worker.terminate(); // one worker per export: no leftover state
    };
    worker.onerror = (event) => {
      reject(new Error(event.message || "The export worker crashed."));
      worker.terminate();
    };
  });

  send({ type: "start", job });
  return { done, cancel: () => send({ type: "cancel" }) };
}
