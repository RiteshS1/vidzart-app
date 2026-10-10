"use client";

import { useEffect } from "react";
import {
  addZoomAt,
  cutSelectedRange,
  removeSelectedSegment,
  trimEndFrom,
  trimStartTo,
} from "@/lib/editor/actions";
import type { EditorContextValue } from "./EditorContext";

/**
 * Space play/pause · ←/→ ±1s (Shift ±5s) · Home/End · [ / ] trim start/end ·
 * Z add zoom · Delete cut selection / delete selected segment · ⌘Z / ⇧⌘Z undo/redo
 */
export function useEditorShortcuts({ store, controller, getTimeMap }: EditorContextValue) {
  useEffect(() => {
    const isTyping = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        (target.tagName === "INPUT" && (target as HTMLInputElement).type !== "range" && (target as HTMLInputElement).type !== "checkbox"));

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTyping(event.target)) return;
      const mod = event.metaKey || event.ctrlKey;

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
      }
      if (mod || event.altKey) return;

      const step = event.shiftKey ? 5_000 : 1_000;
      switch (event.key) {
        case " ":
          // preventDefault also stops a focused button from being "clicked"
          // by Space, which would toggle twice.
          event.preventDefault();
          controller.toggle();
          break;
        case "ArrowLeft":
        case "ArrowRight": {
          if (event.target instanceof HTMLInputElement && event.target.type === "range") return;
          event.preventDefault();
          const delta = event.key === "ArrowLeft" ? -step : step;
          controller.seekOutput(controller.getOutputTime() + delta);
          break;
        }
        case "Home":
          event.preventDefault();
          controller.seekOutput(0);
          break;
        case "End":
          event.preventDefault();
          controller.seekOutput(getTimeMap().outputDuration);
          break;
        case "[":
          trimStartTo(store, controller.getSourceTime());
          break;
        case "]":
          trimEndFrom(store, controller.getSourceTime());
          break;
        case "Delete":
        case "Backspace":
          if (cutSelectedRange(store) || removeSelectedSegment(store)) event.preventDefault();
          break;
        case "z":
        case "Z":
          addZoomAt(store, controller.getSourceTime());
          break;
        case "Escape":
          store.setUi({ range: null, selectedSegmentId: null });
          break;
      }
    };
    // Space activates a focused button on keyup; swallow that too.
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === " " && !isTyping(event.target)) event.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [store, controller, getTimeMap]);
}
