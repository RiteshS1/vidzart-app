import { defineConfig } from "@playwright/test";

// End-to-end tests run in the Chrome installed on this machine
// (`channel: "chrome"`), so there's no extra browser download, and we test
// the same engine users have. Media APIs need real Chrome features.
const PORT = 3100; // separate from `pnpm dev` (3000) so both can run at once

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
    command: `pnpm exec next dev --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
