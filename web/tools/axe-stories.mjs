// axe-core on every Storybook story in real Chrome, light and dark (dev/test only).
// Serves web/storybook-static/ (run `npm run build-storybook` first) on a local port, opens each story's iframe,
// runs axe with every rule on (colour contrast included) and reports violations, page errors and console errors.
// Usage: node tools/axe-stories.mjs [--widths 1366,390] [--only <id-substring>] [--shots <dir>]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const web = fileURLToPath(new URL("../", import.meta.url));
const ROOT = path.join(web, "storybook-static");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const WIDTHS = arg("--widths", "1366").split(",").map(Number);
const ONLY = arg("--only", "");
const SHOTS = arg("--shots", "");
const AXE = fs.readFileSync(path.join(web, "node_modules/axe-core/axe.min.js"), "utf8");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" };

const server = http.createServer((q, r) => {
  const p = path.join(ROOT, decodeURIComponent(q.url.split("?")[0]).replace(/^\/+/, "") || "index.html");
  if (!p.startsWith(ROOT)) { r.writeHead(403); return r.end(); }
  fs.readFile(p, (e, d) => { if (e) { r.writeHead(404); return r.end(); } r.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" }); r.end(d); });
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const BASE = "http://127.0.0.1:" + server.address().port;
const ids = Object.values(JSON.parse(fs.readFileSync(path.join(ROOT, "index.json"), "utf8")).entries).filter((e) => e.type === "story" && e.id.includes(ONLY)).map((e) => e.id);

const prof = path.join(web, ".axe-profile-" + Date.now());
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof });
const results = [];
try {
  for (const width of WIDTHS) for (const theme of ["light", "dark"]) for (const id of ids) {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
    page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|Download the React DevTools/.test(m.text())) errors.push("console: " + m.text().slice(0, 200)); });
    page.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/favicon.ico")) errors.push(r.status() + " " + r.url()); });
    await page.setViewport({ width, height: width === 390 ? 844 : 900, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`, { waitUntil: "networkidle0" });
    await page.waitForSelector("#storybook-root > *, dialog[open]", { timeout: 15000 }).catch(() => errors.push("story did not render"));
    await page.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 900)); // dialog / toast / tooltip transitions
    await page.addScriptTag({ content: AXE });
    const axe = await page.evaluate(async () => {
      const r = await window.axe.run(document, { resultTypes: ["violations"] });
      return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map((n) => ({ target: n.target.join(" "), summary: (n.failureSummary || "").replace(/\s+/g, " ").slice(0, 220) })), count: v.nodes.length }));
    });
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const theme2 = await page.evaluate(() => document.documentElement.getAttribute("data-theme") || "light");
    if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${id}-${width}-${theme}.png`), fullPage: true }); }
    results.push({ id, width, theme, themeApplied: theme2 === theme, violations: axe, errors, pageScroll: scroll });
    await page.close();
  }
} finally { await browser.close(); server.close(); fs.rmSync(prof, { recursive: true, force: true }); }

const bad = results.filter((r) => r.violations.length || r.errors.length || !r.themeApplied);
for (const r of bad) {
  console.log(`${r.id} [${r.width} ${r.theme}]${r.themeApplied ? "" : " THEME NOT APPLIED"}`);
  for (const v of r.violations) { console.log(`  ${v.id} (${v.impact}, ${v.count}): ${v.help}`); for (const n of v.nodes) console.log(`     ${n.target} :: ${n.summary}`); }
  for (const e of r.errors) console.log("  " + e);
}
const scrolls = results.filter((r) => r.pageScroll).map((r) => `${r.id} [${r.width} ${r.theme}]`);
console.log(JSON.stringify({ checked: results.length, stories: ids.length, withProblems: bad.length, violations: results.reduce((n, r) => n + r.violations.length, 0), pageScroll: scrolls }));
process.exit(bad.length ? 1 : 0);
