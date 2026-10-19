// Creating items by hand (admin "Create"): every type the app has, through the same checks generated items get, saved
// as "Mine" (source 'mine'), published or kept as a draft, logged in History with Undo, editable later. Also: building a
// dataset from pasted rows, CSV or a CREATE + INSERT script, and CSV / JSON bulk import of exercises, MCQs and flashcards.
const crypto = require("crypto");
const { DatabaseSync } = require("node:sqlite");
const db = require("../db.js");
const content = require("./content.js");
const sg = require("./stage-gen.js");
const writecheck = require("../library/writecheck.js");
const SqlCompare = require("../public/compare.js");
const Cards = require("../public/cards.js");
const { SOURCE_NAME } = require("./lesson-rules.js");
const { datasetSql } = require("./image-rules.js");

const now = () => new Date().toISOString();
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });
const str = (v) => String(v == null ? "" : v).trim();
const list = (v) => (Array.isArray(v) ? v : String(v || "").split(/\n|\|\|/)).map(str).filter(Boolean);

// ---------- the types ----------
const FLASH = { flashcard_keyword: "keyword", flashcard_blank: "blank", flashcard_order: "order", flashcard_error: "error" };
const CARD_TYPES = Object.keys(sg.CARD_SPECS);
const TYPES = [
  { type: "exercise", label: "Exercise / drill", group: "Exercises and questions" },
  { type: "mcq", label: "Multiple choice (MCQ)", group: "Exercises and questions" },
  { type: "predict", label: "Predict the output", group: "Learning stages" },
  { type: "lesson", label: "Study lesson", group: "Learning stages" },
  { type: "flashcard_keyword", label: "Flashcard: keyword", group: "Flashcards" },
  { type: "flashcard_blank", label: "Flashcard: fill in the blank", group: "Flashcards" },
  { type: "flashcard_order", label: "Flashcard: clause order", group: "Flashcards" },
  { type: "flashcard_error", label: "Flashcard: spot the error", group: "Flashcards" },
].concat(CARD_TYPES.map((t) => ({ type: t, label: "Card: " + Cards.TYPES[t].label, group: "Optional cards" })));
const typeOf = (t) => TYPES.find((x) => x.type === t);
const STORE = (t) => (t === "exercise" ? "drill" : t === "mcq" ? "mcq" : "stage");
const STAGE_KIND = (t) => (FLASH[t] ? "flashcard" : t === "predict" ? "predict" : t === "lesson" ? "lesson" : "card");

function conceptRow(slug) { return slug ? db.prepare("SELECT slug, name, level, summary FROM concepts WHERE slug = ?").get(String(slug)) : null; }
function siteOf(dataset) { const d = content.DATASETS[dataset]; return d ? d.site : null; }
function meta() {
  return {
    types: TYPES,
    concepts: db.prepare("SELECT slug, name, level FROM concepts ORDER BY level, ord").all(),
    datasets: Object.entries(content.DATASETS).map(([key, d]) => ({ key, label: d.label })),
    levels: require("../library/library.js").LEVELS.map((L) => ({ n: L.n, title: L.title, topic: content.LEVEL_TOPIC[L.n] })),
    diffs: content.DIFFS,
  };
}

// ---------- checks (no saving): one per type, the same checks generation uses ----------
const add = (checks, ok, label, detail, warn) => checks.push({ ok: !!ok, warn: !!warn, label, detail: detail || "" });
const summarize = (checks) => { const failed = checks.filter((c) => !c.ok && !c.warn).length, warned = checks.filter((c) => !c.ok && c.warn).length; return failed ? "fail" : warned ? "warn" : "pass"; };

/** body: { type, level, concept, stage, diff, dataset, fields: {...}, review }. Returns { type, store, kind, status, checks, data, concept, level, src }. */
async function check(body) {
  const b = body || {}, t = typeOf(b.type);
  if (!t) throw bad("Pick a type");
  const f = b.fields || {}, checks = [];
  const c = conceptRow(b.concept);
  const needsConcept = STORE(b.type) === "stage";
  if (needsConcept) add(checks, !!c, "Concept", c ? c.name : "pick the concept this item teaches");
  else add(checks, !!c, "Concept", c ? c.name : "none: it won't count in the learning model", !c);
  const level = c ? c.level : Number(b.level);
  add(checks, level >= 1 && level <= 14, "Level", level ? "Level " + level : "pick a level");
  if (c && b.level && Number(b.level) !== c.level) add(checks, false, "Level matches the concept", `${c.name} is a Level ${c.level} concept`, true);
  const site = b.dataset ? siteOf(b.dataset) : null;
  if (b.dataset && !site) add(checks, false, "Dataset", "unknown dataset " + b.dataset);
  const out = { type: b.type, store: STORE(b.type), kind: STORE(b.type) === "stage" ? STAGE_KIND(b.type) : STORE(b.type), checks, concept: c ? c.slug : null, level, src: { ...b, review: undefined } };
  const finish = (data) => ({ ...out, data, status: summarize(checks) });
  const needSite = () => { if (!site) add(checks, false, "Dataset", "pick the dataset this item runs on"); return !!site; };

  if (b.type === "exercise") {
    const d = { dataset: b.dataset, level, topic: content.LEVEL_TOPIC[level] || "select", diff: str(b.diff), title: str(f.title), task: str(f.task), solution_sql: str(f.solution_sql), summary: str(f.summary),
      concepts: c ? [c.slug] : undefined, stage: c ? (b.stage === "transfer" ? "transfer" : "practise") : undefined, accepted: list(f.accepted), hints: list(f.hints).slice(0, 3), ordered: !!f.ordered };
    if (!needSite()) return finish(d);
    const clean = content.cleanDrill(d);
    const v = await content.verifyDrillAsync(clean);
    v.checks.forEach((x) => checks.push(x));
    // accepted alternatives: each runs; a different result is allowed but flagged
    const write = content.isWriteDrill(clean);
    let ref = null;
    if (clean.accepted.length) ref = write ? await writecheck.runOnDataset(site, clean.solution_sql).catch((e) => ({ ok: false, error: e.message })) : content.runAll(site, clean.solution_sql);
    for (const [i, alt] of clean.accepted.entries()) {
      if (write) {
        const r = await writecheck.runOnDataset(site, alt).catch((e) => ({ ok: false, error: e.message }));
        if (!r.ok) { add(checks, false, `Alternative answer ${i + 1} runs on MySQL (scratch copy)`, r.error); continue; }
        const same = ref && ref.ok && writecheck.compareRuns({ changed: ref.changed, result: ref.result }, r).same;
        add(checks, same, `Alternative answer ${i + 1} ends in the same state as the solution`, same ? "" : "it ends differently: it will still be accepted", !same);
      } else {
        const r = content.runAll(site, alt);
        if (!r.ok) { add(checks, false, `Alternative answer ${i + 1} runs`, r.error); continue; }
        const same = ref && ref.ok && SqlCompare.compare({ columns: ref.columns, rows: ref.rows }, { columns: r.columns, rows: r.rows }, clean.ordered).ok;
        add(checks, same, `Alternative answer ${i + 1} returns the same result as the solution`, same ? "" : "its result differs: it will still be accepted", !same);
      }
    }
    clean.hints.forEach((h, i) => add(checks, h.length >= 10, `Hint ${i + 1}`, h.length >= 10 ? "" : "write at least a short sentence"));
    if (c && !write && !/\border\s+by\b/i.test(clean.solution_sql) && clean.ordered) add(checks, false, "Order matters", "the solution has no ORDER BY, so the order isn't fixed", true);
    return finish(clean);
  }
  if (b.type === "mcq") {
    const opts = list(f.options).slice(0, 5), answer = Number(f.answer);
    const whyWrong = opts.map((_, i) => (i === answer ? "" : str((f.why_wrong || [])[i])));
    const m = { q: str(f.q), code: str(f.code), options: opts, answer, why: str(f.why), why_wrong: whyWrong, topic: content.LEVEL_TOPIC[level] || "select", diff: str(b.diff), level, check: str(f.check) };
    const clean = content.cleanMcq(m);
    content.verifyMcq(clean).checks.forEach((x) => checks.push(x));
    opts.forEach((o, i) => { if (i !== answer) add(checks, whyWrong[i].length >= 10, `Why ${"ABCDE".charAt(i)} is wrong`, whyWrong[i].length >= 10 ? "" : "explain in a sentence why this option is wrong"); });
    if (c) add(checks, ["memorize", "understand"].includes(b.stage || "understand"), "Stage", b.stage || "understand");
    return finish(clean);
  }
  if (b.type === "predict") {
    if (!needSite()) return finish(null);
    const p = { question: str(f.question) || "What does this query return?", sql: str(f.sql), inputs: (f.inputs || []).map((i) => ({ table: str(i.table), where: str(i.where) })).filter((i) => i.table), mistakes: list(f.mistakes) };
    if (!p.sql || !Cards.isReadOnlySql(p.sql)) { add(checks, false, "The query", "one SELECT is needed"); return finish(null); }
    // each wrong choice must really give a different result from the query and from the others
    const right = await sg.runScript(site, p.sql);
    const seen = right.ok && right.result ? [right.result] : [];
    const mistakes = [];
    for (const [i, m] of p.mistakes.entries()) {
      const r = await sg.runScript(site, m);
      if (!r.ok || !r.result) { add(checks, false, `Wrong choice ${i + 1} runs`, r.ok ? "it returns no table" : r.error); continue; }
      const dup = seen.some((s) => s.columns.length === r.result.columns.length && SqlCompare.compare(s, r.result, Cards.sortsRows(p.sql)).ok);
      add(checks, !dup, `Wrong choice ${i + 1} really gives a different result`, dup ? "it returns the same rows as the answer or another choice" : "");
      if (!dup) { seen.push(r.result); mistakes.push(m); }
    }
    const r = sg.checkPredictInputs(site, { ...p, mistakes }, false);
    if (!r.ok) { add(checks, false, "Rows shown and the real answer", r.why); return finish(null); }
    r.checks.forEach((x) => checks.push(x));
    return finish({ ...r.data, concept: c && c.slug, site });
  }
  if (FLASH[b.type]) {
    const type = FLASH[b.type];
    const card = type === "keyword" ? { type, front: str(f.front), back: str(f.back) }
      : type === "blank" ? { type, prompt: str(f.prompt) || "Fill in the blank", sql: str(f.sql), answer: str(f.answer) }
      : type === "order" ? { type, prompt: str(f.prompt) || "Put the clauses in the right order", parts: list(f.parts) }
      : { type, prompt: str(f.prompt) || "Spot the error", wrong_sql: str(f.wrong_sql), fixed_sql: str(f.fixed_sql), explanation: str(f.explanation) };
    if (type !== "keyword" && !needSite()) return finish(card);
    if (type === "error") add(checks, card.explanation.length >= 10, "Explanation", card.explanation ? "" : "say in a sentence what is wrong");
    const v = await sg.verifyCard(site, card);
    add(checks, v.ok, v.ok ? v.label : "The card's SQL", v.ok ? "" : v.why);
    return finish({ ...card, concept: c && c.slug, site: type === "keyword" ? undefined : site, engine: v.engine || undefined });
  }
  if (b.type === "lesson") {
    if (!needSite()) return finish(null);
    const d = { title: str(f.title) || (c && c.name) || "", what: str(f.what), when: list(f.when), explain: str(f.explain), tip: str(f.tip) };
    add(checks, d.what.length >= 40, "What it is", d.what.length >= 40 ? "" : "a few sentences are needed");
    add(checks, d.when.length >= 1, "When to use it", d.when.length ? "" : "at least one line");
    add(checks, d.tip.length >= 10, "Watch out", d.tip ? "" : "one common mistake or caution");
    const r = await sg.runScript(site, str(f.example_sql));
    add(checks, r.ok && r.result, "The example runs" + (r.engine ? " on " + r.engine : ""), r.ok ? (r.result ? r.result.rows.length + " rows: the result shown is the real one" : "it returns no table: end with a SELECT") : r.error);
    const text = [d.title, d.what, d.when.join(" "), d.explain, d.tip].join(" ");
    add(checks, !SOURCE_NAME.test(text), "Names no source, account or link");
    return finish({ ...d, example: r.ok && r.result ? { sql: str(f.example_sql), engine: r.engine, columns: r.result.columns, rows: r.result.rows } : { sql: str(f.example_sql) }, origin: "mine", concept: c && c.slug, site });
  }
  if (CARD_TYPES.includes(b.type)) {
    if (!c) return finish(null);
    let kase;
    if (b.type === "query_optimizer") { const e = sg.explainPlan(str(f.schema), str(f.index), str(f.query)); kase = e.ok && Cards.usesIndex(e.after, e.index_name) ? "helps" : "no_help"; }
    const spec = sg.CARD_SPECS[b.type](c, kase);
    let v;
    try { v = await spec.verify(cardPayload(b.type, f)); } catch (e) { v = { fail: e.message }; }
    if (v.fail) { add(checks, false, "The card's checks", v.fail); return finish(null); }
    v.checks.forEach((x) => checks.push(x));
    add(checks, true, "Optional practice: not part of mastery or coverage");
    return finish({ ...sg.cardMeta(c, b.type, spec.rules), ...v.data });
  }
  throw bad("Unsupported type");
}
// the form's fields → the shape each card spec reads (tables come as CSV text: first line the column names)
function csvTable(name, text) {
  const rows = parseCsv(String(text || ""));
  if (!rows.length) return null;
  return { name: str(name), columns: rows[0].map(str), rows: rows.slice(1).filter((r) => r.some((v) => str(v) !== "")).map((r) => r.map((v) => (/^null$/i.test(str(v)) ? null : /^-?\d+(\.\d+)?$/.test(str(v)) ? Number(v) : str(v)))) };
}
function cardPayload(type, f) {
  const T = (k) => csvTable(f[k + "_name"], f[k + "_csv"]);
  switch (type) {
    case "join_mapper": return { question: f.question, left: T("left"), right: T("right"), key: { left: f.key_left, right: f.key_right }, join_type: f.join_type, why: f.why };
    case "compare_queries": return { question: f.question, tables: [T("table"), T("table2")].filter(Boolean), query_a: f.query_a, query_b: f.query_b, why: f.why };
    case "result_set": return { question: f.question, table: T("table"), query: f.query, why: f.why };
    case "join_compare": return { question: f.question, left: T("left"), right: T("right"), key: { left: f.key_left, right: f.key_right }, pair: f.pair, why: f.why };
    case "find_difference": return { question: f.question, table: T("table"), query_a: f.query_a, query_b: f.query_b, why: f.why };
    case "exec_timeline": return { question: f.question, script: f.script, check_sql: f.check_sql, ask_step: Number(f.ask_step), why: f.why };
    case "schema_detective": return { question: f.question, table: T("table"), candidates: list(f.candidates), why: f.why };
    case "sort_filter": return { question: f.question, table: T("table"), select: f.select, filters: list(f.filters), sorts: list(f.sorts), answer: { filters: String(f.answer_filters || "").split(/[\s,;]+/).filter(Boolean).map((x) => Number(x) - 1), sort: Number(f.answer_sort) - 1 }, why: f.why };
    case "query_optimizer": return { question: f.question, schema: f.schema, index: f.index, query: f.query, why: f.why };
  }
  return {};
}
/** A small CSV reader: commas, "quoted, values", "" for a quote inside quotes; also tab-separated (pasted from a sheet). */
function parseCsv(text) {
  const t = String(text || "").replace(/\r\n?/g, "\n").trim();
  if (!t) return [];
  const sep = !t.split("\n")[0].includes(",") && t.split("\n")[0].includes("\t") ? "\t" : ",";
  const rows = [];
  let row = [], cur = "", q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) { if (ch === '"' && t[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
    if (ch === '"' && cur === "") { q = true; continue; }
    if (ch === sep) { row.push(cur); cur = ""; continue; }
    if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
    cur += ch;
  }
  row.push(cur); rows.push(row);
  return rows;
}

/** The optional second opinion (DeepSeek, the reviewer): a warning check, never a block. */
async function reviewOf(res) {
  const c = conceptRow(res.concept) || { name: "SQL", summary: "", level: res.level };
  const rv = await sg.reviewCard(c, { type: res.type, item: res.data }, "Check: the item is correct, clear, unambiguous, about the named concept, and doesn't give its answer away.");
  return { ok: rv.ok, warn: true, label: "Second provider (DeepSeek): " + (rv.ok ? "correct and clear" : "has a concern"), detail: rv.ok ? "" : rv.why };
}

// ---------- saving, editing, History ----------
const TABLE = (store) => (store === "stage" ? "stage_items" : "content_items");
function rowOf(id) {
  const s = db.prepare("SELECT * FROM stage_items WHERE id = ?").get(id);
  if (s) return { table: "stage_items", row: s };
  const ci = db.prepare("SELECT * FROM content_items WHERE id = ?").get(id);
  return ci ? { table: "content_items", row: ci } : null;
}
const tagOf = (id) => db.prepare("SELECT * FROM item_tags WHERE key = ?").get("mcq:" + id) || null;
function logMine(id, kind, summary, before, status) {
  return db.prepare("INSERT INTO ref_changes (item_id, kind, summary, batch, before, after_status, at) VALUES (?, ?, ?, NULL, ?, ?, ?)").run(id, kind, summary, JSON.stringify(before), status, now()).lastInsertRowid;
}
const titleOf = (res) => { const d = res.data || {}; return str(d.title || d.q || d.question || d.front || d.prompt || d.select || "").slice(0, 120) || res.type; };
function setTag(id, res, stage) {
  if (res.store !== "mcq") return;
  if (!res.concept) { db.prepare("DELETE FROM item_tags WHERE key = ?").run("mcq:" + id); return; }
  db.prepare("INSERT INTO item_tags (key, kind, level, concepts, stage, status, source, why, updated_at) VALUES (?, 'mcq', ?, ?, ?, 'ok', 'admin', 'created by hand', ?) ON CONFLICT(key) DO UPDATE SET level = excluded.level, concepts = excluded.concepts, stage = excluded.stage, status = 'ok', source = 'admin', updated_at = excluded.updated_at")
    .run("mcq:" + id, res.level, JSON.stringify([res.concept]), stage === "memorize" ? "memorize" : "understand", now());
}
/** Saves a new item ("Mine"). body.publish: true (default) publishes, false keeps it as a draft. A failed check saves nothing. */
async function create(body) {
  const res = await check(body);
  if (body.review) res.checks.push(await reviewOf(res)), (res.status = summarize(res.checks));
  if (res.status === "fail") return { ok: false, ...res };
  const status = body.publish === false ? "draft" : "published";
  const verify = { status: res.status, checks: res.checks, at: now(), src: res.src, mine: true };
  let id;
  if (res.store === "stage") {
    id = (FLASH[res.type] ? "fc" : res.type === "lesson" ? "ls" : res.type === "predict" ? "po" : "cd") + "-" + crypto.randomBytes(5).toString("hex");
    db.prepare("INSERT INTO stage_items (id, kind, concept, level, status, data, verify, source, batch, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'mine', 'mine', ?, ?)")
      .run(id, res.kind, res.concept, res.level, status, JSON.stringify(res.data), JSON.stringify(verify), now(), now());
  } else {
    const saved = await content.saveItemAsync({ kind: res.store, status, data: res.data, source: "mine" });
    id = saved.id;
    db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify(verify), id);
    setTag(id, res, body.stage);
  }
  const change = logMine(id, "mine-create", "created by hand: " + titleOf(res), { __table: TABLE(res.store), id, row: null, tag: null }, status);
  if (res.store !== "stage") require("../library/library.js").build();
  return { ok: true, id, status, change: Number(change), ...res };
}
/** Edits an item (re-checked the same way). The row as it was goes into History, so Undo restores it. */
async function update(id, body) {
  const cur = rowOf(id);
  if (!cur) throw Object.assign(new Error("No such item"), { status: 404 });
  const res = await check(body);
  if (body.review) res.checks.push(await reviewOf(res)), (res.status = summarize(res.checks));
  if (res.status === "fail") return { ok: false, ...res };
  if (TABLE(res.store) !== cur.table) throw bad("An item can't change between a stage item and an exercise / MCQ");
  const status = body.publish === false ? "draft" : body.publish === true ? "published" : cur.row.status;
  const verify = { status: res.status, checks: res.checks, at: now(), src: res.src, mine: cur.row.source === "mine" };
  const before = { __table: cur.table, id, row: cur.row, tag: tagOf(id) };
  if (cur.table === "stage_items") db.prepare("UPDATE stage_items SET kind = ?, concept = ?, level = ?, status = ?, data = ?, verify = ?, updated_at = ? WHERE id = ?").run(res.kind, res.concept, res.level, status, JSON.stringify(res.data), JSON.stringify(verify), now(), id);
  else { await content.saveItemAsync({ id, kind: res.store, status, data: res.data }); db.prepare("UPDATE content_items SET verify = ? WHERE id = ?").run(JSON.stringify(verify), id); setTag(id, res, body.stage); }
  const change = logMine(id, "mine-edit", "edited by hand: " + titleOf(res), before, status);
  if (cur.table === "content_items") require("../library/library.js").build();
  return { ok: true, id, status, change: Number(change), ...res };
}
/** Undo for History (library/refs.js): a create removes the item, an edit puts the row (and its tag) back. */
function undoMine(ch) {
  const b = JSON.parse(ch.before);
  if (!["stage_items", "content_items"].includes(b.__table)) throw new Error("Unknown table in the change log");
  if (ch.kind === "mine-create") { db.prepare(`DELETE FROM ${b.__table} WHERE id = ?`).run(b.id); db.prepare("DELETE FROM item_tags WHERE key = ?").run("mcq:" + b.id); return "removed"; }
  const cols = Object.keys(b.row);
  db.prepare(`INSERT OR REPLACE INTO ${b.__table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`).run(...cols.map((k) => b.row[k]));
  db.prepare("DELETE FROM item_tags WHERE key = ?").run("mcq:" + b.id);
  if (b.tag) { const tc = Object.keys(b.tag); db.prepare(`INSERT INTO item_tags (${tc.join(", ")}) VALUES (${tc.map(() => "?").join(", ")})`).run(...tc.map((k) => b.tag[k])); }
  return b.row.status;
}
/** An item loaded back into the form: the fields it was made from ("Mine" items), else what its data gives. */
function load(id) {
  const cur = rowOf(id);
  if (!cur) throw Object.assign(new Error("No such item"), { status: 404 });
  const v = JSON.parse(cur.row.verify || "{}"), d = JSON.parse(cur.row.data);
  if (v.src && v.src.type) return { id, status: cur.row.status, mine: cur.row.source === "mine", form: v.src };
  // an item made elsewhere (generated, imported): the fields its data maps to
  const dsOf = (site) => (Object.entries(content.DATASETS).find(([, x]) => x.site === site) || [])[0] || "";
  let type, fields = {};
  if (cur.table === "content_items" && cur.row.kind === "drill") { type = "exercise"; fields = { title: d.title, task: d.task, solution_sql: d.solution_sql, summary: d.summary, accepted: (d.accepted || []).join("\n"), hints: (d.hints || []).join("\n"), ordered: !!d.ordered }; }
  else if (cur.table === "content_items") { type = "mcq"; fields = { q: d.q, code: d.code, options: (d.options || []).join("\n"), answer: d.answer, why: d.why, why_wrong: d.why_wrong || [], check: d.check }; }
  else if (cur.row.kind === "flashcard") { type = "flashcard_" + d.type; fields = { ...d, parts: (d.parts || []).join("\n") }; }
  else if (cur.row.kind === "lesson") { type = "lesson"; fields = { title: d.title, what: d.what, when: (d.when || []).join("\n"), example_sql: d.example && d.example.sql, explain: d.explain, tip: d.tip }; }
  else if (cur.row.kind === "predict" && !d.variant) { type = "predict"; fields = { question: d.question, sql: d.sql, inputs: (d.shows || (d.show ? [d.show] : [])).map((s) => ({ table: s.table || "", where: s.where || "" })), mistakes: "" }; }
  else throw bad("This item can't be edited in the form (" + (d.card_type || d.variant || cur.row.kind) + "): edit it in the review queue");
  return { id, status: cur.row.status, mine: cur.row.source === "mine", form: { type, level: cur.row.level || d.level, concept: cur.row.concept || (d.concepts || [])[0] || "", stage: d.stage || "", diff: d.diff || "", dataset: d.dataset || dsOf(d.site), fields } };
}

// ---------- datasets: pasted rows, CSV, or a CREATE + INSERT script ----------
/** body: { mode: "tables" | "script", tables: [{ name, csv }], script }. Returns { sql, tables, checks } (nothing saved). */
async function datasetPreview(body) {
  const imageGen = require("./image-gen.js");
  if ((body || {}).mode === "script") {
    const sql = str(body.script);
    const stmts = require("../course/split-sql.js").splitSql(sql);
    const bad1 = stmts.map(str).filter(Boolean).find((s) => !/^(CREATE\s+TABLE|INSERT\s+INTO)\b/i.test(s));
    if (bad1) throw bad("Only CREATE TABLE and INSERT INTO statements: " + bad1.slice(0, 80));
    let plan;
    try {
      const m = new DatabaseSync(":memory:"); m.exec(sql);
      plan = m.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((t) => ({ name: t.name, rows: m.prepare(`SELECT COUNT(*) n FROM "${t.name}"`).get().n, columns: m.prepare(`SELECT name FROM pragma_table_info('${t.name}')`).all().map((x) => x.name) }));
      m.close();
    } catch (e) { throw bad("The script doesn't run on SQLite: " + e.message); }
    if (!plan.length) throw bad("The script creates no table");
    const empty = plan.filter((t) => !t.rows);
    if (empty.length) throw bad("No rows in " + empty.map((t) => t.name).join(", ") + ": add INSERT statements");
    return { sql, tables: plan, checks: await imageGen.verifyDataset(sql, plan) };
  }
  const tables = ((body || {}).tables || []).map((t) => csvTable(t.name, t.csv)).filter((t) => t && t.name && t.columns.length);
  if (!tables.length) throw bad("Add at least one table: a name and its rows (the first line holds the column names)");
  const empty = tables.filter((t) => !t.rows.length);
  if (empty.length) throw bad("No data rows in " + empty.map((t) => t.name).join(", "));
  const { sql, plan } = datasetSql(tables);
  return { sql, tables: plan, checks: await imageGen.verifyDataset(sql, plan) };
}
/** Saves a dataset once every check passes (SQLite, MySQL scratch, PostgreSQL rolled back). */
async function datasetCreate(body) {
  const label = str((body || {}).label);
  if (!label) throw bad("Name the dataset");
  const p = await datasetPreview(body);
  if (p.checks.some((c) => !c.ok)) return { ok: false, ...p };
  const ds = require("./image-gen.js").registerDataset(p.tables, p.sql, label, "mine");
  require("../library/library.js").build();
  return { ok: true, ...ds, ...p };
}

// ---------- bulk import: exercises, MCQs and flashcards, through the same checks ----------
function importRow(kind, raw, defaults) {
  const value = (...names) => { for (const n of names) for (const k of Object.keys(raw)) if (k.trim().toLowerCase() === n) return raw[k]; return ""; };
  const get = (...names) => str(value(...names));
  const getList = (...names) => { const v = value(...names); return Array.isArray(v) ? v.map(str).filter(Boolean) : list(v); };
  const base = { level: Number(get("level")) || Number(defaults.level) || 0, concept: get("concept") || defaults.concept || "", stage: get("stage").toLowerCase() || defaults.stage || "", diff: (get("difficulty", "diff") || defaults.diff || "").toLowerCase(), dataset: get("dataset") || defaults.dataset || "" };
  if (kind === "exercise") return { ...base, type: "exercise", fields: { title: get("title"), task: get("task", "prompt", "question"), solution_sql: get("solution", "solution_sql"), accepted: getList("accepted"), hints: getList("hints"), ordered: /^(1|yes|true|y)$/i.test(get("ordered", "order matters")) } };
  if (FLASH[kind]) {
    const type = FLASH[kind];
    const fields = type === "keyword" ? { front: get("front", "question", "keyword"), back: get("back", "answer", "explanation") }
      : type === "blank" ? { prompt: get("prompt", "question"), sql: get("sql", "solution"), answer: get("answer") }
      : type === "order" ? { prompt: get("prompt", "question"), parts: getList("parts", "clauses") }
      : { prompt: get("prompt", "question"), wrong_sql: get("wrong_sql", "wrong"), fixed_sql: get("fixed_sql", "fixed", "solution"), explanation: get("explanation", "why") };
    return { ...base, type: kind, fields };
  }
  const letters = ["a", "b", "c", "d", "e"];
  const options = get("options") ? list(get("options")) : letters.map((l) => get("option_" + l, "option " + l, l)).filter(Boolean);
  const ans = get("answer"), answer = /^[a-e]$/i.test(ans) ? letters.indexOf(ans.toLowerCase()) : Number(ans) - 1;
  return { ...base, type: "mcq", fields: { q: get("question", "q"), code: get("code"), options, answer, why: get("why", "explanation"), why_wrong: letters.map((l) => get("why_wrong_" + l, "why not " + l)) } };
}
async function importPreview(body) {
  const b = body || {}, allowed = ["exercise", "mcq", ...Object.keys(FLASH)], kind = allowed.includes(b.kind) ? b.kind : "exercise";
  if (!Array.isArray(b.rows) || !b.rows.length) throw bad("No rows to import");
  if (b.rows.length > 200) throw bad("Import at most 200 rows at a time");
  const out = [];
  for (const [k, raw] of b.rows.entries()) {
    const body1 = importRow(kind, raw, b.defaults || {});
    let r;
    try { r = await check(body1); } catch (e) { r = { status: "fail", checks: [{ ok: false, label: "Row", detail: e.message }] }; }
    out.push({ row: k + 1, body: body1, status: r.status, title: r.data ? titleOf(r) : body1.fields.title || body1.fields.q || body1.fields.front || body1.fields.prompt || kind, failed: r.checks.filter((c) => !c.ok).map((c) => (c.warn ? "warning: " : "") + c.label + (c.detail ? ": " + c.detail : "")) });
  }
  return { kind, rows: out, pass: out.filter((x) => x.status === "pass").length, warn: out.filter((x) => x.status === "warn").length, fail: out.filter((x) => x.status === "fail").length };
}
/** Saves the rows that pass (warnings included): published, or drafts when publish is false. Failing rows are skipped. */
async function importCommit(body) {
  const p = await importPreview(body);
  const saved = [];
  for (const r of p.rows) if (r.status !== "fail") { const s = await create({ ...r.body, publish: body.publish !== false }); if (s.ok) saved.push(s.id); }
  return { ...p, saved: saved.length, ids: saved };
}

module.exports = { TYPES, meta, check, create, update, load, undoMine, datasetPreview, datasetCreate, importPreview, importCommit, parseCsv, csvTable, cardPayload };
