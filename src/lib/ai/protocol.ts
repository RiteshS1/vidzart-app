// Messages between the editor and the AI worker (src/workers/ai.worker.ts).
// One worker per task: it's created for the task and terminated after, so
// canceling is just terminate() and no state leaks between tasks.

import type { SilenceOptions, TimeRange } from "@/lib/audio/silence";
import type { Transcript, TranscribeOptions } from "./transcribe";

export type AiTask =
  | { type: "silences"; video: Blob; options?: SilenceOptions }
  | { type: "transcribe"; video: Blob; options: TranscribeOptions };

export interface AiResults {
  silences: { ranges: TimeRange[]; hasAudio: boolean };
  transcribe: Transcript;
}

export type AiResponse =
  | { type: "progress"; stage: string; fraction?: number }
  | { type: "done"; result: AiResults[AiTask["type"]] }
  | { type: "error"; message: string };
