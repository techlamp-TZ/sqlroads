// Serves the built catalog (web/storybook-static) on a free local port for the Chrome checks. Paths the catalog
// does not have (the old app's files and /api, used by the "Shared pieces" stories) are forwarded to the server on
// the test copy (LEGACY_APP, default http://localhost:4100), never to :4000.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("../", import.meta.url));
const ROOT = path.join(web, "storybook-static");
const LEGACY = new URL(process.env.LEGACY_APP || "http://localhost:4100");
if (LEGACY.port === "4000") throw new Error("The catalog checks never use :4000; point LEGACY_APP at a test copy.");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };

export async function serveCatalog() {
  const server = http.createServer((q, r) => {
    const rel = decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html";
    const p = path.join(ROOT, rel);
    if (p.startsWith(ROOT) && fs.existsSync(p) && fs.statSync(p).isFile()) {
      r.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
      return fs.createReadStream(p).pipe(r);
    }
    const fwd = http.request({ host: LEGACY.hostname, port: LEGACY.port, path: q.url, method: q.method, headers: { ...q.headers, host: LEGACY.host } }, (res) => { r.writeHead(res.statusCode, res.headers); res.pipe(r); });
    fwd.on("error", () => { r.writeHead(502); r.end(); });
    q.pipe(fwd);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  return { base: "http://127.0.0.1:" + server.address().port, close: () => server.close(), root: ROOT };
}
