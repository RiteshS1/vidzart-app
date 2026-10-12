"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import { addTextAt, editSegments } from "@/lib/editor/actions";
import { TEXT_PRESETS, updateSegment } from "@/lib/project/segments";
import type { TextAnimation, TextSegment, TextStyle } from "@/lib/project/types";
import { useEditorContext } from "./EditorContext";
import { panelLabel, segment } from "./styles";

// The Text tool (presets to add) and the inspector for a selected text.

/** CSS stacks used for the previews in the panel. The exporter maps the same four names to its own fonts. */
const PREVIEW_FONT: Record<TextStyle["font"], string> = {
  sans: "system-ui, sans-serif",
  serif: "Georgia, serif",
  mono: "ui-monospace, Menlo, monospace",
  rounded: "ui-rounded, system-ui, sans-serif",
};

/** The "Text" tool: one-click presets that add a title, subtitle, callout… at the playhead. */
export function TextPanel() {
  const { store, controller } = useEditorContext();
  return (
    <div className="flex flex-col gap-3">
      <h3 className={panelLabel}>Add text</h3>
      <p className="text-xs text-ink-muted">Adds a text at the playhead. Drag it on the preview to move it.</p>
      <div className="grid grid-cols-2 gap-2">
        {TEXT_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            aria-label={`Add ${preset.name}`}
            onClick={() => addTextAt(store, controller.getSourceTime(), preset.segment)}
            className="flex h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-line bg-surface-2 px-2 transition-colors duration-150 hover:border-line-strong hover:bg-surface-3"
          >
            <span
              className="max-w-full truncate rounded px-1.5"
              style={{
                fontFamily: PREVIEW_FONT[preset.segment.style.font],
                fontWeight: preset.segment.style.weight,
                fontSize: Math.min(20, 8 + preset.segment.style.size * 120),
                color: preset.segment.style.background ? preset.segment.style.color : "var(--ink)",
                background: preset.segment.style.background,
              }}
            >
              Aa
            </span>
            <span className="text-[11px] text-ink-muted">{preset.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const FONTS: { value: TextStyle["font"]; label: string }[] = [
  { value: "sans", label: "Sans" },
  { value: "serif", label: "Serif" },
  { value: "mono", label: "Mono" },
  { value: "rounded", label: "Round" },
];
const WEIGHTS: { value: TextStyle["weight"]; label: string }[] = [
  { value: 400, label: "Regular" },
  { value: 600, label: "Semi" },
  { value: 800, label: "Bold" },
];
const ANIMATIONS: { value: TextAnimation; label: string }[] = [
  { value: "none", label: "None" },
  { value: "fade", label: "Fade" },
  { value: "slide-up", label: "Slide up" },
  { value: "pop", label: "Pop" },
  { value: "typewriter", label: "Typewriter" },
];
const COLORS = ["#ffffff", "#111118", "#ffb224", "#ef4444", "#38bdf8", "#4ade80"];

/** Settings for a selected text: content, font, size, color, box, alignment, position, animations. */
export function TextInspector({ text }: { text: TextSegment }) {
  const { store } = useEditorContext();
  const update = (patch: Partial<Omit<TextSegment, "id" | "type">>, coalesceKey?: string) =>
    editSegments(store, (s) => updateSegment<TextSegment>(s, text.id, patch), {
      coalesceKey: coalesceKey && `${coalesceKey}-${text.id}`,
    });
  const style = (patch: Partial<TextStyle>, coalesceKey?: string) => update({ style: { ...text.style, ...patch } }, coalesceKey);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5">
        <span className={panelLabel}>Text</span>
        <textarea
          value={text.text}
          rows={Math.min(5, text.text.split("\n").length + 1)}
          onChange={(e) => update({ text: e.target.value }, "text")}
          className="resize-none rounded-lg border border-line bg-surface-2 px-2.5 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={panelLabel}>Font</span>
        <div className="grid grid-cols-4 gap-1" role="group" aria-label="Font">
          {FONTS.map((f) => (
            <button
              key={f.value}
              type="button"
              aria-pressed={text.style.font === f.value}
              onClick={() => style({ font: f.value })}
              className={segment(text.style.font === f.value)}
              style={{ fontFamily: PREVIEW_FONT[f.value] }}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Weight">
          {WEIGHTS.map((w) => (
            <button
              key={w.value}
              type="button"
              aria-pressed={text.style.weight === w.value}
              onClick={() => style({ weight: w.value })}
              className={segment(text.style.weight === w.value)}
              style={{ fontWeight: w.value }}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      <Range label="Text size" value={text.style.size} min={0.02} max={0.16} step={0.002} display={`${Math.round(text.style.size * 1000) / 10}%`} onChange={(size) => style({ size }, "size")} />

      <div className="flex flex-col gap-1.5">
        <span className={panelLabel}>Color</span>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Text color">
          {COLORS.map((c) => (
            <Swatch key={c} color={c} active={text.style.color === c} label={`Text color ${c}`} onClick={() => style({ color: c })} />
          ))}
          <input
            type="color"
            aria-label="Custom text color"
            value={toHex(text.style.color)}
            onChange={(e) => style({ color: e.target.value }, "color")}
            className="size-7 cursor-pointer rounded-full border border-line bg-transparent"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={Boolean(text.style.background)}
            onChange={(e) => {
              const next = { ...text.style };
              if (e.target.checked) next.background = text.style.color === "#ffffff" ? "#111118" : "#ffffff";
              else delete next.background;
              update({ style: next });
            }}
          />
          Background box
        </label>
        {text.style.background && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Background color">
            {COLORS.map((c) => (
              <Swatch key={c} color={c} active={text.style.background === c} label={`Background ${c}`} onClick={() => style({ background: c })} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={panelLabel}>Align</span>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Align">
          {(
            [
              ["left", AlignLeft],
              ["center", AlignCenter],
              ["right", AlignRight],
            ] as const
          ).map(([value, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={text.style.align === value}
              aria-label={`Align ${value}`}
              onClick={() => style({ align: value })}
              className={`${segment(text.style.align === value)} flex justify-center`}
            >
              <Icon className="size-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {/* Position sliders: the keyboard/touch alternative to dragging the text on the preview. */}
      <div className="grid grid-cols-2 gap-3">
        <Range label="Left ↔ right" value={text.x} min={0} max={1} step={0.005} display={`${Math.round(text.x * 100)}%`} onChange={(x) => update({ x }, "pos")} />
        <Range label="Top ↕ bottom" value={text.y} min={0} max={1} step={0.005} display={`${Math.round(text.y * 100)}%`} onChange={(y) => update({ y }, "pos")} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["in", "out"] as const).map((which) => (
          <label key={which} className="flex flex-col gap-1.5">
            <span className={panelLabel}>Animation {which}</span>
            <select
              value={text.animation[which]}
              onChange={(e) => update({ animation: { ...text.animation, [which]: e.target.value as TextAnimation } })}
              className="h-8 rounded-lg border border-line bg-surface-2 px-2 text-sm"
            >
              {ANIMATIONS.filter((a) => which === "in" || a.value !== "typewriter").map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

/** A round color chip; `active` draws the accent ring. */
function Swatch(props: { color: string; active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={props.label}
      aria-pressed={props.active}
      onClick={props.onClick}
      className={`size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-surface ${props.active ? "ring-2 ring-accent" : "ring-1 ring-line-strong"}`}
      style={{ background: props.color }}
    />
  );
}

function Range(props: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between">
        <span className={panelLabel}>{props.label}</span>
        <span className="font-mono text-xs text-ink-muted">{props.display}</span>
      </span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}

/** <input type=color> only accepts #rrggbb. */
function toHex(color: string): string {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : "#ffffff";
}
