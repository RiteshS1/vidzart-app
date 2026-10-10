"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { EditorState, EditorStore } from "@/lib/editor/store";
import type { PlaybackController } from "@/lib/playback/PlaybackController";
import type { TimeMap } from "@/lib/timeline/timeMap";

export interface EditorContextValue {
  store: EditorStore;
  controller: PlaybackController;
  video: HTMLVideoElement;
  /** Memoized: returns the same TimeMap object until segments change. */
  getTimeMap: () => TimeMap;
}

export const EditorContext = createContext<EditorContextValue | null>(null);

export function useEditorContext(): EditorContextValue {
  const value = useContext(EditorContext);
  if (!value) throw new Error("useEditorContext must be used inside <EditorContext>");
  return value;
}

/**
 * Subscribes to a slice of editor state. The selector must return something
 * that already exists in the state (or a primitive): returning a freshly built
 * object each call would look like a change every time and re-render forever.
 */
export function useEditor<T>(selector: (state: EditorState) => T): T {
  const { store } = useEditorContext();
  const read = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, read, read);
}

export function usePlaying(): boolean {
  const { controller } = useEditorContext();
  return useSyncExternalStore(controller.subscribe, controller.getPlaying, controller.getPlaying);
}
