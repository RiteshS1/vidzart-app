"use client";

import { useState } from "react";
import { runAiTask } from "@/lib/ai/aiClient";
import { WHISPER_MODELS, type WhisperModel } from "@/lib/ai/models";
import { cuesToOutput, toSrt, toVtt } from "@/lib/captions/subtitles";
import type { Captions, CaptionCue } from "@/lib/project/types";
import { formatTime } from "@/lib/time/formatTime";
import { TaskProgress, useTask } from "./TaskProgress";
import { useEditor, useEditorContext } from "./EditorContext";
import { button, panelLabel } from "./styles";

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

export const DEFAULT_CAPTION_STYLE: Captions["style"] = { size: 0.045, position: "bottom" };

export function CaptionsTool({ video, name }: { video: Blob; name: string }) {
  const { store } = useEditorContext();
  const captions = useEditor((s) => s.project.captions);
  const { run, progress, cancel } = useTask();
  const [model, setModel] = useState<WhisperModel>("base");
  const [language, setLanguage] = useState("");
  const [message, setMessage] = useState<string | null>(null);

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
      {progress ? (
        <TaskProgress progress={progress} onCancel={cancel} />
      ) : (
        <>
          <div className="flex gap-2">
            <label className="flex flex-1 flex-col gap-1 text-xs">
              <span className="opacity-60">Model</span>
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
          <button type="button" className={`${button} self-start`} onClick={() => void generate()}>
            {captions ? "Regenerate captions" : "Generate captions"}
          </button>
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
      {captions.visible && (
        <div className="flex items-center gap-3 text-xs">
          <label className="flex flex-1 flex-col gap-1">
            <span className="opacity-60">Text size</span>
            <input
              type="range"
              min={0.025}
              max={0.09}
              step={0.001}
              value={captions.style.size}
              onChange={(e) => update({ style: { ...captions.style, size: Number(e.target.value) } }, "captionSize")}
              className="accent-foreground"
            />
          </label>
          <div className="flex gap-1" role="group" aria-label="Caption position">
            {(["top", "bottom"] as const).map((position) => (
              <button
                key={position}
                type="button"
                aria-pressed={captions.style.position === position}
                onClick={() => update({ style: { ...captions.style, position } })}
                className={`rounded px-2 py-1 font-medium capitalize ${
                  captions.style.position === position ? "bg-foreground text-background" : "bg-black/[.05] dark:bg-white/[.07]"
                }`}
              >
                {position}
              </button>
            ))}
          </div>
        </div>
      )}
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
