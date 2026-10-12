"use client";

import { useEffect, useRef, useState } from "react";
import { editSegments } from "@/lib/editor/actions";
import { updateSegment } from "@/lib/project/segments";
import type { TextSegment } from "@/lib/project/types";
import { outputAspect } from "@/lib/render/layout";
import { renderFrame } from "@/lib/render/renderFrame";
import { layoutText } from "@/lib/render/text";
import { cutPoints, type TimeMap } from "@/lib/timeline/timeMap";
import { useEditor, useEditorContext } from "./EditorContext";

// The live preview. Everything here runs in one requestAnimationFrame loop
// set up once in an effect: React renders this component a single time and
// never again, no matter how fast the video plays.
export function PreviewCanvas() {
  const { store, controller, video, cursorAt, getCursorTrack, getTimeMap } = useEditorContext();
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    // alpha: false: the background covers every pixel, and an opaque canvas
    // lets the browser skip blending it with the page.
    const ctx = canvas?.getContext("2d", { alpha: false });
    if (!container || !canvas || !ctx) return;

    // Redraw only when something changed. While playing, that's every frame;
    // while paused, only after a seek, an edit or a resize.
    let dirty = true;
    const markDirty = () => {
      dirty = true;
    };

    // Size the canvas to the largest box of the output's aspect ratio that
    // fits the container, at device-pixel resolution so it stays sharp on
    // retina screens.
    const resize = () => {
      const { project } = store.getState();
      const aspect = outputAspect(project.settings.aspectRatio, project.source);
      const box = container.getBoundingClientRect();
      let width = box.width;
      let height = width / aspect;
      if (height > box.height) {
        height = box.height;
        width = height * aspect;
      }
      canvas.style.width = `${Math.floor(width)}px`;
      canvas.style.height = `${Math.floor(height)}px`;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(2, Math.round(width * dpr));
      canvas.height = Math.max(2, Math.round(height * dpr));
      dirty = true;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    let aspectSetting = store.getState().project.settings.aspectRatio;
    const unsubscribe = store.subscribe(() => {
      const next = store.getState().project.settings.aspectRatio;
      if (next !== aspectSetting) {
        aspectSetting = next;
        resize();
      }
      dirty = true;
    });

    // `seeked` fires once the frame at the new position is decoded, the
    // moment it's worth redrawing.
    video.addEventListener("seeked", markDirty);
    video.addEventListener("loadeddata", markDirty);

    let frame = 0;
    const loop = () => {
      controller.tick();
      if (dirty || controller.playing) {
        dirty = false;
        const { project } = store.getState();
        const map = getTimeMap();
        // readyState >= HAVE_CURRENT_DATA means there's a frame to draw.
        const hasFrame = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
        renderFrame(
          ctx,
          { width: canvas.width, height: canvas.height },
          {
            image: hasFrame ? video : null,
            // Intrinsic pixel size of the element's frames; falls back to the
            // probed size before the first frame has loaded.
            size: {
              width: video.videoWidth || project.source.width,
              height: video.videoHeight || project.source.height,
            },
          },
          project,
          {
            sourceTime: controller.getSourceTime(),
            cursorAt,
            cursor: getCursorTrack(project),
            output: { time: controller.getOutputTime(), duration: map.outputDuration, cuts: cutsOf(map) },
          },
        );
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribe();
      video.removeEventListener("seeked", markDirty);
      video.removeEventListener("loadeddata", markDirty);
    };
  }, [store, controller, video, cursorAt, getCursorTrack, getTimeMap]);

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
      {/* The wrapper is exactly the canvas's size, so overlays line up with it. */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          data-testid="preview-canvas"
          className="block rounded-md shadow-2xl shadow-black/50"
          onClick={() => controller.toggle()}
        />
        <TextHandle canvasRef={canvasRef} />
      </div>
    </div>
  );
}

/**
 * When a text overlay is selected, a dashed box around it on the preview:
 * drag it to move the text. The box comes from the same layout code that
 * draws the text (layoutText), so it fits exactly.
 */
function TextHandle({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const { store } = useEditorContext();
  const selected = useEditor((s) => s.project.segments.find((x) => x.id === s.selectedSegmentId) ?? null);
  // Re-measure when the canvas is resized (human-speed: window resizes).
  const [size, setSize] = useState({ width: 0, height: 0, cssWidth: 0, cssHeight: 0 });
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const update = () =>
      setSize({ width: canvas.width, height: canvas.height, cssWidth: canvas.clientWidth, cssHeight: canvas.clientHeight });
    const observer = new ResizeObserver(update);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [canvasRef]);
  const drag = useRef<{ x: number; y: number; px: number; py: number; key: string } | null>(null);

  if (selected?.type !== "text" || size.width === 0) return null;
  const text = selected;
  const layout = layoutText(scratchContext(), text, size);
  const k = size.cssWidth / size.width; // canvas px → CSS px
  const box = layout.box;

  return (
    <div
      data-testid="text-handle"
      aria-label="Drag to move the text"
      className="absolute cursor-move rounded-sm border-2 border-dashed border-amber-400 touch-none"
      style={{ left: box.x * k - 4, top: box.y * k - 4, width: box.width * k + 8, height: box.height * k + 8 }}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: text.x, y: text.y, px: e.clientX, py: e.clientY, key: `text-move-${text.id}-${e.timeStamp}` };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const x = Math.min(1, Math.max(0, d.x + (e.clientX - d.px) / size.cssWidth));
        const y = Math.min(1, Math.max(0, d.y + (e.clientY - d.py) / size.cssHeight));
        // The whole drag is one undo step.
        editSegments(store, (s) => updateSegment<TextSegment>(s, text.id, { x, y }), { coalesceKey: d.key });
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    />
  );
}

// Cut points are derived from the time map; cache them per map object
// (getTimeMap returns the same object until the segments change).
const cutCache = new WeakMap<TimeMap, number[]>();
function cutsOf(map: TimeMap): number[] {
  let cuts = cutCache.get(map);
  if (!cuts) cutCache.set(map, (cuts = cutPoints(map)));
  return cuts;
}

let scratch: CanvasRenderingContext2D | null = null;
/** A 2D context just for measuring text. */
function scratchContext(): CanvasRenderingContext2D {
  scratch ??= document.createElement("canvas").getContext("2d")!;
  return scratch;
}
