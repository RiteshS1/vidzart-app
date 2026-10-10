// Messages between the editor (main thread) and the export worker.

import type { ExportJob, ExportResult } from "./exportVideo";

export type WorkerRequest = { type: "start"; job: ExportJob } | { type: "cancel" };

export type WorkerResponse =
  | { type: "progress"; fraction: number }
  | { type: "done"; result: ExportResult }
  | { type: "canceled" }
  | { type: "error"; message: string };
