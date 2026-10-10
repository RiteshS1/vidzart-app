"use client";

import { useEffect, useRef, useState } from "react";
import {
  startScreenRecording,
  type ActiveRecording,
  type Recording,
} from "@/lib/recording/screenRecorder";
import { extensionForMimeType } from "@/lib/recording/mimeType";
import { epochNow } from "@/lib/time/clock";
import { formatTime } from "@/lib/time/formatTime";

// React state only holds things that change at "human speed" (which screen
// we're on). The ticking timer is written straight to the DOM from a
// requestAnimationFrame loop, so React doesn't re-render 60 times a second.
type Status =
  | { kind: "idle" }
  | { kind: "requesting" }
  | { kind: "recording" }
  | { kind: "done"; recording: Recording; url: string }
  | { kind: "error"; message: string };

export function Recorder() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [withAudio, setWithAudio] = useState(true);

  const activeRef = useRef<ActiveRecording | null>(null);
  const timerRef = useRef<HTMLSpanElement>(null);
  const livePreviewRef = useRef<HTMLVideoElement>(null);

  // Elapsed-time display while recording.
  useEffect(() => {
    if (status.kind !== "recording") return;
    let frame = 0;
    const tick = () => {
      const active = activeRef.current;
      if (active && timerRef.current) {
        timerRef.current.textContent = formatTime(epochNow() - active.startedAt);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [status.kind]);

  // Attach the live stream to the preview element once it's rendered.
  useEffect(() => {
    if (status.kind === "recording" && livePreviewRef.current && activeRef.current) {
      livePreviewRef.current.srcObject = activeRef.current.stream;
    }
  }, [status.kind]);

  // Object URLs keep the Blob alive until revoked; free it when we leave the
  // "done" screen or unmount.
  const doneUrl = status.kind === "done" ? status.url : null;
  useEffect(() => {
    if (!doneUrl) return;
    return () => URL.revokeObjectURL(doneUrl);
  }, [doneUrl]);

  // If the page goes away mid-recording, release the capture.
  useEffect(() => () => void activeRef.current?.stop(), []);

  async function start() {
    setStatus({ kind: "requesting" });
    try {
      const active = await startScreenRecording({ audio: withAudio });
      activeRef.current = active;
      setStatus({ kind: "recording" });
      // Covers both our Stop button and Chrome's "Stop sharing" button.
      const recording = await active.finished;
      activeRef.current = null;
      setStatus({ kind: "done", recording, url: URL.createObjectURL(recording.blob) });
    } catch (error) {
      activeRef.current = null;
      setStatus({ kind: "error", message: describeError(error) });
    }
  }

  function stop() {
    void activeRef.current?.stop();
  }

  return (
    <section className="flex w-full max-w-3xl flex-col gap-6">
      {(status.kind === "idle" || status.kind === "error") && (
        <div className="flex flex-col items-start gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={withAudio}
              onChange={(event) => setWithAudio(event.target.checked)}
            />
            Record tab / system audio
          </label>
          <button type="button" onClick={start} className={primaryButton}>
            Start recording
          </button>
          {status.kind === "error" && (
            <p role="alert" className="text-sm text-red-500">
              {status.message}
            </p>
          )}
        </div>
      )}

      {status.kind === "requesting" && (
        <p className="opacity-70">Choose a tab, window or screen in the browser dialog…</p>
      )}

      {status.kind === "recording" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 font-medium text-red-500">
              <span className="size-2.5 animate-pulse rounded-full bg-red-500" />
              Recording
            </span>
            <span ref={timerRef} className="font-mono tabular-nums">
              0:00.0
            </span>
            <button type="button" onClick={stop} className={primaryButton}>
              Stop
            </button>
          </div>
          {/* muted: we never want to play captured audio back into the capture */}
          <video
            ref={livePreviewRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded-lg border border-black/10 dark:border-white/10"
          />
        </div>
      )}

      {status.kind === "done" && (
        <div className="flex flex-col gap-4">
          <video
            src={status.url}
            controls
            playsInline
            className="w-full rounded-lg border border-black/10 dark:border-white/10"
          />
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="opacity-60">Duration</dt>
            <dd className="font-mono">{formatTime(status.recording.durationMs)}</dd>
            <dt className="opacity-60">Size</dt>
            <dd className="font-mono">
              {status.recording.width}×{status.recording.height},{" "}
              {(status.recording.blob.size / 1_000_000).toFixed(1)} MB
            </dd>
            <dt className="opacity-60">Format</dt>
            <dd className="font-mono">{status.recording.mimeType}</dd>
          </dl>
          <div className="flex gap-3">
            <a
              href={status.url}
              download={`vidzart-recording.${extensionForMimeType(status.recording.mimeType)}`}
              className={primaryButton}
            >
              Download
            </a>
            <button
              type="button"
              onClick={() => setStatus({ kind: "idle" })}
              className={secondaryButton}
            >
              Record again
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === "NotAllowedError") {
    return "Screen sharing was cancelled or blocked.";
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong while recording.";
}

const primaryButton =
  "rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background transition-opacity hover:opacity-85";
const secondaryButton =
  "rounded-md border border-black/15 px-4 py-2 text-sm font-medium transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10";
