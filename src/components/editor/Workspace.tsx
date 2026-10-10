"use client";

import { useEffect, useMemo, useState } from "react";
import { EditorStore } from "@/lib/editor/store";
import { PlaybackController } from "@/lib/playback/PlaybackController";
import type { VidzProject } from "@/lib/project/types";
import { buildTimeMap, type TimeMap } from "@/lib/timeline/timeMap";
import { EditorContext, type EditorContextValue } from "./EditorContext";
import { PreviewCanvas } from "./PreviewCanvas";
import { SettingsPanel } from "./SettingsPanel";
import { Timeline } from "./Timeline";
import { Transport } from "./Transport";
import { useEditorShortcuts } from "./useEditorShortcuts";

export interface Session {
  file: File;
  url: string;
  project: VidzProject;
}

export function Workspace({ session }: { session: Session }) {
  // One store per opened file (the parent re-mounts us with a new `key`).
  const [store] = useState(() => new EditorStore(session.project));
  // The <video> is the frame source for the preview. It's created via a
  // callback ref, so we know when the element exists before building the
  // controller around it.
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);

  const value = useMemo<EditorContextValue | null>(() => {
    if (!video) return null;
    // Rebuilding the TimeMap is cheap but not free; cache it until the
    // segments (or duration) actually change.
    let cache: { segments: VidzProject["segments"]; map: TimeMap } | null = null;
    const getTimeMap = () => {
      const { project } = store.getState();
      if (cache?.segments !== project.segments) {
        cache = { segments: project.segments, map: buildTimeMap(project.source.duration, project.segments) };
      }
      return cache.map;
    };
    return { store, video, getTimeMap, controller: new PlaybackController(video, getTimeMap) };
  }, [store, video]);

  return (
    <>
      {/* Hidden: we only draw its frames onto the canvas. Audio still plays. */}
      <video ref={setVideo} src={session.url} preload="auto" playsInline className="hidden" />
      {value && (
        <EditorContext value={value}>
          <EditorLayout value={value} />
        </EditorContext>
      )}
    </>
  );
}

function EditorLayout({ value }: { value: EditorContextValue }) {
  useEditorShortcuts(value);
  const { controller } = value;
  useEffect(() => () => controller.pause(), [controller]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col rounded-lg bg-black/[.03] p-4 dark:bg-white/[.03]">
          <PreviewCanvas />
        </div>
        <SettingsPanel />
      </div>
      <Transport />
      <Timeline />
    </div>
  );
}
