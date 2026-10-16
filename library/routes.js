// HTTP API for the unified library (used by the learner app). Course and SQL Exercises items
// run through the server's MySQL/PostgreSQL checker; the source never leaves the server.
const express = require("express");
const db = require("../db.js");
const lib = require("./library.js");
const { checkExercise, runCleanup, runPrerequisites, runForLearner, ping } = require("../course/check.js");

const router = express.Router();
const isLoopback = (req) => /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(req.socket.remoteAddress || "");
const localOnly = (req, res, next) => (isLoopback(req) ? next() : res.status(403).json({ error: "Only available on the computer running SQL Drills." }));
const exerciseByRef = (ref) => db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(ref);
const getExercise = (track, code) => db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(`${track}:${code}`);
const dialectOf = (req) => ((req.body && req.body.dialect) || req.query.dialect) === "postgres" ? "postgres" : "mysql";
const setDone = (key, done) =>
  db.prepare("INSERT INTO progress (qid, done, updated_at) VALUES (?, ?, ?) ON CONFLICT(qid) DO UPDATE SET done = excluded.done, updated_at = excluded.updated_at")
    .run(key, done ? 1 : 0, new Date().toISOString());

// MySQL / PostgreSQL not running: a clear message instead of a driver error
const ENGINE = {
  mysql: { name: "MySQL", service: "MySQL80" },
  postgres: { name: "PostgreSQL", service: "postgresql-x64-18" },
};
const isOffline = (e) => /ECONNREFUSED|ETIMEDOUT|EHOSTUNREACH|ENOTFOUND|ECONNRESET|PROTOCOL_CONNECTION_LOST|57P03|the database system is (starting|shutting)/i.test(`${e && e.code} ${e && e.message} ${e && e.errors ? e.errors.map((x) => x.code).join(" ") : ""}`);
function offlineBody(dialect) {
  const e = ENGINE[dialect];
  return {
    ok: false, offline: true, engine: e.name, error: "Database server is offline",
    message: `${e.name} isn't running on this computer, so this exercise can't be run or checked right now. Start the ${e.service} service (Windows Services, or "net start ${e.service}" in an administrator terminal), then try again. Exercises that run in your browser still work.`,
  };
}
const failed = (req, res, e, fallback) => (isOffline(e) ? res.status(503).json(offlineBody(dialectOf(req))) : res.status(500).json(fallback(e)));

const { ensureSetups, forgetSetups } = require("./setup.js");
const TRACKS_OF = { coursemysql: ["mysql"], coursepg: ["postgres"], exmysql: ["ex-mysql"], expg: ["ex-postgres"] };

function courseExercise(req, res) {
  const ref = lib.courseRef(req.params.id, dialectOf(req));
  const ex = ref && exerciseByRef(ref);
  if (!ex) {
    res.status(404).json({ error: "No such exercise" });
    return null;
  }
  return ex;
}

router.get("/", (req, res) => res.json(lib.publicList()));
router.get("/levels", (req, res) => res.json(lib.LEVELS));
router.get("/activity", (req, res) => res.json(lib.activity()));
// reload the exercise's database to its original data (course / SQL Exercises databases)
router.post("/item/:id/reset-db", localOnly, async (req, res) => {
  const conn = lib.connectionFor(req.params.id, dialectOf(req));
  if (!conn) return res.status(400).json({ error: "This exercise runs in your browser: use Reset data there." });
  try {
    const course = require("../load-course-datasets.js");
    const ex = require("../exercises/load-exercises.js");
    const quiet = () => {};
    if (conn === "coursemysql") await course.loadMysql();
    else if (conn === "coursepg") await course.loadPostgres();
    else if (conn === "exmysql") await ex.loadMysql(ex.SETS, quiet);
    else await ex.loadPostgres(ex.SETS, quiet);
    forgetSetups(TRACKS_OF[conn] || []);
    res.json({ ok: true, message: "The database is back to its original data." });
  } catch (e) {
    failed(req, res, e, (x) => ({ ok: false, error: x.message }));
  }
});
// is the database server for this exercise reachable?
router.get("/item/:id/db-status", async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  try {
    await ping(ex.track);
    res.json({ online: true, engine: ENGINE[dialectOf(req)].name });
  } catch (e) {
    res.json(isOffline(e) ? { online: false, ...offlineBody(dialectOf(req)) } : { online: true, engine: ENGINE[dialectOf(req)].name, warning: e.message });
  }
});
router.get("/recent", (req, res) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  const since = [new Date(Date.now() - days * 864e5).toISOString(), lib.BASELINE_AT].sort()[1];
  const items = lib.publicList().items.filter((i) => i.added_at > since).sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
  res.json({ days, baselineAt: lib.BASELINE_AT, count: items.length, items });
});
router.get("/dataset/:key", (req, res) => {
  const sql = lib.datasetSql(req.params.key);
  if (!sql) return res.status(404).json({ error: "No such dataset" });
  res.setHeader("Cache-Control", "max-age=600");
  res.json({ key: req.params.key, sql });
});
router.get("/item/:id", (req, res) => {
  const item = lib.publicItem(req.params.id);
  if (!item) return res.status(404).json({ error: "No such exercise" });
  res.json(item);
});

// course / SQL Exercises details (no solution), cleaned of source names
const TEXT_FIELDS = ["title", "objective", "idea", "tables_text", "example_intro", "example_sql", "example_output", "question", "starter", "hint1", "hint2", "hint3", "expected_text", "after_text", "prereq_text", "mode_note"];
router.get("/item/:id/course", (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  const auto = lib.setupCodesFor(req.params.id);
  const visiblePrereqs = JSON.parse(ex.prereq_codes || "[]").filter((code) => !auto.includes(code));
  const out = { check_mode: ex.check_mode, mode: ex.mode, context_sql: ex.context_sql, has_cleanup: !!ex.cleanup_sql, has_prereqs: visiblePrereqs.length > 0, auto_setup: auto.length > 0, expected_error: ex.expected_error, dialect: ex.track.endsWith("postgres") ? "postgres" : "mysql" };
  for (const f of TEXT_FIELDS) out[f] = lib.clean(ex[f] || "");
  if (!out.has_prereqs) out.prereq_text = ""; // only setups, which run by themselves
  res.json(out);
});
// schema browser: the exercise's tables (read-only user), and a 5-row preview of one of them
const schemaBrowser = require("./schema.js");
router.get("/item/:id/schema", async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  if (!schemaBrowser.ready()) return res.status(503).json({ error: "The schema browser isn't set up yet: restart SQL Drills (npm start)." });
  try { res.json({ tables: await schemaBrowser.tablesFor(ex) }); }
  catch (e) { res.status(isOffline(e) ? 503 : 500).json(isOffline(e) ? offlineBody(dialectOf(req)) : { error: "Couldn't read the tables." }); }
});
router.get("/item/:id/schema/preview", async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  if (!schemaBrowser.ready()) return res.status(503).json({ error: "The schema browser isn't set up yet: restart SQL Drills (npm start)." });
  try { res.json(await schemaBrowser.preview(ex, String(req.query.table || ""))); }
  catch (e) { res.status(e.status || (isOffline(e) ? 503 : 500)).json(isOffline(e) ? offlineBody(dialectOf(req)) : { error: e.status ? e.message : "Couldn't read that table." }); }
});
router.get("/item/:id/solution", (req, res) => {
  const item = lib.publicItem(req.params.id);
  if (!item) return res.status(404).json({ error: "No such exercise" });
  if (item.engine === "sqlite") return res.json({ solution_sql: lib.solutionOf(req.params.id) || "", why: lib.modelAnswerOf(req.params.id) || "", model: item.check === "self" || undefined, accepted: lib.acceptedOf(req.params.id) || undefined });
  const ex = courseExercise(req, res);
  if (!ex) return;
  res.json({ solution_sql: ex.solution_sql, why: lib.clean(ex.why), cleanup_sql: ex.cleanup_sql });
});
router.post("/item/:id/check", localOnly, async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  try {
    await ensureSetups(req.params.id, ex);
    const result = await checkExercise(ex, (req.body || {}).sql);
    if (result.verdict === "correct") setDone(`course:${ex.id}`, true);
    res.json({ ...result, done: result.verdict === "correct" });
  } catch (e) {
    failed(req, res, e, (x) => ({ verdict: "error", message: `Checking failed: ${x.message}` }));
  }
});
router.post("/item/:id/run", localOnly, async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  try {
    await ensureSetups(req.params.id, ex);
    res.json(await runForLearner(ex, (req.body || {}).sql));
  } catch (e) {
    failed(req, res, e, (x) => ({ ok: false, error: `The database reported a problem: ${x.message}` }));
  }
});
// write-query drills: run on a scratch MySQL copy of the dataset (never kept); Check compares end states
const writecheck = require("./writecheck.js");
const describeChanges = (changed) => Object.entries(changed).map(([k, v]) => {
  const [kind, name, timing, event] = k.split(":");
  const what = kind === "trigger" ? `the ${timing} ${event} trigger on ${name}` : `${kind} ${name}`;
  return v === null ? `removed ${what}` : kind === "table" ? `${what} now has ${v.rows.length} ${v.rows.length === 1 ? "row" : "rows"}` : `created or changed ${what}`;
});
router.post("/item/:id/state-run", localOnly, async (req, res) => {
  const ref = lib.stateRefOf(req.params.id);
  if (!ref) return res.status(404).json({ error: "This exercise isn't a MySQL write drill." });
  try {
    const t0 = Date.now();
    const r = await writecheck.runOnDataset(ref.site, String((req.body || {}).sql || ""), ref.setup);
    if (!r.ok) return res.json({ ok: false, error: r.error });
    const last = r.results[r.results.length - 1];
    res.json({ ok: true, ms: Date.now() - t0, result: last || null, changes: describeChanges(r.changed) });
  } catch (e) {
    failed(req, res, e, (x) => ({ ok: false, error: `The database reported a problem: ${x.message}` }));
  }
});
router.post("/item/:id/state-check", localOnly, async (req, res) => {
  const ref = lib.stateRefOf(req.params.id);
  if (!ref) return res.status(404).json({ error: "This exercise isn't a MySQL write drill." });
  try {
    // the reference runs live next to the learner's SQL, on its own fresh copy
    // same clock for both, and the drill's behaviour test (trigger drills) after each
    const opts = { clock: Math.floor(Date.now() / 60000) * 60, probe: ref.probe || undefined };
    // every accepted answer runs next to the learner's SQL; any match is correct, else the closest explains
    const refs = ref.accepted && ref.accepted.length > 1 ? ref.accepted : [{ sql: ref.sql, setup: ref.setup, label: null }];
    const [got, ...exps] = await Promise.all([writecheck.runOnDataset(ref.site, String((req.body || {}).sql || ""), ref.setup, opts)].concat(refs.map((x) => writecheck.runOnDataset(ref.site, x.sql, x.setup || ref.setup, opts))));
    const okExps = exps.map((e, k) => ({ ...e, label: refs[k].label })).filter((e) => e.ok);
    if (!okExps.length) return res.json({ verdict: "unavailable", message: "The reference answer couldn't run, so this exercise can't be checked right now." });
    if (!got.ok) return res.json({ verdict: "error", message: "Your SQL failed: " + got.error });
    const cmp = writecheck.compareRunsBest(okExps, got, { freeValues: ref.freeValues });
    const closest = okExps.length > 1 ? ` (compared with the closest of ${okExps.length} accepted answers${okExps[cmp.index].label ? ", " + okExps[cmp.index].label : ""})` : "";
    res.json(cmp.same
      ? { verdict: "correct", message: "Correct: your SQL leaves the database in the same state as the reference answer" + (ref.probe ? ", and your trigger behaves the same when a test INSERT / UPDATE fires it." : ".") + (ref.freeValues ? " (Your own values are fine here: the structure and row counts match.)" : "") }
      : { verdict: "incorrect", message: "Not yet: the database ends up different from the reference answer" + closest + ".", why: cmp.why.slice(0, 8), changes: describeChanges(got.changed) });
  } catch (e) {
    failed(req, res, e, (x) => ({ verdict: "error", message: `Checking failed: ${x.message}` }));
  }
});
router.post("/item/:id/cleanup", localOnly, async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  try { res.json(await runCleanup(ex)); } catch (e) { failed(req, res, e, (x) => ({ ok: false, message: x.message })); }
});
router.post("/item/:id/prereqs", localOnly, async (req, res) => {
  const ex = courseExercise(req, res);
  if (!ex) return;
  try {
    const r = await runPrerequisites(ex, getExercise);
    if (!r.ran || !r.ran.length) return res.json({ ok: r.ok, message: r.ok ? "This exercise has no prerequisites." : r.message });
    const already = r.ran.filter((x) => x.already).length;
    const problems = r.ran.reduce((n, x) => n + x.problems.length, 0);
    res.json({
      ok: r.ok,
      message: `Ran the solutions of ${r.ran.length} earlier exercise${r.ran.length === 1 ? "" : "s"} this one builds on` +
        (already ? ` (${already} had already been done)` : "") + "." +
        (problems ? ` ${problems} statement${problems === 1 ? "" : "s"} reported an error, often a deliberate failing test inside an earlier exercise.` : ""),
    });
  } catch (e) {
    failed(req, res, e, (x) => ({ ok: false, message: x.message }));
  }
});
// a Check / Submit result (or a failed run): { result: "pass" | "fail", hints }
router.get("/review", (req, res) => {
  // quick-check questions from Learn: their title, concept and where to answer again; gone ones are left out
  const r = lib.reviewList(), learn = require("./learn.js");
  const named = (list) => list.map((e) => (e.id.startsWith("qc:") ? ((x) => x && { ...e, qc: x })(learn.qcInfo(e.id)) : e)).filter(Boolean);
  res.json({ ...r, due: named(r.due), upcoming: named(r.upcoming) });
});
router.post("/item/:id/attempt", (req, res) => {
  const b = req.body || {};
  if (!lib.recordAttempt(req.params.id, b.result, b.hints)) return res.status(404).json({ error: "No such exercise" });
  // a failed transfer task sends its concept's practise set back into review
  let requeued = [];
  try { requeued = require("./learn.js").afterAttempt(req.params.id, b.result === "pass"); } catch (e) { console.warn("[learn] " + e.message); }
  res.json({ ok: true, requeued });
});
// mark done / not done (self-check exercises, or by hand)
router.post("/item/:id/done", (req, res) => {
  const item = lib.publicItem(req.params.id);
  if (!item) return res.status(404).json({ error: "No such exercise" });
  const done = (req.body || {}).done !== false;
  let key;
  if (item.engine === "server") {
    const ref = lib.courseRef(req.params.id, dialectOf(req));
    key = `course:${ref}`;
  } else key = lib.primaryKey(req.params.id);
  setDone(key, done);
  // un-marking clears every copy (both dialects, removed duplicates)
  if (!done) for (const k of lib.get().byId.get(req.params.id).legacy_keys) setDone(k, false);
  res.json({ ok: true, done });
});

module.exports = router;
