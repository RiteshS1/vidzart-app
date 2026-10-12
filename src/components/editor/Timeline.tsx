"use client";

import { ArrowLeftToLine, ArrowRightToLine, EyeOff, Film, Gauge, Minus, Music, Plus, Redo2, Scissors, Shapes, Type, Undo2, ZoomIn } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { runAiTask } from "@/lib/ai/aiClient";
import { addZoomAt, cutSelectedRange, editSegments, trimEndFrom, trimStartTo } from "@/lib/editor/actions";
import type { Thumbnails } from "@/lib/media/thumbnails";
import { removeSegment, trimsOf } from "@/lib/project/segments";
import { cutSeams, outputSpan } from "@/lib/timeline/layout";
import { outputToSource, type TimeMap } from "@/lib/timeline/timeMap";
import { formatTime } from "@/lib/time/formatTime";
import { useEditor, useEditorContext } from "./EditorContext";
import { SegmentLane, type Placer } from "./SegmentLane";
import { button } from "./styles";

// The timeline shows OUTPUT time, like a regular video editor: cut parts are
// gone (a small ✂ seam marks where, click it to restore), and sped-up parts
// are shorter. Segments are stored in source time and mapped through the
// time map for display; pointer positions map back the same way.
//
//   ruler   | 0:00   0:05   0:10 ...   ← click or drag to scrub (playhead handle lives here)
//   clips   | [▮▮▮▮▮▮✂▮▮▮▮▮▮▮▮▮▮▮]      ← filmstrip; click = seek, drag = select a range
//   zoom    | [ 2.0× ]      [ 1.5× ]  ← drag to add/move/resize
//   speed   |        [ 2× speed ]
//   blur    |   [ blur ]
//
// The content is `zoom` times as wide as the visible area and scrolls
// horizontally (⌘/Ctrl + wheel or the −/+ buttons to zoom). The playhead
// moves via direct style writes in an animation-frame loop, not React state.

// No 250: labels show tenths of a second, so 0.25s steps would read "0:00.2, 0:00.5, 0:00.7".
const TICK_STEPS_MS = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 15_000, 30_000, 60_000, 120_000, 300_000];
const MIN_TICK_SPACING_PX = 72;
const MAX_ZOOM = 24;
const TRACK_HEIGHT = 56;
/** A pointer that moves less than this on the clip track is a click (seek), not a drag (select). */
const DRAG_THRESHOLD_PX = 4;

export function Timeline({ source }: { source: Blob }) {
  const { store, controller, getTimeMap } = useEditorContext();
  const duration = useEditor((s) => s.project.source.duration);
  const segments = useEditor((s) => s.project.segments);
  const range = useEditor((s) => s.range);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  // getTimeMap is memoized on the segments array, so this is cheap.
  const map = useMemo(() => {
    void segments; // recompute when segments change
    return getTimeMap();
  }, [getTimeMap, segments]);
  const outDuration = Math.max(1, map.outputDuration);
  const seams = useMemo(() => cutSeams(map, trimsOf(segments)), [map, segments]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const [viewport, setViewport] = useState(0); // visible width, px
  const [zoom, setZoom] = useState(1);
  const width = viewport * zoom; // content width, px

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setViewport(entry?.contentRect.width ?? 0));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // --- coordinates --------------------------------------------------------
  const toOutput = useCallback(
    (clientX: number): number => {
      const rect = contentRef.current!.getBoundingClientRect();
      return Math.min(Math.max((clientX - rect.left) / rect.width, 0), 1) * outDuration;
    },
    [outDuration],
  );
  const toSource = useCallback((clientX: number) => outputToSource(map, toOutput(clientX)), [map, toOutput]);
  const pct = (outputMs: number) => `${(outputMs / outDuration) * 100}%`;
  const place: Placer = (start, end) => {
    const span = outputSpan(map, start, end);
    return span ? { left: pct(span.start), width: pct(span.end - span.start) } : null;
  };

  // --- playhead: follows playback every frame, keeps itself in view -------
  useEffect(() => {
    let frame = 0;
    const loop = () => {
      const content = contentRef.current;
      const playhead = playheadRef.current;
      const scroller = scrollRef.current;
      if (content && playhead && scroller) {
        const x = (controller.getOutputTime() / outDuration) * content.clientWidth;
        playhead.style.transform = `translateX(${x}px)`;
        // While playing, page the view along like editors do.
        if (controller.playing && (x < scroller.scrollLeft || x > scroller.scrollLeft + scroller.clientWidth - 24)) {
          scroller.scrollLeft = x - 24;
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [controller, outDuration]);

  // --- scrubbing: ruler and playhead handle -------------------------------
  const scrubDown = (event: PointerEvent<HTMLElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    controller.pause();
    controller.seekOutput(toOutput(event.clientX));
  };
  const scrubMove = (event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) controller.seekOutput(toOutput(event.clientX));
  };

  // --- clip track: click = seek, drag = select a range -------------------
  const press = useRef<{ x: number; anchor: number; selecting: boolean } | null>(null);
  const onTrackDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    press.current = { x: event.clientX, anchor: toOutput(event.clientX), selecting: false };
  };
  const onTrackMove = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    if (!p) return;
    if (!p.selecting && Math.abs(event.clientX - p.x) < DRAG_THRESHOLD_PX) return;
    p.selecting = true;
    const a = Math.min(p.anchor, toOutput(event.clientX));
    const b = Math.max(p.anchor, toOutput(event.clientX));
    // Stored in source time (what a cut needs), selected in output time.
    store.setUi({ range: { start: outputToSource(map, a), end: outputToSource(map, b) }, selectedSegmentId: null });
  };
  const onTrackUp = (event: PointerEvent<HTMLDivElement>) => {
    const p = press.current;
    press.current = null;
    if (!p || p.selecting) return;
    store.setUi({ range: null, selectedSegmentId: null });
    controller.pause();
    controller.seekOutput(toOutput(event.clientX));
  };

  // --- timeline zoom ------------------------------------------------------
  // Keeps the moment under `anchorClientX` (default: the playhead) in place.
  const zoomTo = useCallback(
    (next: number, anchorClientX?: number) => {
      const scroller = scrollRef.current;
      const content = contentRef.current;
      const clamped = Math.min(MAX_ZOOM, Math.max(1, next));
      if (!scroller || !content) return setZoom(clamped);
      const rect = scroller.getBoundingClientRect();
      const anchorX =
        anchorClientX ?? rect.left + (controller.getOutputTime() / outDuration) * content.clientWidth - scroller.scrollLeft;
      const fraction = (anchorX - rect.left + scroller.scrollLeft) / content.clientWidth;
      setZoom(clamped);
      requestAnimationFrame(() => {
        scroller.scrollLeft = fraction * scroller.clientWidth * clamped - (anchorX - rect.left);
      });
    },
    [controller, outDuration],
  );
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    // Non-passive so ⌘/Ctrl + wheel (and trackpad pinch, which Chrome sends
    // as ctrl+wheel) zooms the timeline instead of the whole page.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      zoomTo(zoom * Math.exp(-event.deltaY * 0.01), event.clientX);
    };
    scroller.addEventListener("wheel", onWheel, { passive: false });
    return () => scroller.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo]);

  // --- ruler ticks ----------------------------------------------------------
  const { ticks, tickStep } = useMemo(() => {
    if (width === 0) return { ticks: [], tickStep: 1_000 };
    const msPerPx = outDuration / width;
    const step = TICK_STEPS_MS.find((s) => s / msPerPx >= MIN_TICK_SPACING_PX) ?? TICK_STEPS_MS.at(-1)!;
    const result: number[] = [];
    for (let t = 0; t <= outDuration; t += step) result.push(t);
    return { ticks: result, tickStep: step };
  }, [width, outDuration]);
  // Sub-second ticks need the tenths digit, or neighbors would read "0:00 0:00 …".
  const tickLabel = (t: number) => (tickStep < 1_000 ? formatTime(t) : formatTime(t).replace(/\.\d$/, ""));

  const rangeSpan = range ? outputSpan(map, range.start, range.end) : null;
  const hasMusic = useEditor((s) => Boolean(s.project.audio?.music));

  return (
    <section className="flex flex-col gap-2 select-none" aria-label="Timeline">
      {/* Icons only up to lg so the whole row fits one line on a phone or tablet; labelled from lg. */}
      <div className="flex items-center gap-1 overflow-x-auto md:flex-wrap md:gap-2 md:overflow-visible [&>*]:shrink-0 max-lg:[&_button]:w-10 max-lg:[&_button]:px-0">
        <button
          type="button"
          className={button}
          disabled={!range}
          onClick={() => cutSelectedRange(store)}
          title="Drag on the clips to select a range, then cut it (Delete)"
        >
          <Scissors className="size-4" aria-hidden /> <span className="sr-only lg:not-sr-only">Cut selection</span>
        </button>
        <button
          type="button"
          className={button}
          onClick={() => trimStartTo(store, controller.getSourceTime())}
          title="Remove everything before the playhead ([)"
        >
          <ArrowLeftToLine className="size-4" aria-hidden /> <span className="sr-only lg:not-sr-only">Trim start</span>
        </button>
        <button
          type="button"
          className={button}
          onClick={() => trimEndFrom(store, controller.getSourceTime())}
          title="Remove everything after the playhead (])"
        >
          <span className="sr-only lg:not-sr-only">Trim end</span> <ArrowRightToLine className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={button}
          onClick={() => addZoomAt(store, controller.getSourceTime())}
          title="Add a zoom at the playhead (Z)"
        >
          <ZoomIn className="size-4" aria-hidden /> <span className="sr-only lg:not-sr-only">Add zoom</span>
        </button>
        <span className="flex-1" />
        <div className="flex items-center gap-1" role="group" aria-label="Timeline zoom">
          <button type="button" className={button} onClick={() => zoomTo(zoom / 1.5)} disabled={zoom <= 1} aria-label="Zoom timeline out">
            <Minus className="size-3.5" aria-hidden />
          </button>
          <button type="button" className={button} onClick={() => zoomTo(zoom * 1.5)} disabled={zoom >= MAX_ZOOM} aria-label="Zoom timeline in">
            <Plus className="size-3.5" aria-hidden />
          </button>
        </div>
        <button type="button" className={button} disabled={!canUndo} onClick={() => store.undo()} title="Undo (⌘Z)">
          <Undo2 className="size-4" aria-hidden /> <span className="sr-only lg:not-sr-only">Undo</span>
        </button>
        <button type="button" className={button} disabled={!canRedo} onClick={() => store.redo()} title="Redo (⇧⌘Z)">
          <Redo2 className="size-4" aria-hidden /> <span className="sr-only lg:not-sr-only">Redo</span>
        </button>
      </div>

      <div className="flex max-h-[max(30dvh,7rem)] overflow-y-auto [@media(max-height:520px)]:max-h-24">
      {/* Lane names, aligned with the rows on the right (same heights + gap). */}
      <div className="flex w-20 shrink-0 flex-col gap-1 pr-2 text-[11px] font-medium text-ink-muted" aria-hidden>
        <div className="h-6" />
        <LaneLabel icon={Film} height={TRACK_HEIGHT}>
          Clips
        </LaneLabel>
        <LaneLabel icon={ZoomIn}>Zoom</LaneLabel>
        <LaneLabel icon={Gauge}>Speed</LaneLabel>
        <LaneLabel icon={EyeOff}>Blur</LaneLabel>
        <LaneLabel icon={Shapes}>Shapes</LaneLabel>
        <LaneLabel icon={Type}>Text</LaneLabel>
        {hasMusic && <LaneLabel icon={Music}>Music</LaneLabel>}
      </div>
      <div ref={scrollRef} className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden px-2 pb-1" data-testid="timeline-scroll">
        <div ref={contentRef} className="relative flex flex-col gap-1" style={{ width: width || "100%" }}>
          {/* ruler: click/drag to scrub */}
          <div
            data-testid="timeline-ruler"
            className="relative h-6 cursor-pointer text-[10px] opacity-70"
            onPointerDown={scrubDown}
            onPointerMove={scrubMove}
          >
            {ticks.map((t) => (
              // The 0 label would be half off-screen if centered; left-align it.
              <span key={t} className={`absolute top-1 font-mono ${t === 0 ? "" : "-translate-x-1/2"}`} style={{ left: pct(t) }}>
                {tickLabel(t)}
              </span>
            ))}
          </div>

          {/* clips: filmstrip; click = seek, drag = select a range */}
          <div
            data-testid="timeline-track"
            className="relative cursor-text overflow-hidden rounded-md bg-surface-2 ring-1 ring-line-strong"
            style={{ height: TRACK_HEIGHT }}
            onPointerDown={onTrackDown}
            onPointerMove={onTrackMove}
            onPointerUp={onTrackUp}
          >
            <Filmstrip source={source} width={width} map={map} />
            {rangeSpan && (
              <div
                data-testid="range-selection"
                className="pointer-events-none absolute inset-y-0 bg-amber-400/35 ring-2 ring-inset ring-amber-400"
                style={{ left: pct(rangeSpan.start), width: pct(rangeSpan.end - rangeSpan.start) }}
              />
            )}
            {seams.map(({ at, trim }) => (
              <button
                key={trim.id}
                type="button"
                data-testid="cut-seam"
                aria-label={`Restore cut (${formatTime(trim.end - trim.start)})`}
                title={`Cut ${formatTime(trim.end - trim.start)} here. Click to restore it.`}
                className="group absolute inset-y-0 z-10 -ml-2 flex w-4 cursor-pointer flex-col items-center"
                style={{ left: pct(at) }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => editSegments(store, (s) => removeSegment(s, trim.id))}
              >
                <span className="h-full w-0.5 bg-white/90 shadow group-hover:bg-amber-300" />
                <span className="absolute top-1 flex size-4 items-center justify-center rounded-full bg-white text-black shadow group-hover:bg-amber-300">
                  <Scissors className="size-2.5 group-hover:hidden" aria-hidden />
                  <Undo2 className="hidden size-2.5 group-hover:block" aria-hidden />
                </span>
              </button>
            ))}
          </div>

          <SegmentLane kind="zoom" toMs={toSource} place={place} duration={duration} />
          <SegmentLane kind="speed" toMs={toSource} place={place} duration={duration} />
          <SegmentLane kind="blur" toMs={toSource} place={place} duration={duration} />
          <SegmentLane kind="shape" toMs={toSource} place={place} duration={duration} />
          <SegmentLane kind="text" toMs={toSource} place={place} duration={duration} />
          {hasMusic && <MusicLane width={width} outDuration={outDuration} />}

          {/* playhead: line across everything, with a handle on the ruler to drag */}
          <div
            ref={playheadRef}
            data-testid="playhead"
            className="pointer-events-none absolute inset-y-0 left-0 z-20 w-0.5 -ml-px bg-red-500"
          >
            <div
              data-testid="playhead-handle"
              // Pointer-only grip; keyboard users move the playhead with ←/→, Home, End.
              aria-hidden
              title="Drag to move the playhead"
              className="pointer-events-auto absolute -top-0.5 left-1/2 h-4 w-3.5 -translate-x-1/2 cursor-grab rounded-b-md rounded-t-sm bg-red-500 shadow active:cursor-grabbing"
              onPointerDown={scrubDown}
              onPointerMove={scrubMove}
            />
          </div>
        </div>
      </div>
      </div>
    </section>
  );
}

function LaneLabel({ icon: Icon, height = 32, children }: { icon: typeof Film; height?: number; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5" style={{ height }}>
      <Icon className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

/**
 * The clip track's background: one thumbnail per tile, drawn on a canvas.
 * Thumbnails are decoded once per file in the worker; each tile shows the
 * one nearest to its output moment, so it follows cuts and zoom instantly.
 */
function Filmstrip({ source, width, map }: { source: Blob; width: number; map: TimeMap }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const duration = useEditor((s) => s.project.source.duration);
  const [thumbs, setThumbs] = useState<Thumbnails | null>(null);

  useEffect(() => {
    // ~1.5 per second of video, within sensible bounds.
    const count = Math.min(150, Math.max(12, Math.ceil((duration / 1000) * 1.5)));
    const task = runAiTask({ type: "thumbnails", video: source, count, height: TRACK_HEIGHT * 2 });
    task.done.then(setThumbs, () => {}); // no thumbnails is fine: the track stays plain
    return () => task.cancel();
  }, [source, duration]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !thumbs?.frames.length || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = TRACK_HEIGHT * dpr;
    const first = thumbs.frames[0]!;
    const tile = (TRACK_HEIGHT * first.width) / first.height; // css px
    for (let x = 0; x < width; x += tile) {
      const outputMs = ((x + tile / 2) / width) * map.outputDuration;
      const sourceMs = outputToSource(map, outputMs);
      // Nearest decoded frame (times are ascending).
      let i = thumbs.times.findIndex((t) => t >= sourceMs);
      if (i < 0) i = thumbs.times.length - 1;
      else if (i > 0 && sourceMs - thumbs.times[i - 1]! < thumbs.times[i]! - sourceMs) i--;
      ctx.drawImage(thumbs.frames[i]!, x * dpr, 0, tile * dpr, TRACK_HEIGHT * dpr);
    }
  }, [thumbs, width, map]);

  useEffect(() => () => thumbs?.frames.forEach((f) => f.close()), [thumbs]);

  return (
    <canvas
      ref={canvasRef}
      data-testid="filmstrip"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-80"
      aria-hidden
    />
  );
}

/**
 * The background music on the output timeline: a waveform from 0:00 until
 * the music ends (repeated when it loops). Peaks are computed once per file
 * in the worker.
 */
function MusicLane({ width, outDuration }: { width: number; outDuration: number }) {
  const { assets } = useEditorContext();
  const music = useEditor((s) => s.project.audio?.music ?? null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wave, setWave] = useState<{ src: string; peaks: Float32Array; durationMs: number } | null>(null);
  const src = music?.src;

  useEffect(() => {
    const file = src ? assets.get(src) : undefined;
    if (!src || !file) return;
    const task = runAiTask({ type: "waveform", audio: file, bins: 800 });
    task.done.then((w) => w && setWave({ src, ...w }), () => {});
    return () => task.cancel();
  }, [src, assets]);

  const current = wave && wave.src === src ? wave : null;
  const coverMs = current ? (music?.loop ? outDuration : Math.min(outDuration, current.durationMs)) : outDuration;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !current || width === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round((coverMs / outDuration) * width));
    canvas.width = w * dpr;
    canvas.height = 32 * dpr;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
    const pxPerMs = (w * dpr) / coverMs;
    for (let x = 0; x < canvas.width; x++) {
      const ms = (x / pxPerMs) % current.durationMs; // loops repeat the waveform
      const peak = current.peaks[Math.floor((ms / current.durationMs) * current.peaks.length)] ?? 0;
      const h = Math.max(1, peak * canvas.height * 0.9);
      ctx.fillRect(x, (canvas.height - h) / 2, 1, h);
    }
  }, [current, width, coverMs, outDuration]);

  return (
    <div data-testid="music-lane" className="relative h-8 rounded-md bg-black/[.04] dark:bg-white/[.05]">
      <div
        className="absolute inset-y-1 left-0 overflow-hidden rounded-sm bg-emerald-800/80"
        style={{ width: `${(coverMs / outDuration) * 100}%` }}
        title={music?.name}
      >
        <canvas ref={canvasRef} className="h-full w-full" aria-hidden />
        <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center text-[10px] font-semibold text-white drop-shadow">
          {music?.name}
        </span>
      </div>
    </div>
  );
}
