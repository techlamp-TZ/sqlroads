const express = require("express");
const fs = require("node:fs");
const path = require("node:path");

// AI provider keys (see .env.example). Loaded before anything reads process.env.
const ENV_FILE = path.join(__dirname, ".env");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);

const db = require("./db.js");
const { buildDataset } = require("./build-datasets.js");
const { listProviders, getHint } = require("./hints.js");
const { loadMysql, loadPostgres } = require("./load-course-datasets.js");
const { checkExercise, runCleanup, runPrerequisites } = require("./course/check.js");
const exercises = require("./exercises/load-exercises.js");

const app = express();
app.use(express.json({ limit: "25mb" }));

// ---------- version guard ----------
// The version is a fingerprint of the code that pages and the API come from (public files and the server's own
// modules). Each HTML page carries the version it was served with; every API response says the current one.
// A page from an older version gets a "reload" banner, and its write requests are refused (409) instead of
// running against code it doesn't match.
// Two parts: the public files are read live (they are served fresh, so an edit is a new version at once); the server's
// own files (every .js at the root and in the module folders) are stamped once when the process starts, because a
// server-only change only takes effect after a restart: the restarted server then reports a new version and open
// pages get the banner.
const crypto = require("crypto");
const SERVER_DIRS = ["library", "admin", "course", "exercises", "mcq"].map((d) => path.join(__dirname, d));
const stampFiles = (h, dir, re, deep) => {
  let list = [];
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of list.sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (deep && e.name !== "node_modules") stampFiles(h, p, re, deep); }
    else if (re.test(e.name)) { const st = fs.statSync(p); h.update(p + ":" + st.size + ":" + st.mtimeMs + "\n"); }
  }
};
const SERVER_STAMP = (() => {
  const h = crypto.createHash("sha1");
  stampFiles(h, __dirname, /\.js$/, false);
  SERVER_DIRS.forEach((d) => stampFiles(h, d, /\.(js|css|html)$/, true));
  return h.digest("hex");
})();
let versionCache = { at: 0, value: "" };
function appVersion() {
  if (Date.now() - versionCache.at < 2000) return versionCache.value;
  const h = crypto.createHash("sha1");
  h.update("server:" + SERVER_STAMP + "\n");
  stampFiles(h, path.join(__dirname, "public"), /\.(js|css|html)$/, true);
  versionCache = { at: Date.now(), value: h.digest("hex").slice(0, 12) };
  return versionCache.value;
}
// admin writes in the server log: method, path, status, time
app.use("/api/admin", (req, res, next) => {
  if (req.method === "GET") return next();
  const t0 = Date.now();
  res.on("finish", () => console.log(`[admin] ${new Date().toISOString().slice(11, 19)} ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - t0} ms)`));
  next();
});
app.get("/favicon.ico", (req, res) => res.status(204).end());
app.use("/api", (req, res, next) => {
  const v = appVersion();
  res.setHeader("X-App-Version", v);
  const page = req.get("X-Page-Version");
  if (page && page !== v && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return res.status(409).json({ stale: true, error: "This page is from an older version of SQL Drills, so that wasn't saved. Reload the page, then try again." });
  }
  next();
});
// the two pages, with the version they're served with
const pageWithVersion = (file) => (req, res) => {
  const html = fs.readFileSync(path.join(__dirname, "public", file), "utf8").replace("<head>", `<head>\n<meta name="app-version" content="${appVersion()}">`);
  res.setHeader("Cache-Control", "no-cache");
  res.type("html").send(html);
};
app.get(["/", "/index.html"], pageWithVersion("index.html"));
app.get(["/admin", "/admin.html"], pageWithVersion("admin.html"));
// no-cache (not no-store) so the browser still revalidates with a conditional request
// instead of silently reusing a stale copy after an update.
app.use(express.static(path.join(__dirname, "public"), {
  setHeaders: (res) => res.setHeader("Cache-Control", "no-cache"),
}));

// ---------- sites / folders / files (replaces the old static data.js) ----------
app.get("/api/sites", (req, res) => {
  const sites = db.prepare("SELECT id, name FROM sites ORDER BY order_index").all();
  const folders = db.prepare("SELECT id, site_id, name FROM folders ORDER BY order_index").all();
  const files = db.prepare("SELECT folder_id, name, type, content FROM files ORDER BY order_index").all();

  const filesByFolder = new Map();
  for (const f of files) {
    if (!filesByFolder.has(f.folder_id)) filesByFolder.set(f.folder_id, []);
    filesByFolder.get(f.folder_id).push({ name: f.name, type: f.type, content: f.content });
  }

  const foldersBySite = new Map();
  for (const fo of folders) {
    if (!foldersBySite.has(fo.site_id)) foldersBySite.set(fo.site_id, []);
    const folderFiles = filesByFolder.get(fo.id) || [];
    const questionCount = folderFiles
      .filter((f) => f.type === "quiz")
      .reduce((n, f) => n + (f.content.match(/^\s*\d+\)\s/gm) || []).length, 0);
    foldersBySite.get(fo.site_id).push({ name: fo.name, files: folderFiles, questionCount });
  }

  const result = sites.map((s) => {
    const siteFolders = foldersBySite.get(s.id) || [];
    const questionCount = siteFolders.reduce((n, f) => n + f.questionCount, 0);
    return { id: s.id, name: s.name, folderCount: siteFolders.length, questionCount, folders: siteFolders };
  });

  res.json({ sites: result });
});

// ---------- drill progress ----------
app.get("/api/progress", (req, res) => {
  const rows = db.prepare("SELECT qid, done FROM progress").all();
  const out = {};
  for (const r of rows) out[r.qid] = !!r.done;
  res.json(out);
});

app.post("/api/progress", (req, res) => {
  const { qid, done } = req.body || {};
  if (!qid || typeof qid !== "string") return res.status(400).json({ error: "qid is required" });
  db.prepare(
    "INSERT INTO progress (qid, done, updated_at) VALUES (?, ?, ?) " +
    "ON CONFLICT(qid) DO UPDATE SET done = excluded.done, updated_at = excluded.updated_at"
  ).run(qid, done === false ? 0 : 1, new Date().toISOString());
  res.json({ ok: true });
});

// When things were completed (drills and course exercises): streaks, daily goal, activity calendar.
app.get("/api/activity", (req, res) => {
  res.json(db.prepare("SELECT qid, updated_at AS at FROM progress WHERE done = 1 ORDER BY updated_at").all());
});

// Multiple-choice questions: the built-in bank (mcq/questions.js) with the admin's edits,
// hidden questions and approved additions (admin/content.js).
const content = require("./admin/content.js");
// The unified drill library (levels; sources hidden): library/library.js, library/routes.js.
const library = require("./library/library.js");
library.build();
app.use("/api/library", require("./library/routes.js"));
// the 5-stage learning model: concepts, flashcards, predict-the-output, reflections, Today plan
const learn = require("./library/learn.js");
app.use("/api/learn", learn.router);
app.get("/api/mcqs", (req, res) => res.json(content.publicMcqs()));
// Extra SQL drills added or generated in the admin dashboard (with their solutions, for checking).
app.get("/api/custom-drills", (req, res) => res.json(content.publicDrills()));

// ---------- bookmarked drills ----------
app.get("/api/bookmarks", (req, res) => {
  res.json(db.prepare("SELECT qid, created_at AS at FROM bookmarks ORDER BY created_at DESC").all());
});
app.post("/api/bookmarks", (req, res) => {
  const { qid, on } = req.body || {};
  if (!qid || typeof qid !== "string") return res.status(400).json({ error: "qid is required" });
  if (on === false) db.prepare("DELETE FROM bookmarks WHERE qid = ?").run(qid);
  else db.prepare("INSERT OR IGNORE INTO bookmarks (qid, created_at) VALUES (?, ?)").run(qid, new Date().toISOString());
  res.json({ ok: true });
});

// ---------- endpoints the SQLPad playground (:3010) calls cross-origin ----------
app.use(["/api/datasets", "/api/hint", "/api/course"], (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", `${req.protocol}://${req.hostname}:3010`);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// ---------- AI hints (keys in .env; only answered for requests from this computer) ----------
const isLoopback = (req) => /^(::1|127\.\d+\.\d+\.\d+|::ffff:127\.\d+\.\d+\.\d+)$/.test(req.socket.remoteAddress || "");

app.get("/api/hint/providers", (req, res) => res.json(listProviders()));

app.post("/api/hint", async (req, res) => {
  if (!isLoopback(req)) return res.status(403).json({ error: "Hints are only available on the computer running SQL Drills." });
  try {
    const body = { ...(req.body || {}) };
    if (body.itemId) body.siteId = library.hintSite(String(body.itemId), body.dialect === "postgres" ? "postgres" : "mysql");
    res.json(await getHint(body));
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});

// ---------- 30-day course exercises (imported by course/import-course.js) ----------
const getExercise = (track, code) => db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(`${track}:${code}`);
const exerciseById = (id) => db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(id);
const courseQid = (id) => `course:${id}`;
const setDone = (id, done) =>
  db.prepare(
    "INSERT INTO progress (qid, done, updated_at) VALUES (?, ?, ?) ON CONFLICT(qid) DO UPDATE SET done = excluded.done, updated_at = excluded.updated_at"
  ).run(courseQid(id), done ? 1 : 0, new Date().toISOString());

// The course's own "00 Start Here" guides (Markdown), for the Playground's Resources tab.
const GUIDES_DIR = path.join(__dirname, "..", "learning SQL", "SQL PRACTICES", "00 Start Here");
function listGuides() {
  if (!fs.existsSync(GUIDES_DIR)) return [];
  return fs
    .readdirSync(GUIDES_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((name) => {
      const head = fs.readFileSync(path.join(GUIDES_DIR, name), "utf8").slice(0, 400);
      const title = (/^#\s+(.+)$/m.exec(head) || [])[1] || name.replace(/\.md$/i, "");
      return { name, title: title.trim() };
    });
}
app.get("/api/course/guides", (req, res) => res.json(listGuides()));
app.get("/api/course/guides/:name", (req, res) => {
  // Only names from the listing: never a path from the request.
  const guide = listGuides().find((g) => g.name === req.params.name);
  if (!guide) return res.status(404).json({ error: "No such guide" });
  res.json({ title: guide.title, markdown: fs.readFileSync(path.join(GUIDES_DIR, guide.name), "utf8") });
});

// SQL Exercises schema diagrams (SQL-exercise-master/SQL_exercise_NN/N_schema_figure.png).
app.get("/api/course/figure/:set", (req, res) => {
  const set = exercises.SETS.find((s) => String(s.n) === req.params.set);
  const file = set && exercises.figurePath(set.n);
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: "No diagram for that set" });
  res.setHeader("Cache-Control", "max-age=3600");
  res.sendFile(file);
});

// Tracks: the 30-day course (mysql, postgres) and the SQL Exercises (ex-mysql, ex-postgres).
const TRACKS = ["mysql", "postgres", "ex-mysql", "ex-postgres"];

app.get("/api/course", (req, res) => {
  const track = TRACKS.includes(req.query.track) ? req.query.track : "mysql";
  const rows = db
    .prepare("SELECT id, day, day_title, code, kind, title, level, minutes, check_mode, prereq_text <> '' AS has_prereqs FROM course_exercises WHERE track = ? ORDER BY day, kind, seq")
    .all(track);
  const done = new Set(db.prepare("SELECT qid FROM progress WHERE done = 1 AND qid LIKE ?").all(`course:${track}:%`).map((r) => r.qid));
  const days = [];
  for (const r of rows) {
    let d = days[days.length - 1];
    if (!d || d.day !== r.day) days.push((d = { day: r.day, title: r.day_title, exercises: [] }));
    d.exercises.push({ ...r, has_prereqs: !!r.has_prereqs, done: done.has(courseQid(r.id)) });
  }
  const figures = track.startsWith("ex-") ? exercises.SETS.filter((s) => fs.existsSync(exercises.figurePath(s.n))).map((s) => s.n) : [];
  res.json({ track, days, figures });
});

// Everything except the answer: solution, explanation and cleanup are fetched/run on request.
app.get("/api/course/exercise/:id", (req, res) => {
  const ex = exerciseById(req.params.id);
  if (!ex) return res.status(404).json({ error: "No such exercise" });
  const { solution_sql, why, cleanup_sql, ...rest } = ex;
  const done = db.prepare("SELECT done FROM progress WHERE qid = ?").get(courseQid(ex.id));
  res.json({ ...rest, has_cleanup: !!cleanup_sql, done: !!(done && done.done) });
});

app.get("/api/course/exercise/:id/solution", (req, res) => {
  const ex = exerciseById(req.params.id);
  if (!ex) return res.status(404).json({ error: "No such exercise" });
  res.json({ solution_sql: ex.solution_sql, why: ex.why, cleanup_sql: ex.cleanup_sql });
});

// The following run SQL on the local databases as their admin users: this computer only.
const localOnly = (req, res, next) =>
  isLoopback(req) ? next() : res.status(403).json({ error: "Only available on the computer running SQL Drills." });

app.post("/api/course/exercise/:id/check", localOnly, async (req, res) => {
  const ex = exerciseById(req.params.id);
  if (!ex) return res.status(404).json({ error: "No such exercise" });
  try {
    const result = await checkExercise(ex, (req.body || {}).sql);
    if (result.verdict === "correct") setDone(ex.id, true);
    res.json({ ...result, done: result.verdict === "correct" });
  } catch (e) {
    res.status(500).json({ verdict: "error", message: `Checking failed: ${e.message}` });
  }
});

app.post("/api/course/exercise/:id/cleanup", localOnly, async (req, res) => {
  const ex = exerciseById(req.params.id);
  if (!ex) return res.status(404).json({ error: "No such exercise" });
  try {
    res.json(await runCleanup(ex));
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post("/api/course/exercise/:id/prereqs", localOnly, async (req, res) => {
  const ex = exerciseById(req.params.id);
  if (!ex) return res.status(404).json({ error: "No such exercise" });
  try {
    res.json(await runPrerequisites(ex, getExercise));
  } catch (e) {
    res.status(500).json({ ok: false, message: e.message });
  }
});

app.post("/api/course/exercise/:id/done", (req, res) => {
  const ex = exerciseById(req.params.id);
  if (!ex) return res.status(404).json({ error: "No such exercise" });
  setDone(ex.id, (req.body || {}).done !== false);
  res.json({ ok: true });
});

// Saved queries and imported tables live in SQLPad / the track's SQLite file now.

// The 30-day course connections (see start-all.js) reload all three course datasets.
const COURSE_RESET = {
  coursemysql: () => loadMysql(),
  coursepg: () => loadPostgres(),
  exmysql: () => exercises.loadMysql(exercises.SETS, () => {}),
  expg: () => exercises.loadPostgres(exercises.SETS, () => {}),
};

app.post("/api/datasets/:siteId/reset", async (req, res) => {
  if (COURSE_RESET[req.params.siteId]) {
    try {
      await COURSE_RESET[req.params.siteId]();
      const reloaded = req.params.siteId.startsWith("ex") ? exercises.SETS.map((s) => s.schema) : ["practice", "manual", "sqlbolt"];
      return res.json({ siteId: req.params.siteId, reloaded, errors: [] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }
  const site = db.prepare("SELECT id FROM sites WHERE id = ?").get(req.params.siteId);
  if (!site) return res.status(404).json({ error: `No practice track called "${req.params.siteId}"` });
  try {
    const result = buildDataset(site.id);
    if (result.errors.length) return res.status(500).json({ error: result.errors.join("; ") });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---------- admin dashboard (no login by design; the server only listens on 127.0.0.1) ----------
// /admin is served with its version by the guard above
const admin = express.Router();
admin.use(localOnly);
// sync or async handlers
const wrap = (fn) => (req, res) => {
  Promise.resolve().then(() => fn(req)).then((out) => res.json(out), (e) => res.status(e.status || 500).json({ error: e.message }));
};

admin.get("/overview", wrap(() => {
  const sites = db.prepare("SELECT s.id, s.name, COUNT(DISTINCT CASE WHEN fo.name NOT LIKE '0 %' THEN fo.id END) AS chapters FROM sites s LEFT JOIN folders fo ON fo.site_id = s.id GROUP BY s.id ORDER BY s.order_index").all();
  const quizzes = db.prepare("SELECT fo.site_id AS site, f.content FROM files f JOIN folders fo ON fo.id = f.folder_id WHERE f.type = 'quiz'").all();
  const drillCount = {};
  for (const q of quizzes) drillCount[q.site] = (drillCount[q.site] || 0) + (q.content.match(/^\s*\d+\)\s/gm) || []).length;
  const progress = db.prepare("SELECT qid, updated_at FROM progress WHERE done = 1").all();
  const kindOf = (qid) => (qid.startsWith("course:ex-") ? "exercises" : qid.startsWith("course:") ? "course" : qid.startsWith("mcq:") ? "mcq" : qid.startsWith("x:") ? "extra" : "drill");
  const done = { drill: 0, mcq: 0, course: 0, exercises: 0, extra: 0 };
  const doneBySite = {};
  const days = {};
  for (const p of progress) {
    const k = kindOf(p.qid);
    done[k]++;
    if (k === "drill") { const site = p.qid.split("-")[0]; doneBySite[site] = (doneBySite[site] || 0) + 1; }
    const day = p.updated_at.slice(0, 10);
    days[day] = (days[day] || 0) + 1;
  }
  const course = db.prepare("SELECT track, COUNT(*) AS n FROM course_exercises GROUP BY track").all();
  const mcqs = content.allMcqs();
  const drills = content.customDrills();
  const count = (list, f) => list.filter(f).length;
  return {
    tracks: sites.map((s) => ({ ...s, drills: drillCount[s.id] || 0, done: doneBySite[s.id] || 0 })),
    totals: {
      drills: Object.values(drillCount).reduce((a, b) => a + b, 0),
      chapters: sites.reduce((a, s) => a + s.chapters, 0),
      mcqs: count(mcqs, (m) => m.status === "published"),
      mcqsHidden: count(mcqs, (m) => m.status === "hidden"),
      extraDrills: count(drills, (d) => d.status === "published"),
      drafts: count(mcqs, (m) => m.status === "draft") + count(drills, (d) => d.status === "draft"),
      course: Object.fromEntries(course.map((c) => [c.track, c.n])),
    },
    done,
    activity: days,
    bookmarks: db.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n,
    jobs: content.listJobs(8),
    providers: listProviders(),
  };
}));
admin.get("/topics", wrap(() => ({
  topics: content.TOPICS, diffs: content.DIFFS, sites: db.prepare("SELECT id, name FROM sites ORDER BY order_index").all(),
  levels: library.LEVELS.map((L) => ({ n: L.n, title: L.title, blurb: L.blurb })),
  datasets: Object.entries(content.DATASETS).map(([key, d]) => ({ key, label: d.label })),
})));
admin.get("/mcqs", wrap(() => content.allMcqs()));
admin.get("/drills", wrap(() => content.customDrills()));
admin.get("/queue", wrap(() => content.allItems("mcq").concat(content.allItems("drill")).filter((i) => i.status === "draft")));
const rebuilt = (x) => { library.build(); return x; };
admin.post("/items", wrap(async (req) => rebuilt(await content.saveItemAsync({ kind: req.body.kind, status: req.body.status || "draft", data: req.body.data || {}, source: "manual" }))));
admin.put("/items/:id", wrap(async (req) => rebuilt(await content.saveItemAsync({ id: req.params.id, kind: req.body.kind, status: req.body.status, data: req.body.data || {} }))));
admin.post("/items/:id/status", wrap((req) => rebuilt(content.setStatus(req.params.id, req.body.status))));
admin.delete("/items/:id", wrap((req) => rebuilt({ removed: content.removeItem(req.params.id) })));
// the library: levels with counts, and everything added recently (exercises, MCQs, drafts)
admin.get("/library", wrap(() => {
  // one summary for the header total AND the level table (the total is the sum of the rows)
  const c = library.get();
  const sum = library.summary();
  return {
    ...sum,
    duplicates: c.dups.map((d) => ({ removed: d.item.source_ref, title: d.item.title, kept: d.keep.source_ref })),
    links: c.links,
    builtAt: c.builtAt,
  };
}));
admin.get("/recent", wrap((req) => {
  const days = Math.min(365, Math.max(1, Number(req.query.days) || 30));
  // only content added after the baseline library (imported 12-13 Oct) counts as new
  const since = [new Date(Date.now() - days * 864e5).toISOString(), library.BASELINE_AT].sort()[1];
  const c = library.get();
  const ex = c.active.filter((i) => i.added_at > since).map((i) => ({ kind: i.kind === "server" ? "exercise (server)" : "exercise", id: i.id, title: i.title, level: i.level, diff: i.diff, source: i.origin || i.source, origin: require("./admin/overview.js").originOf(i.origin || i.source), added_at: i.added_at, status: "live" }));
  const mcqs = content.allMcqs().filter((m) => m.added_at > since).map((m) => ({ kind: "mcq", id: m.id, title: m.q, level: m.level, diff: m.diff, source: m.origin, added_at: m.added_at, status: m.status === "published" ? "live" : m.status }));
  const drafts = content.allItems("drill").filter((r) => r.status !== "published" && r.created_at > since).map((r) => ({ kind: "drill draft", id: r.id, title: r.data.title, level: r.data.level, diff: r.data.diff, source: r.source, added_at: r.created_at, status: r.status }));
  const items = ex.concat(mcqs, drafts).sort((a, b) => (a.added_at < b.added_at ? 1 : -1));
  return { days, baselineAt: library.BASELINE_AT, baseline: c.active.filter((i) => i.added_at <= library.BASELINE_AT).length, count: items.length, counts: { exercises: ex.length, mcqs: mcqs.length, drafts: drafts.length }, items };
}));
// sidebar counts, global search, the Library list and one exercise (admin/insights.js)
const insights = require("./admin/insights.js");
admin.get("/nav-counts", wrap(() => insights.navCounts()));
admin.get("/search", wrap((req) => insights.search(req.query.q)));
admin.get("/library/items", wrap((req) => insights.libraryItems(req.query)));
admin.get("/item/:id", wrap((req) => {
  const it = insights.itemDetail(req.params.id);
  if (!it) throw Object.assign(new Error("No such exercise"), { status: 404 });
  return it;
}));
// overview, system status, library health, backups, import (admin/overview.js, health.js, backup.js)
const overview = require("./admin/overview.js");
const health = require("./admin/health.js");
const backup = require("./admin/backup.js");
admin.get("/dashboard", wrap(() => overview.dashboard()));
admin.get("/system", async (req, res) => { try { res.json(await overview.system()); } catch (e) { res.status(500).json({ error: e.message }); } });
admin.get("/health", wrap(() => health.summary()));
admin.post("/health/run", wrap(() => health.start()));
admin.get("/health/:key", wrap((req) => health.details(req.params.key)));
admin.post("/health/decide", wrap((req) => health.decide(req.body || {})));
admin.get("/backups", wrap(() => backup.list()));
admin.post("/backups", wrap(() => backup.create("manual")));
admin.get("/backups/:name/download", (req, res) => { try { res.download(backup.fileOf(req.params.name)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } });
admin.post("/backups/:name/restore", wrap((req) => { if ((req.body || {}).confirm !== "RESTORE") throw Object.assign(new Error("Type RESTORE to confirm"), { status: 400 }); return backup.restore(req.params.name); }));
admin.post("/import/preview", wrap((req) => overview.importPreview((req.body || {}).rows, (req.body || {}).defaults || {})));
admin.post("/import/commit", wrap((req) => overview.importCommit((req.body || {}).rows, (req.body || {}).defaults || {})));
// reference answers for the built-in drills (library/refs.js)
const refs = require("./library/refs.js");
admin.get("/refs", wrap(() => refs.summary()));
admin.post("/refs/run", wrap((req) => refs.start((req.body || {}).levels, ["review", "write", "write-review"].includes((req.body || {}).mode) ? req.body.mode : "new")));
admin.get("/refs/history", wrap(() => refs.historyList()));
admin.post("/refs/stop", wrap(() => refs.stop()));
admin.get("/refs/review", wrap(() => refs.reviewList()));
admin.post("/refs/decide", wrap((req) => refs.decideLogged(req.body || {})));
admin.get("/refs/fixes", wrap(() => refs.fixSummary()));
admin.get("/tags/review", wrap(() => require("./library/concepts.js").tagReviewList()));
admin.post("/tags/decide", wrap((req) => require("./library/concepts.js").decideTag(req.body || {})));
admin.get("/stage/queue", wrap(() => refs.stageQueue()));
// How to use: every number the guides show, from where it lives (public/help.js holds the text, with {{tokens}})
app.get("/api/help/numbers", wrap(() => require("./library/help-numbers.js").helpNumbers()));
// manual creation (admin/create.js): every item type through the generators' checks, saved as "Mine"
const create = require("./admin/create.js");
admin.get("/create/meta", wrap(() => create.meta()));
admin.post("/create/check", wrap(async (req) => { const r = await create.check(req.body || {}); return r; }));
admin.post("/create", wrap((req) => create.create(req.body || {})));
admin.get("/create/item/:id", wrap((req) => create.load(req.params.id)));
admin.put("/create/item/:id", wrap((req) => create.update(req.params.id, req.body || {})));
admin.post("/create/dataset/preview", wrap((req) => create.datasetPreview(req.body || {})));
admin.post("/create/dataset", wrap((req) => create.datasetCreate(req.body || {})));
admin.post("/create/import/preview", wrap((req) => create.importPreview(req.body || {})));
admin.post("/create/import", wrap((req) => create.importCommit(req.body || {})));
admin.post("/stage/:id/status", wrap((req) => refs.setStageStatus(req.params.id, (req.body || {}).status)));
admin.post("/refs/bulk", wrap((req) => refs.bulkReview(req.body || {})));
// the 5-stage learning model: coverage per concept, edit, re-tag, fill-gaps runs (admin/learning.js)
const learning = require("./admin/learning.js");
admin.get("/learning/coverage", wrap(() => learning.coverage()));
admin.get("/learning/concepts/:slug/items", wrap((req) => learning.conceptItems(req.params.slug)));
// one item's learning stage set by hand (logged in History, undoable); the concept isn't re-tagged
admin.post("/tags/:key/stage", wrap((req) => refs.setTagStage(req.params.key, String((req.body || {}).stage || ""))));
admin.get("/learning/blockers", wrap((req) => learning.blockers({ includeRewritten: req.query.includeRewritten === "1" })));
admin.post("/learning/concepts/:slug", wrap((req) => learning.updateConcept(req.params.slug, req.body || {})));
admin.post("/learning/concepts/:slug/retag", wrap((req) => learning.retagConcept(req.params.slug)));
admin.get("/learning/estimate", wrap((req) => learning.needs(req.query.level ? [Number(req.query.level)] : null, String(req.query.stages || "flashcard,predict,practise,transfer").split(","))));
admin.post("/learning/fill", wrap((req) => learning.startFill(req.body || {})));
// Generate → From images (admin/image-gen.js): images are kept on this computer and never served
const imageGen = require("./admin/image-gen.js");
admin.get("/images/meta", wrap(() => ({ datasets: Object.entries(content.DATASETS).map(([key, d]) => ({ key, label: d.label })), reader: require("./library/concepts.js").MODELS.a, reviewer: require("./library/concepts.js").MODELS.b })));
admin.post("/images/estimate", wrap((req) => { const b = req.body || {}; return { extract: imageGen.estimateExtract((b.dims || []).slice(0, 10).map((d) => ({ w: Number(d.w) || 1000, h: Number(d.h) || 800 }))), generate: Array.isArray(b.items) ? imageGen.estimateGenerate(b.items.slice(0, 20), String(b.type || "auto")) : null }; }));
admin.post("/images", wrap((req) => imageGen.saveBatch((req.body || {}).images)));
admin.post("/images/:id/extract", wrap((req) => imageGen.extract(req.params.id)));
admin.post("/images/:id/dataset", wrap((req) => imageGen.previewDataset((req.body || {}).items || [])));
admin.post("/images/:id/sample-rows", wrap((req) => imageGen.sampleRows(req.params.id, req.body || {})));
admin.post("/images/:id/enhance", wrap((req) => imageGen.enhanceItem(req.params.id, req.body || {})));
admin.post("/images/:id/generate", wrap((req) => imageGen.startGenerate(req.params.id, req.body || {})));
admin.get("/images/job/:id", wrap((req) => imageGen.jobOf(req.params.id)));
admin.get("/learning/fill", wrap(() => learning.fillStatus()));
admin.post("/refs/fix-all", wrap((req) => refs.startFixAll((req.body || {}).kind)));
admin.get("/refs/changes", wrap(() => refs.changeList()));
admin.post("/refs/undo", wrap((req) => ((req.body || {}).batch ? refs.undoBatch(Number(req.body.batch)) : refs.undoOne(Number((req.body || {}).id)))));
admin.get("/settings/system", wrap(() => require("./admin/settings.js").serverChanges()));
admin.get("/settings/course-db", wrap(() => ({ last: require("./admin/course-db.js").lastReset() })));
admin.post("/settings/course-db/reset", wrap(() => require("./admin/course-db.js").resetCourse()));
admin.post("/refs/fix", wrap((req) => refs.decideFix(req.body || {})));
admin.post("/refs/suggest-fixes", wrap(() => refs.suggestFixes()));
admin.post("/verify", wrap((req) => (req.body.kind === "mcq" ? content.verifyMcq(req.body.data || {}, req.body.id) : content.verifyDrillAsync(req.body.data || {}, req.body.id))));
admin.post("/run-sql", wrap((req) => content.runReadOnly(String(req.body.site || ""), req.body.sql)));
admin.get("/schema/:site", wrap((req) => ({ schema: content.schemaText(req.params.site) })));
admin.post("/generate", wrap((req) => content.startJob(req.body.kind, req.body.params || {})));
admin.get("/jobs", wrap(() => content.listJobs(40)));
admin.get("/jobs/:id", wrap((req) => content.getJob(req.params.id)));
admin.get("/providers", wrap(() => {
  // the Auto entry describes the Generate order (hints keep their own order from .env)
  const order = require("./admin/settings.js").providerOrder().generate;
  return listProviders().map((p) => (p.id === "auto" ? { ...p, label: "Auto: " + order.filter((id) => listProviders().some((x) => x.id === id && x.configured)).map((id) => ({ claude: "Claude", openai: "OpenAI", deepseek: "DeepSeek" })[id]).join(" → ") } : p));
}));
admin.get("/settings/providers", wrap(() => require("./admin/settings.js").providerOrder()));
// the roles for content generation (hints.js): who generates, who reviews, who breaks ties, with models and prices
admin.get("/ai-roles", wrap(() => {
  const h = require("./hints.js");
  const ready = Object.fromEntries(listProviders().filter((p) => p.id !== "auto").map((p) => [p.id, p.configured]));
  return Object.entries(h.ROLES).map(([role, r]) => ({ role, provider: r.provider, model: r.model, price: h.PRICE[r.model] || null, configured: !!ready[r.provider] }));
}));
admin.put("/settings/providers", wrap((req) => require("./admin/settings.js").setProviderOrder(req.body || {})));
admin.post("/providers/test", async (req, res) => {
  const t0 = Date.now();
  try {
    const r = await require("./hints.js").complete({ provider: String(req.body.provider || "auto"), system: "Reply in at most 8 words.", user: "Say hello to the SQL Drills admin.", maxTokens: 60 });
    res.json({ label: r.label, model: r.model, text: r.text.slice(0, 200), ms: Date.now() - t0 });
  } catch (e) {
    res.status(e.status || 502).json({ error: e.message });
  }
});
admin.get("/progress/export", wrap(() => ({ progress: db.prepare("SELECT * FROM progress").all(), bookmarks: db.prepare("SELECT * FROM bookmarks").all() })));
admin.post("/progress/reset", wrap((req) => {
  const scope = req.body.scope;
  if (scope === "learning") return { removed: learn.resetLearning() };
  if (scope === "all") learn.resetLearning();
  const like = { drills: null, mcq: "mcq:%", course: "course:%", all: "%" }[scope];
  if (scope === "drills") return { removed: db.prepare("DELETE FROM progress WHERE qid NOT LIKE 'course:%' AND qid NOT LIKE 'mcq:%'").run().changes };
  if (!like) throw Object.assign(new Error("Unknown scope"), { status: 400 });
  return { removed: db.prepare("DELETE FROM progress WHERE qid LIKE ?").run(like).changes };
}));
app.use("/api/admin", admin);

const PORT = process.env.PORT || 4000;
// This computer only: the server runs SQL on the local databases and spends AI credits.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`SQL Drills server running at http://localhost:${PORT}`);
});
