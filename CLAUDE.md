# vidzart-app

The Vidzart **web app**: landing page, local dashboard and the editor. This repo is developed and
published on its own; this file is meant to be all the context you need. The companion repo is
`vidzart-extension` (the Chrome recorder that produces `.vidz` files).

## What Vidzart is

A screen recorder + editor for polished product demos and tutorials (think Cursorful / Screen
Studio). Record your screen, and the editor adds smooth zooms that follow clicks and the cursor, a
nice background, a smoothed cursor and click effects. Then you export a clean MP4.

AI-assisted editing is **optional and cheap**: on-device first (Whisper captions, silence/filler
removal, zoom suggestions), then **bring-your-own-key** online models (chapters, titles,
summaries, rewrites, translations).

**Completely free.** No accounts, no cloud, no paid tier, no Vidzart backend. The app is a
static site. Support is an optional "Buy me a coffee" link.

## Principles

- **Local-first and private.** Videos, projects and API keys never leave the device.
- **Non-destructive.** The original video is never modified. Project = video + events + segments;
  output is rendered at export.
- **60fps preview.** Heavy work in Web Workers. **Never put the playhead or per-frame values in
  React state.** Use refs, `requestAnimationFrame` and canvas. React state is for human-speed UI.
- **Readable, explained code.** The author is learning this domain: comments explain *why*, and
  lessons go into `LEARNINGS.md`.

## Tech stack

Verified with `npm view` on 2026-10-11. Re-check when scaffolding.

- **Next.js 16.4 (App Router)** with **static export** (`output: "export"`). No API routes, server
  actions or middleware: there is no server.
- **React 19.3**, **TypeScript** strict (7.0.2 is latest; confirm Next supports it, else latest
  5.x), **Tailwind CSS 4.3**.
- **Canvas 2D** for preview (WebGL later only if profiling shows we need it).
- **WebCodecs** (`VideoDecoder` / `VideoEncoder`) + **Mediabunny 1.61** for demux/mux → MP4.
- **Web Workers** for decode, thumbnails, export, transcription.
- **OPFS** (Origin Private File System) for large video blobs; **IndexedDB** for project
  metadata/list.
- **`@huggingface/transformers` 4.3** for in-browser Whisper (Phase 6).
- **pnpm**.

## Planned structure

Not scaffolded yet. This is the target layout:

```
src/
  app/
    (marketing)/page.tsx   landing page
    dashboard/             list of local projects (from IndexedDB)
    editor/                client-only editor (see below)
  lib/
    project/               .vidz types, zip read/write, validation, migrations
    timeline/              sourceToOutput / outputToSource time mapping (trims, speed)
    render/                renderFrame(t, project, ctx): pure, shared by preview AND export
    effects/               zoom easing, cursor smoothing, click effects
    storage/               OPFS + IndexedDB helpers
    ai/                    on-device (Whisper) + BYOK provider clients
  workers/                 decode, thumbnails, export, whisper
```

### Key design decisions

- **Editor is client-only.** Browser media APIs don't exist during prerendering. The editor page
  is a `"use client"` component that loads the heavy editor with `next/dynamic(..., { ssr: false })`.
- **One render function.** `renderFrame(time, project, ctx)` draws background → padded,
  rounded, shadowed video frame (with zoom transform) → cursor → click effects. Preview calls it
  every rAF tick; export calls it per output frame in a worker (`OffscreenCanvas`). Same code
  means the preview matches the export.
- **Playback loop.** A rAF loop reads the current time from a ref (or the `<video>` element) and
  calls `renderFrame`. UI that shows time (timecode, playhead line) updates via refs/DOM writes
  or its own canvas, not `setState`.
- **Time mapping.** Trims and speed segments make output time differ from source time. All code
  converts through `lib/timeline`; never hand-roll offsets.
- **Export pipeline.** Export worker: demux source (Mediabunny) → `VideoDecoder` → `renderFrame`
  on `OffscreenCanvas` → `VideoEncoder` (H.264) → Mediabunny MP4 muxer. Audio is re-encoded
  (AAC) or passed through, honoring trims/speed.
- **Plain videos.** Any video file can be opened; with no `events.json`, auto-zoom and cursor
  effects are disabled but everything else works.

### Cross-origin isolation (COOP/COEP)

Whisper's multi-threaded WASM and `SharedArrayBuffer` need the page to be **cross-origin
isolated**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp   (or "credentialless")
```

- **Side effect:** once enabled, the page **can't load cross-origin images, fonts, scripts or
  media unless they send CORP (`Cross-Origin-Resource-Policy`) or CORS headers.** Third-party
  fonts/images/embeds can silently break. `credentialless` is gentler (no-cors requests are sent
  without cookies instead of being blocked); check browser support before choosing it.
- Consider enabling it **only on the editor route**, so the landing page stays unaffected.
- With static export, `next.config` `headers()` **does not apply** in production. Headers must be
  set by the static host (e.g. a `_headers` file or host config). They do apply in `next dev`.
- Not needed until Phase 6. Don't enable earlier "just in case".

## BYOK (bring your own key) AI

- Keys are stored **only in the browser** (IndexedDB or localStorage), with a clear **"Stored on
  this device only"** note in the UI and a way to remove them.
- Keys are **never sent to any Vidzart server** (there isn't one). Calls go **directly from the
  browser to the provider**.
- **CORS:** some providers block direct browser requests or need a special opt-in header. Check
  each provider before adding it, and note the result in `LEARNINGS.md`. No proxy server.
- AI is always optional; the editor must work fully without a key.

<!-- BEGIN VIDZ SPEC -->
## Project file format (`.vidz`)

> **This spec is duplicated in 3 files** (`vidzart/CLAUDE.md`, `vidzart-app/CLAUDE.md`,
> `vidzart-extension/CLAUDE.md`). **If you change it, update all three and keep them identical.**
> Everything between the `BEGIN VIDZ SPEC` / `END VIDZ SPEC` markers is the shared part.

A `.vidz` file is a **zip archive** that holds one project. The original recording inside it is
never modified. Edits live in `project.json`, and the final video is rendered from
`video + events + project` at export time.

### Archive layout

```
my-demo.vidz  (zip)
├── manifest.json     required. Read this first.
├── video.webm        required. The raw recording (or video.mp4 for imported files)
├── events.json       optional. Cursor/click log; missing for plain imported videos
├── project.json      required. Edit settings + segments
└── assets/           optional. e.g. a custom background image
```

- Store the video entry **without compression** (zip "STORE" method). It's already compressed, so
  deflating it costs CPU and gains nothing.
- File names inside the zip are fixed by `manifest.json`; readers must not guess them.

### Common rules (all JSON files)

- Every JSON file has an integer `version` field. Current version for all files: **1**.
- **Times** are milliseconds (numbers, may be fractional) on the **source** timeline, i.e. the
  original recording, before trims/speed changes.
- A **reader** migrates older versions forward through a chain of `migrateVnToVn+1` functions and
  **refuses** files with a newer version than it understands (with a clear "update Vidzart"
  message).
- **Adding** an optional field that has a default value does **not** bump the version.
  Renaming/removing fields or changing their meaning **does**.
- A writer preserves unknown fields it read, so an older app doesn't destroy newer data.

### `manifest.json`

```ts
interface VidzManifest {
  format: "vidzart-project"; // magic string: lets us reject random zips early
  version: 1;
  createdAt: string;         // ISO 8601, e.g. "2026-10-11T09:30:00.000Z"
  createdBy: { app: "vidzart-extension" | "vidzart-app"; version: string };
  files: {
    video: string;           // "video.webm" | "video.mp4"
    events?: string;         // "events.json", absent if there is no event log
    project: string;         // "project.json"
  };
}
```

### `events.json`: the input log recorded alongside the video

```ts
interface VidzEvents {
  version: 1;
  viewport: { width: number; height: number; devicePixelRatio: number }; // at recording start
  startedAt: number; // zero point, see "Clock sync" below
  events: VidzEvent[]; // sorted by t ascending
}

type VidzEvent =
  | { t: number; type: "move";   x: number; y: number }
  | { t: number; type: "down";   x: number; y: number; button: 0 | 1 | 2 } // left|middle|right
  | { t: number; type: "up";     x: number; y: number; button: 0 | 1 | 2 }
  | { t: number; type: "click";  x: number; y: number; button: 0 | 1 | 2 }
  | { t: number; type: "scroll"; x: number; y: number; scrollX: number; scrollY: number }
  | { t: number; type: "key";    x: number; y: number; combo: string } // e.g. "Meta+Shift+K"
  | { t: number; type: "resize"; width: number; height: number; devicePixelRatio: number };
```

- `t`: ms since `startedAt` (can be negative for events logged a moment before the recorder
  started; readers drop or clamp those).
- `x`, `y`: **viewport CSS pixels** (`clientX` / `clientY`), not `pageX` / `pageY`. The video shows
  the viewport, so scroll offset must not be baked into cursor positions. For `scroll` and `key`,
  `x`/`y` are the last known pointer position, and `scrollX`/`scrollY` are the page's scroll
  offsets after the scroll.
- `move` events are throttled to at most one per animation frame (~60/s) to keep the file small.
  Smoothing happens in the editor, not at capture time.
- **Key privacy rule:** `key` events are only recorded for **shortcuts that include Ctrl, Meta or
  Alt** (for showing "⌘K"-style badges). Plain typed characters, including Shift+letter, are
  **never** recorded, so passwords and messages typed during a demo never end up in the file.
- `resize` records a viewport change (window resize or browser zoom). It changes the coordinate
  mapping from that moment on.
- Known limitation: events inside cross-origin iframes are not visible to the top-frame logger.

#### Clock sync

The video is recorded in the extension's **offscreen document**, while events come from a
**content script** in the page. Those are two different JS contexts, and each one's
`performance.now()` counts from its own `performance.timeOrigin`, so raw `now()` values can't be
compared.

Mitigation: **both sides timestamp with `performance.timeOrigin + performance.now()`**, a
high-resolution "epoch ms" that is comparable across contexts on the same machine (to within a
few ms).

- The recorder captures that value when `MediaRecorder` fires its `start` event and stores it
  as `events.json.startedAt`. That's the zero point.
- The content script stamps each event with the same formula; on save,
  `t = eventStamp - startedAt`.
- Any small residual offset (encoder latency before the first frame) can be corrected per project
  with `project.json.source.eventsOffsetMs` (default `0`).

#### Coordinate mapping: CSS px → video px

```
sx = videoWidth  / viewport.width      // using the viewport from the latest resize at time t
sy = videoHeight / viewport.height
videoX = x * sx
videoY = y * sy
```

Don't just multiply by `devicePixelRatio`. Tab capture can scale the video (capture constraints,
max resolution), so the ratio has to come from the **actual decoded video size**. Browser zoom
changes CSS px too, which is why `resize` events carry `devicePixelRatio`.

### `project.json`: edit decisions

```ts
interface VidzProject {
  version: 1;
  source: {
    duration: number;        // ms
    width: number;           // decoded video px
    height: number;
    fps: number;             // nominal; recordings are often variable frame rate
    eventsOffsetMs?: number; // default 0, shifts all event times (see Clock sync)
  };
  settings: {
    aspectRatio: "source" | "16:9" | "9:16" | "1:1" | "4:3";
    background:
      | { type: "color"; color: string }                          // CSS color
      | { type: "gradient"; from: string; to: string; angle: number } // angle in degrees
      | { type: "image"; src: string };   // "assets/bg.png" in the zip, or "builtin:<id>"
    padding: number;      // fraction of the output canvas's shorter side, 0–0.5
    cornerRadius: number; // same unit as padding
    shadow: { enabled: boolean; blur: number; opacity: number; offsetY: number }; // blur/offsetY: same unit as padding
    cursor: { visible: boolean; scale: number; smoothing: number; hideWhenIdleMs?: number }; // smoothing 0–1
    clickEffect: { type: "none" | "ripple" | "pulse"; color: string };
  };
  segments: Segment[];
}

type Segment =
  | { id: string; type: "zoom"; start: number; end: number;
      scale: number;                                  // >= 1, e.g. 2 = 2x
      target: { mode: "fixed"; x: number; y: number } // normalized 0–1 of the source frame
            | { mode: "follow" };                     // follow the cursor from events.json
      easeInMs: number; easeOutMs: number;
      origin?: "manual" | "auto" }                    // auto = generated from events
  | { id: string; type: "trim";  start: number; end: number }  // range is cut out
  | { id: string; type: "speed"; start: number; end: number; rate: number } // 2 = twice as fast
  | { id: string; type: "blur";  start: number; end: number;
      rect: { x: number; y: number; width: number; height: number } }  // normalized 0–1
```

- `start` / `end` are source-timeline ms, `start < end`.
- `zoom`, `trim` and `speed` segments must not overlap others **of the same type**. `blur`
  segments may overlap.
- Positions and sizes are **normalized** (0–1 of the source frame, or a fraction of the output's
  shorter side), so a project renders the same at 720p and 4K.
- `id` is a random unique string (e.g. `crypto.randomUUID()`).
- **Output time ≠ source time.** Trims remove time and speed segments stretch it. The editor
  keeps one mapping function `sourceToOutput(t)` / `outputToSource(t)` and everything (timeline,
  preview, export) goes through it.
<!-- END VIDZ SPEC -->

## Commands

To be filled in once Next.js is scaffolded (`pnpm dev`, `pnpm build`, `pnpm lint`,
`pnpm typecheck`).

## Conventions

- TypeScript strict. No `any` without a comment explaining why.
- Small, focused commits with clear messages.
- Non-trivial lessons (media timing, coordinate mapping, encoding) → `LEARNINGS.md`.

## Roadmap (this repo)

- [ ] **Phase 0:** Web recorder spike (`getDisplayMedia` + `MediaRecorder` + download).
- [ ] **Phase 1:** Editor core: load video, canvas preview with background/padding/rounded
      corners, playback controls, trim, timeline.
- [ ] **Phase 2:** Zoom segments: manual zooms with easing, then auto zooms from `events.json`.
- [ ] **Phase 3:** MP4 export in a Web Worker with WebCodecs.
- [ ] **Phase 4:** Open `.vidz` files produced by the extension.
- [ ] **Phase 5:** Cursor smoothing and click effects from the event log.
- [ ] **Phase 6:** AI: in-browser captions, silence/filler removal, then BYOK features.
- [ ] **Later:** direct handoff from the extension, "Buy me a coffee" link.

**Not planned:** accounts/auth, cloud storage, share links, payments, Vidzart-hosted AI.

**Current phase:** none started. Next step is scaffolding Next.js, then Phase 0.
