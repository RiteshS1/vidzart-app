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
