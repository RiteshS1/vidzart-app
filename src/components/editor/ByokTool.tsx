"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { parseChapters, parseTranslation, SYSTEM, transcriptForPrompt, translationPrompt, writingPrompt, type WritingTask } from "@/lib/ai/byok/prompts";
import { complete, listModels, PROVIDERS, type ProviderId } from "@/lib/ai/byok/providers";
import { loadByok, saveByok, type ByokSettings } from "@/lib/ai/byok/settings";
import { cuesToOutput } from "@/lib/captions/subtitles";
import { LANGUAGES } from "./CaptionsTool";
import { useEditor, useEditorContext } from "./EditorContext";
import { button, panelLabel } from "./styles";

// "Write with AI": optional extras that use the user's OWN API key with a
// provider of their choice. The key stays in this browser; requests go from
// here straight to the provider.

const WRITING: { task: WritingTask; label: string }[] = [
  { task: "title", label: "Title & description" },
  { task: "chapters", label: "Chapters" },
  { task: "summary", label: "Summary" },
];

export function ByokTool() {
  const { store, getTimeMap } = useEditorContext();
  const captions = useEditor((s) => s.project.captions);
  // Safe to read localStorage while rendering: the editor is client-only
  // (EditorLoader loads it with ssr: false), so this never runs at build time.
  const [settings, setSettings] = useState<ByokSettings>(loadByok);
  // Open at first when there's no key yet, then entirely up to the user
  // (deriving it from `key` would collapse it on the first typed character).
  const [setupOpen, setSetupOpen] = useState(() => !settings.keys[settings.provider]);
  const [models, setModels] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; text: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState("es");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const provider = PROVIDERS.find((p) => p.id === settings.provider)!;
  const key = settings.keys[settings.provider] ?? "";
  const model = settings.models[settings.provider] ?? provider.defaultModel ?? "";
  const ready = Boolean(key && model);
  const hasTranscript = Boolean(captions?.cues.length);

  const change = (next: ByokSettings) => {
    setSettings(next);
    saveByok(next);
  };
  const setKey = (value: string) => change({ ...settings, keys: { ...settings.keys, [settings.provider]: value.trim() } });
  const setModel = (value: string) => change({ ...settings, models: { ...settings.models, [settings.provider]: value.trim() } });

  async function withRequest(label: string, fn: (signal: AbortSignal) => Promise<void>) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(label);
    setError(null);
    try {
      await fn(controller.signal);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (abort.current === controller) setBusy(null);
    }
  }

  const loadModelList = () =>
    withRequest("Loading models…", async (signal) => {
      const list = await listModels(settings.provider, key, signal);
      setModels(list);
      if (!model && list[0]) setModel(list[0]);
    });

  const write = (task: WritingTask, label: string) =>
    withRequest(`Writing ${label.toLowerCase()}…`, async (signal) => {
      const transcript = transcriptForPrompt(cuesToOutput(captions!.cues, getTimeMap()));
      const text = await complete({ provider: settings.provider, key, model, system: SYSTEM, prompt: writingPrompt(task, transcript), signal });
      const clean = task === "chapters" ? parseChapters(text).join("\n") || text.trim() : text.trim();
      setResult({ title: label, text: clean });
    });

  const translate = () =>
    withRequest("Translating captions…", async (signal) => {
      const cues = captions!.cues;
      const languageName = LANGUAGES.find(([code]) => code === targetLanguage)?.[1] ?? targetLanguage;
      const text = await complete({
        provider: settings.provider,
        key,
        model,
        system: SYSTEM,
        prompt: translationPrompt(cues.map((c) => c.text), languageName),
        signal,
      });
      const lines = parseTranslation(text, cues.length);
      // Same timings, new text. Word timings belong to the original speech,
      // so they're dropped (filler removal needs a fresh transcript).
      store.edit((p) =>
        p.captions
          ? {
              ...p,
              captions: {
                ...p.captions,
                language: targetLanguage,
                cues: p.captions.cues.map((c, i) => ({ id: c.id, start: c.start, end: c.end, text: lines[i]! })),
              },
            }
          : p,
      );
      setResult({ title: "Translation", text: `Captions translated to ${languageName}. Undo restores the original.` });
    });

  return (
    <section className="flex flex-col gap-3" aria-labelledby="byok-title">
      <h3 id="byok-title" className={panelLabel}>
        Write with AI (your API key)
      </h3>
      <p className="text-xs opacity-60">
        Optional. Uses your own key with the provider you choose; requests go straight from this browser to them.
      </p>
      <details
        className="rounded-md border border-black/10 p-2 text-xs dark:border-white/10"
        open={setupOpen}
        onToggle={(e) => setSetupOpen(e.currentTarget.open)}
      >
        <summary className="cursor-pointer font-medium">{key ? `${provider.name} · ${model || "no model"}` : "Set up a provider"}</summary>
        <div className="mt-2 flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="opacity-60">Provider</span>
            <select
              value={settings.provider}
              onChange={(e) => {
                setModels([]);
                change({ ...settings, provider: e.target.value as ProviderId });
              }}
              className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
            >
              {PROVIDERS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="opacity-60">
              API key ·{" "}
              <a href={provider.keyUrl} target="_blank" rel="noreferrer" className="underline">
                get one
              </a>
            </span>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Paste your key"
              className="rounded-md border border-black/10 bg-transparent px-2 py-1 font-mono dark:border-white/15"
            />
          </label>
          <p className="rounded bg-emerald-500/10 px-2 py-1 text-emerald-700 dark:text-emerald-400">
            <Lock className="mr-1 inline size-3" aria-hidden /> Stored on this device only (this browser&apos;s storage). Sent only to {provider.name}, never to Vidzart.
          </p>
          <label className="flex flex-col gap-1">
            <span className="opacity-60">Model</span>
            <span className="flex gap-1">
              <input
                list="byok-models"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="Model id"
                className="min-w-0 flex-1 rounded-md border border-black/10 bg-transparent px-2 py-1 font-mono dark:border-white/15"
              />
              <button type="button" className={button} disabled={!key || busy !== null} onClick={() => void loadModelList()}>
                Load list
              </button>
            </span>
            <datalist id="byok-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </label>
          {key && (
            <button type="button" className={`${button} self-start text-red-600`} onClick={() => setKey("")}>
              Remove key
            </button>
          )}
        </div>
      </details>

      {!hasTranscript && <p className="text-xs opacity-60">Generate captions first: these tools work from the transcript.</p>}
      <div className="flex flex-wrap gap-2">
        {WRITING.map(({ task, label }) => (
          <button
            key={task}
            type="button"
            className={button}
            disabled={!ready || !hasTranscript || busy !== null}
            onClick={() => void write(task, label)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs">
        <select
          aria-label="Translate captions to"
          value={targetLanguage}
          onChange={(e) => setTargetLanguage(e.target.value)}
          className="rounded-md border border-black/10 bg-transparent px-2 py-1 dark:border-white/15"
        >
          {LANGUAGES.filter(([code]) => code).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <button type="button" className={button} disabled={!ready || !hasTranscript || busy !== null} onClick={() => void translate()}>
          Translate captions
        </button>
      </div>

      {busy && (
        <p className="flex items-center gap-2 text-xs opacity-70" role="status">
          {busy}
          <button type="button" className="underline" onClick={() => abort.current?.abort()}>
            Cancel
          </button>
        </p>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}
      {result && (
        <div className="flex flex-col gap-1">
          <span className="flex items-center justify-between text-xs">
            <span className="font-medium">{result.title}</span>
            <button type="button" className="underline" onClick={() => void navigator.clipboard.writeText(result.text)}>
              Copy
            </button>
          </span>
          <textarea
            readOnly
            value={result.text}
            aria-label={`${result.title} result`}
            rows={Math.min(10, result.text.split("\n").length + 1)}
            className="rounded border border-black/10 bg-black/[.03] p-2 text-xs dark:border-white/10 dark:bg-white/[.05]"
          />
        </div>
      )}
    </section>
  );
}
