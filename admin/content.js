// Admin content: the MCQ bank (built-in questions + edits/hides + added questions), extra SQL
// drills, and the content generation machine (AI drafts -> automatic verification -> review).
//
// content_items holds everything the admin adds or changes:
//   kind 'mcq'   data = { q, code, options[4], answer, why, topic, diff, check }
//   kind 'drill' data = { site, topic, diff, title, task, solution_sql }
//   status: draft (waiting for review) | published (live) | rejected | hidden (a built-in MCQ
//   taken off the site). A row whose id equals a built-in MCQ id overrides that question.
const { DatabaseSync } = require("node:sqlite");
const crypto = require("node:crypto");
const db = require("../db.js");
const BUILTIN_MCQS = require("../mcq/questions.js");
const { complete, listProviders } = require("../hints.js");
const fs = require("node:fs");
const path = require("node:path");
// levels and datasets come from the unified library
const LEVELS = [
  "SELECT basics", "Filtering & NULL", "Sorting & limiting", "Functions, expressions & dates", "Aggregation & GROUP BY", "JOINs", "Subqueries",
  "Set operators & reshaping", "Window functions & CTEs", "Modifying data", "Schema design: tables, keys, constraints", "Views, indexes & performance",
  "Transactions, routines & security", "Projects, capstone & practice exams",
];
const LEVEL_TOPIC = { 1: "select", 2: "where", 3: "order", 4: "functions", 5: "group", 6: "join", 7: "subquery", 8: "set", 9: "window", 10: "modify", 11: "ddl", 12: "views", 13: "tx", 14: "group" };
const TOPIC_LEVEL = { select: 1, where: 2, order: 3, functions: 4, dates: 4, group: 5, aggregates: 5, join: 6, subquery: 7, set: 8, window: 9, modify: 10, ddl: 11, views: 12, tx: 13, security: 13 };
const DATASETS = {
  world: { site: "sqlzoo", label: "World, Nobel, movies & more" }, library: { site: "w3schools", label: "Library (authors, books, members, loans)" },
  hr: { site: "sqltutorialorg", label: "HR (employees, departments, jobs)" }, shop: { site: "tpointtech", label: "Shop (customers, products, orders)" },
  streaming: { site: "geeksforgeeks", label: "Music streaming" }, clinic: { site: "tutorialspoint", label: "Vet clinic" },
  games: { site: "sqlcourse", label: "Games" }, hotels: { site: "tutorialrepublic", label: "Hotels" },
};
for (const r of db.prepare("SELECT key, site, label FROM custom_datasets ORDER BY created_at").all()) DATASETS[r.key] = { site: r.site, label: r.label };
const DATASET_OF_SITE = Object.fromEntries(Object.entries(DATASETS).map(([k, d]) => [d.site, k]));
function registerDataset(key, site, label) { DATASETS[key] = { site, label }; DATASET_OF_SITE[site] = key; datasetCache.delete(site); }
function reloadCustomDatasets(rows) {
  for (const key of Object.keys(DATASETS)) if (/^img[0-9a-f]+$/.test(key) && !rows.some((r) => r.key === key)) { delete DATASET_OF_SITE[DATASETS[key].site]; datasetCache.delete(DATASETS[key].site); delete DATASETS[key]; }
  rows.forEach((r) => registerDataset(r.key, r.site, r.label));
}
const BUILTIN_ADDED = (() => { try { const st = fs.statSync(path.join(__dirname, "..", "mcq", "questions.js")); return (st.birthtimeMs ? st.birthtime : st.mtime).toISOString(); } catch { return new Date().toISOString(); } })();
const levelOf = (m) => Number(m.level) || TOPIC_LEVEL[m.topic] || 1;

db.exec(`
  CREATE TABLE IF NOT EXISTS content_items (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('mcq', 'drill')),
    status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'rejected', 'hidden')),
    data TEXT NOT NULL,
    verify TEXT,
    source TEXT NOT NULL,
    job_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_content_kind_status ON content_items(kind, status);
  CREATE TABLE IF NOT EXISTS generation_jobs (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    params TEXT NOT NULL,
    status TEXT NOT NULL,
    provider TEXT,
    produced INTEGER NOT NULL DEFAULT 0,
    verified INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL,
    finished_at TEXT
  );
`);
if (!db.prepare("PRAGMA table_info(generation_jobs)").all().some((c) => c.name === "progress")) db.exec("ALTER TABLE generation_jobs ADD COLUMN progress TEXT");
const setProgress = (id, text) => db.prepare("UPDATE generation_jobs SET progress = ? WHERE id = ?").run(text, id);

const TOPICS = {
  select: "SELECT basics (columns, aliases, DISTINCT, literals)", where: "WHERE filtering (comparisons, AND/OR, IN, BETWEEN, LIKE, NULL)",
  order: "ORDER BY and LIMIT", join: "JOINs (inner, left, self, cross)", group: "GROUP BY and HAVING", aggregates: "aggregate functions (COUNT, SUM, AVG, MIN, MAX)",
  subquery: "subqueries (scalar, IN, EXISTS, correlated, derived tables)", window: "window functions and CTEs", set: "set operators (UNION, INTERSECT, EXCEPT)",
  functions: "functions and CASE (string, numeric, COALESCE)", dates: "date and time functions", modify: "INSERT, UPDATE and DELETE",
  ddl: "tables, keys and constraints", views: "views and indexes", tx: "transactions, triggers and stored procedures", security: "SQL security and injection",
};
const DIFFS = ["easy", "medium", "hard"];
const now = () => new Date().toISOString();
const newId = (prefix) => `${prefix}-${crypto.randomBytes(5).toString("hex")}`;
const parse = (row) => row && { ...row, data: JSON.parse(row.data), verify: row.verify ? JSON.parse(row.verify) : null };

// ---------- similarity (duplicate detection) ----------
const STOP = new Set("the and for are but not you all any can had her was one our out has have this that with from what which does when where who how why its into than then them they will would there their about query return returns following these those your each".split(" "));
const words = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9_*%<>=]+/g, " ").split(/\s+/).filter((w) => w.length > 1 && !STOP.has(w)));
const mcqText = (m) => [m.q, m.code, ...(m.options || [])].join(" ");
function similarity(a, b) {
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
function mostSimilar(text, pool) {
  let best = { score: 0, text: "" };
  for (const t of pool) {
    const s = similarity(text, t);
    if (s > best.score) best = { score: s, text: t };
  }
  return best;
}

// ---------- the track datasets, fresh in memory (the same SQL files learners' browsers load) ----------
const sqlFilesFor = db.prepare(`
  SELECT f.name, f.content FROM files f JOIN folders fo ON fo.id = f.folder_id
  WHERE fo.site_id = ? AND f.type = 'sql' ORDER BY fo.order_index, f.order_index`);
const datasetCache = new Map();
/** A new in-memory copy of a track dataset (for drills that add rows first). */
function freshDataset(site) {
  const mem = new DatabaseSync(":memory:");
  const seen = new Set();
  for (const f of sqlFilesFor.all(site)) { if (seen.has(f.name)) continue; seen.add(f.name); mem.exec(f.content); }
  return mem;
}
function dataset(site) {
  if (datasetCache.has(site)) return datasetCache.get(site);
  const mem = new DatabaseSync(":memory:");
  const seen = new Set();
  for (const f of sqlFilesFor.all(site)) {
    if (seen.has(f.name)) continue;
    seen.add(f.name);
    mem.exec(f.content);
  }
  datasetCache.set(site, mem);
  return mem;
}
/** A read-only query on a dataset with the WHOLE result (up to `limit` rows), rows as arrays so
 *  duplicate column names (a.name, b.name) survive. */
function runAll(site, sql, limit = 5000, setup = null) {
  const text = String(sql || "").trim().replace(/;\s*$/, "");
  if (!READ_ONLY.test(text) || /;\s*\S/.test(text)) return { ok: false, error: "Only a single SELECT (or WITH … SELECT) statement can be run here." };
  let db = null;
  try {
    // setup: rows a drill adds before its query (on a fresh copy, never on the shared one)
    if (setup) { db = freshDataset(site); db.exec(setup); }
    const stmt = (db || dataset(site)).prepare(text);
    const columns = stmt.columns().map((c) => c.name);
    stmt.setReturnArrays(true);
    const rows = stmt.all();
    return { ok: true, columns, rows: rows.slice(0, limit), count: rows.length };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    if (db) db.close();
  }
}
function schemaText(site) {
  const d = dataset(site);
  return d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(({ name }) => {
    const q = `"${name.replace(/"/g, '""')}"`;
    const cols = d.prepare(`PRAGMA table_info(${q})`).all().map((c) => `${c.name} ${c.type}`.trim());
    const rows = d.prepare(`SELECT * FROM ${q} LIMIT 3`).all().map((r) => JSON.stringify(Object.values(r)));
    const n = d.prepare(`SELECT COUNT(*) AS n FROM ${q}`).get().n;
    return `TABLE ${name} (${cols.join(", ")}) -- ${n} rows; e.g. ${rows.join(" ")}`;
  }).join("\n").slice(0, 9000);
}
const READ_ONLY = /^\s*(select|with)\b/i;
/** Runs a read-only query on a track dataset: { ok, columns, rows (first 20), count, error }. */
function runReadOnly(site, sql) {
  const text = String(sql || "").trim().replace(/;\s*$/, "");
  if (!READ_ONLY.test(text) || /;\s*\S/.test(text)) return { ok: false, error: "Only a single SELECT (or WITH … SELECT) statement can be run here." };
  try {
    const stmt = dataset(site).prepare(text);
    const rows = stmt.all();
    const columns = rows.length ? Object.keys(rows[0]) : stmt.columns().map((c) => c.name);
    return { ok: true, columns, rows: rows.slice(0, 20).map((r) => Object.values(r)), count: rows.length };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ---------- verification ----------
const memory = new DatabaseSync(":memory:");
const exactKey = (s) => String(s || "").toLowerCase().replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "$1").replace(/[^a-z0-9]+/g, " ").trim();
const mcqKey = (m) => exactKey(m.q) + " | " + (m.options || []).map(exactKey).sort().join(" | ");
const levelOfMcq = (m) => Number(m.level) || TOPIC_LEVEL[m.topic] || 1;
// an MCQ has 2 to 5 options (generated ones have 4)
const MCQ_OPTIONS = [2, 5];
function verifyMcq(m, ignoreId) {
  const checks = [];
  const add = (ok, label, detail, warn) => checks.push({ ok, warn: !!warn, label, detail: detail || "" });
  add(typeof m.q === "string" && m.q.trim().length >= 10, "Question text", m.q ? "" : "missing");
  const nOpt = Array.isArray(m.options) ? m.options.length : 0;
  add(nOpt >= MCQ_OPTIONS[0] && nOpt <= MCQ_OPTIONS[1] && m.options.every((o) => String(o).trim()), MCQ_OPTIONS.join("-") + " options", nOpt + " options");
  add(nOpt >= 2 && new Set(m.options.map((o) => String(o).trim())).size === nOpt, "Options are all different");
  add(Number.isInteger(m.answer) && m.answer >= 0 && m.answer < nOpt, "Right answer chosen");
  add(!!(m.why && String(m.why).trim().length >= 15), "Explanation");
  add(!!TOPICS[m.topic], "Topic", m.topic);
  add(DIFFS.includes(m.diff), "Difficulty", m.diff);
  add(!(m.options || []).some((o) => /all of the above|none of the above/i.test(o)), "No 'all/none of the above'", "", true);
  if (m.check) {
    try {
      const row = memory.prepare(String(m.check)).get();
      const got = String(row ? Object.values(row)[0] : "");
      const want = String((m.options || [])[m.answer] ?? "");
      const same = got === want || (got !== "" && !isNaN(got) && !isNaN(want) && Number(got) === Number(want));
      add(same, "Answer confirmed by running SQL (SQLite)", same ? `returned ${got}` : `the check returned ${got}, but the marked answer is ${want}`);
    } catch (e) {
      add(false, "Answer confirmed by running SQL (SQLite)", `the check query failed: ${e.message}`);
    }
  }
  // duplicates: an exact copy anywhere in the bank fails; a similar question in the same level warns
  const others = allMcqs().filter((x) => x.id !== ignoreId);
  const exact = others.find((x) => mcqKey(x) === mcqKey(m));
  add(!exact, "Not an exact copy of an existing question", exact ? `same as: ${exact.q}` : "");
  const sameLevel = others.filter((x) => levelOfMcq(x) === levelOfMcq(m));
  const sim = mostSimilar(mcqText(m), sameLevel.map(mcqText));
  const twin = sameLevel.find((x) => mcqText(x) === sim.text);
  add(sim.score < 0.6, "Not a near-duplicate in its level", sim.score >= 0.4 ? `${Math.round(sim.score * 100)}% similar to: ${twin ? twin.q : ""}` : "", true);
  return summarize(checks);
}
// what a single read-only SELECT must contain to practise each topic (the others can't be
// practised by a SELECT drill: INSERT/UPDATE, schema, views, transactions, security)
const TOPIC_SQL = {
  select: /\bSELECT\b/i, where: /\bWHERE\b/i, order: /\bORDER\s+BY\b|\bLIMIT\b/i, join: /\bJOIN\b/i,
  group: /\bGROUP\s+BY\b/i, aggregates: /\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/i, subquery: /\(\s*SELECT\b/i,
  window: /\bOVER\s*\(|^\s*WITH\b/i, set: /\b(UNION|INTERSECT|EXCEPT)\b/i,
  functions: /\bCASE\b|\b(COALESCE|NULLIF|IFNULL|UPPER|LOWER|LENGTH|SUBSTR|SUBSTRING|ROUND|ABS|TRIM|REPLACE|CAST|CONCAT|INSTR)\s*\(/i,
  dates: /\b(DATE|STRFTIME|JULIANDAY|DATETIME|YEAR|MONTH|DAY|DATE_ADD|DATEDIFF)\s*\(/i,
  // write drills: run on a scratch MySQL copy and checked by the end state
  modify: /\b(INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM)\b/i, ddl: /\b(CREATE|ALTER|DROP)\s+TABLE\b/i,
  views: /\bCREATE\s+(OR\s+REPLACE\s+)?VIEW\b|\bCREATE\s+(UNIQUE\s+)?INDEX\b/i,
  tx: /\b(START\s+TRANSACTION|COMMIT|ROLLBACK|SAVEPOINT|CREATE\s+(TRIGGER|PROCEDURE|FUNCTION))\b/i,
};
const WRITE_TOPICS = ["modify", "ddl", "views", "tx"];
const isWriteDrill = (d) => WRITE_TOPICS.includes(d.topic) || (!!d.solution_sql && require("../library/writecheck.js").isWrite(d.solution_sql));
/** Runs a write drill's solution on a scratch MySQL copy: the "state" verifyDrill needs. */
async function stateFor(d) {
  if (!isWriteDrill(d) || !d.site || !d.solution_sql) return null;
  try { return await require("../library/writecheck.js").runOnDataset(d.site, d.solution_sql); }
  catch (e) { return { ok: false, error: /ECONNREFUSED|ETIMEDOUT/.test(String(e.code || e.message)) ? "MySQL is offline: start it to check this drill" : e.message }; }
}
async function verifyDrillAsync(d, ignoreId) { return verifyDrill(d, ignoreId, await stateFor(d)); }
function verifyDrill(d, ignoreId, state) {
  const checks = [];
  const add = (ok, label, detail, warn) => checks.push({ ok, warn: !!warn, label, detail: detail || "" });
  add(!!d.site && sqlFilesFor.all(d.site).length > 0, "Practice database exists", d.site);
  add(!!(d.title && d.title.trim()), "Title");
  add(!!(d.task && d.task.trim().length >= 20), "Task description");
  add(!!TOPICS[d.topic], "Topic", d.topic);
  add(DIFFS.includes(d.diff), "Difficulty", d.diff);
  let result = null;
  if (d.site && d.solution_sql && isWriteDrill(d)) {
    if (!state) add(false, "Solution runs on MySQL (scratch copy)", "not checked yet: save the drill to run it");
    else {
      add(state.ok, "Solution runs on MySQL (scratch copy)", state.ok ? "" : state.error);
      if (state.ok) {
        const keys = Object.keys(state.changed || {});
        add(keys.length > 0, "Solution changes the database", keys.length ? keys.map((k) => k.replace(":", " ")).join(", ") : "it changes nothing: learners' answers couldn't be compared with it");
      }
      result = { ok: state.ok, write: true, changes: Object.keys(state.changed || {}).map((k) => k.replace(":", " ")), error: state.ok ? undefined : state.error };
    }
  } else if (d.site && d.solution_sql) {
    result = runReadOnly(d.site, d.solution_sql);
    add(result.ok, "Solution runs on the track's data", result.ok ? `${result.count} row${result.count === 1 ? "" : "s"}` : result.error);
    if (result.ok) {
      add(result.count > 0, "Solution returns rows", result.count ? "" : "it returns no rows: learners couldn't tell a right answer from a wrong one");
      add(result.count <= 500, "Result is a sensible size", `${result.count} rows`, true);
    }
  } else add(false, "Solution SQL", "missing");
  if (d.solution_sql && TOPICS[d.topic]) {
    const re = TOPIC_SQL[d.topic];
    if (re) add(re.test(d.solution_sql), "Practises the chosen topic", re.test(d.solution_sql) ? TOPICS[d.topic] : `the solution doesn't use ${TOPICS[d.topic]}`);
    else add(false, "Practises the chosen topic", `a drill can't practise ${TOPICS[d.topic]}: use multiple-choice questions for it`, true);
  }
  // duplicates: an exact copy of any exercise in the library fails; a similar one in the target
  // level warns (the library: every exercise learners see, plus the other drills added in admin)
  const library = require("../library/library.js").get();
  const pool = library.active.filter((i) => !(i.source === "admin" && i.source_ref === ignoreId)).map((i) => ({ level: i.level, title: i.title, text: `${i.title} ${i.body}` }))
    .concat(customDrills().filter((x) => x.id !== ignoreId && x.status !== "published").map((x) => ({ level: Number(x.data.level), title: x.data.title, text: `${x.data.title} ${x.data.task}` })));
  const mine = `${d.title} ${d.task}`;
  const exact = pool.find((p) => exactKey(p.text) === exactKey(mine) || (exactKey(p.title) === exactKey(d.title) && exactKey(p.text).includes(exactKey(d.task))));
  add(!exact, "Not an exact copy of a library exercise", exact ? `same as “${exact.title}” (Level ${exact.level})` : "");
  const inLevel = pool.filter((p) => p.level === Number(d.level));
  const sim = mostSimilar(mine, inLevel.map((p) => p.text));
  add(sim.score < 0.55, `Not a near-duplicate in Level ${d.level}`, sim.score >= 0.35 ? `${Math.round(sim.score * 100)}% similar to: ${sim.text.slice(0, 120)}` : "", true);
  return { ...summarize(checks), result };
}
function summarize(checks) {
  const failed = checks.filter((c) => !c.ok && !c.warn).length;
  const warned = checks.filter((c) => !c.ok && c.warn).length;
  return { status: failed ? "fail" : warned ? "warn" : "pass", checks, at: now() };
}
function builtinDrillTexts(site) {
  const quizzes = db.prepare(`SELECT f.content FROM files f JOIN folders fo ON fo.id = f.folder_id WHERE fo.site_id = ? AND f.type = 'quiz'`).all(site);
  const out = [];
  for (const { content } of quizzes) {
    for (const m of content.matchAll(/^\d+\)\s*(.+)$/gm)) out.push(m[1]);
  }
  return out;
}

// ---------- reading content ----------
const allItems = (kind) => db.prepare("SELECT * FROM content_items WHERE kind = ? ORDER BY created_at DESC").all(kind).map(parse);
const customDrills = () => allItems("drill");
/** Every MCQ with its state: built-in (maybe edited or hidden) and added ones. */
function allMcqs() {
  const rows = new Map(allItems("mcq").map((r) => [r.id, r]));
  const out = BUILTIN_MCQS.map((b) => {
    const o = rows.get(b.id);
    rows.delete(b.id);
    const data = o && o.status !== "hidden" ? o.data : b;
    return { id: b.id, origin: "built-in", status: o && o.status === "hidden" ? "hidden" : "published", edited: !!o && o.status === "published", added_at: BUILTIN_ADDED, ...pick(data) };
  });
  for (const r of rows.values()) out.push({ id: r.id, origin: r.source.startsWith("ai") ? "generated" : r.source === "mine" ? "mine" : "added", status: r.status, edited: false, verify: r.verify, source: r.source, added_at: r.created_at, ...pick(r.data) });
  return out;
}
const pick = (m) => ({ topic: m.topic, level: levelOf(m), diff: m.diff, q: m.q, code: m.code || "", options: m.options, answer: m.answer, why: m.why, why_wrong: m.why_wrong, check: m.check || "" });
/** What learners see: live MCQs in the format of mcq/questions.js. */
function publicMcqs() {
  // approved upgrades (kind "card", card_type mcq_upgrade): why each wrong option is wrong
  const why = new Map();
  try { for (const r of db.prepare("SELECT data FROM stage_items WHERE kind = 'card' AND status = 'published' AND json_extract(data, '$.card_type') = 'mcq_upgrade'").all()) { const d = JSON.parse(r.data); if (d.base_id && Array.isArray(d.why_wrong)) why.set(d.base_id, d.why_wrong); } } catch { /* no stage_items yet */ }
  return allMcqs().filter((m) => m.status === "published").map((m) => ({ id: m.id, topic: m.topic, level: m.level, diff: m.diff, q: m.q, code: m.code || undefined, options: m.options, answer: m.answer, why: m.why, why_wrong: why.get(m.id) || (Array.isArray(m.why_wrong) && m.why_wrong.some(Boolean) ? m.why_wrong : undefined), added_at: m.added_at }));
}
function publicDrills() {
  return customDrills().filter((r) => r.status === "published").map((r) => ({ id: r.id, ...r.data }));
}

// ---------- writing content ----------
function getItem(id) { return parse(db.prepare("SELECT * FROM content_items WHERE id = ?").get(id)); }
function cleanMcq(m) {
  return {
    q: String(m.q || "").trim(), code: String(m.code || "").trim(), options: (m.options || []).slice(0, 5).map((o) => String(o).trim()),
    // why each wrong option is wrong (written by hand; generated MCQs get it from an approved upgrade)
    why_wrong: Array.isArray(m.why_wrong) && m.why_wrong.some((x) => String(x || "").trim()) ? (m.options || []).slice(0, 5).map((_, i) => String((m.why_wrong || [])[i] || "").trim()) : undefined,
    answer: Number(m.answer), why: String(m.why || "").trim(), topic: String(m.topic || ""), diff: String(m.diff || ""), check: String(m.check || "").trim(),
    level: Number(m.level) || TOPIC_LEVEL[m.topic] || 1,
  };
}
function cleanDrill(d) {
  const dataset = String(d.dataset || DATASET_OF_SITE[d.site] || "");
  const level = Number(d.level) || TOPIC_LEVEL[d.topic] || 1;
  return {
    dataset, site: DATASETS[dataset] ? DATASETS[dataset].site : String(d.site || ""), level, topic: String(d.topic || LEVEL_TOPIC[level]), diff: String(d.diff || ""), title: String(d.title || "").trim(),
    task: String(d.task || "").trim(), solution_sql: String(d.solution_sql || "").trim(),
    summary: String(d.summary || "").trim().slice(0, 110),
    // the learning model: 1-3 concepts and a stage (generated practise / transfer drills)
    concepts: Array.isArray(d.concepts) && d.concepts.length ? d.concepts.slice(0, 3).map(String) : undefined,
    stage: ["practise", "transfer"].includes(d.stage) ? d.stage : undefined,
    accepted: Array.isArray(d.accepted) ? d.accepted.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 5) : [],
    hints: Array.isArray(d.hints) ? d.hints.map((x) => String(x || "").trim()).filter(Boolean).slice(0, 3) : [],
    ordered: !!d.ordered,
  };
}
/** saveItem for callers that can wait: write drills get their MySQL check first. */
async function saveItemAsync(args) {
  const state = args.kind === "drill" ? await stateFor(cleanDrill(args.data || {})) : null;
  return saveItem({ ...args, state });
}
function saveItem({ id, kind, status, data, source, jobId, state }) {
  const clean = kind === "mcq" ? cleanMcq(data) : cleanDrill(data);
  const verify = kind === "mcq" ? verifyMcq(clean, id) : verifyDrill(clean, id, state);
  const existing = id && getItem(id);
  if (existing) {
    db.prepare("UPDATE content_items SET status = ?, data = ?, verify = ?, updated_at = ? WHERE id = ?").run(status || existing.status, JSON.stringify(clean), JSON.stringify(verify), now(), id);
  } else {
    id = id || newId(kind === "mcq" ? "mcq-x" : "drill-x");
    db.prepare("INSERT INTO content_items (id, kind, status, data, verify, source, job_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, kind, status || "draft", JSON.stringify(clean), JSON.stringify(verify), source || "manual", jobId || null, now(), now());
  }
  return getItem(id);
}
function setStatus(id, status) {
  const builtin = BUILTIN_MCQS.find((b) => b.id === id);
  const row = getItem(id);
  if (builtin && !row) return saveItem({ id, kind: "mcq", status, data: builtin, source: "built-in" });
  if (!row) throw Object.assign(new Error("No such item"), { status: 404 });
  db.prepare("UPDATE content_items SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), id);
  return getItem(id);
}
function removeItem(id) {
  // for a built-in MCQ this drops the edit/hide and restores the original
  return db.prepare("DELETE FROM content_items WHERE id = ?").run(id).changes;
}

// ---------- the generation machine ----------
function extractJson(text) {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const body = fenced ? fenced[1] : text;
  const start = body.indexOf("["), end = body.lastIndexOf("]");
  if (start < 0 || end < start) throw new Error("The AI didn't return a JSON list.");
  return JSON.parse(body.slice(start, end + 1));
}
const levelName = (p) => LEVELS[(Number(p.level) || TOPIC_LEVEL[p.topic] || 1) - 1];
function mcqPrompt({ topic, diff, count, notes }) {
  const sample = BUILTIN_MCQS.filter((b) => b.topic === topic).slice(0, 2);
  const existing = allMcqs().filter((m) => m.topic === topic).map((m) => `- ${m.q}`).slice(0, 40).join("\n");
  return {
    system: [
      "You write multiple-choice questions for people learning SQL. Every question must be correct, unambiguous and have exactly one right answer.",
      "Rules: four options; plausible wrong options based on real beginner mistakes; no 'all of the above' / 'none of the above'; options short; the right answer at a random position.",
      "If behaviour differs between databases, name the database in the question (SQLite, MySQL, PostgreSQL).",
      "`why` explains in 1-3 sentences why the answer is right (and the trap in the wrong ones).",
      "Only when the right option is literally a value a query returns (a number, NULL, a short string), add `check`: a self-contained SQLite query (CTEs / VALUES, no tables) whose single result equals the right option's text exactly. Never add `check` to conceptual questions.",
      "Double-check every marked answer before replying: a wrong answer key is the worst possible mistake.",
      "Reply with ONLY a JSON array, no prose.",
    ].join("\n"),
    user: [
      `Write ${count} new ${diff} multiple-choice questions for the level "${levelName(arguments[0])}": ${TOPICS[topic]}.`,
      notes ? `Extra instructions: ${notes}` : "",
      `Format: [{"q": "...", "code": "optional SQL shown with the question", "options": ["...","...","...","..."], "answer": 0-3, "why": "...", "check": "optional SQLite query"}]`,
      `Two examples of the style:\n${JSON.stringify(sample.map((s) => ({ q: s.q, code: s.code, options: s.options, answer: s.answer, why: s.why, check: s.check })), null, 1)}`,
      existing ? `Don't repeat these existing questions:\n${existing}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}
function drillPrompt({ site, topic, diff, count, notes }) {
  const titles = builtinDrillTexts(site).concat(customDrills().filter((x) => x.data.site === site).map((x) => x.data.title)).slice(0, 60).map((t) => `- ${t}`).join("\n");
  return {
    system: [
      "You write SQL practice exercises for learners, on an existing SQLite database whose schema and sample rows you are given.",
      "Each exercise: a short title, a clear task in plain English that says exactly which columns to show and how to sort (if order matters), and a solution.",
      WRITE_TOPICS.includes(topic)
        ? "The solution is the MySQL 8 statement(s) that do exactly what the task asks (INSERT / UPDATE / DELETE, CREATE / ALTER TABLE, CREATE VIEW / INDEX, transactions, triggers or procedures as one CREATE ... BEGIN ... END without DELIMITER lines), using only tables and columns from the schema. It is checked by running it on a fresh copy of the database and comparing the end state, so the task must pin down every value, name, type and constraint the learner has to use. It must change something; don't create databases, users or privileges."
        : "The solution must be ONE SQLite SELECT (or WITH ... SELECT) statement that uses only tables and columns from the schema, and returns between 1 and 200 rows.",
      "Don't reveal the solution in the task. Don't ask for anything the data can't answer.",
      "Reply with ONLY a JSON array, no prose.",
    ].join("\n"),
    user: [
      `Database schema (SQLite):\n${schemaText(site)}`,
      `Write ${count} new ${diff} exercises for the level "${levelName(arguments[0])}", practising ${TOPICS[topic]}.`,
      notes ? `Extra instructions: ${notes}` : "",
      `Format: [{"title": "...", "task": "...", "solution_sql": "${WRITE_TOPICS.includes(topic) ? "..." : "SELECT ..."}"}]`,
      titles ? `Existing exercises on this database (don't repeat them):\n${titles}` : "",
    ].filter(Boolean).join("\n\n"),
  };
}

// ---------- independent AI review ----------
// A second model (a different provider when one is set up) checks each draft: is the marked
// answer right and unambiguous / does the solution do exactly what the task says?
function reviewerFor(usedProvider) {
  const ready = listProviders().filter((p) => p.id !== "auto" && p.configured).map((p) => p.id);
  const id = require("./settings.js").reviewerFor(usedProvider, ready);
  if (!id) throw new Error("no second AI provider is set up, so drafts can't get an independent review");
  return id;
}
async function reviewDrafts(kind, items, usedProvider) {
  const provider = reviewerFor(usedProvider);
  const shown = items.map((it, i) => {
    const d = it.data;
    if (kind === "mcq") return { i, must_be_about: TOPICS[d.topic], question: d.q, code: d.code || undefined, options: d.options, marked_answer: d.options[d.answer], explanation: d.why };
    const r = it.verify && it.verify.result;
    return { i, must_practise: TOPICS[d.topic], task: d.task, solution_sql: d.solution_sql, ...(r && r.write ? { runs_on: "MySQL 8, checked by the end state", changes_on_a_copy: r.changes } : { result_columns: r && r.columns, first_rows: r && r.rows && r.rows.slice(0, 5), row_count: r && r.count }) };
  });
  const answer = await complete({
    provider,
    model: require("../hints.js").generationModel(provider),
    maxTokens: 300 * items.length + 300,
    system: kind === "mcq"
      ? "You are a strict reviewer of SQL multiple-choice questions. For each, decide whether the marked answer is correct and the only defensible answer, the question is clear, and it is about its must_be_about topic. Reply with ONLY a JSON array: [{\"i\": 0, \"ok\": true|false, \"issue\": \"short reason when not ok\"}]."
      : "You are a strict reviewer of SQL practice exercises. For each, decide whether the solution does exactly what the task asks (columns, filters, sort order), whether the task is clear enough to get that result, and whether the exercise genuinely practises its must_practise topic (ok=false when it doesn't need that topic at all). Reply with ONLY a JSON array: [{\"i\": 0, \"ok\": true|false, \"issue\": \"short reason when not ok\"}].",
    user: JSON.stringify(shown, null, 1),
  });
  const verdicts = extractJson(answer.text);
  const who = `${answer.label} (${answer.model})`;
  for (const v of verdicts) {
    const it = items[v.i];
    if (!it || !it.verify) continue;
    const checks = it.verify.checks.concat([{ ok: !!v.ok, warn: false, label: "Independent AI review", detail: v.ok ? `approved by ${who}` : `${who}: ${v.issue || "disputes this item"}` }]);
    const verify = { ...summarize(checks), result: it.verify.result };
    db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify(verify), it.id);
    it.verify = verify;
  }
  return who;
}

const running = new Map();
function startJob(kind, params) {
  const p = { ...params };
  p.count = Math.max(1, Math.min(10, Number(p.count) || 5));
  if (p.level) { p.level = Number(p.level); if (!LEVELS[p.level - 1]) throw Object.assign(new Error("Pick a level."), { status: 400 }); p.topic = p.topic && TOPICS[p.topic] ? p.topic : LEVEL_TOPIC[p.level]; }
  if (p.dataset) p.site = DATASETS[p.dataset] ? DATASETS[p.dataset].site : "";
  if (!TOPICS[p.topic]) throw Object.assign(new Error("Pick a level."), { status: 400 });
  if (!p.level) p.level = TOPIC_LEVEL[p.topic];
  if (!DIFFS.includes(p.diff)) throw Object.assign(new Error("Pick a difficulty."), { status: 400 });
  if (kind === "drill" && !(p.site && sqlFilesFor.all(p.site).length)) throw Object.assign(new Error("Pick a practice database."), { status: 400 });
  if (kind !== "mcq" && kind !== "drill") throw Object.assign(new Error("Unknown kind"), { status: 400 });
  const id = newId("job");
  db.prepare("INSERT INTO generation_jobs (id, kind, params, status, progress, created_at) VALUES (?, ?, ?, 'running', 'Starting…', ?)").run(id, kind, JSON.stringify(p), now());
  const work = (async () => {
    try {
      const prompt = kind === "mcq" ? mcqPrompt(p) : drillPrompt(p);
      setProgress(id, `Asking the AI for ${p.count} draft${p.count === 1 ? "" : "s"}…`);
      const answer = await complete({ provider: p.provider || "auto", forGeneration: true, model: p.provider && p.provider !== "auto" ? require("../hints.js").generationModel(p.provider) : undefined, order: require("./settings.js").providerOrder().generate, ...prompt, maxTokens: 900 * p.count + 600 });
      const list = extractJson(answer.text);
      if (!Array.isArray(list) || !list.length) throw new Error("The AI returned no items.");
      let verified = 0;
      const source = `ai:${answer.provider} ${answer.model}`;
      const saved = [];
      const take = list.slice(0, p.count);
      for (const [k, raw] of take.entries()) {
        setProgress(id, `Checking draft ${k + 1} of ${take.length}…`);
        const data = kind === "mcq"
          ? { ...raw, answer: Number(raw.answer), topic: p.topic, diff: p.diff, level: p.level }
          : { site: p.site, dataset: p.dataset || DATASET_OF_SITE[p.site], level: p.level, topic: p.topic, diff: p.diff, title: raw.title, task: raw.task, solution_sql: raw.solution_sql };
        saved.push(await saveItemAsync({ kind, status: "draft", data, source, jobId: id }));
      }
      let reviewer = "";
      setProgress(id, "Independent AI review…");
      try {
        reviewer = await reviewDrafts(kind, saved, answer.provider);
      } catch (e) {
        reviewer = `review failed: ${e.message}`;
      }
      verified = saved.filter((it) => it.verify.status !== "fail").length;
      setProgress(id, null);
      db.prepare("UPDATE generation_jobs SET status = 'done', provider = ?, produced = ?, verified = ?, error = ?, finished_at = ? WHERE id = ?")
        .run(`${answer.label} (${answer.model}), reviewed by ${reviewer}`, Math.min(list.length, p.count), verified, answer.fellBackFrom.length ? `Fell back from: ${answer.fellBackFrom.map((f) => f.label).join(", ")}` : null, now(), id);
    } catch (e) {
      db.prepare("UPDATE generation_jobs SET status = 'failed', error = ?, progress = NULL, finished_at = ? WHERE id = ?").run(e.message, now(), id);
    } finally {
      running.delete(id);
    }
  })();
  running.set(id, work);
  return getJob(id);
}
const parseJob = (j) => j && { ...j, params: JSON.parse(j.params) };
function getJob(id) { return parseJob(db.prepare("SELECT * FROM generation_jobs WHERE id = ?").get(id)); }
function listJobs(limit = 30) { return db.prepare("SELECT * FROM generation_jobs ORDER BY created_at DESC LIMIT ?").all(limit).map(parseJob); }
// Jobs still marked running from before a restart can't finish.
db.prepare("UPDATE generation_jobs SET status = 'failed', error = 'Interrupted by a server restart', finished_at = ? WHERE status = 'running'").run(now());

module.exports = {
  LEVELS, LEVEL_TOPIC, TOPIC_LEVEL, DATASETS, registerDataset, reloadCustomDatasets,
  TOPICS, DIFFS, allItems, allMcqs, publicMcqs, publicDrills, customDrills, getItem, saveItem, setStatus, removeItem,
  MCQ_OPTIONS, verifyMcq, verifyDrill, verifyDrillAsync, saveItemAsync, WRITE_TOPICS, cleanDrill, cleanMcq, isWriteDrill, runReadOnly, runAll, schemaText, startJob, getJob, listJobs, freshDataset,
};
