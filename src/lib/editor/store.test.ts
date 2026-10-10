import { describe, expect, it, vi } from "vitest";
import { createProject } from "@/lib/project/defaults";
import { EditorStore } from "./store";

const project = () => createProject({ duration: 10_000, width: 1280, height: 720, fps: 30 });

describe("EditorStore", () => {
  it("notifies subscribers and supports undo/redo", () => {
    const store = new EditorStore(project());
    const listener = vi.fn();
    store.subscribe(listener);

    store.edit((p) => ({ ...p, settings: { ...p.settings, padding: 0.2 } }));
    expect(store.getState().project.settings.padding).toBe(0.2);
    expect(listener).toHaveBeenCalledTimes(1);

    store.undo();
    expect(store.getState().project.settings.padding).toBe(0.08);
    store.redo();
    expect(store.getState().project.settings.padding).toBe(0.2);
  });

  it("coalesces rapid edits with the same key into one undo step", () => {
    const store = new EditorStore(project());
    for (const padding of [0.1, 0.12, 0.14, 0.16]) {
      store.edit((p) => ({ ...p, settings: { ...p.settings, padding } }), { coalesceKey: "padding" });
    }
    store.undo();
    expect(store.getState().project.settings.padding).toBe(0.08);
    expect(store.getState().canUndo).toBe(false);
  });

  it("clears redo history after a new edit", () => {
    const store = new EditorStore(project());
    store.edit((p) => ({ ...p, segments: [] }));
    store.edit((p) => ({ ...p, settings: { ...p.settings, padding: 0.3 } }));
    store.undo();
    expect(store.getState().canRedo).toBe(true);
    store.edit((p) => ({ ...p, settings: { ...p.settings, padding: 0.1 } }));
    expect(store.getState().canRedo).toBe(false);
  });

  it("ignores no-op edits", () => {
    const store = new EditorStore(project());
    store.edit((p) => p);
    expect(store.getState().canUndo).toBe(false);
  });
});
