// On-device speech recognition with Whisper (transformers.js), run in the
// AI worker. The audio never leaves the device; only the model itself is
// downloaded once from the Hugging Face Hub and then cached by the browser.
//
// Pipeline:
//   video ──decodeMono(16 kHz)──▶ split at quiet moments (≤ 29 s pieces)
//     ──Whisper, word timestamps──▶ words (+ piece offset) ──▶ caption cues

import { pipeline, type ProgressInfo } from "@huggingface/transformers";
import { quietSplitPoints } from "@/lib/audio/chunks";
import { decodeMono } from "@/lib/audio/decode";
import { wordsToCues } from "@/lib/captions/cues";
import type { CaptionCue, CaptionWord } from "@/lib/project/types";
import { WHISPER_MODELS, type WhisperModel } from "./models";


const SAMPLE_RATE = 16_000; // what Whisper was trained on

export interface TranscribeOptions {
  model: WhisperModel;
  /** ISO 639-1 code like "en"; undefined = let Whisper detect it. */
  language?: string;
}

export interface Transcript {
  cues: CaptionCue[];
  words: CaptionWord[];
  hasAudio: boolean;
}

type Progress = (stage: string, fraction?: number) => void;

export async function transcribe(video: Blob, options: TranscribeOptions, progress: Progress): Promise<Transcript> {
  const audio = await decodeMono(video, SAMPLE_RATE, (f) => progress("Reading audio", f));
  if (!audio) return { cues: [], words: [], hasAudio: false };

  const recognize = await loadModel(options.model, progress);
  const points = quietSplitPoints(audio.samples, SAMPLE_RATE);
  const totalSec = audio.samples.length / SAMPLE_RATE;
  const words: CaptionWord[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!;
    const offsetMs = (from / SAMPLE_RATE) * 1000;
    progress("Transcribing", from / SAMPLE_RATE / totalSec);
    const output = await recognize(audio.samples.subarray(from, points[i + 1]!), {
      return_timestamps: "word",
      ...(options.language ? { language: options.language, task: "transcribe" } : {}),
    });
    for (const chunk of output.chunks ?? []) {
      const [start, end] = chunk.timestamp;
      // The last word of a piece may have no end time: give it a short one.
      const startMs = offsetMs + start * 1000;
      const endMs = offsetMs + (end ?? start + 0.3) * 1000;
      words.push({ start: Math.round(startMs), end: Math.round(Math.max(endMs, startMs + 50)), text: chunk.text });
    }
  }
  progress("Transcribing", 1);
  return { cues: wordsToCues(words), words, hasAudio: true };
}

async function loadModel(model: WhisperModel, progress: Progress) {
  const id = WHISPER_MODELS[model].id;
  const onProgress = (info: ProgressInfo) => {
    // "progress_total" aggregates all the model's files; the per-file
    // events would make the bar jump back and forth.
    if (info.status === "progress_total") progress("Downloading the speech model (once)", info.progress / 100);
  };
  // WebGPU is much faster when the browser has it; WASM (CPU) works
  // everywhere. The dtypes follow transformers.js's Whisper recipes: on GPU
  // the encoder needs full precision, on CPU 8-bit quantized is fast and
  // accurate enough.
  const hasWebGpu = typeof navigator !== "undefined" && "gpu" in navigator;
  if (hasWebGpu) {
    try {
      return await pipeline("automatic-speech-recognition", id, {
        device: "webgpu",
        dtype: { encoder_model: "fp32", decoder_model_merged: "q4" },
        progress_callback: onProgress,
      });
    } catch {
      // No usable adapter (e.g. blocklisted GPU): fall back to the CPU.
    }
  }
  return pipeline("automatic-speech-recognition", id, { device: "wasm", dtype: "q8", progress_callback: onProgress });
}
