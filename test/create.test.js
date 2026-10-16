// Manual creation (admin/create.js): each type goes through the same checks as generated items; a failing item is not
// saved; a saved item is "Mine", logged in History, and Undo removes it (create) or restores it (edit). Runs on a
// temporary copy of the database (VACUUM INTO): no real data is touched. SQLite-only checks (no MySQL / PostgreSQL).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const SRC = path.join(__dirname, "..", "data.sqlite");
const DBF = path.join(os.tmpdir(), "sqldrills-create-test-" + process.pid + ".sqlite");
{ const s = new DatabaseSync(SRC, { readOnly: true }); s.exec(`VACUUM INTO '${DBF.replace(/\\/g, "/").replace(/'/g, "''")}'`); s.close(); }
process.env.SQLDRILLS_DB = DBF;
const db = require("../db.js");
require("../library/library.js").build();
const content = require("../admin/content.js");
const create = require("../admin/create.js");
const refs = require("../library/refs.js");

test.after(() => { db.close(); for (const f of [DBF, DBF + "-wal", DBF + "-shm"]) fs.rmSync(f, { force: true }); });

// a real published predict item gives a dataset, a concept and a query that pass the checks
const po = db.prepare("SELECT concept, data FROM stage_items WHERE kind = 'predict' AND status = 'published' AND json_extract(data, '$.variant') IS NULL AND json_extract(data, '$.shows') IS NOT NULL LIMIT 1").get();
const P = JSON.parse(po.data);
const DS = Object.entries(content.DATASETS).find(([, d]) => d.site === P.site)[0];
const C = db.prepare("SELECT slug, level FROM concepts WHERE slug = ?").get(po.concept);
const table = P.shows[0].table;
const ok = (r) => r.status !== "fail";
const failed = (r) => r.checks.filter((c) => !c.ok && !c.warn).map((c) => c.label + ": " + c.detail).join(" | ");

test("exercise: the solution really runs; an alternative with another result is flagged; a broken solution fails", async () => {
  const base = { type: "exercise", concept: C.slug, stage: "practise", diff: "easy", dataset: DS };
  const r = await create.check({ ...base, fields: { title: "Rows of " + table + " by hand", task: "List every column of every row in the " + table + " table, as stored.", solution_sql: `SELECT * FROM ${table}`, accepted: `SELECT * FROM ${table} WHERE 1 = 0`, hints: "Use SELECT * to read every column." } });
  assert.ok(ok(r), failed(r));
  assert.ok(r.checks.some((c) => /Alternative answer 1 returns the same result/.test(c.label) && !c.ok && c.warn), "a different alternative is a warning");
  assert.deepStrictEqual(r.data.hints, ["Use SELECT * to read every column."]);
  const bad = await create.check({ ...base, fields: { title: "Broken by hand", task: "This exercise's solution names a table that doesn't exist at all.", solution_sql: "SELECT * FROM no_such_table_xyz" } });
  assert.strictEqual(bad.status, "fail");
});

test("MCQ: 2-5 options, the right one chosen, and why each wrong option is wrong (required)", async () => {
  const f = { q: "Which clause filters rows before grouping?", options: "WHERE\nHAVING\nORDER BY\nLIMIT\nGROUP BY", answer: 0, why: "WHERE filters rows before they are grouped.", why_wrong: ["", "HAVING filters groups, after grouping.", "ORDER BY only sorts the rows.", "LIMIT only cuts the number of rows.", "GROUP BY forms groups; it doesn't filter."] };
  const r = await create.check({ type: "mcq", concept: C.slug, stage: "understand", diff: "easy", fields: f });
  assert.ok(ok(r), failed(r));
  assert.strictEqual(r.data.options.length, 5);
  const missing = await create.check({ type: "mcq", concept: C.slug, diff: "easy", fields: { ...f, why_wrong: ["", "", "", "", ""] } });
  assert.strictEqual(missing.status, "fail", "a wrong option without its why fails");
});

test("predict: the shown rows and the answer come from real runs; a wrong choice with the same result fails", async () => {
  const inputs = P.shows.map((s) => ({ table: s.table, where: s.where }));
  const r = await create.check({ type: "predict", concept: C.slug, dataset: DS, fields: { question: "What does it return?", sql: P.sql, inputs } });
  assert.ok(ok(r), failed(r));
  assert.deepStrictEqual(r.data.answer.columns, P.answer.columns);
  const same = await create.check({ type: "predict", concept: C.slug, dataset: DS, fields: { question: "What does it return?", sql: P.sql, inputs, mistakes: P.sql } });
  assert.strictEqual(same.status, "fail", "a 'wrong' choice that returns the answer fails");
});

test("flashcards and a lesson run their SQL; a blank card without exactly one ___ fails", async () => {
  const blank = await create.check({ type: "flashcard_blank", concept: C.slug, dataset: DS, fields: { sql: `SELECT * ___ ${table}`, answer: "FROM" } });
  assert.ok(ok(blank), failed(blank));
  const two = await create.check({ type: "flashcard_blank", concept: C.slug, dataset: DS, fields: { sql: `SELECT ___ ___ ${table}`, answer: "* FROM" } });
  assert.strictEqual(two.status, "fail");
  const lesson = await create.check({ type: "lesson", concept: C.slug, dataset: DS, fields: { title: "Reading a table", what: "SELECT reads rows from a table. The star means every column, in the order the table defines them.", when: "Looking at a table for the first time", example_sql: `SELECT * FROM ${table} LIMIT 3`, tip: "List only the columns you need in real queries." } });
  assert.ok(ok(lesson), failed(lesson));
  assert.ok(lesson.data.example.rows.length > 0 && lesson.data.example.columns.length > 0, "the example's result is the real one");
});

test("cards: the generators' own specs check them (result set, sort and filter, schema detective, query optimizer)", async () => {
  const t = "id,name,dept,salary\n1,Ann,hr,50\n2,Bo,it,70\n3,Cy,it,60\n4,Di,hr,80\n5,Ed,ops,40\n6,Flo,it,90";
  const rs = await create.check({ type: "result_set", concept: C.slug, fields: { question: "Which rows does it return?", table_name: "staff", table_csv: t, query: "SELECT * FROM staff WHERE dept = 'it'" } });
  assert.ok(ok(rs), failed(rs));
  assert.deepStrictEqual(rs.data.answer_ids.sort(), ["2", "3", "6"]);
  const sf = await create.check({ type: "sort_filter", concept: C.slug, fields: { question: "IT staff, best paid first.", table_name: "staff", table_csv: t, select: "name, salary", filters: "dept = 'it'\ndept = 'hr'\nsalary > 60", sorts: "salary DESC\nsalary ASC\nname", answer_filters: "1", answer_sort: "1" } });
  assert.ok(ok(sf), failed(sf));
  const sd = await create.check({ type: "schema_detective", concept: C.slug, fields: { question: "Which column identifies each row?", table_name: "staff", table_csv: t.replace("6,Flo,it,90", "6,Flo,it,90\n7,Ann,ops,55"), candidates: "id\nname\ndept" } });
  assert.ok(ok(sd), failed(sd));
  assert.strictEqual(sd.data.key, "id");
  const qo = await create.check({ type: "query_optimizer", concept: C.slug, fields: { question: "How does SQLite run it?", schema: "CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INT, note TEXT)", index: "CREATE INDEX idx_note ON orders (note)", query: "SELECT * FROM orders WHERE note LIKE '%late%'", why: "A leading wildcard can't use the index on note." } });
  assert.ok(ok(qo), failed(qo));
  assert.strictEqual(qo.data.helps, false, "the real plan decides the case: the index isn't used here");
  const bad = await create.check({ type: "result_set", concept: C.slug, fields: { question: "Which rows?", table_name: "staff", table_csv: t, query: "SELECT * FROM staff" } });
  assert.strictEqual(bad.status, "fail", "a query returning every row fails the card's own rule");
});

test("saving: a failing item saves nothing; a saved one is Mine, in History, and Undo removes it; an edit is undone back", async () => {
  const n0 = db.prepare("SELECT COUNT(*) n FROM stage_items").get().n;
  const failing = await create.create({ type: "flashcard_keyword", concept: C.slug, fields: { front: "", back: "" } });
  assert.strictEqual(failing.ok, false);
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM stage_items").get().n, n0);
  const made = await create.create({ type: "flashcard_keyword", concept: C.slug, fields: { front: "WHERE", back: "Keeps only the rows that match a condition." } });
  assert.ok(made.ok, failed(made));
  const row = db.prepare("SELECT source, status, kind FROM stage_items WHERE id = ?").get(made.id);
  assert.deepStrictEqual({ ...row }, { source: "mine", status: "published", kind: "flashcard" });
  // edit → undo restores the first version
  const ed = await create.update(made.id, { type: "flashcard_keyword", concept: C.slug, fields: { front: "WHERE", back: "Filters rows by a condition, before grouping." } });
  assert.ok(ed.ok);
  assert.match(db.prepare("SELECT data FROM stage_items WHERE id = ?").get(made.id).data, /before grouping/);
  refs.undoOne(ed.change);
  assert.match(db.prepare("SELECT data FROM stage_items WHERE id = ?").get(made.id).data, /Keeps only the rows/);
  // the History list shows it; undoing the create removes the item
  assert.ok(refs.changeList(50).some((c) => c.id === made.change && /Mine/.test(c.label)));
  refs.undoOne(made.change);
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM stage_items WHERE id = ?").get(made.id).n, 0);
  // a draft stays a draft; an MCQ gets its concept tag
  const mcq = await create.create({ type: "mcq", concept: C.slug, stage: "memorize", diff: "easy", publish: false, fields: { q: "Which keyword removes duplicate rows?", options: "DISTINCT\nUNIQUE", answer: 0, why: "SELECT DISTINCT returns each distinct row once.", why_wrong: ["", "UNIQUE is a constraint, not part of SELECT."] } });
  assert.ok(mcq.ok, failed(mcq));
  assert.strictEqual(db.prepare("SELECT status, source FROM content_items WHERE id = ?").get(mcq.id).status, "draft");
  assert.strictEqual(db.prepare("SELECT stage FROM item_tags WHERE key = ?").get("mcq:" + mcq.id).stage, "memorize");
  refs.undoOne(mcq.change);
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM item_tags WHERE key = ?").get("mcq:" + mcq.id).n, 0);
});

test("import: rows go through the same checks, with a pass / fail summary before anything is saved", async () => {
  const rows = [
    { title: "Every row by import", task: "Show every column of every row of the " + table + " table.", solution: `SELECT * FROM ${table}`, level: C.level, difficulty: "easy", dataset: DS, concept: C.slug },
    { title: "Broken by import", task: "This one names a missing table, so it must fail the checks.", solution: "SELECT * FROM nope_xyz", level: C.level, difficulty: "easy", dataset: DS },
  ];
  const n0 = db.prepare("SELECT COUNT(*) n FROM content_items").get().n;
  const p = await create.importPreview({ kind: "exercise", rows });
  assert.deepStrictEqual([p.rows[0].status !== "fail", p.rows[1].status], [true, "fail"]);
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM content_items").get().n, n0, "a preview saves nothing");
  const mq = await create.importPreview({ kind: "mcq", rows: [{ question: "Which clause sorts rows?", option_a: "ORDER BY", option_b: "GROUP BY", option_c: "WHERE", answer: "A", why: "ORDER BY sorts the result.", why_wrong_b: "GROUP BY forms groups.", why_wrong_c: "WHERE filters rows.", level: 3, difficulty: "easy" }] });
  assert.notStrictEqual(mq.rows[0].status, "fail", mq.rows[0].failed.join(" | "));
});

test("datasets: CSV / pasted rows become portable SQL; a script may only CREATE TABLE and INSERT", async () => {
  const p = await create.datasetPreview({ mode: "tables", tables: [{ name: "pets", csv: "id,name,kind\n1,Rex,dog\n2,Tom,cat" }] });
  assert.match(p.sql, /CREATE TABLE pets/);
  assert.ok(p.checks.find((c) => /SQLite/.test(c.label)).ok, "runs on SQLite with every row");
  await assert.rejects(create.datasetPreview({ mode: "script", script: "CREATE TABLE a (x INT); DROP TABLE a;" }), /Only CREATE TABLE and INSERT/);
  assert.deepStrictEqual(create.parseCsv('a,b\n"x, y",2'), [["a", "b"], ["x, y", "2"]]);
});
