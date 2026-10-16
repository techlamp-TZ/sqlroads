// Learn (the guided path): course order, "lesson read" without any effect on mastery, and quick-check mistakes in
// Review mistakes with the usual 1 / 3 / 7-day steps. The /api/learn routes run on a temporary copy of the database.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const SRC = path.join(__dirname, "..", "data.sqlite");
const DBF = path.join(os.tmpdir(), "sqldrills-learn-test-" + process.pid + ".sqlite");
{ const s = new DatabaseSync(SRC, { readOnly: true }); s.exec(`VACUUM INTO '${DBF.replace(/\\/g, "/").replace(/'/g, "''")}'`); s.close(); }
process.env.SQLDRILLS_DB = DBF;
const db = require("../db.js");
const lib = require("../library/library.js");
lib.build();
const learn = require("../library/learn.js");
const express = require("express");

let server, base;
test.before(async () => {
  const app = express(); app.use(express.json()); app.use("/api/learn", learn.router);
  app.get("/api/library/review", (req, res) => res.json(lib.reviewList()));
  await new Promise((r) => { server = app.listen(0, "127.0.0.1", r); });
  base = "http://127.0.0.1:" + server.address().port + "/api/learn";
});
test.after(() => { server.close(); db.close(); for (const f of [DBF, DBF + "-wal", DBF + "-shm"]) fs.rmSync(f, { force: true }); });
const get = async (p) => (await fetch(base + p)).json();
const post = async (p, b) => { const r = await fetch(base + p, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b || {}) }); return { status: r.status, body: await r.json() }; };

test("the path lists every concept once, in course order (level, then position), with what each has", async () => {
  const p = await get("/path");
  const flat = p.levels.flatMap((L) => L.concepts.map((c) => ({ ...c, level: L.n })));
  const want = db.prepare("SELECT slug FROM concepts ORDER BY level, ord").all().map((r) => r.slug);
  assert.deepStrictEqual(flat.map((c) => c.slug), want);
  assert.strictEqual(p.total, want.length);
  assert.ok(flat.every((c) => typeof c.lesson === "boolean" && typeof c.checks === "number"));
});

test("finishing a step marks the lesson read, and nothing about mastery or the daily goal changes", async () => {
  const slug = db.prepare("SELECT slug FROM concepts ORDER BY level, ord LIMIT 1").get().slug;
  // the copy holds the learner's real progress: start this test from no lesson read
  db.prepare("DELETE FROM lesson_read").run();
  const before = await get("/concept/" + slug), ev0 = db.prepare("SELECT COUNT(*) n FROM learn_events").get().n;
  assert.strictEqual(before.lessonRead, false);
  assert.strictEqual((await post("/lesson/" + slug + "/read")).status, 200);
  const after = await get("/concept/" + slug);
  assert.strictEqual(after.lessonRead, true);
  assert.deepStrictEqual(after.stages, before.stages, "stage status unchanged");
  assert.strictEqual(after.mastered, before.mastered);
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM learn_events").get().n, ev0, "no daily-goal event");
  assert.strictEqual((await get("/path")).read, 1);
  assert.strictEqual((await post("/lesson/no-such-concept/read")).status, 404);
});

test("a wrong quick-check answer goes into Review mistakes; a right one when due moves it on", async () => {
  const po = db.prepare("SELECT id, concept FROM stage_items WHERE kind = 'predict' AND status = 'published' LIMIT 1").get();
  assert.strictEqual((await post("/quickcheck", { kind: "predict", ref: po.id, correct: false })).status, 200);
  const row = db.prepare("SELECT * FROM review_queue WHERE item_id = ?").get("qc:predict:" + po.id);
  assert.strictEqual(row.stage, 1);
  const info = learn.qcInfo("qc:predict:" + po.id);
  assert.strictEqual(info.concept, po.concept);
  assert.strictEqual(info.href, "#/learn/" + po.concept + "?s=3");
  assert.ok(lib.reviewList(Date.now() + 2 * 864e5).due.some((e) => e.id === "qc:predict:" + po.id), "listed in Review mistakes when due");
  // answered right once it is due: the next step (3 days)
  db.prepare("UPDATE review_queue SET due_at = ? WHERE item_id = ?").run(new Date(Date.now() - 1000).toISOString(), "qc:predict:" + po.id);
  await post("/quickcheck", { kind: "predict", ref: po.id, correct: true });
  assert.strictEqual(db.prepare("SELECT stage FROM review_queue WHERE item_id = ?").get("qc:predict:" + po.id).stage, 2);
  // unknown questions and kinds are refused
  assert.strictEqual((await post("/quickcheck", { kind: "predict", ref: "po-nope", correct: false })).status, 404);
  assert.strictEqual((await post("/quickcheck", { kind: "drill", ref: po.id })).status, 400);
  // the learning reset clears the path and the quick-check reviews
  learn.resetLearning();
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM review_queue WHERE item_id LIKE 'qc:%'").get().n, 0);
  assert.strictEqual((await get("/path")).read, 0);
});
