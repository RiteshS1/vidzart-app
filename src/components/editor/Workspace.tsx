"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { applyAutoZooms } from "@/lib/editor/actions";
import { EditorStore } from "@/lib/editor/store";
import { cursorTrackCache } from "@/lib/effects/cursorTrack";
import { createCursorLookup } from "@/lib/events/cursor";
import type { VidzEvents } from "@/lib/events/types";
import { PlaybackController } from "@/lib/playback/PlaybackController";
import type { VidzProject } from "@/lib/project/types";
import { buildTimeMap, type TimeMap } from "@/lib/timeline/timeMap";
import { APP_VERSION } from "@/lib/version";
import { writeVidz } from "@/lib/vidz/vidzFile";
import { EditorContext, useEditorContext, type EditorContextValue } from "./EditorContext";
import { ExportDialog } from "./ExportDialog";
import { PreviewCanvas } from "./PreviewCanvas";
import { AiPanel } from "./AiPanel";
import { SettingsPanel } from "./SettingsPanel";
import { button, primaryButton } from "./styles";
import { Timeline } from "./Timeline";
import { Transport } from "./Transport";
import { useEditorShortcuts } from "./useEditorShortcuts";

export interface Session {
  /** What the user opened (a video or a .vidz), for display and file names. */
  name: string;
  video: File;
  url: string;
  project: VidzProject;
  /** The cursor/click log, if the project came from the extension. */
  events: VidzEvents | null;
}

export function Workspace({ session, onClose }: { session: Session; onClose: () => void }) {
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
    const cursorAt = session.events
      ? createCursorLookup(session.events, { offsetMs: session.project.source.eventsOffsetMs ?? 0 })
      : undefined;
    const getCursorTrack = cursorTrackCache(session.events);
    return { store, video, getTimeMap, cursorAt, getCursorTrack, controller: new PlaybackController(video, getTimeMap) };
  }, [store, video, session.events, session.project.source.eventsOffsetMs]);

  return (
    <>
      {/* Hidden: we only draw its frames onto the canvas. Audio still plays. */}
      <video ref={setVideo} src={session.url} preload="auto" playsInline className="hidden" />
      {value && (
        <EditorContext value={value}>
          <ProjectBar session={session} onClose={onClose} />
          <EditorLayout value={value} session={session} />
        </EditorContext>
      )}
    </>
  );
}

function ProjectBar({ session, onClose }: { session: Session; onClose: () => void }) {
  const { store } = useEditorContext();
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const hasClicks = session.events?.events.some((e) => e.type === "click") ?? false;

  const save = async () => {
    setStatus("Saving…");
    const isMp4 = session.video.type.includes("mp4") || session.video.name.toLowerCase().endsWith(".mp4");
    const blob = await writeVidz({
      project: store.getState().project,
      video: session.video,
      videoName: isMp4 ? "video.mp4" : "video.webm",
      events: session.events,
      appVersion: APP_VERSION,
    });
    // Download via a temporary <a download>: no permissions, no server.
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${session.name.replace(/\.[^.]+$/, "")}.vidz`;
    a.click();
    // Give the browser a moment to start the download before freeing it.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus("Saved");
  };

  return (
    <header className="flex items-center gap-3 border-b border-black/10 px-4 py-2 dark:border-white/10">
      <Link href="/" className="font-semibold tracking-tight">
        Vidzart
      </Link>
      <span className="truncate text-sm opacity-60" data-testid="file-name">
        {session.name}
      </span>
      {status && (
        <span className="text-xs opacity-50" role="status">
          {status}
        </span>
      )}
      <span className="flex-1" />
      {session.events && (
        <button
          type="button"
          className={button}
          disabled={!hasClicks}
          title={hasClicks ? "Add zooms around your clicks" : "No clicks in the event log"}
          onClick={() => {
            const n = applyAutoZooms(store, session.events!);
            setStatus(n === 0 ? "No auto zooms to add" : `Added ${n} auto zoom${n === 1 ? "" : "s"}`);
          }}
        >
          ✨ Auto zoom
        </button>
      )}
      <button type="button" className={button} onClick={() => void save()} title="Download a .vidz project file">
        Save project
      </button>
      <button type="button" className={button} onClick={onClose}>
        Open another
      </button>
      <button type="button" className={primaryButton} onClick={() => setExporting(true)}>
        Export MP4
      </button>
      {exporting && (
        <ExportDialog
          video={session.video}
          events={session.events}
          name={session.name}
          onClose={() => setExporting(false)}
        />
      )}
    </header>
  );
}

function EditorLayout({ value, session }: { value: EditorContextValue; session: Session }) {
  useEditorShortcuts(value);
  const { controller } = value;
  useEffect(() => () => controller.pause(), [controller]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex min-h-[240px] min-w-0 flex-1 flex-col rounded-lg bg-black/[.03] p-4 dark:bg-white/[.03]">
          <PreviewCanvas />
        </div>
        <Sidebar session={session} />
      </div>
      <Transport />
      <Timeline />
    </div>
  );
}

/** Right-hand panel: "Style" (look settings) or "AI" (analysis tools). */
function Sidebar({ session }: { session: Session }) {
  const [tab, setTab] = useState<"style" | "ai">("style");
  return (
    <div className="flex min-h-0 w-full flex-col gap-4 lg:w-72">
      <div role="tablist" aria-label="Sidebar" className="grid grid-cols-2 gap-1 rounded-lg bg-black/[.04] p-1 dark:bg-white/[.06]">
        {(["style", "ai"] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`rounded-md py-1 text-sm font-medium ${tab === t ? "bg-background shadow-sm" : "opacity-60 hover:opacity-100"}`}
          >
            {t === "style" ? "Style" : "✨ AI"}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Both stay mounted, so a running AI task survives switching tabs. */}
        <div hidden={tab !== "style"}>
          <SettingsPanel />
        </div>
        <div hidden={tab !== "ai"}>
          <AiPanel video={session.video} name={session.name} />
        </div>
      </div>
    </div>
  );
}
