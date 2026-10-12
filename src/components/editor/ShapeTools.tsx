"use client";

import { ArrowUpRight, Circle, Focus, Square } from "lucide-react";
import { DEFAULT_TEXT_MS, SHAPE_KINDS, addShape, updateSegment } from "@/lib/project/segments";
import { editSegments } from "@/lib/editor/actions";
import type { ShapeSegment } from "@/lib/project/types";
import { useEditorContext } from "./EditorContext";
import { RectPicker } from "./RangeInspectors";
import { panelLabel, segment } from "./styles";

// The Shapes tool (arrow, box, circle, spotlight) and its inspector.

const ICONS: Record<ShapeSegment["kind"], typeof Square> = {
  arrow: ArrowUpRight,
  rect: Square,
  ellipse: Circle,
  spotlight: Focus,
};
const COLORS = ["#ffb224", "#ef4444", "#38bdf8", "#4ade80", "#ffffff", "#111118"];

export function ShapePanel() {
  const { store, controller } = useEditorContext();
  const add = (kind: ShapeSegment["kind"]) => {
    const before = new Set(store.getState().project.segments.map((s) => s.id));
    editSegments(store, (segments, duration) => {
      const start = Math.max(0, Math.min(controller.getSourceTime(), duration - DEFAULT_TEXT_MS));
      return addShape(segments, start, start + DEFAULT_TEXT_MS, duration, kind);
    });
    const added = store.getState().project.segments.find((s) => !before.has(s.id));
    if (added) store.setUi({ selectedSegmentId: added.id, range: null });
  };
  return (
    <div className="flex flex-col gap-3">
      <h3 className={panelLabel}>Shapes & highlights</h3>
      <p className="text-xs text-ink-muted">
        Point at things in the recording. Shapes stick to the content, so they move along with zooms.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {SHAPE_KINDS.map(({ kind, label }) => {
          const Icon = ICONS[kind];
          return (
            <button
              key={kind}
              type="button"
              aria-label={`Add ${label}`}
              onClick={() => add(kind)}
              className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-surface-2 transition-colors duration-150 hover:border-line-strong hover:bg-surface-3"
            >
              <Icon className="size-6 text-accent" aria-hidden />
              <span className="text-[11px] text-ink-muted">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ShapeInspector({ shape }: { shape: ShapeSegment }) {
  const { store } = useEditorContext();
  const update = (patch: Partial<Omit<ShapeSegment, "id" | "type">>, coalesceKey?: string) =>
    editSegments(store, (s) => updateSegment<ShapeSegment>(s, shape.id, patch), {
      coalesceKey: coalesceKey && `${coalesceKey}-${shape.id}`,
    });
  const isSpotlight = shape.kind === "spotlight";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Shape">
        {SHAPE_KINDS.map(({ kind, label }) => (
          <button
            key={kind}
            type="button"
            aria-pressed={shape.kind === kind}
            onClick={() => {
              // Switching between arrow and box shapes: arrows need a
              // direction, boxes a positive size.
              const r = shape.rect;
              const rect =
                kind === "arrow" || shape.kind !== "arrow"
                  ? r
                  : { x: Math.min(r.x, r.x + r.width), y: Math.min(r.y, r.y + r.height), width: Math.abs(r.width), height: Math.abs(r.height) };
              update({ kind, rect, style: kind === "spotlight" ? { ...shape.style, color: "#000000" } : shape.style.color === "#000000" ? { ...shape.style, color: "#facc15" } : shape.style });
            }}
            className={segment(shape.kind === kind)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={panelLabel}>{shape.kind === "arrow" ? "Draw the arrow (tail → tip)" : isSpotlight ? "Area to keep bright" : "Area"}</span>
        <RectPicker
          rect={shape.rect}
          mode={shape.kind === "arrow" ? "arrow" : "box"}
          testId="shape-rect-picker"
          label={shape.kind === "arrow" ? "Drag from the arrow's tail to its tip" : "Drag to draw the shape's area"}
          onChange={(rect, done) => update({ rect }, done ? undefined : "rect")}
        />
      </div>

      {!isSpotlight && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className={panelLabel}>Color</span>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Shape color">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Shape color ${c}`}
                  aria-pressed={shape.style.color === c}
                  onClick={() => update({ style: { ...shape.style, color: c } })}
                  className={`size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-surface ${shape.style.color === c ? "ring-2 ring-accent" : "ring-1 ring-line-strong"}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="flex justify-between">
              <span className={panelLabel}>Line width</span>
              <span className="font-mono text-xs text-ink-muted">{(shape.style.stroke * 1000).toFixed(0)}</span>
            </span>
            <input
              type="range"
              min={0.003}
              max={0.02}
              step={0.001}
              value={shape.style.stroke}
              onChange={(e) => update({ style: { ...shape.style, stroke: Number(e.target.value) } }, "stroke")}
            />
          </label>
        </>
      )}
    </div>
  );
}
