// Keyboard use in real headless Chrome, both apps: the skip link, Tab order with a visible ring on every stop (the
// search box shows its ring on its wrapper), no ring after a mouse click, Ctrl+K / typing / Escape on the search,
// the learner settings menu, the in-page confirm, the admin editor dialog and the phone menu (Escape closes each and
// focus comes back). Run it against a server on a COPY of the database, never the live app:
//   SQLDRILLS_DB=<copy>.sqlite PORT=4100 node server.js        (in sql-drills-server/)
//   node tools/check-keyboard.mjs [http://localhost:4100]       (in web/; CHROME=<path to chrome.exe> if not the default)
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
const note = (label, detail) => console.log("note " + label + "  (" + detail + ")");

const lib = await (await fetch(BASE + "/api/library")).json();
const drill = ((lib.items || lib).find((d) => d.engine !== "server" && d.check === "solution") || {}).id;

const prof = fs.mkdtempSync(path.join(os.tmpdir(), "sqldrills-kb-"));
const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof });
const errors = [];
const desc = (p) => p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return "body"; const t = (a.getAttribute("aria-label") || a.innerText || a.value || a.placeholder || "").replace(/\s+/g, " ").trim().slice(0, 30); return a.tagName.toLowerCase() + (a.id ? "#" + a.id : "") + " " + t; });
// a visible ring on the focused element (outline, a shadow ring of 2px or more, or an ::after border), or on the
// search wrapper (.search:focus-within: accent border and a 3px shadow)
const ring = (p) => p.evaluate(() => {
  const has = (el) => { const cs = getComputedStyle(el), af = getComputedStyle(el, "::after"); return (cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) > 0) || /0px 0px 0px ([2-9]|\d\d)px/.test(cs.boxShadow) || (af.content !== "none" && af.borderStyle !== "none"); };
  const a = document.activeElement; if (!a || a === document.body) return null;
  return has(a) || (a.id === "searchInput" && has(a.closest(".search"))) ? "ring" : "no ring";
});
async function open(url, w = 1366) {
  const p = await browser.newPage();
  p.on("pageerror", (e) => errors.push(url + ": " + e.message.slice(0, 140)));
  p.on("dialog", (d) => { errors.push("native dialog: " + d.message().slice(0, 60)); d.dismiss(); });
  await p.setViewport({ width: w, height: 900 });
  await p.goto(BASE + url, { waitUntil: "networkidle0", timeout: 120000 }); await sleep(900);
  return p;
}
try {
  for (const [app, url, hash] of [["learner", "/#/home", "#/home"], ["admin", "/admin#/overview", "#/overview"]]) {
    let p = await open(url);
    const seq = [];
    for (let i = 0; i < 40; i++) { await p.keyboard.press("Tab"); seq.push([await desc(p), await ring(p)]); }
    check(/Skip to content/.test(seq[0][0]), `${app}: first Tab is the skip link`, seq[0][0]);
    const noRing = seq.filter(([, r]) => r !== "ring").map(([d]) => d);
    check(noRing.length === 0, `${app}: a ring on each of 40 Tab stops`, noRing.join(", "));
    await p.close();

    p = await open(url);
    await p.keyboard.press("Tab"); await p.keyboard.press("Enter"); await sleep(300);
    const after = await desc(p);
    check(/^main#view/.test(after) && (await p.evaluate(() => location.hash)) === hash, `${app}: skip link moves focus to the page`, after);
    const btn = await p.$("#themeBtn"); await btn.click(); await sleep(200);
    check((await ring(p)) === "no ring", `${app}: no ring after a mouse click`, await desc(p));
    await btn.click(); await sleep(200);
    await p.keyboard.down("Control"); await p.keyboard.press("k"); await p.keyboard.up("Control"); await sleep(200);
    check(/^input#searchInput/.test(await desc(p)), `${app}: Ctrl+K focuses the search`);
    await p.keyboard.type("select", { delay: 40 }); await sleep(800);
    const res = await p.evaluate(() => { const r = document.getElementById("searchResults"); return r ? [!r.hidden, r.querySelectorAll("a, [role=option]").length] : [false, 0]; });
    check(res[0] && res[1] > 0, `${app}: typing shows results`, res[1] + " results");
    await p.keyboard.press("Escape"); await sleep(200);
    check(await p.evaluate(() => document.getElementById("searchResults").hidden) && /^input#searchInput/.test(await desc(p)), `${app}: Escape closes the results, focus stays`);
    await p.close();
  }
  {
    const p = await open("/#/home");
    await p.focus("#settingsBtn"); await p.keyboard.press("Enter"); await sleep(300);
    check(await p.evaluate(() => !document.getElementById("settingsMenu").hidden && document.getElementById("settingsBtn").getAttribute("aria-expanded") === "true"), "learner: Enter opens the settings menu");
    await p.keyboard.press("Escape"); await sleep(300);
    check(await p.evaluate(() => document.getElementById("settingsMenu").hidden) && /^button#settingsBtn/.test(await desc(p)), "learner: Escape closes it, focus back on its button");
    await p.close();
  }
  {
    const p = await open("/#/drill/" + drill);
    await p.focus('[data-act="solution"]'); await p.keyboard.press("Enter"); await sleep(400);
    check(await p.evaluate(() => !!document.getElementById("confirmDlg") && document.getElementById("confirmDlg").open), "learner: Show solution opens the in-page confirm");
    await p.keyboard.press("Tab"); const t1 = await desc(p); await p.keyboard.press("Tab"); const t2 = await desc(p);
    note("learner: Tab inside the confirm", t1 + " > " + t2);
    await p.keyboard.press("Escape"); await sleep(300);
    check(!(await p.evaluate(() => document.getElementById("confirmDlg").open)) && /Show solution/.test(await desc(p)), "learner: Escape cancels it, focus back on Show solution");
    await p.close();
  }
  {
    const p = await open("/admin#/overview");
    await p.evaluate(() => [...document.querySelectorAll("#view button")].find((x) => /Write an exercise/.test(x.innerText)).focus());
    await p.keyboard.press("Enter"); await sleep(800);
    check(await p.evaluate(() => document.getElementById("modal").open && document.getElementById("modal").contains(document.activeElement)), "admin: the editor dialog opens with focus inside", await desc(p));
    await p.keyboard.press("Escape"); await sleep(300);
    check(!(await p.evaluate(() => document.getElementById("modal").open)) && /Write an exercise/.test(await desc(p)), "admin: Escape closes it, focus back on its button");
    await p.close();
  }
  {
    const p = await open("/#/home", 390);
    await p.focus("#menuBtn"); await p.keyboard.press("Enter"); await sleep(300);
    check(await p.evaluate(() => document.getElementById("side").classList.contains("open")) && /^a /.test(await desc(p)), "phone: the menu button opens the sidebar, focus on its first link", await desc(p));
    await p.keyboard.press("Escape"); await sleep(300);
    check(!(await p.evaluate(() => document.getElementById("side").classList.contains("open"))) && /^button#menuBtn/.test(await desc(p)), "phone: Escape closes it, focus back on the menu button");
    await p.close();
  }
} finally { await browser.close(); fs.rmSync(prof, { recursive: true, force: true }); }
check(errors.length === 0, "no page errors and no native dialogs", errors.join("; "));
console.log(failures ? `keyboard: ${failures} failed` : "keyboard: all checks pass");
process.exit(failures ? 1 : 0);
