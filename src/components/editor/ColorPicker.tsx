"use client";

import { Pipette } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { hexToHsv, hsvToHex, parseHex, type Hsv } from "@/lib/color";

// A Canva-style color picker: a saturation/brightness square, a hue slider,
// a hex field, an eyedropper (where the browser has one) and recent colors.
// Fully keyboard-operable: arrows move the square's handle; the hex field and
// the hue range are native inputs.

const RECENT_KEY = "vidzart.recentColors";
const MAX_RECENT = 8;

function loadRecent(): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((c): c is string => typeof c === "string" && !!parseHex(c)).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

function rememberColor(hex: string): string[] {
  const next = [hex, ...loadRecent().filter((c) => c !== hex)].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable: recents just won't persist
  }
  return next;
}

interface EyeDropperLike {
  open(): Promise<{ sRGBHex: string }>;
}

export function ColorPicker(props: { value: string; onChange: (hex: string) => void; label?: string }) {
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(props.value));
  const [hexText, setHexText] = useState(props.value);
  // The editor is client-only (ssr: false), so reading localStorage here is safe.
  const [recent, setRecent] = useState<string[]>(loadRecent);
  const square = useRef<HTMLDivElement>(null);
  const lastEmitted = useRef(props.value.toLowerCase());

  // External changes (picking a preset elsewhere) update the picker; our own
  // emissions don't, so a gray's hue isn't lost to HSV → hex → HSV rounding.
  useEffect(() => {
    if (props.value.toLowerCase() === lastEmitted.current) return;
    lastEmitted.current = props.value.toLowerCase();
    setHsv(hexToHsv(props.value));
    setHexText(props.value);
  }, [props.value]);

  const emit = (next: Hsv, commit = false) => {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexText(hex);
    lastEmitted.current = hex;
    props.onChange(hex);
    if (commit) setRecent(rememberColor(hex));
  };

  const fromPointer = (event: PointerEvent<HTMLDivElement>): Hsv => {
    const rect = square.current!.getBoundingClientRect();
    const s = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const v = 1 - Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    return { ...hsv, s, v };
  };

  const onKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    emit({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + move[0])), v: Math.min(1, Math.max(0, hsv.v + move[1])) }, true);
  };

  const EyeDropper = typeof window !== "undefined" ? (window as unknown as { EyeDropper?: new () => EyeDropperLike }).EyeDropper : undefined;

  return (
    <div className="flex flex-col gap-3" role="group" aria-label={props.label ?? "Color picker"}>
      <div
        ref={square}
        role="application"
        aria-label="Saturation and brightness. Use the arrow keys."
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          emit(fromPointer(e));
        }}
        onPointerMove={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) emit(fromPointer(e));
        }}
        onPointerUp={(e) => emit(fromPointer(e), true)}
        className="relative h-36 w-full cursor-crosshair touch-none rounded-lg"
        style={{
          background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, hsl(${hsv.h} 100% 50%))`,
        }}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.5)]"
          style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hsvToHex(hsv) }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(hsv.h)}
        aria-label="Hue"
        onChange={(e) => emit({ ...hsv, h: Number(e.target.value) })}
        onPointerUp={() => emit(hsv, true)}
        className="hue-slider w-full"
      />

      <div className="flex items-center gap-2">
        <span className="size-8 shrink-0 rounded-md border border-line-strong" style={{ background: hsvToHex(hsv) }} aria-hidden />
        <input
          value={hexText}
          aria-label="Hex color"
          spellCheck={false}
          onChange={(e) => {
            setHexText(e.target.value);
            const rgb = parseHex(e.target.value);
            if (rgb) emit(hexToHsv(e.target.value));
          }}
          onBlur={() => {
            if (parseHex(hexText)) emit(hexToHsv(hexText), true);
            else setHexText(hsvToHex(hsv)); // not a color: put back the real one
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-line-strong bg-surface-2 px-2 font-mono text-sm uppercase focus:border-accent focus:outline-none"
        />
        {EyeDropper && (
          <button
            type="button"
            aria-label="Pick a color from the screen"
            title="Pick a color from the screen"
            className="flex size-8 cursor-pointer items-center justify-center rounded-lg border border-line bg-surface-2 hover:bg-surface-3"
            onClick={async () => {
              try {
                const { sRGBHex } = await new EyeDropper().open();
                emit(hexToHsv(sRGBHex), true);
              } catch {
                // dismissed with Escape: nothing to do
              }
            }}
          >
            <Pipette className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Recent colors">
          {recent.map((hex) => (
            <button
              key={hex}
              type="button"
              aria-label={`Use ${hex}`}
              onClick={() => emit(hexToHsv(hex))}
              className="size-6 cursor-pointer rounded-md border border-line-strong"
              style={{ background: hex }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
