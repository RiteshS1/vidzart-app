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
