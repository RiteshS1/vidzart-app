"use client";

import { useState } from "react";
import { runAiTask } from "@/lib/ai/aiClient";
import { cutRanges, removeFillerWords } from "@/lib/editor/actions";
import { CaptionsTool } from "./CaptionsTool";
import { useEditor, useEditorContext } from "./EditorContext";
import { TaskProgress, useTask } from "./TaskProgress";
import { button, panelLabel } from "./styles";

// The "AI" tab: tools that analyze the recording. Everything here runs on
// this device (in a worker) unless it says it uses your own API key.

export function AiPanel({ video, name }: { video: Blob; name: string }) {
  return (
    <div className="flex flex-col gap-6">
      <CaptionsTool video={video} name={name} />
      <SilenceTool video={video} />
      <FillerTool />
    </div>
  );
}

const PAUSE_OPTIONS = [
  { label: "0.5s", ms: 500 },
  { label: "1s", ms: 1000 },
  { label: "2s", ms: 2000 },
];

function SilenceTool({ video }: { video: Blob }) {
  const { store } = useEditorContext();
  const { run, progress, cancel } = useTask();
  const [minSilenceMs, setMinSilenceMs] = useState(1000);
  const [message, setMessage] = useState<string | null>(null);

  const removeSilences = async () => {
    setMessage(null);
    try {
      const result = await run((onProgress) => runAiTask({ type: "silences", video, options: { minSilenceMs } }, onProgress));
      if (!result) return;
      if (!result.hasAudio) return setMessage("This video has no audio track.");
      const cut = cutRanges(store, result.ranges);
      setMessage(
        cut > 0
          ? `Cut ${result.ranges.length} pause${result.ranges.length === 1 ? "" : "s"} (${(cut / 1000).toFixed(1)}s). Undo brings them back.`
          : "No pauses that long to cut.",
      );
    } catch (error) {
      setMessage(`Couldn't analyze the audio: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <section className="flex flex-col gap-2" aria-labelledby="silence-title">
      <h3 id="silence-title" className={panelLabel}>
        Remove silences
      </h3>
      <p className="text-xs opacity-60">Cuts pauses where nobody speaks. Runs on your device.</p>
      <div className="flex items-center gap-2 text-xs" role="group" aria-label="Shortest pause to cut">
        <span className="opacity-60">Pauses longer than</span>
        {PAUSE_OPTIONS.map((o) => (
          <button
            key={o.ms}
            type="button"
            aria-pressed={minSilenceMs === o.ms}
            onClick={() => setMinSilenceMs(o.ms)}
            className={`rounded px-2 py-1 font-medium ${
              minSilenceMs === o.ms ? "bg-foreground text-background" : "bg-black/[.05] dark:bg-white/[.07]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {progress ? (
        <TaskProgress progress={progress} onCancel={cancel} />
      ) : (
        <button type="button" className={`${button} self-start`} onClick={() => void removeSilences()}>
          Cut silences
        </button>
      )}
      {message && <p className="text-xs opacity-70">{message}</p>}
    </section>
  );
}

function FillerTool() {
  const { store } = useEditorContext();
  const hasWords = useEditor((s) => s.project.captions?.cues.some((c) => c.words?.length) ?? false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="flex flex-col gap-2" aria-labelledby="filler-title">
      <h3 id="filler-title" className={panelLabel}>
        Remove filler words
      </h3>
      <p className="text-xs opacity-60">
        Cuts &ldquo;um&rdquo; and &ldquo;uh&rdquo; using the captions&apos; word timings. Best effort: Whisper often leaves
        fillers out of the transcript, and those can&apos;t be found.
      </p>
      <button
        type="button"
        className={`${button} self-start`}
        disabled={!hasWords}
        title={hasWords ? undefined : "Generate captions first"}
        onClick={() => {
          const n = removeFillerWords(store);
          setMessage(n === 0 ? "No filler words in the transcript." : `Cut ${n} filler word${n === 1 ? "" : "s"}.`);
        }}
      >
        Cut filler words
      </button>
      {message && <p className="text-xs opacity-70">{message}</p>}
    </section>
  );
}
