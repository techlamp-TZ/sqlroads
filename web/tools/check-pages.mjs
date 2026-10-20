// Every main page of both apps in real headless Chrome, light and dark, 1366 and 390 px: axe-core (default rules,
// colour contrast included), page and console errors, failed requests (4xx/5xx), sideways scroll of the page, the page
// drawn by React (a .wf-root or .wf-host box) and not stuck on "Loading". Run it against a server on a COPY of the
// database, never the live app (opening pages writes learner state such as Learn events):
//   SQLDRILLS_DB=<copy>.sqlite PORT=4100 node server.js        (in sql-drills-server/)
//   node tools/check-pages.mjs [http://localhost:4100]          (in web/; CHROME=<path to chrome.exe> if not the default;
//                                                               SHOTS=<folder> keeps a screenshot of every run)
// A copy started without .env has no MySQL/PostgreSQL: their 503s are listed as skipped, not as failures.
// Exit code 1 when anything else is found.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";
import { mainPages } from "./pages.mjs";

const BASE = process.argv[2] || "http://localhost:4100";
if (/:4000\b/.test(BASE)) { console.error("Run this against a server on a copy of the database (e.g. :4100), not the live app."); process.exit(2); }
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const SHOTS = process.env.SHOTS; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
// a server database (MySQL/PostgreSQL) that is not reachable from this copy: the schema panel says so, nothing else
const NO_SERVER_DB = /^503 \/api\/library\/item\/[^/]+\/schema\?dialect=(mysql|postgres)/;

const PAGES = await mainPages(BASE);
const prof = fs.mkdtempSync(path.join(os.tmpdir(), "sqldrills-pages-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof });
const rows = [];
try {
  for (const theme of ["light", "dark"]) for (const width of [1366, 390]) for (const url of PAGES) for (let attempt = 1; attempt <= 2; attempt++) {
    // a tab Chrome closes under the run (rare, under load) is tried once more, then reported
    let p;
    try {
    p = await browser.newPage();
    const errs = [], bad = [];
    p.on("console", (m) => { if (m.type() === "error" && !/^Failed to load resource/.test(m.text())) errs.push("console: " + m.text().slice(0, 160)); });
    p.on("pageerror", (e) => errs.push("page error: " + e.message.slice(0, 160)));
    p.on("response", (r) => { if (r.status() >= 400 && r.url().startsWith(BASE)) bad.push(r.status() + " " + r.url().replace(BASE, "")); });
    await p.evaluateOnNewDocument((t) => { try { localStorage.setItem("sqldrills.theme.v2", t); } catch (e) {} }, theme);
    await p.setViewport({ width, height: 900 });
    const t0 = Date.now(); let load = "";
    try { await p.goto(BASE + url, { waitUntil: "networkidle0", timeout: 120000 }); } catch (e) { load = "load: " + e.message.slice(0, 60); }
    await new Promise((r) => setTimeout(r, 800));
    const info = await p.evaluate(() => {
      const de = document.documentElement, v = document.querySelector("#view");
      return {
        hscroll: de.scrollWidth > de.clientWidth + 1 || document.body.scrollWidth > de.clientWidth + 1,
        drawn: !!(v && v.querySelector(".wf-root, .wf-host")),
        loading: !!document.getElementById("bootLoading") || !!document.getElementById("bootFail"),
      };
    });
    await p.evaluate(AXE);
    const axe = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => x.id + " (" + x.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ") + ")"));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, (theme + "-" + width + "-" + url.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")).slice(0, 90) + ".png") });
    const skipped = [...new Set(bad)].filter((b) => NO_SERVER_DB.test(b)), failed = [...new Set(bad)].filter((b) => !NO_SERVER_DB.test(b));
    const problems = [...axe.map((a) => "axe " + a), ...errs, ...failed.map((b) => "request " + b), ...(info.hscroll ? ["sideways scroll"] : []), ...(!info.drawn ? ["not drawn by React"] : []), ...(info.loading ? ["still loading / boot message"] : []), ...(load ? [load] : [])];
    rows.push({ url, theme, width, secs: (Date.now() - t0) / 1000, problems, skipped });
    await p.close();
    break;
    } catch (e) {
      if (p) await p.close().catch(() => {});
      if (attempt === 2) rows.push({ url, theme, width, secs: 0, problems: ["run failed: " + e.message.slice(0, 80)], skipped: [] });
    }
  }
} finally { await browser.close(); fs.rmSync(prof, { recursive: true, force: true }); }

const failedRuns = rows.filter((r) => r.problems.length), skippedRuns = rows.filter((r) => r.skipped.length);
for (const r of failedRuns) console.log(`FAIL ${r.url} ${r.theme} ${r.width}: ${r.problems.join("; ")}`);
if (skippedRuns.length) console.log(`skipped (no MySQL/PostgreSQL on this server): ${[...new Set(skippedRuns.map((r) => r.url))].join(", ")} (${skippedRuns.length} runs)`);
console.log(`pages: ${PAGES.length} pages × light/dark × 1366/390 = ${rows.length} runs; ${failedRuns.length} with problems; slowest ${Math.max(...rows.map((r) => r.secs)).toFixed(1)} s`);
process.exit(failedRuns.length ? 1 : 0);
