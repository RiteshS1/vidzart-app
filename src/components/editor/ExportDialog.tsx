"use client";

import { useEffect, useRef, useState } from "react";
import { startExport, type RunningExport } from "@/lib/export/exportClient";
import { EXPORT_FORMATS, exportSize, type ExportFormat, type ExportResult } from "@/lib/export/exportVideo";
import type { VidzEvents } from "@/lib/events/types";
import { formatTime } from "@/lib/time/formatTime";
import { useEditorContext } from "./EditorContext";
import { button, panelLabel, primaryButton, segment } from "./styles";

// The export dialog: choose format, resolution and frame rate, then render in a
// worker (lib/export) and offer the file. It is a native <dialog>, so focus
// trapping, Esc and the backdrop come from the browser.

/** `longSide` is the output's longer edge in px; the other edge follows the aspect ratio. */
const RESOLUTIONS = [
  { label: "720p", longSide: 1280 },
  { label: "1080p", longSide: 1920 },
  { label: "1440p", longSide: 2560 },
  { label: "4K", longSide: 3840 },
];

/** Which screen the dialog shows: pick options → progress → result (or an error to retry from). */
type State =
  | { kind: "setup" }
  | { kind: "running"; fraction: number; startedAt: number }
  | { kind: "done"; result: ExportResult; url: string; seconds: number }
  | { kind: "error"; message: string };

export function ExportDialog(props: { video: File; events: VidzEvents | null; name: string; onClose: () => void }) {
  const { store, controller, assets } = useEditorContext();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const runningRef = useRef<RunningExport | null>(null);
  const [state, setState] = useState<State>({ kind: "setup" });
  const [longSide, setLongSide] = useState(1920);
  const [format, setFormat] = useState<ExportFormat>("mp4");
  const [fps, setFps] = useState(() => (store.getState().project.source.fps >= 50 ? 60 : 30));
  // Read once per render only to show the resulting pixel size; the export itself
  // re-reads the store in start() so it uses the latest edits.
  const project = store.getState().project;
  const size = exportSize(project, longSide);

  // showModal() gives us focus trapping, Esc-to-close and a backdrop for free.
  useEffect(() => {
    const dialog = dialogRef.current;
    controller.pause();
    dialog?.showModal();
    return () => dialog?.close();
  }, [controller]);

  // Cancel a running export if the dialog goes away (e.g. the editor closes).
  useEffect(() => () => runningRef.current?.cancel(), []);

  // Free the result's object URL when it is replaced or the dialog closes.
  const doneUrl = state.kind === "done" ? state.url : null;
  useEffect(() => {
    if (!doneUrl) return;
    return () => URL.revokeObjectURL(doneUrl);
  }, [doneUrl]);

  const start = async () => {
    const startedAt = performance.now();
    setState({ kind: "running", fraction: 0, startedAt });
    const project = store.getState().project;
    const musicSrc = project.audio?.music?.src;
    const running = startExport(
      {
        video: props.video,
        music: musicSrc ? (assets.get(musicSrc) ?? null) : null,
        project,
        events: props.events,
        options: { longSide, fps, format },
      },
      (fraction) => setState({ kind: "running", fraction, startedAt }),
    );
    runningRef.current = running;
    try {
      const result = await running.done;
      runningRef.current = null;
      if (!result) {
        // `done` resolves to null when the user canceled: back to the options, not an error.
        setState({ kind: "setup" });
        return;
      }
      setState({
        kind: "done",
        result,
        url: URL.createObjectURL(result.blob),
        seconds: (performance.now() - startedAt) / 1000,
      });
    } catch (error) {
      runningRef.current = null;
      setState({ kind: "error", message: error instanceof Error ? error.message : String(error) });
    }
  };

  const close = () => {
    runningRef.current?.cancel();
    props.onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault(); // Esc: route through close() so we cancel properly
        close();
      }}
      aria-labelledby="export-title"
      className="m-auto w-[min(92vw,520px)] rounded-xl bg-background p-6 text-foreground shadow-2xl backdrop:bg-black/60"
    >
      <h2 id="export-title" className="mb-4 text-lg font-semibold">
        Export video
      </h2>

      {(state.kind === "setup" || state.kind === "error") && (
        <div className="flex flex-col gap-5">
          {/* Format first: it decides which codecs are used (see EXPORT_FORMATS). */}
          <fieldset className="flex flex-col gap-2">
            <legend className={panelLabel}>Format</legend>
            <div className="mt-2 grid grid-cols-3 gap-1" role="group" aria-label="Format">
              {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={format === key}
                  onClick={() => setFormat(key)}
                  className={`${segment(format === key)} py-2 text-sm`}
                >
                  {EXPORT_FORMATS[key].label}
                </button>
              ))}
            </div>
            <p className="text-xs text-ink-muted">{EXPORT_FORMATS[format].description}</p>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className={panelLabel}>Resolution</legend>
            <div className="mt-2 grid grid-cols-4 gap-1">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r.label}
                  type="button"
                  aria-pressed={longSide === r.longSide}
                  onClick={() => setLongSide(r.longSide)}
                  className={`rounded-md px-2 py-2 text-sm font-medium ${
                    longSide === r.longSide
                      ? "bg-foreground text-background"
                      : "bg-black/[.05] hover:bg-black/10 dark:bg-white/[.07] dark:hover:bg-white/15"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <p className="font-mono text-xs opacity-60" data-testid="export-size">
              {size.width}×{size.height}
            </p>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className={panelLabel}>Frame rate</legend>
            <div className="mt-2 grid grid-cols-2 gap-1">
              {[30, 60].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={fps === value}
                  onClick={() => setFps(value)}
                  className={`rounded-md px-2 py-2 text-sm font-medium ${
                    fps === value
                      ? "bg-foreground text-background"
                      : "bg-black/[.05] hover:bg-black/10 dark:bg-white/[.07] dark:hover:bg-white/15"
                  }`}
                >
                  {value} fps
                </button>
              ))}
            </div>
          </fieldset>
          {state.kind === "error" && (
            <p className="text-sm text-red-500" data-testid="export-error">
              Export failed: {state.message}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" className={button} onClick={close}>
              Close
            </button>
            <button type="button" className={primaryButton} onClick={() => void start()}>
              Export
            </button>
          </div>
        </div>
      )}

      {/* Progress: the render runs in a worker, so this stays responsive and can be canceled. */}
      {state.kind === "running" && (
        <div className="flex flex-col gap-4">
          <div
            className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"
            role="progressbar"
            aria-label="Export progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(state.fraction * 100)}
          >
            <div className="h-full bg-accent transition-[width]" style={{ width: `${state.fraction * 100}%` }} />
          </div>
          <p className="flex justify-between text-sm opacity-70">
            <span>Rendering {Math.round(state.fraction * 100)}%</span>
            <span>{eta(state)}</span>
          </p>
          <p className="text-xs opacity-50">Everything happens on your device. You can keep this tab in the background.</p>
          <div className="flex justify-end">
            <button type="button" className={button} onClick={() => runningRef.current?.cancel()}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result: preview the exported file itself, then download it. */}
      {state.kind === "done" && (
        <div className="flex flex-col gap-4">
          <video src={state.url} controls playsInline className="w-full rounded-md bg-black" data-testid="export-preview" />
          <p className="text-sm opacity-70" data-testid="export-summary">
            {state.result.width}×{state.result.height} · {formatTime(state.result.durationMs)} ·{" "}
            {(state.result.blob.size / 1_000_000).toFixed(1)} MB · {state.result.videoCodec.toUpperCase()}
            {state.result.audioCodec ? ` + ${state.result.audioCodec.toUpperCase()}` : " (no audio)"} · {state.result.extension.toUpperCase()} · took{" "}
            {state.seconds.toFixed(1)}s
          </p>
          <div className="flex justify-end gap-2">
            <button type="button" className={button} onClick={close}>
              Close
            </button>
            <a
              href={state.url}
              download={`${props.name.replace(/\.[^.]+$/, "")}.${state.result.extension}`}
              className={primaryButton}
            >
              Download .{state.result.extension}
            </a>
          </div>
        </div>
      )}
    </dialog>
  );
}

function eta(state: { fraction: number; startedAt: number }): string {
  if (state.fraction < 0.03) return "Estimating…";
  const elapsed = performance.now() - state.startedAt;
  const remaining = (elapsed / state.fraction) * (1 - state.fraction);
  return `~${Math.max(1, Math.round(remaining / 1000))}s left`;
}
