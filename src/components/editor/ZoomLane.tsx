"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { editSegments } from "@/lib/editor/actions";
import { addZoom, freeGap, MIN_ZOOM_MS, updateSegment, zoomsOf } from "@/lib/project/segments";
import type { ZoomSegment } from "@/lib/project/types";
import { useEditor, useEditorContext } from "./EditorContext";

// One lane of the timeline for zoom segments.
//   drag on empty space  → create a zoom over that range
//   drag a block's body  → move it
//   drag a block's edge  → resize it
//   click a block        → select it (inspector opens in the side panel)
// Moves/resizes are clamped to the free gap between neighbors, because
// zooms must never overlap (spec).

type Drag =
  | { kind: "create"; anchor: number }
  | {
      kind: "move" | "resize-start" | "resize-end";
      zoom: ZoomSegment;
      grabOffset: number; // ms between the zoom's start and where it was grabbed
      gap: { start: number; end: number };
      moved: boolean;
      key: string; // coalesce key: the whole drag is one undo step
    };

export function ZoomLane(props: { toMs: (clientX: number) => number; duration: number }) {
  const { store, controller } = useEditorContext();
  const segments = useEditor((s) => s.project.segments);
  const selectedId = useEditor((s) => s.selectedSegmentId);
  const zooms = useMemo(() => zoomsOf(segments), [segments]);
  const drag = useRef<Drag | null>(null);
  // The rubber band while creating. Local state is fine here: it only
  // re-renders this lane, and only during a drag.
  const [draft, setDraft] = useState<{ start: number; end: number } | null>(null);
  const pct = (ms: number) => `${(ms / props.duration) * 100}%`;

  const onLaneDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { kind: "create", anchor: props.toMs(event.clientX) };
    store.setUi({ selectedSegmentId: null, range: null });
  };

  const onBlockDown = (event: PointerEvent<HTMLElement>, zoom: ZoomSegment, kind: "move" | "resize-start" | "resize-end") => {
    event.stopPropagation(); // don't start a "create" drag on the lane
    event.currentTarget.setPointerCapture(event.pointerId);
    const gap = freeGap(store.getState().project.segments, "zoom", zoom.start, props.duration, zoom.id) ?? {
      start: zoom.start,
      end: zoom.end,
    };
    drag.current = {
      kind,
      zoom,
      grabOffset: props.toMs(event.clientX) - zoom.start,
      gap,
      moved: false,
      key: `zoom-drag-${zoom.id}-${event.timeStamp}`,
    };
  };

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d) return;
    const ms = props.toMs(event.clientX);
    if (d.kind === "create") {
      setDraft({ start: Math.min(d.anchor, ms), end: Math.max(d.anchor, ms) });
      return;
    }
    d.moved = true;
    const { zoom, gap } = d;
    const length = zoom.end - zoom.start;
    let start = zoom.start;
    let end = zoom.end;
    if (d.kind === "move") {
      start = Math.min(Math.max(ms - d.grabOffset, gap.start), gap.end - length);
      end = start + length;
    } else if (d.kind === "resize-start") {
      start = Math.min(Math.max(ms, gap.start), zoom.end - MIN_ZOOM_MS);
    } else {
      end = Math.max(Math.min(ms, gap.end), zoom.start + MIN_ZOOM_MS);
    }
    editSegments(store, (s) => updateSegment<ZoomSegment>(s, zoom.id, { start, end }), { coalesceKey: d.key });
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "create") {
      setDraft(null);
      const end = props.toMs(event.clientX);
      const before = new Set(store.getState().project.segments.map((s) => s.id));
      editSegments(store, (s, duration) => addZoom(s, d.anchor, end, duration));
      const added = store.getState().project.segments.find((s) => !before.has(s.id));
      if (added) store.setUi({ selectedSegmentId: added.id });
    } else if (!d.moved) {
      // A click: select it and show its fully zoomed-in moment in the preview.
      store.setUi({ selectedSegmentId: d.zoom.id, range: null });
      controller.pause();
      controller.seekSource(Math.min(d.zoom.start + d.zoom.easeInMs, (d.zoom.start + d.zoom.end) / 2));
    }
  };

  return (
    <div
      data-testid="zoom-lane"
      className="relative mt-1 h-8 cursor-crosshair rounded-md bg-black/[.04] dark:bg-white/[.05]"
      onPointerDown={onLaneDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {zooms.length === 0 && !draft && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs opacity-40">
          Drag here to add a zoom
        </span>
      )}
      {zooms.map((zoom) => {
        const selected = zoom.id === selectedId;
        return (
          <div
            key={zoom.id}
            data-testid="zoom-block"
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={`Zoom ${zoom.scale.toFixed(1)}× from ${(zoom.start / 1000).toFixed(1)}s to ${(zoom.end / 1000).toFixed(1)}s`}
            className={`group absolute inset-y-1 flex cursor-grab items-center justify-center overflow-hidden rounded-sm text-[10px] font-semibold text-white active:cursor-grabbing ${
              selected ? "bg-violet-500 ring-2 ring-violet-300" : "bg-violet-500/75 hover:bg-violet-500"
            }`}
            style={{ left: pct(zoom.start), width: pct(zoom.end - zoom.start) }}
            // Move/up events from the captured block bubble up to the lane's
            // handlers, so the block only needs pointerdown.
            onPointerDown={(e) => onBlockDown(e, zoom, "move")}
          >
            <span
              data-testid="zoom-handle-start"
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/30"
              onPointerDown={(e) => onBlockDown(e, zoom, "resize-start")}
            />
            <span className="pointer-events-none truncate px-2">
              {zoom.origin === "auto" ? "auto " : ""}
              {zoom.scale.toFixed(1)}×
            </span>
            <span
              data-testid="zoom-handle-end"
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/30"
              onPointerDown={(e) => onBlockDown(e, zoom, "resize-end")}
            />
          </div>
        );
      })}
      {draft && (
        <div
          className="pointer-events-none absolute inset-y-1 rounded-sm bg-violet-400/40 ring-1 ring-violet-500"
          style={{ left: pct(draft.start), width: pct(draft.end - draft.start) }}
        />
      )}
    </div>
  );
}
