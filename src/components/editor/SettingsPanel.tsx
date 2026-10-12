"use client";

import { useState } from "react";
import type { AspectRatio, Background, ProjectSettings } from "@/lib/project/types";
import { BACKGROUND_GENRES, backgroundToCss, genreOf, sameBackground } from "@/lib/render/backgrounds";
import { ColorPicker } from "./ColorPicker";
import { useEditor, useEditorContext } from "./EditorContext";
import { panelLabel, segment } from "./styles";

// The "Style" tool (aspect ratio, background, padding, corners, shadow) and the
// "Cursor" tool (cursor look, click effect). Everything edits `project.settings`,
// which both the preview and the exporter read through renderFrame.

/** Output canvas shapes; "Original" keeps the recording's own ratio. */
const ASPECTS: { value: AspectRatio; label: string }[] = [
  { value: "16:9", label: "16:9" },
  { value: "9:16", label: "9:16" },
  { value: "1:1", label: "1:1" },
  { value: "4:3", label: "4:3" },
  { value: "source", label: "Original" },
];

const CLICK_EFFECTS: { value: ProjectSettings["clickEffect"]["type"]; label: string }[] = [
  { value: "none", label: "None" },
  { value: "ripple", label: "Ripple" },
  { value: "pulse", label: "Pulse" },
];
const EFFECT_COLORS = ["#ffffff", "#111111", "#ffb224", "#38bdf8"];
/** "Hide when idle" fades the cursor after this long without moving. */
const IDLE_HIDE_MS = 2000;

export function SettingsPanel() {
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.project.settings);

  // Slider drags send many updates; the shared coalesce key makes the whole
  // drag a single undo step.
  const update = (patch: Partial<ProjectSettings>, coalesceKey?: string) =>
    store.edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), { coalesceKey });

  return (
    <aside className="flex w-full flex-col gap-6" aria-label="Look">
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

      <BackgroundPicker settings={settings} update={update} />

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

/** Genres of built-in backgrounds, plus a custom solid color or gradient (with a color picker). */
function BackgroundPicker({
  settings,
  update,
}: {
  settings: ProjectSettings;
  update: (patch: Partial<ProjectSettings>, coalesceKey?: string) => void;
}) {
  const current = settings.background;
  // Which genre tab is showing is UI-only (not saved); start on the one that
  // contains the current background so it is visible and highlighted.
  const [genreId, setGenreId] = useState<string>(() => genreOf(current)?.id ?? (current.type === "image" ? "studio" : "custom"));
  const [stop, setStop] = useState<"from" | "to">("from");
  const genre = BACKGROUND_GENRES.find((g) => g.id === genreId);

  // The color picker edits a gradient; when the current background is a flat
  // colour (or an image) start from a sensible gradient built from it.
  const asGradient = (): Extract<Background, { type: "gradient" }> =>
    current.type === "gradient"
      ? current
      : { type: "gradient", from: current.type === "color" ? current.color : "#26262b", to: "#6dd5ed", angle: 135 };

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className={panelLabel}>Background</legend>
      <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Background genre">
        {[...BACKGROUND_GENRES.map((g) => ({ id: g.id, label: g.label })), { id: "custom", label: "Custom" }].map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={genreId === g.id}
            onClick={() => setGenreId(g.id)}
            className={segment(genreId === g.id)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {genre && (
        <div className="grid grid-cols-4 gap-2">
          {genre.presets.map((preset) => {
            const active = sameBackground(preset.background, current);
            return (
              <button
                key={preset.name}
                type="button"
                title={preset.name}
                aria-label={`Background: ${preset.name}`}
                aria-pressed={active}
                onClick={() => update({ background: preset.background })}
                className={`aspect-square cursor-pointer rounded-lg ring-offset-2 ring-offset-surface transition-transform duration-150 hover:scale-105 ${
                  active ? "ring-2 ring-ink" : "ring-1 ring-line-strong"
                }`}
                style={{ background: backgroundToCss(preset.background) }}
              />
            );
          })}
        </div>
      )}

      {genreId === "custom" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Custom background type">
            <button
              type="button"
              aria-pressed={current.type === "color"}
              className={segment(current.type === "color")}
              onClick={() => update({ background: { type: "color", color: current.type === "gradient" ? current.from : current.type === "color" ? current.color : "#26262b" } })}
            >
              Solid color
            </button>
            <button
              type="button"
              aria-pressed={current.type === "gradient"}
              className={segment(current.type === "gradient")}
              onClick={() => update({ background: asGradient() })}
            >
              Gradient
            </button>
          </div>

          {current.type === "color" && (
            <ColorPicker
              label="Background color"
              value={current.color}
              onChange={(color) => update({ background: { type: "color", color } }, "bgColor")}
            />
          )}

          {current.type === "gradient" && (
            <>
              <div className="grid grid-cols-3 gap-1" role="group" aria-label="Gradient color">
                <button type="button" aria-pressed={stop === "from"} className={segment(stop === "from")} onClick={() => setStop("from")}>
                  From
                </button>
                <button type="button" aria-pressed={stop === "to"} className={segment(stop === "to")} onClick={() => setStop("to")}>
                  To
                </button>
                <button
                  type="button"
                  className={segment(false)}
                  onClick={() => update({ background: { ...current, from: current.to, to: current.from } })}
                >
                  Swap
                </button>
              </div>
              <ColorPicker
                label={`Gradient ${stop} color`}
                value={stop === "from" ? current.from : current.to}
                onChange={(hex) => update({ background: { ...current, [stop]: hex } }, `bgGradient-${stop}`)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="flex justify-between">
                  <span className={panelLabel}>Angle</span>
                  <span className="font-mono text-xs text-ink-muted">{current.angle}°</span>
                </span>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={current.angle}
                  onChange={(e) => update({ background: { ...current, angle: Number(e.target.value) } }, "bgAngle")}
                />
              </label>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

/** The "Cursor" tool: only recordings with an event log have a cursor to draw. */
export function CursorPanel() {
  const { store } = useEditorContext();
  const settings = useEditor((s) => s.project.settings);
  const update = (patch: Partial<ProjectSettings>, coalesceKey?: string) =>
    store.edit((p) => ({ ...p, settings: { ...p.settings, ...patch } }), { coalesceKey });
  return (
    <div className="flex flex-col gap-6">
      <CursorSettings settings={settings} update={update} />
    </div>
  );
}

/** Cursor visibility/size/smoothing, idle hiding, and the click effect (ripple/pulse + colour). */
function CursorSettings({
  settings,
  update,
}: {
  settings: ProjectSettings;
  update: (patch: Partial<ProjectSettings>, coalesceKey?: string) => void;
}) {
  const { cursor, clickEffect } = settings;
  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className={panelLabel}>Cursor</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={cursor.visible}
            onChange={(e) => update({ cursor: { ...cursor, visible: e.target.checked } })}
          />
          Show cursor
        </label>
        {cursor.visible && (
          <>
            <Slider
              label="Cursor size"
              value={cursor.scale}
              min={0.5}
              max={3}
              format={(v) => `${v.toFixed(1)}×`}
              onChange={(scale) => update({ cursor: { ...cursor, scale } }, "cursorScale")}
            />
            <Slider
              label="Smoothing"
              value={cursor.smoothing}
              min={0}
              max={1}
              onChange={(smoothing) => update({ cursor: { ...cursor, smoothing } }, "cursorSmoothing")}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={cursor.hideWhenIdleMs !== undefined}
                onChange={(e) => {
                  // Omit the field instead of setting it undefined: it's
                  // optional in the spec, and JSON drops undefined anyway.
                  const rest = { ...cursor };
                  delete rest.hideWhenIdleMs;
                  update({ cursor: e.target.checked ? { ...rest, hideWhenIdleMs: IDLE_HIDE_MS } : rest });
                }}
              />
              Hide when not moving
            </label>
          </>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={panelLabel}>Keyboard shortcuts</legend>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={settings.keystrokes?.visible ?? false}
            onChange={(e) =>
              update({ keystrokes: { position: settings.keystrokes?.position ?? "bottom", visible: e.target.checked } })
            }
          />
          Show shortcuts you pressed (⌘K…)
        </label>
        {settings.keystrokes?.visible && (
          <div className="grid grid-cols-2 gap-1" role="group" aria-label="Shortcut badge position">
            {(["top", "bottom"] as const).map((position) => (
              <button
                key={position}
                type="button"
                aria-pressed={settings.keystrokes?.position === position}
                onClick={() => update({ keystrokes: { visible: true, position } })}
                className={`${segment(settings.keystrokes?.position === position)} capitalize`}
              >
                {position}
              </button>
            ))}
          </div>
        )}
        <p className="text-xs text-ink-muted">Only shortcuts with ⌘, Ctrl or Alt are ever recorded, never typed text.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className={panelLabel}>Click effect</legend>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {CLICK_EFFECTS.map((effect) => (
            <button
              key={effect.value}
              type="button"
              aria-pressed={clickEffect.type === effect.value}
              onClick={() => update({ clickEffect: { ...clickEffect, type: effect.value } })}
              className={`rounded-md px-1 py-1.5 text-xs font-medium transition-colors ${
                clickEffect.type === effect.value
                  ? "bg-foreground text-background"
                  : "bg-black/[.05] hover:bg-black/10 dark:bg-white/[.07] dark:hover:bg-white/15"
              }`}
            >
              {effect.label}
            </button>
          ))}
        </div>
        {clickEffect.type !== "none" && (
          <div className="flex gap-2" role="group" aria-label="Click effect color">
            {EFFECT_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                aria-label={`Click color ${color}`}
                aria-pressed={clickEffect.color === color}
                onClick={() => update({ clickEffect: { ...clickEffect, color } })}
                className={`size-6 rounded-full ring-offset-2 ring-offset-background ${
                  clickEffect.color === color ? "ring-2 ring-foreground" : "ring-1 ring-black/15 dark:ring-white/20"
                }`}
                style={{ background: color }}
              />
            ))}
          </div>
        )}
      </fieldset>
    </>
  );
}

/** A labelled slider; shows a percentage of its range unless `format` says otherwise. */
function Slider(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  /** Shown next to the label; defaults to a percentage of the range. */
  format?: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="flex justify-between">
        <span className={panelLabel}>{props.label}</span>
        <span className="font-mono text-xs opacity-60">
          {props.format
            ? props.format(props.value)
            : `${Math.round(((props.value - props.min) / (props.max - props.min)) * 100)}%`}
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
