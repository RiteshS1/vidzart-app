"use client";

import {
  Captions as CaptionsIcon,
  ChevronLeft,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  HardDrive,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  MousePointer2,
  Music,
  Palette,
  Shapes,
  Sparkles,
  Type,
  Wand2,
} from "lucide-react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { applyAutoZooms, discardEdits } from "@/lib/editor/actions";
import { saveProjectAssets, saveProjectEdits } from "@/lib/storage/projects";
import { AssetStore, assetPaths } from "@/lib/editor/assets";
import { EditorStore } from "@/lib/editor/store";
import { cursorTrackCache } from "@/lib/effects/cursorTrack";
import { createCursorLookup } from "@/lib/events/cursor";
import type { VidzEvents } from "@/lib/events/types";
import { PlaybackController } from "@/lib/playback/PlaybackController";
import type { VidzProject } from "@/lib/project/types";
import { buildTimeMap, type TimeMap } from "@/lib/timeline/timeMap";
import { EditorContext, useEditor, useEditorContext, type EditorContextValue } from "./EditorContext";
import { ExportDialog } from "./ExportDialog";
import { PreviewCanvas } from "./PreviewCanvas";
import { AiPanel } from "./AiPanel";
import { ConfirmDialog } from "./ConfirmDialog";
import { Menu, MenuItem, MenuSeparator } from "./Menu";
import { AudioPanel } from "./AudioPanel";
import { CaptionsTool } from "./CaptionsTool";
import { EffectsPanel } from "./EffectsPanel";
import { SelectedSegmentInspector } from "./RangeInspectors";
import { CursorPanel, SettingsPanel } from "./SettingsPanel";
import { button, primaryButton } from "./styles";
import { ShapePanel } from "./ShapeTools";
import { TextPanel } from "./TextTools";
import { Timeline } from "./Timeline";
import { Transport } from "./Transport";
import { useAutosave } from "./useAutosave";
import { useEditorShortcuts } from "./useEditorShortcuts";
import { useMusicPreview } from "./useMusicPreview";

export interface Session {
  /** What the user opened (a video or a .vidz), for display and file names. */
  name: string;
  video: File;
  url: string;
  project: VidzProject;
  /** The cursor/click log, if the project came from the extension. */
  events: VidzEvents | null;
  /** Id of the copy saved in this browser (autosave); null until it exists or if saving failed. */
  storedId: string | null;
  /** Add automatic zooms as soon as the editor opens (fresh extension recordings). */
  autoZoomOnOpen: boolean;
  /** Files under assets/ (music…), as loaded; edited through the AssetStore. */
  assets: Record<string, Blob>;
}

export function Workspace({
  session,
  onClose,
  onRename,
  onDeleted,
}: {
  session: Session;
  onClose: () => void;
  onRename: (name: string) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  // One store per opened file (the parent re-mounts us with a new `key`).
  const [store] = useState(() => new EditorStore(session.project));
  const [assets] = useState(() => new AssetStore(session.assets));
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
    return {
      store,
      assets,
      video,
      getTimeMap,
      cursorAt,
      getCursorTrack,
      controller: new PlaybackController(video, getTimeMap),
    };
  }, [store, assets, video, session.events, session.project.source.eventsOffsetMs]);

  return (
    <>
      {/* Hidden: we only draw its frames onto the canvas. Audio still plays. */}
      <video ref={setVideo} src={session.url} preload="auto" playsInline className="hidden" />
      {value && (
        <EditorContext value={value}>
          <TopBar session={session} onClose={onClose} onRename={onRename} onDeleted={onDeleted} />
          <EditorLayout value={value} session={session} />
        </EditorContext>
      )}
    </>
  );
}

function TopBar({
  session,
  onClose,
  onRename,
  onDeleted,
}: {
  session: Session;
  onClose: () => void;
  onRename: (name: string) => void | Promise<void>;
  onDeleted: () => void | Promise<void>;
}) {
  const { store, assets } = useEditorContext();
  const autosave = useAutosave(store, assets, session.storedId);
  const [status, setStatus] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [dialog, setDialog] = useState<"rename" | "discard" | "delete" | null>(null);
  const clickCount = useMemo(
    () => session.events?.events.filter((e) => e.type === "click").length ?? 0,
    [session.events],
  );
  const hasClicks = clickCount > 0;

  // Fresh extension recording: zoom on the clicks immediately (one undo
  // step). The ref guards against React StrictMode running effects twice in
  // development, which would add a second, identical undo step.
  const autoZoomed = useRef(false);
  useEffect(() => {
    if (!session.autoZoomOnOpen || !session.events || autoZoomed.current) return;
    autoZoomed.current = true;
    const n = applyAutoZooms(store, session.events);
    setStatus(n === 0 ? "No clicks to zoom on" : `Added ${n} automatic zoom${n === 1 ? "" : "s"} · Undo to remove`);
  }, [session.autoZoomOnOpen, session.events, store]);

  // "Save in this browser": the project is autosaved all the time; this
  // writes any pending change right now and says so.
  const saveInBrowser = async () => {
    if (!session.storedId) {
      setStatus("Couldn't save in this browser (storage unavailable). Use Download instead.");
      return;
    }
    setStatus("Saving…");
    try {
      const project = store.getState().project;
      await saveProjectEdits(session.storedId, project);
      await saveProjectAssets(session.storedId, assets.referencedBy(assetPaths(project)));
      setStatus("Saved in this browser. Find it under Projects.");
    } catch {
      setStatus("Couldn't save in this browser. Use Download instead.");
    }
  };

  const autosaveText =
    autosave === "saving" ? "Saving…" : autosave === "saved" ? "Saved in this browser" : autosave === "error" ? "Couldn't save in this browser" : "";

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight" aria-label="Vidzart home">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent" aria-hidden>
          <Clapperboard className="size-4 text-accent-ink" />
        </span>
        <span className="hidden sm:inline">Vidzart</span>
      </Link>
      <span className="h-5 w-px bg-line" aria-hidden />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="truncate text-sm font-medium" data-testid="file-name" title={session.name}>
          {session.name}
        </span>
        <span className="flex gap-2 text-[11px] text-ink-muted">
          {session.events && (
            <span data-testid="click-count" title="From the extension's cursor/click log">
              {clickCount} click{clickCount === 1 ? "" : "s"} tracked
            </span>
          )}
          <span data-testid="autosave" title="Your edits are kept in this browser">
            {autosaveText}
          </span>
        </span>
      </div>
      {status && (
        <span className="hidden rounded-full bg-surface-2 px-3 py-1 text-xs text-ink-muted md:inline" role="status">
          {status}
        </span>
      )}
      <span className="flex-1" />
      {session.events && (
        <button
          type="button"
          className={button}
          disabled={!hasClicks}
          title={hasClicks ? "Regenerate zooms around your clicks" : "No clicks in the event log"}
          onClick={() => {
            const n = applyAutoZooms(store, session.events!);
            setStatus(n === 0 ? "No auto zooms to add" : `Added ${n} auto zoom${n === 1 ? "" : "s"}`);
          }}
        >
          <Sparkles className="size-4 text-accent" aria-hidden /> Auto zoom
        </button>
      )}
      <Menu
        label="Save"
        triggerClassName={button}
        trigger={
          <>
            <Save className="size-4" aria-hidden /> <span className="hidden lg:inline">Save</span>
          </>
        }
      >
        {(close) => (
          <>
            <MenuItem
              icon={<HardDrive className="size-4" />}
              title="Save in this browser"
              description="Keep the project (with all your edits) in your Projects list."
              onClick={() => {
                close();
                void saveInBrowser();
              }}
            />
            <MenuItem
              icon={<Download className="size-4" />}
              title="Download video…"
              description="Choose MP4, MOV or WebM and the quality."
              onClick={() => {
                close();
                setExporting(true);
              }}
            />
          </>
        )}
      </Menu>
      <Menu
        label="Project menu"
        triggerClassName={`${button} px-2`}
        trigger={<MoreHorizontal className="size-4" aria-hidden />}
      >
        {(close) => (
          <>
            <MenuItem
              icon={<Pencil className="size-4" />}
              title="Rename project"
              onClick={() => {
                close();
                setDialog("rename");
              }}
            />
            <MenuItem
              icon={<FolderOpen className="size-4" />}
              title="All projects"
              description="Close this project; it stays saved in your browser."
              onClick={() => {
                close();
                onClose();
              }}
            />
            <MenuSeparator />
            <MenuItem
              icon={<RotateCcw className="size-4" />}
              title="Discard all edits…"
              description="Back to the original recording. You can undo this."
              onClick={() => {
                close();
                setDialog("discard");
              }}
            />
            <MenuItem
              icon={<Trash2 className="size-4" />}
              danger
              title="Delete project…"
              description="Removes it from this browser."
              onClick={() => {
                close();
                setDialog("delete");
              }}
            />
          </>
        )}
      </Menu>
      <button type="button" className={primaryButton} onClick={() => setExporting(true)} aria-label="Export video">
        <Film className="size-4" aria-hidden /> Export
      </button>
      {dialog === "rename" && (
        <ConfirmDialog
          title="Rename project"
          confirmLabel="Rename"
          input={{ label: "Project name", initial: session.name.replace(/\.[^.]+$/, "") }}
          onCancel={() => setDialog(null)}
          onConfirm={async (name) => {
            await onRename(name);
            setDialog(null);
          }}
        />
      )}
      {dialog === "discard" && (
        <ConfirmDialog
          title="Discard all edits?"
          description="Cuts, zooms, text, shapes, effects, captions and music are removed and the look goes back to the default. Your recording stays. You can undo this right after."
          confirmLabel="Discard edits"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            discardEdits(store);
            setDialog(null);
            setStatus("Edits discarded · Undo brings them back");
          }}
        />
      )}
      {dialog === "delete" && (
        <ConfirmDialog
          title="Delete this project?"
          description="It's removed from this browser, including the recording and all edits. This can't be undone."
          confirmLabel="Delete project"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={async () => {
            await onDeleted();
          }}
        />
      )}
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

type ToolId = "style" | "text" | "shapes" | "effects" | "audio" | "cursor" | "captions" | "ai";

function EditorLayout({ value, session }: { value: EditorContextValue; session: Session }) {
  useEditorShortcuts(value);
  useMusicPreview(value, session.video);
  const { controller } = value;
  useEffect(() => () => controller.pause(), [controller]);

  return (
    // Respect the OS "reduce motion" setting for every Motion animation below.
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <main className="flex min-h-[260px] min-w-0 flex-1 flex-col bg-bg">
          <div className="flex min-h-0 flex-1 p-4 lg:p-6">
            <PreviewCanvas />
          </div>
          <div className="flex justify-center px-4 pb-3">
            <Transport />
          </div>
        </main>
        <SidePanel session={session} />
      </div>
      <div className="shrink-0 border-t border-line bg-surface px-3 pt-2 pb-3">
        <Timeline source={session.video} />
      </div>
    </MotionConfig>
  );
}

/**
 * Everything to edit lives on the right: the panel, then the tool rail at
 * the window's edge. When something is selected on the timeline (a zoom,
 * text, shape…), the panel shows its settings instead of the tool; closing
 * it (or picking a tool) goes back.
 *
 * Every tool panel stays mounted (just hidden), so a running AI task or a
 * half-typed caption survives switching tools or selecting things.
 */
function SidePanel({ session }: { session: Session }) {
  const { store, cursorAt } = useEditorContext();
  const [tool, setTool] = useState<ToolId>("style");
  const selected = useEditor((s) => s.project.segments.find((x) => x.id === s.selectedSegmentId) ?? null);
  const inspecting = selected !== null && selected.type !== "trim";
  const tools: { id: ToolId; label: string; icon: typeof Palette; available: boolean }[] = [
    { id: "style", label: "Style", icon: Palette, available: true },
    { id: "text", label: "Text", icon: Type, available: true },
    { id: "shapes", label: "Shapes", icon: Shapes, available: true },
    { id: "effects", label: "Effects", icon: Wand2, available: true },
    { id: "audio", label: "Audio", icon: Music, available: true },
    // Only recordings with a click log have a cursor to draw.
    { id: "cursor", label: "Cursor", icon: MousePointer2, available: Boolean(cursorAt) },
    { id: "captions", label: "Captions", icon: CaptionsIcon, available: true },
    { id: "ai", label: "AI", icon: Sparkles, available: true },
  ];

  return (
    <div className="flex min-h-0 shrink-0 flex-col-reverse border-line lg:flex-row lg:border-l">
      <section
        aria-label="Tool settings"
        className="relative max-h-[40vh] min-h-0 overflow-y-auto bg-surface lg:max-h-none lg:w-80"
      >
        <AnimatePresence initial={false}>
          {inspecting && (
            <motion.aside
              key="inspector"
              aria-label="Inspector"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16, transition: { duration: 0.1 } }}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className="absolute inset-0 z-10 overflow-y-auto bg-surface p-4"
            >
              <button
                type="button"
                className="mb-3 flex cursor-pointer items-center gap-1 text-xs text-ink-muted hover:text-ink"
                onClick={() => store.setUi({ selectedSegmentId: null })}
              >
                <ChevronLeft className="size-3.5" aria-hidden /> Back to {tools.find((t) => t.id === tool)?.label}
              </button>
              <SelectedSegmentInspector />
            </motion.aside>
          )}
        </AnimatePresence>
        <div className="p-4" aria-hidden={inspecting || undefined}>
          <ToolPanel id="style" active={tool}>
            <SettingsPanel />
          </ToolPanel>
          <ToolPanel id="text" active={tool}>
            <TextPanel />
          </ToolPanel>
          <ToolPanel id="shapes" active={tool}>
            <ShapePanel />
          </ToolPanel>
          <ToolPanel id="effects" active={tool}>
            <EffectsPanel />
          </ToolPanel>
          <ToolPanel id="audio" active={tool}>
            <AudioPanel />
          </ToolPanel>
          {cursorAt && (
            <ToolPanel id="cursor" active={tool}>
              <CursorPanel />
            </ToolPanel>
          )}
          <ToolPanel id="captions" active={tool}>
            <CaptionsTool video={session.video} name={session.name} />
          </ToolPanel>
          <ToolPanel id="ai" active={tool}>
            <AiPanel video={session.video} />
          </ToolPanel>
        </div>
      </section>
      <nav
        role="tablist"
        aria-label="Tools"
        aria-orientation="vertical"
        className="flex shrink-0 gap-1 overflow-x-auto border-line bg-surface p-2 lg:w-[72px] lg:flex-col lg:border-l"
      >
        {tools
          .filter((t) => t.available)
          .map(({ id, label, icon: Icon }) => {
            const active = tool === id && !inspecting;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={`tool-${id}`}
                aria-selected={tool === id}
                aria-controls={`panel-${id}`}
                onClick={() => {
                  setTool(id);
                  // Picking a tool leaves the selected item's settings.
                  if (inspecting) store.setUi({ selectedSegmentId: null });
                }}
                className={`flex min-w-14 cursor-pointer flex-col items-center gap-1 rounded-lg px-1 py-2 text-[11px] font-medium transition-colors duration-150 ${
                  active ? "bg-surface-3 text-ink" : "text-ink-muted hover:bg-surface-2 hover:text-ink"
                }`}
              >
                <Icon className={`size-5 ${active ? "text-accent" : ""}`} aria-hidden />
                {label}
              </button>
            );
          })}
      </nav>
    </div>
  );
}

function ToolPanel({ id, active, children }: { id: ToolId; active: ToolId; children: React.ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tool-${id}`} hidden={id !== active}>
      {children}
    </div>
  );
}
