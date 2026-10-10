"use client";

import type { AspectRatio, ProjectSettings } from "@/lib/project/types";
import { BACKGROUND_PRESETS, backgroundToCss } from "@/lib/render/backgrounds";
import { useEditor, useEditorContext } from "./EditorContext";
import { panelLabel } from "./styles";

const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "source", label: "Original" },
];

export function SettingsPanel() {
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.project.settings);

  // Slider drags send many updates; the shared coalesce key makes the whole
  // drag a single undo step.
  const update = (patch: Partial<ProjectSettings>, coalesceKey?: string) =>
    store.edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), { coalesceKey });

  return (
    <aside className="flex w-full flex-col gap-6 overflow-y-auto lg:w-72" aria-label="Look">
      <fieldset className="flex flex-col gap-2">
        <legend className={panelLabel}>Aspect ratio</legend>
        <div className="mt-2 grid grid-cols-5 gap-1">
          {ASPECTS.map((a) => (
            <button
              key={a.value}
              type="button"
              aria-pressed={settings.aspectRatio === a.value}
              onClick={() => update({ aspectRatio: a.value })}
              className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                settings.aspectRatio === a.value
                  ? "bg-foreground text-background"
                  : "bg-black/[.05] hover:bg-black/10 dark:bg-white/[.07] dark:hover:bg-white/15"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={panelLabel}>Background</legend>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {BACKGROUND_PRESETS.map((preset) => {
            const active = JSON.stringify(preset.background) === JSON.stringify(settings.background);
            return (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                aria-label={`Background: ${preset.name}`}
                aria-pressed={active}
                onClick={() => update({ background: preset.background })}
                className={`aspect-square rounded-md ring-offset-2 ring-offset-background ${
                  active ? "ring-2 ring-foreground" : "ring-1 ring-black/10 dark:ring-white/15"
                }`}
                style={{ background: backgroundToCss(preset.background) }}
              />
            );
          })}
        </div>
      </fieldset>

      <Slider
        label="Padding"
        value={settings.padding}
        min={0}
        max={0.3}
        onChange={(padding) => update({ padding }, "padding")}
      />
      <Slider
        label="Corner radius"
        value={settings.cornerRadius}
        min={0}
        max={0.08}
        onChange={(cornerRadius) => update({ cornerRadius }, "cornerRadius")}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className={panelLabel}>Shadow</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.shadow.enabled}
            onChange={(e) => update({ shadow: { ...settings.shadow, enabled: e.target.checked } })}
          />
          Drop shadow
        </label>
        {settings.shadow.enabled && (
          <Slider
            label="Shadow strength"
            value={settings.shadow.opacity}
            min={0}
            max={1}
            onChange={(opacity) => update({ shadow: { ...settings.shadow, opacity } }, "shadowOpacity")}
          />
        )}
      </fieldset>
    </aside>
  );
}

function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between">
        <span className={panelLabel}>{props.label}</span>
        <span className="font-mono text-xs opacity-60">
          {Math.round(((props.value - props.min) / (props.max - props.min)) * 100)}%
        </span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={(props.max - props.min) / 100}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="accent-foreground"
      />
    </label>
  );
}
