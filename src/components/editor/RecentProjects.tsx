"use client";

import { useEffect, useState } from "react";
import { listStoredProjects, type ProjectSummary } from "@/lib/storage/projects";
import { formatTime } from "@/lib/time/formatTime";
import { button } from "./styles";

// The editor start screen's short list of recent projects (the full list,
// with deleting, is the dashboard at /projects).

export function RecentProjects({ onOpen }: { onOpen: (id: string) => void }) {
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [usage, setUsage] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    listStoredProjects().then(
      (list) => live && setProjects(list),
      () => live && setProjects([]), // IndexedDB blocked (e.g. some private modes)
    );
    navigator.storage?.estimate?.().then(({ usage: used = 0, quota = 0 }) => {
      if (live && quota) setUsage(`${formatBytes(used)} used of ${formatBytes(quota)} available`);
    });
    return () => {
      live = false;
    };
  }, []);

  if (!projects?.length) return null;
  return (
    <section className="w-full max-w-2xl" aria-labelledby="recent-title">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 id="recent-title" className="text-sm font-semibold">
          Recent projects
        </h2>
        {usage && <span className="text-xs opacity-50">{usage}</span>}
      </div>
      <ul className="divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
        {/* The newest few; the dashboard (/projects) has them all, plus deleting. */}
        {projects.slice(0, 3).map((p) => (
          <li key={p.id} className="flex items-center gap-3 px-3 py-2">
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(p.id)}>
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs opacity-60">
                Edited {timeAgo(p.updatedAt)} · {formatTime(p.durationMs)} · {formatBytes(p.sizeBytes)}
              </span>
            </button>
            <button type="button" className={button} onClick={() => onOpen(p.id)}>
              Open
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs opacity-50">Kept in this browser only. Clearing site data removes them; use “Save project” for a file you can keep.</p>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1e6) return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
  if (bytes < 1e9) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

function timeAgo(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ms).toLocaleDateString();
}
