# Learnings

A log of bugs I hit and what I learned, especially the non-obvious stuff (media timing,
coordinate mapping, encoding, browser/extension quirks). Newest entries at the top.

## Template

```md
### YYYY-MM-DD: Short title
- **Symptom:** what I saw
- **Cause:** what was actually going on
- **Fix:** what I changed (commit hash if useful)
- **What I learned:** the general lesson, in my own words
- **Links:** docs, issues, articles
```

## Log

### 2026-10-12: Music "breaking every second" (decoder restarts)
- **Symptom:** with background music added, the export's sound broke up once per second.
- **Cause:** the mixer works in 1 s blocks and asked Mediabunny for each block's source audio
  separately (`sink.samples(s0, s1)` per block). Every call starts a new decode, and Opus needs a
  little "pre-roll" to converge after a restart, so each block began with a glitch. Measured on a
  pure tone: jumps of 0.04–0.18 exactly at 1.044 s, 2.044 s… (the 44 ms is AAC priming).
- **Fix:** one continuous decode pass per kept piece; a decoded chunk that straddles a block
  boundary is carried over to the next block. Also `audio.loop` in the preview so short tracks
  wrap without a seek gap. A test now exports a tone and fails on any sample-to-sample jump.
- **What I learned:** with lossy audio codecs, don't seek-and-decode in small windows; stream.

### 2026-10-12: Phase 7 (editor features, design pass)
- **Two coordinate spaces, on purpose.** Blur boxes and shapes live in SOURCE frame space (they
  stick to the recorded content and move with zooms); text overlays live in OUTPUT canvas space
  (a title stays put while the camera moves). Picking the wrong one makes annotations drift.
- **Single-frame transitions.** The export decodes exactly one source frame per output frame.
  Dip-to-black, blur and zoom-punch only need that frame; a crossfade would need two. Choosing
  effects that fit the pipeline beat rewriting it.
- **Mix audio in blocks, not whole files.** Background music + the recording's kept pieces are
  mixed 1 s at a time (decode just that block's source audio, add music × volume × fades × duck),
  so memory is flat for long videos. Ducking reuses the silence detector's loudness analysis.
- **IndexedDB read-modify-write must be one transaction.** Saving edits and saving assets each
  read the record and wrote it back; interleaved, one could erase the other. `get` + `put` inside
  a single readwrite transaction makes each update atomic.
- **Workers can't use the page's web fonts.** Text overlays use system font stacks so the export
  (OffscreenCanvas in a worker) renders the same glyphs as the preview.
- **A live demo beats a video.** The landing hero runs the real `renderFrame` + auto zoom on a
  mock app drawn on a canvas with a scripted user: no asset to host, always in sync with the code.
- **Accessible names include visible values.** A slider labelled "Strength 70%" can't be found by
  an exact "Strength" label; tests use `getByRole("slider", { name: /^Strength/ })`.

### 2026-10-12: Editors show output time; cameras need a dead zone
- **Feedback:** after cutting, the cut part stayed on the timeline (hatched), which felt broken:
  in every video editor a cut is *gone*. The fix was conceptual: lay the timeline out in OUTPUT
  time. Segments stay stored in source time; every block is placed with `sourceToOutput` and
  every pointer position maps back with `outputToSource`. A cut becomes a zero-width seam.
- **Zooms "not happening":** they only appeared after pressing Auto zoom. Cursorful-style tools
  zoom automatically, so fresh extension recordings now get them on open (flag from the
  `.vidz` manifest's `createdBy`, so reopening an edited project doesn't re-add deleted ones).
- **Following the cursor naively is nauseating:** every hand tremor shakes the frame. A dead zone
  (move only when the cursor leaves the middle 50% of the view) plus a critically damped spring
  (`a = ω²(target − x) − 2ωv`: fastest approach with no overshoot) gives the calm "camera
  operator" pan. Simulated once per zoom at 60 Hz so preview and export match exactly.
- **Double/triple clicks:** group by button presses (`down`), not `click` events.

### 2026-10-12: Phase 6 (on-device AI and BYOK)
- **CORS per provider (checked with a preflight, no key needed):**
  `curl -X OPTIONS <url> -H "Origin: http://localhost:3000" -H "Access-Control-Request-Method: POST"
  -H "Access-Control-Request-Headers: authorization,content-type"`. All six (Anthropic, OpenAI,
  Gemini, Groq, OpenRouter, Mistral) allow browser calls; Anthropic additionally needs the
  `anthropic-dangerous-direct-browser-access: true` header. A preflight only needs the server's
  CORS config, so you can check before you even have a key.
- **Digital silence breaks adaptive thresholds.** "Cut silences" cut 1.6 s of a 2.5 s pause:
  exact zeros (-120 dB) dragged the 10th-percentile noise floor so low that the codec's faint
  noise in other silent parts counted as sound. Clamping the floor at -70 dB fixed it.
- **An edit that changes nothing must not create an Undo step.** Re-cutting already-cut
  silences rebuilt identical trims with new ids, so "Undo" seemed to do nothing. Compare
  meaningfully (total cut time), not by identity.
- **Whisper drops filler words.** Trained on cleaned transcripts, it usually writes "um, then
  open…" as "Then open…". So filler removal from transcripts is best effort, and the UI says so.
- **Keep heavy libraries out of the main bundle:** importing a constant (the model list) from
  the module that imports transformers.js would have pulled ~1 MB+ into every page. Constants
  live in their own module; the worker `import()`s transformers.js only when transcribing.
- **transformers.js loads ONNX Runtime's WASM from jsDelivr by default** (`wasmPaths`). That's
  code, not user data, but it's a third party; documented in CLAUDE.md.
- **Whisper reads ≤30 s at a time.** Cutting blindly every 30 s splits words; cutting at the
  quietest 20 ms window between 20 s and 29 s almost always lands between words.
- **`<details open={!key}>` collapses while you type the first character of the key.** Derived
  state that also changes from user input should be the user's state (`onToggle`), not derived.

### 2026-10-12: Drawing the cursor ourselves (Phase 5)
- **Tab capture has no mouse pointer** in the video; Chrome captures the page's pixels, and the
  pointer is drawn by the OS on top. So for extension recordings the editor draws one from
  `events.json`. That's a feature, not a workaround: we choose the path, so it can be smooth.
- **Smoothing vs clicks:** a centered moving average makes the cursor arrive at a button a bit
  late/early, so the click ripple appeared *next to* the cursor. Fix: near each press, blend
  from the smoothed position to the exact one (`weight = 1 - |t - tClick| / snapMs`, eased).
  Smooth between clicks, exact on them.
- **Sizes in recorded CSS px:** the arrow is ~20 CSS px of the recorded page, converted with
  `video.width / crop.width / viewport.width`, so it scales with zooms and resolution like the
  page itself. At scale 1 in a small preview it's honestly tiny (~8px), which is why there's a
  size slider.
- Ripples start on `down`, not `click` (which fires on release, ~100ms later): feels instant.
- Per-frame queries (`at`, `clicksIn`) are binary searches on arrays built once per
  (events, settings), cached in `cursorTrackCache`, never a scan per frame.

### 2026-10-12: Export pipeline with WebCodecs + Mediabunny
- Per output frame: output time → `outputToSource` → decoded frame → **the same `renderFrame`**
  as the preview on an `OffscreenCanvas` → `CanvasSource.add(t, 1/fps)` → H.264 in MP4.
  `samplesAtTimestamps` takes sorted timestamps and decodes each packet at most once.
- **Close every `VideoFrame`/sample right after use.** They hold decoder/GPU memory, and the
  decoder stalls when too many are open.
- **Feed video and audio concurrently** (`Promise.all`). The muxer interleaves tracks, so
  pushing all video first can block on backpressure waiting for audio.
- Audio chunks straddle cut points: `sample.trim(fromFrame, toFrame)` keeps the frames inside
  the kept piece, and `setTimestamp` moves them onto the output timeline.
- Verified independently: the e2e test reads the exported MP4 with Mediabunny in Node (codec,
  size, fps, duration) instead of trusting the UI.

### 2026-10-12: Web Workers in a Next.js static export
- `new Worker(new URL("../../workers/export.worker.ts", import.meta.url), { type: "module" })`
  works with Turbopack in dev and prod. In prod it's rewritten to a `turbopack-worker-*.js`
  bootstrap that loads compiled chunks.
- Scary-looking but harmless: `out/_next/static/media/export.worker.*.ts` (raw source) is also
  emitted, and hosts serve `.ts` as `video/mp2t`. It's unused. I proved it by running the e2e
  suite against `out/` served with host-like MIME types (`pnpm test:e2e:prod`).
- Lesson: dev mode and the production build can differ, so test the artifact you ship.

### 2026-10-12: Zoom as a camera crop
- A zoom crops the *source* (`drawImage` with a source rectangle) and stretches the crop over the
  same rounded frame; background and padding don't move. Visible size = 1/scale of the frame.
- The crop's center is clamped to `[half, 1 − half]` so it never shows past the frame's edges. A
  nice side effect: at scale ≈ 1 any target clamps to the middle, so zooming in from 1 naturally
  "travels" toward the target as the scale grows.
- Ease-in-out cubic for in/out. Segments shorter than easeIn + easeOut shrink both
  proportionally instead of jumping.

### 2026-10-12: A zip writer/reader in ~200 lines
- Zip = local headers + data, then a central directory pointing back at them, then an
  end-of-central-directory record found by scanning back from the end of the file.
- Video entries are STORED (uncompressed), so reading one is `file.slice(start, end)`, a
  zero-copy view instead of loading a multi-GB file into memory. JSON is DEFLATEd with the
  browser's built-in `CompressionStream("deflate-raw")`, which is exactly zip's format.
- CRC-32 is computed by streaming the Blob in chunks. Verified against `unzip -t`.
- TypeScript 5.9 gotcha: `new Blob([...])` rejects `Uint8Array<ArrayBufferLike>` (it could be a
  SharedArrayBuffer view); declare arrays as `Uint8Array<ArrayBuffer>[]`.

### 2026-10-12: Smoothing the cursor without lag
- Raw pointer events are irregular (bursts while moving, nothing at rest), so resample to a fixed
  60/s grid first, then smooth with a **centered** moving average (prefix sums, O(n)).
- A live app can only average the past, which lags. An editor knows the future, so averaging
  both sides is smooth *and* on time.
- Bug caught by a test: resampling with `floor((t1−t0)/step)+1` samples stopped up to one step
  before the last event, so the cursor never reached its final position. Use `ceil` and clamp.

### 2026-10-12: Auto zooms from clicks
- Group clicks close in time (≤ 2.5s) **and** space (≤ 35% of the frame); zoom in 0.8s before
  the first click so the ease-in has finished when the click happens, and hold 1.8s after.
- Cap the scale so all clicks in a group stay visible: visible size ≥ spread + margin, so
  scale ≤ 1 / (spread + margin).
- Regenerating replaces earlier *auto* zooms but never touches manual ones; they're added with
  `addZoom`, which only fills free gaps.

### 2026-10-12: Lint vs. one-shot handoffs in effects
- The React hooks lint flags calling `open()` (which sets state) inside an effect. The usual
  fix, deferring with `setTimeout`, would **lose** the recording in StrictMode dev: run 1 takes
  the one-shot handoff and schedules, the cleanup cancels the timer, and run 2 finds nothing.
  Kept the direct call with a documented `eslint-disable-next-line`.

### 2026-10-12: Editor state outside React (and the selector trap)
- **Problem:** the preview redraws up to 60×/s and needs the latest project, but React state
  would re-render the whole editor on every change and is awkward to read from a rAF loop.
- **Approach:** a tiny `EditorStore` with `getState()` + `subscribe()`. The loop reads
  `getState()`; components use `useSyncExternalStore` through `useEditor(selector)`.
- **Trap:** `useSyncExternalStore` compares snapshots with `Object.is`. A selector like
  `s => ({ a: s.x, b: s.y })` returns a new object every call, which React reads as "changed
  forever" and loops. Select existing values (`s => s.project.settings`) and derive with
  `useMemo`.
- **What I learned:** keep per-frame data out of React entirely; use React only for the shape
  of the UI.

### 2026-10-12: Previewing cuts with a plain `<video>`
- **Problem:** the `<video>` only knows the source timeline, but the preview must skip trimmed
  ranges and stop at a trimmed end.
- **Approach:** `PlaybackController.tick()` runs once per animation frame: inside a cut, jump to
  the next kept moment; past the last kept moment, pause; in a speed segment, set
  `playbackRate`. All decisions come from `timeMap.ts` (unit tested).
- **Limit:** up to one frame (~16ms) of a cut can show before the jump, plus seek latency.
  Fine for preview; the export decodes exact frames instead.
- **What I learned:** seeking a media element is async. `seeked` fires when the new frame is
  ready, which is the right moment to redraw a paused preview.

### 2026-10-12: Canvas shadows and rounded corners
- Canvas draws a shadow only *with* a shape, so we fill the rounded rect in black with
  `shadowBlur` set, then draw the video on top; only the shadow around it remains visible.
- Rounded video = `roundRect` + `clip()` then `drawImage`. `save()`/`restore()` around each step
  so shadow and clip settings don't leak into the next drawing.
- Sizes are fractions of the canvas's shorter side, so a 600px preview and a 4K export look the
  same. The canvas backing store is `cssSize × devicePixelRatio` to stay sharp on retina.

### 2026-10-12: Test races with toggling buttons
- **Symptom:** "playback stops at the end" passed instantly at 0:00.
- **Cause:** right after clicking Play, the Play button is still visible for a moment, so
  "wait until Play is visible" was already true.
- **Fix:** first wait for Pause (playback really started), then for Play (it stopped).
- **What I learned:** when waiting for a state, first confirm you left the previous one.

### 2026-10-12: Testing screen recording without a human
- **Symptom:** in Playwright, `getDisplayMedia()` never resolved (the picker waits for a click
  nobody makes). `--auto-select-tab-capture-source-by-title` picked a tab but failed with
  `NotReadableError: Could not start video source`, both headless and headed.
- **Cause:** the picker is deliberately human-only (a page must not record you silently). Real
  tab capture under automation didn't start a video source on this machine.
- **Fix:** `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream` gives a synthetic
  1280×720 "screen" stream. The "user cancelled" path is tested by making `getDisplayMedia`
  reject with a `NotAllowedError` DOMException, exactly what Chrome does on Cancel.
- **What I learned:** test media code with the browser's fake devices; test failure paths by
  reproducing the exact error the browser throws.

### 2026-10-12: "MediaRecorder WebM has no duration" is version-dependent
- **Symptom:** a test asserting `video.duration === Infinity` for a fresh recording failed:
  Chrome 154 reported `2.101`.
- **Cause:** newer Chrome writes the duration into the WebM it produces; older versions, other
  browsers, and recordings interrupted by a crash don't.
- **Fix:** removed the assertion and softened the spec wording. We still **measure** duration
  from the recorder's `start`/`stop` events instead of trusting the file.
- **What I learned:** don't encode folklore about browser behavior in tests; assert on our
  own guarantees instead.

### 2026-10-12: TypeScript's DOM types lag the platform
- **Symptom:** `selfBrowserSurface does not exist in type DisplayMediaStreamOptions`.
- **Cause:** `lib.dom.d.ts` only has `audio`/`video` for that type; Chrome supports more.
- **Fix:** `src/types/screen-capture.d.ts` uses declaration merging (`declare global { interface
  DisplayMediaStreamOptions { … } }`) to add the options, with links to the spec.
- **What I learned:** interfaces with the same name merge, so you can extend built-in DOM
  types without casting to `any`.

### 2026-10-11: Console errors that weren't ours (browser extensions)
- **Symptom:** in my everyday Chrome the page logged a hydration mismatch
  (`cz-shortcut-listen="true"` on `<body>`) plus two `Uncaught Object` exceptions, even on the
  static build.
- **Cause:** browser extensions. ColorZilla adds that attribute before React hydrates, and other
  extensions' content scripts throw in their own isolated JS world, so Chrome attributes the
  error to the page. Evidence: a bare HTML page had no errors; an `error`/`unhandledrejection`
  listener injected first in `<head>` caught nothing; a clean Chrome profile (DevTools protocol,
  no extensions) showed zero errors on both dev and build.
- **Fix:** `suppressHydrationWarning` on `<body>` (real users have these extensions too). The
  exceptions need no fix.
- **What I learned:** before debugging a console error, rule out the environment: reproduce
  in a clean profile or an incognito window with extensions disabled.
- **Links:** https://react.dev/link/hydration-mismatch

### 2026-10-11: Next.js 16.4 scaffold defaults vs. a static app
- **Symptom:** `create-next-app@16.4.0` turned on `cacheComponents` and `partialPrefetching`,
  installed TypeScript 5.9 even though 7.0 is the latest, and a fresh `tsc --noEmit` failed with
  `Cannot find name 'LayoutProps'`.
- **Cause:** (1) Those two flags are about caching data that is fetched **on the server** and
  streaming it in. A static export with no server data doesn't need them. (2) Next's template pins
  `typescript ^5`. (3) `LayoutProps` / `PageProps` are global types that Next **generates** into
  `.next/types/` during `dev` or `build`; on a clean checkout they don't exist yet.
- **Fix:** removed both flags and set `output: "export"`; kept TS 5.9; made the `typecheck`
  script `next typegen && tsc --noEmit`.
- **What I learned:** a framework's generator defaults reflect *its* typical app (server-rendered),
  not ours, so read each default and ask "do I need this?". And when a type "doesn't exist",
  check whether it's code-generated.
- **Links:** `node_modules/next/dist/docs/01-app/02-guides/static-exports.md`,
  `.../05-config/01-next-config-js/cacheComponents.md`
