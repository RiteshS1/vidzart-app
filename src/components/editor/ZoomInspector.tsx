"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import { editSegments } from "@/lib/editor/actions";
import { cameraViewport, clampCenter } from "@/lib/effects/camera";
import { removeSegment, updateSegment } from "@/lib/project/segments";
import type { ZoomSegment } from "@/lib/project/types";
import { useEditorContext } from "./EditorContext";
import { button, panelLabel } from "./styles";

export function ZoomInspector({ zoom }: { zoom: ZoomSegment }) {
  const { store, cursorAt } = useEditorContext();

  const update = (patch: Partial<Omit<ZoomSegment, "id" | "type">>, coalesceKey?: string) =>
    editSegments(store, (s) => updateSegment<ZoomSegment>(s, zoom.id, patch), {
      coalesceKey: coalesceKey && `${coalesceKey}-${zoom.id}`,
    });

  return (
    <section
      className="flex flex-col gap-4 rounded-lg border border-violet-500/40 bg-violet-500/[.06] p-3"
      aria-label="Zoom"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">
          Zoom {zoom.origin === "auto" && <span className="font-normal opacity-60">(auto)</span>}
        </h2>
        <button
          type="button"
          className={button}
          onClick={() => {
            editSegments(store, (s) => removeSegment(s, zoom.id));
            store.setUi({ selectedSegmentId: null });
          }}
        >
          Delete
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <span className={panelLabel}>Target</span>
        <div className="grid grid-cols-2 gap-1">
          {(["fixed", "follow"] as const).map((mode) => {
            const active = zoom.target.mode === mode;
            const disabled = mode === "follow" && !cursorAt;
            return (
              <button
                key={mode}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                title={disabled ? "Needs a cursor log (record with the Vidzart extension)" : undefined}
                onClick={() =>
                  update({
                    target:
                      mode === "follow"
                        ? { mode: "follow" }
                        : { mode: "fixed", x: 0.5, y: 0.5 },
                  })
                }
                className={`rounded-md px-2 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
                  active ? "bg-foreground text-background" : "bg-black/[.05] hover:bg-black/10 dark:bg-white/[.07] dark:hover:bg-white/15"
                }`}
              >
                {mode === "fixed" ? "Point" : "Follow cursor"}
              </button>
            );
          })}
        </div>
        {zoom.target.mode === "fixed" && (
          <TargetPicker
            scale={zoom.scale}
            target={zoom.target}
            onPick={(x, y) => update({ target: { mode: "fixed", x, y } }, "target")}
          />
        )}
      </div>

      <InspectorSlider
        label="Zoom"
        display={`${zoom.scale.toFixed(1)}×`}
        min={1.1}
        max={4}
        step={0.1}
        value={zoom.scale}
        onChange={(scale) => update({ scale }, "scale")}
      />
      <InspectorSlider
        label="Ease in"
        display={`${(zoom.easeInMs / 1000).toFixed(1)}s`}
        min={0}
        max={2000}
        step={50}
        value={zoom.easeInMs}
        onChange={(easeInMs) => update({ easeInMs }, "easeIn")}
      />
      <InspectorSlider
        label="Ease out"
        display={`${(zoom.easeOutMs / 1000).toFixed(1)}s`}
        min={0}
        max={2000}
        step={50}
        value={zoom.easeOutMs}
        onChange={(easeOutMs) => update({ easeOutMs }, "easeOut")}
      />
    </section>
  );
}

/**
 * A small live thumbnail of the current frame. Click to set where the zoom
 * points; the outline shows exactly what will be visible at full zoom.
 */
function TargetPicker(props: { scale: number; target: { x: number; y: number }; onPick: (x: number, y: number) => void }) {
  const { video } = useEditorContext();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Read the latest props inside the rAF loop without restarting it.
  const latest = useRef(props);
  useEffect(() => {
    latest.current = props;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let frame = 0;
    const draw = () => {
      const { width, height } = canvas;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) ctx.drawImage(video, 0, 0, width, height);
      else ctx.clearRect(0, 0, width, height);
      const { scale, target } = latest.current;
      const view = cameraViewport({ scale, center: clampCenter(target, scale) });
      // Dim everything outside the visible region.
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.beginPath();
      ctx.rect(0, 0, width, height);
      ctx.rect(view.x * width, view.y * height, view.width * width, view.height * height);
      ctx.fill("evenodd");
      ctx.strokeStyle = "#a78bfa";
      ctx.lineWidth = 2;
      ctx.strokeRect(view.x * width, view.y * height, view.width * width, view.height * height);
      // Crosshair at the chosen point.
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(target.x * width, target.y * height, 4, 0, Math.PI * 2);
      ctx.fill();
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [video]);

  const onClick = (event: MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    props.onPick(
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    );
  };

  const aspect = video.videoWidth && video.videoHeight ? video.videoWidth / video.videoHeight : 16 / 9;
  return (
    <canvas
      ref={canvasRef}
      data-testid="zoom-target-picker"
      width={256}
      height={Math.round(256 / aspect)}
      onClick={onClick}
      className="w-full cursor-crosshair rounded-md"
      aria-label="Click to choose where the zoom points"
    />
  );
}

function InspectorSlider(props: {
  label: string;
  display: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between">
        <span className={panelLabel}>{props.label}</span>
        <span className="font-mono text-xs opacity-60">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="accent-violet-500"
      />
    </label>
  );
}
