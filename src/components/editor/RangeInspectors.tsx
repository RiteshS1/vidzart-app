"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { editSegments } from "@/lib/editor/actions";
import { removeSegment, SPEED_RATES, updateSegment } from "@/lib/project/segments";
import type { BlurSegment, SpeedSegment } from "@/lib/project/types";
import { useEditor, useEditorContext } from "./EditorContext";
import { button, panelLabel } from "./styles";
import { ZoomInspector } from "./ZoomInspector";

// Side-panel inspectors for the selected speed or blur segment (the zoom
// one lives in ZoomInspector.tsx), and the switch that picks the right one.

function InspectorShell(props: { title: string; id: string; tone: string; children: React.ReactNode }) {
  const { store } = useEditorContext();
  return (
    <section className={`flex flex-col gap-4 rounded-lg border p-3 ${props.tone}`} aria-label={props.title}>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">{props.title}</h2>
        <button
          type="button"
          className={button}
          onClick={() => {
            editSegments(store, (s) => removeSegment(s, props.id));
            store.setUi({ selectedSegmentId: null });
          }}
        >
          Delete
        </button>
      </div>
      {props.children}
    </section>
  );
}

export function SpeedInspector({ speed }: { speed: SpeedSegment }) {
  const { store } = useEditorContext();
  return (
    <InspectorShell title="Speed" id={speed.id} tone="border-sky-600/40 bg-sky-600/[.06]">
      <div className="flex flex-col gap-2">
        <span className={panelLabel}>Play this part at</span>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Speed">
          {SPEED_RATES.map((rate) => (
            <button
              key={rate}
              type="button"
              aria-pressed={speed.rate === rate}
              onClick={() => editSegments(store, (s) => updateSegment<SpeedSegment>(s, speed.id, { rate }))}
              className={`rounded-md px-2 py-1.5 text-xs font-medium ${
                speed.rate === rate ? "bg-foreground text-background" : "bg-black/[.05] hover:bg-black/10 dark:bg-white/[.07] dark:hover:bg-white/15"
              }`}
            >
              {rate}×
            </button>
          ))}
        </div>
        <p className="text-xs opacity-60">
          {(speed.end - speed.start) / 1000 > 0 &&
            `${((speed.end - speed.start) / 1000).toFixed(1)}s becomes ${((speed.end - speed.start) / speed.rate / 1000).toFixed(1)}s. `}
          Audio is muted in sped-up parts.
        </p>
      </div>
    </InspectorShell>
  );
}

export function BlurInspector({ blur }: { blur: BlurSegment }) {
  const { store } = useEditorContext();
  return (
    <InspectorShell title="Blur" id={blur.id} tone="border-slate-500/40 bg-slate-500/[.06]">
      <div className="flex flex-col gap-2">
        <span className={panelLabel}>Area to hide</span>
        <RectPicker
          rect={blur.rect}
          onChange={(rect, done) =>
            editSegments(store, (s) => updateSegment<BlurSegment>(s, blur.id, { rect }), {
              // One undo step per drag, not one per pointer move.
              coalesceKey: done ? undefined : `blur-rect-${blur.id}`,
            })
          }
        />
        <p className="text-xs opacity-60">Drag on the frame to draw the box. It stays put when zooms move the camera.</p>
      </div>
    </InspectorShell>
  );
}

type Rect = BlurSegment["rect"];

/** A live thumbnail of the current frame; drag to draw a rectangle on it. */
function RectPicker({ rect, onChange }: { rect: Rect; onChange: (rect: Rect, done: boolean) => void }) {
  const { video } = useEditorContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const latest = useRef(rect);
  useEffect(() => {
    latest.current = rect;
  });
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = () => {
      const { width, height } = canvas;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ctx.drawImage(video, 0, 0, width, height);
      else ctx.clearRect(0, 0, width, height);
      const r = latest.current;
      ctx.fillStyle = "rgba(100, 116, 139, 0.55)";
      ctx.fillRect(r.x * width, r.y * height, r.width * width, r.height * height);
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(r.x * width, r.y * height, r.width * width, r.height * height);
      ctx.setLineDash([]);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [video]);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  };
  const rectFrom = (a: { x: number; y: number }, b: { x: number; y: number }): Rect => ({
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  });

  const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
  return (
    <canvas
      ref={canvasRef}
      data-testid="blur-rect-picker"
      width={256}
      height={Math.round(256 / aspect)}
      className="w-full cursor-crosshair touch-none rounded-md"
      aria-label="Drag to draw the area to blur"
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        setAnchor(point(event));
      }}
      onPointerMove={(event) => {
        if (!anchor) return;
        const r = rectFrom(anchor, point(event));
        if (r.width > 0.01 && r.height > 0.01) onChange(r, false);
      }}
      onPointerUp={(event) => {
        if (!anchor) return;
        const r = rectFrom(anchor, point(event));
        setAnchor(null);
        // A plain click (no real box) keeps the current rectangle.
        if (r.width > 0.01 && r.height > 0.01) onChange(r, true);
      }}
    />
  );
}

/** The inspector for whichever zoom/speed/blur segment is selected, if any. */
export function SelectedSegmentInspector() {
  const segments = useEditor((s) => s.project.segments);
  const selectedId = useEditor((s) => s.selectedSegmentId);
  const selected = segments.find((s) => s.id === selectedId);
  switch (selected?.type) {
    case "zoom":
      return <ZoomInspector key={selected.id} zoom={selected} />;
    case "speed":
      return <SpeedInspector key={selected.id} speed={selected} />;
    case "blur":
      return <BlurInspector key={selected.id} blur={selected} />;
    default:
      return null; // nothing selected, or a cut (restored from the timeline)
  }
}
