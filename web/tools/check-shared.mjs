// The React wrappers against the old pieces, in real Chrome, inside the real old app (the "Shared pieces" stories,
// booted from the test copy on :4100). For each piece:
//   - same output: the old markup and the wrapper's markup are equal (ids that differ by design normalised;
//     the card engine's shuffles seeded the same way for both)
//   - same behaviour: the same actions (mouse and keyboard) on both give the same result and the same API calls
// Run `npm run build-storybook` first; needs the test copy's server on :4100. Usage: node tools/check-shared.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";
import { serveCatalog } from "./serve-catalog.mjs";

const web = fileURLToPath(new URL("../", import.meta.url));
const served = await serveCatalog();
const prof = path.join(web, ".shared-profile-" + Date.now());
const browser = await puppeteer.launch({ executablePath: process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: "new", userDataDir: prof });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
let ok = true;

// a seeded Math.random, reset before each side is built, so shuffled card options come out the same
const SEEDED = () => { let s = 7; window.__reseed = () => { s = 7; }; Math.random = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; };

async function open(story, theme = "light") {
  const p = await browser.newPage();
  const calls = [];
  p.on("request", (r) => { const u = new URL(r.url()); if (u.pathname.startsWith("/api/")) calls.push(r.method() + " " + u.pathname + u.search + (r.postData() ? " " + r.postData() : "")); });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.evaluateOnNewDocument(SEEDED);
  await p.setViewport({ width: 1366, height: 900 });
  await p.goto(`${served.base}/iframe.html?id=shared-pieces--${story}&viewMode=story&globals=theme:${theme}`, { waitUntil: "networkidle0" });
  await p.waitForSelector(".wf-pair [data-side=new] .wf-legacy > *, .wf-pair [data-side=new] button", { timeout: 60000 });
  await sleep(800);
  return { p, calls, errors };
}

// the two sides' markup, with the differences that are there by design taken out
// the card engine shuffles a card's options on every build (by design), so a card is compared by its set of
// options (each with its text and whether it is right), not by their order
const sortOptions = (html) => html.replace(/(<fieldset class="po-opts[^>]*>)([\s\S]*?)(<\/fieldset>)/g, (m, open, body, close) => {
  const opt = /<label class="po-opt"[\s\S]*?<\/label>/g;
  const opts = (body.match(opt) || []).map((o) => o.replace(/ value="\d+"/, "").replace(/<span class="po-l">[A-E]<\/span>/, ""));
  return open + body.replace(opt, "") + opts.sort().join("") + close;
});
const normal = (html) => sortOptions(html)
  .replace(/\bsp\d+(-t\d+|-body)?\b/g, (m) => m.replace(/\d+/, "N"))
  .replace(/aria-labelledby="pair\d+-(old|new) /g, 'aria-labelledby="') // the harness-only name prefix (pairs.jsx)
  .replace(/pair-(old|new)/g, "pair-X")
  .replace(/(xc-[\w-]*?|data-xcard="[^"]*?)-(old|new)\b/g, "$1-X")
  .replace(/\s+/g, " ");
async function sides(p) {
  return p.evaluate(() => {
    const pair = document.querySelector(".wf-pair");
    const old = pair.querySelector("[data-side=old]"), nw = pair.querySelector("[data-side=new] .wf-legacy");
    return { old: old ? old.innerHTML : null, nw: nw ? nw.innerHTML : null, display: nw ? getComputedStyle(nw).display : null };
  });
}
const sel = (side, css) => side === "old" ? `.wf-pair [data-side=old] ${css}` : `.wf-pair [data-side=new] .wf-legacy ${css}`;
const record = (name, check, pass, detail) => { results.push({ name, check, pass, detail }); if (!pass) ok = false; };

try {
  // 1. same output, every piece (the card's options shuffled with the same seed on both sides)
  for (const [name, story] of [["schemaPanel", "schema-panel"], ["tablesPanel", "tables-panel"], ["sqlWorkspace", "sql-workspace"], ["exampleBox", "example-box"], ["resultTable", "result-table"], ["resultDiff", "result-diff"], ["miniTable", "mini-table"], ["card", "interaction-card"]]) {
    const { p, errors } = await open(story);
    const s = await sides(p);
    const same = s.old !== null && s.nw !== null && normal(s.old) === normal(s.nw);
    record(name, "same output", same && s.display === "contents" && !errors.length, same ? "equal (" + s.old.length + " chars)" + (s.display !== "contents" ? " but wrapper display " + s.display : "") : "DIFFERENT" + (errors.length ? " errors: " + errors.join("; ") : ""));
    if (!same && s.old && s.nw) {
      const a = normal(s.old), b = normal(s.nw); let i = 0; while (a[i] === b[i]) i++;
      results[results.length - 1].detail += " at " + i + ": old …" + a.slice(Math.max(0, i - 60), i + 60) + "… new …" + b.slice(Math.max(0, i - 60), i + 60) + "…";
    }
    await p.close();
  }

  // each side runs in a fresh page: the SQL engine and the schema panel cache what they load, so a second side on
  // the same page would skip the first side's requests
  const perSide = async (story, fn) => {
    const out = {};
    for (const side of ["old", "new"]) {
      const { p, calls, errors } = await open(story);
      out[side] = await fn(p, side, calls);
      if (errors.length) out[side].errors = errors;
      await p.close();
    }
    return out;
  };

  // 2. schema panel: keyboard and mouse give the same states, the same preview and the same requests
  {
    const out = await perSide("schema-panel", async (p, side, calls) => {
      await p.focus(sel(side, ".sp-table:nth-child(2) .sp-caret")); await p.keyboard.press("Enter"); await sleep(200);
      const opened = await p.$eval(sel(side, ".sp-table:nth-child(2) .sp-caret"), (b) => b.getAttribute("aria-expanded"));
      await p.click(sel(side, ".sp-table:nth-child(1) [data-sp-preview]")); await sleep(1500);
      const preview = await p.$eval(sel(side, ".sp-table:nth-child(1) .sp-out"), (o) => o.innerText.replace(/\s+/g, " ").trim().slice(0, 300));
      await p.click(sel(side, ".sp-toggle")); await sleep(200);
      const closed = await p.$eval(sel(side, ".sp-toggle"), (b) => b.getAttribute("aria-expanded"));
      return { opened, preview, closed, api: calls.filter((c) => !/\/api\/(library|mcqs|progress|bookmarks|learn\/activity)(\?|$| )/.test(c)) };
    });
    record("schemaPanel", "same behaviour (Enter on a caret, Preview 5 rows, close, requests)", JSON.stringify(out.old) === JSON.stringify(out.new) && out.old.opened === "true" && out.old.closed === "false" && out.old.preview.length > 10, JSON.stringify(out.old).slice(0, 220));
  }

  // 3. workspace: type, Ctrl+Enter, the result; Back to the example; an error; the same requests
  {
    const out = await perSide("sql-workspace", async (p, side, calls) => {
      const before = calls.length, ta = sel(side, ".ln-sql");
      await p.click(ta); await p.keyboard.down("Control"); await p.keyboard.press("a"); await p.keyboard.up("Control");
      await p.keyboard.type("SELECT first_name FROM guests WHERE country = 'Sweden'");
      const gutter = await p.$eval(sel(side, ".gutter"), (g) => g.textContent);
      await p.keyboard.down("Control"); await p.keyboard.press("Enter"); await p.keyboard.up("Control");
      await p.waitForSelector(sel(side, ".ws-status.ok, .ws-status.bad"), { timeout: 20000 }); await sleep(200);
      const result = await p.$eval(sel(side, ".ws-res"), (r) => r.innerText.replace(/\s+/g, " ").trim().slice(0, 300));
      const draft = await p.evaluate((q) => document.querySelector(q).value, ta);
      await p.click(sel(side, "[data-ex-reset]")); await sleep(200);
      const reset = await p.evaluate((q) => { const t = document.querySelector(q); return t.value === t.getAttribute("data-orig"); }, ta);
      await p.click(ta); await p.keyboard.down("Control"); await p.keyboard.press("a"); await p.keyboard.up("Control");
      await p.keyboard.type("SELECT nope FROM guests"); await p.click(sel(side, "[data-ex-run]"));
      await p.waitForSelector(sel(side, ".ws-status.bad"), { timeout: 20000 });
      const error = await p.$eval(sel(side, ".ws-status.bad"), (r) => r.innerText.replace(/\s+/g, " ").trim());
      return { gutter, result, draft, reset, error, api: calls.slice(before) };
    });
    record("sqlWorkspace", "same behaviour (type, Ctrl+Enter, result, Back to the example, error, requests)", JSON.stringify(out.old) === JSON.stringify(out.new) && out.old.reset && /Result/.test(out.old.result), JSON.stringify(out.old).slice(0, 240));
  }

  // 4. card: the same answer (chosen by its text, as the order is shuffled) gives the same feedback and the same
  // request; choosing marks the card started (markStarted)
  {
    let answer = null;
    const out = await perSide("interaction-card", async (p, side, calls) => {
      const before = calls.length;
      if (answer === null) answer = await p.$eval(sel(side, ".xc-opts .po-opt .po-body"), (e) => e.textContent);
      await p.evaluate((q, text) => { const l = [...document.querySelectorAll(q)].find((x) => x.querySelector(".po-body").textContent === text); l.querySelector("input").click(); }, sel(side, ".xc-opts .po-opt"), answer);
      await sleep(100);
      const started = await p.$eval(sel(side, ".xcard"), (c) => c.getAttribute("data-started"));
      await p.click(sel(side, "[data-xc-check]")); await sleep(1500);
      const feedback = await p.$eval(sel(side, ".xc-out"), (o) => o.innerText.replace(/\s+/g, " ").trim().slice(0, 300));
      return { started, feedback, api: calls.slice(before).map((c) => c.replace(/-(old|new)\b/g, "-X")) };
    });
    record("card", "same behaviour (same answer, Check, feedback, request; markStarted marks it)", JSON.stringify(out.old) === JSON.stringify(out.new) && out.old.started === "1" && out.old.feedback.length > 5, JSON.stringify(out.old).slice(0, 260));
  }

  // 5. confirm: both open <dialog id="confirmDlg">; [data-confirm=ok] confirms, Esc cancels; focus starts on OK
  {
    const { p } = await open("confirm");
    const out = {};
    for (const [side, btn] of [["old", "[data-pair=old-confirm]"], ["new", "[data-pair=new-confirm]"]]) {
      await p.click(btn); await sleep(300);
      const shown = await p.evaluate(() => { const d = document.getElementById("confirmDlg"); return { open: !!(d && d.open), tag: d && d.tagName, msg: d && d.querySelector("#confirmMsg").textContent, ok: d && d.querySelector("[data-confirm=ok]").textContent, focus: document.activeElement && document.activeElement.getAttribute("data-confirm") }; });
      await p.click("#confirmDlg [data-confirm=ok]"); await sleep(300);
      const afterOk = await p.$eval("[data-testid=confirm-said]", (e) => e.textContent);
      await p.click(btn); await sleep(300); await p.keyboard.press("Escape"); await sleep(300);
      const closedByEsc = await p.evaluate(() => !document.getElementById("confirmDlg").open);
      out[side] = { shown, afterOk: afterOk.replace(/^(old|new): /, ""), closedByEsc };
    }
    record("askConfirm", "same dialog (#confirmDlg, [data-confirm=ok], Esc)", JSON.stringify(out.old) === JSON.stringify(out.new) && out.old.shown.open && out.old.afterOk === "ok", JSON.stringify(out.old));
    await p.close();
  }
} finally { await browser.close(); served.close(); fs.rmSync(prof, { recursive: true, force: true }); }

for (const r of results) console.log((r.pass ? "ok   " : "FAIL ") + r.name + ": " + r.check + "  " + r.detail);
console.log(ok ? "shared pieces: old and new match" : "shared pieces: DIFFERENCES");
process.exit(ok ? 0 : 1);
