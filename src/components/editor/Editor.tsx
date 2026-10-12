"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { listenForExtensionHandoff } from "@/lib/editor/extensionHandoff";
import { takePendingVideo } from "@/lib/editor/handoff";
import { probeVideo, type VideoInfo } from "@/lib/media/probe";
import { probeWithElement } from "@/lib/media/probeWithElement";
import { createProject } from "@/lib/project/defaults";
import { readVidz } from "@/lib/vidz/vidzFile";
import { createStoredProject, getStoredProject } from "@/lib/storage/projects";
import { DropZone } from "./DropZone";
import { RecentProjects } from "./RecentProjects";
import { Workspace, type Session } from "./Workspace";

const isVidz = (file: File) => file.name.toLowerCase().endsWith(".vidz") || file.type === "application/zip";

/** Opens a plain video: probe it and start a fresh project. */
async function sessionFromVideo(file: File, url: string): Promise<Omit<Session, "url" | "storedId">> {
  let info: VideoInfo;
  try {
    info = await probeVideo(file);
  } catch (mediabunnyError) {
    // Not demuxable by Mediabunny: maybe the browser can still play it.
    info = await probeWithElement(url).catch(() => {
      throw mediabunnyError;
    });
  }
  const project = createProject({ duration: info.durationMs, width: info.width, height: info.height, fps: info.fps });
  return { name: file.name, video: file, project, events: null, autoZoomOnOpen: false };
}

const errorText = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

export default function Editor() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const openCount = useRef(0);

  const show = useCallback((next: Omit<Session, "url">, url: string, attempt: number) => {
    if (attempt !== openCount.current) {
      URL.revokeObjectURL(url); // a newer file was chosen meanwhile
      return false;
    }
    setSession({ ...next, url });
    return true;
  }, []);

  const open = useCallback(
    async (file: File) => {
      const attempt = ++openCount.current;
      setBusy(true);
      setError(null);
      let url: string | null = null;
      try {
        let next: Omit<Session, "url" | "storedId">;
        if (isVidz(file)) {
          // A saved project: video + events + edits, all in one file.
          const contents = await readVidz(file);
          next = {
            name: file.name,
            video: contents.video,
            project: contents.project,
            events: contents.events,
            // A fresh recording from the extension: add the zooms right away,
            // like Cursorful. Not for projects that already have edits (a
            // saved .vidz you're continuing), so deleted zooms stay deleted.
            autoZoomOnOpen:
              contents.manifest.createdBy.app === "vidzart-extension" &&
              contents.project.segments.length === 0 &&
              contents.events !== null,
          };
          url = URL.createObjectURL(contents.video);
        } else {
          url = URL.createObjectURL(file);
          next = await sessionFromVideo(file, url);
        }
        if (!show({ ...next, storedId: null }, url, attempt)) return;
        // Keep a copy in this browser (autosave). Copying a big video takes a
        // moment, so the editor opens first and autosave starts once it's done.
        createStoredProject(next).then(
          (storedId) => setSession((s) => (s?.url === url ? { ...s, storedId } : s)),
          (e: unknown) => setNotice(`Couldn't keep a copy in this browser (${errorText(e, "storage error")}). Use "Save project" to keep your edits.`),
        );
      } catch (e) {
        if (url) URL.revokeObjectURL(url);
        if (attempt === openCount.current) setError(errorText(e, "Couldn't open this file."));
      } finally {
        if (attempt === openCount.current) setBusy(false);
      }
    },
    [show],
  );

  const openStored = useCallback(
    async (id: string) => {
      const attempt = ++openCount.current;
      setError(null);
      try {
        const stored = await getStoredProject(id);
        if (!stored) throw new Error("This project is no longer saved in this browser.");
        const url = URL.createObjectURL(stored.video);
        show(
          { name: stored.name, video: stored.video, project: stored.project, events: stored.events, storedId: id, autoZoomOnOpen: false },
          url,
          attempt,
        );
      } catch (e) {
        if (attempt === openCount.current) setError(errorText(e, "Couldn't open this project."));
      }
    },
    [show],
  );

  // Coming from /record with a fresh recording? Open it straight away.
  // The handoff is one-shot (taking it clears it), so we must start opening
  // in the same effect run that takes it. Deferring with setTimeout would
  // lose the file in React StrictMode's dev double-run (run → cleanup
  // cancels the timer → second run finds nothing). Hence the lint exception.
  useEffect(() => {
    const pending = takePendingVideo();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    if (pending) void open(pending);
  }, [open]);

  // Opened by the extension's "Open in editor"? It posts the recording to us.
  useEffect(() => listenForExtensionHandoff((file) => void open(file)), [open]);

  // Free the previous file's object URL whenever the session changes.
  const sessionUrl = session?.url;
  useEffect(() => {
    if (!sessionUrl) return;
    return () => URL.revokeObjectURL(sessionUrl);
  }, [sessionUrl]);

  return (
    <div className="flex h-dvh flex-col">
      {session ? (
        // `key` re-mounts the workspace (new store, new controller) per file.
        <>
          {notice && (
            <p className="bg-amber-500/15 px-4 py-1 text-xs" role="note">
              {notice}
            </p>
          )}
          <Workspace key={session.url} session={session} onClose={() => setSession(null)} />
        </>
      ) : (
        <>
          <header className="flex items-center gap-3 border-b border-black/10 px-4 py-2 dark:border-white/10">
            <Link href="/" className="font-semibold tracking-tight">
              Vidzart
            </Link>
            <span className="flex-1" />
            <a href="https://buymeacoffee.com/riteshs" target="_blank" rel="noreferrer" className="text-xs opacity-60 hover:opacity-100">
              ☕ Buy me a coffee
            </a>
          </header>
          <main className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto p-6">
            <DropZone onFile={open} error={error} busy={busy} />
            <RecentProjects onOpen={(id) => void openStored(id)} />
          </main>
        </>
      )}
    </div>
  );
}
