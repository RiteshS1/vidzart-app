"use client";

import { useEffect, useState } from "react";
import type { EditorStore } from "@/lib/editor/store";
import { assetPaths, type AssetStore } from "@/lib/editor/assets";
import { saveProjectAssets, saveProjectEdits } from "@/lib/storage/projects";

export type AutosaveState = "idle" | "saving" | "saved" | "error";

/** Wait this long after the last edit: a slider drag is one save, not 60. */
const DEBOUNCE_MS = 800;

/**
 * Saves the project to this browser whenever it changes. `storedId` is
 * null until the stored copy (with the video) has been created; edits made
 * before that are saved as soon as it exists.
 */
export function useAutosave(store: EditorStore, assets: AssetStore, storedId: string | null): AutosaveState {
  const [state, setState] = useState<AutosaveState>("idle");

  useEffect(() => {
    if (!storedId) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let saved = store.getState().project;
    let first = true;

    const save = () => {
      timer = null;
      const { project } = store.getState();
      if (project === saved && !first) return;
      first = false;
      saved = project;
      setState("saving");
      saveProjectEdits(storedId, project).then(
        () => setState("saved"),
        () => setState("error"),
      );
    };
    save(); // edits made before the stored copy existed

    const unsubscribe = store.subscribe(() => {
      if (store.getState().project === saved) return; // UI-only change (selection)
      if (timer) clearTimeout(timer);
      timer = setTimeout(save, DEBOUNCE_MS);
    });
    // Leaving the page: write the pending edit now instead of losing it.
    const flush = () => {
      if (timer) {
        clearTimeout(timer);
        save();
      }
    };
    window.addEventListener("pagehide", flush);
    // Asset files (music…) change rarely and are big: saved as they change,
    // only the ones the project uses.
    const saveAssets = () => {
      setState("saving");
      saveProjectAssets(storedId, assets.referencedBy(assetPaths(store.getState().project))).then(
        () => setState("saved"),
        () => setState("error"),
      );
    };
    const unsubscribeAssets = assets.subscribe(saveAssets);
    return () => {
      unsubscribeAssets();
      unsubscribe();
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [store, assets, storedId]);

  return state;
}
