// Library health: checks run in the background, results stored with the run time.
//   near_dups        in-browser drills whose prompts share >= 55% of their words (the scope of the
//                    original audit; the 30-day course's templated series are variants by design)
//   failing          solutions that don't pass their own check (server exercises: the MySQL checker,
//                    rolled back; drills added in admin: run on their dataset)
//   leftover         titles or summaries with leftover source text
//   no_summary       a short title and no one-line summary
//   broken_links     cross-links to an exercise that is no longer in the library
//   auto_setup       (information) setup exercises run silently before the exercises they support
const db = require("../db.js");
const library = require("../library/library.js");
const content = require("./content.js");
const { checkExercise } = require("../course/check.js");
const { ensureSetups } = require("../library/setup.js");

db.exec(`
  CREATE TABLE IF NOT EXISTS health_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, started_at TEXT NOT NULL, finished_at TEXT, status TEXT NOT NULL, progress TEXT, results TEXT);
  CREATE TABLE IF NOT EXISTS health_decisions (a TEXT NOT NULL, b TEXT NOT NULL, decision TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (a, b));
`);

const NEAR = 0.55;
const STOP = new Set("the a an and or of to in on for with from by is are be as at it its this that each all any show list find write return query using use your you which what how who whose their them than then into per not no only also one two do does".split(" "));
const words = (s) => new Set(String(s || "").toLowerCase().replace(/\[\[ref:[^|]+\|[^\]]+\]\]/g, " ").replace(/[^a-z0-9_]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w)));
const LEFTOVER = /observe the result|just run it|read the notes|the repository|wikibooks|sqlzoo|w3schools|tpoint|geeksforgeeks|tutorialspoint|tutorial ?republic|sqlcourse|sqltutorial|…$|\.\.\.$|:\s*$|^introduction$/i;
const pairKey = (a, b) => (a < b ? [a, b] : [b, a]);

function nearDuplicates() {
  const c = library.get();
  const kept = new Set(db.prepare("SELECT a || '|' || b AS k FROM health_decisions WHERE decision = 'keep_both'").all().map((r) => r.k));
  const list = c.active.filter((i) => i.kind === "sqlite").map((i) => ({ i, w: words(i.title + " " + i.body) })).filter((x) => x.w.size >= 3);
  const out = [];
  for (let x = 0; x < list.length; x++) for (let y = x + 1; y < list.length; y++) {
    const A = list[x].w, B = list[y].w;
    let inter = 0;
    for (const w of A) if (B.has(w)) inter++;
    const sim = inter / (A.size + B.size - inter);
    if (sim < NEAR) continue;
    const [a, b] = pairKey(list[x].i.id, list[y].i.id);
    if (!kept.has(a + "|" + b)) out.push({ a, b, sim: Math.round(sim * 100), sameDataset: list[x].i.dataset === list[y].i.dataset });
  }
  return out.sort((p, q) => q.sim - p.sim);
}

function textChecks() {
  const c = library.get();
  const leftover = c.active.filter((i) => LEFTOVER.test(i.title) || LEFTOVER.test(i.summary || "")).map((i) => ({ id: i.id, title: i.title, detail: i.summary || "" }));
  const extra = (i) => { const t = words(i.title); return [...words(i.body)].filter((w) => !t.has(w)).length; };
  const noSummary = c.active.filter((i) => !i.summary && extra(i) >= 3).map((i) => ({ id: i.id, title: i.title, detail: "the prompt says more than the title: " + String(i.body || "").replace(/\s+/g, " ").slice(0, 120) }));
  const broken = [];
  for (const i of c.active) for (const m of String(i.body || "").matchAll(/\[\[ref:([^|]+)\|([^\]]+)\]\]/g)) {
    const t = c.byId.get(m[1]);
    if (!t || t.status !== "active") broken.push({ id: i.id, title: i.title, detail: `links to “${m[2]}” (${t ? t.status : "missing"})` });
  }
  const links = c.active.reduce((n, i) => n + (String(i.body || "").match(/\[\[ref:/g) || []).length, 0);
  return { leftover, noSummary, broken, links };
}

// every exercise gets exactly one outcome, so the five numbers add up to the library size:
//   ok         its reference solution passed its check (server: MySQL checker, rolled back;
//              drills added in admin: run on their dataset)
//   failed     its reference solution did not pass
//   self       self-check exercise: no automatic check exists
//   dependent  can't be checked on its own: it needs changes an earlier exercise makes
//   noref      no reference answer at all (built-in drills: done when the query runs)
async function failingSolutions(onProgress) {
  const c = library.get();
  const failing = [];
  const outcome = { ok: 0, failed: 0, self: 0, dependent: 0, noref: 0 };
  const refCheck = require("../library/refs.js").verifyAll();
  const refFailed = new Map(refCheck.failed.map((f) => [f.id, f]));
  // write-query references: re-run on a scratch MySQL copy (skipped when MySQL is offline)
  try { for (const f of (await require("../library/refs.js").verifyStates()).failed) refFailed.set(f.id, f); } catch (e) { console.warn("[health] write-drill check skipped: " + e.message); }
  try { for (const f of (await require("../library/refs.js").verifyAccepted()).failed) refFailed.set(f.id, f); } catch (e) { console.warn("[health] accepted-answer check skipped: " + e.message); }
  const server = c.active.filter((i) => i.kind === "server");
  for (const i of c.active) {
    if (i.kind === "server") continue;
    if (i.source !== "admin") {
      if (i.check === "self") { outcome.self++; continue; }
      if (!i.reference) { outcome.noref++; continue; }
      // a built-in drill with an agreed reference answer: its stored result must still match
      if (refFailed.has(i.id)) { outcome.failed++; failing.push(refFailed.get(i.id)); } else outcome.ok++;
      continue;
    }
    const item = content.allItems("drill").find((r) => r.id === i.source_ref);
    // write drills added in admin run on a scratch MySQL copy; the rest read-only in SQLite
    const r = !item ? { ok: false, error: "missing" } : i.check === "state" ? await require("../library/writecheck.js").runOnDataset(item.data.site, item.data.solution_sql).catch((e) => ({ ok: false, error: e.message })) : content.runReadOnly(item.data.site, item.data.solution_sql);
    if (r.ok) outcome.ok++;
    else { outcome.failed++; failing.push({ id: i.id, title: i.title, detail: `error: ${r.error}` }); }
  }
  for (const [k, i] of server.entries()) {
    if (k % 25 === 0) onProgress(`Running solutions: ${k} of ${server.length}`);
    const ex = db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(i.ref.mysql);
    if (!ex || ex.check_mode === "manual" || ex.check_mode === "concept") { outcome.self++; continue; }
    try {
      await ensureSetups(i.id, ex); // the same silent setup a learner gets
      const r = await checkExercise(ex, ex.solution_sql);
      if (r.verdict === "correct") outcome.ok++;
      // "needs-prereq" / "unavailable": it needs an earlier exercise's table or rows (or they are
      // already there) - the solution isn't broken, it just can't be checked in isolation
      else if (r.verdict === "needs-prereq" || r.verdict === "unavailable") outcome.dependent++;
      else { outcome.failed++; failing.push({ id: i.id, title: i.title, detail: `${r.verdict}: ${String(r.message || "").slice(0, 160)}` }); }
    } catch (e) {
      if (/ECONNREFUSED|ETIMEDOUT/.test(String(e.code || e.message))) throw Object.assign(new Error("MySQL is offline: the solution check needs it running."), { offline: true });
      outcome.failed++;
      failing.push({ id: i.id, title: i.title, detail: `error: ${e.message.slice(0, 160)}` });
    }
  }
  return { failing, outcome, total: c.active.length };
}

let running = null;
function lastRun() {
  const r = db.prepare("SELECT * FROM health_runs ORDER BY id DESC LIMIT 1").get();
  if (!r) return null;
  return { ...r, results: r.results ? JSON.parse(r.results) : null };
}
/** The latest finished results (with the newest decisions applied to near-duplicates). */
function summary() {
  const run = lastRun();
  const fin = db.prepare("SELECT * FROM health_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1").get();
  const res = fin ? JSON.parse(fin.results) : null;
  const c = library.get();
  const decided = new Set(db.prepare("SELECT a || '|' || b AS k FROM health_decisions").all().map((r) => r.k));
  const live = (list) => list.filter((x) => c.byId.get(x.id) && c.byId.get(x.id).status === "active");
  const checks = res ? [
    { key: "near_dups", label: "Near-duplicate pairs", count: res.near_dups.filter((p) => !decided.has(p.a + "|" + p.b) && c.byId.get(p.a).status === "active" && c.byId.get(p.b).status === "active").length, issue: true },
    { key: "failing", label: "Solutions that fail to run", count: live(res.failing).length, issue: true, note: res.solutionNote },
    { key: "leftover", label: "Titles with leftover source text", count: live(res.leftover).length, issue: true },
    { key: "no_summary", label: "Missing one-line summary", count: live(res.no_summary).length, issue: true },
    { key: "broken_links", label: `Broken cross-links (of ${res.links})`, count: live(res.broken_links).length, issue: true },
    { key: "auto_setup", label: "Setup exercises run automatically (auto_setup)", count: c.setups.length, issue: false },
  ] : [];
  return {
    running: !!running || (run && run.status === "running"), progress: run && run.status === "running" ? run.progress : null,
    lastRun: fin ? fin.finished_at : null, lastError: run && run.status === "failed" ? run.progress : null,
    checks, open: checks.filter((x) => x.issue).reduce((n, x) => n + x.count, 0),
    outcome: res && res.outcome ? { ...res.outcome, total: res.outcomeTotal } : null,
    drills: builtInDrills(),
  };
}
/** The 797 built-in drills, live: how each one is checked now. */
function builtInDrills() {
  const t = require("../library/refs.js").summary().total;
  return { total: t.drills, auto: t.matched, self: t.self, review: t.review, unchecked: t.not_query + t.todo };
}
function start() {
  if (running) return { started: false, message: "A health check is already running." };
  const id = db.prepare("INSERT INTO health_runs (started_at, status, progress) VALUES (?, 'running', 'Starting…')").run(new Date().toISOString()).lastInsertRowid;
  const progress = (p) => db.prepare("UPDATE health_runs SET progress = ? WHERE id = ?").run(p, id);
  running = (async () => {
    try {
      progress("Comparing prompts");
      const near_dups = nearDuplicates();
      const t = textChecks();
      let sol = { failing: [], outcome: null, total: 0 }, solutionNote = "";
      try { sol = await failingSolutions(progress); } catch (e) { if (!e.offline) throw e; solutionNote = e.message; }
      if (!solutionNote) solutionNote = `every exercise counted once: ${sol.outcome.ok} ran OK · ${sol.outcome.failed} failed · ${sol.outcome.self} self-check · ${sol.outcome.dependent} depend on an earlier exercise · ${sol.outcome.noref} have no reference answer = ${sol.total}`;
      const results = { near_dups, failing: sol.failing, outcome: sol.outcome, outcomeTotal: sol.total, leftover: t.leftover, no_summary: t.noSummary, broken_links: t.broken, links: t.links, solutionNote };
      db.prepare("UPDATE health_runs SET status = 'done', finished_at = ?, progress = NULL, results = ? WHERE id = ?").run(new Date().toISOString(), JSON.stringify(results), id);
    } catch (e) {
      db.prepare("UPDATE health_runs SET status = 'failed', finished_at = ?, progress = ? WHERE id = ?").run(new Date().toISOString(), "Failed: " + e.message, id);
    } finally {
      running = null;
    }
  })();
  return { started: true };
}

/** One check's rows, ready for the page (near-duplicates as side-by-side pairs). */
function details(key) {
  const fin = db.prepare("SELECT * FROM health_runs WHERE status = 'done' ORDER BY id DESC LIMIT 1").get();
  const c = library.get();
  const view = (id) => { const i = c.byId.get(id); return i && { id, title: i.title, summary: i.summary || "", body: String(i.body || "").replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”"), level: i.level, diff: i.diff, dataset: i.dataset, tables: i.tables || [], status: i.status }; };
  if (key === "auto_setup") return { key, rows: c.setups.map((s) => ({ ...view(s.id), detail: `Level ${s.homeLevel} · supports ${s.supports.length} exercises`, supports: s.supports.slice(0, 50).map(view) })) };
  if (!fin) return { key, rows: [] };
  const res = JSON.parse(fin.results);
  if (key === "near_dups") {
    const decided = new Set(db.prepare("SELECT a || '|' || b AS k FROM health_decisions").all().map((r) => r.k));
    return { key, rows: res.near_dups.filter((p) => !decided.has(p.a + "|" + p.b)).map((p) => ({ ...p, left: view(p.a), right: view(p.b) })).filter((p) => p.left && p.right && p.left.status === "active" && p.right.status === "active") };
  }
  const map = { failing: "failing", leftover: "leftover", no_summary: "no_summary", broken_links: "broken_links" };
  if (!map[key]) return { key, rows: [] };
  return { key, rows: res[map[key]].filter((x) => c.byId.get(x.id) && c.byId.get(x.id).status === "active").map((x) => ({ ...x, ...view(x.id), detail: x.detail })) };
}

/** Keep both / Merge (keep one, the other's progress carries over) / Delete one. */
function decide({ a, b, decision, keep }) {
  const [x, y] = pairKey(String(a), String(b));
  const c = library.get();
  if (!c.byId.get(x) || !c.byId.get(y)) throw Object.assign(new Error("Unknown exercise"), { status: 400 });
  if (!["keep_both", "merge", "delete"].includes(decision)) throw Object.assign(new Error("Unknown decision"), { status: 400 });
  const at = new Date().toISOString();
  if (decision !== "keep_both") {
    if (keep !== x && keep !== y) throw Object.assign(new Error("Say which one to keep"), { status: 400 });
    const drop = keep === x ? y : x;
    db.prepare("INSERT OR REPLACE INTO library_overrides (id, action, target, at) VALUES (?, ?, ?, ?)").run(drop, decision, decision === "merge" ? keep : null, at);
  }
  db.prepare("INSERT OR REPLACE INTO health_decisions (a, b, decision, at) VALUES (?, ?, ?, ?)").run(x, y, decision, at);
  library.build();
  return { ok: true };
}

module.exports = { start, summary, details, decide };
