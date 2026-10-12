"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { runAiTask } from "@/lib/ai/aiClient";
import { WHISPER_MODELS, type WhisperModel } from "@/lib/ai/models";
import { fitCuesToDuration, parseSubtitles } from "@/lib/captions/parse";
import { applyCaptionPreset, CAPTION_PRESETS, DEFAULT_CAPTION_STYLE } from "@/lib/captions/styles";
import { cuesToOutput, toSrt, toVtt } from "@/lib/captions/subtitles";
import type { Captions, CaptionCue, CaptionStyle } from "@/lib/project/types";
import { formatTime } from "@/lib/time/formatTime";
import { TaskProgress, useTask } from "./TaskProgress";
import { useEditor, useEditorContext } from "./EditorContext";
import { button, panelLabel, segment } from "./styles";

// Whisper language codes we offer; "" = detect automatically.
export const LANGUAGES: [code: string, name: string][] = [
  ["", "Detect automatically"],
  ["en", "English"],
  ["es", "Spanish"],
  ["fr", "French"],
  ["de", "German"],
  ["hi", "Hindi"],
  ["pt", "Portuguese"],
  ["it", "Italian"],
  ["nl", "Dutch"],
  ["ja", "Japanese"],
  ["ko", "Korean"],
  ["zh", "Chinese"],
];


export function CaptionsTool({ video, name }: { video: Blob; name: string }) {
  const { store } = useEditorContext();
  const captions = useEditor((s) => s.project.captions);
  const { run, progress, cancel } = useTask();
  const [model, setModel] = useState<WhisperModel>("base");
  const [language, setLanguage] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const duration = useEditor((s) => s.project.source.duration);

  // Captions from a subtitle file: the editor's captions autofill with them.
  const loadFile = async (file: File) => {
    setMessage(null);
    try {
      const cues = fitCuesToDuration(parseSubtitles(await file.text()), duration);
      if (cues.length === 0) return setMessage("This file's captions all start after the end of the video.");
      store.edit((p) => ({
        ...p,
        captions: { visible: true, style: p.captions?.style ?? DEFAULT_CAPTION_STYLE, cues },
      }));
      setMessage(`Loaded ${cues.length} captions from ${file.name}. Times match the original recording.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Couldn't read that caption file.");
    }
  };

  const generate = async () => {
    setMessage(null);
    try {
      const result = await run((onProgress) =>
        runAiTask({ type: "transcribe", video, options: { model, language: language || undefined } }, onProgress),
      );
      if (!result) return;
      if (!result.hasAudio) return setMessage("This video has no audio track.");
      if (result.cues.length === 0) return setMessage("No speech found.");
      // One undoable edit; keeps the previous style if regenerating.
      store.edit((p) => ({
        ...p,
        captions: {
          visible: true,
          ...(language ? { language } : {}),
          style: p.captions?.style ?? DEFAULT_CAPTION_STYLE,
          cues: result.cues,
        },
      }));
      setMessage(`Created ${result.cues.length} captions. Check the text below; speech recognition makes mistakes.`);
    } catch (error) {
      setMessage(`Captioning failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="flex flex-col gap-3" aria-labelledby="captions-title">
      <h3 id="captions-title" className={panelLabel}>
        Captions
      </h3>
      {!captions && (
        <p className="text-xs opacity-60">
          Transcribes the speech on your device with Whisper. The model is downloaded once from Hugging Face
          (~{WHISPER_MODELS[model].sizeMb} MB) and cached; your audio never leaves this computer.
        </p>
      )}
      <input
        ref={fileInput}
        type="file"
        accept=".srt,.vtt,text/vtt,application/x-subrip"
        className="hidden"
        aria-label="Choose a caption file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void loadFile(file);
          e.target.value = "";
        }}
      />
      {progress ? (
        <TaskProgress progress={progress} onCancel={cancel} />
      ) : (
        <>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="opacity-60">Speech model</span>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value as WhisperModel)}
                className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
              >
                {(Object.keys(WHISPER_MODELS) as WhisperModel[]).map((key) => (
                  <option key={key} value={key}>
                    {WHISPER_MODELS[key].label} (~{WHISPER_MODELS[key].sizeMb} MB)
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="opacity-60">Spoken language</span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
              >
                {LANGUAGES.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={button} onClick={() => void generate()}>
              {captions ? "Regenerate captions" : "Generate captions"}
            </button>
            <button type="button" className={button} onClick={() => fileInput.current?.click()}>
              <Upload className="size-4" aria-hidden /> {captions ? "Replace from file…" : "Upload captions…"}
            </button>
          </div>
          {!captions && <p className="text-xs text-ink-muted">Already have captions? Upload an .srt or .vtt file and they fill in automatically.</p>}
        </>
      )}
      {message && <p className="text-xs opacity-70">{message}</p>}
      {captions && <CaptionEditor captions={captions} name={name} />}
    </section>
  );
}

function CaptionEditor({ captions, name }: { captions: Captions; name: string }) {
  const { store, controller, getTimeMap } = useEditorContext();
  const update = (patch: Partial<Captions>, coalesceKey?: string) =>
    store.edit((p) => (p.captions ? { ...p, captions: { ...p.captions, ...patch } } : p), { coalesceKey });
  const updateCue = (id: string, text: string) =>
    update({ cues: captions.cues.map((c): CaptionCue => (c.id === id ? { ...c, text } : c)) }, `caption-${id}`);

  const download = (format: "srt" | "vtt") => {
    const cues = cuesToOutput(captions.cues, getTimeMap());
    const text = format === "srt" ? toSrt(cues) : toVtt(cues);
    const url = URL.createObjectURL(new Blob([text], { type: format === "srt" ? "application/x-subrip" : "text/vtt" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/\.[^.]+$/, "")}.${format}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={captions.visible} onChange={(e) => update({ visible: e.target.checked })} />
        Show captions in the video
      </label>
      {captions.visible && <CaptionStyleControls style={captions.style} hasWords={captions.cues.some((c) => c.words?.length)} onChange={(style, key) => update({ style }, key)} />}
      <ol className="flex max-h-72 flex-col gap-1 overflow-y-auto pr-1" aria-label="Caption text">
        {captions.cues.map((cue) => (
          <li key={cue.id} className="flex items-start gap-2">
            <button
              type="button"
              className="mt-1 font-mono text-[11px] opacity-60 hover:opacity-100"
              title="Jump here"
              onClick={() => controller.seekSource(cue.start)}
            >
              {formatTime(cue.start)}
            </button>
            <textarea
              value={cue.text}
              rows={Math.max(1, Math.ceil(cue.text.length / 32))}
              aria-label={`Caption at ${formatTime(cue.start)}`}
              onChange={(e) => updateCue(cue.id, e.target.value)}
              className="flex-1 resize-none rounded border border-transparent bg-black/[.03] px-1.5 py-1 text-xs hover:border-black/10 focus:border-black/20 focus:outline-none dark:bg-white/[.05] dark:hover:border-white/15"
            />
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} onClick={() => download("srt")}>
          Download .srt
        </button>
        <button type="button" className={button} onClick={() => download("vtt")}>
          Download .vtt
        </button>
        <button
          type="button"
          className={`${button} text-red-600`}
          onClick={() =>
            store.edit((p) => {
              const next = { ...p };
              delete next.captions;
              return next;
            })
          }
        >
          Remove captions
        </button>
      </div>
    </div>
  );
}

const TEXT_COLORS = ["#ffffff", "#111118", "#ffb224", "#facc15", "#4ade80", "#38bdf8"];
const BOX_COLORS = ["rgba(0,0,0,0.72)", "#000000", "#ffffff", "#ffb224", "#1e4d5c", "#ef4444"];

function CaptionStyleControls(props: {
  style: CaptionStyle;
  hasWords: boolean;
  onChange: (style: CaptionStyle, coalesceKey?: string) => void;
}) {
  const { style } = props;
  const set = (patch: Partial<CaptionStyle>, key?: string) => props.onChange({ ...style, ...patch }, key);
  const mode: "box" | "outline" = style.background ? "box" : "outline";
  const matches = (preset: (typeof CAPTION_PRESETS)[number]) =>
    JSON.stringify(applyCaptionPreset(style, preset)) === JSON.stringify(style);

  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-line bg-surface-2/40 p-3">
      <legend className={`${panelLabel} px-1`}>Caption style</legend>

      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Caption look">
        {CAPTION_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            aria-pressed={matches(preset)}
            onClick={() => props.onChange(applyCaptionPreset(style, preset))}
            className={`${segment(matches(preset))} py-2`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-4 gap-1" role="group" aria-label="Caption font">
        {(["sans", "serif", "mono", "rounded"] as const).map((font) => (
          <button key={font} type="button" aria-pressed={(style.font ?? "sans") === font} className={`${segment((style.font ?? "sans") === font)} capitalize`} onClick={() => set({ font })}>
            {font}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Caption weight">
        {([400, 600, 800] as const).map((weight) => (
          <button key={weight} type="button" aria-pressed={(style.weight ?? 600) === weight} className={segment((style.weight ?? 600) === weight)} style={{ fontWeight: weight }} onClick={() => set({ weight })}>
            {weight === 400 ? "Regular" : weight === 600 ? "Semi" : "Bold"}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5 text-xs">
        <span className="flex justify-between">
          <span className={panelLabel}>Text size</span>
          <span className="font-mono text-ink-muted">{Math.round(style.size * 1000) / 10}%</span>
        </span>
        <input type="range" min={0.025} max={0.09} step={0.001} value={style.size} onChange={(e) => set({ size: Number(e.target.value) }, "captionSize")} />
      </label>

      <div className="grid grid-cols-3 gap-1" role="group" aria-label="Caption position">
        {(["top", "middle", "bottom"] as const).map((position) => (
          <button key={position} type="button" aria-pressed={style.position === position} className={`${segment(style.position === position)} capitalize`} onClick={() => set({ position })}>
            {position}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={Boolean(style.uppercase)} onChange={(e) => set({ uppercase: e.target.checked })} />
        UPPERCASE
      </label>

      <div className="flex flex-col gap-1.5">
        <span className={panelLabel}>Text color</span>
        <Swatches colors={TEXT_COLORS} value={style.color ?? "#ffffff"} label="Caption text color" onPick={(color) => set({ color })} />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className={panelLabel}>Behind the text</span>
        <div className="grid grid-cols-2 gap-1" role="group" aria-label="Caption background">
          <button type="button" aria-pressed={mode === "outline"} className={segment(mode === "outline")} onClick={() => set({ background: null, outline: true })}>
            Outline
          </button>
          <button type="button" aria-pressed={mode === "box"} className={segment(mode === "box")} onClick={() => set({ background: style.background ?? "rgba(0,0,0,0.72)", outline: false })}>
            Box
          </button>
        </div>
        {mode === "box" && (
          <Swatches colors={BOX_COLORS} value={style.background ?? ""} label="Caption box color" onPick={(background) => set({ background })} />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={!props.hasWords}
            checked={Boolean(style.highlight)}
            onChange={(e) => {
              const next = { ...style };
              if (e.target.checked) next.highlight = "#ffb224";
              else delete next.highlight;
              props.onChange(next);
            }}
          />
          Highlight the spoken word
        </label>
        {!props.hasWords && <p className="text-xs text-ink-muted">Needs word timings: generate captions on this device to get them.</p>}
        {style.highlight && <Swatches colors={TEXT_COLORS} value={style.highlight} label="Highlight color" onPick={(highlight) => set({ highlight })} />}
      </div>
    </fieldset>
  );
}

function Swatches(props: { colors: string[]; value: string; label: string; onPick: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={props.label}>
      {props.colors.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`${props.label} ${c}`}
          aria-pressed={props.value === c}
          onClick={() => props.onPick(c)}
          className={`size-7 cursor-pointer rounded-full ring-offset-2 ring-offset-surface ${props.value === c ? "ring-2 ring-accent" : "ring-1 ring-line-strong"}`}
          style={{ background: c }}
        />
      ))}
    </div>
  );
}
