// Finds the silent stretches in a recording, to cut them out.
//
// Loudness is measured per 20 ms window as RMS in dBFS (0 dB = full scale,
// quiet room tone ≈ -60 dB, normal speech ≈ -30…-15 dB). Instead of a fixed
// "silence = below -40 dB" rule, which fails for quiet mics or noisy rooms,
// the threshold adapts to THIS recording:
//
//   floor = 10th percentile of window loudness   (the room tone),
//           but at least -70 dB: digitally silent parts (exact zeros,
//           -120 dB) would otherwise drag the threshold below the faint
//           noise a codec leaves in other silent parts
//   peak  = 95th percentile                       (typical speech)
//   threshold = floor + 25% of the way to peak
//
// A cut keeps `paddingMs` of silence on each side, so words don't start or
// end abruptly, and only stretches longer than `minSilenceMs` are cut.

export interface SilenceOptions {
  /** Only silences at least this long are cut. */
  minSilenceMs?: number;
  /** Silence kept on each side of a cut (not at the very start/end). */
  paddingMs?: number;
}

export interface TimeRange {
  start: number;
  end: number;
}

const WINDOW_MS = 20;

export function windowLoudness(samples: Float32Array, sampleRate: number): Float32Array {
  const size = Math.max(1, Math.round((sampleRate * WINDOW_MS) / 1000));
  const count = Math.floor(samples.length / size);
  const db = new Float32Array(count);
  for (let w = 0; w < count; w++) {
    let sum = 0;
    for (let i = w * size; i < (w + 1) * size; i++) sum += samples[i]! * samples[i]!;
    const rms = Math.sqrt(sum / size);
    db[w] = rms > 0 ? 20 * Math.log10(rms) : -120;
  }
  return db;
}

function percentile(values: Float32Array, p: number): number {
  const sorted = Float32Array.from(values).sort();
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? -120;
}

/** Silent ranges to cut, in ms, sorted. Empty when there's no clear speech/silence contrast. */
export function detectSilences(samples: Float32Array, sampleRate: number, options: SilenceOptions = {}): TimeRange[] {
  const minSilenceMs = options.minSilenceMs ?? 700;
  const paddingMs = options.paddingMs ?? 150;
  const db = windowLoudness(samples, sampleRate);
  if (db.length === 0) return [];

  const floor = Math.max(-70, percentile(db, 0.1));
  const peak = percentile(db, 0.95);
  // Less than 10 dB between quiet and loud parts: either all silence or all
  // sound. Cutting anything would be guessing.
  if (peak - floor < 10) return [];
  const threshold = floor + (peak - floor) * 0.25;

  const totalMs = db.length * WINDOW_MS;
  const ranges: TimeRange[] = [];
  let runStart = -1;
  for (let w = 0; w <= db.length; w++) {
    const silent = w < db.length && db[w]! < threshold;
    if (silent && runStart < 0) runStart = w;
    if (!silent && runStart >= 0) {
      const start = runStart * WINDOW_MS;
      const end = w * WINDOW_MS;
      // No padding at the very start or end of the recording: there's no
      // word there to protect.
      const cutStart = start === 0 ? 0 : start + paddingMs;
      const cutEnd = end >= totalMs ? end : end - paddingMs;
      if (end - start >= minSilenceMs && cutEnd - cutStart > 0) ranges.push({ start: cutStart, end: cutEnd });
      runStart = -1;
    }
  }
  return ranges;
}
