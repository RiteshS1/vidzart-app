import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vidzart has no backend: `next build` writes plain HTML/CSS/JS into `out/`,
  // which any static host can serve. This also means no API routes, server
  // actions, proxy, rewrites or `headers()` — Next errors in dev if we use them.
  output: "export",

  // Note: create-next-app 16.4 enables `cacheComponents` + `partialPrefetching`
  // by default. They're about caching server-fetched data, and we fetch nothing
  // on the server, so we leave them off to keep the mental model simple.
  // (See LEARNINGS.md, 2026-10-11.)

  turbopack: {
    rules: {
      // Tailwind v4 runs as a Turbopack loader on our CSS files.
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
