// Small frames for the timeline's filmstrip, decoded in a worker.
//
// We decode a fixed number of evenly spaced source frames once per file
// (not per tile): the timeline then picks the nearest one for each tile at
// any zoom level, so zooming never waits for decoding.

import { ALL_FORMATS, BlobSource, Input, VideoSampleSink } from "mediabunny";

export interface Thumbnails {
  /** Source ms of each frame, ascending. */
  times: number[];
  frames: ImageBitmap[];
}

export async function makeThumbnails(video: Blob, count: number, height: number): Promise<Thumbnails> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(video) });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) return { times: [], frames: [] };
    const [first, duration, w, h] = await Promise.all([
      track.getFirstTimestamp(),
      input.computeDuration(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
    ]);
    const width = Math.max(1, Math.round((height * w) / h));
    // Frame centers of `count` equal slices, so the first and last tiles
    // aren't both stuck on the very edges.
    const seconds = Array.from({ length: count }, (_, i) => Math.max(first, ((i + 0.5) / count) * duration));
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d")!;
    const times: number[] = [];
    const frames: ImageBitmap[] = [];
    let i = 0;
    for await (const sample of new VideoSampleSink(track).samplesAtTimestamps(seconds)) {
      if (sample) {
        sample.draw(ctx, 0, 0, width, height);
        frames.push(canvas.transferToImageBitmap());
        times.push(seconds[i]! * 1000);
        sample.close();
      }
      i++;
    }
    return { times, frames };
  } finally {
    input.dispose();
  }
}
