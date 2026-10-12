// Web Worker for audio analysis and on-device AI. Like the export worker,
// it only translates messages; the real work lives in src/lib.

import { decodeMono } from "@/lib/audio/decode";
import { detectSilences } from "@/lib/audio/silence";
import type { AiResponse, AiTask } from "@/lib/ai/protocol";

const scope = self as unknown as {
  postMessage(message: AiResponse, transfer?: Transferable[]): void;
  addEventListener(type: "message", listener: (event: MessageEvent<AiTask>) => void): void;
};

const progress = (stage: string, fraction?: number) => scope.postMessage({ type: "progress", stage, fraction });

scope.addEventListener("message", (event) => {
  void run(event.data).then(
    // ImageBitmaps are transferred (moved, not copied) to the page.
    (result) => scope.postMessage({ type: "done", result }, result && "frames" in result ? result.frames : []),
    (error: unknown) => scope.postMessage({ type: "error", message: error instanceof Error ? error.message : String(error) }),
  );
});

async function run(task: AiTask) {
  switch (task.type) {
    case "silences": {
      // 8 kHz is plenty for loudness and keeps the array small.
      const audio = await decodeMono(task.video, 8_000, (f) => progress("Reading audio", f));
      if (!audio) return { ranges: [], hasAudio: false };
      return { ranges: detectSilences(audio.samples, audio.sampleRate, task.options), hasAudio: true };
    }
    case "thumbnails": {
      const { makeThumbnails } = await import("@/lib/media/thumbnails");
      return makeThumbnails(task.video, task.count, task.height);
    }
    case "transcribe": {
      // Imported on demand: transformers.js + ONNX Runtime are large, and
      // only this task needs them.
      const { transcribe } = await import("@/lib/ai/transcribe");
      return transcribe(task.video, task.options, progress);
    }
  }
}
