// Guards that must keep working, in real headless Chrome, both apps: a page from an older version shows the
// "New version" banner and its writes are refused with 409 (nothing is saved); the in-page confirm opens on
// <dialog id="confirmDlg"> with [data-confirm=ok] and native confirm() is never called. Run it against a server on
// a COPY of the database, never the live app:
//   SQLDRILLS_DB=<copy>.sqlite PORT=4100 node server.js        (in sql-drills-server/)
//   node tools/check-behaviour.mjs [http://localhost:4100]      (in web/; CHROME=<path to chrome.exe> if not the default)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";

const BASE = process.argv[2] || "http://localhost:4100";
if (/:4000\b/.test(BASE)) { console.error("Run this against a server on a copy of the database (e.g. :4100), not the live app."); process.exit(2); }
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const check = (ok, label, detail = "") => { if (!ok) failures++; console.log((ok ? "ok   " : "FAIL ") + label + (detail ? "  (" + detail + ")" : "")); };

const prof = fs.mkdtempSync(path.join(os.tmpdir(), "sqldrills-behave-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof });
try {
  for (const [app, url, shared, write] of [["learner", "/#/home", "SQLDrillsShared", "/api/learn/reflections"], ["admin", "/admin#/overview", "SQLDrillsAdmin", "/api/admin/settings"]]) {
    // a stale page: the HTML carries an old version, so the first API answer shows the banner and a write is refused
    let p = await browser.newPage(); await p.setViewport({ width: 1366, height: 900 });
    await p.setRequestInterception(true);
    p.on("request", async (rq) => {
      if (rq.resourceType() !== "document") return rq.continue();
      const html = (await (await fetch(rq.url())).text()).replace(/<meta name="app-version" content="[^"]*">/, '<meta name="app-version" content="check-old">');
      rq.respond({ status: 200, contentType: "text/html", body: html });
    });
    await p.goto(BASE + url, { waitUntil: "networkidle0", timeout: 90000 }); await sleep(800);
    const banner = await p.evaluate(() => { const s = document.getElementById("staleBanner"); return s ? s.innerText.replace(/\s+/g, " ").trim() : ""; });
    check(/^New version of SQL Drills\./.test(banner) && /Reload/.test(banner), `${app}: "New version" banner on a stale page`);
    const status = await p.evaluate(async (u) => (await fetch(u, { method: "POST", headers: { "Content-Type": "application/json", "X-Page-Version": "check-old" }, body: "{}" })).status, write);
    check(status === 409, `${app}: a write from a stale page is refused`, "HTTP " + status);
    await p.close();

    // the in-page confirm; native confirm() is replaced by a counter that must stay at 0
    p = await browser.newPage(); await p.setViewport({ width: 1366, height: 900 });
    await p.evaluateOnNewDocument(() => { window.__nativeConfirm = 0; window.confirm = () => { window.__nativeConfirm++; return false; }; });
    await p.goto(BASE + url, { waitUntil: "networkidle0", timeout: 90000 });
    const c = await p.evaluate(async (name) => {
      const S = window[name]; if (!S || !S.askConfirm) return { missing: true };
      const answer = S.askConfirm("Check?", "Yes");
      await new Promise((r) => setTimeout(r, 200));
      const d = document.getElementById("confirmDlg"), ok = d && d.querySelector('[data-confirm="ok"]');
      const r = { tag: d && d.tagName, open: d && d.open, ok: ok && ok.textContent, focusOk: document.activeElement === ok };
      d.querySelector('[data-confirm="cancel"]').click();
      r.answer = await answer; r.closed = !d.open; r.native = window.__nativeConfirm;
      return r;
    }, shared);
    check(!c.missing && c.tag === "DIALOG" && c.open && c.ok === "Yes" && c.focusOk, `${app}: askConfirm opens <dialog id="confirmDlg"> with [data-confirm=ok] focused`);
    check(c.answer === false && c.closed, `${app}: Cancel closes it and answers false`);
    check(c.native === 0, `${app}: native confirm() not called`);
    await p.close();
  }
} finally { await browser.close(); fs.rmSync(prof, { recursive: true, force: true }); }
console.log(failures ? `behaviour: ${failures} failed` : "behaviour: all checks pass");
process.exit(failures ? 1 : 0);
