"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { takePendingVideo } from "@/lib/editor/handoff";
import { probeVideo, type VideoInfo } from "@/lib/media/probe";
import { probeWithElement } from "@/lib/media/probeWithElement";
import { createProject } from "@/lib/project/defaults";
import { readVidz } from "@/lib/vidz/vidzFile";
import { DropZone } from "./DropZone";
import { Workspace, type Session } from "./Workspace";

const isVidz = (file: File) => file.name.toLowerCase().endsWith(".vidz") || file.type === "application/zip";

/** Opens a plain video: probe it and start a fresh project. */
async function sessionFromVideo(file: File, url: string): Promise<Omit<Session, "url">> {
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
  return { name: file.name, video: file, project, events: null };
}

export default function Editor() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openCount = useRef(0);

  const open = useCallback(async (file: File) => {
    const attempt = ++openCount.current;
    setBusy(true);
    setError(null);
    let url: string | null = null;
    try {
      let next: Omit<Session, "url">;
      if (isVidz(file)) {
        // A saved project: video + events + edits, all in one file.
        const contents = await readVidz(file);
        next = { name: file.name, video: contents.video, project: contents.project, events: contents.events };
        url = URL.createObjectURL(contents.video);
      } else {
        url = URL.createObjectURL(file);
        next = await sessionFromVideo(file, url);
      }
      if (attempt !== openCount.current) {
        URL.revokeObjectURL(url); // a newer file was chosen meanwhile
        return;
      }
      setSession({ ...next, url });
    } catch (e) {
      if (url) URL.revokeObjectURL(url);
      if (attempt === openCount.current) {
        setError(e instanceof Error ? e.message : "Couldn't open this file.");
      }
    } finally {
      if (attempt === openCount.current) setBusy(false);
    }
  }, []);

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
        <Workspace key={session.url} session={session} onClose={() => setSession(null)} />
      ) : (
        <>
          <header className="flex items-center gap-3 border-b border-black/10 px-4 py-2 dark:border-white/10">
            <Link href="/" className="font-semibold tracking-tight">
              Vidzart
            </Link>
          </header>
          <main className="flex flex-1 items-center justify-center p-6">
            <DropZone onFile={open} error={error} busy={busy} />
          </main>
        </>
      )}
    </div>
  );
}
