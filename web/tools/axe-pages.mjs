// axe-core (every rule, colour contrast included) in real headless Chrome on every page of both apps, light and
// dark, 1366 and 390 px. Run it against a server on a COPY of the database, never the live app:
//   SQLDRILLS_DB=<copy>.sqlite PORT=4100 node server.js        (in sql-drills-server/)
//   node tools/axe-pages.mjs [http://localhost:4100]            (in web/; CHROME=<path to chrome.exe> if not the default)
// Exit code 1 when anything is found; the report lists each rule with the pages and elements.
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

const PAGES = await mainPages(BASE); // tools/pages.mjs: the same list as check-pages.mjs

const prof = fs.mkdtempSync(path.join(os.tmpdir(), "sqldrills-axe-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof });
const found = {};
let runs = 0;
try {
  for (const theme of ["light", "dark"]) for (const width of [1366, 390]) for (const url of PAGES) {
    const p = await browser.newPage();
    await p.evaluateOnNewDocument((t) => { try { localStorage.setItem("sqldrills.theme.v2", t); } catch (e) {} }, theme);
    await p.setViewport({ width, height: 900 });
    await p.goto(BASE + url, { waitUntil: "networkidle0", timeout: 120000 });
    await new Promise((r) => setTimeout(r, 800));
    await p.evaluate(AXE);
    const v = await p.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((x) => [x.id, x.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")]));
    for (const [id, nodes] of v) (found[id] = found[id] || []).push(`${url} ${theme} ${width}: ${nodes}`);
    runs++;
    await p.close();
  }
} finally { await browser.close(); fs.rmSync(prof, { recursive: true, force: true }); }
const ids = Object.keys(found);
console.log(`axe: ${PAGES.length} pages × light/dark × 1366/390 = ${runs} runs; ${ids.length ? ids.length + " rules violated" : "no violations"}`);
for (const id of ids) { console.log("  " + id + " (" + found[id].length + ")"); found[id].slice(0, 6).forEach((l) => console.log("    " + l)); }
process.exit(ids.length ? 1 : 0);
