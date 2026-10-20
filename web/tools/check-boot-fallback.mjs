// The boot fallback in public/index.html and admin.html, in real Chrome, both apps, light and dark: a normal load shows
// no message; the bundle blocked, a script error at start, or a bundle slower than 10 s shows "The page could not load."
// with a Reload button; a slow bundle that arrives later replaces the message with the page; an API failure keeps the
// app's own message. Run it against a server on a COPY of the database, never the live app:
//   SQLDRILLS_DB=<copy>.sqlite PORT=4100 node server.js        (in sql-drills-server/)
//   node tools/check-boot-fallback.mjs [http://localhost:4100]  (in web/; CHROME=<path to chrome.exe> if not the default;
//   SHOTS=<folder> to keep a screenshot of the message per app and theme)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:4100";
if (/:4000\b/.test(BASE)) { console.error("Run this against a server on a copy of the database (e.g. :4100), not the live app."); process.exit(2); }
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");
const ENTRY = /\/app\/assets\/(main|admin)-[^/]+\.js$/;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label, detail = "") => { if (!ok) failures++; console.log((ok ? "ok   " : "FAIL ") + label + (detail ? "  (" + detail + ")" : "")); };

const prof = fs.mkdtempSync(path.join(os.tmpdir(), "sqldrills-boot-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof });
// state of the page: the message, the boot element, whether the app drew a page, and the message's colours
const state = (p) => p.evaluate(() => {
  const f = document.getElementById("bootFail"), b = f && f.querySelector("button");
  return {
    fail: !!f, text: f ? f.innerText.replace(/\s+/g, " ").trim() : "", button: b ? b.textContent : "",
    loading: !!document.getElementById("bootLoading"), mounted: !!document.querySelector("#view .wf-root, #view .wf-host"),
    viewText: (document.querySelector("#view") || {}).innerText?.slice(0, 80) || "", failedClass: document.documentElement.classList.contains("boot-failed"),
    colours: f ? [getComputedStyle(f).backgroundColor, getComputedStyle(f).color, getComputedStyle(b).backgroundColor, getComputedStyle(b).color] : [],
  };
});
// noWait: do not wait for DOMContentLoaded (it waits for the module script, so a slow bundle would delay the clock)
async function open(url, theme, onRequest, noWait = false) {
  const p = await browser.newPage();
  await p.setViewport({ width: 1366, height: 900 });
  await p.evaluateOnNewDocument((t) => { try { localStorage.setItem("sqldrills.theme.v2", t); } catch (e) {} }, theme);
  if (onRequest) { await p.setRequestInterception(true); p.on("request", (rq) => onRequest(rq).catch(() => rq.continue().catch(() => {}))); }
  const t0 = Date.now();
  const nav = p.goto(BASE + url, { waitUntil: "domcontentloaded", timeout: 60000 });
  if (noWait) nav.catch(() => {}); else await nav;
  return { p, t0 };
}
const until = (t0, ms) => sleep(Math.max(0, t0 + ms - Date.now()));
const axeOn = async (p) => { await p.evaluate(AXE); return p.evaluate(async () => (await window.axe.run(document, { resultTypes: ["violations"] })).violations.map((v) => v.id)); };

try {
  for (const [app, url] of [["learner", "/#/home"], ["admin", "/admin#/overview"]]) for (const theme of ["light", "dark"]) {
    const tag = `${app} ${theme}:`;
    // 1. normal load: the page is drawn, no message, even after the 10 s timer
    let { p } = await open(url, theme);
    await sleep(11000);
    let s = await state(p);
    check(s.mounted && !s.fail && !s.failedClass, `${tag} normal load, no message after 11 s`, s.mounted ? "" : s.viewText);
    await p.close();

    // 2. the bundle blocked
    ({ p } = await open(url, theme, async (rq) => (ENTRY.test(rq.url()) ? rq.abort() : rq.continue())));
    await sleep(1500);
    s = await state(p);
    check(s.fail && s.text.startsWith("The page could not load.") && s.button === "Reload", `${tag} bundle blocked -> message within 1.5 s`, s.text.slice(0, 60));
    const v = await axeOn(p);
    check(v.length === 0, `${tag} bundle blocked: axe`, v.join(",") || "0 violations");
    if (process.env.SHOTS) await p.screenshot({ path: path.join(process.env.SHOTS, `boot-fallback-${app}-${theme}.png`) });
    console.log("     colours (box bg, text, button bg, button text):", s.colours.join(" | "));
    // Reload reloads the page (here the bundle is still blocked, so the message is back)
    await Promise.all([p.waitForNavigation({ waitUntil: "domcontentloaded" }), p.click("#bootFail button")]);
    await sleep(1500);
    s = await state(p);
    check(s.fail, `${tag} Reload button reloads the page`);
    await p.close();

    // 3. a script error at start (the entry module throws before it does anything else)
    ({ p } = await open(url, theme, async (rq) => {
      if (!ENTRY.test(rq.url())) return rq.continue();
      const body = await (await fetch(rq.url())).text();
      rq.respond({ status: 200, contentType: "text/javascript", body: 'throw new Error("boot test: error at start");\n' + body });
    }));
    await sleep(2500);
    s = await state(p);
    check(s.fail && !s.mounted, `${tag} script error at start -> message`, s.text.slice(0, 40));
    await p.close();

    // 4. a slow bundle (15 s): the message at 10 s, then the page replaces it when the bundle arrives
    let t0;
    ({ p, t0 } = await open(url, theme, async (rq) => { if (ENTRY.test(rq.url())) await sleep(15000); rq.continue(); }, true));
    await until(t0, 8500);
    s = await state(p);
    check(!s.fail && s.loading, `${tag} slow bundle: still "Loading" at 8.5 s`);
    await until(t0, 11000);
    s = await state(p);
    check(s.fail, `${tag} slow bundle: message at 11 s`);
    await until(t0, 22000);
    s = await state(p);
    check(s.mounted && !s.fail && !s.failedClass, `${tag} slow bundle: page drawn once it arrives, message gone`, s.mounted ? "" : s.viewText);
    await p.close();

    // 5. a bundle that takes 6 s: no message
    ({ p, t0 } = await open(url, theme, async (rq) => { if (ENTRY.test(rq.url())) await sleep(6000); rq.continue(); }, true));
    await until(t0, 13000);
    s = await state(p);
    check(s.mounted && !s.fail, `${tag} bundle in 6 s: no message`);
    await p.close();

    // 6. the API down: the app's own error stays (not replaced by the boot message)
    const API = app === "learner" ? /\/api\/library$/ : /\/api\/admin\/topics$/;
    ({ p } = await open(url, theme, async (rq) => (API.test(rq.url().split("?")[0]) ? rq.respond({ status: 500, contentType: "application/json", body: '{"error":"boot test"}' }) : rq.continue())));
    await sleep(11500);
    s = await state(p);
    check(!s.fail && !s.loading, `${tag} API down: the app's own message stays`, s.viewText.replace(/\s+/g, " ").slice(0, 70));
    await p.close();
  }
} finally { await browser.close(); fs.rmSync(prof, { recursive: true, force: true }); }
console.log(failures ? `boot fallback: ${failures} failed` : "boot fallback: all checks pass");
process.exit(failures ? 1 : 0);
