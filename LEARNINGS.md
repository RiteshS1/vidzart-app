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
