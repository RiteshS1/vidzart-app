// Screen recording with getDisplayMedia + MediaRecorder.
//
// Flow:
//   getDisplayMedia() → the browser shows its picker (tab / window / screen)
//   → we get a MediaStream → MediaRecorder encodes it into small Blob chunks
//   → on stop we glue the chunks into one Blob (a complete WebM/MP4 file).
//
// This module has no React in it on purpose: the UI only calls
// startScreenRecording() and awaits the result.

import { epochNow } from "@/lib/time/clock";
import { pickRecorderMimeType } from "./mimeType";

export interface Recording {
  blob: Blob;
  mimeType: string;
  /**
   * Measured by us, not read from the file. WebM written by MediaRecorder may
   * have no duration in its header (older Chrome, other browsers, crashes),
   * in which case a <video> element reports `Infinity`.
   */
  durationMs: number;
  /** Capture size when recording started (the source may be resized later). */
  width: number;
  height: number;
  /** epochNow() when MediaRecorder fired `start`, the zero point for events. */
  startedAt: number;
}

export interface ActiveRecording {
  readonly startedAt: number;
  /** The live stream, e.g. for a preview <video>. */
  readonly stream: MediaStream;
  /** Stops recording (safe to call twice) and resolves with the result. */
  stop(): Promise<Recording>;
  /**
   * Resolves when the recording ends for any reason: our stop(), or the user
   * clicking Chrome's own "Stop sharing" button.
   */
  readonly finished: Promise<Recording>;
}

export interface StartOptions {
  /** Ask for tab/system audio too (the user can still untick it in the picker). */
  audio: boolean;
}

/** Bitrate for the raw recording. High, because it's re-encoded at export. */
const VIDEO_BITS_PER_SECOND = 8_000_000;

/** Emit a chunk every second, so a crash loses at most ~1s of data. */
const TIMESLICE_MS = 1000;

export async function startScreenRecording(
  options: StartOptions,
): Promise<ActiveRecording> {
  const mimeType = pickRecorderMimeType();
  if (!mimeType) {
    throw new Error("This browser can't record video (MediaRecorder unsupported).");
  }

  // Throws NotAllowedError if the user cancels the picker.
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: { frameRate: { ideal: 60 } },
    audio: options.audio,
    // Hide *this* tab from the picker: recording the recorder is never wanted
    // and creates an infinite-mirror effect.
    selfBrowserSurface: "exclude",
    // Let the user switch which tab is shared mid-recording.
    surfaceSwitching: "include",
    systemAudio: options.audio ? "include" : "exclude",
  });

  const videoTrack = stream.getVideoTracks()[0];
  if (!videoTrack) {
    stopTracks(stream);
    throw new Error("The shared source has no video track.");
  }
  const { width = 0, height = 0 } = videoTrack.getSettings();

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
  });

  const chunks: Blob[] = [];
  recorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });

  // We take timestamps on the recorder's own events rather than when we call
  // start()/stop(): encoding begins a moment after start() returns.
  const started = new Promise<number>((resolve) => {
    recorder.addEventListener("start", () => resolve(epochNow()), { once: true });
  });

  const finished = new Promise<Recording>((resolve, reject) => {
    recorder.addEventListener(
      "stop",
      () => {
        const stoppedAt = epochNow();
        stopTracks(stream); // removes Chrome's "sharing this tab" indicator
        void started.then((startedAt) =>
          resolve({
            blob: new Blob(chunks, { type: mimeType }),
            mimeType,
            durationMs: stoppedAt - startedAt,
            width,
            height,
            startedAt,
          }),
        );
      },
      { once: true },
    );
    recorder.addEventListener(
      "error",
      (event) => {
        stopTracks(stream);
        reject(event instanceof ErrorEvent ? event.error : new Error("Recording failed."));
      },
      { once: true },
    );
  });

  const stop = (): Promise<Recording> => {
    if (recorder.state !== "inactive") recorder.stop();
    return finished;
  };

  // Chrome's "Stop sharing" bar ends the track without telling the recorder.
  videoTrack.addEventListener("ended", () => void stop(), { once: true });

  recorder.start(TIMESLICE_MS);
  const startedAt = await started;

  return { startedAt, stream, stop, finished };
}

function stopTracks(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}
