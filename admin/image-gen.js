// Generate items from screenshots (admin → Generate → From images). Images are stored on this computer only
// (uploads/images/<batch>/, never served: no route reads them back) and never reach learners. The generator model
// (a vision model, gpt-4.1-mini) extracts the task text, the tables and rows shown and any expected answer into an
// editable preview; the admin fixes it, picks a dataset (or makes a small new one from the rows, verified on SQLite,
// a MySQL scratch schema and a rolled-back PostgreSQL schema) and the items go through the normal generators and
// checks (SQL runs, second-provider review, ...). Everything lands as drafts in the review queue; nothing is approved.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const db = require("../db.js");
const cc = require("../library/concepts.js");
const library = require("../library/library.js");
const content = require("./content.js");
const writecheck = require("../library/writecheck.js");

const { imageInfo, visionTokens, datasetSql } = require("./image-rules.js");
const DIR = path.join(__dirname, "..", "uploads", "images");
const MAX_IMAGES = 10, MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ["drill", "mcq", "flashcard", "predict"];
db.exec(`CREATE TABLE IF NOT EXISTS image_batches (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, images TEXT NOT NULL,
  extraction TEXT, status TEXT NOT NULL, result TEXT, cost REAL NOT NULL DEFAULT 0)`);
const now = () => new Date().toISOString();
const sg = () => require("./stage-gen.js");

// ---------- images ----------
const price = (role) => { const { ROLES, PRICE } = require("../hints.js"); return PRICE[ROLES[role].model] || [0, 0]; };
const dollars = (inp, out, role = "generator") => (inp * price(role)[0] + out * price(role)[1]) / 1e6;
/** Cost of reading the images (one call per batch): image tokens + prompt, ~800 output tokens per image. */
function estimateExtract(dims) {
  const inp = 1200 + dims.reduce((n, d) => n + visionTokens(d.w, d.h), 0), out = 800 * dims.length;
  return { tokens: { input: inp, output: out }, dollars: dollars(inp, out) };
}
/** Cost of generating the items: a concept/type pick per batch, then each item at the normal per-item cost. */
function estimateGenerate(items, type) {
  const unit = require("./learning.js").UNIT_COST;
  const per = { drill: unit.practise, mcq: unit.flashcard, flashcard: unit.flashcard, predict: unit.predict };
  const pick = dollars(6000 + 400 * items.length, 150 * items.length);
  const each = items.map((it) => per[type === "auto" ? guessType(it) : type] || unit.predict);
  return { items: items.length, dollars: pick + each.reduce((a, b) => a + b, 0), perItem: each };
}
const guessType = (it) => (it.options && it.options.length >= 2 ? "mcq" : it.query && (it.tables || []).length ? "predict" : it.kind === "flashcard" ? "flashcard" : "drill");

/** Saves the images of a new batch: [{ name, data: "data:image/png;base64,..." }] → { batch, images }. */
function saveBatch(images) {
  if (!Array.isArray(images) || !images.length) throw Object.assign(new Error("Add at least one image."), { status: 400 });
  if (images.length > MAX_IMAGES) throw Object.assign(new Error("At most " + MAX_IMAGES + " images per batch."), { status: 400 });
  const id = "img-" + crypto.randomBytes(5).toString("hex");
  const out = [];
  const dir = path.join(DIR, id);
  fs.mkdirSync(dir, { recursive: true });
  try {
    images.forEach((im, n) => {
      const m = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(String(im.data || ""));
      if (!m) throw Object.assign(new Error("Image " + (n + 1) + " isn't a PNG or JPG."), { status: 400 });
      const buf = Buffer.from(m[2], "base64");
      const info = imageInfo(buf);
      if (!info) throw Object.assign(new Error("Image " + (n + 1) + " isn't a PNG or JPG."), { status: 400 });
      if (buf.length > MAX_BYTES) throw Object.assign(new Error("Image " + (n + 1) + " is larger than 8 MB."), { status: 400 });
      const file = (n + 1) + "." + (info.type === "png" ? "png" : "jpg");
      fs.writeFileSync(path.join(dir, file), buf);
      out.push({ file, w: info.w, h: info.h, bytes: buf.length });
    });
  } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e; }
  db.prepare("INSERT INTO image_batches (id, created_at, images, status) VALUES (?, ?, ?, 'uploaded')").run(id, now(), JSON.stringify(out));
  return { batch: id, images: out };
}
const batchRow = (id) => {
  const r = /^img-[0-9a-f]{10}$/.test(id) && db.prepare("SELECT * FROM image_batches WHERE id = ?").get(id);
  if (!r) throw Object.assign(new Error("No such batch"), { status: 404 });
  return r;
};

// ---------- extraction (vision) ----------
const SYSTEM_EXTRACT = `You read screenshots of SQL learning material (exercises, quizzes, tables, query results) and extract them as data.
Reply with ONLY one JSON object: {"items": [ITEM, ...]}
ITEM = {"kind": "exercise" | "mcq" | "flashcard" | "predict", "task": "the task or question in your own clear words", "query": "SQL shown in the image, exactly, or empty", "tables": [{"name": "table name (invent a short one if none is shown)", "columns": ["..."], "types": ["column types when shown, else empty"], "rows": [["...", ...]]}], "expected": {"columns": ["..."], "rows": [[...]]} or null, "options": ["..."] (multiple choice only), "answer_index": 0-based index or null, "answer_text": "the expected answer in words, or empty"}
Rules: one ITEM per separate exercise or question; copy table rows and values exactly (numbers as numbers, NULL as null); "tables" are input data shown in the image, "expected" is a result shown as the answer. When the image shows only a table's STRUCTURE (field names and their types, e.g. a Field / Type table) and no data, return that table with its columns, its "types" and "rows": []. Never copy a website, brand, book, course or author name, a URL or a logo: leave them out. If an image holds no SQL learning material, return {"items": []}.`;
const URLS = /\bhttps?:\/\/\S+|\bwww\.\S+/gi;
const tidy = (s) => library.clean(String(s == null ? "" : s)).replace(URLS, "").trim();
function cleanItem(it) {
  const tables = (Array.isArray(it.tables) ? it.tables : []).slice(0, 4).map((t) => ({ name: tidy(t.name).slice(0, 40), sample: t.sample === true || undefined, types: Array.isArray(t.types) && t.types.some(Boolean) ? t.types.slice(0, 12).map((x) => String(x || "").slice(0, 30)) : undefined, columns: (t.columns || []).slice(0, 12).map((c) => tidy(c).slice(0, 40)), rows: (t.rows || []).slice(0, 30).map((r) => (Array.isArray(r) ? r : []).slice(0, 12).map((v) => (v === null || typeof v === "number" ? v : tidy(v).slice(0, 200)))) })).filter((t) => t.name && t.columns.length);
  const ex = it.expected && Array.isArray(it.expected.columns) ? { columns: it.expected.columns.map((c) => tidy(c)), rows: (it.expected.rows || []).slice(0, 30) } : null;
  return { kind: ["exercise", "mcq", "flashcard", "predict"].includes(it.kind) ? it.kind : "exercise", task: tidy(it.task).slice(0, 2000), query: String(it.query || "").replace(URLS, "").trim().slice(0, 4000), tables, expected: ex, options: Array.isArray(it.options) ? it.options.slice(0, 6).map((o) => tidy(o).slice(0, 300)) : [], answer_index: Number.isInteger(it.answer_index) ? it.answer_index : null, answer_text: tidy(it.answer_text).slice(0, 1000) };
}
async function extract(id) {
  const row = batchRow(id);
  const images = JSON.parse(row.images);
  const urls = images.map((im) => "data:image/" + (im.file.endsWith(".png") ? "png" : "jpeg") + ";base64," + fs.readFileSync(path.join(DIR, id, im.file)).toString("base64"));
  if (cc.MODELS.a.provider !== "openai") throw Object.assign(new Error("Reading images needs the OpenAI generator (a vision model)."), { status: 400 });
  const c0 = cc.cost();
  let p = null;
  try { p = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_EXTRACT, "Extract every SQL exercise, question or table from these " + images.length + " screenshot(s).", 6000, urls)).text); }
  catch (e) { throw Object.assign(new Error("The vision model failed: " + e.message), { status: 502 }); }
  const items = (p && Array.isArray(p.items) ? p.items : []).slice(0, 20).map(cleanItem).filter((it) => it.task || it.query || it.tables.length);
  const cost = cc.cost() - c0;
  db.prepare("UPDATE image_batches SET extraction = ?, status = 'extracted', cost = cost + ? WHERE id = ?").run(JSON.stringify(items), cost, id);
  return { batch: id, items, cost };
}

// ---------- a new dataset from the rows in the images ----------
/** The dataset SQL runs on SQLite, a MySQL scratch schema and a rolled-back PostgreSQL schema, with every row in. */
async function verifyDataset(sql, plan) {
  const count = plan.map((t) => `SELECT '${t.name}' AS t, COUNT(*) AS n FROM ${t.name}`).join(" UNION ALL ") + " ORDER BY 1";
  const want = plan.map((t) => [t.name, t.rows]).sort((a, b) => (a[0] < b[0] ? -1 : 1)).map((x) => x.join(":")).join(",");
  const got = (rows) => rows.map((r) => r[0] + ":" + Number(r[1])).join(",");
  const checks = [];
  try { const m = new DatabaseSync(":memory:"); m.exec(sql); const st = m.prepare(count); st.setReturnArrays(true); const ok = got(st.all()) === want; checks.push({ ok, label: "Runs on SQLite with every row", detail: ok ? "" : "row counts differ" }); m.close(); }
  catch (e) { checks.push({ ok: false, label: "Runs on SQLite with every row", detail: e.message }); }
  try { const r = await writecheck.runOnDataset("__image_dataset_check__", count, sql); const ok = !!(r.ok && r.result && got(r.result.rows) === want); checks.push({ ok, label: "Runs on a MySQL scratch schema with every row", detail: ok ? "" : String(r.error || "row counts differ").slice(0, 160) }); }
  catch (e) { checks.push({ ok: false, label: "Runs on a MySQL scratch schema with every row", detail: e.message }); }
  try { const r = await sg().runPg(sql + "\n" + count + ";"); const ok = !!(r.ok && r.result && got(r.result.rows) === want); checks.push({ ok, label: "Runs on PostgreSQL (rolled back) with every row", detail: ok ? "" : String(r.error || "row counts differ").slice(0, 160) }); }
  catch (e) { checks.push({ ok: false, label: "Runs on PostgreSQL (rolled back) with every row", detail: e.message }); }
  return checks;
}
/** Registers a verified dataset like the built-in ones: a sites / folders / files entry + both dataset maps. */
function registerDataset(tables, sql, label, batch) {
  const site = "img" + crypto.randomBytes(4).toString("hex"), key = site;
  db.exec("BEGIN");
  try {
    const order = (db.prepare("SELECT MAX(order_index) m FROM sites").get().m || 0) + 1;
    db.prepare("INSERT INTO sites (id, name, order_index) VALUES (?, ?, ?)").run(site, label, order);
    const folder = db.prepare("INSERT INTO folders (site_id, name, order_index) VALUES (?, 'data', 0)").run(site).lastInsertRowid;
    db.prepare("INSERT INTO files (folder_id, name, type, content, order_index) VALUES (?, ?, 'sql', ?, 0)").run(folder, site + ".sql", sql);
    db.prepare("INSERT INTO custom_datasets (key, site, label, tables, batch, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(key, site, label, JSON.stringify(tables.map((t) => t.name)), batch, now());
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  library.registerDataset(site, key, label);
  content.registerDataset(key, site, label);
  sg().registerSite(key, site);
  return { site, key, label };
}
/** Preview: the SQL a new dataset would get, and its checks (nothing is saved). */
/** A table with no rows can't be a dataset: say which, and how to fix it. */
function emptyTables(tables) {
  const empty = tables.filter((t) => !(t.rows || []).filter((r) => r && r.length).length);
  if (empty.length) throw Object.assign(new Error((empty.length === 1 ? "The table " + empty[0].name + " has" : "The tables " + empty.map((t) => t.name).join(", ") + " have") + " no data rows (the screenshot shows only the structure): click \"Generate sample rows\" in the preview, type some rows, or pick an existing dataset."), { status: 400 });
}
async function previewDataset(items) {
  const tables = items.flatMap((it) => it.tables || []);
  if (!tables.length) throw Object.assign(new Error("No table rows were found in the images: map the items to an existing dataset."), { status: 400 });
  emptyTables(tables);
  const { sql, plan } = datasetSql(tables);
  return { sql, tables: plan, checks: await verifyDataset(sql, plan) };
}

// ---------- structure-only screenshots: sample rows, a question ----------
const SYSTEM_SAMPLE_ROWS = `You make realistic sample data for one SQL practice table whose structure is known. Reply with ONLY one JSON object: {"rows": [[...], ...]}
Rules: 8-15 rows, one value per column in the given order; respect each type (numbers for numeric types, text no longer than a VARCHAR length, dates as YYYY-MM-DD); varied, believable values (real-looking names and codes, a range of numbers, a few repeats where a question could group or filter on them); unique values in an id-like first column; no NULLs unless the task needs them. Make sure the TASK can be answered with these rows and gives a non-empty result.`;
/** 8-15 generated rows for a table that has columns (and types) but no data: checked against the columns and types. */
async function sampleRows(id, { table, task } = {}) {
  batchRow(id);
  const t = cleanItem({ tables: [table] }).tables[0];
  if (!t || !t.columns.length) throw Object.assign(new Error("That table has no columns."), { status: 400 });
  const { sqlType } = require("./image-rules.js");
  const types = t.columns.map((_, i) => sqlType((t.types || [])[i]) || "");
  const c0 = cc.cost();
  let rows = [];
  for (let attempt = 0; attempt < 2 && !rows.length; attempt++) {
    let p = null;
    try { p = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_SAMPLE_ROWS, "TABLE " + t.name + "\nCOLUMNS: " + t.columns.map((c, i) => c + (types[i] ? " " + types[i] : "")).join(", ") + "\nTASK: " + (tidy(task) || "(none: make data good for typical SELECT / WHERE / GROUP BY practice)"), 2500)).text); } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw Object.assign(new Error("The AI didn't answer: " + e.message), { status: 502 }); }
    const got = (p && Array.isArray(p.rows) ? p.rows : []).filter((r) => Array.isArray(r) && r.length === t.columns.length).slice(0, 15);
    const fits = (v, ty) => v === null || (ty === "INT" ? Number.isInteger(Number(v)) : ty.startsWith("DECIMAL") ? !isNaN(Number(v)) : ty.startsWith("VARCHAR") ? String(v).length <= Number(/\((\d+)\)/.exec(ty)[1]) : ty === "DATE" ? /^\d{4}-\d{2}-\d{2}$/.test(String(v)) : true);
    const ok = got.filter((r) => r.every((v, i) => fits(v, types[i])));
    if (ok.length >= 5) rows = ok.map((r) => r.map((v, i) => (v === null ? null : types[i] === "INT" || types[i].startsWith("DECIMAL") ? Number(v) : tidy(v))));
  }
  if (!rows.length) throw Object.assign(new Error("Couldn't make rows that fit the columns: type a few rows yourself."), { status: 502 });
  return { table: { ...t, rows, sample: true }, cost: cc.cost() - c0 };
}
const SYSTEM_ENHANCE = `You write or improve one SQL practice question for a course app, from what a screenshot showed. Reply with ONLY one JSON object: {"task": "the question", "answer_text": "what the right answer returns, in one sentence (optional)"}
Rules: clear and specific (which columns to show, which rows, the sort order when it matters); answerable with the tables given; keep the original idea when there is one; plain English; never name a website, platform, book, course or author.`;
/** Writes a question for an item that has only a table, or makes an existing one clearer. */
async function enhanceItem(id, { item } = {}) {
  batchRow(id);
  const it = cleanItem(item || {});
  if (!it.task && !it.tables.length && !it.query) throw Object.assign(new Error("Nothing to work from: the item has no task, table or SQL."), { status: 400 });
  const c0 = cc.cost();
  let p = null;
  try { p = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_ENHANCE, (it.task ? "CURRENT QUESTION: " + it.task + "\n" : "There is no question yet: write a good one for these tables.\n") + (it.query ? "SQL SHOWN: " + it.query + "\n" : "") + "TABLES:\n" + it.tables.map((t) => t.name + "(" + t.columns.map((c, i) => c + (t.types && t.types[i] ? " " + t.types[i] : "")).join(", ") + ")" + (t.rows.length ? " rows e.g. " + JSON.stringify(t.rows.slice(0, 3)) : " (no rows yet)")).join("\n"), 1200)).text); } catch (e) { throw Object.assign(new Error("The AI didn't answer: " + e.message), { status: 502 }); }
  if (!p || !p.task) throw Object.assign(new Error("The AI gave no usable question: try again."), { status: 502 });
  return { task: tidy(p.task).slice(0, 2000), answer_text: tidy(p.answer_text || "").slice(0, 1000), cost: cc.cost() - c0, wrote: !it.task };
}

// ---------- generating the items ----------
const SYSTEM_PICK = `You sort SQL exercises taken from screenshots into a course. For each item pick the ONE concept from the list that it practises best${""} and, when asked, the item type. Reply with ONLY a JSON array: [{"i": 0, "concept": "concept-slug", "type": "drill" | "mcq" | "flashcard" | "predict"}]
Types: "mcq" when the item has answer options; "predict" when a query is shown with input rows and the learner should predict its result; "flashcard" for a definition or a fact to remember; otherwise "drill" (the learner writes a query).`;
const seedText = (it) => [it.task && "Task: " + it.task, it.query && "SQL shown: " + it.query, it.options && it.options.length && "Options: " + it.options.join(" | ") + (it.answer_index != null ? " (right: " + it.options[it.answer_index] + ")" : ""), it.answer_text && "Expected answer: " + it.answer_text, it.expected && "Expected result: " + JSON.stringify(it.expected).slice(0, 600), (it.tables || []).length && "Tables shown: " + it.tables.map((t) => t.name + "(" + t.columns.join(", ") + ")").join("; ")].filter(Boolean).join("\n");
const jobs = new Map();
function startGenerate(id, { items, type = "auto", dataset, level, newDatasetLabel } = {}) {
  const row = batchRow(id);
  if ([...jobs.values()].some((j) => j.running)) throw Object.assign(new Error("A batch is already being generated: wait for it to finish."), { status: 409 });
  if (!["auto"].concat(TYPES).includes(type)) throw Object.assign(new Error("Pick an output type."), { status: 400 });
  const list = (Array.isArray(items) ? items : JSON.parse(row.extraction || "[]")).slice(0, 20).map(cleanItem).filter((it) => it.task || it.query);
  if (!list.length) throw Object.assign(new Error("Nothing to generate: the preview has no items."), { status: 400 });
  if (dataset !== "new" && !content.DATASETS[dataset]) throw Object.assign(new Error("Pick a dataset (or a new one from the rows in the images)."), { status: 400 });
  const job = { id: "job-" + crypto.randomBytes(4).toString("hex"), batch: id, running: true, progress: "Starting…", made: [], skipped: [], cost: 0, started_at: now() };
  jobs.set(job.id, job);
  db.prepare("UPDATE image_batches SET extraction = ?, status = 'generating' WHERE id = ?").run(JSON.stringify(list), id);
  (async () => {
    const c0 = cc.cost(), tag = "image " + id;
    try {
      // the dataset
      let site;
      if (dataset === "new") {
        job.progress = "Building the new dataset from the rows…";
        const tables = list.flatMap((it) => it.tables || []);
        if (!tables.length) throw new Error("No table rows were found in the images.");
        emptyTables(tables);
        const { sql, plan } = datasetSql(tables);
        const checks = await verifyDataset(sql, plan);
        const bad = checks.filter((k) => !k.ok);
        if (bad.length) throw new Error("The new dataset failed a check: " + bad.map((k) => k.label + (k.detail ? " (" + k.detail + ")" : "")).join("; "));
        const sampled = tables.some((t) => t.sample);
        const label = (tidy(newDatasetLabel || "") || "Screenshot tables: " + plan.map((t) => t.name).join(", ")) + (sampled && !/sample data/i.test(newDatasetLabel || "") ? " (sample data)" : "");
        const reg = registerDataset(plan, sql, label.slice(0, 80), id);
        site = reg.site; job.dataset = { key: reg.key, label: reg.label, tables: plan, checks };
      } else site = content.DATASETS[dataset].site;
      // a concept (and a type, for "auto") per item
      job.progress = "Matching the items to concepts…";
      const concepts = cc.allConcepts().filter((c) => !level || Math.abs(c.level - Number(level)) <= 1 || c.level === Number(level));
      const pickUser = "CONCEPTS (slug: name, level):\n" + concepts.map((c) => c.slug + ": " + c.name + " (L" + c.level + ")").join("\n") + "\n\nITEMS:\n" + list.map((it, i) => "#" + i + "\n" + seedText(it)).join("\n\n") + (type === "auto" ? "\n\nAlso pick each item's type." : "\n\nEvery item's type is " + type + ".");
      let picks = [];
      try { picks = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_PICK, pickUser, 2000)).text) || []; } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw e; picks = []; }
      const bySlug = new Map(cc.allConcepts().map((c) => [c.slug, c]));
      for (let i = 0; i < list.length; i++) {
        const it = list[i], pk = (Array.isArray(picks) ? picks : []).find((x) => Number(x.i) === i) || {};
        const c = bySlug.get(pk.concept) || null;
        const t = type === "auto" ? (TYPES.includes(pk.type) ? pk.type : guessType(it)) : type;
        if (!c) { job.skipped.push({ i, why: "no concept matched" }); continue; }
        job.progress = "Item " + (i + 1) + " of " + list.length + ": " + t + " for " + c.name + "…";
        const before = { s: new Set(db.prepare("SELECT id FROM stage_items").all().map((r) => r.id)), c: new Set(db.prepare("SELECT id FROM content_items").all().map((r) => r.id)) };
        const seed = seedText(it);
        if (t === "drill") await sg().drillsFor(c, "practise", "image-" + id, 1, { site, seed, tag });
        else if (t === "mcq") await sg().conceptMcqsFor(c, "image-" + id, 1, { seed, n: 1, tag });
        else if (t === "flashcard") await sg().flashcardsFor(c, "image-" + id, 2, { site, seed });
        else await sg().seededPredict(c, site, { question: it.task || "What does this query return?", show_sql: "", sql: it.query || "" }, "image-" + id);
        const added = db.prepare("SELECT id, kind, json_extract(verify, '$.status') v FROM stage_items").all().filter((r) => !before.s.has(r.id)).map((r) => ({ id: r.id, kind: r.kind, status: r.v }))
          .concat(db.prepare("SELECT id, kind, json_extract(verify, '$.status') v FROM content_items").all().filter((r) => !before.c.has(r.id)).map((r) => ({ id: r.id, kind: r.kind, status: r.v })));
        if (!added.length) job.skipped.push({ i, why: t + " for " + c.name + ": no draft passed the checks" });
        added.forEach((a) => job.made.push({ ...a, item: i, concept: c.slug, type: t }));
      }
      job.progress = null;
    } catch (e) { job.error = e.message; job.progress = null; }
    job.cost = cc.cost() - c0; job.running = false; job.finished_at = now();
    db.prepare("UPDATE image_batches SET status = ?, result = ?, cost = cost + ? WHERE id = ?").run(job.error ? "failed" : "done", JSON.stringify({ made: job.made, skipped: job.skipped, dataset: job.dataset, error: job.error }), job.cost, id);
  })();
  return job;
}
const jobOf = (id) => { const j = jobs.get(id); if (!j) throw Object.assign(new Error("No such job"), { status: 404 }); return j; };

module.exports = { verifyDataset, registerDataset, sampleRows, enhanceItem, saveBatch, extract, estimateExtract, estimateGenerate, previewDataset, startGenerate, jobOf, imageInfo, visionTokens, datasetSql, cleanItem, DIR };
