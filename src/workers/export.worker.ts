// Web Worker entry for exporting. It only translates messages to and from
// exportVideo(); all the real work lives in src/lib/export.
//
// Why a worker? Decoding, drawing and encoding thousands of frames keeps the
// CPU busy for a long time. On the main thread that would freeze the UI
// (no progress bar, no Cancel button). In a worker, the page stays smooth.

import { ExportCanceledError, exportVideo, type ExportJob } from "@/lib/export/exportVideo";
import type { WorkerRequest, WorkerResponse } from "@/lib/export/protocol";

// The DOM lib types `self` as Window; inside a dedicated worker it's the
// worker scope. We only need these two members.
const scope = self as unknown as {
  postMessage(message: WorkerResponse): void;
  addEventListener(type: "message", listener: (event: MessageEvent<WorkerRequest>) => void): void;
};

let controller: AbortController | null = null;

scope.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type === "cancel") {
    controller?.abort();
    return;
  }
  controller = new AbortController();
  void run(message.job, controller.signal);
});

async function run(job: ExportJob, signal: AbortSignal) {
  let lastReported = -1;
  try {
    const result = await exportVideo(
      job,
      (fraction) => {
        // Throttle to whole percents; thousands of messages would be wasteful.
        const percent = Math.floor(fraction * 100);
        if (percent !== lastReported) {
          lastReported = percent;
          scope.postMessage({ type: "progress", fraction });
        }
      },
      signal,
    );
    // Blobs are cheap to post: the data isn't copied, only a reference.
    scope.postMessage({ type: "done", result });
  } catch (error) {
    if (error instanceof ExportCanceledError) scope.postMessage({ type: "canceled" });
    else scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) });
  }
}
