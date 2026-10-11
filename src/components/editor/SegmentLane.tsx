"use client";

import { useMemo, useRef, useState, type PointerEvent } from "react";
import { editSegments } from "@/lib/editor/actions";
import {
  addBlur,
  addSpeed,
  addZoom,
  blursOf,
  freeGap,
  MIN_RANGE_MS,
  MIN_ZOOM_MS,
  speedsOf,
  updateSegment,
  zoomsOf,
} from "@/lib/project/segments";
import type { BlurSegment, Segment, SpeedSegment, ZoomSegment } from "@/lib/project/types";
import { useEditor, useEditorContext } from "./EditorContext";

// One lane of the timeline for one kind of range segment (zoom, speed,
// blur).
//   drag on empty space  → create a segment over that range
//   drag a block's body  → move it
//   drag a block's edge  → resize it
//   click a block        → select it (inspector opens in the side panel)
// Zooms and speed changes must never overlap their own kind (spec), so
// their moves/resizes are clamped to the free gap between neighbors. Blurs
// may overlap (hiding two things at once), so they move freely.

type RangeSegment = ZoomSegment | SpeedSegment | BlurSegment;
export type LaneKind = RangeSegment["type"];

interface LaneConfig {
  minMs: number;
  overlap: boolean;
  of: (segments: readonly Segment[]) => RangeSegment[];
  add: (segments: readonly Segment[], start: number, end: number, duration: number) => Segment[];
  hint: string;
  label: (s: RangeSegment) => string;
  describe: (s: RangeSegment) => string;
  /** Block colors: normal / selected. */
  colors: [string, string];
  /** Where to show the preview when a block is clicked. */
  seekTo: (s: RangeSegment) => number;
}

const secs = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

const LANES: Record<LaneKind, LaneConfig> = {
  zoom: {
    minMs: MIN_ZOOM_MS,
    overlap: false,
    of: zoomsOf,
    add: (s, a, b, d) => addZoom(s, a, b, d),
    hint: "Drag here to add a zoom",
    label: (z) => (z.type === "zoom" ? `${z.origin === "auto" ? "auto " : ""}${z.scale.toFixed(1)}×` : ""),
    describe: (z) => (z.type === "zoom" ? `Zoom ${z.scale.toFixed(1)}× from ${secs(z.start)} to ${secs(z.end)}` : ""),
    colors: ["bg-violet-500/75 hover:bg-violet-500", "bg-violet-500 ring-2 ring-violet-300"],
    // Its fully zoomed-in moment.
    seekTo: (z) => (z.type === "zoom" ? Math.min(z.start + z.easeInMs, (z.start + z.end) / 2) : z.start),
  },
  speed: {
    minMs: MIN_RANGE_MS,
    overlap: false,
    of: speedsOf,
    add: (s, a, b, d) => addSpeed(s, a, b, d),
    hint: "Drag here to speed up a part",
    label: (s) => (s.type === "speed" ? `⏩ ${s.rate}×` : ""),
    describe: (s) => (s.type === "speed" ? `Speed ${s.rate}× from ${secs(s.start)} to ${secs(s.end)}` : ""),
    colors: ["bg-sky-600/75 hover:bg-sky-600", "bg-sky-600 ring-2 ring-sky-300"],
    seekTo: (s) => s.start,
  },
  blur: {
    minMs: MIN_RANGE_MS,
    overlap: true,
    of: blursOf,
    add: (s, a, b, d) => addBlur(s, a, b, d),
    hint: "Drag here to blur part of the screen",
    label: () => "blur",
    describe: (s) => `Blur from ${secs(s.start)} to ${secs(s.end)}`,
    colors: ["bg-slate-600/70 hover:bg-slate-600", "bg-slate-600 ring-2 ring-slate-300"],
    seekTo: (s) => (s.start + s.end) / 2,
  },
};

type Drag =
  | { kind: "create"; anchor: number }
  | {
      kind: "move" | "resize-start" | "resize-end";
      item: RangeSegment;
      grabOffset: number; // ms between the item's start and where it was grabbed
      gap: { start: number; end: number };
      moved: boolean;
      key: string; // coalesce key: the whole drag is one undo step
    };

export function SegmentLane(props: { kind: LaneKind; toMs: (clientX: number) => number; duration: number }) {
  const lane = LANES[props.kind];
  const { store, controller } = useEditorContext();
  const segments = useEditor((s) => s.project.segments);
  const selectedId = useEditor((s) => s.selectedSegmentId);
  const items = useMemo(() => lane.of(segments), [lane, segments]);
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

  const onBlockDown = (event: PointerEvent<HTMLElement>, item: RangeSegment, kind: "move" | "resize-start" | "resize-end") => {
    event.stopPropagation(); // don't start a "create" drag on the lane
    event.currentTarget.setPointerCapture(event.pointerId);
    const gap = lane.overlap
      ? { start: 0, end: props.duration }
      : (freeGap(store.getState().project.segments, props.kind, item.start, props.duration, item.id) ?? {
          start: item.start,
          end: item.end,
        });
    drag.current = {
      kind,
      item,
      grabOffset: props.toMs(event.clientX) - item.start,
      gap,
      moved: false,
      key: `${props.kind}-drag-${item.id}-${event.timeStamp}`,
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
    const { item, gap } = d;
    const length = item.end - item.start;
    let start = item.start;
    let end = item.end;
    if (d.kind === "move") {
      start = Math.min(Math.max(ms - d.grabOffset, gap.start), gap.end - length);
      end = start + length;
    } else if (d.kind === "resize-start") {
      start = Math.min(Math.max(ms, gap.start), item.end - lane.minMs);
    } else {
      end = Math.max(Math.min(ms, gap.end), item.start + lane.minMs);
    }
    editSegments(store, (s) => updateSegment<RangeSegment>(s, item.id, { start, end }), { coalesceKey: d.key });
  };

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (d.kind === "create") {
      setDraft(null);
      const end = props.toMs(event.clientX);
      const before = new Set(store.getState().project.segments.map((s) => s.id));
      editSegments(store, (s, duration) => lane.add(s, d.anchor, end, duration));
      const added = store.getState().project.segments.find((s) => !before.has(s.id));
      if (added) store.setUi({ selectedSegmentId: added.id });
    } else if (!d.moved) {
      // A click: select it and show a representative moment in the preview.
      store.setUi({ selectedSegmentId: d.item.id, range: null });
      controller.pause();
      controller.seekSource(lane.seekTo(d.item));
    }
  };

  return (
    <div
      data-testid={`${props.kind}-lane`}
      className="relative mt-1 h-8 cursor-crosshair rounded-md bg-black/[.04] dark:bg-white/[.05]"
      onPointerDown={onLaneDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {items.length === 0 && !draft && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs opacity-40">
          {lane.hint}
        </span>
      )}
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <div
            key={item.id}
            data-testid={`${props.kind}-block`}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            aria-label={lane.describe(item)}
            className={`group absolute inset-y-1 flex cursor-grab items-center justify-center overflow-hidden rounded-sm text-[10px] font-semibold text-white active:cursor-grabbing ${
              selected ? lane.colors[1] : lane.colors[0]
            }`}
            style={{ left: pct(item.start), width: pct(item.end - item.start) }}
            // Move/up events from the captured block bubble up to the lane's
            // handlers, so the block only needs pointerdown.
            onPointerDown={(e) => onBlockDown(e, item, "move")}
          >
            <span
              data-testid={`${props.kind}-handle-start`}
              className="absolute inset-y-0 left-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/30"
              onPointerDown={(e) => onBlockDown(e, item, "resize-start")}
            />
            <span className="pointer-events-none truncate px-2">{lane.label(item)}</span>
            <span
              data-testid={`${props.kind}-handle-end`}
              className="absolute inset-y-0 right-0 w-2 cursor-ew-resize bg-white/0 group-hover:bg-white/30"
              onPointerDown={(e) => onBlockDown(e, item, "resize-end")}
            />
          </div>
        );
      })}
      {draft && (
        <div
          className="pointer-events-none absolute inset-y-1 rounded-sm bg-black/15 ring-1 ring-black/40 dark:bg-white/20 dark:ring-white/50"
          style={{ left: pct(draft.start), width: pct(draft.end - draft.start) }}
        />
      )}
    </div>
  );
}
