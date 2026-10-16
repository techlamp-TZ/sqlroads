// Filling the learning-model gaps (Part 2): flashcards (memorize), predict-the-output (understand), practise
// drills for thin concepts and transfer tasks. Every SQL in every item is run before it is saved; a second
// provider reviews the wording. Everything is saved as a draft for the admin review queue.
const crypto = require("node:crypto");
const db = require("../db.js");
const library = require("../library/library.js");
const content = require("./content.js");
const cc = require("../library/concepts.js");
const writecheck = require("../library/writecheck.js");
const SqlCompare = require("../public/compare.js");
const { splitSql } = require("../course/split-sql.js");

db.exec(`CREATE TABLE IF NOT EXISTS stage_items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('flashcard', 'predict', 'lesson', 'card')), concept TEXT NOT NULL, level INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'rejected')), data TEXT NOT NULL, verify TEXT, source TEXT NOT NULL,
  batch TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
const now = () => new Date().toISOString();
const newId = (p) => p + "-" + crypto.randomBytes(5).toString("hex");
const SITES = Object.fromEntries(Object.entries(library.DATASETS).map(([site, d]) => [d.key, site]));
const stats = { flashcard: { made: 0, dropped: 0 }, predict: { made: 0, dropped: 0 }, drill: { made: 0, dropped: 0 } };

// ---------- datasets for a concept ----------
function conceptRows() { return new Map(cc.allConcepts().map((c) => [c.slug, c])); }
/** The SQLite datasets a concept is practised on (most used first). */
function practiseSites(slug) {
  const c = library.get();
  const n = {};
  for (const t of db.prepare("SELECT key, concepts FROM item_tags WHERE kind = 'item' AND stage = 'practise'").all()) {
    if (!JSON.parse(t.concepts).includes(slug)) continue;
    const i = c.byId.get(t.key.slice(5));
    if (i && i.kind === "sqlite" && SITES[i.dataset]) n[SITES[i.dataset]] = (n[SITES[i.dataset]] || 0) + 1;
  }
  return Object.keys(n).sort((a, b) => n[b] - n[a]);
}
const DEFAULT_SITE = { 1: "sqlzoo", 2: "sqltutorialorg", 3: "tpointtech", 4: "tpointtech", 5: "tpointtech", 6: "w3schools", 7: "sqltutorialorg", 8: "geeksforgeeks", 9: "geeksforgeeks", 10: "sqlcourse", 11: "w3schools", 12: "tpointtech", 13: "tpointtech", 14: "tpointtech" };
const siteFor = (c) => practiseSites(c.slug)[0] || DEFAULT_SITE[c.level] || "tpointtech";

// ---------- running SQL on a fresh copy: SQLite first, MySQL scratch copy when SQLite can't ----------
async function runScript(site, sql) {
  const text = String(sql || "").trim();
  if (!text) return { ok: false, error: "no SQL" };
  let d = null;
  try {
    d = content.freshDataset(site);
    let last = null;
    for (const s of splitSql(text).filter((x) => x.trim())) {
      const st = d.prepare(s);
      if (st.columns().length) {
        st.setReturnArrays(true);
        // at most 51 rows: no item shows more, and a runaway query (a cross join) must not fill the memory
        const cols = st.columns().map((c) => c.name), rows = [];
        for (const row of st.iterate()) { rows.push(row); if (rows.length > 50) break; }
        // SQLite rewrites some ALTER TABLE forms into SELECT sqlite_fail(...): that is a failure, not a result
        const fail = cols.find((n) => /^sqlite_fail\(/i.test(n));
        if (fail) throw new Error(fail.replace(/^sqlite_fail\('?/i, "").replace(/'?, \d+\)$/, ""));
        last = { columns: cols, rows };
      } else st.run();
    }
    return { ok: true, engine: "SQLite", result: last };
  } catch (e1) {
    try {
      const r = await writecheck.runOnDataset(site, text);
      if (r.ok) return { ok: true, engine: "MySQL", result: r.result ? { columns: r.result.columns, rows: r.result.rows } : null };
      return { ok: false, error: "SQLite: " + e1.message + " · MySQL: " + r.error };
    } catch (e2) { return { ok: false, error: "SQLite: " + e1.message }; }
  } finally { if (d) try { d.close(); } catch {} }
}
const sameRows = (a, b) => !!(a && b) && SqlCompare.compare({ columns: a.columns, rows: a.rows }, { columns: b.columns, rows: b.rows }, false).ok;
// a different order is a different result when the query sorts (ORDER BY outside window functions)
const sameRowsAs = (a, b, ordered) => !!(a && b) && SqlCompare.compare({ columns: a.columns, rows: a.rows }, { columns: b.columns, rows: b.rows }, !!ordered).ok;
const sortsRows = (sql) => /\border\s+by\b/i.test(String(sql || "").replace(/\bover\s*\([^)]*\)/gi, ""));

function saveStage(kind, c, data, checks, batch) {
  const failed = checks.filter((x) => !x.ok && !x.warn).length, warned = checks.filter((x) => !x.ok && x.warn).length;
  const verify = { status: failed ? "fail" : warned ? "warn" : "pass", checks, at: now() };
  const id = newId(kind === "flashcard" ? "fc" : kind === "lesson" ? "ls" : kind === "card" ? "cd" : "po");
  db.prepare("INSERT INTO stage_items (id, kind, concept, level, status, data, verify, source, batch, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)")
    .run(id, kind, c.slug, c.level, JSON.stringify(data), JSON.stringify(verify), "ai:stage", batch || null, now(), now());
  return id;
}

// ---------- flashcards ----------
const SYSTEM_FC = `You write flashcards for one SQL concept, for learners who are memorizing syntax and keywords.
Reply with ONLY a JSON array of N cards. Use a mix of these types (at least one of each type that fits the concept):
- {"type": "keyword", "front": "a keyword, clause or function", "back": "what it means / does, one sentence"}
- {"type": "blank", "prompt": "short instruction", "sql": "a complete statement with exactly one ___ gap", "answer": "the text that fills the gap"}
- {"type": "order", "prompt": "Put the clauses in the right order", "parts": ["clause 1", "clause 2", ...]}  (3-7 parts, given IN THE CORRECT ORDER; joined with spaces they must form one runnable statement)
- {"type": "error", "prompt": "Spot the error", "wrong_sql": "a statement with ONE typical mistake", "fixed_sql": "the corrected statement", "explanation": "one sentence: what was wrong"}
Rules: every SQL uses only the tables and columns of the DATASET below and must run on SQLite (if the concept needs MySQL-only syntax such as stored procedures, MySQL triggers, AUTO_INCREMENT or isolation levels, write MySQL 8: it runs on a MySQL copy of the same tables). A "wrong_sql" must really be wrong: an error, or a different result from "fixed_sql". If the concept is about users, roles, privileges, backups or other things outside one database, write only "keyword" cards. Keep every card about THIS concept.`;
const SYSTEM_FC_REVIEW = `You review flashcards for a SQL course. For each card check that it is correct, unambiguous, about the named concept, and that a "blank" has exactly one sensible answer. Reply with ONLY a JSON array: [{"i": 0, "ok": true}] or [{"i": 0, "ok": false, "why": "short reason"}]`;
async function verifyCard(site, card) {
  const t = card.type;
  if (t === "keyword") return String(card.front || "").trim() && String(card.back || "").trim() ? { ok: true, label: "Keyword card (no SQL)" } : { ok: false, why: "empty card" };
  if (t === "blank") {
    if ((String(card.sql).match(/___/g) || []).length !== 1 || !String(card.answer || "").trim()) return { ok: false, why: "a blank card needs exactly one ___ and an answer" };
    const r = await runScript(site, String(card.sql).replace("___", card.answer));
    return r.ok ? { ok: true, engine: r.engine, label: "The statement with the answer filled in runs on " + r.engine } : { ok: false, why: r.error };
  }
  if (t === "order") {
    if (!Array.isArray(card.parts) || card.parts.length < 3) return { ok: false, why: "an order card needs 3+ parts" };
    const r = await runScript(site, card.parts.join(" "));
    return r.ok ? { ok: true, engine: r.engine, label: "The clauses in this order run on " + r.engine } : { ok: false, why: r.error };
  }
  if (t === "error") {
    const fixed = await runScript(site, card.fixed_sql);
    if (!fixed.ok) return { ok: false, why: "the fixed SQL fails: " + fixed.error };
    const wrong = await runScript(site, card.wrong_sql);
    if (wrong.ok && sameRows(wrong.result, fixed.result) && wrong.result) return { ok: false, why: "the wrong SQL gives the same result as the fixed one" };
    if (wrong.ok && !wrong.result && !fixed.result) return { ok: false, why: "can't show the difference (neither returns rows)" };
    return { ok: true, engine: fixed.engine, label: "Fixed SQL runs on " + fixed.engine + "; the wrong one " + (wrong.ok ? "gives a different result" : "fails") };
  }
  return { ok: false, why: "unknown card type" };
}
async function flashcardsFor(c, batch, n = 8, opts = {}) {
  const site = opts.site || siteFor(c);
  const user = `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\nN = ${n}\nDATASET (${site}):\n${content.schemaText(site)}` + (opts.seed ? "\n\nBASE THE CARDS ON THIS TASK, TAKEN FROM A SCREENSHOT (keep its idea, adapt it to the DATASET above; never copy a website, book or author name):\n" + opts.seed : "");
  let cards = [];
  try { cards = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_FC, user, 3500)).text) || []; } catch { cards = []; }
  // a reply that isn't valid JSON (e.g. application code inside a string): ask once more for keyword cards only
  if (!cards.length) try { cards = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_FC, user + "\n\nUse ONLY \"keyword\" cards, plain text, no code. The reply must be valid JSON.", 2500)).text) || []; } catch { cards = []; }
  const kept = [];
  for (const card of cards.filter((x) => x && x.type)) {
    const v = await verifyCard(site, card);
    if (!v.ok) { stats.flashcard.dropped++; continue; }
    kept.push({ card, v });
  }
  let reviews = [];
  if (kept.length) try { reviews = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_FC_REVIEW, `CONCEPT: ${c.name}\n` + JSON.stringify(kept.map((k, i) => ({ i, ...k.card }))), 2500)).text) || []; } catch { reviews = []; }
  const rBy = new Map(reviews.filter((x) => x && x.i != null).map((x) => [Number(x.i), x]));
  kept.forEach((k, i) => {
    const r = rBy.get(i);
    saveStage("flashcard", c, { ...k.card, concept: c.slug, site, engine: k.v.engine || null }, [
      { ok: true, label: k.v.label }, { ok: !r || r.ok !== false, warn: true, label: "Second provider (OpenAI): correct and unambiguous", detail: r && r.ok === false ? r.why : "" }], batch);
    stats.flashcard.made++;
  });
  return kept.length;
}

// ---------- predict the output ----------
const SYSTEM_PO = `You write "predict the output" exercises for one SQL concept: the learner sees a few rows of a table and a query, and predicts the result before running it.
Reply with ONLY a JSON array of N objects:
[{"question": "one short line, e.g. What does this query return?", "show_sql": "a SELECT that shows the few input rows the query works on (2-8 rows)", "sql": "the query to predict (or statements ending with a SELECT), returning 1-6 rows", "mistakes": ["2-3 queries that a learner with a typical misunderstanding of this concept would think are equivalent; each must return a DIFFERENT result"]}]
Rules: only the tables and columns of the DATASET below; SQLite syntax (MySQL 8 only when the concept needs it). The question must not reveal or hint at the result. Keep results tiny and the point of the concept visible (NULLs, duplicates, ties, missing matches ...). The input rows shown must be enough to work the answer out.
Concepts about changing data or structure (INSERT, UPDATE, DELETE, constraints, DDL, functions, transactions): "sql" is the statements followed by a SELECT that shows the effect (e.g. INSERT ... ; SELECT ... ). A statement that would fail must not stop the script: show the effect with INSERT OR IGNORE / ON CONFLICT DO NOTHING and a SELECT COUNT(*), or ask what a SELECT returns after it. SQLite has no CREATE FUNCTION or procedures: for those concepts predict the output of a SELECT that calls a built-in function or uses the logic such a function would wrap. Qualify every column when tables are joined. Give explicit key values in INSERTs.`;
const SYSTEM_PO_REVIEW = `You review "predict the output" items for a SQL course. Each has the input rows, the query and its real result. Check that the result can be worked out from the rows shown and that the item teaches the named concept. Reply with ONLY a JSON array: [{"i": 0, "ok": true}] or [{"i": 0, "ok": false, "why": "short reason"}]`;
// the first rows of each table, so a repair can pick rows that exist
function sampleRows(site) {
  let d = null;
  try {
    d = content.freshDataset(site);
    return d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().slice(0, 8).map((t) => {
      const st = d.prepare("SELECT * FROM \"" + t.name + "\" LIMIT 4");
      return t.name + ": " + JSON.stringify(st.all());
    }).join("\n").slice(0, 4000);
  } catch { return ""; } finally { if (d) try { d.close(); } catch {} }
}
async function predictsFor(c, batch, n = 3, keepMax = 3) {
  const site = siteFor(c);
  const user = `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\nN = ${n}\nDATASET (${site}):\n${content.schemaText(site)}`;
  let list = [];
  try { list = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_PO, user, 3500)).text) || []; } catch { list = []; }
  const kept = [];
  // one repair round: items whose SQL failed or returned the wrong number of rows go back with the real outcome
  // "no rows" is the real answer the concept teaches for anti-joins and set differences (the NOT IN + NULL trap)
  const emptyOk = /not-exists|not-in|except|anti/.test(c.slug);
  const outcome = (r, max) => !r.ok ? "error: " + String(r.error).slice(0, 200) : !r.result ? "no result (the last statement must be a SELECT)" : !r.result.rows.length && !(emptyOk && max === 6) ? "0 rows (pick rows that exist; if the data has no non-matching rows, start sql AND show_sql with the same INSERT of one row with an explicit key so there is one)" : r.result.rows.length > max ? r.result.rows.length + " rows (too many; max " + max + ")" : "";
  const bad = [];
  for (const p of list.filter((x) => x && x.sql && x.show_sql)) {
    const s1 = await runScript(site, p.show_sql), a1 = await runScript(site, p.sql);
    const why = outcome(s1, 8) ? "show_sql " + outcome(s1, 8) : outcome(a1, 6) ? "sql " + outcome(a1, 6) : "";
    if (why) bad.push({ ...p, problem: why });
  }
  if (bad.length) {
    try {
      const fixed = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_PO, user + "\n\nThese items failed when run. Return corrected versions (same JSON shape, N = " + bad.length + "). Real rows of the main tables:\n" + sampleRows(site) + "\n\nFAILED:\n" + JSON.stringify(bad), 3500)).text) || [];
      list = list.filter((p) => !bad.some((b) => b.sql === p.sql)).concat(fixed);
    } catch {}
  }
  for (const p of list.filter((x) => x && x.sql && x.show_sql)) {
    const show = await runScript(site, p.show_sql), ans = await runScript(site, p.sql);
    if (!show.ok || !show.result || !show.result.rows.length || show.result.rows.length > 8) { stats.predict.dropped++; if (process.env.SG_DEBUG) console.warn("[po drop show]", c.slug, show.error || (show.result ? show.result.rows.length + " rows" : "no result")); continue; }
    if (!ans.ok || !ans.result || (!ans.result.rows.length && !emptyOk) || ans.result.rows.length > 6) { stats.predict.dropped++; if (process.env.SG_DEBUG) console.warn("[po drop ans]", c.slug, ans.error || (ans.result ? ans.result.rows.length + " rows" : "no result"), String(p.sql).slice(0, 160)); continue; }
    // wrong choices: the real outputs of the mistaken queries, each different from the answer and from each other
    const options = [ans.result];
    for (const m of (p.mistakes || []).slice(0, 4)) {
      const r = await runScript(site, m);
      if (r.ok && r.result && r.result.rows.length <= 8 && !options.some((o) => sameRows(o, r.result) && o.columns.length === r.result.columns.length)) options.push(r.result);
    }
    kept.push({ p, show: show.result, answer: ans.result, distractors: options.slice(1, 4), engine: ans.engine });
  }
  kept.splice(Math.max(0, keepMax - db.prepare("SELECT COUNT(*) n FROM stage_items WHERE kind = 'predict' AND concept = ? AND status != 'rejected'").get(c.slug).n));
  let reviews = [];
  if (kept.length) try { reviews = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_PO_REVIEW, `CONCEPT: ${c.name}\n` + JSON.stringify(kept.map((k, i) => ({ i, question: k.p.question, input: k.show, sql: k.p.sql, result: k.answer }))), 2500)).text) || []; } catch { reviews = []; }
  const rBy = new Map(reviews.filter((x) => x && x.i != null).map((x) => [Number(x.i), x]));
  kept.forEach((k, i) => {
    const r = rBy.get(i);
    saveStage("predict", c, { question: k.p.question || "What does this query return?", show_sql: k.p.show_sql, show: k.show, sql: k.p.sql, answer: k.answer, distractors: k.distractors, concept: c.slug, site, engine: k.engine }, [
      { ok: true, label: "Input rows and the answer are the real output on " + k.engine },
      { ok: k.distractors.length >= 1, warn: true, label: "Wrong choices from real mistaken queries", detail: k.distractors.length + " distinct" + (k.distractors.length ? "" : ": typed answer only") },
      { ok: !r || r.ok !== false, warn: true, label: "Second provider (OpenAI): answerable from the rows shown", detail: r && r.ok === false ? r.why : "" }], batch);
    stats.predict.made++;
  });
  return kept.length;
}

// ---------- practise drills and transfer tasks ----------
const SYSTEM_DRILL = `You write SQL exercises for one concept of a SQL course. Reply with ONLY a JSON array of N objects:
[{"title": "short title", "task": "the task in plain English: what to show (exact columns) and how to sort if order matters", "solution_sql": "...", "diff": "easy|medium|hard"}]
Rules: only the tables and columns of the DATASET below. The solution must be ONE SQLite SELECT (or WITH ... SELECT) returning 1-200 rows, unless the concept is about changing data or structure: then MySQL 8 statements that change something (they are checked by the end state on a MySQL copy). Don't reveal the solution in the task. Use concrete values in the task and the solution (e.g. "page 3, 10 rows per page"): never placeholders or parameters such as :page, ? or @id.`;
const KIND_PRACTISE = "PRACTISE: drill the concept directly; vary difficulty (at least one medium or hard).";
const KIND_TRANSFER = "TRANSFER: a business-style word problem: a realistic question from a manager or analyst about this dataset, framed as what to find out (not which SQL to write). It must use this concept together with an EARLIER concept named below.";
async function drillsFor(c, stage, batch, n, opts = {}) {
  const concepts = conceptRows();
  const avoid = new Set(practiseSites(c.slug));
  const sites = Object.values(SITES);
  const site = opts.site || (stage === "transfer" ? (sites.find((s) => !avoid.has(s) && s !== siteFor(c)) || sites[0]) : siteFor(c));
  const writeRule = c.level >= 10 && c.level <= 13 ? "\nThis level is checked as '" + content.LEVEL_TOPIC[c.level] + "': the solution MUST be MySQL 8 statements that change data or structure using the concept (INSERT / UPDATE / DELETE / CREATE / ALTER / transactions ...); it may end with a SELECT. Create any table or constraint the task needs." : "";
  const earlier = [...concepts.values()].filter((x) => x.level < c.level).slice(-12);
  const user = `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}${writeRule}\n${stage === "transfer" ? KIND_TRANSFER + "\nEARLIER CONCEPTS: " + earlier.map((x) => x.name).join(", ") : KIND_PRACTISE}\nN = ${n}\nDATASET (${site}):\n${content.schemaText(site)}` + (opts.seed ? "\n\nBASE THE EXERCISES ON THIS TASK, TAKEN FROM A SCREENSHOT (keep its idea, adapt it to the DATASET above; never copy a website, book or author name):\n" + opts.seed : "");
  let list = [];
  try { list = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_DRILL, user, 3500)).text) || []; } catch { list = []; }
  const refs = require("../library/refs.js");
  const ids = [];
  // two rounds: the second sends the failed drills back with the checks that failed
  for (let round = 0; round < 2 && list.length; round++) {
  const failed = [];
  for (const d of list.filter((x) => x && x.title && x.task && x.solution_sql)) {
    const data = { site, dataset: library.DATASETS[site].key, level: c.level, topic: content.LEVEL_TOPIC[c.level], diff: ["easy", "medium", "hard"].includes(d.diff) ? d.diff : "medium", title: d.title, task: d.task, solution_sql: d.solution_sql, concepts: [c.slug], stage };
    const saved = await content.saveItemAsync({ kind: "drill", status: "draft", data, source: "ai:stage " + stage + (opts.tag ? " " + opts.tag : ""), jobId: batch });
    if (saved.verify && saved.verify.status === "fail") { content.removeItem ? content.removeItem(saved.id) : db.prepare("DELETE FROM content_items WHERE id = ?").run(saved.id); stats.drill.dropped++; failed.push({ ...d, failed_checks: (saved.verify.checks || []).filter((x) => !x.ok && !x.warn).map((x) => x.label + ": " + (x.detail || "")) }); if (process.env.SG_DEBUG) console.warn("[drill drop]", c.slug, stage, JSON.stringify((saved.verify.checks || []).filter((x) => !x.ok && !x.warn)).slice(0, 300), String(d.solution_sql).slice(0, 200)); continue; }
    // independent check: the reference pipeline (two providers, retry, tie-breaker) solves the task from its text alone
    const usage = {};
    const item = { id: "gen-" + saved.id, title: d.title, body: d.task, intro: "", dataset: data.dataset, chapterKey: null, order: 0, level: c.level };
    let agree, detail = "";
    try {
      if (require("../library/writecheck.js").isWrite(d.solution_sql)) {
        const out = await refs.solveWrite(item, usage);
        const mine = await writecheck.runOnDataset(site, d.solution_sql);
        agree = out.status === "matched" && mine.ok && writecheck.compareRuns({ changed: out.chosen.changed, result: out.chosen.result, inTx: out.chosen.inTx }, mine).same;
        detail = out.status === "matched" ? (agree ? "the independent answer ends in the same database state" : "the independent answer ends in a different state") : "the providers didn't settle on one answer (" + out.status + ")";
      } else {
        const out = await refs.solveOne(item, usage, null);
        const mine = content.runAll(site, d.solution_sql);
        agree = out.status === "matched" && mine.ok && refs.sameResult(out.chosen.result, mine, SqlCompare.asksForOrder(d.title + " " + d.task)).same;
        detail = out.status === "matched" ? (agree ? "the independent answer returns the same result" : "the independent answer returns a different result") : "the providers didn't settle on one answer (" + out.status + ")";
      }
    } catch (e) { agree = false; detail = "check failed: " + e.message; }
    Object.entries(usage).forEach(([m, u]) => { const x = (cc.usage[m] = cc.usage[m] || { input: 0, output: 0, calls: 0 }); x.input += u.input; x.output += u.output; x.calls += u.calls || 0; });
    const v = saved.verify || { checks: [] };
    v.checks.push({ ok: !!agree, warn: true, label: "Independent A/B/tie-breaker answer agrees", detail });
    v.status = v.checks.some((x) => !x.ok && !x.warn) ? "fail" : v.checks.some((x) => !x.ok) ? "warn" : "pass";
    db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify(v), saved.id);
    ids.push(saved.id);
    stats.drill.made++;
  }
  if (ids.length >= n || !failed.length || round) break;
  try { list = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_DRILL, user.replace(/\nN = \d+/, "\nN = " + Math.min(failed.length, n - ids.length)) + "\n\nThese drills failed the checks below. Return corrected versions (same JSON shape):\n" + JSON.stringify(failed.slice(0, n - ids.length)), 3500)).text) || []; } catch { list = []; }
  }
  return ids.length;
}

// ---------- predict the output with checked input rows ----------
// The learner sees every table the query reads, each limited to the rows it uses (all columns). That this is
// enough is checked, not judged: the query must give the same result on a copy where those tables hold ONLY the
// rows shown, and every table it reads must be shown.
const SYSTEM_PO_INPUT = `You write one "predict the output" item for a SQL concept: the learner sees the input rows and a query, and predicts the result. The learner must be able to work the answer out from the rows shown alone.
Reply with ONLY one JSON object: {"question": "...", "inputs": [{"table": "name", "where": "condition"}], "sql": "...", "plain_sql": "...", "mistakes": ["3-4 scripts"]}
Rules:
- "inputs": EVERY table the query reads, each with a WHERE condition that picks the rows shown (2-8 rows per table; all their columns are shown). At most 3 tables.
- "sql" must return exactly the same result when those tables contain ONLY the rows picked: put the same conditions into the query itself (WHERE, ON or a subquery filter) so it reads nothing else. 1-6 result rows (0 only when "no rows" is the point of the concept). SQLite syntax only. Statements that change data are fine if they end with a SELECT.
- The concept must CHANGE the result: pick input rows where it matters (rows with NULLs for NULL handling, duplicates for DISTINCT / UNION, tied values for tie-breakers and ranking, unmatched rows for outer and anti joins, ...). "plain_sql" is the same query written without the concept (no tie-breaker, = NULL instead of IS NULL, no DISTINCT, an inner join instead of the outer join, ...): its result must differ from the result of "sql" on these rows.
- "mistakes": complete scripts (repeat any statement the sql starts with) a learner with a typical misunderstanding of the concept would write; each must return a DIFFERENT result from "sql" and from each other, at most 8 rows.
- Only the tables and columns of the DATASET. The question must not reveal or hint at the result.`;
const datasetTables = new Map();
function tablesOf(site) {
  if (!datasetTables.has(site)) {
    let d = null;
    try { d = content.freshDataset(site); datasetTables.set(site, d.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name)); }
    finally { if (d) try { d.close(); } catch {} }
  }
  return datasetTables.get(site);
}
/** Runs SQL on a fresh SQLite copy, optionally keeping only some rows of some tables first. */
function runSqlite(site, sql, keep) {
  let d = null;
  try {
    d = content.freshDataset(site);
    for (const k of keep || []) d.exec(`DELETE FROM "${k.table}" WHERE rowid NOT IN (SELECT rowid FROM "${k.table}" WHERE (${k.where}))`);
    let last = null;
    for (const s of splitSql(String(sql || "")).filter((x) => x.trim())) {
      const st = d.prepare(s);
      if (st.columns().length) {
        st.setReturnArrays(true);
        const cols = st.columns().map((c) => c.name), rows = [];
        for (const row of st.iterate()) { rows.push(row); if (rows.length > 50) break; }
        if (cols.some((n) => /^sqlite_fail\(/i.test(n))) throw new Error("not supported by SQLite");
        last = { columns: cols, rows };
      } else st.run();
    }
    return { ok: true, result: last };
  } catch (e) { return { ok: false, error: e.message }; } finally { if (d) try { d.close(); } catch {} }
}
const runSqliteSafe = (site, sql) => { try { return runSqlite(site, sql); } catch (e) { return { ok: false, error: e.message }; } };
/** Builds and checks one item. Returns { ok, data, checks } or { ok: false, why }. */
function checkPredictInputs(site, p, emptyOk) {
  const inputs = Array.isArray(p.inputs) ? p.inputs.filter((i) => i && i.table && i.where) : [];
  if (!inputs.length || inputs.length > 3) return { ok: false, why: "inputs must list 1-3 tables with a WHERE condition each" };
  const known = tablesOf(site), lower = known.map((t) => t.toLowerCase());
  for (const i of inputs) if (!lower.includes(String(i.table).toLowerCase())) return { ok: false, why: `"${i.table}" is not a table of the dataset` };
  const shows = [];
  for (const i of inputs) {
    const r = runSqlite(site, `SELECT * FROM "${i.table}" WHERE (${i.where})`);
    if (!r.ok) return { ok: false, why: `input ${i.table}: ${r.error}` };
    if (!r.result.rows.length || r.result.rows.length > 8) return { ok: false, why: `input ${i.table} picks ${r.result.rows.length} rows (needs 1-8)` };
    shows.push({ table: i.table, where: i.where, columns: r.result.columns, rows: r.result.rows });
  }
  // every dataset table the query names must be shown
  const sqlText = String(p.sql || "").replace(/'[^']*'/g, "''");
  const used = known.filter((t) => new RegExp("\\b" + t.replace(/[^\w]/g, "") + "\\b", "i").test(sqlText));
  const missing = used.filter((t) => !inputs.some((i) => String(i.table).toLowerCase() === t.toLowerCase()));
  if (missing.length) return { ok: false, why: "the query reads " + missing.join(", ") + " but its rows aren't shown" };
  const full = runSqlite(site, p.sql);
  if (!full.ok || !full.result) return { ok: false, why: "sql: " + (full.ok ? "no result (the last statement must be a SELECT)" : full.error) };
  if ((!full.result.rows.length && !emptyOk) || full.result.rows.length > 6) return { ok: false, why: `sql returns ${full.result.rows.length} rows (needs 1-6)` };
  const reduced = runSqlite(site, p.sql, inputs);
  if (!reduced.ok || !reduced.result) return { ok: false, why: "on the shown rows only, the sql fails: " + (reduced.error || "no result") };
  const ordered = /\border\s+by\b/i.test(p.sql);
  if (full.result.columns.length !== reduced.result.columns.length || !SqlCompare.compare(full.result, reduced.result, ordered).ok)
    return { ok: false, why: "the result on the shown rows only differs from the real result: the query reads rows that aren't shown (full: " + JSON.stringify(full.result.rows).slice(0, 160) + "; shown rows only: " + JSON.stringify(reduced.result.rows).slice(0, 160) + ")" };
  const options = [full.result];
  for (const m of (p.mistakes || []).slice(0, 5)) {
    const r = runSqlite(site, m);
    if (r.ok && r.result && r.result.rows.length <= 8 && !options.some((o) => o.columns.length === r.result.columns.length && sameRowsAs(o, r.result, sortsRows(p.sql)))) options.push(r.result);
  }
  const distractors = options.slice(1, 4);
  const data = { question: p.question || "What does this query return?", shows, show: shows[0], show_sql: shows.map((s) => `SELECT * FROM ${s.table} WHERE ${s.where};`).join("\n"), sql: p.sql, answer: full.result, distractors, engine: "SQLite" };
  const checks = [
    { ok: true, label: "Input rows and the answer are the real output on SQLite" },
    { ok: true, label: "Answerable from the rows shown", detail: "checked: the query returns the same result when its tables hold only the rows shown" },
    { ok: distractors.length >= 1, warn: true, label: "Wrong choices from real mistaken queries", detail: distractors.length + " distinct" + (distractors.length ? "" : ": typed answer only") },
  ];
  return { ok: true, data, checks };
}
/** Asks for an item (a fix of `seed`, or a new one) until it passes the checks: up to 3 attempts. */
// the reviewer (a different provider from the generator) reads the finished item: clear, on the concept, answer not given away
const SYSTEM_PO_CHECKED_REVIEW = `You review one "predict the output" item for a SQL course. It is already checked that the answer is the real output and can be worked out from the rows shown. Check only: the question is clear and does not reveal or hint at the result, and the item teaches the named concept.
Reply with ONLY one JSON object: {"ok": true} or {"ok": false, "why": "short reason"}`;
async function reviewChecked(c, r) {
  let v = null, err = null;
  try { v = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_PO_CHECKED_REVIEW, `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify({ question: r.data.question, input: r.data.shows.map((s) => ({ table: s.table, rows: s.rows.length })), sql: r.data.sql, result: r.data.answer }), 1500)).text); }
  catch (e) { err = e.message; }
  const who = { deepseek: "DeepSeek", openai: "OpenAI", claude: "Claude" }[cc.MODELS.b.provider] || cc.MODELS.b.provider;
  r.checks.push(v && typeof v.ok === "boolean"
    ? { ok: v.ok, warn: true, label: "Second provider (" + who + "): clear and on the concept", detail: v.ok ? "" : String(v.why || "").slice(0, 200) }
    : { ok: false, warn: true, label: "Manual review: no second-provider review", detail: err ? "the reviewer (" + who + ") failed: " + err.slice(0, 160) : "the reviewer's answer couldn't be read" });
  return r;
}
async function verifiedPredict(c, site, seed, { typedOk = false, requireContrast = false } = {}) {
  const emptyOk = /not-exists|not-in|except|anti/.test(c.slug);
  let feedback = seed ? "Fix this item so it passes the rules. Its problems: " + seed.problems.join("; ") + "\nITEM: " + JSON.stringify(seed.item) : "Write a new item.";
  let typedCandidate = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (process.env.SG_DEBUG && attempt) console.warn("[po why]", c.slug, feedback.split("\nLAST ATTEMPT")[0].slice(0, 260));
    let p = null;
    // an API failure (no credit, network) stops the run: it must never count as "can't be fixed" and delete an item
    let reply;
    try { reply = await cc.ask(cc.MODELS.a, SYSTEM_PO_INPUT, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\nDATASET (${site}):\n${content.schemaText(site)}\nREAL ROWS (first rows of each table):\n${sampleRows(site)}\n\n${feedback}`, 3000); } catch (e) { throw Object.assign(new Error("AI call failed: " + e.message), { api: true }); }
    try { p = cc.jsonOf(reply.text); } catch { p = null; }
    if (!p || !p.sql) { feedback += "\nThe last reply wasn't one valid JSON object."; continue; }
    const r = checkPredictInputs(site, p, emptyOk);
    if (!r.ok) { if (process.env.SG_DEBUG) console.warn("[po attempt]", c.slug, attempt); feedback = "Your last attempt failed: " + r.why + "\nLAST ATTEMPT: " + JSON.stringify(p); continue; }
    // the concept changes the result: the same query without it gives something else on these rows
    const plain = p.plain_sql ? runSqliteSafe(site, p.plain_sql) : { ok: false, error: "no plain_sql" };
    const differs = plain.ok && plain.result && !(plain.result.columns.length === r.data.answer.columns.length && sameRowsAs(plain.result, r.data.answer, sortsRows(p.sql)));
    // required only when the item was rejected for not exercising its concept; for concepts that can't change rows
    // (SELECT basics, aliases ...) a differing plain query is simply one more wrong choice
    if (!differs && requireContrast) { if (process.env.SG_DEBUG) console.warn("[po attempt]", c.slug, attempt); feedback = "Your last attempt failed: the concept doesn't change the result on these rows (" + (plain.ok ? "plain_sql returns the same rows" : "plain_sql: " + (plain.error || "no result")) + "). Pick input rows where the concept matters.\nLAST ATTEMPT: " + JSON.stringify(p); continue; }
    if (differs) r.checks.push({ ok: true, label: "The concept changes the result", detail: "the same query without it returns something else on these rows" });
    if (differs && !r.data.distractors.some((x) => sameRowsAs(x, plain.result, sortsRows(p.sql)) && x.columns.length === plain.result.columns.length)) r.data.distractors = [plain.result].concat(r.data.distractors).slice(0, 3);
    r.checks = r.checks.map((x) => (/Wrong choices/.test(x.label) ? { ...x, ok: r.data.distractors.length >= 1, detail: r.data.distractors.length + " distinct" } : x));
    await reviewChecked(c, r);
    const objection = r.checks.find((x) => !x.ok && /Second provider|Manual review/.test(x.label));
    if (objection) { if (process.env.SG_DEBUG) console.warn("[po attempt]", c.slug, attempt); feedback = "Your last attempt failed the review by a second model: " + (objection.detail || objection.label) + "\nLAST ATTEMPT: " + JSON.stringify(p); continue; }
    if (r.data.distractors.length) return r;
    if (!typedCandidate) typedCandidate = r;
    if (process.env.SG_DEBUG) console.warn("[po attempt]", c.slug, attempt); feedback = "Your last attempt has no wrong choices: write mistakes that really change the result.\nLAST ATTEMPT: " + JSON.stringify(p);
  }
  if (typedCandidate && typedOk) {
    // no real mistaken query gives a distinct result: a typed-answer item, accepted as it is
    typedCandidate.checks = typedCandidate.checks.map((x) => (/Wrong choices/.test(x.label) ? { ok: true, label: "Typed answer (no real mistaken query gives a different result)", detail: "" } : x));
    return typedCandidate;
  }
  return typedCandidate;
}
/** The predict drafts with warnings: rebuilt with checked input rows, or deleted when that fails. */
async function fixPredictInputs({ onProgress = () => {} } = {}) {
  // items already built the checked-input way only lack wrong choices: they aren't redone
  const rows = db.prepare("SELECT * FROM stage_items WHERE kind = 'predict' AND status = 'draft' AND json_extract(verify, '$.status') = 'warn'").all().filter((r) => !JSON.parse(r.verify).checks.some((x) => x.ok && /Answerable from the rows shown/.test(x.label)));
  const res = { fixed: 0, typedOnly: 0, deleted: 0, total: rows.length, deletedItems: [] };
  let next = 0, done = 0;
  const concepts = conceptRows();
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++], d = JSON.parse(row.data), v = JSON.parse(row.verify), c = concepts.get(row.concept);
      const site = d.engine === "MySQL" ? siteFor(c) : d.site;
      const problems = v.checks.filter((x) => !x.ok).map((x) => x.label + (x.detail ? ": " + x.detail : ""));
      const r = c ? await verifiedPredict(c, site, { problems, item: { question: d.question, show_sql: d.show_sql, sql: d.sql } }) : null;
      if (r) {
        const verify = { status: r.checks.some((x) => !x.ok) ? "warn" : "pass", checks: r.checks, at: now(), repaired: true, rewritten: { by: genLabel(), what: "input rows, query and wrong choices (checked-input repair)", before: { question: d.question, show_sql: d.show_sql, sql: d.sql }, at: now() } };
        db.prepare("UPDATE stage_items SET data = ?, verify = ?, updated_at = ? WHERE id = ? AND status = 'draft'").run(JSON.stringify({ ...r.data, concept: row.concept, site }), JSON.stringify(verify), now(), row.id);
        if (verify.status === "pass") res.fixed++; else res.typedOnly++;
      } else {
        db.prepare("DELETE FROM stage_items WHERE id = ? AND status = 'draft'").run(row.id);
        res.deleted++; res.deletedItems.push(row.concept);
      }
      done++;
      if (done % 10 === 0 || done === rows.length) onProgress(`${done}/${rows.length} · ${JSON.stringify({ fixed: res.fixed, typedOnly: res.typedOnly, deleted: res.deleted })} · $${cc.cost().toFixed(2)}`);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { ...res, cost: cc.cost() };
}
/** One predict item seeded from a task taken from a screenshot: repaired until it passes every check, then saved. */
async function seededPredict(c, site, seed, batch) {
  const r = await verifiedPredict(c, site, { problems: ["it was taken from a screenshot: rewrite it for the DATASET above (its tables and columns only), keep its idea, and fill in inputs, plain_sql and mistakes. Never copy a website, book or author name"], item: seed });
  if (!r) { stats.predict.dropped++; return null; }
  stats.predict.made++;
  return saveStage("predict", c, { ...r.data, concept: c.slug, site }, r.checks, batch);
}
/** New predict items for a concept, made the checked-input way. */
async function checkedPredictsFor(c, batch, keepMax, opts = {}) {
  const site = siteFor(c);
  let made = 0;
  while (db.prepare("SELECT COUNT(*) n FROM stage_items WHERE kind = 'predict' AND concept = ? AND status != 'rejected'").get(c.slug).n < keepMax && made < keepMax) {
    const r = await verifiedPredict(c, site, null, opts);
    made++;
    if (!r) { stats.predict.dropped++; continue; }
    saveStage("predict", c, { ...r.data, concept: c.slug, site }, r.checks, batch);
    stats.predict.made++;
  }
  return made;
}

// ---------- predict the end state (data / structure concepts) ----------
// A short self-contained script (it creates its own tables) runs on a scratch copy: a MySQL scratch schema, or a
// PostgreSQL schema inside a transaction that is always rolled back. The learner predicts either the final contents
// of a table (mode "table": the check query's result) or which statement fails and how (mode "error"). Answer and
// wrong choices come from real runs; the same script without the concept must end differently; the script must
// give the same outcome twice; a second provider reviews.
const ENGINE_NAME = { MySQL: "MySQL 8", PostgreSQL: "PostgreSQL" };
const SYSTEM_ENDSTATE = `You write one "predict the end state" item for a SQL concept about changing data or structure (MySQL 8).
The learner sees a short script and predicts what it leaves behind.
Reply with ONLY one JSON object:
{"question": "...", "mode": "table" | "error", "script": "2-5 statements separated by semicolons", "check_sql": "one SELECT that shows the final contents (mode table only)", "plain": EDIT, "mistakes": [EDIT, EDIT, ...2-4]}
EDIT = {"statement": N, "sql": "statement N of YOUR script rewritten"} (one statement replaced, nothing added or removed, so the statement numbers stay the same), or {"check_sql": "another check query"} when the concept is in the check query itself.
Rules:
- The script is self-contained: it starts by creating every table it uses (CREATE TABLE with a few columns; every table and function name starts with es_, e.g. es_products, because the scratch copy already holds tables such as products or orders), inserts a few rows, then uses the concept (UPDATE / DELETE / TRUNCATE / DROP / constraints / defaults / AUTO_INCREMENT / a view WITH CHECK OPTION / an index / a function ...). Do not use any other table. Keep it to 2-5 statements after the CREATE TABLEs (at most 8 statements in all). Deterministic: no NOW(), RAND() order, or anything that changes between runs.
- mode "table": check_sql is one SELECT over the script's tables, with ORDER BY, returning 1-6 rows: the learner predicts its result. mode "error": one statement of the script fails with an error (constraint, CHECK OPTION, duplicate key, NOT NULL, missing table ...): the learner predicts which statement fails and why. Pick the mode that shows the concept best.
- In mode "error" the question asks what happens when the script runs (e.g. "What happens when this script runs?"), never which rows remain.
- "plain": the one edit that removes the concept (drop the constraint from the CREATE TABLE, DELETE instead of TRUNCATE, no CHECK OPTION, no DEFAULT ...). Its outcome (final rows or error) must be different.
- "mistakes": edits of the same script that a learner with a typical misunderstanding would expect to be equivalent; each must end differently (other final rows, another failing statement, or no error). Use only the values, tables and columns already in the script: a wrong choice may not mention anything the learner can't see.
- The question must not reveal the answer. Do not use DELIMITER (functions: write a single-statement RETURN body).`;
const SYSTEM_ENDSTATE_REVIEW = `You review one "predict the end state" item for a SQL course: a script, and its real outcome on MySQL 8 (final table contents, or the statement that fails and its error). Check only: the question is clear, fits the kind of answer (an error item asks what happens, not which rows remain) and does not reveal the result, and the item exercises the named concept (the concept changes the outcome). Reply with ONLY one JSON object: {"ok": true} or {"ok": false, "why": "short reason"}`;
const forEngine = (text, engine) => text.replace(/MySQL 8/g, ENGINE_NAME[engine] || "MySQL 8");
const createdTables = (script) => [...String(script).matchAll(/create\s+(?:temporary\s+)?table\s+(?:if\s+not\s+exists\s+)?[`"]?(\w+)[`"]?/gi)].map((m) => m[1].toLowerCase());
const statementsOf = (sql) => splitSql(String(sql || "")).map((s) => s.trim()).filter(Boolean);
// PostgreSQL: only table / view / index DDL and DML; the run happens in a throwaway schema inside a transaction
// that is rolled back, so nothing is left behind
const PG_ALLOWED = /^\s*(create\s+(?:(?:temporary|temp)\s+)?(?:table|view|(?:unique\s+)?index)|create\s+or\s+replace\s+view|insert|update|delete|select|with|truncate|drop\s+(?:table|view|index)|alter\s+table|values)\b/i;
const PG_FORBIDDEN = /\bpg_\w+\s*\(|\bcopy\b|\bdblink\b|\blo_\w+\s*\(|\bset\s+(?:role|session)\b|\bsecurity\s+definer\b/i;
async function runPg(sql) {
  const stmts = statementsOf(sql);
  const bad = stmts.find((s) => !PG_ALLOWED.test(s) || writecheck.FORBIDDEN.test(s) || PG_FORBIDDEN.test(s));
  if (bad) return { ok: false, setupFailed: true, error: "statement not allowed here: " + bad.slice(0, 80) };
  const { Client } = require("pg");
  const c = new Client({ host: process.env.POSTGRES_HOST || "127.0.0.1", port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER || "postgres", password: process.env.POSTGRES_PASSWORD, database: "sql_course" });
  await c.connect();
  const schema = "es_" + crypto.randomBytes(5).toString("hex");
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL statement_timeout = '5s'");
    await c.query(`CREATE SCHEMA ${schema}`);
    await c.query(`SET LOCAL search_path TO ${schema}`);
    let last = null;
    for (let i = 0; i < stmts.length; i++) {
      try {
        const r = await c.query({ text: stmts[i], rowMode: "array" });
        if (r.fields && r.fields.length) last = { columns: r.fields.map((f) => f.name), rows: r.rows.slice(0, 51).map((row) => row.map((v) => (v === null || typeof v !== "object" ? v : String(v)))) };
      } catch (e) { return { ok: false, statement: i + 1, error: "Statement " + (i + 1) + ": " + e.message }; }
    }
    return { ok: true, result: last };
  } finally {
    try { await c.query("ROLLBACK"); } catch { /* the connection is closed next anyway */ }
    await c.end();
  }
}
/** Runs a script (+ the check query) on a scratch copy: { ok, kind: "rows" | "error" | "noerror", rows?, failsAt?, error? }. */
async function endOutcome(site, script, checkSql, mode, engine = "MySQL") {
  const sql = mode === "table" ? String(script).trim().replace(/;?\s*$/, ";\n") + checkSql : script;
  const r = engine === "PostgreSQL" ? await runPg(sql) : await writecheck.runOnDataset(site, sql);
  if (r.ok) {
    if (mode === "table") return r.result ? { ok: true, kind: "rows", rows: { columns: r.result.columns, rows: r.result.rows } } : { ok: false, why: "the check query returned no result" };
    return { ok: true, kind: "noerror", rows: null };
  }
  if (r.setupFailed || !r.statement) return { ok: false, why: "the script couldn't run: " + String(r.error).slice(0, 200) };
  const n = statementsOf(script).length;
  if (mode === "table" && r.statement > n) return { ok: false, why: "the check query failed: " + String(r.error).slice(0, 200) };
  // the scratch copy's internal schema name ('sqlscratch_….users', "es_….users") is not part of what the learner sees
  return { ok: true, kind: "error", failsAt: r.statement, error: String(r.error).replace(/^Statement \d+: /, "").replace(/\b(?:sqlscratch_[a-z0-9_]+|es_[0-9a-f]{10})\./gi, "").slice(0, 200) };
}
const outcomeText = (o) => o.kind === "error" ? "Statement " + o.failsAt + " fails: " + o.error : o.kind === "noerror" ? "No statement fails: the script runs to the end" : JSON.stringify(o.rows);
// error texts compare without quoted names and generated numbers (PostgreSQL names the schema in some messages)
const errKey = (e) => String(e).replace(/'[^']*'|"[^"]*"/g, "").replace(/\d+/g, "#");
const sameOutcome = (a, b) => a.kind === b.kind && (a.kind === "rows" ? a.rows.columns.length === b.rows.columns.length && SqlCompare.compare(a.rows, b.rows, true).ok : a.kind === "error" ? a.failsAt === b.failsAt && errKey(a.error) === errKey(b.error) : true);
const { applyEdit, legacyVariant, ungrounded, SCRATCH_NAME } = require("./endstate-rules.js");
/** Distinct wrong choices: real outcomes of the variants (edits of the shown script) that end differently from the
 *  answer and name only what the shown script shows (at most `max`). `dropped` collects why the others were left out. */
async function wrongChoices(site, engine, mode, real, variants, have = [], max = 3, shown = {}, dropped = []) {
  const distinct = have.slice();
  for (const v of variants) {
    if (distinct.length >= max) break;
    if (!v || !v.script) continue;
    const o = await endOutcome(site, v.script, v.check, mode === "error" ? "error" : "table", engine);
    if (!o.ok || sameOutcome(o, real) || distinct.some((x) => sameOutcome(x, o)) || (o.kind === "rows" && o.rows.rows.length > 8)) continue;
    const why = shown.script ? ungrounded(o, shown.script, shown.check) : null;
    if (why) { dropped.push(why); continue; }
    distinct.push(o);
  }
  return distinct;
}
async function verifiedEndState(c, site, { hint = "", engine = "MySQL" } = {}) {
  let feedback = (hint ? "WHAT TO SHOW: " + hint + "\n" : "") + "Write a new item.";
  const system = forEngine(SYSTEM_ENDSTATE, engine), review = forEngine(SYSTEM_ENDSTATE_REVIEW, engine);
  for (let attempt = 0; attempt < 3; attempt++) {
    let reply;
    try { reply = await cc.ask(cc.MODELS.a, system, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\n\n${feedback}`, 2500); } catch (e) { throw Object.assign(new Error("AI call failed: " + e.message), { api: true }); }
    let p = null;
    try { p = cc.jsonOf(reply.text); } catch { p = null; }
    const fail = (why) => { feedback = (hint ? "WHAT TO SHOW: " + hint + "\n" : "") + "Your last attempt failed: " + why + "\nLAST ATTEMPT: " + JSON.stringify(p); if (process.env.SG_DEBUG) console.warn("[endstate]", c.slug, why.slice(0, 160)); };
    if (!p || !p.script || !["table", "error"].includes(p.mode)) { fail("the reply wasn't one JSON object with script and mode"); continue; }
    const stmts = statementsOf(p.script);
    if (stmts.length < 2 || stmts.length > 8) { fail("the script must have 2-8 statements, it has " + stmts.length); continue; }
    if (/\bdelimiter\b/i.test(p.script)) { fail("don't use DELIMITER"); continue; }
    const made = createdTables(p.script);
    if (!made.length) { fail("the script must create its own tables"); continue; }
    if (p.mode === "table") {
      const used = [...String(p.check_sql || "").matchAll(/\b(?:from|join)\s+[`"]?(\w+)[`"]?/gi)].map((m) => m[1].toLowerCase());
      if (!p.check_sql || !used.length || used.some((t) => !made.includes(t))) { fail("check_sql must read only tables the script creates"); continue; }
    }
    const real = await endOutcome(site, p.script, p.check_sql, p.mode, engine);
    if (!real.ok) { fail(real.why); continue; }
    if (p.mode === "table" && real.kind !== "rows") { fail("in mode table the script must not fail (" + outcomeText(real) + ")"); continue; }
    if (p.mode === "error" && real.kind !== "error") { fail("in mode error one statement must fail, but none did"); continue; }
    if (real.kind === "rows" && (!real.rows.rows.length || real.rows.rows.length > 6)) { fail("check_sql returns " + real.rows.rows.length + " rows (needs 1-6)"); continue; }
    const again = await endOutcome(site, p.script, p.check_sql, p.mode, engine);
    if (!again.ok || !sameOutcome(real, again)) { fail("the outcome changes between runs: it must be deterministic"); continue; }
    const plainV = applyEdit(p, p.plain);
    if (!plainV) { fail("plain must be ONE edit of your script: {\"statement\": N, \"sql\": \"...\"} (or {\"check_sql\": ...} in mode table)"); continue; }
    const plain = await endOutcome(site, plainV.script, plainV.check, p.mode === "error" ? "error" : "table", engine);
    if (!plain.ok || sameOutcome(real, plain)) { fail("the concept doesn't change the outcome: the plain edit " + (plain.ok ? "ends the same way" : "couldn't run")); continue; }
    // wrong choices: the real outcomes of the plain edit and the mistaken edits, each different and grounded in the shown script
    const dropped = [];
    const distinct = await wrongChoices(site, engine, p.mode, real, [plainV].concat((p.mistakes || []).slice(0, 4).map((m) => applyEdit(p, m))), [], 3, { script: p.script, check: p.mode === "table" ? p.check_sql : "" }, dropped);
    if (!distinct.length) { fail("no wrong choice ends differently using only what the script shows" + (dropped.length ? " (" + dropped.slice(0, 2).join("; ") + ")" : "") + ": every mistake must be ONE edit of your script"); continue; }
    const data = { variant: "endstate", mode: p.mode, question: p.question || (p.mode === "error" ? "What happens when this script runs?" : "What does the last query return?"), script: p.script.trim(), check_sql: p.check_sql || null, plain_script: plainV.script, plain_check_sql: plainV.check !== p.check_sql ? plainV.check : undefined, plain_edit: p.plain, answer: real, distractors: distinct, engine };
    const checks = [
      { ok: true, label: "Answer and wrong choices are real outcomes on a " + engine + " scratch copy" },
      { ok: true, label: "Deterministic", detail: "the script gives the same outcome on a second run" },
      { ok: true, label: "The concept changes the outcome", detail: "the same script without it ends differently" },
      { ok: true, warn: true, label: "Wrong choices from real runs", detail: distinct.length + " distinct, each the shown script with one edit" },
      { ok: true, label: "Wrong choices name only what the script shows", detail: "statement numbers, values, tables and columns" },
    ];
    let rv = null, err = null;
    try { rv = cc.jsonOf((await cc.ask(cc.MODELS.b, review, `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify({ question: data.question, script: data.script, check_sql: data.check_sql, outcome: outcomeText(real) }), 1500)).text); } catch (e) { err = e.message; }
    const who = reviewerName();
    if (!rv || typeof rv.ok !== "boolean") { fail("the reviewer (" + who + ") gave no usable answer" + (err ? ": " + err : "")); continue; }
    if (!rv.ok) { fail("a second model objected: " + rv.why); continue; }
    checks.push({ ok: true, warn: true, label: "Second provider (" + who + "): clear and exercises the concept" });
    return { data, checks };
  }
  return null;
}
const reviewerName = () => ({ deepseek: "DeepSeek", openai: "OpenAI", claude: "Claude" }[cc.MODELS.b.provider] || cc.MODELS.b.provider);
/** New "predict the end state" items for a concept, until it has keepMax predict items (drafts included). */
async function endStatePredictsFor(c, batch, keepMax = 2, opts = {}) {
  const site = siteFor(c);
  let tries = 0;
  while (db.prepare("SELECT COUNT(*) n FROM stage_items WHERE kind = 'predict' AND concept = ? AND status != 'rejected'").get(c.slug).n < keepMax && tries < keepMax + 1) {
    tries++;
    const r = await verifiedEndState(c, site, opts);
    if (!r) { stats.predict.dropped++; continue; }
    saveStage("predict", c, { ...r.data, concept: c.slug, site }, r.checks, batch);
    stats.predict.made++;
  }
}
// an edit of a draft end-state item: the version before is kept in verify.repairHistory
function saveEndStateEdit(row, data, checks, note) {
  const v = JSON.parse(row.verify || "{}");
  const history = (v.repairHistory || []).concat([{ at: now(), note, data: JSON.parse(row.data) }]);
  const verify = { ...v, checks: (v.checks || []).concat(checks), repairHistory: history, status: (v.checks || []).concat(checks).some((k) => !k.ok && !k.warn) ? "fail" : v.status };
  db.prepare("UPDATE stage_items SET data = ?, verify = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(data), JSON.stringify(verify), now(), row.id);
}
/** Rewords a draft end-state question (admin request); the second provider reviews the new wording. */
async function rewordEndState(id, question) {
  const row = db.prepare("SELECT * FROM stage_items WHERE id = ?").get(id);
  const d = JSON.parse(row.data), c = cc.allConcepts().find((x) => x.slug === row.concept);
  const rv = cc.jsonOf((await cc.ask(cc.MODELS.b, forEngine(SYSTEM_ENDSTATE_REVIEW, d.engine || "MySQL"), `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify({ question, script: d.script, check_sql: d.mode === "error" ? null : d.check_sql, outcome: outcomeText(d.answer) }), 1500)).text);
  const ok = !!(rv && rv.ok);
  saveEndStateEdit(row, { ...d, question }, [{ ok, warn: !ok, label: "Question reworded to fit the answer (admin request)", detail: ok ? "re-reviewed by " + reviewerName() : reviewerName() + ": " + ((rv && rv.why) || "no usable answer") }], "question reworded");
  return { ok, why: rv && rv.why };
}
/** Wrong choices for a draft end-state item: the generator proposes one-statement edits of the shown script, each is
 *  run for real and must name only what the script shows. replace: rebuild them all (the plain version first). */
async function moreEndStateChoices(id, max = 3, { replace = false } = {}) {
  const row = db.prepare("SELECT * FROM stage_items WHERE id = ?").get(id);
  const d = JSON.parse(row.data), c = cc.allConcepts().find((x) => x.slug === row.concept), engine = d.engine || "MySQL";
  const shown = { script: d.script, check: d.mode === "table" ? d.check_sql : "" };
  const numbered = statementsOf(d.script).map((x, i) => (i + 1) + ": " + x.replace(/\s+/g, " ")).join("\n");
  const ask = `CONCEPT: ${c.name} — ${c.summary}\nSCRIPT (numbered statements):\n${numbered}\n${d.mode === "table" ? "CHECK QUERY: " + d.check_sql + "\n" : ""}REAL OUTCOME: ${outcomeText(d.answer)}\n${replace ? "" : "WRONG CHOICES ALREADY USED: " + d.distractors.map(outcomeText).join(" || ") + "\n"}\n` +
    `Write 4 edits of this script, each changing ONE statement the way a learner with a typical misunderstanding of the concept would expect to behave the same, but which really end differently (another failing statement, another error, no error, or other final rows). Keep the statement count; use only values, tables and columns already in the script; no DELIMITER. Reply with ONLY one JSON object: {"mistakes": [{"statement": N, "sql": "the rewritten statement N"}, ...]}`;
  let p = null;
  try { p = cc.jsonOf((await cc.ask(cc.MODELS.a, forEngine("You write realistic mistaken variants of a short SQL script (MySQL 8) for a multiple-choice item: each changes exactly one statement. The variants are run for real; their outcomes become wrong choices.", engine), ask, 2500)).text); } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw Object.assign(e, { api: true }); }
  const before = d.distractors.length, dropped = [];
  const base = replace ? [] : d.distractors.filter((x) => !ungrounded(x, shown.script, shown.check));
  const plainV = replace ? legacyVariant(d.plain_script, d, d.plain_check_sql) : null;
  const variants = (plainV ? [plainV] : []).concat(((p && p.mistakes) || []).slice(0, 4).map((m) => applyEdit(d, m)));
  const distinct = await wrongChoices(d.site, engine, d.mode, d.answer, variants, base, max, shown, dropped);
  const changed = distinct.length !== before || distinct.some((x, i) => !d.distractors[i] || !sameOutcome(x, d.distractors[i]));
  if (distinct.length && changed) saveEndStateEdit(row, { ...d, distractors: distinct }, [{ ok: true, warn: true, label: replace ? "Wrong choices rebuilt: each the shown script with one edit" : "Wrong choices added from real runs", detail: before + " → " + distinct.length + (dropped.length ? "; left out: " + dropped.slice(0, 3).join("; ") : "") }, { ok: true, label: "Wrong choices name only what the script shows" }], replace ? "wrong choices rebuilt (one-edit rule)" : "wrong choices added");
  return { before, after: distinct.length, saved: !!(distinct.length && changed), dropped: dropped.slice(0, 4) };
}

// ---------- MCQs for a concept's Understand stage (the flashcards + MCQ rule) ----------
const SYSTEM_CONCEPT_MCQ = `You write multiple-choice questions that check UNDERSTANDING of one SQL concept (why and when, what happens), not syntax recall. Every question must be correct, unambiguous and have exactly one right answer.
Rules: four short options; plausible wrong options from real misunderstandings; no "all/none of the above"; the right answer at a random position; name the database (MySQL 8 or PostgreSQL) when behaviour differs. "why" explains in 1-3 sentences why the answer is right and the trap in the wrong ones. Double-check every marked answer.
Reply with ONLY a JSON array: [{"q": "...", "code": "optional SQL shown with the question", "options": ["...","...","...","..."], "answer": 0-3, "why": "..."}]`;
const SYSTEM_MCQ_REVIEW = `You are a strict reviewer of one SQL multiple-choice question. Decide whether the marked answer is correct and the only defensible answer, the question is clear, and it checks understanding of the named concept. Reply with ONLY one JSON object: {"ok": true} or {"ok": false, "why": "short reason"}`;
const verdictOf = (checks) => { const failed = checks.some((k) => !k.ok && !k.warn), warned = checks.some((k) => !k.ok && k.warn); return failed ? "fail" : warned ? "warn" : "pass"; };
/** Draft MCQs tagged to a concept's Understand stage, until it has `want` (live or draft). Failures are deleted. */
async function conceptMcqsFor(c, batch, want = 1, opts = {}) {
  const tagged = () => db.prepare("SELECT t.key FROM item_tags t LEFT JOIN content_items i ON i.id = substr(t.key, 5) WHERE t.kind = 'mcq' AND t.status = 'ok' AND EXISTS (SELECT 1 FROM json_each(t.concepts) WHERE value = ?) AND (i.id IS NULL OR i.status IN ('published', 'draft'))").all(c.slug).length;
  const have = tagged();
  if (have >= want && !opts.seed) return { made: 0, have };
  let list = [];
  try { list = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_CONCEPT_MCQ, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\nWrite ${opts.seed ? opts.n || 1 : 3} question${opts.seed && (opts.n || 1) === 1 ? "" : "s"}.` + (opts.seed ? "\n\nBASE THE QUESTIONS ON THIS TASK, TAKEN FROM A SCREENSHOT (keep its idea, adapt it to the DATASET above; never copy a website, book or author name):\n" + opts.seed : ""), 3000)).text); } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw Object.assign(e, { api: true }); }
  let made = 0;
  for (const m of Array.isArray(list) ? list : []) {
    if (opts.seed ? made >= (opts.n || 1) : have + made >= want + 1) break;
    const saved = content.saveItem({ kind: "mcq", status: "draft", data: { ...m, answer: Number(m.answer), topic: content.LEVEL_TOPIC[c.level], diff: "medium", level: c.level }, source: "ai:stage " + (opts.tag ? opts.tag + " " : "") + cc.MODELS.a.model });
    let rv = null;
    try { rv = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_MCQ_REVIEW, `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify({ question: saved.data.q, code: saved.data.code || undefined, options: saved.data.options, marked_answer: saved.data.options[saved.data.answer], explanation: saved.data.why }), 1500)).text); } catch { rv = null; }
    const checks = saved.verify.checks.concat([{ ok: !!(rv && rv.ok), warn: false, label: "Second provider (" + reviewerName() + "): answer right and only one, about the concept", detail: rv && !rv.ok ? rv.why || "" : "" }]);
    const status = verdictOf(checks);
    if (status === "fail") { db.prepare("DELETE FROM content_items WHERE id = ?").run(saved.id); continue; }
    db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify({ status, checks, at: now(), batch }), saved.id);
    db.prepare("INSERT OR REPLACE INTO item_tags (key, kind, level, concepts, stage, status, source, a, b, why, updated_at) VALUES (?, 'mcq', ?, ?, 'understand', 'ok', 'rule', NULL, NULL, ?, ?)").run("mcq:" + saved.id, c.level, JSON.stringify([c.slug]), "generated for this concept's Understand stage", now());
    made++;
  }
  return { made, have };
}

// ---------- lessons (the optional Study step) ----------
// A short lesson per concept: what it is, when to use it, one example that runs on our dataset (its real result is
// stored), a common mistake. Written in our own words from reference notes when the notes cover the concept;
// checks: the example runs, the text names no source and copies no sentence from the notes, a second provider reviews.
const SYSTEM_LESSON = `You write one short lesson for a SQL course app, for one concept. Reader: a beginner.
Reply with ONLY one JSON object: {"what": "2-4 sentences: what it is", "when": ["2-3 short points: when to use it"], "example_sql": "ONE example on the DATASET", "example_explain": "1-2 sentences: what the example's result shows", "tip": "one common mistake to avoid"}
Rules:
- example_sql runs on the DATASET below as given (its tables and columns only). SQLite syntax; for concepts that change data or structure, MySQL 8: the statements, then a SELECT that shows the effect. It returns at least one row (ideally 2-8; at most 50) and shows the concept clearly. Concepts about users, roles, grants or security: show it with a query the dataset can run (e.g. a parameter-safe query, or the data a view exposes), never CREATE USER / GRANT.
- Plain English, short sentences, no headings or markdown inside strings except \`backticks\` for SQL words.
- Write everything in your own words: never copy a sentence from the REFERENCE NOTES; never name a website, course, book, author, social-media account or link.`;
const SYSTEM_LESSON_REVIEW = `You review a short SQL lesson for beginners: its text, its example query and the example's REAL result. Check: the explanation is correct, the example shows the named concept, the explain sentence matches the real result, and it is clear. Reply with ONLY one JSON object: {"ok": true} or {"ok": false, "why": "short reason"}`;
const { SOURCE_NAME, copiedRun } = require("./lesson-rules.js");
async function lessonFor(c, batch, { notes = "", site: siteOpt, selfContained = false } = {}) {
  const site = siteOpt || siteFor(c);
  const origin = notes ? "source" : "generated";
  let feedback = "Write the lesson.";
  for (let attempt = 0; attempt < 3; attempt++) {
    let reply;
    try { reply = await cc.ask(cc.MODELS.a, SYSTEM_LESSON, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\n` + (selfContained ? "DATASET: none. Create the small es_ tables the example needs.\n" : `DATASET (${site}):\n${content.schemaText(site)}\n`) + (notes ? `REFERENCE NOTES (facts to draw on; rewrite, never copy):\n${notes.slice(0, 3500)}\n` : "") + (selfContained ? "\nSELF-CONTAINED EXAMPLE: example_sql may create its own small table instead of using the DATASET: CREATE TABLE es_<name> (a few columns), INSERT 3-8 rows chosen so the concept is visible (NULLs, duplicates, a row that breaks a rule ...), use the concept, then end with ONE SELECT that shows the result (1-50 rows). Every table it creates is named es_...; no CREATE USER, GRANT or DELIMITER.\n" : "") + "\n" + feedback, 2500); }
    catch (e) { throw Object.assign(new Error("AI call failed: " + e.message), { api: true }); }
    let p = null; try { p = cc.jsonOf(reply.text); } catch { p = null; }
    const fail = (why) => { feedback = "Your last attempt failed: " + why + "\nLAST ATTEMPT: " + JSON.stringify(p); if (process.env.SG_DEBUG) console.warn("[lesson]", c.slug, why.slice(0, 160)); };
    if (!p || !p.what || !p.example_sql || !Array.isArray(p.when)) { fail("the reply wasn't one JSON object with what, when (a list) and example_sql"); continue; }
    const text = [p.what, p.when.join(" "), p.example_explain, p.tip].join(" ");
    if (SOURCE_NAME.test(text + " " + p.example_sql)) { fail("it names a source, account or link: leave those out"); continue; }
    const copied = notes && copiedRun(text, notes);
    if (copied) { fail("it copies the notes word for word (\"" + copied + "\"): write it in your own words"); continue; }
    const made = createdTables(p.example_sql);
    if (made.some((t) => !/^es_/.test(t))) { fail("every table the example creates must be named es_... (" + made.join(", ") + ")"); continue; }
    if (selfContained) {
      // it must not read the dataset's tables (the learner wouldn't see their rows): comments and strings don't count
      const code = p.example_sql.replace(/--[^\n]*/g, " ").replace(/'(?:[^']|'')*'/g, "''");
      const dataTables = new Set([...content.schemaText(site).matchAll(/^TABLE (\w+)/gm)].map((m) => m[1].toLowerCase()));
      const read = [...code.matchAll(/\b(?:from|join|into|update)\s+`?(\w+)`?/gi)].map((m) => m[1].toLowerCase()).filter((t) => dataTables.has(t));
      if (!made.length || read.length) { fail(!made.length ? "the example must create its own es_ table(s)" : "the example must use only the es_ tables it creates, not " + [...new Set(read)].join(", ")); continue; }
    }
    const run = await runScript(site, p.example_sql);
    if (!run.ok) { fail("the example doesn't run: " + String(run.error).slice(0, 200)); continue; }
    if (!run.result || !run.result.rows.length || run.result.rows.length > 50) { fail("the example must end with a SELECT returning 1-50 rows (it returned " + (run.result ? run.result.rows.length : 0) + ")" + (selfContained ? ": insert rows so that the final SELECT returns some (for an anti-join or a NULL check, include rows that match)" : "")); continue; }
    // the first 10 rows are shown, with the total
    const example = { sql: p.example_sql.trim(), engine: run.engine, columns: run.result.columns, rows: run.result.rows.slice(0, 10), total: run.result.rows.length, selfContained: made.length > 0 || undefined };
    let rv = null;
    try { rv = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_LESSON_REVIEW, `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify({ what: p.what, when: p.when, example_sql: example.sql, real_result: { columns: example.columns, rows: example.rows }, example_explain: p.example_explain, tip: p.tip }), 1500)).text); } catch { rv = null; }
    if (!rv || typeof rv.ok !== "boolean") { fail("the reviewer gave no usable answer"); continue; }
    if (!rv.ok) { fail("a second model objected: " + rv.why); continue; }
    const data = { title: c.name, what: String(p.what).trim(), when: p.when.slice(0, 4).map((x) => String(x).trim()), example, explain: String(p.example_explain || "").trim(), tip: String(p.tip || "").trim(), origin, concept: c.slug, site };
    const checks = [
      { ok: true, label: "The example runs on " + run.engine + " (" + example.total + (example.total === 1 ? " row" : " rows") + "); the result shown is the real one" },
      { ok: true, label: "Names no source, account or link" },
      ...(example.selfContained ? [{ ok: true, warn: true, label: "Self-contained example: it creates its own small table (" + made.join(", ") + ")" }] : []),
      { ok: true, label: notes ? "Written from reference notes, in its own words (no 10-word run copied)" : "Not covered by the reference notes: written in the same style" },
      { ok: true, warn: true, label: "Second provider (" + reviewerName() + "): correct, clear, example matches the concept" },
    ];
    return saveStage("lesson", c, data, checks, batch);
  }
  return null;
}

// Three more example formats for lessons whose point a single SELECT can't show:
//   "error"       a short script whose failing statement IS the point: the real error (MySQL scratch schema) is shown
//   "beforeafter" the wrong query's result next to the fixed query's result, both real runs; "twice" (a rerunnable
//                 pipeline): the result after one run and after running it again must be the same
//   "notrun"      an illustrative snippet, labelled "Not run here" with the reason; no output at all
const LESSON_FORMAT = {
  error: `EXAMPLE FORMAT "script with error": example_sql is a short self-contained script (CREATE TABLE es_..., INSERT rows, ...) in which ONE statement fails because of the concept (a constraint, a dropped table, ...); that failure is the point. Put the failing statement last or near the end. MySQL 8. Also give "failing_statement": its 1-based number. example_explain says why it fails.`,
  beforeafter: `EXAMPLE FORMAT "before / after": give "setup_sql" (CREATE TABLE es_... + INSERT rows that show the problem), "wrong_sql" (ONE SELECT with the typical mistake) and "fixed_sql" (ONE SELECT that fixes it), instead of example_sql. Both SELECTs read only the es_ tables; their results must differ. example_explain says what changed and why.`,
  twice: `EXAMPLE FORMAT "run it twice": give "setup_sql" (CREATE TABLE es_... + INSERT rows), "pipeline_sql" (the rerunnable load / transformation: statements that can safely run again, e.g. delete-then-insert or INSERT ... ON DUPLICATE KEY UPDATE / upsert), and "check_sql" (ONE SELECT showing the target table), instead of example_sql. MySQL 8. Running pipeline_sql once or twice must leave the same result. example_explain says why it is safe to rerun.`,
  notrun: `EXAMPLE FORMAT "not run here": the concept needs two sessions or admin rights, so the example can't be run in this app. Give "example_sql": a short, correct illustrative snippet (comments may mark "-- session A" / "-- session B"), and "not_run_reason": "needs two sessions" or "needs admin rights". Do NOT invent any output or result anywhere.`,
};
async function lessonInFormat(c, batch, format) {
  const site = siteFor(c);
  let feedback = "Write the lesson.";
  for (let attempt = 0; attempt < 3; attempt++) {
    let reply;
    // each format states its exact reply shape and engine (the base prompt says SQLite; these run on MySQL)
    const SHAPE = {
      error: '{"what": "...", "when": ["..."], "example_sql": "the script", "failing_statement": 3, "example_explain": "...", "tip": "..."}',
      beforeafter: '{"what": "...", "when": ["..."], "setup_sql": "CREATE TABLE es_...; INSERT ...", "wrong_sql": "SELECT ...", "fixed_sql": "SELECT ...", "example_explain": "...", "tip": "..."}',
      twice: '{"what": "...", "when": ["..."], "setup_sql": "CREATE TABLE es_...; INSERT ...", "pipeline_sql": "the statements", "check_sql": "SELECT ...", "example_explain": "...", "tip": "..."}',
      notrun: '{"what": "...", "when": ["..."], "example_sql": "the snippet", "not_run_reason": "needs two sessions" or "needs admin rights", "example_explain": "...", "tip": "..."}',
    }[format];
    const engineRule = format === "notrun" ? "The snippet is MySQL 8 syntax (not SQLite: no sqlite_master or PRAGMA)." : "Everything runs on MySQL 8 (not SQLite: no sqlite_master, no PRAGMA); a UNIQUE or PRIMARY KEY column is VARCHAR or INT, never TEXT.";
    try { reply = await cc.ask(cc.MODELS.a, SYSTEM_LESSON + "\n" + LESSON_FORMAT[format] + "\n" + engineRule + "\nREPLY SHAPE for this format (use exactly these keys): " + SHAPE, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\nDATASET: none. Create the small es_ tables the example needs.\n\n${feedback}`, 2500); }
    catch (e) { throw Object.assign(new Error("AI call failed: " + e.message), { api: true }); }
    let p = null; try { p = cc.jsonOf(reply.text); } catch { p = null; }
    const fail = (why) => { feedback = "Your last attempt failed: " + why + "\nLAST ATTEMPT: " + JSON.stringify(p); if (process.env.SG_DEBUG) console.warn("[lesson " + format + "]", c.slug, why.slice(0, 160)); };
    if (!p || !p.what || !Array.isArray(p.when)) { fail("the reply wasn't one JSON object with what and when (a list)"); continue; }
    const allSql = [p.example_sql, p.setup_sql, p.wrong_sql, p.fixed_sql, p.pipeline_sql, p.check_sql].filter(Boolean).join("\n");
    const text = [p.what, p.when.join(" "), p.example_explain, p.tip].join(" ");
    if (SOURCE_NAME.test(text + " " + allSql)) { fail("it names a source, account or link: leave those out"); continue; }
    const made = createdTables(allSql);
    if (format !== "notrun" && (!made.length || made.some((t) => !/^es_/.test(t)))) { fail("the example must create its own tables, all named es_..."); continue; }
    let example, runLabel;
    if (format === "error") {
      if (!p.example_sql) { fail("example_sql is missing"); continue; }
      const o = await endOutcome(site, p.example_sql, null, "error", "MySQL");
      if (!o.ok || o.kind !== "error") { fail(o.ok ? "no statement failed: one statement must fail because of the concept" : o.why); continue; }
      if (/error in your SQL syntax|syntax error/i.test(o.error)) { fail("the statement fails with a syntax error; it must fail because of the concept: " + o.error); continue; }
      const again = await endOutcome(site, p.example_sql, null, "error", "MySQL");
      if (!again.ok || again.failsAt !== o.failsAt) { fail("the failure isn't the same on a second run"); continue; }
      example = { format, sql: p.example_sql.trim(), engine: "MySQL", error: { failsAt: o.failsAt, message: o.error } };
      runLabel = "The script runs on a MySQL scratch schema: statement " + o.failsAt + " fails with the real error shown (" + o.error.slice(0, 80) + ")";
    } else if (format === "beforeafter" || format === "twice") {
      const runs = format === "twice"
        ? [["After one run", p.setup_sql + ";\n" + p.pipeline_sql + ";\n" + p.check_sql], ["After running it again", p.setup_sql + ";\n" + p.pipeline_sql + ";\n" + p.pipeline_sql + ";\n" + p.check_sql]]
        : [["The mistake", p.setup_sql + ";\n" + p.wrong_sql], ["Fixed", p.setup_sql + ";\n" + p.fixed_sql]];
      if (!p.setup_sql || (format === "twice" ? !p.pipeline_sql || !p.check_sql : !p.wrong_sql || !p.fixed_sql)) { fail("setup_sql and " + (format === "twice" ? "pipeline_sql + check_sql" : "wrong_sql + fixed_sql") + " are required"); continue; }
      const res = [];
      for (const [label, sql] of runs) {
        const r = format === "twice" ? await writecheck.runOnDataset(site, sql.replace(/;\s*;/g, ";")) : await runScript(site, sql.replace(/;\s*;/g, ";"));
        const result = r.ok && r.result ? { columns: r.result.columns, rows: r.result.rows.slice(0, 10), total: r.result.rows.length } : null;
        if (!r.ok || !result || !result.total) { res.push(null); fail(label + ": " + (r.ok ? "the last SELECT returned no rows" : "it doesn't run: " + String(r.error).slice(0, 160))); break; }
        res.push({ label, result, engine: r.engine || "MySQL" });
      }
      if (res.length < 2 || res.includes(null)) continue;
      const same = sameRowsAs(res[0].result, res[1].result, true);
      if (format === "beforeafter" && same) { fail("the wrong and the fixed query return the same result: the rows must show the mistake"); continue; }
      if (format === "twice" && !same) { fail("running the pipeline twice changes the result: it isn't safe to rerun"); continue; }
      example = format === "twice"
        ? { format, setup: p.setup_sql.trim(), sql: p.pipeline_sql.trim(), check: p.check_sql.trim(), engine: "MySQL", before: { label: res[0].label, ...res[0].result }, after: { label: res[1].label, ...res[1].result } }
        : { format, setup: p.setup_sql.trim(), engine: res[0].engine, before: { label: res[0].label, sql: p.wrong_sql.trim(), ...res[0].result }, after: { label: res[1].label, sql: p.fixed_sql.trim(), ...res[1].result } };
      runLabel = format === "twice" ? "Real runs on a MySQL scratch schema: the result after one run and after a second run are the same" : "Both queries really run (" + res[0].engine + "); their real results differ as the lesson says";
    } else {
      if (!p.example_sql) { fail("example_sql is missing"); continue; }
      if (/\b(result|output)s?\s*:|^\s*\|.*\|\s*$/im.test(p.example_sql + "\n" + (p.example_explain || ""))) { fail("no output or result may be shown or claimed: the example isn't run"); continue; }
      const reason = /admin/i.test(p.not_run_reason || "") ? "needs admin rights" : "needs two sessions";
      example = { format, sql: p.example_sql.trim(), notRun: reason };
      runLabel = "Illustrative only, labelled \"Not run here (" + reason + ")\": no output is shown";
    }
    let rv = null;
    try { rv = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_LESSON_REVIEW + " For an example marked not_run, check only that the snippet is correct SQL that illustrates the concept and that no output is claimed.", `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify({ what: p.what, when: p.when, example, example_explain: p.example_explain, tip: p.tip }), 1500)).text); } catch { rv = null; }
    if (!rv || typeof rv.ok !== "boolean") { fail("the reviewer gave no usable answer"); continue; }
    if (!rv.ok) { fail("a second model objected: " + rv.why); continue; }
    const data = { title: c.name, what: String(p.what).trim(), when: p.when.slice(0, 4).map((x) => String(x).trim()), example, explain: String(p.example_explain || "").trim(), tip: String(p.tip || "").trim(), origin: "generated", concept: c.slug, site };
    return saveStage("lesson", c, data, [
      { ok: true, label: runLabel },
      { ok: true, label: "Names no source, account or link" },
      { ok: true, label: "Not covered by the reference notes: written in the same style" },
      { ok: true, warn: true, label: "Second provider (" + reviewerName() + "): correct, clear, example matches the concept" },
    ], batch);
  }
  return null;
}

// ---------- the extra card types (kind "card": optional practice) and the upgrades ----------
// Join mapper and Compare two queries carry small self-contained tables; every result shown is a real run on an
// in-memory SQLite copy of them. Upgrades enrich an existing item once approved: a syntax-builder card's accepted
// alternatives (each must give the same real result as the answer) and explanation, an MCQ's why-wrong per option.
const { datasetSql: tablesSql } = require("./image-rules.js");
const Cards = require("../public/cards.js");
function runTables(tables, sql) {
  const { DatabaseSync } = require("node:sqlite");
  const m = new DatabaseSync(":memory:");
  try {
    m.exec(tablesSql(tables).sql);
    const st = m.prepare(sql); st.setReturnArrays(true);
    const rows = st.all().slice(0, 51);
    return { ok: true, columns: st.columns().map((c) => c.name), rows };
  } catch (e) { return { ok: false, error: e.message }; } finally { m.close(); }
}
const cleanTable = (t) => t && { name: String(t.name || "").toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30), columns: (t.columns || []).map((c) => String(c).toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 30)), rows: (t.rows || []).filter((r) => Array.isArray(r) && r.length === (t.columns || []).length).slice(0, 8) };
const cardMeta = (c, type, rules) => ({ card_type: type, learning_objective: c.summary, dialect: "neutral", validation_rules: rules, version: 1, concept: c.slug });
async function reviewCard(c, payload, ask) {
  let rv = null;
  try { rv = cc.jsonOf((await cc.ask(cc.MODELS.b, `You review one practice card for a SQL course. ${ask} Reply with ONLY one JSON object: {"ok": true} or {"ok": false, "why": "short reason"}`, `CONCEPT: ${c.name} — ${c.summary}\n` + JSON.stringify(payload), 1500)).text); } catch { rv = null; }
  return rv && typeof rv.ok === "boolean" ? rv : { ok: false, why: "the reviewer gave no usable answer" };
}
const SYSTEM_JOIN_MAPPER = `You write one "join mapper" card for a SQL course: the learner sees two small tables, picks the key columns that link them and the join type, then sees the real result.
Reply with ONLY one JSON object: {"question": "...", "left": {"name": "...", "columns": ["..."], "rows": [[...]]}, "right": {...}, "key": {"left": "left_table.column", "right": "right_table.column"}, "join_type": "INNER" | "LEFT" | "RIGHT" | "FULL", "why": "1-2 sentences: why this key and this join type"}
Rules: 3-6 rows per table, 2-4 columns each; include unmatched rows on BOTH sides so the join type changes the result; the question says what result is wanted (e.g. "every student, with their result if they have one") without naming the join type or the key; plain values (numbers, short text, NULL as null). Lowercase table and column names.`;
const joinMapperSpec = (c) => ({
  type: "join_mapper", rules: { key: "exact pair (either order)", join_type: "exact" }, system: SYSTEM_JOIN_MAPPER,
  verify: async (p) => {
    const L = cleanTable(p && p.left), Rt = cleanTable(p && p.right);
    if (!L || !Rt || L.rows.length < 3 || Rt.rows.length < 3 || L.name === Rt.name) return { fail: "two differently named tables with 3-6 rows each are needed" };
    const jt = String(p.join_type || "").toUpperCase();
    const k = { left: String((p.key || {}).left || "").toLowerCase(), right: String((p.key || {}).right || "").toLowerCase() };
    const okCol = (ref, t) => ref.split(".")[0] === t.name && t.columns.includes(ref.split(".")[1]);
    if (!["INNER", "LEFT", "RIGHT", "FULL"].includes(jt) || !okCol(k.left, L) || !okCol(k.right, Rt)) return { fail: "key must be left_table.column and right_table.column of the given tables, join_type one of INNER LEFT RIGHT FULL" };
    const sqlFor = (type) => `SELECT * FROM ${L.name} ${type === "INNER" ? "INNER" : type + " OUTER"} JOIN ${Rt.name} ON ${k.left} = ${k.right} ORDER BY 1, 2`;
    const results = {};
    for (const t of ["INNER", "LEFT", "RIGHT", "FULL"]) { const r = runTables([L, Rt], sqlFor(t)); if (!r.ok) return { fail: "the join doesn't run: " + r.error }; results[t] = { columns: r.columns, rows: r.rows }; }
    if (!results[jt].rows.length || results[jt].rows.length > 12) return { fail: "the " + jt + " JOIN result has " + results[jt].rows.length + " rows (needs 1-12)" };
    // the join type must matter: the answer differs from every other join type's real result
    const same = ["INNER", "LEFT", "RIGHT", "FULL"].filter((t) => t !== jt && sameRowsAs(results[t], results[jt], true));
    if (same.length) return { fail: jt + " JOIN gives the same rows as " + same.join(", ") + ": add unmatched rows on both sides so the join type matters" };
    const question = String(p.question || "").trim();
    if (!question) return { fail: "the question is missing" };
    return { data: { question, left: L, right: Rt, key: k, join_type: jt, result: results[jt], results_by_type: results, why: String(p.why || "").trim() },
      checks: [{ ok: true, label: "Every join type really run on the tables: " + jt + " JOIN's result differs from the other three" }],
      review: { question, left: L, right: Rt, answer: { key: k, join_type: jt }, real_result: results[jt] } };
  },
  reviewAsk: "Check: the question asks for exactly what the answer's join returns (only that key and that join type fit), it doesn't name the join type, and it shows the concept.", reviewLabel: "the question fits only this key and join type",
});
async function joinMapperFor(c, batch) { return genCard(c, batch, joinMapperSpec(c)); }
const SYSTEM_COMPARE = `You write one "compare two queries" card for a SQL course: the learner sees one or two small tables and two nearly identical queries that differ in exactly the way the concept is about, predicts how their results differ, then sees both real results.
Reply with ONLY one JSON object: {"question": "...", "tables": [{"name": "...", "columns": ["..."], "rows": [[...]]}], "query_a": "SELECT ...", "query_b": "SELECT ...", "why": "1-2 sentences: why the results differ"} or {"skip": true} when two SELECTs can't show this concept (e.g. it is about changing data or structure).
Rules: 3-8 rows per table, chosen so the difference shows (duplicates for UNION vs UNION ALL, NULLs for COUNT(*) vs COUNT(col), ties for RANK vs DENSE_RANK, unmatched rows for joins ...); each query one SELECT over only these tables, returning at most 10 rows, with ORDER BY when order matters; SQLite syntax. The question must not give away the answer. Lowercase names.`;
const compareSpec = (c) => ({
  type: "compare_queries", rules: { answer: "multiple choice built from the two real results" }, system: SYSTEM_COMPARE,
  verify: async (p) => {
    const tables = ((p && p.tables) || []).slice(0, 2).map(cleanTable).filter((t) => t && t.name && t.rows.length >= 3);
    if (!tables.length || !p.query_a || !p.query_b) return { fail: "tables (3-8 rows) and both queries are needed" };
    if (![p.query_a, p.query_b].every((q) => Cards.isReadOnlySql(q))) return { fail: "each query must be one SELECT" };
    const a = runTables(tables, p.query_a), b = runTables(tables, p.query_b);
    if (!a.ok || !b.ok) return { fail: "a query doesn't run: " + (a.error || b.error) };
    if (a.rows.length > 10 || b.rows.length > 10) return { fail: "a query returns more than 10 rows" };
    if (sameRowsAs({ columns: a.columns, rows: a.rows }, { columns: b.columns, rows: b.rows }, true)) return { fail: "both queries return exactly the same rows: choose rows where the difference shows" };
    const data = { question: String(p.question || "").trim() || "How do the results of these two queries differ?", tables, query_a: p.query_a.trim(), query_b: p.query_b.trim(), result_a: { columns: a.columns, rows: a.rows }, result_b: { columns: b.columns, rows: b.rows }, why: String(p.why || "").trim() };
    return { data, checks: [{ ok: true, label: "Both queries really run on the tables (SQLite); their results differ" }, { ok: true, label: "The answer options are built from the two real results" }],
      review: { question: data.question, tables, query_a: data.query_a, real_result_a: data.result_a, query_b: data.query_b, real_result_b: data.result_b, why: data.why } };
  },
  reviewAsk: "Check: the two queries differ in the way the concept is about, the 'why' matches the real results, and the question doesn't give away the answer.", reviewLabel: "the difference is the concept's",
});
async function compareFor(c, batch) { return genCard(c, batch, compareSpec(c)); }
// ---------- upgrades of existing items ----------
const SYSTEM_SYNTAX_UP = `You improve fill-in-the-blank SQL flashcards. For each card give the other answers that are equally right for the blank (same meaning and same result: e.g. a different but equivalent spelling, COUNT(1) for COUNT(*) only when it gives the same result here), and a short explanation (1-2 sentences) of the right answer. Reply with ONLY a JSON array: [{"id": "...", "accepted": ["..."], "explanation": "..."}]. Empty "accepted" when only the answer fits.`;
/** One draft upgrade per blank card of a concept: alternatives are kept only if they give the answer's real result. */
async function syntaxUpgradesFor(c, batch) {
  const cards = db.prepare("SELECT id, data FROM stage_items WHERE kind = 'flashcard' AND status = 'published' AND concept = ? AND json_extract(data, '$.type') = 'blank'").all(c.slug).map((r) => ({ id: r.id, ...JSON.parse(r.data) }));
  const todo = cards.filter((f) => !db.prepare("SELECT 1 FROM stage_items WHERE kind = 'card' AND status != 'rejected' AND json_extract(data, '$.base_id') = ?").get(f.id));
  if (!todo.length) return 0;
  let list = [];
  try { list = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_SYNTAX_UP, `CONCEPT: ${c.name}\nCARDS: ` + JSON.stringify(todo.map((f) => ({ id: f.id, prompt: f.prompt, sql: f.sql, answer: f.answer }))), 2500)).text) || []; } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw Object.assign(e, { api: true }); }
  const ups = [];
  for (const f of todo) {
    const u = (Array.isArray(list) ? list : []).find((x) => x && x.id === f.id);
    if (!u || !u.explanation) continue;
    // an alternative counts only when the filled-in query gives the same real result as the answer's
    const base = await runScript(f.site, String(f.sql).replace("___", f.answer));
    const accepted = [];
    for (const a of (u.accepted || []).slice(0, 4)) {
      if (!a || Cards.normAns(a) === Cards.normAns(f.answer)) continue;
      const r = base.ok && base.result ? await runScript(f.site, String(f.sql).replace("___", a)) : null;
      if (r && r.ok && r.result && sameRowsAs(base.result, r.result, true)) accepted.push(String(a).trim());
    }
    ups.push({ f, accepted, explanation: String(u.explanation).trim(), runs: !!(base.ok && base.result) });
  }
  if (!ups.length) return 0;
  let reviews = [];
  try { reviews = cc.jsonOf((await cc.ask(cc.MODELS.b, `You review explanations and accepted answers for fill-in-the-blank SQL flashcards. For each, check the explanation is correct and every accepted answer is truly right for the blank. Reply with ONLY a JSON array: [{"id": "...", "ok": true} or {"id": "...", "ok": false, "why": "..."}]`, JSON.stringify(ups.map((u) => ({ id: u.f.id, sql: u.f.sql, answer: u.f.answer, accepted: u.accepted, explanation: u.explanation }))), 2500)).text) || []; } catch { reviews = []; }
  let made = 0;
  for (const u of ups) {
    const rv = (Array.isArray(reviews) ? reviews : []).find((x) => x && x.id === u.f.id);
    if (!rv || rv.ok !== true) continue;
    saveStage("card", c, { ...cardMeta(c, "syntax_upgrade", { answer: "exact match, then accepted alternatives" }), base_id: u.f.id, base_prompt: u.f.prompt, base_sql: u.f.sql, base_answer: u.f.answer, accepted: u.accepted, explanation: u.explanation }, [
      { ok: true, label: u.runs ? "Each accepted alternative gives the same real result as the answer (" + u.accepted.length + " kept)" : "The card's query doesn't return a result here: no alternatives kept, explanation only" },
      { ok: true, warn: true, label: "Second provider (" + reviewerName() + "): explanation and alternatives are right" }], batch);
    made++;
  }
  return made;
}
const SYSTEM_MCQ_UP = `For each multiple-choice SQL question, explain in one short sentence why EACH wrong option is wrong (the misconception behind it). Reply with ONLY a JSON array: [{"id": "...", "why_wrong": ["one entry per option, in order; \\"\\" for the right option"]}]`;
/** Draft MCQ upgrades: why each wrong option is wrong, for the live MCQs of a level. */
async function mcqUpgradesFor(level, batch) {
  const mcqs = content.publicMcqs().filter((m) => (m.level || 1) === level && !db.prepare("SELECT 1 FROM stage_items WHERE kind = 'card' AND status != 'rejected' AND json_extract(data, '$.base_id') = ?").get(m.id));
  let made = 0;
  for (let i = 0; i < mcqs.length; i += 8) {
    const chunk = mcqs.slice(i, i + 8);
    let list = [];
    try { list = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_MCQ_UP, JSON.stringify(chunk.map((m) => ({ id: m.id, q: m.q, code: m.code, options: m.options, right: m.answer, why: m.why }))), 3000)).text) || []; } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw Object.assign(e, { api: true }); }
    const ups = chunk.map((m) => ({ m, u: (Array.isArray(list) ? list : []).find((x) => x && x.id === m.id) })).filter((x) => x.u && Array.isArray(x.u.why_wrong) && x.u.why_wrong.length === x.m.options.length && x.u.why_wrong.every((w, k) => k === x.m.answer || String(w || "").trim().length > 8));
    if (!ups.length) continue;
    let reviews = [];
    try { reviews = cc.jsonOf((await cc.ask(cc.MODELS.b, `You review "why this option is wrong" notes for SQL multiple-choice questions. For each question check every note is correct and explains that option's misconception. Reply with ONLY a JSON array: [{"id": "...", "ok": true} or {"id": "...", "ok": false, "why": "..."}]`, JSON.stringify(ups.map((x) => ({ id: x.m.id, q: x.m.q, options: x.m.options, right: x.m.answer, why_wrong: x.u.why_wrong }))), 3000)).text) || []; } catch { reviews = []; }
    for (const x of ups) {
      const rv = (Array.isArray(reviews) ? reviews : []).find((r) => r && r.id === x.m.id);
      if (!rv || rv.ok !== true) continue;
      const tag = db.prepare("SELECT concepts FROM item_tags WHERE key = ?").get("mcq:" + x.m.id);
      const slug = tag ? JSON.parse(tag.concepts)[0] : null;
      const c = slug && cc.allConcepts().find((k) => k.slug === slug);
      if (!c) continue;
      saveStage("card", c, { ...cardMeta(c, "mcq_upgrade", { answer: "unchanged" }), base_id: x.m.id, base_q: x.m.q, base_options: x.m.options, base_answer: x.m.answer, why_wrong: x.u.why_wrong.map((w, k) => (k === x.m.answer ? "" : String(w).trim())) }, [{ ok: true, label: "A note for every wrong option" }, { ok: true, warn: true, label: "Second provider (" + reviewerName() + "): every note is correct" }], batch);
      made++;
    }
  }
  return made;
}

// ---------- Phase 2 card types (kind "card": optional practice) ----------
// One loop for all of them: the generator writes, real SQL verifies, a second provider reviews, failures go back to
// the generator (3 attempts). Every answer and every table shown is a real run.
async function genCard(c, batch, spec) {
  let feedback = "Write the card.";
  for (let attempt = 0; attempt < 3; attempt++) {
    let p = null;
    try { p = cc.jsonOf((await cc.ask(cc.MODELS.a, spec.system, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\n\n${feedback}`, 2400)).text); } catch (e) { if (/fetch|reach|timeout/i.test(e.message)) throw Object.assign(e, { api: true }); }
    if (p && p.skip) return "skip";
    const fail = (why) => { feedback = "Your last attempt failed: " + why + "\nLAST ATTEMPT: " + JSON.stringify(p); if (process.env.SG_DEBUG) console.warn("[" + spec.type + "]", c.slug, why.slice(0, 160)); };
    if (!p) { fail("the reply wasn't one JSON object"); continue; }
    const v = await spec.verify(p);
    if (v.fail) { fail(v.fail); continue; }
    const rv = await reviewCard(c, v.review, spec.reviewAsk);
    if (!rv.ok) { fail("a second model objected: " + rv.why); continue; }
    return saveStage("card", c, { ...cardMeta(c, spec.type, spec.rules), ...v.data }, v.checks.concat([{ ok: true, warn: true, label: "Second provider (" + reviewerName() + "): " + spec.reviewLabel }, { ok: true, warn: true, label: "Optional practice: not part of mastery or coverage" }]), batch);
  }
  return null;
}
const keysOf = (t) => t.rows.map((r) => String(r[0]));
const uniqueFirst = (t) => t.columns.length >= 2 && new Set(keysOf(t)).size === t.rows.length && t.rows.every((r) => r[0] !== null);
const TABLE_SHAPE = `{"name": "...", "columns": ["id_column", "..."], "rows": [[...], ...]}`;

// #5 result-set reasoning
const resultSetSpec = (c) => ({
    type: "result_set", rules: { answer: "the rows picked equal the query's real result rows (by key)" },
    system: `You write one "result-set reasoning" card for a SQL course: the learner sees a small table and a query, and ticks the rows the query returns.
Reply with ONLY one JSON object: {"question": "...", "table": ${TABLE_SHAPE}, "query": "SELECT * FROM <table> WHERE ... (ORDER BY / LIMIT when the concept needs it)", "why": "1-2 sentences"} or {"skip": true} when picking rows can't show this concept.
Rules: 6-9 rows; the FIRST column is a unique id; the query returns some rows but not all, and the rows are chosen so the concept decides which (boundary values, NULLs, ties ...); SQLite syntax; lowercase names. The question must not give away the answer.`,
    verify: async (p) => {
      const t = cleanTable(p.table);
      if (!t || t.rows.length < 6 || !uniqueFirst(t)) return { fail: "a table with 6-9 rows and a unique first column (the id) is needed" };
      if (!p.query || !Cards.isReadOnlySql(p.query)) return { fail: "the query must be one SELECT" };
      const r = runTables([t], p.query);
      if (!r.ok) return { fail: "the query doesn't run: " + r.error };
      const ids = r.rows.map((x) => String(x[0]));
      if (!ids.every((k) => keysOf(t).includes(k))) return { fail: "the query must return the table's id as its first column (SELECT * or SELECT id, ...)" };
      if (!ids.length || ids.length >= t.rows.length) return { fail: "the query returns " + ids.length + " of " + t.rows.length + " rows: it must return some rows but not all" };
      return { data: { question: String(p.question || "").trim() || "Which rows does this query return?", table: t, query: p.query.trim(), answer_ids: ids, result: { columns: r.columns, rows: r.rows }, why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "The query really runs on the table (SQLite): " + ids.length + " of " + t.rows.length + " rows match" }],
        review: { question: p.question, table: t, query: p.query, real_result_ids: ids, why: p.why } };
    },
    reviewAsk: "Check: the rows chosen make the concept decide which rows match, the 'why' matches the real result, and the question doesn't give away the answer.", reviewLabel: "the rows make the concept decide the answer",
});
async function resultSetFor(c, batch) { return genCard(c, batch, resultSetSpec(c)); }
// #9 join comparison
// the model may write "INNER JOIN > LEFT JOIN", "inner vs left" or ["INNER", "LEFT"]: one spelling
const jcPair = (x) => (Array.isArray(x) ? x.join(">") : String(x || "")).toUpperCase().replace(/\b(OUTER|JOIN)\b/g, "").replace(/\s*(->|→|>|\bVS\b\.?|,)\s*/g, ">").replace(/\s+/g, "");
const JC_PAIRS = { "INNER>LEFT": "left", "INNER>RIGHT": "right", "LEFT>FULL": "right" };
const joinCompareSpec = (c) => ({
    type: "join_compare", rules: { answer: "the rows the second join type adds (by key) equal the real unmatched rows" },
    system: `You write one "join comparison" card for a SQL course: two small tables, two join types; the learner ticks the rows of one table that the second join type returns but the first doesn't (the unmatched rows), then toggles between the real results.
Reply with ONLY one JSON object: {"question": "...", "left": ${TABLE_SHAPE}, "right": ${TABLE_SHAPE}, "key": {"left": "left_table.column", "right": "right_table.column"}, "pair": "INNER>LEFT" | "INNER>RIGHT" | "LEFT>FULL", "why": "..."}
Rules: 4-6 rows per table, the FIRST column of each table a unique id; some rows match, and the side the pair adds has 1-3 unmatched rows; lowercase names; the question names the two join types but not the answer.`,
    verify: async (p) => {
      const L = cleanTable(p.left), Rt = cleanTable(p.right), side = JC_PAIRS[p.pair = jcPair(p.pair)];
      if (!L || !Rt || L.rows.length < 4 || Rt.rows.length < 4 || L.name === Rt.name || !uniqueFirst(L) || !uniqueFirst(Rt)) return { fail: "two differently named tables with 4-6 rows each and a unique first column are needed" };
      if (!side) return { fail: "pair must be INNER>LEFT, INNER>RIGHT or LEFT>FULL" };
      const k = { left: String((p.key || {}).left || "").toLowerCase(), right: String((p.key || {}).right || "").toLowerCase() };
      const okCol = (ref, t) => ref.split(".")[0] === t.name && t.columns.includes(ref.split(".")[1]);
      if (!okCol(k.left, L) || !okCol(k.right, Rt)) return { fail: "key must be left_table.column and right_table.column" };
      const results = {};
      for (const t of ["INNER", "LEFT", "RIGHT", "FULL"]) { const r = runTables([L, Rt], `SELECT * FROM ${L.name} ${t === "INNER" ? "INNER" : t + " OUTER"} JOIN ${Rt.name} ON ${k.left} = ${k.right} ORDER BY 1, 2`); if (!r.ok) return { fail: "the join doesn't run: " + r.error }; results[t] = { columns: r.columns, rows: r.rows }; }
      const S = side === "left" ? L : Rt, O = side === "left" ? Rt : L, sk = side === "left" ? k.left : k.right, ok = side === "left" ? k.right : k.left;
      const un = runTables([L, Rt], `SELECT ${S.name}.${S.columns[0]} FROM ${S.name} WHERE NOT EXISTS (SELECT 1 FROM ${O.name} WHERE ${ok} = ${sk})`);
      if (!un.ok) return { fail: un.error };
      const ids = un.rows.map((r) => String(r[0]));
      if (!ids.length || ids.length >= S.rows.length) return { fail: "the " + side + " table needs 1-3 unmatched rows (it has " + ids.length + ")" };
      const [a, b] = p.pair.split(">");
      return { data: { question: String(p.question || "").trim() || `Which ${S.name} rows does ${b} JOIN return that ${a} JOIN doesn't?`, left: L, right: Rt, key: k, pair: [a, b], side, answer_ids: ids, results_by_type: results, why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "All four join types really run; the " + ids.length + " unmatched " + S.name + " rows are found with NOT EXISTS" }],
        review: { question: p.question, left: L, right: Rt, key: k, pair: p.pair, real_unmatched_ids: ids, why: p.why } };
    },
    reviewAsk: "Check: the question is clear about which rows to tick, the unmatched rows are exactly what the second join type adds, and the 'why' is correct.", reviewLabel: "the question and the unmatched rows agree",
});
async function joinCompareFor(c, batch) { return genCard(c, batch, joinCompareSpec(c)); }
// #13 find the difference
const findDifferenceSpec = (c) => ({
    type: "find_difference", rules: { answer: "the rows returned by exactly one of the two queries (by key)" },
    system: `You write one "find the difference" card for a SQL course: two nearly identical queries (1-3 tokens differ, in the way the concept is about, e.g. AND vs OR, < vs <=, IS NULL vs = NULL, DISTINCT or not); the learner ticks the table rows that only ONE of the two queries returns.
Reply with ONLY one JSON object: {"question": "...", "table": ${TABLE_SHAPE}, "query_a": "SELECT * FROM <table> WHERE ...", "query_b": "...", "why": "..."} or {"skip": true} when two such queries can't show this concept.
Rules: 6-9 rows, the FIRST column a unique id; both queries return the id first; some rows differ but not all; SQLite syntax; lowercase names.`,
    verify: async (p) => {
      const t = cleanTable(p.table);
      if (!t || t.rows.length < 6 || !uniqueFirst(t)) return { fail: "a table with 6-9 rows and a unique first column is needed" };
      if (![p.query_a, p.query_b].every((q) => q && Cards.isReadOnlySql(q))) return { fail: "each query must be one SELECT" };
      const d = Cards.tokenDiff(p.query_a, p.query_b), ch = Math.max(d.a.filter((x) => x.changed).length, d.b.filter((x) => x.changed).length);
      if (ch < 1 || ch > 4) return { fail: "the queries must differ in 1-4 tokens (they differ in " + ch + ")" };
      const a = runTables([t], p.query_a), b = runTables([t], p.query_b);
      if (!a.ok || !b.ok) return { fail: "a query doesn't run: " + (a.error || b.error) };
      const ia = a.rows.map((r) => String(r[0])), ib = b.rows.map((r) => String(r[0])), keys = keysOf(t);
      if (!ia.concat(ib).every((k) => keys.includes(k))) return { fail: "both queries must return the table's id as their first column" };
      const diff = keys.filter((k) => ia.includes(k) !== ib.includes(k));
      if (!diff.length || diff.length === keys.length) return { fail: "the rows returned by only one query: " + diff.length + " (needs some, not all)" };
      return { data: { question: String(p.question || "").trim() || "Which rows does only one of the two queries return?", table: t, query_a: p.query_a.trim(), query_b: p.query_b.trim(), answer_ids: diff, result_a: { columns: a.columns, rows: a.rows }, result_b: { columns: b.columns, rows: b.rows }, why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "Both queries really run (SQLite); " + diff.length + " rows are returned by only one of them; the queries differ in " + ch + " token(s)" }],
        review: { question: p.question, table: t, query_a: p.query_a, query_b: p.query_b, real_rows_in_one_only: diff, why: p.why } };
    },
    reviewAsk: "Check: the change between the queries is the concept's, the 'why' matches the real rows, and the question doesn't give away the answer.", reviewLabel: "the change is the concept's and the why is right",
});
async function findDifferenceFor(c, batch) { return genCard(c, batch, findDifferenceSpec(c)); }
// "-- ..." comments are dropped (outside quotes): the learner sees each statement on one line, where a comment would hide the rest
function noLineComments(sql) {
  let out = "", q = null;
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (q) { out += ch; if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"' || ch === "`") { q = ch; out += ch; continue; }
    if (ch === "-" && sql[i + 1] === "-") { while (i < sql.length && sql[i] !== "\n") i++; out += "\n"; continue; }
    out += ch;
  }
  return out.split("\n").map((l) => l.trimEnd()).filter((l) => l.trim()).join("\n").trim();
}
// #15 execution timeline: the real state after every statement (a fresh MySQL scratch schema per prefix)
const timelineSpec = (c) => {
  const site = siteFor(c);
  return {
    type: "exec_timeline", rules: { answer: "the real state after the asked statement (one of the real states)" },
    system: `You write one "execution timeline" card for a SQL course: a short script that changes a table step by step (e.g. INSERT, UPDATE, DELETE, a transaction with ROLLBACK or COMMIT, a SAVEPOINT); the learner predicts the table after one statement, then steps through the real state after every statement.
Reply with ONLY one JSON object: {"question": "...", "script": "CREATE TABLE es_<name> (...); INSERT ...; ...", "check_sql": "SELECT ... FROM es_<name> ORDER BY ...", "ask_step": N, "why": "..."} or {"skip": true} when a step-by-step script can't show this concept.
Rules: 4-8 statements, the first creates the table (named es_...), the second inserts 2-5 rows; MySQL 8; no DELIMITER, no CREATE USER; ask_step is the statement whose result shows the concept best (e.g. the ROLLBACK); deterministic.`,
    verify: async (p) => {
      const stmts = statementsOf(p.script || "").map(noLineComments).filter(Boolean);
      if (p.check_sql) p.check_sql = noLineComments(p.check_sql);
      if (stmts.length < 4 || stmts.length > 8) return { fail: "the script needs 4-8 statements (it has " + stmts.length + ")" };
      const made = createdTables(p.script);
      if (!made.length || made.some((x) => !/^es_/.test(x))) return { fail: "the script must create its table, named es_..." };
      if (!p.check_sql || !Cards.isReadOnlySql(p.check_sql)) return { fail: "check_sql must be one SELECT" };
      const step = Math.round(Number(p.ask_step));
      if (!(step >= 2 && step <= stmts.length)) return { fail: "ask_step must be a statement number from 2 to " + stmts.length };
      const snapshots = [];
      for (let k = 1; k <= stmts.length; k++) {
        const r = await writecheck.runOnDataset(site, stmts.slice(0, k).join(";\n") + ";\n" + p.check_sql);
        if (!r.ok || !r.result) return { fail: "after statement " + k + " the check query doesn't run: " + String(r.error || "no result").replace(/\b(?:sqlscratch_[a-z0-9_]+)\./gi, "").slice(0, 160) };
        snapshots.push({ after: k, statement: stmts[k - 1], columns: r.result.columns, rows: r.result.rows.slice(0, 12) });
      }
      const card = { snapshots };
      if (!Cards.timelineOptions(card, step)) return { fail: "every statement leaves the same table: choose statements that change it" };
      const again = await writecheck.runOnDataset(site, stmts.slice(0, step).join(";\n") + ";\n" + p.check_sql);
      if (!again.ok || JSON.stringify(again.result.rows.slice(0, 12)) !== JSON.stringify(snapshots[step - 1].rows)) return { fail: "the state isn't the same on a second run: make the script deterministic" };
      return { data: { question: String(p.question || "").trim() || "What does the table hold after statement " + step + "?", script: stmts.join(";\n") + ";", check_sql: p.check_sql.trim(), ask_step: step, snapshots, engine: "MySQL", why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "Each statement really run on a fresh MySQL scratch schema: " + stmts.length + " real states, " + new Set(snapshots.map((s) => JSON.stringify(s.rows))).size + " distinct" }, { ok: true, label: "Deterministic: the asked state is the same on a second run" }],
        review: { question: p.question, script: stmts, ask_step: step, real_states: snapshots.map((s) => ({ after: s.after, rows: s.rows })), why: p.why } };
    },
    reviewAsk: "Check: the script shows the concept step by step, the asked step is a good one, and the 'why' matches the real states.", reviewLabel: "the steps show the concept",
  };
};
async function timelineFor(c, batch) { return genCard(c, batch, timelineSpec(c)); }
// #16 schema detective: the key proven by real COUNT(DISTINCT) / NULL counts
const schemaDetectiveSpec = (c) => ({
    type: "schema_detective", rules: { answer: "the only candidate whose real COUNT(DISTINCT) equals COUNT(*) with no NULL" },
    system: `You write one "schema detective" card for a SQL course: the learner sees a small table and picks the column that should uniquely identify each row (the primary key), then sees the proof.
Reply with ONLY one JSON object: {"question": "...", "table": {"name": "...", "columns": ["..."], "rows": [[...]]}, "candidates": ["3-4 column names"], "why": "..."} or {"skip": true}.
Rules: 6-8 rows; exactly ONE candidate has all values different and no NULL; every other candidate has a repeated value or a NULL in these rows (a realistic trap: a name that repeats, an e-mail that is missing once ...); lowercase names; the question doesn't name the answer.`,
    verify: async (p) => {
      const t = cleanTable(p.table);
      if (!t || t.rows.length < 6) return { fail: "a table with 6-8 rows is needed" };
      const cands = (p.candidates || []).map((x) => String(x).toLowerCase()).filter((x) => t.columns.includes(x));
      if (cands.length < 3) return { fail: "3-4 candidates that are columns of the table are needed" };
      const stats = [];
      for (const col of cands) {
        const r = runTables([t], `SELECT COUNT(*), COUNT(DISTINCT ${col}), SUM(CASE WHEN ${col} IS NULL THEN 1 ELSE 0 END) FROM ${t.name}`);
        if (!r.ok) return { fail: r.error };
        stats.push({ column: col, rows: r.rows[0][0], distinct: r.rows[0][1], nulls: r.rows[0][2] });
      }
      const keys = Cards.keyColumns(stats);
      if (keys.length !== 1) return { fail: keys.length ? "more than one candidate is unique and not NULL (" + keys.join(", ") + "): make only one fit" : "no candidate is unique and without NULL" };
      return { data: { question: String(p.question || "").trim() || "Which column should uniquely identify each row?", table: t, candidates: cands, stats, key: keys[0], why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "Real COUNT(*) / COUNT(DISTINCT) / NULL counts: only " + keys[0] + " is unique and never NULL" }],
        review: { question: p.question, table: t, candidates: cands, real_counts: stats, answer: keys[0], why: p.why } };
    },
    reviewAsk: "Check: the answer is the right primary key for this table, the other candidates are realistic traps, and the 'why' is correct.", reviewLabel: "the key and the traps are right",
});
async function schemaDetectiveFor(c, batch) { return genCard(c, batch, schemaDetectiveSpec(c)); }

// #14 sort and filter: the learner picks filters and a sort; the assembled query is really run and its result compared
const sameOrdered = (a, b) => JSON.stringify(a.rows) === JSON.stringify(b.rows) && a.columns.length === b.columns.length;
const sortFilterSpec = (c) => ({
    type: "sort_filter", rules: { answer: "the assembled query's real result equals the reference result, rows in order" },
    system: `You write one "sort and filter" card for a SQL course: the learner reads a task in words (e.g. "Return the active students with marks above 70, highest marks first"), picks WHERE conditions from a list (they are joined by AND) and one ORDER BY; the assembled query is run and its result compared.
Reply with ONLY one JSON object: {"question": "the task in words", "table": ${TABLE_SHAPE}, "select": "the column list, e.g. name, marks", "filters": ["4-5 WHERE conditions"], "sorts": ["3-4 ORDER BY expressions"], "answer": {"filters": [indexes of the right conditions], "sort": index of the right sort}, "why": "1-2 sentences"} or {"skip": true} when filters and a sort can't show this concept.
Rules: 6-8 rows; 1-2 right conditions; the wrong conditions are typical traps (> vs >=, the wrong column, = NULL, a misspelled value ...) and each one changes the result; the wrong sorts change the order (the wrong direction, the wrong column); the right sort gives one exact order (add a tie-breaker when values tie); SQLite syntax; lowercase names. The question must not quote the SQL.`,
    verify: async (p) => {
      const t = cleanTable(p.table);
      if (!t || t.rows.length < 6) return { fail: "a table with 6-8 rows is needed" };
      if (/^(order|group|select|where|table|from|by|limit|index|key|user)$/.test(t.name)) return { fail: "the table name '" + t.name + "' is an SQL keyword: name it in the plural (orders, groups ...)" };
      const filters = (p.filters || []).map((x) => String(x).trim()).filter(Boolean), sorts = (p.sorts || []).map((x) => String(x).trim()).filter(Boolean);
      if (filters.length < 3 || filters.length > 5 || new Set(filters).size !== filters.length) return { fail: "3-5 different filters are needed" };
      if (sorts.length < 2 || sorts.length > 4 || new Set(sorts).size !== sorts.length) return { fail: "2-4 different sorts are needed" };
      if (filters.concat(sorts, [p.select]).some((x) => /;|\bselect\b/i.test(String(x || "")))) return { fail: "filters, sorts and select must be plain fragments (no ; and no subquery)" };
      const card = { select: String(p.select || "").trim(), from: t.name, filters, sorts };
      const a = p.answer || {}, af = (a.filters || []).map(Number), as = Number(a.sort);
      if (!card.select || !af.length || af.length > 2 || af.some((i) => !(i >= 0 && i < filters.length)) || !(as >= 0 && as < sorts.length)) return { fail: "answer must name 1-2 filters and one sort by index" };
      const run = (pick) => runTables([t], Cards.assembleQuery(card, pick));
      const ref = run({ filters: af, sort: as });
      if (!ref.ok) return { fail: "the right query doesn't run: " + ref.error };
      if (ref.rows.length < 2 || ref.rows.length >= t.rows.length) return { fail: "the right query returns " + ref.rows.length + " of " + t.rows.length + " rows: it needs 2 or more, but not all" };
      // one exact order: the same rows whatever breaks the ties
      const tie = (dir) => runTables([t], Cards.assembleQuery(card, { filters: af, sort: as }) + ", " + ref.columns.map((_, k) => (k + 1) + " " + dir).join(", "));
      const up = tie("ASC"), down = tie("DESC");
      if (!up.ok || !down.ok || !sameOrdered(up, down) || !sameOrdered(up, ref)) return { fail: "the right sort leaves ties (rows could come in another order): add a tie-breaker" };
      for (let i = 0; i < filters.length; i++) {
        // a right filter must matter; a wrong one must give a wrong result when added, or when picked instead of a right one
        const picks = af.includes(i) ? [af.filter((x) => x !== i)] : [af.concat([i])].concat(af.map((r) => af.filter((x) => x !== r).concat([i])));
        const bites = picks.some((pick) => { const r = run({ filters: pick, sort: as }); return !r.ok || !sameOrdered(r, ref); });
        if (!bites) return { fail: "filter " + i + " (" + filters[i] + ") doesn't change the result: " + (af.includes(i) ? "the query is right without it" : "adding it changes nothing") + ": add a row where this condition decides (a value exactly on the boundary, a NULL, the other spelling ...)" };
      }
      for (let k = 0; k < sorts.length; k++) if (k !== as) { const r = run({ filters: af, sort: k }); if (r.ok && sameOrdered(r, ref)) return { fail: "sort " + k + " (" + sorts[k] + ") gives the same order as the right one: change the rows so it orders them differently, or pick another wrong sort" }; }
      return { data: { question: String(p.question || "").trim(), table: t, setup_sql: tablesSql([t]).sql, ...card, answer: { filters: af, sort: as }, result: { columns: ref.columns, rows: ref.rows }, engine: "SQLite", why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "The right query really runs (SQLite): " + ref.rows.length + " of " + t.rows.length + " rows, one exact order" }, { ok: true, label: "Every wrong filter and every wrong sort changes the real result" }],
        review: { question: p.question, table: t, right_query: Cards.assembleQuery(card, { filters: af, sort: as }), wrong_filters: filters.filter((_, i) => !af.includes(i)), wrong_sorts: sorts.filter((_, k) => k !== as), real_result: ref.rows, why: p.why } };
    },
    reviewAsk: "Check: the task in words asks for exactly the right query (no ambiguity between the right and a wrong condition), the traps are realistic, and the 'why' is right.", reviewLabel: "the task matches the right query exactly",
});
async function sortFilterFor(c, batch) { return genCard(c, batch, sortFilterSpec(c)); }
// #17 query optimizer: SQLite's real EXPLAIN QUERY PLAN without and with the index (an index may or may not help)
const ALWAYS_HELPS = /\balways\b[^.]{0,40}\b(help|faster|speed|improv|better|use)|\bindex(es)?\b[^.]{0,20}\balways\b/i;
function explainPlan(schema, index, query) {
  const { DatabaseSync } = require("node:sqlite");
  const m = new DatabaseSync(":memory:");
  const plan = () => { const st = m.prepare("EXPLAIN QUERY PLAN " + query); return st.all().map((r) => String(r.detail)); };
  try {
    m.exec(schema);
    const before = plan();
    m.exec(index);
    const name = m.prepare("SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL").get();
    const cols = m.prepare(`SELECT name FROM pragma_index_info('${name.name.replace(/'/g, "''")}') ORDER BY seqno`).all().map((r) => r.name);
    return { ok: true, before, after: plan(), index_name: name.name, table: name.tbl_name, index_columns: cols };
  } catch (e) { return { ok: false, error: e.message }; } finally { m.close(); }
}
const queryOptimizerSpec = (c, kase) => {
  const helps = kase !== "no_help";
  return {
    type: "query_optimizer", rules: { answer: "SQLite's real EXPLAIN QUERY PLAN with the index", case: helps ? "the index is used" : "the index exists but isn't used" },
    system: `You write one "query optimizer" card for a SQL course: one table, one index and one query; the learner predicts how SQLite runs the query once the index exists, then sees the real plans without and with it.
This card's case: ${helps ? "the planner USES the index for this query (an equality or range on its leading column, an ORDER BY it can serve, a covering index ...)" : "the index exists but the planner CAN'T use it for this query (a leading-wildcard LIKE, a function or arithmetic on the column, a condition on a non-leading column of a composite index, an OR across columns ...)"}.
Reply with ONLY one JSON object: {"question": "...", "schema": "CREATE TABLE ... (4-6 columns)", "index": "CREATE INDEX idx_... ON <table> (...)", "query": "one SELECT on that table only", "why": "1-2 sentences on why the planner does what it does"} or {"skip": true}.
Rules: SQLite syntax; lowercase names; no joins; the question must not give the answer away. Never claim that an index always helps or always makes a query faster.`,
    verify: async (p) => {
      if (!/^\s*CREATE TABLE/i.test(p.schema || "") || statementsOf(p.schema).length !== 1) return { fail: "schema must be exactly one CREATE TABLE" };
      if (!/^\s*CREATE (UNIQUE )?INDEX/i.test(p.index || "") || statementsOf(p.index).length !== 1) return { fail: "index must be exactly one CREATE INDEX" };
      if (!p.query || !Cards.isReadOnlySql(p.query) || /\bjoin\b|,\s*\w+\s+(where|$)/i.test(p.query)) return { fail: "query must be one SELECT on the one table, no joins" };
      if (ALWAYS_HELPS.test(String(p.why || "") + " " + String(p.question || ""))) return { fail: "never claim that an index always helps: say what the planner does for THIS query" };
      const r = explainPlan(p.schema, p.index, p.query);
      if (!r.ok) return { fail: "SQLite can't run it: " + r.error };
      if (Cards.usesIndex(r.before, r.index_name)) return { fail: "the plan without the index already names it" };
      const used = Cards.usesIndex(r.after, r.index_name);
      if (used !== helps) return { fail: "the real plan with the index is: " + r.after.join(" / ") + " — " + (helps ? "it doesn't use the index; change the query or the index so it does" : "it uses the index; this card needs a query the index can't serve") };
      const card = { table: r.table, index_name: r.index_name, index_columns: r.index_columns, plan_before: r.before, plan_after: r.after };
      if (!Cards.optimizerOptions(card)) return { fail: "no distinct choices can be built from the plans" };
      return { data: { question: String(p.question || "").trim() || "With the index in place, how does SQLite run this query?", schema: p.schema.trim(), index: p.index.trim(), query: p.query.trim(), ...card, helps, engine: "SQLite", why: String(p.why || "").trim() },
        checks: [{ ok: true, label: "Real EXPLAIN QUERY PLAN (SQLite) without the index: " + r.before.join(" / ") }, { ok: true, label: "With the index: " + r.after.join(" / ") + (helps ? " (the index is used)" : " (the index is not used)") }],
        review: { question: p.question, schema: p.schema, index: p.index, query: p.query, real_plan_without: r.before, real_plan_with: r.after, why: p.why } };
    },
    reviewAsk: "Check: the 'why' explains the real plans correctly for SQLite, never says an index always helps, and the question doesn't give the answer away.", reviewLabel: "the why matches the real plans",
  };
};
async function queryOptimizerFor(c, batch, kase) { return genCard(c, batch, queryOptimizerSpec(c, kase)); }

/** Every standalone card type's spec (generation and manual creation run the same verify). */
const CARD_SPECS = { join_mapper: joinMapperSpec, compare_queries: compareSpec, result_set: resultSetSpec, join_compare: joinCompareSpec, find_difference: findDifferenceSpec, exec_timeline: timelineSpec, schema_detective: schemaDetectiveSpec, sort_filter: sortFilterSpec, query_optimizer: (c, kase) => queryOptimizerSpec(c, kase) };

// ---------- repairing warnings ----------
// who rewrote an item (the generator), for the review queue's "Rewritten" badge
const genLabel = () => ({ openai: "OpenAI", deepseek: "DeepSeek", claude: "Claude" }[cc.MODELS.a.provider] || cc.MODELS.a.provider) + " " + (cc.MODELS.a.model || "");
/** The tie-breaker (Claude Sonnet) couldn't run: the item is flagged for a person instead of failing the run. */
function flagManual(table, id, why) {
  const r = db.prepare("SELECT verify FROM " + table + " WHERE id = ?").get(id);
  if (!r) return "kept";
  const v = JSON.parse(r.verify);
  if (!v.checks.some((x) => /tie-breaker .* unavailable/.test(x.label))) v.checks.push({ ok: false, warn: true, label: "Manual review: the tie-breaker (" + cc.MODELS.strong.model + ") is unavailable", detail: String(why || "").slice(0, 200) });
  v.status = v.checks.some((x) => !x.ok && !x.warn) ? "fail" : "warn";
  v.manualReview = true;
  db.prepare("UPDATE " + table + " SET verify = ? WHERE id = ?").run(JSON.stringify(v), id);
  return "kept";
}
// Predict items: one fix round when the wrong choices collapsed or the reviewer says the rows shown aren't enough.
const SYSTEM_PO_FIX = `You fix one "predict the output" item for a SQL course. You get the item, the problems found when it was run and reviewed, and real rows of the dataset.
Reply with ONLY one JSON object: {"question": "...", "show_sql": "...", "sql": "...", "mistakes": ["4 scripts"]}
Rules:
- show_sql shows EVERY input row that affects the result (2-8 rows) with every column the query uses. If the query reads more rows than that, add the same WHERE to "sql" and to show_sql so the input is exactly the rows shown. For joins, show the rows of both tables (e.g. a LEFT JOIN listing both sides, or UNION ALL with a column naming the table) so every row the query reads is visible.
- "sql" returns 1-6 rows (0 rows only when "no rows" is the point of the concept).
- "mistakes": 4 COMPLETE scripts (repeat any INSERT / UPDATE that "sql" starts with) a learner with a typical misunderstanding of the concept might write. Each must return a DIFFERENT result from "sql" and from each other (other rows, values or row count), at most 8 rows.
- Only the dataset's tables; SQLite syntax unless the item already needs MySQL. The question must not reveal or hint at the result.`;
/** Runs a predict item's SQL: the input rows, the answer and the distinct wrong choices. */
async function buildPredict(site, p, emptyOk) {
  const show = await runScript(site, p.show_sql), ans = await runScript(site, p.sql);
  if (!show.ok || !show.result || !show.result.rows.length || show.result.rows.length > 8) return null;
  if (!ans.ok || !ans.result || (!ans.result.rows.length && !emptyOk) || ans.result.rows.length > 6) return null;
  const options = [ans.result];
  for (const m of (p.mistakes || []).slice(0, 5)) {
    const r = await runScript(site, m);
    if (r.ok && r.result && r.result.rows.length <= 8 && !options.some((o) => sameRows(o, r.result) && o.columns.length === r.result.columns.length)) options.push(r.result);
  }
  return { show: show.result, answer: ans.result, distractors: options.slice(1, 4), engine: ans.engine };
}
async function reviewPredict(c, p, b) {
  try {
    const r = cc.jsonOf((await cc.ask(cc.MODELS.b, SYSTEM_PO_REVIEW, `CONCEPT: ${c.name}\n` + JSON.stringify([{ i: 0, question: p.question, input: b.show, sql: p.sql, result: b.answer }]), 1500)).text) || [];
    return r[0] || null;
  } catch { return null; }
}
const predictChecks = (b, r) => [
  { ok: true, label: "Input rows and the answer are the real output on " + b.engine },
  { ok: b.distractors.length >= 1, warn: true, label: "Wrong choices from real mistaken queries", detail: b.distractors.length + " distinct" + (b.distractors.length ? "" : ": typed answer only") },
  { ok: !r || r.ok !== false, warn: true, label: "Second provider (OpenAI): answerable from the rows shown", detail: r && r.ok === false ? r.why : "" }];
const warnCount = (checks) => checks.filter((x) => !x.ok).length;
/** Re-verifies one saved predict item with warnings: fix, run, review; keeps the better version. Returns "fixed" | "kept". */
async function repairPredict(row) {
  // the fix varies between runs: two attempts
  return (await repairPredictOnce(row)) === "fixed" || (await repairPredictOnce(row)) === "fixed" ? "fixed" : "kept";
}
async function repairPredictOnce(row) {
  const c = conceptRows().get(row.concept);
  const d = JSON.parse(row.data), v = JSON.parse(row.verify);
  const problems = v.checks.filter((x) => !x.ok).map((x) => x.label + ": " + (x.detail || ""));
  const emptyOk = /not-exists|not-in|except|anti/.test(row.concept);
  let fixed = null;
  try {
    fixed = cc.jsonOf((await cc.ask(cc.MODELS.a, SYSTEM_PO_FIX, `CONCEPT: ${c.name} (Level ${c.level}) — ${c.summary}\nDATASET (${d.site}):\n${content.schemaText(d.site)}\nREAL ROWS:\n${sampleRows(d.site)}\n\nITEM:\n` + JSON.stringify({ question: d.question, show_sql: d.show_sql, sql: d.sql, answer: d.answer }) + "\n\nPROBLEMS:\n" + problems.join("\n"), 3000)).text);
  } catch { fixed = null; }
  if (!fixed || !fixed.sql || !fixed.show_sql) return "kept";
  const b = await buildPredict(d.site, fixed, emptyOk);
  if (!b) { if (process.env.SG_DEBUG) console.warn("[po kept] build failed", row.id, fixed.sql); return "kept"; }
  const checks = predictChecks(b, await reviewPredict(c, fixed, b));
  if (warnCount(checks) >= warnCount(v.checks)) { if (process.env.SG_DEBUG) console.warn("[po kept]", row.id, JSON.stringify(checks.filter((x) => !x.ok))); return "kept"; }
  const data = { ...d, question: fixed.question || d.question, show_sql: fixed.show_sql, show: b.show, sql: fixed.sql, answer: b.answer, distractors: b.distractors, engine: b.engine };
  const verify = { status: warnCount(checks) ? "warn" : "pass", checks, at: now(), repaired: true, rewritten: { by: genLabel(), what: "input rows, query and wrong choices (repair round)", before: { question: d.question, show_sql: d.show_sql, sql: d.sql }, at: now() } };
  db.prepare("UPDATE stage_items SET data = ?, verify = ?, updated_at = ? WHERE id = ? AND status = 'draft'").run(JSON.stringify(data), JSON.stringify(verify), now(), row.id);
  return "fixed";
}

// Flashcards: when the reviewer objects, Claude Sonnet gives a second opinion; a fixed card is run again.
const SYSTEM_FC_JUDGE = `A reviewer objected to a flashcard in a SQL course. Decide whether the objection is right.
Reply with ONLY one JSON object:
{"verdict": "keep", "why": "short reason the card is correct and unambiguous as it is"}
or {"verdict": "fix", "card": {same fields and type as the card, corrected}, "why": "what changed"}
or {"verdict": "drop", "why": "short reason it can't be fixed"}
Keep the card only if a learner could not be misled by it.`;
async function repairFlashcard(row) {
  const c = conceptRows().get(row.concept);
  const d = JSON.parse(row.data), v = JSON.parse(row.verify);
  const objection = (v.checks.find((x) => !x.ok && /Second provider/.test(x.label)) || {}).detail || "";
  const card = Object.fromEntries(Object.entries(d).filter(([k]) => !["concept", "site", "engine"].includes(k)));
  let j = null;
  let judgeDown = null;
  try { j = cc.jsonOf((await cc.ask(cc.MODELS.strong, SYSTEM_FC_JUDGE, `CONCEPT: ${c.name} — ${c.summary}\nCARD: ${JSON.stringify(card)}\nOBJECTION: ${objection}`, 1200)).text); } catch (e) { j = null; judgeDown = /Claude|Anthropic|credit/i.test(e.message) ? e.message : null; }
  if (judgeDown) return flagManual("stage_items", row.id, judgeDown);
  if (!j || !j.verdict) return "kept";
  const first = v.checks[0];
  if (j.verdict === "keep") {
    const checks = [first, { ok: true, warn: true, label: "Second provider (OpenAI): correct and unambiguous", detail: "OpenAI objected: " + objection + " — Claude Sonnet judged the card correct: " + (j.why || "") }];
    db.prepare("UPDATE stage_items SET verify = ?, updated_at = ? WHERE id = ? AND status = 'draft'").run(JSON.stringify({ status: "pass", checks, at: now(), repaired: true }), now(), row.id);
    return "fixed";
  }
  if (j.verdict === "fix" && j.card && j.card.type === d.type) {
    const ver = await verifyCard(d.site, j.card);
    if (!ver.ok) return "kept";
    const checks = [{ ok: true, label: ver.label }, { ok: true, warn: true, label: "Second provider (OpenAI): correct and unambiguous", detail: "OpenAI objected: " + objection + " — fixed by Claude Sonnet: " + (j.why || "") }];
    db.prepare("UPDATE stage_items SET data = ?, verify = ?, updated_at = ? WHERE id = ? AND status = 'draft'").run(JSON.stringify({ ...j.card, concept: d.concept, site: d.site, engine: ver.engine || null }), JSON.stringify({ status: "pass", checks, at: now(), repaired: true, rewritten: { by: "Claude Sonnet", what: "card", before: card, at: now() } }), now(), row.id);
    return "fixed";
  }
  // "drop": leave it for the reviewer, with the second opinion attached
  v.checks = v.checks.map((x) => (!x.ok && /Second provider/.test(x.label) ? { ...x, detail: x.detail + " — Claude Sonnet agrees: " + (j.why || "") } : x));
  db.prepare("UPDATE stage_items SET verify = ?, updated_at = ? WHERE id = ?").run(JSON.stringify(v), now(), row.id);
  return "kept";
}

// Drills: when the independent answer differs, Claude Sonnet says whether the task is ambiguous (rewrite it so
// only the drill's solution fits) or the solution is wrong (fix it); then the independent check runs again.
const SYSTEM_DRILL_JUDGE = `A SQL exercise has a reference solution, and an independent solver given only the task text wrote a different query with a different result. Decide why.
Reply with ONLY one JSON object:
{"verdict": "ambiguous", "task": "the task rewritten so that exactly the reference solution's result is correct: name the exact columns, filters, how ties/NULLs/duplicates are handled, and the sort order if it matters. Plain English, don't reveal the SQL."}
or {"verdict": "solution_wrong", "solution_sql": "the corrected reference solution for the task as written"}
or {"verdict": "independent_wrong", "why": "short reason"}`;
async function independentCheck(site, data, level, usage) {
  const refs = require("../library/refs.js");
  const item = { id: "gen-check", title: data.title, body: data.task, intro: "", dataset: data.dataset, chapterKey: null, order: 0, level };
  if (writecheck.isWrite(data.solution_sql)) {
    const out = await refs.solveWrite(item, usage);
    const mine = await writecheck.runOnDataset(site, data.solution_sql);
    const agree = out.status === "matched" && mine.ok && writecheck.compareRuns({ changed: out.chosen.changed, result: out.chosen.result, inTx: out.chosen.inTx }, mine).same;
    return { agree, other: out.chosen, mine, detail: out.status === "matched" ? (agree ? "the independent answer ends in the same database state" : "the independent answer ends in a different state") : "the providers didn't settle on one answer (" + out.status + ")" };
  }
  const out = await refs.solveOne(item, usage, null);
  const mine = content.runAll(site, data.solution_sql);
  const agree = out.status === "matched" && mine.ok && refs.sameResult(out.chosen.result, mine, SqlCompare.asksForOrder(data.title + " " + data.task)).same;
  return { agree, other: out.chosen, mine, detail: out.status === "matched" ? (agree ? "the independent answer returns the same result" : "the independent answer returns a different result") : "the providers didn't settle on one answer (" + out.status + ")" };
}
const addUsage = (usage) => Object.entries(usage).forEach(([m, u]) => { const x = (cc.usage[m] = cc.usage[m] || { input: 0, output: 0, calls: 0 }); x.input += u.input; x.output += u.output; x.calls += u.calls || 0; });
const preview = (r) => (r && r.columns ? { columns: r.columns, rows: (r.rows || []).slice(0, 8), count: r.count != null ? r.count : (r.rows || []).length } : r && r.changed ? { changed: r.changed } : null);
async function repairDrill(row) {
  const data = JSON.parse(row.data), v = JSON.parse(row.verify);
  const ind = v.checks.find((x) => /Independent/.test(x.label));
  if (!ind || ind.ok) return "kept";
  const usage = {};
  let first;
  try { first = await independentCheck(data.site, data, data.level, usage); } catch { addUsage(usage); return "kept"; }
  let verdict = null, next = data;
  if (!first.agree && first.other && first.other.sql) {
    try {
      verdict = cc.jsonOf((await cc.ask(cc.MODELS.strong, SYSTEM_DRILL_JUDGE, `DATASET (${data.site}):\n${content.schemaText(data.site)}\n\nTASK: ${data.title}\n${data.task}\n\nREFERENCE SOLUTION:\n${data.solution_sql}\nITS RESULT: ${JSON.stringify(preview(first.mine && first.mine.result ? first.mine.result : first.mine))}\n\nINDEPENDENT QUERY:\n${first.other.sql}\nITS RESULT: ${JSON.stringify(preview(first.other.result || first.other))}`, 2000)).text);
    } catch (e) { verdict = null; if (e && /Claude|Anthropic|credit/i.test(e.message)) { addUsage(usage); return flagManual("content_items", row.id, e.message); } }
    if (verdict && verdict.verdict === "ambiguous" && verdict.task) next = { ...data, task: verdict.task };
    else if (verdict && verdict.verdict === "solution_wrong" && verdict.solution_sql) next = { ...data, solution_sql: verdict.solution_sql };
  }
  let result = first;
  if (next !== data) { try { result = await independentCheck(data.site, next, data.level, usage); } catch { result = { agree: false, detail: "check failed" }; } }
  addUsage(usage);
  if (!result.agree) {
    // nothing better: the item stays as it was; the judge's view is added for the reviewer
    if (verdict && verdict.verdict) { ind.detail = first.detail + " — Claude Sonnet: " + verdict.verdict.replace("_", " ") + (verdict.why ? ": " + verdict.why : ""); db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify(v), row.id); }
    return "kept";
  }
  // a changed solution or task is verified again by the normal draft checks before it is kept
  const saved = next === data ? null : await content.saveItemAsync({ id: row.id, kind: "drill", status: "draft", data: next });
  const nv = saved ? saved.verify : v;
  if (nv.status === "fail") { db.prepare("UPDATE content_items SET data = ?, verify = ? WHERE id = ?").run(row.data, row.verify, row.id); return "kept"; }
  nv.checks = nv.checks.filter((x) => !/Independent/.test(x.label)).concat({ ok: true, warn: true, label: "Independent A/B/tie-breaker answer agrees", detail: result.detail + (next === data ? " (on a second run)" : verdict.verdict === "ambiguous" ? " after Claude Sonnet made the task precise" : " after Claude Sonnet fixed the solution") });
  nv.status = nv.checks.some((x) => !x.ok && !x.warn) ? "fail" : nv.checks.some((x) => !x.ok) ? "warn" : "pass";
  nv.repaired = true;
  if (next !== data) nv.rewritten = verdict.verdict === "ambiguous" ? { by: "Claude Sonnet", what: "task", before: data.task, at: now() } : { by: "Claude Sonnet", what: "solution", before: data.solution_sql, at: now() };
  db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify(nv), row.id);
  return "fixed";
}

/** Re-verifies every draft with warnings (flashcards, predict items, stage drills). onProgress(text). */
async function repairWarnings({ onProgress = () => {}, kinds = ["flashcard", "predict", "drill"] } = {}) {
  const tasks = [];
  const res = { flashcard: { fixed: 0, kept: 0 }, predict: { fixed: 0, kept: 0 }, drill: { fixed: 0, kept: 0 } };
  // predict items: the checked-input repair (fixPredictInputs) runs after the others
  if (kinds.includes("flashcard")) for (const r of db.prepare("SELECT * FROM stage_items WHERE kind = 'flashcard' AND status = 'draft' AND json_extract(verify, '$.status') = 'warn' AND json_extract(verify, '$.repaired') IS NULL").all()) tasks.push(["flashcard", () => repairFlashcard(r), "stage_items", r.id]);
  if (kinds.includes("drill")) for (const r of db.prepare("SELECT * FROM content_items WHERE source LIKE 'ai:stage%' AND status = 'draft' AND json_extract(verify, '$.status') = 'warn' AND json_extract(verify, '$.repaired') IS NULL").all()) tasks.push(["drill", () => repairDrill(r), "content_items", r.id]);
  let next = 0, done = 0;
  const worker = async () => { while (next < tasks.length) { const [k, t, table, id] = tasks[next++]; let out = "kept"; try { out = await t(); } catch (e) { console.warn("[repair] " + e.message); }
    // tried and not better: marked, so a later run doesn't pay for it again
    if (out === "kept") { const r = db.prepare("SELECT verify FROM " + table + " WHERE id = ?").get(id); if (r) { const v = JSON.parse(r.verify); v.repaired = "tried"; db.prepare("UPDATE " + table + " SET verify = ? WHERE id = ?").run(JSON.stringify(v), id); } }
    res[k][out]++; done++; if (done % 20 === 0 || done === tasks.length) onProgress(`${done}/${tasks.length} · ${JSON.stringify(res)} · $${cc.cost().toFixed(2)}`); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  if (kinds.includes("predict")) { const p = await fixPredictInputs({ onProgress }); res.predict = { fixed: p.fixed, kept: p.typedOnly, deleted: p.deleted }; }
  return { res, cost: cc.cost() };
}

// ---------- the run ----------
/** Generates everything Part 2 asks for. onProgress(text). */
async function fillGaps({ onProgress = () => {}, levels, stages = ["flashcard", "predict", "practise", "transfer"] } = {}) {
  const batch = "stage-" + now().slice(0, 16);
  const cov = cc.coverage();
  const all = cov.flatMap((L) => L.concepts.map((c) => ({ ...c, levelInfo: L }))).filter((c) => !levels || levels.includes(c.level));
  const tasks = [];
  // resumable: what a concept already has (drafts included) is not made again
  const have = (kind, slug) => db.prepare("SELECT COUNT(*) n FROM stage_items WHERE kind = ? AND concept = ? AND status != 'rejected'").get(kind, slug).n;
  const drillsHave = (slug, stage) => db.prepare("SELECT data FROM content_items WHERE source LIKE 'ai:stage%' AND status != 'rejected'").all().filter((r) => { const d = JSON.parse(r.data); return d.stage === stage && (d.concepts || []).includes(slug); }).length;
  for (const c of all) {
    if (stages.includes("flashcard") && c.level < 14 && have("flashcard", c.slug) < 5) tasks.push(() => flashcardsFor(c, batch, 8));
    if (stages.includes("predict") && have("predict", c.slug) < 2) tasks.push(() => checkedPredictsFor(c, batch, c.level === 14 ? 2 : 3));
    if (stages.includes("practise") && c.level < 14 && c.practise < 3 && c.practise + drillsHave(c.slug, "practise") < 3) tasks.push(() => drillsFor(c, "practise", batch, 3 - c.practise + 1));
    if (stages.includes("transfer") && c.level < 14 && !c.transfer && !drillsHave(c.slug, "transfer")) tasks.push(() => drillsFor(c, "transfer", batch, c.level >= 4 ? 2 : 1));
  }
  let next = 0, done = 0;
  const worker = async () => { while (next < tasks.length) { const t = tasks[next++]; try { await t(); } catch (e) { console.warn("[stage-gen] " + e.message); } done++; if (done % 10 === 0 || done === tasks.length) onProgress(`${done}/${tasks.length} · flashcards ${stats.flashcard.made} (-${stats.flashcard.dropped}) · predict ${stats.predict.made} (-${stats.predict.dropped}) · drills ${stats.drill.made} (-${stats.drill.dropped}) · $${cc.cost().toFixed(2)}`); } };
  await Promise.all([worker(), worker(), worker(), worker()]);
  // new items with warnings get one repair round (fix, run again, second opinion)
  const repaired = await repairWarnings({ onProgress, kinds: stages.map((x) => (x === "practise" || x === "transfer" ? "drill" : x)) });
  return { batch, stats, repaired: repaired.res, cost: cc.cost() };
}
/** A dataset created while the server runs. */
function registerSite(key, site) { SITES[key] = site; }
module.exports = { CARD_SPECS, verifyCard, checkPredictInputs, cardMeta, reviewCard, cleanTable, sortFilterFor, queryOptimizerFor, explainPlan, resultSetFor, joinCompareFor, findDifferenceFor, timelineFor, schemaDetectiveFor, joinMapperFor, compareFor, syntaxUpgradesFor, mcqUpgradesFor, runTables, lessonInFormat, lessonFor, copiedRun, registerSite, seededPredict, saveStage, endStatePredictsFor, endOutcome, ungrounded, applyEdit, verifiedEndState, rewordEndState, moreEndStateChoices, conceptMcqsFor, runPg, verifyCard, independentCheck, verifiedPredict, fixPredictInputs, checkPredictInputs, checkedPredictsFor, repairWarnings, repairPredict, repairFlashcard, repairDrill, fillGaps, flashcardsFor, predictsFor, drillsFor, runScript, siteFor, practiseSites, stats };
