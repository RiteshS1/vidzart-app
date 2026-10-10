"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { takePendingVideo } from "@/lib/editor/handoff";
import { probeVideo, type VideoInfo } from "@/lib/media/probe";
import { probeWithElement } from "@/lib/media/probeWithElement";
import { createProject } from "@/lib/project/defaults";
import { DropZone } from "./DropZone";
import { button } from "./styles";
import { Workspace, type Session } from "./Workspace";

export default function Editor() {
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const openCount = useRef(0);

  const open = useCallback(async (file: File) => {
    const attempt = ++openCount.current;
    setBusy(true);
    setError(null);
    const url = URL.createObjectURL(file);
    try {
      let info: VideoInfo;
      try {
        info = await probeVideo(file);
      } catch (mediabunnyError) {
        // Not demuxable by Mediabunny: maybe the browser can still play it.
        info = await probeWithElement(url).catch(() => {
          throw mediabunnyError;
        });
      }
      if (attempt !== openCount.current) return; // a newer file was chosen meanwhile
      const project = createProject({
        duration: info.durationMs,
        width: info.width,
        height: info.height,
        fps: info.fps,
      });
      setSession({ file, url, project });
    } catch (e) {
      URL.revokeObjectURL(url);
      if (attempt === openCount.current) {
        setError(e instanceof Error ? e.message : "Couldn't open this file.");
      }
    } finally {
      if (attempt === openCount.current) setBusy(false);
    }
  }, []);

  // Coming from /record with a fresh recording? Open it straight away.
  useEffect(() => {
    const pending = takePendingVideo();
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
      <header className="flex items-center gap-3 border-b border-black/10 px-4 py-2 dark:border-white/10">
        <Link href="/" className="font-semibold tracking-tight">
          Vidzart
        </Link>
        {session && (
          <>
            <span className="truncate text-sm opacity-60" data-testid="file-name">
              {session.file.name}
            </span>
            <span className="flex-1" />
            <button type="button" className={button} onClick={() => setSession(null)}>
              Open another
            </button>
          </>
        )}
      </header>
      {session ? (
        // `key` re-mounts the workspace (new store, new controller) per file.
        <Workspace key={session.url} session={session} />
      ) : (
        <main className="flex flex-1 items-center justify-center p-6">
          <DropZone onFile={open} error={error} busy={busy} />
        </main>
      )}
    </div>
  );
}
