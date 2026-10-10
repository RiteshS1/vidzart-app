// A tiny static file server for testing the production build (`out/`).
// It deliberately behaves like typical static hosts: MIME types by file
// extension (including `.ts` → video/mp2t, as nginx/Python/S3 do), and
// `/route` → `route.html`. Usage: node e2e/static-server.mjs <port>
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../out/", import.meta.url).pathname;
const port = Number(process.argv[2] ?? 3200);
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".txt": "text/plain",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".ts": "video/mp2t", // what most hosts send for .ts
  ".wasm": "application/wasm",
};

async function resolve(pathname) {
  const safe = normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, "");
  for (const candidate of [safe, `${safe}.html`, join(safe, "index.html")]) {
    const file = join(root, candidate);
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  const file = await resolve(new URL(req.url ?? "/", "http://x").pathname);
  if (!file) {
    res.writeHead(404, { "content-type": "text/html" }).end(await readFile(join(root, "404.html")));
    return;
  }
  res.writeHead(200, { "content-type": types[extname(file)] ?? "application/octet-stream" });
  res.end(await readFile(file));
}).listen(port, () => console.log(`static server on http://localhost:${port}`));
