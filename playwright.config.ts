import { defineConfig } from "@playwright/test";

// End-to-end tests run in the Chrome installed on this machine
// (`channel: "chrome"`), so there's no extra browser download, and we test
// the same engine users have. Media APIs need real Chrome features.
// Two modes:
//   pnpm test:e2e       → against `next dev` on :3100 (fast, for development)
//   pnpm test:e2e:prod  → build the static export and serve out/ on :3200 with
//                         a host-like static server, to catch prod-only bugs
const PROD = process.env.E2E_PROD === "1";
const PORT = PROD ? 3200 : 3100; // both separate from `pnpm dev` (3000)

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    trace: "retain-on-failure",
  },
  webServer: {
    command: PROD ? `pnpm build && node e2e/static-server.mjs ${PORT}` : `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !PROD,
    timeout: 240_000,
  },
});
