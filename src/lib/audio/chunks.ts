// Splits long audio into pieces for speech recognition.
//
// Whisper listens to at most 30 s at a time. Cutting blindly every 30 s
// would often cut a word in half (and the model would mangle it on both
// sides). Instead each piece ends at the QUIETEST moment between 20 s and
// 29 s in, which is almost always a pause between words.

import { windowLoudness } from "./silence";

const WINDOW_MS = 20; // must match silence.ts
const MIN_CHUNK_MS = 20_000;
const MAX_CHUNK_MS = 29_000;

/** Chunk boundaries in samples: [0, b1, b2, …, length]. */
export function quietSplitPoints(samples: Float32Array, sampleRate: number): number[] {
  const totalMs = (samples.length / sampleRate) * 1000;
  const points = [0];
  if (totalMs <= MAX_CHUNK_MS) return [0, samples.length];
  const db = windowLoudness(samples, sampleRate);
  let startMs = 0;
  while (totalMs - startMs > MAX_CHUNK_MS) {
    const from = Math.floor((startMs + MIN_CHUNK_MS) / WINDOW_MS);
    const to = Math.min(db.length - 1, Math.floor((startMs + MAX_CHUNK_MS) / WINDOW_MS));
    let quietest = to;
    for (let w = from; w <= to; w++) if (db[w]! < db[quietest]!) quietest = w;
    // Cut in the middle of the quietest window.
    const cutMs = quietest * WINDOW_MS + WINDOW_MS / 2;
    points.push(Math.round((cutMs / 1000) * sampleRate));
    startMs = cutMs;
  }
  points.push(samples.length);
  return points;
}
