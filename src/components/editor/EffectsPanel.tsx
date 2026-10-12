"use client";

import type { FilterPreset, ProjectSettings, TransitionType } from "@/lib/project/types";
import { filterCss } from "@/lib/render/effects";
import { useEditor, useEditorContext } from "./EditorContext";
import { panelLabel, segment } from "./styles";

// The "Effects" tool: color looks, fades at the ends, transitions at cuts.

/** Color looks. Their actual math lives in lib/render/effects (shared with export). */
const FILTERS: { value: FilterPreset; label: string }[] = [
  { value: "none", label: "Original" },
  { value: "vivid", label: "Vivid" },
  { value: "warm", label: "Warm" },
  { value: "cool", label: "Cool" },
  { value: "mono", label: "Mono" },
  { value: "cinematic", label: "Cinematic" },
];

/** Transitions are drawn at every place footage was cut out (trim seams). */
const TRANSITIONS: { value: TransitionType; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "Hard cut" },
  { value: "dip-to-black", label: "Dip", hint: "Dips to black at each cut" },
  { value: "blur", label: "Blur", hint: "Blurs through each cut" },
  { value: "zoom-punch", label: "Punch", hint: "A quick push-in that hides the jump" },
];

/** A colorful sample "frame" so each look tile previews its filter without a video. */
const SAMPLE = "linear-gradient(135deg, #f97316 0%, #facc15 30%, #22c55e 55%, #3b82f6 80%, #a855f7 100%)";

export function EffectsPanel() {
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.project.settings);
  const hasCuts = useEditor((s) => s.project.segments.some((x) => x.type === "trim"));
  const update = (patch: Partial<ProjectSettings>, coalesceKey?: string) =>
    store.edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), { coalesceKey });

  // These settings are optional in the project file (absent = off), so give
  // them defaults for the controls without writing anything until changed.
  const filter = settings.filter ?? { preset: "none" as const, intensity: 0.7 };
  const fade = settings.fade ?? { inMs: 0, outMs: 0 };
  const transition = settings.transition ?? { type: "none" as const, durationMs: 500 };

  return (
    <div className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className={panelLabel}>Color look</legend>
        <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Filter">
          {FILTERS.map((f) => {
            const active = filter.preset === f.value;
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => update({ filter: { ...filter, preset: f.value } })}
                className={`flex cursor-pointer flex-col gap-1 rounded-lg p-1 text-[11px] font-medium transition-colors duration-150 ${
                  active ? "bg-surface-3 text-ink ring-2 ring-accent" : "text-ink-muted hover:bg-surface-2"
                }`}
              >
                <span
                  className="h-10 w-full rounded-md"
                  style={{ background: SAMPLE, filter: filterCss({ preset: f.value, intensity: filter.intensity || 0.7 }) }}
                  aria-hidden
                />
                {f.label}
              </button>
            );
          })}
        </div>
        {filter.preset !== "none" && (
          <Range
            label="Strength"
            value={filter.intensity}
            min={0}
            max={1}
            step={0.01}
            display={`${Math.round(filter.intensity * 100)}%`}
            onChange={(intensity) => update({ filter: { ...filter, intensity } }, "filterIntensity")}
          />
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className={panelLabel}>Fade</legend>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <Range label="Fade in" value={fade.inMs} min={0} max={2000} step={50} display={`${(fade.inMs / 1000).toFixed(1)}s`} onChange={(inMs) => update({ fade: { ...fade, inMs } }, "fadeIn")} />
          <Range label="Fade out" value={fade.outMs} min={0} max={2000} step={50} display={`${(fade.outMs / 1000).toFixed(1)}s`} onChange={(outMs) => update({ fade: { ...fade, outMs } }, "fadeOut")} />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={panelLabel}>Transition at cuts</legend>
        <div className="mt-2 grid grid-cols-4 gap-1" role="group" aria-label="Transition">
          {TRANSITIONS.map((t) => (
            <button
              key={t.value}
              type="button"
              title={t.hint}
              aria-pressed={transition.type === t.value}
              onClick={() => update({ transition: { ...transition, type: t.value } })}
              className={segment(transition.type === t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
        {transition.type !== "none" && (
          <Range
            label="Duration"
            value={transition.durationMs}
            min={200}
            max={1500}
            step={50}
            display={`${(transition.durationMs / 1000).toFixed(2)}s`}
            onChange={(durationMs) => update({ transition: { ...transition, durationMs } }, "transitionMs")}
          />
        )}
        {!hasCuts && <p className="text-xs text-ink-muted">Applies where you cut footage; there are no cuts yet.</p>}
      </fieldset>
    </div>
  );
}

/** A labelled slider with its current value shown on the right. */
function Range(props: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between">
        <span className="text-xs text-ink-muted">{props.label}</span>
        <span className="font-mono text-xs text-ink-muted">{props.display}</span>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  );
}
