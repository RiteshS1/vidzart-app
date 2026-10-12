"use client";

import { Music, Trash2, Upload } from "lucide-react";
import { useRef } from "react";
import type { MusicTrack, ProjectAudio } from "@/lib/project/types";
import { useEditor, useEditorContext } from "./EditorContext";
import { button, panelLabel } from "./styles";

// The "Audio" tool: the recording's volume and background music.

/** Sensible starting mix: clearly audible, but under the voice. */
const DEFAULT_MUSIC: Omit<MusicTrack, "src" | "name"> = {
  volume: 0.35,
  fadeInMs: 1000,
  fadeOutMs: 2000,
  loop: true,
  duckUnderVoice: true,
};

export function AudioPanel() {
  const { store, assets } = useEditorContext();
  const audio = useEditor((s) => s.project.audio);
  const inputRef = useRef<HTMLInputElement>(null);
  const music = audio?.music;

  // `coalesceKey` merges a slider drag into one undo step instead of one per pixel.
  const update = (patch: Partial<ProjectAudio>, coalesceKey?: string) =>
    store.edit((p) => ({ ...p, audio: { ...p.audio, ...patch } }), { coalesceKey });
  const updateMusic = (patch: Partial<MusicTrack>, coalesceKey?: string) =>
    store.edit((p) => (p.audio?.music ? { ...p, audio: { ...p.audio, music: { ...p.audio.music, ...patch } } } : p), {
      coalesceKey,
    });

  // The file goes into the asset store (saved with the project); the project
  // only keeps its path, so the JSON stays small and undo-able.
  const addMusic = (file: File) => {
    const ext = /\.[a-z0-9]{2,5}$/i.exec(file.name)?.[0]?.toLowerCase() ?? ".mp3";
    // A unique path per file: undoing a replace must bring back the old
    // file, not point at the new one under the same name.
    const src = `assets/music-${crypto.randomUUID().slice(0, 8)}${ext}`;
    assets.set(src, file);
    store.edit((p) => ({
      ...p,
      audio: { ...p.audio, music: { ...DEFAULT_MUSIC, ...(p.audio?.music ?? {}), src, name: file.name } },
    }));
  };

  return (
    <div className="flex flex-col gap-6">
      <Range
        label="Recording volume"
        value={audio?.sourceVolume ?? 1}
        display={`${Math.round((audio?.sourceVolume ?? 1) * 100)}%`}
        onChange={(sourceVolume) => update({ sourceVolume }, "sourceVolume")}
      />

      <section className="flex flex-col gap-3" aria-labelledby="music-title">
        <h3 id="music-title" className={panelLabel}>
          Background music
        </h3>
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          aria-label="Choose a music file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) addMusic(file);
            e.target.value = "";
          }}
        />
        {!music ? (
          <>
            <p className="text-xs text-ink-muted">
              MP3, M4A, WAV or OGG from your computer. It plays from the start, loops if needed, and is mixed into the
              export. Use music you have the rights to.
            </p>
            <button type="button" className={`${button} self-start`} onClick={() => inputRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> Add music
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
              <Music className="size-4 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0 flex-1 truncate text-sm" data-testid="music-name">
                {music.name ?? "Music"}
              </span>
              <button type="button" className="cursor-pointer text-xs text-ink-muted hover:text-ink" onClick={() => inputRef.current?.click()}>
                Replace
              </button>
              <button
                type="button"
                aria-label="Remove music"
                className="cursor-pointer text-ink-muted hover:text-danger"
                // Copy `audio` before deleting so the previous version (undo history) is untouched.
                onClick={() =>
                  store.edit((p) => {
                    const next = { ...p, audio: { ...p.audio } };
                    delete next.audio.music;
                    return next;
                  })
                }
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
            <Range label="Music volume" value={music.volume} display={`${Math.round(music.volume * 100)}%`} onChange={(volume) => updateMusic({ volume }, "musicVolume")} />
            <div className="grid grid-cols-2 gap-3">
              <Range label="Fade in" max={5000} step={100} value={music.fadeInMs} display={`${(music.fadeInMs / 1000).toFixed(1)}s`} onChange={(fadeInMs) => updateMusic({ fadeInMs }, "musicFadeIn")} />
              <Range label="Fade out" max={5000} step={100} value={music.fadeOutMs} display={`${(music.fadeOutMs / 1000).toFixed(1)}s`} onChange={(fadeOutMs) => updateMusic({ fadeOutMs }, "musicFadeOut")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={music.loop} onChange={(e) => updateMusic({ loop: e.target.checked })} />
              Loop to fill the whole video
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={music.duckUnderVoice} onChange={(e) => updateMusic({ duckUnderVoice: e.target.checked })} />
              Lower the music while someone talks
            </label>
          </>
        )}
      </section>
    </div>
  );
}

/** A labelled 0..max slider; the value readout sits on the right. */
function Range(props: { label: string; value: number; display: string; max?: number; step?: number; onChange: (v: number) => void }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex justify-between">
        <span className={panelLabel}>{props.label}</span>
        <span className="font-mono text-xs text-ink-muted">{props.display}</span>
      </span>
      <input
        type="range"
        min={0}
        max={props.max ?? 1}
        step={props.step ?? 0.01}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
      />
    </label>
  );
}
