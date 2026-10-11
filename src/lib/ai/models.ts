// The Whisper models the editor offers. Kept apart from transcribe.ts so UI
// code can list them without pulling transformers.js into the main bundle.

/** "_timestamped" exports include what's needed for word-level timings. */
export const WHISPER_MODELS = {
  tiny: { id: "onnx-community/whisper-tiny_timestamped", label: "Fast", sizeMb: 40 },
  base: { id: "onnx-community/whisper-base_timestamped", label: "Better", sizeMb: 80 },
} as const;
export type WhisperModel = keyof typeof WHISPER_MODELS;
