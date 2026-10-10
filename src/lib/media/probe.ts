// Reads a video file's real duration, size and frame rate with Mediabunny.
//
// Why not just use <video>.duration? WebM from MediaRecorder may have no
// duration in its header (the element reports Infinity), and the element
// can't tell us the frame rate. Mediabunny demuxes the container and finds
// the last frame's timestamp, so the duration is always correct.

import { ALL_FORMATS, BlobSource, Input } from "mediabunny";

export interface VideoInfo {
  durationMs: number;
  /** Display size: after pixel-aspect and rotation are applied. */
  width: number;
  height: number;
  fps: number;
  hasAudio: boolean;
}

export async function probeVideo(file: Blob): Promise<VideoInfo> {
  const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
  try {
    if (!(await input.canRead())) {
      throw new Error("This file format isn't supported. Try a WebM or MP4 video.");
    }
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error("This file has no video track.");

    const [durationSeconds, width, height, stats, audio] = await Promise.all([
      input.computeDuration(),
      track.getDisplayWidth(),
      track.getDisplayHeight(),
      // Sampling 120 packets is enough for a good average and stays fast.
      track.computePacketStats(120),
      input.getPrimaryAudioTrack(),
    ]);

    return {
      durationMs: durationSeconds * 1000,
      width,
      height,
      fps: Math.round(stats.averagePacketRate) || 30,
      hasAudio: audio !== null,
    };
  } finally {
    input.dispose(); // frees Mediabunny's internal read cache
  }
}
