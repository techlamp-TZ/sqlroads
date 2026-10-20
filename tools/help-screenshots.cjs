// Takes the How to use screenshots (public/help/*.jpg) from the real app: run it against a server on a COPY of the
// database, never the live one (it opens pages and may add a note):
//   node -e "new (require('node:sqlite').DatabaseSync)('data.sqlite').exec(\"VACUUM INTO 'help-copy.sqlite'\")"
//   SQLDRILLS_DB=help-copy.sqlite PORT=4100 node server.js
//   PUPPETEER_CORE=<path to puppeteer-core> node tools/help-screenshots.cjs [http://localhost:4100]
// then delete the copy. SQLPad (:3010) is only looked at. Which file each guide section shows: public/help.js ("shot").
const path = require("path");
const fs = require("fs");
const puppeteer = require(process.env.PUPPETEER_CORE || "puppeteer-core");
const BASE = process.argv[2] || "http://localhost:4100";
const SQLPAD = process.env.SQLPAD_URL || "http://localhost:3010";
const OUT = path.join(__dirname, "..", "public", "help");
const CHROME = process.env.CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
if (/:4000\b/.test(BASE)) { console.error("Run this against a server on a copy of the database (e.g. :4100), not the live app."); process.exit(2); }
(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const prof = fs.mkdtempSync(path.join(require("os").tmpdir(), "sqldrills-shots-"));
  const b = await puppeteer.launch({ executablePath: CHROME, headless: "new", userDataDir: prof, defaultViewport: { width: 1280, height: 800, deviceScaleFactor: 1 } });
  const p = await b.newPage();
  const shot = async (file, url, opts = {}) => {
    await p.goto(BASE + (opts.admin ? "/admin#/overview" : "/#/home"), { waitUntil: "networkidle2" });
    await p.goto(BASE + url, { waitUntil: "networkidle2" });
    if (opts.wait) await p.waitForSelector(opts.wait, { timeout: 30000 });
    await sleep(opts.pause || 1200);
    if (opts.before) await opts.before();
    const el = opts.element ? await p.$(opts.element) : null;
    if (el) await el.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 72 });
    else await p.screenshot({ path: path.join(OUT, file), type: "jpeg", quality: 72 });
    console.log("✓", file);
  };
  try {
    const concept = "where-filter-intro";
    // a note on the copy, so My notes isn't empty
    await fetch(BASE + "/api/learn/reflections", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ concept, explain: "WHERE keeps only the rows whose condition is true.", confidence: 4 }) });
    await shot("concept.jpg", "/#/concept/" + concept + "?tab=memorize", { wait: ".concept-head" });
    await shot("learn.jpg", "/#/learn/" + concept + "?s=2", { wait: ".ln-try", before: async () => { await p.click("[data-ex-run]"); await sleep(800); } });
    await shot("home.jpg", "/#/home", { wait: ".page, .wf-main" });
    await shot("flashcards.jpg", "/#/flashcards?concept=" + concept, { wait: ".fc-page, .wf-fc-page" });
    await shot("flashcard-library.jpg", "/#/flashcards", { wait: ".fc-lib-list, .wf-fc-lib-list" });
    await shot("levels.jpg", "/#/levels", { wait: ".page, .wf-main" });
    await shot("cards.jpg", "/#/concept/" + concept + "?tab=understand", { wait: ".xcard", element: ".xcard" });
    await shot("challenge.jpg", "/#/challenge?level=1", { wait: ".challenge-page, .wf-challenge" });
    await shot("notes.jpg", "/#/notes", { wait: "#notesList .note, .wf-notes-list .wf-note" });
    const lib = await (await fetch(BASE + "/api/library")).json();
    const ex = (lib.items || lib).find((d) => d.level === 2 && d.check === "solution" && d.dataset);
    await shot("schema.jpg", "/#/drill/" + ex.id, { wait: "#sql", pause: 2000 });
    await shot("docs.jpg", "/#/docs?t=az&c=" + concept, { wait: ".wf-doc-body .ln-try, .doc-body .ln-try" });
    await shot("admin-generate.jpg", "/admin#/generate", { admin: true, wait: "#view .page, #view .wf-main" });
    await shot("admin-create.jpg", "/admin#/create", { admin: true, wait: "#c-type" });
    await shot("admin-review.jpg", "/admin#/review", { admin: true, wait: "#view .page, #view .wf-main", pause: 2500 });
    await shot("admin-fillgaps.jpg", "/admin#/generate?kind=stage&level=1", { admin: true, wait: "#view .page, #view .wf-main", pause: 2500 });
    await shot("admin-concepts.jpg", "/admin#/concepts", { admin: true, wait: "#view .page, #view .wf-main", pause: 2500 });
    await shot("admin-health.jpg", "/admin#/health", { admin: true, wait: "#view .page, #view .wf-main", pause: 2000 });
    await shot("admin-backups.jpg", "/admin#/backups", { admin: true, wait: "#view .page, #view .wf-main" });
    await shot("admin-settings.jpg", "/admin#/settings", { admin: true, wait: "#view .page, #view .wf-main", pause: 2500 });
    await shot("admin-overview.jpg", "/admin#/overview", { admin: true, wait: ".spend", element: ".spend", before: async () => {} });
    // SQLPad: only looked at
    await p.goto(SQLPAD + "/", { waitUntil: "networkidle2" }); await sleep(2500);
    await p.screenshot({ path: path.join(OUT, "sqlpad.jpg"), type: "jpeg", quality: 72 }); console.log("✓ sqlpad.jpg");
    // every screenshot the guides name exists
    const Help = require("../public/help.js");
    const missing = Help.LEARNER.concat(Help.ADMIN).map((s) => s.shot).filter((f) => f && !fs.existsSync(path.join(OUT, f)));
    if (missing.length) { console.error("missing:", missing.join(", ")); process.exitCode = 1; }
  } finally { await b.close(); await sleep(300); fs.rmSync(prof, { recursive: true, force: true }); }
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
