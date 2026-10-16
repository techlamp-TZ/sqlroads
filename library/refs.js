// Reference answers for the built-in drills (they came without any). For each drill:
//   1. Claude and OpenAI each write a solution on their own; both are run on the drill's dataset.
//   2. Retry with feedback: a side whose query fails, that gives no usable answer, or that returns
//      no rows (while the other returns some) is asked once more, with the error and the schema.
//   3. Same rows, different columns (a vague prompt): a stronger model (Claude Sonnet) picks the
//      solution that fits the task and rewrites the prompt to name its columns; the original
//      prompt is kept for audit.
//   4. Tie-breaker: anything still unresolved gets an independent third solution from Claude Sonnet;
//      if it matches A or B, that one is accepted. Only true three-way disagreements need a person.
// Outcomes (drill_refs.status): matched (result-checked from then on) / review / not_query.
// Results are compared with public/compare.js, exactly as the learner's "Check answer" does.
// Runs as a resumable background job: drills that already have a row are skipped.
const db = require("../db.js");
const library = require("./library.js");
const content = require("../admin/content.js");
const { complete } = require("../hints.js");
const SqlCompare = require("../public/compare.js");

db.exec(`
  CREATE TABLE IF NOT EXISTS ref_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, levels TEXT NOT NULL, status TEXT NOT NULL, progress TEXT,
    total INTEGER NOT NULL DEFAULT 0, processed INTEGER NOT NULL DEFAULT 0,
    matched INTEGER NOT NULL DEFAULT 0, review INTEGER NOT NULL DEFAULT 0, not_query INTEGER NOT NULL DEFAULT 0, errors INTEGER NOT NULL DEFAULT 0,
    usage TEXT, started_at TEXT NOT NULL, finished_at TEXT, error TEXT
  );
`);
const addColumn = (table, col, type) => { if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); };
for (const [col, type] of [["c", "TEXT"], ["history", "TEXT"], ["resolution", "TEXT"], ["prompt_original", "TEXT"], ["prompt_rewritten", "TEXT"], ["mode", "TEXT"], ["setup", "TEXT"], ["free_values", "INTEGER"], ["model_answer", "TEXT"], ["fix", "TEXT"], ["probe", "TEXT"], ["probe_rows", "TEXT"], ["result_rows", "TEXT"], ["tx_rows", "TEXT"], ["accepted", "TEXT"]]) addColumn("drill_refs", col, type);
addColumn("ref_jobs", "mode", "TEXT");
addColumn("ref_jobs", "resolutions", "TEXT");
addColumn("ref_jobs", "queue_before", "INTEGER");
addColumn("ref_jobs", "queue_after", "INTEGER");
// a job that was running when the server stopped can be resumed
db.prepare("UPDATE ref_jobs SET status = 'stopped', progress = 'Stopped when the server restarted: press Resume.' WHERE status = 'running'").run();

// A and B: the generator and the reviewer (two different providers); the tie-breaker: Claude Sonnet (hints.js roles)
const { ROLES, PRICE, generationModel } = require("../hints.js");
const PROVIDERS = [ROLES.generator.provider, ROLES.reviewer.provider];
const STRONG = ROLES.tieBreaker;
const CONCURRENCY = 4;

const SYSTEM = `You write the reference answer for a SQL practice exercise. The learner's query runs in SQLite on the dataset described below.
Reply with ONLY one JSON object, no prose:
- {"kind": "select", "sql": "..."} - one read-only SELECT (WITH ... SELECT is fine) that answers the exercise exactly: the columns it asks for, in the order it names them; ORDER BY only when the exercise asks for an order; no LIMIT unless it asks for a number of rows.
- {"kind": "not_a_query", "why": "..."} - when one SELECT can't answer it: it asks to insert, update, delete or change structure, or to explain something in words.
SQLite notes: integer / integer truncates (multiply by 1.0 for decimals); there is no XOR; concatenate with ||; dates are text (use date(), strftime()).`;

const siteOf = (item) => Object.keys(library.DATASETS).find((k) => library.DATASETS[k].key === item.dataset);
const taskText = (item) => String(item.body || "").replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "the exercise “$1”");
function context(item) {
  const site = siteOf(item);
  return { site, user: `DATASET (SQLite):\n${content.schemaText(site)}\n\n` + (item.intro ? `CHAPTER NOTES:\n${String(item.intro).slice(0, 1500)}\n\n` : "") + `EXERCISE: ${item.title}\n${taskText(item)}` };
}
function parse(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return { kind: "error", why: "no JSON in the answer" };
  try {
    const o = JSON.parse(m[0]);
    if (o.kind === "select" && typeof o.sql === "string" && o.sql.trim()) return { kind: "select", sql: o.sql.trim() };
    if (o.kind === "not_a_query") return { kind: "not_a_query", why: String(o.why || "") };
    return { kind: "error", why: "the JSON had no usable answer", raw: m[0].slice(0, 400) };
  } catch { /* fall through */ }
  return { kind: "error", why: "the answer wasn't valid JSON", raw: String(text || "").slice(0, 400) };
}

function sameResult(a, b, ordered) {
  if ((a && a.sample) !== (b && b.sample)) return { same: false, why: "different sample sizes (" + ((a && a.sample) || "all") + " vs " + ((b && b.sample) || "all") + " rows)" };
  const c = SqlCompare.compare(a, b, ordered);
  return c.ok ? { same: true } : { same: false, why: a.columns.length !== b.columns.length ? `${a.columns.length} vs ${b.columns.length} columns` : a.count !== b.count ? `${a.count} vs ${b.count} rows` : /order/.test(c.reason) ? "same rows, different order (the exercise asks for an order)" : "different rows" };
}
// same rows, the narrower result's columns all found (by their values) in the wider one
function sameRowsDifferentColumns(a, b) {
  if (!(a.ok && b.ok) || a.count !== b.count || a.columns.length === b.columns.length || !a.count) return false;
  const [narrow, wide] = a.columns.length < b.columns.length ? [a, b] : [b, a];
  const col = (r, k) => r.rows.map((row) => SqlCompare.cell(row[k])).sort().join("\u0001");
  const wideCols = wide.columns.map((_, k) => col(wide, k));
  return narrow.columns.every((_, k) => wideCols.includes(col(narrow, k)));
}
const preview = (r) => (r && r.ok ? { columns: r.columns, rows: r.rows.slice(0, 15), count: r.count } : null);

function makeAsk(usage) {
  return (who, system, user, maxTokens = 900) => complete({ provider: who.provider, model: who.model || generationModel(who.provider), system, user, maxTokens, onUsage: (u) => {
    usage[u.model] = usage[u.model] || { provider: u.provider, input: 0, output: 0, calls: 0 };
    usage[u.model].input += u.input; usage[u.model].output += u.output; usage[u.model].calls++;
  } });
}
function runSide(site, s, setup) {
  if (s.kind === "select") {
    s.result = content.runAll(site, asChecked(s.sql), 5000, setup || null);
    // a random sample: the sizes must agree too
    const sp = SqlCompare.samplePool(s.sql);
    if (sp && s.result.ok) s.result.sample = sp.limit;
    if (!s.result.ok) { s.kind = "error"; s.why = "the query failed: " + s.result.error; }
  }
  return s;
}
const side = (s) => s && ({ provider: s.provider, model: s.model || null, kind: s.kind, sql: s.sql || null, why: s.why || null, result: preview(s.result), error: s.result && !s.result.ok ? s.result.error : null, retried: s.retried || undefined });

/**
 * One drill through the whole pipeline. existing = { a, b } from an earlier run: their SQL is run
 * again instead of asking the providers anew.
 */
async function solveOne(item, usage, existing, opts = {}) {
  const ask = makeAsk(usage);
  const setup = opts.setup || null; // rows the drill adds before its query (zero-row drills)
  const { site, user } = context(item);
  const ordered = SqlCompare.asksForOrder(`${item.title} ${item.body}`);
  const history = [];
  const note = (step, detail) => history.push({ step, detail, at: new Date().toISOString() });

  // 1. two independent solutions
  const first = async (provider) => {
    const prev = existing && [existing.a, existing.b].find((x) => x && x.provider === provider);
    if (prev && (prev.kind === "select" || prev.kind === "not_a_query")) return { provider, model: prev.model, kind: prev.kind, sql: prev.sql, why: prev.why };
    try { const r = await ask({ provider }, SYSTEM, user); return { provider, model: r.model, ...parse(r.text) }; } catch (e) { return { provider, kind: "error", why: e.message.slice(0, 200) }; }
  };
  const [a, b] = await Promise.all(PROVIDERS.map(first));
  runSide(site, a, setup); runSide(site, b, setup);

  // 2. retry with feedback: an error, no usable answer, or no rows while the other side has rows
  const needsRetry = (s, other) => s.kind === "error" || (s.kind === "select" && !s.result.count && other.kind === "select" && other.result.count);
  await Promise.all([[a, b], [b, a]].map(async ([s, other]) => {
    if (!needsRetry(s, other)) return;
    const before = s.sql || s.raw || "(no usable answer)";
    const problem = s.kind === "error" ? s.why : "it returned no rows, but the exercise expects some";
    try {
      const r = await ask({ provider: s.provider }, SYSTEM, `${user}\n\nYOUR PREVIOUS ANSWER:\n${before}\nPROBLEM: ${problem}\nCheck the table and column names against the dataset above and answer again with the JSON object.`);
      const again = runSide(site, { provider: s.provider, model: r.model, ...parse(r.text) }, setup);
      note("retry", { provider: s.provider, before, problem, after: again.sql || again.why, ok: again.kind === "select" && again.result.count > 0 });
      Object.assign(s, again, { retried: true });
    } catch (e) { note("retry", { provider: s.provider, before, problem, after: null, error: e.message.slice(0, 160) }); }
  }));

  const done = (status, extra) => ({ status, ordered, a, b, history, ...extra });
  if (a.kind === "not_a_query" && b.kind === "not_a_query") return done("not_query", { reason: "both providers: one SELECT can't answer it" });

  if (a.kind === "select" && b.kind === "select") {
    const cmp = sameResult(a.result, b.result, ordered);
    if (cmp.same && a.result.count) return done("matched", { chosen: a, resolution: history.length ? "agreed after a retry" : "agreed" });
    if (cmp.same) return done("review", { reason: "both solutions return no rows, so a learner's answer couldn't be told apart from a wrong one" });

    // 3. same rows, different columns: the prompt is vague - name the columns
    if (sameRowsDifferentColumns(a.result, b.result)) {
      try {
        const r = await ask(STRONG, `You fix vague SQL practice exercises. Two correct solutions return the same rows but different columns because the exercise doesn't say which columns to show. Pick the solution whose columns best fit what the exercise asks, and rewrite the exercise text so it names exactly those columns, in that order, in plain words (for example "Show the name and population of ..."). Keep the rest of the wording, meaning, tables and values the same; keep it about as short as the original. Reply with ONLY JSON: {"keep": "a" | "b", "prompt": "the rewritten exercise text"}.`,
          `EXERCISE: ${item.title}\n${taskText(item)}\n\nSOLUTION A:\n${a.sql}\nCOLUMNS: ${a.result.columns.join(", ")}\nFIRST ROWS: ${JSON.stringify(a.result.rows.slice(0, 3))}\n\nSOLUTION B:\n${b.sql}\nCOLUMNS: ${b.result.columns.join(", ")}\nFIRST ROWS: ${JSON.stringify(b.result.rows.slice(0, 3))}`, 1500);
        const m = String(r.text).match(/\{[\s\S]*\}/);
        const o = m ? JSON.parse(m[0]) : {};
        if ((o.keep === "a" || o.keep === "b") && typeof o.prompt === "string" && o.prompt.trim().length >= 15) {
          const chosen = o.keep === "a" ? a : b;
          note("prompt_rewrite", { keep: o.keep, columns: chosen.result.columns, original: taskText(item), rewritten: o.prompt.trim(), by: r.model });
          return done("matched", { chosen, resolution: "prompt rewritten to name the columns", prompt_original: taskText(item), prompt_rewritten: o.prompt.trim() });
        }
        note("prompt_rewrite", { failed: "the rewrite answer was unusable" });
      } catch (e) { note("prompt_rewrite", { failed: e.message.slice(0, 160) }); }
    }
  }

  // 4. tie-breaker: an independent third solution from a stronger model
  let c = null;
  try {
    const r = await ask(STRONG, SYSTEM, user, 2000);
    c = runSide(site, { provider: "claude", model: r.model, ...parse(r.text) }, setup);
  } catch (e) { c = { provider: "claude", model: STRONG.model, kind: "error", why: e.message.slice(0, 200) }; }
  const pick = [a, b].find((s) => s.kind === "select" && c.kind === "select" && s.result.count && sameResult(s.result, c.result, ordered).same);
  note("tiebreak", { by: c.model, kind: c.kind, sql: c.sql || null, why: c.why || null, matches: pick ? (pick === a ? "a" : "b") : null });
  if (pick) return done("matched", { chosen: { ...pick, freeValues: pick.freeValues || c.freeValues }, c, resolution: `tie-breaker matched ${pick === a ? "A" : "B"}` });
  const votes = [a, b, c].filter((s) => s.kind === "not_a_query").length;
  if (votes >= 2) return done("not_query", { c, reason: "two of three models: one SELECT can't answer it" });
  const why = [a, b, c].map((s, k) => `${"ABC"[k]}: ${s.kind === "select" ? `${s.result.count} rows × ${s.result.columns.length} columns` : s.kind === "not_a_query" ? "not a single query" : s.why}`).join(" · ");
  // the tie-breaker couldn't run (e.g. no Anthropic credit): the drill waits for a person instead of failing
  if (c.kind === "error") return done("review", { c, manualReview: true, reason: "manual review: the tie-breaker (" + STRONG.model + ") is unavailable (" + c.why.slice(0, 120) + "); " + why });
  return done("review", { c, reason: "three different answers: " + why });
}

// "now" no longer counts: every query runs at the frozen clock (SqlCompare.freezeClock). RANDOM() does, except a
// plain random sample (ORDER BY RANDOM() LIMIT n), which is checked against its pool.
const VOLATILE = { test: (sql) => /\brandom\s*\(/i.test(sql) && !SqlCompare.samplePool(sql) };
/** The query as the checker runs it: frozen clock; a random sample becomes its pool. */
const asChecked = (sql) => { const p = SqlCompare.samplePool(sql); return SqlCompare.freezeClock(p ? p.pool : sql); };
// ---- write-query drills: statements that change data or structure, checked by the end state on MySQL
const writecheck = require("./writecheck.js");
const SYSTEM_WRITE = `You write the reference answer for a SQL practice exercise that changes data or structure. It runs on MySQL 8, in a database that already contains the tables described below (it is already selected).
Reply with ONLY one JSON object, no prose:
- {"kind": "sql", "sql": "...", "setup": "...", "free_values": false} - the statement(s), separated by semicolons, that do exactly what the exercise asks and nothing more (INSERT / UPDATE / DELETE / CREATE / ALTER / DROP / CREATE VIEW / CREATE INDEX / CREATE PROCEDURE / CREATE TRIGGER / transactions). Write routines and triggers as one CREATE statement with a BEGIN ... END body and no DELIMITER lines. When the exercise lets the learner pick values ("a game of your choosing"), use simple, clearly made-up values and set "free_values": true (the check then compares structure and row counts, not the values).
  "setup" (optional, usually omitted): when the exercise works on an object that an EARLIER exercise of the chapter created and that is NOT in the dataset (a view to drop, a table to alter or fill), put the statements that create it here, exactly as the earlier exercise would; they run before your answer and aren't part of it.
- {"kind": "not_sql", "why": "..."} - when running SQL can't answer it: it asks to explain or describe something in words, compare approaches, manage users / roles / privileges, or create a database.
Don't create or change databases, users or privileges; don't write USE.`;
function writeSide(provider, model, parsed) {
  const o = { provider, model };
  if (parsed.kind === "sql" && typeof parsed.sql === "string" && parsed.sql.trim()) return { ...o, kind: "sql", sql: parsed.sql.trim(), setup: typeof parsed.setup === "string" && parsed.setup.trim() ? parsed.setup.trim() : null, freeValues: parsed.free_values === true };
  if (parsed.kind === "not_sql") return { ...o, kind: "not_sql", why: String(parsed.why || "") };
  return { ...o, kind: "error", why: parsed.why || "no usable answer" };
}
function parseWrite(text) {
  const m = String(text || "").match(/\{[\s\S]*\}/);
  if (!m) return { kind: "error", why: "no JSON in the answer" };
  try { return JSON.parse(m[0]); } catch { return { kind: "error", why: "the answer wasn't valid JSON" }; }
}
async function runWriteSide(site, side, probe) {
  if (side.kind !== "sql") return side;
  try {
    const r = await writecheck.runOnDataset(site, side.sql, side.setup, probe ? { probe } : {});
    if (!r.ok) return { ...side, kind: "error", why: r.setupFailed ? r.error : "the statements failed: " + r.error };
    const inTx = r.inTx && Object.keys(r.inTx).length ? r.inTx : undefined;
    if (!Object.keys(r.changed).length && !r.result && !inTx) return { ...side, kind: "error", why: "the statements ran but changed nothing in the database and returned no rows", changed: {} };
    return { ...side, changed: r.changed, result: Object.keys(r.changed).length || inTx ? null : r.result, inTx, probed: r.probed, probeError: r.probeError };
  } catch (e) {
    if (/ECONNREFUSED|ETIMEDOUT/.test(String(e.code || e.message))) throw Object.assign(new Error("MySQL is offline"), { offline: true });
    return { ...side, kind: "error", why: e.message.slice(0, 200) };
  }
}
const SYSTEM_PROBE = `You write a behaviour test for a SQL practice drill about a trigger. The test runs after a learner's CREATE TRIGGER on a copy of the database; the table state it leaves behind is compared with the reference trigger's, so it must make a right trigger and a wrong one end differently.
Reply with ONLY one JSON object, no prose: {"probe": "statements"}
- 1 to 4 MySQL 8 INSERT / UPDATE / DELETE statements on the dataset's tables, with fixed literal values, that fire the trigger the exercise asks for and exercise what it is meant to do (a value it should change or check, a row it should write elsewhere, a case it should leave alone).
- New rows use keys that can't collide with existing ones (for example ids from 9001). Fill every NOT NULL column that has no default.
- Don't create, alter or drop anything, and don't call routines.`;
async function makeProbe(item, side, usage, note) {
  const ask = makeAsk(usage);
  const site = siteOf(item);
  const user = `DATASET (MySQL):\n${content.schemaText(site)}\n\nEXERCISE: ${item.title}\n${taskText(item)}\n\nA TRIGGER THAT ANSWERS IT:\n${side.sql}` + (side.setup ? `\n\nSET UP BEFORE IT:\n${side.setup}` : "");
  let extra = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    let probe = "";
    try { probe = String(parseWrite((await ask(STRONG, SYSTEM_PROBE, user + extra, 800)).text).probe || "").trim(); } catch (e) { note("behaviour test", { problem: e.message }); return null; }
    if (!probe) { extra = "\n\nYour last answer had no \"probe\". Reply with the JSON object."; continue; }
    // it must run with and without the trigger, and the trigger must change what it leaves behind
    const [withT, without] = await Promise.all([writecheck.runOnDataset(site, side.sql, side.setup, { probe }), writecheck.runOnDataset(site, "DO 0", side.setup, { probe })]);
    const problem = !withT.ok ? "the trigger itself failed: " + withT.error : withT.probeError ? "the test failed after the trigger: " + withT.probeError : without.probeError ? "the test failed on the plain database: " + without.probeError
      : writecheck.compareStates(withT.probed, without.probed).same ? "the tables end the same with and without the trigger, so the test doesn't show what it does" : null;
    note("behaviour test", { sql: probe, ok: !problem, problem: problem || undefined });
    if (!problem) return probe;
    extra = `\n\nYOUR LAST TEST:\n${probe}\nPROBLEM: ${problem}\nWrite a better one.`;
  }
  return null;
}
const summaryOf = (changed) => Object.keys(changed || {}).map((k) => k.replace(":", " ")).join(", ");
async function solveWrite(item, usage, opts = {}) {
  const ask = makeAsk(usage);
  const site = siteOf(item);
  const earlier = library.get().active.filter((j) => j.chapterKey && j.chapterKey === item.chapterKey && j.order < item.order).sort((x, y) => x.order - y.order).slice(-6);
  const user = `DATASET (MySQL):\n${content.schemaText(site)}\n\n` + (item.intro ? `CHAPTER NOTES:\n${String(item.intro).slice(0, 1500)}\n\n` : "")
    + (earlier.length ? `EARLIER EXERCISES IN THIS CHAPTER (for context only):\n${earlier.map((j) => `- ${j.title}: ${taskText(j).slice(0, 300)}`).join("\n")}\n\n` : "") + `EXERCISE: ${item.title}\n${taskText(item)}` + (opts.setup ? `\n\nALREADY SET UP BEFORE YOUR ANSWER RUNS (leave "setup" empty):\n${opts.setup}` : "");
  const history = [];
  const note = (step, detail) => history.push({ step, detail, at: new Date().toISOString() });
  const fixed = (s) => (opts.setup && s.kind === "sql" ? { ...s, setup: opts.setup } : s);
  const askOne = async (who, extra) => { try { const r = await ask(who, SYSTEM_WRITE, user + (extra || ""), 1500); return fixed(writeSide(who.provider, r.model, parseWrite(r.text))); } catch (e) { return { provider: who.provider, model: who.model, kind: "error", why: e.message.slice(0, 200) }; } };
  let [a, b] = await Promise.all(PROVIDERS.map((p) => askOne({ provider: p })));
  [a, b] = await Promise.all([runWriteSide(site, a), runWriteSide(site, b)]);
  // retry with feedback
  const retried = await Promise.all([a, b].map(async (x) => {
    if (x.kind !== "error") return x;
    const again = await runWriteSide(site, await askOne({ provider: x.provider }, `\n\nYOUR PREVIOUS ANSWER:\n${x.sql || "(no usable answer)"}\nPROBLEM: ${x.why}\nCheck the table and column names against the dataset above and answer again with the JSON object.`));
    note("retry", { provider: x.provider, before: x.sql || "(no usable answer)", problem: x.why, after: again.sql || again.why, ok: again.kind === "sql" });
    return { ...again, retried: true };
  }));
  [a, b] = retried;
  // trigger drills: a fixed test fires the trigger, so what it does is compared, not only that it exists
  let probe = opts.probe || null;
  const trig = [a, b].find((x) => x.kind === "sql" && Object.keys(x.changed || {}).some((k) => k.startsWith("trigger:")));
  if (!probe && trig) probe = await makeProbe(item, trig, usage, note);
  if (probe) [a, b] = await Promise.all([a, b].map((x) => runWriteSide(site, x, probe)));
  const done = (status, extra) => ({ status, mode: "state", a, b, history, probe, ...extra });
  if (a.kind === "not_sql" && b.kind === "not_sql") return done("not_query", { reason: "both providers: running SQL can't answer it (" + (a.why || b.why || "an explanation") + ")" });
  if (a.kind === "sql" && b.kind === "sql") {
    const cmp = writecheck.compareRuns(a, b, { freeValues: a.freeValues || b.freeValues });
    if (cmp.same) return done("matched", { chosen: { ...a, freeValues: a.freeValues || b.freeValues }, resolution: history.length ? "agreed after a retry" : "agreed" });
  }
  // tie-breaker
  const c = await runWriteSide(site, await askOne(STRONG), probe);
  const pick = [a, b].find((x) => x.kind === "sql" && c.kind === "sql" && writecheck.compareRuns(x, c, { freeValues: x.freeValues || c.freeValues }).same);
  note("tiebreak", { by: c.model, kind: c.kind, sql: c.sql || null, why: c.why || null, matches: pick ? (pick === a ? "a" : "b") : null });
  if (pick) return done("matched", { chosen: pick, c, resolution: `tie-breaker matched ${pick === a ? "A" : "B"}` });
  if ([a, b, c].filter((x) => x.kind === "not_sql").length >= 2) return done("not_query", { c, reason: "two of three models: running SQL can't answer it" });
  const diff = a.kind === "sql" && b.kind === "sql" ? writecheck.compareRuns(a, b, { freeValues: a.freeValues || b.freeValues }).why.slice(0, 3).join("; ") : "";
  return done("review", { c, reason: "the end states differ: " + ([a, b, c].map((x, k) => `${"ABC"[k]}: ${x.kind === "sql" ? "changes " + summaryOf(x.changed) : x.kind === "not_sql" ? "not runnable SQL" : x.why}`).join(" · ")) + (diff ? " — A vs B: " + diff : "") });
}
const writeView = (x) => x && ({ provider: x.provider, model: x.model || null, kind: x.kind === "sql" ? "select" : x.kind === "not_sql" ? "not_a_query" : x.kind, sql: x.sql || null, setup: x.setup || null, free: x.freeValues || undefined, why: x.why || null, changes: x.changed ? summaryOf(x.changed) || (x.inTx ? "nothing after ROLLBACK (inside the transaction: " + summaryOf(x.inTx) + ")" : x.result ? "nothing (returns " + x.result.count + " rows)" : "") : null, result: x.result ? preview({ ok: true, ...x.result }) : null, retried: x.retried || undefined });

function save(item, out) {
  if (out.mode === "state") {
    const chosen = out.chosen;
    db.prepare(`INSERT OR REPLACE INTO drill_refs (item_id, status, sql, columns, rows, ordered, a, b, c, reason, resolution, history, prompt_original, prompt_rewritten, created_at, verified_at, mode, setup, free_values)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, 'state', ?, ?)`).run(item.id, out.status, chosen ? chosen.sql : null, chosen ? '["state"]' : null, chosen ? JSON.stringify(chosen.changed) : null,
      JSON.stringify(writeView(out.a)), JSON.stringify(writeView(out.b)), out.c ? JSON.stringify(writeView(out.c)) : null, out.reason || "", out.resolution || null, JSON.stringify(out.history || []), new Date().toISOString(), chosen ? new Date().toISOString() : null, chosen ? chosen.setup || null : null, chosen && chosen.freeValues ? 1 : 0);
    db.prepare("UPDATE drill_refs SET probe = ?, probe_rows = ?, result_rows = ?, tx_rows = ? WHERE item_id = ?").run(out.probe || null, chosen && chosen.probed ? JSON.stringify(chosen.probed) : null, chosen && chosen.result ? JSON.stringify(chosen.result) : null, chosen && chosen.inTx ? JSON.stringify(chosen.inTx) : null, item.id);
    return;
  }
  if (out.status === "matched" && VOLATILE.test(out.chosen.sql)) {
    out = { ...out, status: "review", chosen: null, prompt_rewritten: null, reason: "the reference depends on today's date or on chance, so its result can't be stored: " + out.chosen.sql.replace(/\s+/g, " ").slice(0, 120) };
  }
  const chosen = out.chosen;
  db.prepare(`INSERT OR REPLACE INTO drill_refs (item_id, status, sql, columns, rows, ordered, a, b, c, reason, resolution, history, prompt_original, prompt_rewritten, created_at, verified_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(item.id, out.status, chosen ? chosen.sql : null, chosen ? JSON.stringify(chosen.result.columns) : null,
    chosen ? JSON.stringify(chosen.result.rows.slice(0, 2000)) : null, out.ordered ? 1 : 0, JSON.stringify(side(out.a)), JSON.stringify(side(out.b)), out.c ? JSON.stringify(side(out.c)) : null,
    out.reason || "", out.resolution || null, JSON.stringify(out.history || []), out.prompt_original || null, out.prompt_rewritten || null, new Date().toISOString(), chosen ? new Date().toISOString() : null);
  if (out.setup) db.prepare("UPDATE drill_refs SET setup = ? WHERE item_id = ?").run(out.setup, item.id);
}

let current = null;
function costOf(usage) {
  return Object.entries(usage).reduce((sum, [model, u]) => { const p = PRICE[model]; return sum + (p ? (u.input * p[0] + u.output * p[1]) / 1e6 : 0); }, 0);
}
/** mode "new": drills in the levels without a reference row; mode "review": re-run the drills waiting for review. */
function start(levels, mode = "new") {
  if (current) return { started: false, message: "A reference-answer job is already running." };
  levels = (Array.isArray(levels) ? levels : [1, 2, 3]).map(Number).filter((n) => n >= 1 && n <= 14);
  const rows = new Map(db.prepare("SELECT * FROM drill_refs").all().map((r) => [r.item_id, r]));
  const drills = library.get().active.filter((i) => i.kind === "sqlite" && i.source.startsWith("drills:") && levels.includes(i.level));
  const todo = mode === "review" ? drills.filter((i) => rows.has(i.id) && rows.get(i.id).status === "review")
    : mode === "write" ? drills.filter((i) => rows.has(i.id) && rows.get(i.id).status === "not_query" && rows.get(i.id).mode !== "state")
    : mode === "write-review" ? drills.filter((i) => rows.has(i.id) && rows.get(i.id).status === "review" && rows.get(i.id).mode === "state")
    : drills.filter((i) => !rows.has(i.id));
  const id = db.prepare("INSERT INTO ref_jobs (levels, status, progress, total, usage, resolutions, mode, started_at) VALUES (?, 'running', 'Starting…', ?, '{}', '{}', ?, ?)").run(JSON.stringify(levels), todo.length, mode, new Date().toISOString()).lastInsertRowid;
  const usage = {}, resolutions = {}, counts = { processed: 0, matched: 0, review: 0, not_query: 0, errors: 0 };
  const persist = (progress) => db.prepare("UPDATE ref_jobs SET progress = ?, processed = ?, matched = ?, review = ?, not_query = ?, errors = ?, usage = ?, resolutions = ? WHERE id = ?")
    .run(progress, counts.processed, counts.matched, counts.review, counts.not_query, counts.errors, JSON.stringify(usage), JSON.stringify(resolutions), id);
  current = { id, stop: false };
  const job = current;
  (async () => {
    let next = 0;
    const worker = async () => {
      while (!job.stop && next < todo.length) {
        const item = todo[next++];
        try {
          const prev = rows.get(item.id);
          const out = mode === "write" || mode === "write-review" || (prev && prev.mode === "state") ? await solveWrite(item, usage) : await solveOne(item, usage, mode === "review" && prev ? { a: JSON.parse(prev.a || "null"), b: JSON.parse(prev.b || "null") } : null);
          save(item, out);
          counts[out.status]++;
          if (out.status === "matched") resolutions[out.resolution] = (resolutions[out.resolution] || 0) + 1;
        } catch (e) {
          counts.errors++;
          console.warn(`[refs] ${item.id}: ${e.message}`);
          if (e.offline) { job.stop = true; job.offline = true; }
        }
        counts.processed++;
        persist(`Level ${item.level}: ${counts.processed} of ${todo.length} drills`);
      }
    };
    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      persist(job.stop ? (job.offline ? "Stopped: MySQL is offline. Start it, then run again." : `Stopped after ${counts.processed} of ${todo.length}: press Resume to continue.`) : null);
      db.prepare("UPDATE ref_jobs SET status = ?, finished_at = ? WHERE id = ?").run(job.stop ? "stopped" : "done", new Date().toISOString(), id);
    } catch (e) {
      db.prepare("UPDATE ref_jobs SET status = 'failed', error = ?, finished_at = ? WHERE id = ?").run(e.message, new Date().toISOString(), id);
    } finally {
      current = null;
      library.build();
      // drills left for review get a suggested fix (or a note that the drill itself is fine)
      if (counts.review) suggestFixes().catch((e) => console.warn("[refs] suggested fixes: " + e.message));
    }
  })();
  return { started: true, id, total: todo.length };
}
function stop() { if (current) current.stop = true; return { stopping: !!current }; }

function jobView(job) {
  const usage = JSON.parse(job.usage || "{}");
  const end = job.finished_at ? new Date(job.finished_at) : new Date();
  return { ...job, levels: JSON.parse(job.levels), usage, resolutions: JSON.parse(job.resolutions || "{}"), cost: Math.round(costOf(usage) * 10000) / 10000, seconds: Math.round((end - new Date(job.started_at)) / 1000) };
}
/** Counts per status (all drills and per level), the latest jobs with their cost and time. */
function summary() {
  const c = library.get();
  const drills = c.active.filter((i) => i.kind === "sqlite" && i.source.startsWith("drills:"));
  const refs = new Map(db.prepare("SELECT item_id, status, mode FROM drill_refs").all().map((r) => [r.item_id, r]));
  const byLevel = {};
  const total = { drills: drills.length, matched: 0, self: 0, review: 0, not_query: 0, todo: 0, write_matched: 0, write_review: 0, write_todo: 0 };
  for (const i of drills) {
    const r = refs.get(i.id);
    const s = r ? r.status : "todo";
    total[s]++;
    const L = (byLevel[i.level] = byLevel[i.level] || { level: i.level, drills: 0, matched: 0, self: 0, review: 0, not_query: 0, todo: 0, write_matched: 0, write_review: 0, write_todo: 0 });
    L.drills++; L[s]++;
    // write-query drills (checked by the end state on MySQL): split out of the totals above
    const w = r && r.mode === "state" ? (s === "matched" || s === "review" ? "write_" + s : null) : s === "not_query" ? "write_todo" : null;
    if (w) { total[w]++; L[w]++; }
  }
  const jobs = db.prepare("SELECT * FROM ref_jobs ORDER BY id DESC LIMIT 6").all().map(jobView);
  return { running: !!current, total, levels: Object.values(byLevel).sort((a, b) => a.level - b.level), last: jobs[0] || null, jobs };
}

const itemView = (r, i) => ({ item_id: r.item_id, title: i.title, body: taskText(i), level: i.level, dataset: i.dataset, tables: i.tables || [], reason: r.reason, resolution: r.resolution, ordered: !!r.ordered,
  a: JSON.parse(r.a || "null"), b: JSON.parse(r.b || "null"), c: JSON.parse(r.c || "null"), history: JSON.parse(r.history || "[]"), sql: r.sql,
  prompt_original: r.prompt_original, prompt_rewritten: r.prompt_rewritten, updated_at: r.verified_at || r.created_at, write: r.mode === "state", fix: JSON.parse(r.fix || "null"),
  category: reviewCategory(r), accepted: r.accepted ? JSON.parse(r.accepted).map((x) => ({ key: x.key, sql: x.sql })) : null });
/** What a review item is about, for the filters: an open fix, the date, a missing starting state, or plain disagreement. */
function reviewCategory(r) {
  const fix = JSON.parse(r.fix || "null");
  if (fix && fix.fault && fix.status === "open") return fix.kind === "text" ? "textfix" : "setup";
  if (/today's date|chance/.test(r.reason || "")) return "date";
  if (/changed nothing|no rows|Multiple primary key|Can't DROP/.test(r.reason || "")) return "setup";
  return "disagree";
}
/** Drills waiting for a decision, with every solution and its result. */
function reviewList() {
  const c = library.get();
  return db.prepare("SELECT * FROM drill_refs WHERE status = 'review' ORDER BY created_at").all().map((r) => {
    const i = c.byId.get(r.item_id);
    return i && i.status === "active" ? itemView(r, i) : null;
  }).filter(Boolean);
}
/** Drills the pipeline resolved on its own after a retry, a prompt rewrite or a tie-breaker: for audit. */
function historyList() {
  const c = library.get();
  return db.prepare("SELECT * FROM drill_refs WHERE status = 'matched' AND (prompt_rewritten IS NOT NULL OR resolution LIKE 'tie-breaker%' OR resolution LIKE '%retry%' OR resolution LIKE 'chosen%') ORDER BY COALESCE(verified_at, created_at) DESC").all().map((r) => {
    const i = c.byId.get(r.item_id);
    return i && i.status === "active" ? itemView(r, i) : null;
  }).filter(Boolean);
}
/** Decide a drill: use one side's SQL (or edited SQL), leave it unchecked, or send an automatic decision back to review. */
/** A side that ran without an error (it can be accepted). */
// a query side must also return rows: an empty result can't tell a right answer from a wrong one
const usableSide = (s) => !!(s && s.sql && s.kind === "select" && (s.changes != null || (s.result && s.result.count > 0)));
const SIDE_LABEL = { a: "A", b: "B", c: "C" };
/** Which sides a decision means: "a" | ["a","c"] | "all" (every usable side). */
function sidesFor(row, use) {
  const sides = { a: JSON.parse(row.a || "null"), b: JSON.parse(row.b || "null"), c: JSON.parse(row.c || "null") };
  const keys = use === "all" ? ["a", "b", "c"].filter((k) => usableSide(sides[k])) : (Array.isArray(use) ? use : [use]).filter((k) => ["a", "b", "c"].includes(k));
  return { sides, keys: [...new Set(keys)] };
}
/**
 * Accept one or more solutions as the drill's reference results. The first is the main reference; a learner
 * is correct when their result matches any of them. Query drills run in SQLite, write drills on a MySQL copy.
 */
async function acceptSides(row, item, use, sql) {
  const { sides, keys } = sidesFor(row, use);
  const picks = keys.map((k) => ({ key: k, side: sides[k] }));
  if (use === "own") picks.push({ key: "own", side: { sql, setup: null } });
  if (!picks.length) throw Object.assign(new Error(use === "all" ? "None of the solutions ran without an error." : "Choose at least one solution."), { status: 400 });
  const bad = picks.filter((p) => p.key !== "own" && !usableSide(p.side));
  if (bad.length) throw Object.assign(new Error(`Solution ${bad.map((p) => SIDE_LABEL[p.key]).join(", ")} failed, so it can't be accepted.`), { status: 400 });
  const site = siteOf(item);
  const accepted = [];
  for (const p of picks) {
    if (row.mode === "state") {
      const setup = p.side.setup || row.setup || null;
      const x = await writecheck.runOnDataset(site, p.side.sql, setup, row.probe ? { probe: row.probe } : {});
      if (!x.ok) throw Object.assign(new Error(`${SIDE_LABEL[p.key] || "Your SQL"} fails on MySQL: ${x.error}`), { status: 400 });
      const inTx = x.inTx && Object.keys(x.inTx).length ? x.inTx : null;
      if (!Object.keys(x.changed).length && !x.result && !inTx) throw Object.assign(new Error(`${SIDE_LABEL[p.key] || "Your SQL"} changes nothing, so a learner's answer couldn't be compared with it.`), { status: 400 });
      if (row.probe && x.probeError) throw Object.assign(new Error(`The drill's behaviour test fails after ${SIDE_LABEL[p.key] || "your SQL"}: ${x.probeError}`), { status: 400 });
      accepted.push({ key: p.key, sql: p.side.sql, setup, free: !!p.side.free, changed: x.changed, probed: x.probed || null, result: Object.keys(x.changed).length || inTx ? null : x.result, inTx });
    } else {
      const x = content.runAll(site, asChecked(p.side.sql), 5000, row.setup || null);
      if (!x.ok) throw Object.assign(new Error(`${SIDE_LABEL[p.key] || "Your query"} fails: ${x.error}`), { status: 400 });
      if (!x.count) throw Object.assign(new Error(`${SIDE_LABEL[p.key] || "Your query"} returns no rows, so a learner's answer couldn't be compared with it.`), { status: 400 });
      accepted.push({ key: p.key, sql: p.side.sql, columns: x.columns, rows: x.rows.slice(0, 2000) });
    }
  }
  const main = accepted[0], at = new Date().toISOString();
  const label = picks.map((p) => SIDE_LABEL[p.key] || "own SQL").join(" + ");
  const history = JSON.parse(row.history || "[]").concat({ step: "decision", detail: { by: "admin", choice: label, accepted: accepted.length, sql: accepted.map((x) => x.sql) }, at });
  const resolution = `chosen in review (${label})`;
  if (row.mode === "state") {
    db.prepare("UPDATE drill_refs SET status = 'matched', sql = ?, columns = '[\"state\"]', rows = ?, setup = ?, free_values = ?, probe_rows = ?, result_rows = ?, tx_rows = ?, accepted = ?, reason = '', resolution = ?, history = ?, verified_at = ? WHERE item_id = ?")
      .run(main.sql, JSON.stringify(main.changed), main.setup, accepted.some((x) => x.free) ? 1 : 0, main.probed ? JSON.stringify(main.probed) : null, main.result ? JSON.stringify(main.result) : null, main.inTx ? JSON.stringify(main.inTx) : null,
        accepted.length > 1 ? JSON.stringify(accepted) : null, resolution, JSON.stringify(history), at, item.id);
  } else {
    db.prepare("UPDATE drill_refs SET status = 'matched', sql = ?, columns = ?, rows = ?, accepted = ?, reason = '', resolution = ?, history = ?, verified_at = ? WHERE item_id = ?")
      .run(main.sql, JSON.stringify(main.columns), JSON.stringify(main.rows), accepted.length > 1 ? JSON.stringify(accepted) : null, resolution, JSON.stringify(history), at, item.id);
  }
  return { ok: true, status: "matched", accepted: accepted.length };
}
/**
 * Decide a drill in review. use: "a" | "b" | "c" | ["a", "c"] | "all" (accept those solutions), "own" (sql),
 * "none" / "self" (leave it unchecked: a self-check with the best available solution as the model solution),
 * "reopen" (send an automatic decision back to review).
 */
async function decide({ item_id, use, sql }, { build = true } = {}) {
  const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(item_id);
  const item = library.get().byId.get(item_id);
  if (!row || !item) throw Object.assign(new Error("Unknown drill"), { status: 404 });
  const at = new Date().toISOString();
  const history = JSON.parse(row.history || "[]");
  let out;
  if (use === "none" || use === "self") {
    const { sides } = sidesFor(row, "all");
    const model = ["c", "a", "b"].map((k) => sides[k]).find(usableSide);
    history.push({ step: "decision", detail: { by: "admin", choice: "leave unchecked (self-check)" }, at });
    db.prepare("UPDATE drill_refs SET status = 'self', sql = ?, model_answer = NULL, accepted = NULL, reason = ?, resolution = ?, history = ? WHERE item_id = ?")
      .run(model ? model.sql : null, "left unchecked in review: a self-check", "self-check (left unchecked in review)", JSON.stringify(history), item_id);
    out = { ok: true, status: "self" };
  } else if (use === "reopen") {
    history.push({ step: "decision", detail: { by: "admin", choice: "sent back to review", had: row.resolution }, at });
    db.prepare("UPDATE drill_refs SET status = 'review', sql = NULL, columns = NULL, rows = NULL, accepted = NULL, verified_at = NULL, prompt_rewritten = NULL, reason = ?, history = ? WHERE item_id = ?")
      .run(`sent back to review (was: ${row.resolution})`, JSON.stringify(history), item_id);
    out = { ok: true, status: "review" };
  } else out = await acceptSides(row, item, use, sql);
  if (build) library.build();
  return out;
}

/** Health for drills with several accepted answers: each stored one must still give its stored result. */
async function verifyAccepted() {
  const c = library.get();
  const out = { ok: 0, failed: [] };
  for (const r of db.prepare("SELECT * FROM drill_refs WHERE status = 'matched' AND accepted IS NOT NULL").all()) {
    const i = c.byId.get(r.item_id);
    if (!i || i.status !== "active") continue;
    for (const x of JSON.parse(r.accepted)) {
      let same;
      if (r.mode === "state") {
        const now = await writecheck.runOnDataset(siteOf(i), x.sql, x.setup, r.probe ? { probe: r.probe } : {});
        same = now.ok && writecheck.compareRuns({ changed: x.changed, probed: x.probed || undefined, result: x.result || undefined, inTx: x.inTx || undefined }, now, { freeValues: !!r.free_values }).same;
      } else {
        const now = content.runAll(siteOf(i), asChecked(x.sql), 5000, r.setup || null);
        same = now.ok && sameResult({ ...now, rows: now.rows.slice(0, 2000), count: Math.min(now.count, 2000) }, { columns: x.columns, rows: x.rows, count: x.rows.length }, !!r.ordered).same;
      }
      if (same) out.ok++; else out.failed.push({ id: i.id, title: i.title, detail: `accepted answer ${(x.key || "").toUpperCase()} no longer gives its stored result` });
    }
  }
  return out;
}

/** Health: does each stored reference still produce its stored result on today's dataset? */
function verifyAll() {
  const c = library.get();
  const out = { ok: 0, failed: [] };
  for (const r of db.prepare("SELECT * FROM drill_refs WHERE status = 'matched' AND (mode IS NULL OR mode <> 'state')").all()) {
    const i = c.byId.get(r.item_id);
    if (!i || i.status !== "active") continue;
    const now = content.runAll(siteOf(i), asChecked(r.sql), 5000, r.setup || null);
    const stored = { columns: JSON.parse(r.columns), rows: JSON.parse(r.rows) };
    stored.count = stored.rows.length;
    const cmp = now.ok ? sameResult({ ...now, rows: now.rows.slice(0, 2000), count: Math.min(now.count, 2000) }, stored, !!r.ordered) : { same: false, why: now.error };
    if (cmp.same) out.ok++;
    else out.failed.push({ id: i.id, title: i.title, detail: "the reference no longer matches its stored result: " + cmp.why });
  }
  return out;
}

/** Health for write-query references: run each again on a fresh copy; its end state must be unchanged. */
async function verifyStates(onlySite) {
  const c = library.get();
  const out = { ok: 0, failed: [] };
  for (const r of db.prepare("SELECT * FROM drill_refs WHERE status = 'matched' AND mode = 'state'").all()) {
    const i = c.byId.get(r.item_id);
    if (!i || i.status !== "active" || (onlySite && siteOf(i) !== onlySite)) continue;
    const now = await writecheck.runOnDataset(siteOf(i), r.sql, r.setup, r.probe ? { probe: r.probe } : {});
    const cmp = now.ok ? writecheck.compareRuns({ changed: JSON.parse(r.rows), probed: r.probe_rows ? JSON.parse(r.probe_rows) : undefined, result: r.result_rows ? JSON.parse(r.result_rows) : undefined, inTx: r.tx_rows ? JSON.parse(r.tx_rows) : undefined }, now, { freeValues: !!r.free_values }) : { same: false, why: [now.error] };
    if (cmp.same) out.ok++;
    else out.failed.push({ id: i.id, title: i.title, detail: "the reference's end state changed: " + cmp.why.slice(0, 2).join("; ") });
  }
  return out;
}

// ---- self-check drills: no automatic check is possible, so Claude writes a model answer
const SYSTEM_SELF = `You write the model answer for a SQL practice exercise that can't be checked automatically. Learners see it after they press "Show answer", then mark the exercise done themselves.
Reply with ONLY one JSON object, no prose:
{"kind": "words" | "sql" | "both", "answer": "...", "sql": "..."}
- kind "words": it asks to explain, describe, compare, list, classify or predict. Put the model answer in "answer" and leave "sql" empty.
- kind "sql": it asks for statements that can't run in the practice sandbox (CREATE / DROP / RENAME DATABASE, USE, users, roles, GRANT / REVOKE, backups). Put them in "sql" (MySQL 8 syntax), and in "answer" at most two sentences on what they do or anything to watch out for.
- kind "both": it asks for SQL and an explanation. Fill both.
The answer: plain text for a learner (no markdown headings, no bullet symbols other than "- "), correct, specific to this exercise and its dataset, at most 140 words. SQL: only tables and columns from the dataset unless the exercise names new ones.`;
async function writeModelAnswer(item, usage) {
  const ask = makeAsk(usage);
  const site = siteOf(item);
  const user = `DATASET (tables in the practice database):\n${content.schemaText(site)}\n\n` + (item.intro ? `CHAPTER NOTES:\n${String(item.intro).slice(0, 1500)}\n\n` : "") + `EXERCISE: ${item.title}\n${taskText(item)}`;
  const r = await ask(STRONG, SYSTEM_SELF, user, 1200);
  const p = parseWrite(r.text);
  if (!["words", "sql", "both"].includes(p.kind)) throw new Error("no usable model answer: " + (p.why || String(r.text).slice(0, 80)));
  return { kind: p.kind, answer: String(p.answer || "").trim(), sql: String(p.sql || "").trim() || null, model: r.model };
}
/** Turns drills into self-check exercises with a model answer. keepPrompt: drop a rewritten prompt (back to the original). */
async function makeSelfCheck(ids, { revertPrompt = [] } = {}) {
  const usage = {}, kinds = { words: 0, sql: 0, both: 0 }, failed = [];
  if (revertPrompt.length) {
    for (const id of revertPrompt) db.prepare("UPDATE drill_refs SET prompt_rewritten = NULL WHERE item_id = ?").run(id);
    library.build();
  }
  const c = library.get();
  let next = 0;
  const worker = async () => {
    while (next < ids.length) {
      const id = ids[next++];
      const item = c.byId.get(id);
      const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(id);
      if (!item || !row) { failed.push({ id, why: "unknown drill" }); continue; }
      try {
        const m = await writeModelAnswer(item, usage);
        // an existing agreed reference stays as the model solution when Claude gives no SQL
        const sql = m.sql || (row.status === "matched" ? row.sql : null);
        const history = JSON.parse(row.history || "[]");
        history.push({ step: "self-check", detail: { by: m.model, kind: m.kind, was: row.status, prompt: revertPrompt.includes(id) ? "rewritten prompt reverted to the original" : undefined }, at: new Date().toISOString() });
        db.prepare("UPDATE drill_refs SET status = 'self', sql = ?, model_answer = ?, reason = ?, resolution = ?, history = ?, verified_at = ? WHERE item_id = ?")
          .run(sql, m.answer || null, "self-check: no automatic check is possible", `self-check (${m.kind === "words" ? "model answer" : m.kind === "sql" ? "model solution" : "model solution and answer"})`, JSON.stringify(history), new Date().toISOString(), id);
        kinds[m.kind]++;
      } catch (e) { failed.push({ id, title: item.title, why: e.message }); }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  library.build();
  return { kinds, failed, usage, cost: Math.round(costOf(usage) * 10000) / 10000 };
}

// ---- drill faults: a suggested fix to the drill text (or, for write drills, to the MySQL dataset copy)
const SYSTEM_FIX = `You review a SQL practice drill that is waiting for a human because independent AI solutions disagreed. Decide whether the DRILL ITSELF is at fault: its text is ambiguous or leaves out something the learner needs (which table, which values, which columns, the order), it contradicts the data, or the dataset can't support it as written (for example an INSERT that omits an id when the column has no AUTO_INCREMENT).
If the solutions disagree only because some of them are wrong, the drill is not at fault.
Reply with ONLY one JSON object, no prose:
{"fault": true|false, "kind": "text" | "setup", "why": "one sentence: what is wrong with the drill", "new_prompt": "the full corrected drill text (without its title)", "dataset_sql": "MySQL statements"}
- Prefer kind "text": rewrite the whole drill text so it has exactly one right answer, keeping its intent, level and wording style. Don't reveal the solution. Don't repeat the title at the start.
- kind "setup" only when the drill is right but its database copy lacks something it assumes (write drills only, each run on its own MySQL copy): a table, view or procedure an earlier exercise created, or a key / AUTO_INCREMENT the task relies on. Give the smallest MySQL 8 statements; they run on this drill's copy only, before the learner's SQL. Never server settings (SET GLOBAL), users or privileges: if that is the only fix, say so in "why" with kind "setup" and put the statement in "dataset_sql" anyway.
- fault false: leave the other fields empty.`;
async function suggestFix(row, item, usage) {
  const ask = makeAsk(usage);
  const site = siteOf(item);
  const sides = ["a", "b", "c"].map((k) => [k.toUpperCase(), JSON.parse(row[k] || "null")]).filter(([, s]) => s)
    .map(([k, s]) => `${k}: ${s.kind === "not_a_query" ? "says it isn't runnable SQL: " + (s.why || "") : (s.sql || "(no SQL)") + (s.why ? "\n   problem: " + s.why : "") + (s.changes ? "\n   changes: " + s.changes : "") + (s.result ? "\n   result: " + s.result.count + " rows, columns " + (s.result.columns || []).join(", ") : "")}`).join("\n");
  const user = `DRILL TYPE: ${row.mode === "state" ? "write drill (statements run on a MySQL 8 copy, checked by the end state)" : "query drill (one SELECT run in SQLite, checked by its result)"}\nDATASET:\n${content.schemaText(site)}\n\nDRILL: ${item.title}\n${taskText(item)}\n\nWHY IT IS IN REVIEW: ${row.reason}\n\nSOLUTIONS:\n${sides}`;
  const r = await ask(STRONG, SYSTEM_FIX, user, 1200);
  const p = parseWrite(r.text);
  if (typeof p.fault !== "boolean") throw new Error("no usable suggestion");
  if (!p.fault) return { fault: false, by: r.model };
return tidyFix({ fault: true, kind: p.kind, why: String(p.why || ""), new_prompt: p.new_prompt, dataset_sql: p.dataset_sql, status: "open", by: r.model, at: new Date().toISOString() }, row, item);
}
/** Normalises a suggestion: setup for write drills only, server-level statements can't be applied, no title echo. */
function tidyFix(f, row, item) {
  const sql = String(f.dataset_sql || "").trim();
  let kind = (f.kind === "dataset" || f.kind === "setup") && row.mode === "state" && sql ? "setup" : "text";
  if (kind === "setup" && (/\bset\s+(global|persist)\b/i.test(sql) || require("./writecheck.js").FORBIDDEN.test(sql) || sql.split(";").some((s) => require("./writecheck.js").FORBIDDEN.test(s)))) kind = "server";
  let text = String(f.new_prompt || "").trim();
  const t = String(item.title || "").trim();
  if (t && text.toLowerCase().startsWith(t.toLowerCase()) && text.length > t.length + 10) text = text.slice(t.length).replace(/^[\s:.\-–—]+/, "");
  if (kind === "text" && !text) return { fault: false, by: f.by };
  return { ...f, kind, new_prompt: kind === "text" ? text : null, dataset_sql: kind === "text" ? null : sql };
}
/** One pass over the review queue: a stored suggestion per drill (fault or not). */
async function suggestFixes() {
  const usage = {}, out = { fault: 0, clean: 0, failed: 0, text: 0, dataset: 0 };
  const c = library.get();
  const rows = db.prepare("SELECT * FROM drill_refs WHERE status = 'review' AND fix IS NULL").all();
  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      const item = c.byId.get(row.item_id);
      if (!item) continue;
      try {
        const f = await suggestFix(row, item, usage);
        db.prepare("UPDATE drill_refs SET fix = ? WHERE item_id = ?").run(JSON.stringify(f), row.item_id);
        if (f.fault) { out.fault++; out[f.kind]++; } else out.clean++;
      } catch (e) { out.failed++; console.warn(`[refs] fix ${row.item_id}: ${e.message}`); }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { ...out, cost: Math.round(costOf(usage) * 10000) / 10000, usage };
}
// ---- zero-row drills: the right answer returns nothing on the dataset, so add 1-3 rows for this drill only
const SYSTEM_ROWS = `A SQL practice drill's correct answer returns NO rows on its dataset, so a learner's answer can't be told apart from a wrong one. Write the smallest SQLite INSERT statements (1 to 3 rows) that make the intended answer return 1 or 2 rows, without changing what the drill asks. The rows are added to this drill's copy of the data before the learner's query runs.
Reply with ONLY one JSON object, no prose: {"setup": "INSERT ...;", "why": "one sentence a learner would understand, e.g. which row was added"}
- Use keys that can't collide with existing rows (for example ids from 9001), fill every NOT NULL column, and keep foreign keys pointing at rows that exist.
- The rows must make sense for the drill (a NULL where it asks about IS NULL, a value only one side has for EXCEPT, ...).`;
async function fixZeroRows(itemId, usage) {
  const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(itemId);
  const item = library.get().byId.get(itemId);
  if (!row || !item) throw Object.assign(new Error("Unknown drill"), { status: 404 });
  const site = siteOf(item);
  const sides = ["a", "b", "c"].map((k) => JSON.parse(row[k] || "null")).filter((s) => s && s.sql);
  const ask = makeAsk(usage);
  const user = `DATASET (SQLite):\n${content.schemaText(site)}\n\nDRILL: ${item.title}\n${taskText(item)}\n\nSOLUTIONS THAT RETURN NO ROWS:\n${sides.map((s) => s.sql).join("\n---\n")}`;
  let extra = "", setup = null, why = "";
  for (let attempt = 0; attempt < 2 && !setup; attempt++) {
    const p = parseWrite((await ask(STRONG, SYSTEM_ROWS, user + extra, 900)).text);
    const sql = String(p.setup || "").trim();
    const counts = sides.map((s) => content.runAll(site, s.sql, 5000, sql)).map((x) => (x.ok ? x.count : "error: " + x.error));
    if (sql && counts.some((n) => typeof n === "number" && n > 0)) { setup = sql; why = String(p.why || ""); }
    else extra = `\n\nYOUR LAST ROWS:\n${sql || "(none)"}\nRESULT: the solutions then returned ${counts.join(" / ")} rows. Try again.`;
  }
  if (!setup) return { ok: false, status: row.status, why: "no rows found that make the answer non-empty" };
  return logged(itemId, "setup-rows", why, null, async () => {
    const out = await solveOne(item, usage, null, { setup });
    out.setup = setup;
    save(item, out);
    const history = JSON.parse(row.history || "[]").concat({ step: "setup rows", detail: { by: STRONG.model, why, setup, result: out.status }, at: new Date().toISOString() }, out.history || []);
    db.prepare("UPDATE drill_refs SET history = ?, fix = ?, model_answer = ? WHERE item_id = ?").run(JSON.stringify(history), row.fix, row.model_answer, itemId);
    return { ok: true, status: out.status, reason: out.reason || "", setup, why };
  });
}

// ---- write drills whose right answer changes nothing: the copy is already in the end state (or can't take it)
const SYSTEM_NOOP = `A SQL practice drill asks for a statement that changes a MySQL 8 database, but on the drill's copy of the data the right answer changes nothing or fails, because the database is already in the end state the drill asks for (the column is already NOT NULL, the index to drop doesn't exist, AUTO_INCREMENT is already set) or a key is in the way ("Multiple primary key defined": drop the existing primary key first).
Write the smallest MySQL setup for THIS drill only that puts the copy in the starting state the drill expects, so the intended statement makes a visible change. It runs before the learner's SQL.
Reply with ONLY one JSON object, no prose: {"setup": "MySQL statements;", "why": "one sentence"}
Never server settings (SET GLOBAL), users, privileges or other databases.`;
async function fixNoChange(itemId, usage) {
  const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(itemId);
  const item = library.get().byId.get(itemId);
  if (!row || !item) throw Object.assign(new Error("Unknown drill"), { status: 404 });
  const site = siteOf(item);
  const sides = ["a", "b", "c"].map((k) => JSON.parse(row[k] || "null")).filter((x) => x && x.sql);
  const ask = makeAsk(usage);
  const user = `DATASET (MySQL):\n${content.schemaText(site)}\n\nDRILL: ${item.title}\n${taskText(item)}\n\nANSWERS AND WHAT HAPPENED:\n${sides.map((x) => x.sql + "\n   -> " + (x.why || x.changes || "")).join("\n")}\n\nWHY IT IS IN REVIEW: ${row.reason}`;
  let extra = "", setup = null, why = "";
  for (let attempt = 0; attempt < 2 && !setup; attempt++) {
    const p = parseWrite((await ask(STRONG, SYSTEM_NOOP, user + extra, 900)).text);
    const sql = String(p.setup || "").trim();
    if (!sql || writecheck.FORBIDDEN.test(sql) || /\bset\s+(global|persist)\b/i.test(sql)) { extra = "\n\nYour last setup was empty or not allowed. Try again."; continue; }
    const runs = await Promise.all(sides.map((x) => writecheck.runOnDataset(site, x.sql, sql)));
    const outcome = runs.map((r) => (!r.ok ? "fails: " + r.error : Object.keys(r.changed).length || (r.inTx && Object.keys(r.inTx).length) ? "changes " + summaryOf(r.changed) : "changes nothing"));
    if (runs.some((r) => r.ok && Object.keys(r.changed).length)) { setup = sql; why = String(p.why || ""); }
    else extra = `\n\nYOUR LAST SETUP:\n${sql}\nTHEN THE ANSWERS: ${outcome.join(" / ")}. Try again.`;
  }
  if (!setup) return { ok: false, status: row.status, why: "no setup found that makes the answer change something" };
  return logged(itemId, "setup-start", why, null, async () => {
    const out = await solveWrite(item, usage, { setup });
    save(item, out);
    const fix = JSON.parse(row.fix || "null");
    const keptFix = fix && fix.status === "open" ? { ...fix, status: "replaced", note: "a starting-state setup was written instead" } : fix;
    const history = JSON.parse(row.history || "[]").concat({ step: "starting state", detail: { by: STRONG.model, why, setup, result: out.status }, at: new Date().toISOString() }, out.history || []);
    db.prepare("UPDATE drill_refs SET history = ?, fix = ?, prompt_original = ?, prompt_rewritten = ? WHERE item_id = ?").run(JSON.stringify(history), keptFix ? JSON.stringify(keptFix) : null, row.prompt_original, row.prompt_rewritten, itemId);
    return { ok: true, status: out.status, reason: out.reason || "", setup, why };
  });
}
/** Re-runs a drill through the pipeline as it is (after the checker learned something new), logged. */
async function recheck(itemId, usage, label) {
  const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(itemId);
  const item = library.get().byId.get(itemId);
  return logged(itemId, "recheck", label, null, async () => {
    const out = row.mode === "state" ? await solveWrite(item, usage, row.setup ? { setup: row.setup } : {}) : await solveOne(item, usage, null, row.setup ? { setup: row.setup } : {});
    if (row.setup && row.mode !== "state") out.setup = row.setup;
    save(item, out);
    const history = JSON.parse(row.history || "[]").concat({ step: "re-check", detail: { why: label, result: out.status }, at: new Date().toISOString() }, out.history || []);
    db.prepare("UPDATE drill_refs SET history = ?, fix = ?, prompt_original = ?, prompt_rewritten = ? WHERE item_id = ?").run(JSON.stringify(history), row.fix, row.prompt_original, row.prompt_rewritten, itemId);
    return { ok: true, status: out.status, reason: out.reason || "" };
  });
}

// ---- change log: every human change to a drill's reference keeps the row as it was, so History can undo it
db.exec("CREATE TABLE IF NOT EXISTS ref_changes (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL, kind TEXT NOT NULL, summary TEXT, batch INTEGER, before TEXT NOT NULL, after_status TEXT, at TEXT NOT NULL, undone_at TEXT)");
function logChange(itemId, kind, summary, batch) {
  const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(itemId);
  if (!row) throw Object.assign(new Error("Unknown drill"), { status: 404 });
  return db.prepare("INSERT INTO ref_changes (item_id, kind, summary, batch, before, at) VALUES (?, ?, ?, ?, ?, ?)").run(itemId, kind, summary || "", batch || null, JSON.stringify(row), new Date().toISOString()).lastInsertRowid;
}
function changeDone(id) {
  // a drill reference, or a draft (content item)
  const r = db.prepare("SELECT d.status FROM ref_changes c JOIN drill_refs d ON d.item_id = c.item_id WHERE c.id = ?").get(id) || db.prepare("SELECT i.status FROM ref_changes c JOIN content_items i ON i.id = c.item_id WHERE c.id = ?").get(id);
  db.prepare("UPDATE ref_changes SET after_status = ? WHERE id = ?").run(r ? r.status : null, id);
}
const dropChange = (id) => db.prepare("DELETE FROM ref_changes WHERE id = ?").run(id);
/** Runs fn as one logged change; a failure leaves no log entry. */
async function logged(itemId, kind, summary, batch, fn) {
  const id = logChange(itemId, kind, summary, batch);
  try { const out = await fn(); changeDone(id); return out; } catch (e) { dropChange(id); throw e; }
}
/** A draft (generated content waiting in the queue) in the change log: its row as it was. */
function logDraftChange(id, kind, summary, batch) {
  const row = db.prepare("SELECT * FROM content_items WHERE id = ?").get(id);
  if (!row) throw Object.assign(new Error("Unknown draft"), { status: 404 });
  return db.prepare("INSERT INTO ref_changes (item_id, kind, summary, batch, before, at) VALUES (?, ?, ?, ?, ?, ?)").run(id, kind, summary || "", batch || null, JSON.stringify(row), new Date().toISOString()).lastInsertRowid;
}
/** A flashcard / predict-the-output item in the change log. */
function logStageChange(id, kind, summary, batch) {
  const row = db.prepare("SELECT * FROM stage_items WHERE id = ?").get(id);
  if (!row) throw Object.assign(new Error("Unknown item"), { status: 404 });
  return db.prepare("INSERT INTO ref_changes (item_id, kind, summary, batch, before, at) VALUES (?, ?, ?, ?, ?, ?)").run(id, kind, summary || "", batch || null, JSON.stringify(row), new Date().toISOString()).lastInsertRowid;
}
/** One exercise's or MCQ's learning stage, set by hand: logged with the tag row as it was, undoable from History. */
const TAG_STAGES = { item: ["practise", "transfer", "reflect"], mcq: ["memorize", "understand"] };
function setTagStage(key, stage) {
  const row = db.prepare("SELECT * FROM item_tags WHERE key = ?").get(key);
  if (!row) throw Object.assign(new Error("No such tagged item"), { status: 404 });
  if (!(TAG_STAGES[row.kind] || []).includes(stage)) throw Object.assign(new Error("An " + (row.kind === "mcq" ? "MCQ" : "exercise") + " can be " + TAG_STAGES[row.kind].join(", ")), { status: 400 });
  if (row.stage === stage && row.status === "ok") return { ok: true, unchanged: true, key, stage };
  const at = new Date().toISOString();
  const cid = db.prepare("INSERT INTO ref_changes (item_id, kind, summary, batch, before, at) VALUES (?, 'tag-stage', ?, NULL, ?, ?)").run(key, "stage " + row.stage + " → " + stage, JSON.stringify(row), at).lastInsertRowid;
  db.prepare("UPDATE item_tags SET stage = ?, status = 'ok', source = 'admin', why = ?, updated_at = ? WHERE key = ?").run(stage, "stage set by hand (was " + row.stage + ")", at, key);
  db.prepare("UPDATE ref_changes SET after_status = ? WHERE id = ?").run(stage, cid);
  return { ok: true, key, stage, was: row.stage, change: Number(cid) };
}
/** Approve / reject a flashcard or predict item (logged, undoable). */
function setStageStatus(id, status, batch) {
  if (!["published", "rejected", "draft"].includes(status)) throw Object.assign(new Error("Bad status"), { status: 400 });
  const cid = logStageChange(id, status === "published" ? "stage-approve" : "stage-reject", status === "published" ? "approved" : "rejected", batch);
  db.prepare("UPDATE stage_items SET status = ?, updated_at = ? WHERE id = ?").run(status, new Date().toISOString(), id);
  db.prepare("UPDATE ref_changes SET after_status = ? WHERE id = ?").run(status, cid);
  return { ok: true, id, status };
}
/** Draft flashcards and predict items, with their concept, for the review queue. */
function stageQueue() {
  let rows = [];
  try { rows = db.prepare("SELECT * FROM stage_items WHERE status = 'draft' ORDER BY level, concept, kind, created_at").all(); } catch { return []; }
  const names = new Map(db.prepare("SELECT slug, name FROM concepts").all().map((c) => [c.slug, c.name]));
  return rows.map((r) => ({ id: r.id, kind: r.kind, concept: r.concept, conceptName: names.get(r.concept) || r.concept, level: r.level, data: JSON.parse(r.data), verify: JSON.parse(r.verify || "null"), source: r.source, created_at: r.created_at }));
}
function restoreRow(before) {
  const cols = Object.keys(before);
  db.prepare(`INSERT OR REPLACE INTO drill_refs (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((k) => before[k]));
}
/** Undo one change: the drill's row goes back to exactly what it was. Only the latest change of a drill can be undone. */
function undoChange(id, { build = true } = {}) {
  const ch = db.prepare("SELECT * FROM ref_changes WHERE id = ?").get(id);
  if (!ch) throw Object.assign(new Error("No such change"), { status: 404 });
  if (ch.undone_at) throw Object.assign(new Error("Already undone"), { status: 409 });
  if (db.prepare("SELECT 1 FROM ref_changes WHERE item_id = ? AND id > ? AND undone_at IS NULL").get(ch.item_id, id)) throw Object.assign(new Error("A later change to this drill must be undone first"), { status: 409 });
  const before = JSON.parse(ch.before);
  if (ch.kind.startsWith("mine-")) { const st = require("../admin/create.js").undoMine(ch); db.prepare("UPDATE ref_changes SET undone_at = ? WHERE id = ?").run(new Date().toISOString(), id); if (build) library.build(); return { ok: true, item_id: ch.item_id, status: st, kind: ch.kind }; }
  if (ch.kind.startsWith("stage-")) db.prepare("UPDATE stage_items SET status = ?, updated_at = ? WHERE id = ?").run(before.status, new Date().toISOString(), before.id);
  else if (ch.kind === "tag-stage") { const cols = Object.keys(before); db.prepare(`INSERT OR REPLACE INTO item_tags (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((k) => before[k])); }
  else if (ch.kind.startsWith("draft-")) db.prepare("UPDATE content_items SET status = ?, data = ?, verify = ?, updated_at = ? WHERE id = ?").run(before.status, before.data, before.verify, new Date().toISOString(), before.id);
  else restoreRow(before);
  db.prepare("UPDATE ref_changes SET undone_at = ? WHERE id = ?").run(new Date().toISOString(), id);
  if (build) library.build();
  return { ok: true, item_id: ch.item_id, status: ch.kind === "tag-stage" ? before.stage : before.status, kind: ch.kind };
}
/** Undo a whole bulk run (newest first). */
// one bulk action or Undo at a time: a second one waits for the first to finish (409)
let bulkBusy = null;
const busyError = () => Object.assign(new Error("Another bulk action or Undo is still running (" + bulkBusy + "): try again when it is done."), { status: 409 });
function undoBatch(batch) {
  if (bulkBusy) throw busyError();
  bulkBusy = "undo";
  try { return undoBatchNow(batch); } finally { bulkBusy = null; }
}
/** Undo one change from History (also waits for a running bulk action). */
function undoOne(id) {
  if (bulkBusy) throw busyError();
  return undoChange(id);
}
function undoBatchNow(batch) {
  let undone = 0;
  const skipped = [];
  db.exec("BEGIN");
  try {
  for (const { id } of db.prepare("SELECT id FROM ref_changes WHERE batch = ? AND undone_at IS NULL ORDER BY id DESC").all(batch)) {
    try { undoChange(id, { build: false }); undone++; } catch (e) { skipped.push({ id, why: e.message }); }
  }
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  db.exec("COMMIT");
  library.build();
  return { ok: true, undone, skipped };
}
const CHANGE_LABEL = { "mine-create": "created by hand (Mine)", "mine-edit": "edited by hand", "tag-stage": "learning stage set by hand", "stage-approve": "flashcard / predict item / lesson approved", "stage-reject": "flashcard / predict item / lesson rejected", "draft-reject": "draft rejected", "draft-approve": "draft approved", "setup-start": "starting state set up for the drill", recheck: "re-checked by the pipeline", "setup-rows": "rows added so the answer isn't empty", "fix-text": "drill-text fix applied", "fix-setup": "setup fix applied", "fix-ignore": "suggested fix ignored", decide: "decision in review" };
/** History: the latest changes, newest first, with whether each can be undone now. */
function changeList(limit = 400) {
  const c = library.get();
  const rows = db.prepare("SELECT id, item_id, kind, summary, batch, after_status, at, undone_at, CASE WHEN kind = 'tag-stage' THEN json_extract(before, '$.stage') ELSE json_extract(before, '$.status') END AS before_status, json_extract(before, '$.data') AS before_data FROM ref_changes ORDER BY id DESC LIMIT ?").all(limit);
  const latest = new Map();
  for (const r of db.prepare("SELECT item_id, MAX(id) AS id FROM ref_changes WHERE undone_at IS NULL GROUP BY item_id").all()) latest.set(r.item_id, r.id);
  const jobs = new Map(db.prepare("SELECT id, mode, started_at, queue_before, queue_after FROM ref_jobs WHERE mode LIKE 'fix-%' OR mode LIKE 'bulk-%'").all().map((j) => [j.id, j]));
  return rows.map((r) => {
    // a stage set by hand: the tag key names the exercise ("item:<id>") or the MCQ ("mcq:<id>")
    const i = c.byId.get(r.item_id) || (r.kind === "tag-stage" && r.item_id.startsWith("item:") ? c.byId.get(r.item_id.slice(5)) : null);
    const draft = !i && (r.kind.startsWith("draft-") || r.kind.startsWith("stage-")) ? (() => { try { const d = JSON.parse(r.before_data); return d && (d.front || d.question || d.prompt) ? { title: (r.kind.startsWith("stage-") ? "Card: " : "") + (d.front || d.question || d.prompt), level: d.level } : d; } catch { return null; } })() : null;
    if (r.kind.startsWith("mine-")) return { ...r, title: String(r.summary || "").replace(/^(created|edited) by hand: /, ""), level: null, label: CHANGE_LABEL[r.kind], canUndo: !r.undone_at && latest.get(r.item_id) === r.id, job: null };
    return { ...r, title: i ? i.title : draft ? draft.title || draft.q || r.item_id : r.item_id, level: i ? i.level : draft ? Number(draft.level) || null : null, label: CHANGE_LABEL[r.kind] || r.kind, canUndo: !r.undone_at && latest.get(r.item_id) === r.id, job: r.batch ? jobs.get(r.batch) || null : null };
  });
}

const BULK = { approve: "Approve", "use-a": "Use A", "use-b": "Use B", "use-c": "Use C", "use-all": "Use all", fix: "Apply suggested fix", self: "Leave unchecked (self-check)", reject: "Reject" };
/**
 * A bulk action on items picked in the review queue: [{ id, type: "ref" | "draft" }]. Items it doesn't apply to
 * are skipped (with the reason). One batch in History: "Undo the whole run" puts every item back.
 */
// bulk Approve publishes only items whose checks all passed; an item with warnings is approved on its own card
const WARNED = "has warnings: approve it on its own card after a look";
const unverified = (table, id) => { const r = db.prepare("SELECT verify FROM " + table + " WHERE id = ?").get(id); try { return !r || JSON.parse(r.verify).status !== "pass"; } catch { return true; } };
// rewritten by an AI in a repair round: skipped by bulk Approve unless the admin ticks "Include rewritten items"
const REWRITTEN = "rewritten by AI: check it first (or tick Include rewritten items)";
// (a rewritten item whose every check was run again and passed, verify.recheck.ok, counts as checked)
const rewritten = (table, id) => { const r = db.prepare("SELECT verify FROM " + table + " WHERE id = ?").get(id); try { const v = r && JSON.parse(r.verify); return !!(v && v.rewritten && !(v.recheck && v.recheck.ok)); } catch { return false; } };
async function bulkReview(args) {
  if (bulkBusy) throw busyError();
  bulkBusy = "bulk " + ((args && args.action) || "");
  try { return await bulkReviewNow(args); } finally { bulkBusy = null; }
}
async function bulkReviewNow({ items, action, includeRewritten = false }) {
  if (!BULK[action]) throw Object.assign(new Error("Unknown action"), { status: 400 });
  if (!Array.isArray(items) || !items.length) throw Object.assign(new Error("Nothing selected"), { status: 400 });
  if (current) throw Object.assign(new Error("A reference-answer job is running: try again when it's done."), { status: 409 });
  const id = db.prepare("INSERT INTO ref_jobs (levels, status, progress, total, usage, resolutions, mode, started_at, queue_before) VALUES ('[]', 'running', ?, ?, '{}', '{}', ?, ?, ?)")
    .run(BULK[action], items.length, "bulk-" + action, new Date().toISOString(), queueSize()).lastInsertRowid;
  const done = [], skipped = [], usage = {};
  const titleOf = (it) => { const i = library.get().byId.get(it.id); if (i) return i.title; const d = db.prepare("SELECT data FROM content_items WHERE id = ?").get(it.id); try { const x = JSON.parse(d.data); return x.title || x.q; } catch { return it.id; } };
  // approve / reject never wait on anything: one transaction (one disk write instead of three per item)
  const oneTx = action === "approve" || action === "reject";
  if (oneTx) db.exec("BEGIN");
  try {
  for (const it of items) {
    const title = titleOf(it);
    try {
      if (it.type === "tag") {
        if (action !== "use-a" && action !== "use-b") { skipped.push({ title: it.id, why: BULK[action] + " is not for tags: use Use A or Use B" }); continue; }
        require("./concepts.js").decideTag({ key: it.id, use: action === "use-b" ? "b" : "a" });
        done.push({ title: it.id, status: "tagged" });
        continue;
      }
      if (it.type === "stage") {
        if (action !== "approve" && action !== "reject") { skipped.push({ title: it.id, why: BULK[action] + " is not for flashcards or predict items" }); continue; }
        const cur = db.prepare("SELECT status FROM stage_items WHERE id = ?").get(it.id);
        if (!cur || cur.status !== "draft") { skipped.push({ title: it.id, why: "no longer a draft" }); continue; }
        if (action === "approve" && unverified("stage_items", it.id)) { skipped.push({ title: it.id, why: WARNED }); continue; }
        if (action === "approve" && !includeRewritten && rewritten("stage_items", it.id)) { skipped.push({ title: it.id, why: REWRITTEN }); continue; }
        setStageStatus(it.id, action === "approve" ? "published" : "rejected", id);
        done.push({ title: it.id, status: action === "approve" ? "published" : "rejected" });
        continue;
      }
      if (it.type === "draft" && action === "approve") {
        const row = db.prepare("SELECT status FROM content_items WHERE id = ?").get(it.id);
        if (!row || row.status !== "draft") { skipped.push({ title, why: "no longer a draft" }); continue; }
        if (unverified("content_items", it.id)) { skipped.push({ title, why: WARNED }); continue; }
        if (!includeRewritten && rewritten("content_items", it.id)) { skipped.push({ title, why: REWRITTEN }); continue; }
        const cid = logDraftChange(it.id, "draft-approve", "approved in a bulk action", id);
        content.setStatus(it.id, "published");
        changeDone(cid);
        done.push({ title, status: "published" });
        continue;
      }
      if (it.type === "draft") {
        if (action !== "reject") { skipped.push({ title, why: BULK[action] + " is for reference answers, not drafts" }); continue; }
        const row = db.prepare("SELECT status FROM content_items WHERE id = ?").get(it.id);
        if (!row || row.status !== "draft") { skipped.push({ title, why: "no longer a draft" }); continue; }
        const cid = logDraftChange(it.id, "draft-reject", "rejected in a bulk action", id);
        content.setStatus(it.id, "rejected");
        changeDone(cid);
        done.push({ title, status: "rejected" });
        continue;
      }
      const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(it.id);
      if (!row || row.status !== "review") { skipped.push({ title, why: "no longer in review" }); continue; }
      if (action === "reject" || action === "approve") { skipped.push({ title, why: BULK[action] + " is for drafts: decide a built-in drill with Use A / B / C or Leave unchecked" }); continue; }
      if (action === "fix") {
        const fix = JSON.parse(row.fix || "null");
        if (!fix || !fix.fault || fix.status !== "open" || fix.kind === "server") { skipped.push({ title, why: "no suggested fix to apply" }); continue; }
        const out = await logged(it.id, "fix-" + fix.kind, fix.why, id, () => applyFix(row, fix, usage, { build: false }));
        done.push({ title, status: out.status });
        continue;
      }
      const use = action === "self" ? "self" : action === "use-all" ? "all" : action.slice(4);
      if (use.length === 1 && !usableSide(JSON.parse(row[use] || "null"))) { skipped.push({ title, why: "solution " + use.toUpperCase() + (row[use] ? " failed" : " doesn't exist") }); continue; }
      const out = await decideLogged({ item_id: it.id, use }, id);
      done.push({ title, status: out.status, accepted: out.accepted });
    } catch (e) { skipped.push({ title, why: e.message }); }
  }
  } catch (e) { if (oneTx) { db.exec("ROLLBACK"); } throw e; }
  if (oneTx) db.exec("COMMIT");
  library.build();
  const counts = done.reduce((m, x) => ((m[x.status] = (m[x.status] || 0) + 1), m), {});
  db.prepare("UPDATE ref_jobs SET status = 'done', processed = ?, matched = ?, review = ?, not_query = ?, errors = ?, progress = NULL, usage = ?, finished_at = ?, queue_after = ? WHERE id = ?")
    .run(items.length, counts.matched || 0, counts.review || 0, counts.self || 0, skipped.length, JSON.stringify(usage), new Date().toISOString(), queueSize(), id);
  return { ok: true, batch: id, action: BULK[action], done: done.length, counts, skipped, cost: Math.round(costOf(usage) * 10000) / 10000 };
}

/** Applies one suggested fix and re-runs the drill through the whole pipeline. No library rebuild when bulk. */
async function applyFix(row, fix, usage, { build = true } = {}) {
  let item = library.get().byId.get(row.item_id);
  const site = siteOf(item);
  const at = new Date().toISOString();
  const original = row.prompt_original || taskText(item);
  if (fix.kind === "server") throw Object.assign(new Error("This fix needs a MySQL server setting: it is never applied from the review queue."), { status: 400 });
  if (fix.kind === "setup") {
    // setup for this drill only: it must run on a fresh copy, as the restricted user
    const probe = await writecheck.runOnDataset(site, "SELECT 1", fix.dataset_sql);
    if (!probe.ok) throw Object.assign(new Error("The setup fails on MySQL: " + probe.error), { status: 400 });
  }
  // the pipeline sees the fixed text directly (the library is rebuilt once at the end of a bulk run)
  const target = fix.kind === "text" ? { ...item, body: fix.new_prompt } : item;
  const out = row.mode === "state" ? await solveWrite(target, usage, fix.kind === "setup" ? { setup: fix.dataset_sql } : {}) : await solveOne(target, usage, null);
  save(target, out);
  const history = JSON.parse(row.history || "[]");
  const done = { ...fix, status: "applied", applied_at: at, result: out.status };
  history.push({ step: "fix", detail: { by: "admin", choice: "applied", kind: fix.kind, why: fix.why, result: out.status }, at });
  // save() replaces the row: keep the applied text, the fix and the history
  const rewritten = out.prompt_rewritten || (fix.kind === "text" ? fix.new_prompt : row.prompt_rewritten);
  db.prepare("UPDATE drill_refs SET prompt_original = ?, prompt_rewritten = ?, fix = ?, history = ? WHERE item_id = ?")
    .run(rewritten ? original : row.prompt_original, rewritten || null, JSON.stringify(done), JSON.stringify(history.concat(out.history || []).filter((h, k, l) => l.findIndex((x) => JSON.stringify(x) === JSON.stringify(h)) === k)), row.item_id);
  if (build) library.build();
  return out;
}
/** Apply or ignore one suggested fix (logged, undoable). */
async function decideFix({ item_id, action }) {
  const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(item_id);
  const fix = row && JSON.parse(row.fix || "null");
  if (!row || !fix || !fix.fault) throw Object.assign(new Error("No suggested fix for this drill"), { status: 404 });
  if (fix.status !== "open") throw Object.assign(new Error("This fix was already " + fix.status), { status: 409 });
  if (action === "ignore") {
    return logged(item_id, "fix-ignore", fix.why, null, () => {
      const history = JSON.parse(row.history || "[]");
      history.push({ step: "fix", detail: { by: "admin", choice: "ignored", why: fix.why }, at: new Date().toISOString() });
      db.prepare("UPDATE drill_refs SET fix = ?, history = ? WHERE item_id = ?").run(JSON.stringify({ ...fix, status: "ignored" }), JSON.stringify(history), item_id);
      return { ok: true, status: row.status };
    });
  }
  if (action !== "apply") throw Object.assign(new Error("action must be apply or ignore"), { status: 400 });
  const usage = {};
  const out = await logged(item_id, "fix-" + fix.kind, fix.why, null, () => applyFix(row, fix, usage));
  return { ok: true, status: out.status, reason: out.reason || "", cost: Math.round(costOf(usage) * 10000) / 10000 };
}
/** Review decisions (Use A/B/C, own SQL, leave unchecked, send back), logged so History can undo them. */
function decideLogged(args, batch) {
  const what = Array.isArray(args.use) ? "used " + args.use.map((k) => SIDE_LABEL[k] || k).join(" + ") : { a: "used A", b: "used B", c: "used C", all: "used all", own: "own SQL", none: "left unchecked (self-check)", self: "left unchecked (self-check)", reopen: "sent back to review" }[args.use] || args.use;
  return logged(args.item_id, "decide", what, batch || null, () => decide(args, { build: !batch }));
}
const openFixes = (kind) => db.prepare("SELECT * FROM drill_refs WHERE status = 'review' AND fix IS NOT NULL").all()
  .filter((r) => { const x = JSON.parse(r.fix); return x.fault && x.status === "open" && x.kind === kind; });
const queueSize = () => db.prepare("SELECT COUNT(*) AS n FROM drill_refs WHERE status = 'review'").get().n;
/** Bulk: apply every open fix of one kind ("text" | "setup"); each drill re-runs the full pipeline. One batch in History. */
function startFixAll(kind) {
  if (!["text", "setup"].includes(kind)) throw Object.assign(new Error("kind must be text or setup"), { status: 400 });
  if (current) return { started: false, message: "A reference-answer job is already running." };
  const todo = openFixes(kind);
  if (!todo.length) return { started: false, message: "No open " + kind + " fixes." };
  const id = db.prepare("INSERT INTO ref_jobs (levels, status, progress, total, usage, resolutions, mode, started_at, queue_before) VALUES ('[]', 'running', 'Starting…', ?, '{}', '{}', ?, ?, ?)")
    .run(todo.length, "fix-" + kind, new Date().toISOString(), queueSize()).lastInsertRowid;
  const usage = {}, resolutions = {}, counts = { processed: 0, matched: 0, review: 0, not_query: 0, errors: 0 };
  const persist = (progress) => db.prepare("UPDATE ref_jobs SET progress = ?, processed = ?, matched = ?, review = ?, not_query = ?, errors = ?, usage = ?, resolutions = ? WHERE id = ?")
    .run(progress, counts.processed, counts.matched, counts.review, counts.not_query, counts.errors, JSON.stringify(usage), JSON.stringify(resolutions), id);
  current = { id, stop: false };
  const job = current;
  (async () => {
    let next = 0;
    const worker = async () => {
      while (!job.stop && next < todo.length) {
        const queued = todo[next++];
        try {
          // fresh row: a fix decided by hand meanwhile is skipped
          const row = db.prepare("SELECT * FROM drill_refs WHERE item_id = ?").get(queued.item_id);
          const fix = JSON.parse(row.fix || "null");
          if (row.status !== "review" || !fix || fix.status !== "open") { counts.processed++; continue; }
          const out = await logged(row.item_id, "fix-" + kind, fix.why, id, () => applyFix(row, fix, usage, { build: false }));
          counts[out.status] = (counts[out.status] || 0) + 1;
          if (out.status === "matched") resolutions[out.resolution] = (resolutions[out.resolution] || 0) + 1;
        } catch (e) {
          counts.errors++;
          console.warn(`[refs] fix-all ${queued.item_id}: ${e.message}`);
          if (e.offline) { job.stop = true; job.offline = true; }
        }
        counts.processed++;
        persist(`Applying ${kind} fixes: ${counts.processed} of ${todo.length}`);
      }
    };
    try {
      await Promise.all(Array.from({ length: CONCURRENCY }, worker));
      persist(job.stop ? (job.offline ? "Stopped: MySQL is offline." : `Stopped after ${counts.processed} of ${todo.length}.`) : null);
      db.prepare("UPDATE ref_jobs SET status = ?, finished_at = ?, queue_after = ? WHERE id = ?").run(job.stop ? "stopped" : "done", new Date().toISOString(), queueSize(), id);
    } catch (e) {
      db.prepare("UPDATE ref_jobs SET status = 'failed', error = ?, finished_at = ?, queue_after = ? WHERE id = ?").run(e.message, new Date().toISOString(), queueSize(), id);
    } finally {
      current = null;
      library.build();
    }
  })();
  return { started: true, id, total: todo.length };
}
/** Open fixes per kind (for the bulk buttons) and the latest bulk run. */
function fixSummary() {
  const last = db.prepare("SELECT * FROM ref_jobs WHERE mode LIKE 'fix-%' ORDER BY id DESC LIMIT 1").get();
  return { text: openFixes("text").length, setup: openFixes("setup").length, running: !!current, last: last ? jobView(last) : null, queue: queueSize() };
}

module.exports = { undoOne, setTagStage, TAG_STAGES, start, stop, summary, reviewList, historyList, decide, verifyAll, verifyStates, solveWrite, sameResult, sameRowsDifferentColumns, makeSelfCheck, suggestFixes, decideFix, tidyFix, makeProbe, fixZeroRows, fixNoChange, recheck, applyFix, logged, saveRef: save, solveOne, asChecked, decideLogged, bulkReview, stageQueue, setStageStatus, verifyAccepted, startFixAll, fixSummary, changeList, undoChange, undoBatch };
