"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import {
  addZoomAt,
  cutSelectedRange,
  removeSelectedSegment,
  trimEndFrom,
  trimStartTo,
} from "@/lib/editor/actions";
import { trimsOf } from "@/lib/project/segments";
import { formatTime } from "@/lib/time/formatTime";
import { useEditor, useEditorContext } from "./EditorContext";
import { button } from "./styles";
import { SegmentLane } from "./SegmentLane";

// The timeline shows the SOURCE timeline (the whole recording), so cut parts
// stay visible as hatched blocks you can select and restore. Layout:
//
//   ruler     | 0:00   0:05   0:10 ...
//   track     | [ recording ////cut//// recording ]   ← drag to scrub
//   zoom lane | [ 2.0× ]      [ 1.5× ]                ← drag to add/move/resize zooms
//   speed     |        [ ⏩ 2× ]                       ← same, for speed-ups
//   blur      |   [ blur ]   [ blur ]                   ← same, for blur boxes
//   cut lane  | [   drag to select a range   ]        ← then "Cut selection"
//
// x = ms / duration × width. The playhead line moves via a direct style write
// in an animation-frame loop, not React state.

// No 250: labels show tenths of a second, so 0.25s steps would read "0:00.2, 0:00.5, 0:00.7".
const TICK_STEPS_MS = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000];
const MIN_TICK_SPACING_PX = 72;

export function Timeline() {
  const { store, controller } = useEditorContext();
  const duration = useEditor((s) => s.project.source.duration);
  const segments = useEditor((s) => s.project.segments);
  const range = useEditor((s) => s.range);
  const selectedId = useEditor((s) => s.selectedSegmentId);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const trims = useMemo(() => trimsOf(segments), [segments]);

  const areaRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  // Width changes are "human speed" (window resizes), so React state is fine.
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry?.contentRect.width ?? 0));
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Playhead position, every frame.
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const area = areaRef.current;
      const playhead = playheadRef.current;
      if (area && playhead && duration > 0) {
        const x = (controller.getSourceTime() / duration) * area.clientWidth;
        playhead.style.transform = `translateX(${x}px)`;
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [controller, duration]);

  const toMs = (clientX: number): number => {
    const rect = areaRef.current!.getBoundingClientRect();
    const fraction = (clientX - rect.left) / rect.width;
    return Math.min(Math.max(fraction, 0), 1) * duration;
  };
  const msFromEvent = (event: PointerEvent<HTMLElement>) => toMs(event.clientX);
  const pct = (ms: number) => `${(ms / duration) * 100}%`;

  // --- scrubbing on the track -------------------------------------------
  const onTrackDown = (event: PointerEvent<HTMLDivElement>) => {
    // Pointer capture keeps the drag working even when the pointer leaves
    // the element (or the window).
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.pause();
    controller.seekSource(msFromEvent(event));
  };
  const onTrackMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      controller.seekSource(msFromEvent(event));
    }
  };

  // --- range selection on the cut lane ----------------------------------
  const anchor = useRef<number | null>(null);
  const onLaneDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    anchor.current = msFromEvent(event);
    store.setUi({ range: null, selectedSegmentId: null });
  };
  const onLaneMove = (event: PointerEvent<HTMLDivElement>) => {
    if (anchor.current === null) return;
    const ms = msFromEvent(event);
    store.setUi({ range: { start: Math.min(anchor.current, ms), end: Math.max(anchor.current, ms) } });
  };
  const onLaneUp = () => {
    anchor.current = null;
    const current = store.getState().range;
    // A click without a real drag clears the selection.
    if (current && current.end - current.start < duration / 500) store.setUi({ range: null });
  };

  const { ticks, tickStep } = useMemo(() => {
    if (width === 0 || duration === 0) return { ticks: [], tickStep: 1_000 };
    const msPerPx = duration / width;
    const step = TICK_STEPS_MS.find((s) => s / msPerPx >= MIN_TICK_SPACING_PX) ?? TICK_STEPS_MS.at(-1)!;
    const result: number[] = [];
    for (let t = 0; t <= duration; t += step) result.push(t);
    return { ticks: result, tickStep: step };
  }, [width, duration]);
  // Sub-second ticks need the tenths digit, or neighbors would read "0:00 0:00 …".
  const tickLabel = (t: number) => (tickStep < 1_000 ? formatTime(t) : formatTime(t).replace(/\.\d$/, ""));

  const selectedTrim = trims.find((t) => t.id === selectedId);

  return (
    <section className="flex flex-col gap-2 select-none" aria-label="Timeline">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={button}
          disabled={!range}
          onClick={() => cutSelectedRange(store)}
          title="Cut the selected range (Delete)"
        >
          ✂ Cut selection
        </button>
        <button
          type="button"
          className={button}
          onClick={() => trimStartTo(store, controller.getSourceTime())}
          title="Remove everything before the playhead ([)"
        >
          ⇤ Trim start
        </button>
        <button
          type="button"
          className={button}
          onClick={() => trimEndFrom(store, controller.getSourceTime())}
          title="Remove everything after the playhead (])"
        >
          Trim end ⇥
        </button>
        <button
          type="button"
          className={button}
          onClick={() => addZoomAt(store, controller.getSourceTime())}
          title="Add a zoom at the playhead (Z)"
        >
          🔍 Add zoom
        </button>
        {selectedTrim && (
          <button
            type="button"
            className={button}
            onClick={() => removeSelectedSegment(store)}
            title="Restore the selected cut (Delete)"
          >
            ↺ Restore cut
          </button>
        )}
        <span className="flex-1" />
        <button type="button" className={button} disabled={!canUndo} onClick={() => store.undo()} title="Undo (⌘Z)">
          Undo
        </button>
        <button type="button" className={button} disabled={!canRedo} onClick={() => store.redo()} title="Redo (⇧⌘Z)">
          Redo
        </button>
      </div>

      <div ref={areaRef} className="relative">
        {/* ruler */}
        <div className="relative h-5 text-[10px] opacity-60">
          {ticks.map((t) => (
            // The 0 label would be half off-screen if centered; left-align it.
            <span key={t} className={`absolute top-0 font-mono ${t === 0 ? "" : "-translate-x-1/2"}`} style={{ left: pct(t) }}>
              {tickLabel(t)}
            </span>
          ))}
        </div>

        {/* track: scrub */}
        <div
          data-testid="timeline-track"
          className="relative h-14 cursor-pointer overflow-hidden rounded-md bg-indigo-500/25 ring-1 ring-indigo-500/40"
          onPointerDown={onTrackDown}
          onPointerMove={onTrackMove}
        >
          {ticks.map((t) => (
            <span key={t} className="absolute top-0 h-full w-px bg-black/10 dark:bg-white/10" style={{ left: pct(t) }} />
          ))}
          {trims.map((trim) => (
            <div
              key={trim.id}
              className="absolute inset-y-0 bg-[repeating-linear-gradient(45deg,rgba(0,0,0,.45)_0_6px,rgba(0,0,0,.25)_6px_12px)]"
              style={{ left: pct(trim.start), width: pct(trim.end - trim.start) }}
            />
          ))}
        </div>

        <SegmentLane kind="zoom" toMs={toMs} duration={duration} />
        <SegmentLane kind="speed" toMs={toMs} duration={duration} />
        <SegmentLane kind="blur" toMs={toMs} duration={duration} />

        {/* cut lane: select a range, click cut blocks */}
        <div
          data-testid="timeline-lane"
          className="relative mt-1 h-7 cursor-crosshair rounded-md bg-black/[.04] dark:bg-white/[.05]"
          onPointerDown={onLaneDown}
          onPointerMove={onLaneMove}
          onPointerUp={onLaneUp}
        >
          {trims.length === 0 && !range && (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs opacity-40">
              Drag here to select a range to cut
            </span>
          )}
          {trims.map((trim) => (
            <button
              key={trim.id}
              type="button"
              data-testid="trim-block"
              aria-label={`Cut from ${formatTime(trim.start)} to ${formatTime(trim.end)}`}
              aria-pressed={trim.id === selectedId}
              className={`absolute inset-y-1 rounded-sm text-[10px] font-medium text-white ${
                trim.id === selectedId ? "bg-red-500 ring-2 ring-red-300" : "bg-red-500/70 hover:bg-red-500"
              }`}
              style={{ left: pct(trim.start), width: pct(trim.end - trim.start) }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={() => store.setUi({ selectedSegmentId: trim.id, range: null })}
            >
              cut
            </button>
          ))}
          {range && (
            <div
              data-testid="range-selection"
              className="pointer-events-none absolute inset-y-0 rounded-sm bg-amber-400/40 ring-1 ring-amber-500"
              style={{ left: pct(range.start), width: pct(range.end - range.start) }}
            />
          )}
        </div>

        {/* playhead spans ruler + track + lane */}
        <div
          ref={playheadRef}
          data-testid="playhead"
          className="pointer-events-none absolute inset-y-0 left-0 w-0.5 -ml-px bg-red-500"
        />
      </div>
    </section>
  );
}
