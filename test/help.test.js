// How to use and Docs: every {{number}} in the guides comes from /api/help/numbers (none left empty), each "?" link
// opens a section that exists, the engine table is complete, and Docs serves every concept's lesson. Runs on a
// temporary copy of the database (no real data touched).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const Help = require("../public/help.js");

const SRC = path.join(__dirname, "..", "data.sqlite");
const DBF = path.join(os.tmpdir(), "sqldrills-help-test-" + process.pid + ".sqlite");
{ const s = new DatabaseSync(SRC, { readOnly: true }); s.exec(`VACUUM INTO '${DBF.replace(/\\/g, "/").replace(/'/g, "''")}'`); s.close(); }
process.env.SQLDRILLS_DB = DBF;
const db = require("../db.js");
require("../library/library.js").build();
test.after(() => { db.close(); for (const f of [DBF, DBF + "-wal", DBF + "-shm"]) fs.rmSync(f, { force: true }); });

test("every number in both guides comes from the API: no token without a value, no number typed in the text", () => {
  const nums = require("../library/help-numbers.js").helpNumbers();
  const missing = Help.tokens().filter((t) => nums[t] == null || nums[t] === "");
  assert.deepStrictEqual(missing, []);
  assert.strictEqual(nums.concepts, db.prepare("SELECT COUNT(*) n FROM concepts").get().n);
  assert.strictEqual(nums.intervals, "1, 3, 7 and 14");
  assert.strictEqual(nums.review_days, "1, 3 and 7");
  // apart from tokens, the guide text holds no digits (rule numbers live in the code)
  for (const s of Help.LEARNER.concat(Help.ADMIN)) {
    const bare = s.text.replace(/\{\{\w+\}\}/g, "").replace(/\.env/g, "");
    assert.ok(!/\d/.test(bare), s.id + " has a typed number: " + (bare.match(/.{0,20}\d.{0,20}/) || [""])[0]);
  }
  const html = Help.textHtml("A **b** `c`\n- one\n- two\nEnd {{concepts}}", nums);
  assert.match(html, /<b>b<\/b> <code>c<\/code>/);
  // the number may carry thousands separators ("15,173", "15 173"); it is still one whole number from the API
  assert.match(html, /<ul><li>one<\/li><li>two<\/li><\/ul><p>End \d{1,3}(?:[,.   ]\d{3})*<\/p>/);
});

test("each page's '?' opens a section that exists; section ids are unique; every section has a title and text", () => {
  const ids = { learner: Help.LEARNER.map((s) => s.id), admin: Help.ADMIN.map((s) => s.id) };
  for (const g of ["learner", "admin"]) {
    assert.strictEqual(new Set(ids[g]).size, ids[g].length, g + " ids unique");
    for (const [route, sec] of Object.entries(Help.ROUTE_HELP[g])) assert.ok(ids[g].includes(sec), g + " " + route + " → " + sec);
  }
  for (const s of Help.LEARNER.concat(Help.ADMIN)) assert.ok(s.title && s.text.length > 40, s.id);
});

test("the engine table: every row names the task and all three engines", () => {
  assert.ok(Help.DIFFS.length >= 12);
  for (const r of Help.DIFFS) assert.ok(r.length === 4 && r.every((x) => String(x).trim()), r[0]);
});

test("Docs serves every concept with its lesson, keywords and a dataset to run the example on", async () => {
  const learn = require("../library/learn.js"), express = require("express");
  const app = express(); app.use(express.json()); app.use("/api/learn", learn.router);
  const server = await new Promise((r) => { const s = app.listen(0, "127.0.0.1", () => r(s)); });
  try {
    const base = "http://127.0.0.1:" + server.address().port + "/api/learn";
    const docs = await (await fetch(base + "/docs")).json();
    assert.strictEqual(docs.length, db.prepare("SELECT COUNT(*) n FROM concepts").get().n);
    const withLesson = docs.filter((d) => d.lesson);
    assert.strictEqual(withLesson.length, db.prepare("SELECT COUNT(DISTINCT concept) n FROM stage_items WHERE kind = 'lesson' AND status = 'published'").get().n);
    assert.ok(withLesson.filter((d) => d.lesson.example && (!d.lesson.example.engine || d.lesson.example.engine === "SQLite")).every((d) => d.lesson.dataset), "browser examples know their dataset");
    assert.ok(docs.every((d) => Array.isArray(d.keywords)));
    const r = await fetch(base + "/docs/run", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug: "no-such-concept", sql: "SELECT 1" }) });
    assert.strictEqual(r.status, 404);
  } finally { server.close(); }
});
