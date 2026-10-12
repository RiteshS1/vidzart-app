// The export's audio when there's background music (or the recording's
// volume was changed): the kept parts of the recording + the music, mixed
// sample by sample.
//
// Works in 1-second blocks of OUTPUT time: decode just the source audio that
// lands in this block, add the music with its volume/fades/ducking, hand the
// block to the encoder. Memory stays flat no matter how long the video is.

import { AudioSample, AudioSampleSink, type AudioSampleSource, type InputAudioTrack } from "mediabunny";
import type { StereoAudio } from "@/lib/audio/decode";
import { duckAt, musicGain, musicPosition } from "@/lib/audio/music";
import type { MusicTrack } from "@/lib/project/types";
import type { TimeMap } from "@/lib/timeline/timeMap";

export const MIX_RATE = 48_000;
const BLOCK_MS = 1000;

export interface MixJob {
  map: TimeMap;
  source: InputAudioTrack | null;
  sourceVolume: number;
  music: { audio: StereoAudio; settings: MusicTrack } | null;
  duck: Float32Array | null;
  destination: AudioSampleSource;
  signal: AbortSignal;
  onAbort: () => Promise<never>;
}

export async function mixAudio(job: MixJob): Promise<void> {
  const { map } = job;
  const sink = job.source ? new AudioSampleSink(job.source) : null;
  for (let o0 = 0; o0 < map.outputDuration; o0 += BLOCK_MS) {
    if (job.signal.aborted) await job.onAbort();
    const o1 = Math.min(map.outputDuration, o0 + BLOCK_MS);
    const frames = Math.round(((o1 - o0) / 1000) * MIX_RATE);
    if (frames <= 0) break;
    const left = new Float32Array(frames);
    const right = new Float32Array(frames);
    const msOf = (i: number) => o0 + (i * 1000) / MIX_RATE; // output ms of frame i

    // 1. The recording's kept parts that fall into this block.
    if (sink && job.sourceVolume > 0) {
      for (const piece of map.pieces) {
        // Sped-up parts stay silent (no time-stretching), like the plain export.
        if (piece.rate !== 1 || piece.outputEnd <= o0 || piece.outputStart >= o1) continue;
        const s0 = piece.sourceStart + (Math.max(o0, piece.outputStart) - piece.outputStart);
        const s1 = piece.sourceStart + (Math.min(o1, piece.outputEnd) - piece.outputStart);
        for await (const sample of sink.samples(s0 / 1000, s1 / 1000)) {
          addSource(sample, piece.outputStart - piece.sourceStart, s0, s1, o0, left, right, job.sourceVolume);
          sample.close();
        }
      }
    }

    // 2. The music on top.
    if (job.music) {
      const { audio, settings } = job.music;
      for (let i = 0; i < frames; i++) {
        const t = msOf(i);
        const pos = musicPosition(settings, t, audio.durationMs);
        if (pos === null) continue;
        const gain = musicGain(settings, t, audio.durationMs, map.outputDuration) * (settings.duckUnderVoice ? duckAt(job.duck, t) : 1);
        if (gain <= 0) continue;
        const k = Math.floor((pos / 1000) * audio.sampleRate);
        if (k >= audio.left.length) continue;
        left[i]! += audio.left[k]! * gain;
        right[i]! += audio.right[k]! * gain;
      }
    }

    // Soft safety against clipping where loud music meets loud speech.
    for (let i = 0; i < frames; i++) {
      left[i] = Math.max(-1, Math.min(1, left[i]!));
      right[i] = Math.max(-1, Math.min(1, right[i]!));
    }
    const data = new Float32Array(frames * 2);
    data.set(left, 0);
    data.set(right, frames);
    const block = new AudioSample({ data, format: "f32-planar", numberOfChannels: 2, sampleRate: MIX_RATE, timestamp: o0 / 1000 });
    await job.destination.add(block);
    block.close();
  }
  job.destination.close();
}

/**
 * Adds the part of a decoded source chunk inside [s0, s1) (source ms) to the
 * block, shifted by `shift` (output = source + shift) and resampled to the
 * mix rate by linear interpolation.
 */
function addSource(
  sample: AudioSample,
  shift: number,
  s0: number,
  s1: number,
  blockStart: number,
  left: Float32Array,
  right: Float32Array,
  volume: number,
) {
  const sr = sample.sampleRate;
  const n = sample.numberOfFrames;
  const l = new Float32Array(n);
  const r = new Float32Array(n);
  sample.copyTo(l, { planeIndex: 0, format: "f32-planar" });
  if (sample.numberOfChannels > 1) sample.copyTo(r, { planeIndex: 1, format: "f32-planar" });
  else r.set(l);
  const chunkStart = sample.timestamp * 1000;
  const chunkEnd = chunkStart + (n * 1000) / sr;
  // Output frames this chunk covers (clipped to the piece and the block).
  const from = Math.max(s0, chunkStart) + shift;
  const to = Math.min(s1, chunkEnd) + shift;
  const i0 = Math.max(0, Math.ceil(((from - blockStart) * MIX_RATE) / 1000));
  const i1 = Math.min(left.length, Math.ceil(((to - blockStart) * MIX_RATE) / 1000));
  for (let i = i0; i < i1; i++) {
    const sourceMs = blockStart + (i * 1000) / MIX_RATE - shift;
    const pos = ((sourceMs - chunkStart) / 1000) * sr;
    const a = Math.min(n - 1, Math.max(0, Math.floor(pos)));
    const b = Math.min(n - 1, a + 1);
    const f = pos - a;
    left[i]! += (l[a]! + (l[b]! - l[a]!) * f) * volume;
    right[i]! += (r[a]! + (r[b]! - r[a]!) * f) * volume;
  }
}
