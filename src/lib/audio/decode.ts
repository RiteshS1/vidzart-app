// Decodes a video's audio track into one mono Float32Array at a chosen
// sample rate. Speech recognition (Whisper wants 16 kHz mono) and silence
// detection both work on this simple form.
//
// Runs in a worker: Mediabunny + WebCodecs decode the compressed audio, and
// we mix channels down and resample as the decoded chunks stream in, so the
// full-rate audio is never held in memory at once.

import { ALL_FORMATS, AudioSampleSink, BlobSource, Input } from "mediabunny";

export interface MonoAudio {
  samples: Float32Array;
  sampleRate: number;
}

/** Returns null when the file has no (decodable) audio track. */
export async function decodeMono(
  video: Blob,
  targetRate: number,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<MonoAudio | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(video) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const durationSec = await input.computeDuration();
    // +1s of slack: the last chunk can run past the container's duration.
    const out = new Float32Array(Math.ceil((durationSec + 1) * targetRate));

    let written = 0;
    for await (const sample of new AudioSampleSink(track).samples()) {
      if (signal?.aborted) {
        sample.close();
        throw new DOMException("Canceled", "AbortError");
      }
      const frames = sample.numberOfFrames;
      const channels = sample.numberOfChannels;
      // Mix all channels into one: average of the planes.
      const mono = new Float32Array(frames);
      const plane = new Float32Array(frames);
      for (let c = 0; c < channels; c++) {
        sample.copyTo(plane, { planeIndex: c, format: "f32-planar" });
        for (let i = 0; i < frames; i++) mono[i]! += plane[i]! / channels;
      }

      // Resample with a box filter: each output sample is the average of the
      // input samples it covers. Averaging (instead of picking every 3rd
      // sample of 48 kHz) also filters out frequencies the lower rate can't
      // represent, which would otherwise alias into audible noise.
      const ratio = sample.sampleRate / targetRate;
      const start = Math.max(0, Math.round(sample.timestamp * targetRate));
      const count = Math.floor(frames / ratio);
      for (let o = 0; o < count && start + o < out.length; o++) {
        const from = Math.floor(o * ratio);
        const to = Math.min(frames, Math.floor((o + 1) * ratio));
        let sum = 0;
        for (let i = from; i < to; i++) sum += mono[i]!;
        out[start + o] = sum / Math.max(1, to - from);
      }
      written = Math.max(written, Math.min(out.length, start + count));
      onProgress?.(Math.min(1, sample.timestamp / Math.max(0.001, durationSec)));
      sample.close();
    }
    return { samples: out.subarray(0, written), sampleRate: targetRate };
  } finally {
    input.dispose();
  }
}

export interface StereoAudio {
  left: Float32Array;
  right: Float32Array;
  sampleRate: number;
  /** The whole file's duration, even when only the start was decoded. */
  durationMs: number;
}

/**
 * Decodes an audio file (music) to stereo at `targetRate`, at most the first
 * `maxMs` (no need to hold 5 minutes of music for a 30 s video). Mono files
 * are copied to both channels; other rates are resampled linearly.
 */
export async function decodeStereo(file: Blob, targetRate: number, maxMs: number): Promise<StereoAudio | null> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    const track = await input.getPrimaryAudioTrack();
    if (!track || !(await track.canDecode())) return null;
    const durationMs = (await input.computeDuration()) * 1000;
    const keepMs = Math.min(durationMs, maxMs);
    const nativeRate = await track.getSampleRate();
    // Decode at the native rate first...
    const nativeLength = Math.ceil((keepMs / 1000) * nativeRate) + 1;
    const nl = new Float32Array(nativeLength);
    const nr = new Float32Array(nativeLength);
    for await (const sample of new AudioSampleSink(track).samples(0, keepMs / 1000)) {
      const frames = sample.numberOfFrames;
      const start = Math.round(sample.timestamp * nativeRate);
      const l = new Float32Array(frames);
      const r = new Float32Array(frames);
      sample.copyTo(l, { planeIndex: 0, format: "f32-planar" });
      if (sample.numberOfChannels > 1) sample.copyTo(r, { planeIndex: 1, format: "f32-planar" });
      else r.set(l);
      for (let i = 0; i < frames && start + i < nativeLength; i++) {
        if (start + i < 0) continue;
        nl[start + i] = l[i]!;
        nr[start + i] = r[i]!;
      }
      sample.close();
    }
    // ...then resample (linear interpolation is fine for music at these rates).
    if (nativeRate === targetRate) return { left: nl, right: nr, sampleRate: targetRate, durationMs };
    const length = Math.ceil((keepMs / 1000) * targetRate);
    const left = new Float32Array(length);
    const right = new Float32Array(length);
    const ratio = nativeRate / targetRate;
    for (let i = 0; i < length; i++) {
      const pos = i * ratio;
      const a = Math.floor(pos);
      const b = Math.min(a + 1, nativeLength - 1);
      const f = pos - a;
      left[i] = nl[a]! + (nl[b]! - nl[a]!) * f;
      right[i] = nr[a]! + (nr[b]! - nr[a]!) * f;
    }
    return { left, right, sampleRate: targetRate, durationMs };
  } finally {
    input.dispose();
  }
}
