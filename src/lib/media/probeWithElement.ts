// Fallback probe using a <video> element, for files the browser can play but
// Mediabunny can't demux (e.g. some .mov files). Less precise: no frame rate,
// and the duration can be Infinity for header-less WebM (we reject that).

import type { VideoInfo } from "./probe";

export function probeWithElement(url: string): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.onloadedmetadata = () => {
      const durationMs = video.duration * 1000;
      if (!Number.isFinite(durationMs) || video.videoWidth === 0) {
        reject(new Error("Couldn't read this video's length or size."));
        return;
      }
      resolve({
        durationMs,
        width: video.videoWidth,
        height: video.videoHeight,
        fps: 30, // unknown; 30 is a safe nominal value
        hasAudio: true, // unknown; assume yes so audio isn't dropped
      });
    };
    video.onerror = () => reject(new Error("This browser can't play this file."));
    video.src = url;
  });
}
