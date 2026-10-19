// Behaviour checks on the built catalog in real Chrome (dev/test only; run `npm run build-storybook` first):
//  - tabs: selecting a tab (bold) moves no tab, in light and dark
//  - focus rings: shown after Tab, not after a mouse click (Button, Input, Checkbox, legacy CSS)
//  - the #confirmDlg story: a <dialog id="confirmDlg"> opens; clicking [data-confirm=ok] closes it and reports "ok";
//    Esc reports "cancel"
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { serveCatalog } from "./serve-catalog.mjs";

const web = fileURLToPath(new URL("../", import.meta.url));
const ROOT = path.join(web, "storybook-static");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".woff2": "font/woff2" };
const served = await serveCatalog();
const server = { close: served.close };
const BASE = served.base;
const prof = path.join(web, ".check-profile-" + Date.now());
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", userDataDir: prof });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const out = {}; let ok = true;
const open = async (id, theme = "light", width = 1366) => { const p = await browser.newPage(); await p.setViewport({ width, height: 900 }); await p.goto(`${BASE}/iframe.html?id=${id}&viewMode=story&globals=theme:${theme}`, { waitUntil: "networkidle0" }); await p.evaluate(() => document.fonts.ready); await sleep(500); return p; };
try {
  // tabs
  out.tabs = [];
  for (const theme of ["light", "dark"]) for (const width of [1366, 390]) {
    const p = await open("stylesheets--tabs", theme, width);
    const boxes = () => p.$$eval(".minimal-tab__link", (ls) => ls.map((l) => { const r = l.getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.width * 10) / 10]; }));
    const before = await boxes();
    const moved = [];
    for (const t of ["Practise", "Review", "Notes", "Learn"]) {
      await p.click(`.minimal-tab__link[data-tab="${t}"]`); await sleep(150);
      const now = await boxes();
      if (JSON.stringify(now) !== JSON.stringify(before)) moved.push(t);
      const bold = await p.$eval(`.minimal-tab__link[data-tab="${t}"]`, (l) => getComputedStyle(l).fontWeight);
      if (Number(bold) < 600) moved.push(t + " not bold");
    }
    out.tabs.push({ theme, width, shifts: moved });
    if (moved.length) ok = false;
    await p.close();
  }
  // keyboard-only focus rings
  out.focus = {};
  const ring = (p, sel) => p.$eval(sel, (el) => {
    const s = getComputedStyle(el), a = getComputedStyle(el, "::after"), sib = el.nextElementSibling ? getComputedStyle(el.nextElementSibling) : null;
    return { focused: document.activeElement === el, visible: el.matches(":focus-visible"), outline: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) > 0, after: a.borderStyle !== "none" && a.content !== "none" && parseFloat(a.borderWidth) > 0, shadow: s.boxShadow !== "none" ? s.boxShadow.slice(0, 40) : "", sibShadow: sib && sib.boxShadow !== "none" ? sib.boxShadow.slice(0, 40) : "" };
  });
  for (const [name, id, sel] of [["Button", "components-button--states", "button[type=button]"], ["Input", "components-form-elements--inputs", "input"], ["Checkbox", "components-form-elements--radios-and-checkboxes", "input[type=checkbox]"], ["legacy CSS button", "stylesheets--legacy-buttons", ".dc-btn"]]) {
    const p = await open(id);
    // keyboard: Tab until the element is focused
    let kb = null;
    for (let i = 0; i < 25 && !kb; i++) { await p.keyboard.press("Tab"); kb = await p.evaluate((sel) => document.activeElement && document.activeElement.matches(sel), sel) ? await ring(p, ":focus") : null; }
    await p.evaluate(() => document.activeElement && document.activeElement.blur());
    // mouse: click it
    // (a visually hidden input, like Waffles' checkbox, is clicked through its label, as a person would)
    const target = await p.evaluateHandle((sel) => { const el = document.querySelector(sel); return el.getBoundingClientRect().width < 2 ? el.closest("label") || el : el; }, sel);
    await target.click({ delay: 20 }); await sleep(100);
    const mouse = await p.evaluate((sel) => document.activeElement && document.activeElement.matches(sel), sel) ? await ring(p, ":focus") : { focused: false };
    out.focus[name] = { keyboard: kb, mouse };
    const kbShown = kb && kb.visible && (kb.outline || kb.after || kb.shadow || kb.sibShadow);
    const mouseHidden = !mouse.focused || (name === "Input" ? true : !mouse.visible && !mouse.outline && !mouse.after);
    if (!kbShown || !mouseHidden) ok = false;
    await p.close();
  }
  // #confirmDlg
  const p = await open("components-overlays--confirm-dlg");
  const opened = await p.evaluate(() => { const d = document.getElementById("confirmDlg"); return d && d.tagName === "DIALOG" && d.open && document.activeElement && !!document.activeElement.closest("#confirmDlg"); });
  await p.click('#confirmDlg [data-confirm="ok"]'); await sleep(800);
  const afterOk = await p.evaluate(() => ({ gone: !document.getElementById("confirmDlg"), result: document.querySelector('[data-testid="confirm-result"]').textContent }));
  const p2 = await open("components-overlays--confirm-dlg");
  await p2.keyboard.press("Escape"); await sleep(800);
  const afterEsc = await p2.evaluate(() => ({ gone: !document.getElementById("confirmDlg"), result: document.querySelector('[data-testid="confirm-result"]').textContent }));
  out.confirmDlg = { opened, afterOk, afterEsc };
  if (!opened || !afterOk.gone || afterOk.result !== "ok" || !afterEsc.gone || afterEsc.result !== "cancel") ok = false;
} finally { await browser.close(); server.close(); fs.rmSync(prof, { recursive: true, force: true }); }
console.log(JSON.stringify(out, null, 1));
console.log(ok ? "catalog checks: all pass" : "catalog checks: FAILED");
process.exit(ok ? 0 : 1);
