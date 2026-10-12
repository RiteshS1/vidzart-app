"use client";

import { Clock, FileVideo, FolderOpen, HardDrive, Puzzle, Trash2, Video } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { runAiTask } from "@/lib/ai/aiClient";
import { deleteStoredProject, getStoredProject, listStoredProjects, saveThumbnail, type ProjectSummary } from "@/lib/storage/projects";
import { formatTime } from "@/lib/time/formatTime";

// The local dashboard: every project autosaved in this browser, as cards.
// Thumbnails are made once per project (first frame, in the worker) and
// stored with it.

/** The /projects page: storage use, ways to start, and a card per saved project. */
export function ProjectsDashboard() {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [usage, setUsage] = useState<{ used: number; quota: number } | null>(null);

  // `live` guards against setting state after the page was left mid-load.
  useEffect(() => {
    let live = true;
    listStoredProjects().then(
      (list) => live && setProjects(list),
      () => live && setProjects([]), // IndexedDB can be blocked (some private modes): show "no projects"
    );
    // Browser-reported storage use, to make "saved in this browser" tangible.
    navigator.storage?.estimate?.().then(({ usage: used = 0, quota = 0 }) => live && quota > 0 && setUsage({ used, quota }));
    return () => {
      live = false;
    };
  }, []);

  // Fill in missing thumbnails one by one (one decoder at a time is plenty).
  const missing = useMemo(() => projects?.filter((p) => !p.thumbnail).map((p) => p.id) ?? [], [projects]);
  useEffect(() => {
    if (missing.length === 0) return;
    let cancelled = false;
    let cancelTask = () => {};
    void (async () => {
      for (const id of missing) {
        if (cancelled) return;
        const stored = await getStoredProject(id).catch(() => undefined);
        if (!stored) continue;
        const task = runAiTask({ type: "thumbnails", video: stored.video, count: 1, height: 216 });
        cancelTask = task.cancel;
        const result = await task.done.catch(() => null);
        const frame = result?.frames[0];
        if (!frame || cancelled) continue;
        const canvas = new OffscreenCanvas(frame.width, frame.height);
        canvas.getContext("2d")!.drawImage(frame, 0, 0);
        frame.close();
        const thumbnail = await canvas.convertToBlob({ type: "image/jpeg", quality: 0.8 });
        await saveThumbnail(id, thumbnail).catch(() => {});
        if (!cancelled) setProjects((list) => list?.map((p) => (p.id === id ? { ...p, thumbnail } : p)) ?? null);
      }
    })();
    return () => {
      cancelled = true;
      cancelTask();
    };
  }, [missing]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-ink-muted">Kept in this browser only. Use “Save project” in the editor for a file you can back up.</p>
        </div>
        {usage && (
          <div className="flex min-w-56 flex-col gap-1.5 text-xs text-ink-muted" aria-label="Storage used">
            <span className="flex items-center gap-1.5">
              <HardDrive className="size-3.5" aria-hidden /> {formatBytes(usage.used)} of {formatBytes(usage.quota)} available
            </span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-3">
              <span className="block h-full bg-accent" style={{ width: `${Math.max(1, (usage.used / usage.quota) * 100)}%` }} />
            </span>
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        <StartTile href="/editor" icon={FolderOpen} title="Open a video" text="Edit any recording you already have." />
        <StartTile href="/record" icon={Video} title="Record your screen" text="Quick screen, window or tab recording." />
        <StartTile href="/#install" icon={Puzzle} title="Record with the extension" text="Adds automatic zooms on your clicks." />
      </div>

      <h2 className="mt-12 mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-ink-muted">Recent</h2>
      {projects === null ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : projects.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line-strong px-6 py-16 text-center">
          <FileVideo className="size-8 text-ink-faint" aria-hidden />
          <p className="font-medium">No projects yet</p>
          <p className="max-w-sm text-sm text-ink-muted">Open a video or record one; it shows up here and autosaves as you edit.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Your projects">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} onDeleted={() => setProjects((list) => list?.filter((x) => x.id !== p.id) ?? null)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function StartTile({ href, icon: Icon, title, text }: { href: string; icon: typeof Video; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors duration-150 hover:border-line-strong hover:bg-surface-2"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-3">
        <Icon className="size-5 text-accent" aria-hidden />
      </span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-muted">{text}</span>
      </span>
    </Link>
  );
}

/** One project: thumbnail + name link to the editor, with an inline two-step delete. */
function ProjectCard({ project, onDeleted }: { project: ProjectSummary; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  // A blob: URL for the stored thumbnail; revoked below so it doesn't leak.
  const thumbUrl = useMemo(() => (project.thumbnail ? URL.createObjectURL(project.thumbnail) : null), [project.thumbnail]);
  useEffect(() => () => (thumbUrl ? URL.revokeObjectURL(thumbUrl) : undefined), [thumbUrl]);
  const href = `/editor?project=${encodeURIComponent(project.id)}`;

  return (
    <li className="group overflow-hidden rounded-2xl border border-line bg-surface transition-colors duration-150 hover:border-line-strong" data-testid="project-card">
      <Link href={href} className="block" aria-label={`Open ${project.name}`}>
        <div className="relative aspect-video bg-surface-3">
          {thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- a local blob: URL; next/image can't optimize those
            <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="absolute inset-0 animate-pulse bg-surface-2" aria-hidden />
          )}
          <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[11px] text-white">
            {formatTime(project.durationMs).replace(/\.\d$/, "")}
          </span>
        </div>
      </Link>
      <div className="flex items-center gap-2 p-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium" title={project.name}>
            {project.name}
          </p>
          <p className="flex items-center gap-1 text-xs text-ink-muted">
            <Clock className="size-3" aria-hidden /> {timeAgo(project.updatedAt)} · {formatBytes(project.sizeBytes)}
          </p>
        </div>
        {confirming ? (
          <span className="flex gap-1">
            <button
              type="button"
              className="cursor-pointer rounded-md bg-danger/15 px-2 py-1 text-xs font-medium text-danger hover:bg-danger/25"
              onClick={() => void deleteStoredProject(project.id).then(onDeleted)}
            >
              Delete
            </button>
            <button type="button" className="cursor-pointer rounded-md px-2 py-1 text-xs text-ink-muted hover:text-ink" onClick={() => setConfirming(false)}>
              Keep
            </button>
          </span>
        ) : (
          <button
            type="button"
            aria-label={`Delete ${project.name}`}
            className="cursor-pointer rounded-md p-1.5 text-ink-muted hover:bg-surface-3 hover:text-danger"
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  );
}

/** Decimal units (KB/MB/GB), matching how browsers report storage quota. */
function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

/** "Edited 5 min ago" style label; falls back to a date after a day. */
function timeAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "Edited just now";
  if (minutes < 60) return `Edited ${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Edited ${hours} h ago`;
  return `Edited ${new Date(ms).toLocaleDateString()}`;
}
