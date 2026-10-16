// The unified drill library: every exercise (the tutorial-site drills, the 30-day course, the
// SQL Exercises set and drills added in the admin) in one list, organised in 14 levels and
// ordered Easy -> Hard inside each level, prerequisites first.
//
// The original sources are untouched (sites/folders/files, course_exercises, content_items);
// this module derives library_items from them. The source stays as a hidden internal field:
// learners only ever see levels, difficulty, the dataset's content name and the exercise.
//
// Each library item keeps the progress keys of its original(s) (legacy_keys), so existing
// progress, streaks and bookmarks carry over: an item is done when any of its keys is done.
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const db = require("../db.js");
const SqlCompare = require("../public/compare.js");
const { summarize, shortTitle, unwrap } = require("./summary.js");
// hand-written titles / summaries keyed by source_ref (re-read on every build)
// hand-written fixes (text-fixes.js) win over generated short titles (text-fixes-titles.js)
const loadFresh = (f) => { try { delete require.cache[require.resolve(f)]; return require(f); } catch { return {}; } };
const TEXT_FIXES = () => ({ ...loadFresh("./text-fixes-titles.js"), ...loadFresh("./text-fixes.js") });

const LEVELS = [
  { n: 1, title: "SELECT basics", blurb: "Choosing columns, aliases, DISTINCT and your first queries." },
  { n: 2, title: "Filtering & NULL", blurb: "WHERE, AND/OR, IN, BETWEEN, LIKE and handling missing values." },
  { n: 3, title: "Sorting & limiting", blurb: "ORDER BY, LIMIT/OFFSET, top-N and paging." },
  { n: 4, title: "Functions, expressions & dates", blurb: "CASE, string, number and date functions, types and cleaning." },
  { n: 5, title: "Aggregation & GROUP BY", blurb: "COUNT, SUM, AVG, MIN, MAX, GROUP BY and HAVING." },
  { n: 6, title: "JOINs", blurb: "Inner, outer, self and multi-table joins." },
  { n: 7, title: "Subqueries", blurb: "Scalar, IN, EXISTS and correlated subqueries." },
  { n: 8, title: "Set operators & reshaping", blurb: "UNION, INTERSECT, EXCEPT and reshaping results." },
  { n: 9, title: "Window functions & CTEs", blurb: "WITH, recursion, ranking, running totals and window frames." },
  { n: 10, title: "Modifying data", blurb: "INSERT, UPDATE, DELETE and loading data safely." },
  { n: 11, title: "Schema design: tables, keys, constraints", blurb: "CREATE/ALTER TABLE, keys and constraints." },
  { n: 12, title: "Views, indexes & performance", blurb: "Views, indexes, EXPLAIN and query tuning." },
  { n: 13, title: "Transactions, routines & security", blurb: "Transactions, procedures, triggers, permissions and SQL injection." },
  { n: 14, title: "Projects, capstone & practice exams", blurb: "Mixed-topic projects, BI and pipeline work, capstone and mock exams.",
    sections: [
      { key: "projects", title: "Projects", blurb: "Four mixed-topic projects: reporting, customer analytics, an operational database and an analytics mart." },
      { key: "capstone", title: "Capstone", blurb: "Build a logistics database end to end, then verify it." },
      { key: "exams", title: "Practice exams", blurb: "A mock exam, then the final practical examination." },
    ] },
];
// Level 14 sections by course day; anything else in the level (e.g. admin drills) counts as a project
const SECTION_OF_DAY = { 27: "capstone", 28: "capstone", 29: "exams", 30: "exams" };
const sectionIndex = (i) => (i.level === 14 ? LEVELS[13].sections.findIndex((s) => s.key === (SECTION_OF_DAY[i.day] || "projects")) : 0);
const TOPIC_LEVEL = { select: 1, where: 2, order: 3, functions: 4, dates: 4, group: 5, aggregates: 5, join: 6, subquery: 7, set: 8, window: 9, modify: 10, ddl: 11, views: 12, tx: 13, security: 13 };
const LEVEL_TOPIC = { 1: "select", 2: "where", 3: "order", 4: "functions", 5: "group", 6: "join", 7: "subquery", 8: "set", 9: "window", 10: "modify", 11: "ddl", 12: "views", 13: "tx", 14: "group" };
// "Recently added" starts after the library imported on 12-13 Oct 2026 (the baseline): only
// content added after this moment is new.
const BASELINE_AT = "2026-10-13T06:55:00.000Z";
const DIFF_RANK = { easy: 0, medium: 1, hard: 2 };
const MINUTES = { easy: 5, medium: 8, hard: 12 };

// Datasets are named by their content, never by the site they came from.
const DATASETS = {
  sqlzoo: { key: "world", label: "World, Nobel, movies & more" },
  w3schools: { key: "library", label: "Library (authors, books, members, loans)" },
  sqltutorialorg: { key: "hr", label: "HR (employees, departments, jobs)" },
  tpointtech: { key: "shop", label: "Shop (customers, products, orders)" },
  geeksforgeeks: { key: "streaming", label: "Music streaming" },
  tutorialspoint: { key: "clinic", label: "Vet clinic" },
  sqlcourse: { key: "games", label: "Games" },
  tutorialrepublic: { key: "hotels", label: "Hotels" },
};
// datasets made from screenshot rows (admin/image-gen.js) join the built-in ones
for (const r of db.prepare("SELECT key, site, label FROM custom_datasets ORDER BY created_at").all()) DATASETS[r.site] = { key: r.key, label: r.label };
const SITE_OF_DATASET = Object.fromEntries(Object.entries(DATASETS).map(([site, d]) => [d.key, site]));
/** A dataset created while the server runs (the maps above are read everywhere). */
function registerDataset(site, key, label) { DATASETS[site] = { key, label }; SITE_OF_DATASET[key] = site; }
/** After a restore: the image-built datasets in the table become the ones in the maps (others are dropped). */
function reloadCustomDatasets() {
  const rows = db.prepare("SELECT key, site, label FROM custom_datasets").all();
  for (const site of Object.keys(DATASETS)) if (/^img[0-9a-f]+$/.test(site) && !rows.some((r) => r.site === site)) { delete SITE_OF_DATASET[DATASETS[site].key]; delete DATASETS[site]; }
  rows.forEach((r) => registerDataset(r.site, r.key, r.label));
  return rows;
}
const TRACK_ORDER = ["sqlzoo", "sqltutorialorg", "tpointtech", "w3schools", "geeksforgeeks", "tutorialspoint", "sqlcourse", "tutorialrepublic"];

// ---------- classification (the same rules the learner app used, now done once here) ----------
const CHAPTER_TOPIC = [
  [/INJECTION|SECURITY/, "security"], [/WINDOW|CTE/, "window"], [/SUBQUER|WITHIN SELECT/, "subquery"],
  [/TRIGGER|PROCEDURE|TRANSACTION|CURSOR/, "tx"], [/JOIN/, "join"], [/SET OPERATOR/, "set"],
  [/HAVING|GROUP/, "group"], [/AGGREGATE|SUM AND COUNT/, "aggregates"], [/DATE|TIME/, "dates"],
  [/FUNCTION|CONDITIONAL|STRING|NUMERIC|MATHEMATICAL/, "functions"], [/VIEW|INDEX/, "views"],
  [/MODIFY|INSERT|UPDAT|DELET|DROP TABLE/, "modify"],
  [/TABLE|CONSTRAINT|KEYS|DATABASES|SEQUENCE|AUTO INCREMENT|CREATING/, "ddl"],
  [/SORT|ORDER BY|LIMIT/, "order"], [/FILTER|OPERATOR|BOOLEAN|IN AND BETWEEN|NULL|CLAUSE/, "where"],
];
const TEXT_TOPIC = [
  [/\bwindow\b|\bover\s*\(|\brank\b|row_number|\bcte\b|\bwith\s+\w+\s+as\b/i, "window"],
  [/subquer|\(\s*select\b|correlated|\bexists\b/i, "subquery"],
  [/\bjoin\b/i, "join"], [/group by|\bhaving\b/i, "group"], [/\b(count|sum|avg|min|max)\s*\(|\baverage\b|\btotal\b/i, "aggregates"],
  [/\bcase\b|coalesce|ifnull|\bround\b|\bupper\b|\blower\b|\blength\b|\bsubstr/i, "functions"],
  [/\border by\b|\bsort|\blimit\b|\btop \d|\bhighest\b|\blowest\b/i, "order"],
  [/\bwhere\b|\blike\b|\bbetween\b|\bin\s*\(|\bis null\b/i, "where"],
  [/\bunion\b|\bintersect\b|\bexcept\b/i, "set"],
  [/\binsert\b|\bupdate\b|\bdelete\b/i, "modify"],
];
const DIFF_OF_TOPIC = { select: 0, where: 0, order: 0, ddl: 0, security: 1, join: 1, group: 1, aggregates: 1, set: 1, functions: 1, dates: 1, modify: 1, views: 1, subquery: 2, window: 2, tx: 2 };
const HARD_TEXT = /self[- ]join|correlated|\bwindow\b|\bover\s*\(|\brank\b|row_number|subquer|three tables|recursive|running total|percent|second highest|nth/i;
const DIFFS = ["easy", "medium", "hard"];

function classifyDrill(chapterName, title, body) {
  const chap = chapterName.toUpperCase();
  let primary = "select";
  for (const [re, t] of CHAPTER_TOPIC) if (re.test(chap)) { primary = t; break; }
  const text = `${title}\n${body}`;
  let second = null;
  for (const [re, t] of TEXT_TOPIC) if (t !== primary && re.test(text)) { second = t; break; }
  let d = DIFF_OF_TOPIC[primary];
  if (/INTRODUCTION|WHAT IS SQL/.test(chap)) d = 0;
  if (/MORE JOIN|SELF JOIN/.test(chap)) d = 2;
  if (second && DIFF_OF_TOPIC[second] > d) d = Math.min(2, Math.max(d, DIFF_OF_TOPIC[second] - (DIFF_OF_TOPIC[second] === 2 ? 0 : 1)));
  if (HARD_TEXT.test(text)) d = 2;
  return { topics: second ? [primary, second] : [primary], diff: DIFFS[d] };
}

/** Level from what a solution actually uses (the most advanced feature wins). */
function levelFromSql(sql) {
  const s = String(sql || "").replace(/'(?:[^']|'')*'/g, "''").replace(/--[^\n]*/g, "").toUpperCase();
  if (!s.trim()) return null;
  const RULES = [
    [13, /\bGRANT\b|\bREVOKE\b|CREATE\s+(USER|ROLE)\b|\bPROCEDURE\b|CREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b|\bTRIGGER\b|CREATE\s+EVENT\b|START\s+TRANSACTION|\bBEGIN\s*;|\bCOMMIT\b|\bROLLBACK\b|\bSAVEPOINT\b|LOCK\s+TABLES?\b|\bCALL\s+\w/],
    [12, /CREATE\s+(OR\s+REPLACE\s+)?(MATERIALIZED\s+)?VIEW|CREATE\s+(UNIQUE\s+)?INDEX|\bEXPLAIN\b|ADD\s+(UNIQUE\s+)?(INDEX|KEY)\b|DROP\s+INDEX\b|\bANALYZE\b/],
    [11, /CREATE\s+(TEMPORARY\s+)?TABLE|ALTER\s+TABLE|DROP\s+TABLE|\bCONSTRAINT\b|PRIMARY\s+KEY|FOREIGN\s+KEY|CREATE\s+(SCHEMA|DATABASE)/],
    [10, /\bINSERT\b|\bUPDATE\s+\w|\bDELETE\b|REPLACE\s+INTO|\bMERGE\b|LOAD\s+DATA|\bTRUNCATE\b/],
    [9, /\bOVER\s*\(|\bWITH\s+(RECURSIVE\s+)?\w+(\s*\([^)]*\))?\s+AS\s*\(/],
    [8, /\bUNION\b|\bINTERSECT\b|\bEXCEPT\b/],
    [7, /\(\s*SELECT\b|\bEXISTS\s*\(/],
    [6, /\bJOIN\b/],
    [5, /GROUP\s+BY|\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/],
    [4, /\bCASE\b|COALESCE|IFNULL|NULLIF|\bCAST\s*\(|CONVERT\s*\(|CONCAT|SUBSTR|ROUND\s*\(|\bDATE|YEAR\s*\(|MONTH\s*\(|TIMESTAMPDIFF|EXTRACT\s*\(|\bUPPER\s*\(|\bLOWER\s*\(|TRIM\s*\(|LENGTH\s*\(|JSON_|STR_TO_DATE|REGEXP/],
    [3, /ORDER\s+BY|\bLIMIT\b/],
    [2, /\bWHERE\b/],
  ];
  for (const [lvl, re] of RULES) if (re.test(s)) return lvl;
  return 1;
}

// 30-day course: day -> level; "feat" days are classified by what each solution uses.
const DAY_LEVEL = { 1: 1, 2: "sort", 3: 2, 4: 4, 5: 5, 6: 6, 7: 14, 8: 7, 9: 8, 10: 9, 11: 9, 12: 9, 13: "feat", 14: 14, 15: 11, 16: 10, 17: 13, 18: "view", 19: 12, 20: 13, 21: 14, 22: "feat", 23: "feat", 24: 14, 25: "feat", 26: "feat", 27: 14, 28: 14, 29: 14, 30: 14 };
const FEAT_FALLBACK = { 13: 9, 22: 5, 23: 10, 25: 4, 26: 4 };
function courseLevel(ex) {
  const rule = DAY_LEVEL[ex.day];
  const sql = `${ex.solution_sql || ""}\n${ex.starter || ""}`;
  if (typeof rule === "number") return rule;
  if (rule === "sort") return /ORDER\s+BY|\bLIMIT\b/i.test(sql) ? 3 : 1;
  if (rule === "view") return /CREATE\s+(OR\s+REPLACE\s+)?(MATERIALIZED\s+)?VIEW/i.test(sql) ? 12 : 13;
  return levelFromSql(sql) || FEAT_FALLBACK[ex.day] || 14;
}
const COURSE_DIFF = { Foundational: "easy", Applied: "medium", "Edge case / debugging": "hard", Beginner: "easy", Intermediate: "medium", Advanced: "hard" };

// ---------- text clean-up: no source names in what learners read ----------
const SOURCE_TEXT = [
  [/\s*\(set \d+ of the Wikibooks SQL Exercises\)/g, ""],
  [/SQLZoo's live one/g, "the original live dataset"],
  [/The repository author's first try/g, "A common first try"],
  [/The repository marks this one "very important"/g, "This one is important"],
  [/The repository calls this one VERY IMPORTANT/g, "This one is very important"],
  [/The repository's SQLite answer/g, "A common SQLite answer"],
  [/The repository's answer forgets/g, "A common answer forgets"],
  [/The repository compares/g, "A common answer compares"],
];
function clean(text) {
  let t = String(text || "");
  for (const [re, by] of SOURCE_TEXT) t = t.replace(re, by);
  return t;
}

// ---------- reading the sources ----------
function parseQuiz(text) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = /^=+\s*$/.test((lines[1] || "").trim()) ? 2 : 1;
  const qRe = /^(\d+)\)\s?(.*)$/;
  const intro = [];
  while (i < lines.length && !qRe.test(lines[i])) intro.push(lines[i++]);
  const qs = [];
  let cur = null;
  for (; i < lines.length; i++) {
    const m = qRe.exec(lines[i]);
    if (m) { if (cur) qs.push(cur); cur = { num: Number(m[1]), title: m[2].trim(), body: [] }; }
    else if (cur) cur.body.push(lines[i]);
  }
  if (cur) qs.push(cur);
  for (const q of qs) {
    while (q.body.length && !q.body[q.body.length - 1].trim()) q.body.pop();
    q.body = q.body.map((l) => l.replace(/^ {1,3}/, "")).join("\n").trim();
  }
  return { intro: intro.join("\n").trim(), questions: qs };
}
const shortId = (legacy) => "e" + crypto.createHash("sha1").update(legacy).digest("hex").slice(0, 9);
const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").replace(/[^\w ]+/g, "").trim();
const birth = (p) => { try { const st = fs.statSync(p); return (st.birthtimeMs ? st.birthtime : st.mtime).toISOString(); } catch { return new Date().toISOString(); } };

function readDrills() {
  const sites = db.prepare("SELECT id FROM sites").all().map((s) => s.id).sort((a, b) => TRACK_ORDER.indexOf(a) - TRACK_ORDER.indexOf(b));
  const out = [];
  for (const [si, site] of sites.entries()) {
    const folders = db.prepare("SELECT id, name FROM folders WHERE site_id = ? ORDER BY order_index").all(site);
    for (const [fi, folder] of folders.entries()) {
      const quiz = db.prepare("SELECT content FROM files WHERE folder_id = ? AND type = 'quiz'").get(folder.id);
      if (!quiz) continue;
      const chapterName = folder.name.replace(/^\d+\s+/, "");
      const { intro, questions } = parseQuiz(quiz.content);
      for (const q of questions) {
        const c = classifyDrill(chapterName, q.title, q.body);
        const legacy = `${site}-${fi}-${q.num}`;
        out.push({
          id: shortId(legacy), legacy_keys: [legacy], kind: "sqlite", source: `drills:${site}`, source_ref: `${site} / ${folder.name} / ${q.num}`,
          dataset: DATASETS[site].key, title: clean(q.title), body: clean(q.body), intro: clean(intro), topic: c.topics[0], topics: c.topics,
          level: TOPIC_LEVEL[c.topics[0]], diff: c.diff, order: si * 100000 + fi * 1000 + q.num, chapterKey: `${site}/${fi}`, num: q.num, check: "run",
        });
      }
    }
  }
  return out;
}

function readCourse(track, alt, source) {
  const rows = db.prepare("SELECT * FROM course_exercises WHERE track = ? ORDER BY day, kind, seq").all(track);
  const altCodes = new Set(db.prepare("SELECT code FROM course_exercises WHERE track = ?").all(alt).map((r) => r.code));
  return rows.map((ex, i) => {
    const legacy = `course:${track}:${ex.code}`;
    const selfCheck = ex.check_mode === "manual" || ex.check_mode === "concept";
    return {
      id: shortId(legacy), legacy_keys: altCodes.has(ex.code) ? [legacy, `course:${alt}:${ex.code}`] : [legacy], kind: "server", source, source_ref: `${track}:${ex.code}`,
      ref: { mysql: `${track}:${ex.code}`, postgres: altCodes.has(ex.code) ? `${alt}:${ex.code}` : null },
      dataset: track.startsWith("ex-") ? "exercises" : "practice", title: clean(ex.title), body: clean(ex.question), intro: "", topic: null, topics: [],
      level: source === "course30" ? courseLevel(ex) : levelFromSql(ex.solution_sql) || 1, diff: COURSE_DIFF[ex.level] || "medium",
      order: (source === "course30" ? 1000000 : 2000000) + i, code: ex.code, day: source === "course30" ? ex.day : null, prereq_codes: JSON.parse(ex.prereq_codes || "[]"),
      check: selfCheck ? "self" : ex.check_mode, minutes: ex.minutes || null,
      solKey: ex.solution_sql || "",
    };
  });
}

const isWriteSql = (d) => ["modify", "ddl", "views", "tx"].includes(d.topic) || require("./writecheck.js").isWrite(d.solution_sql || "");
function readExtras() {
  return db.prepare("SELECT * FROM content_items WHERE kind = 'drill' AND status = 'published' ORDER BY created_at").all().map((r, i) => {
    const d = JSON.parse(r.data);
    const legacy = `x:${r.id}`;
    const dataset = d.dataset || (DATASETS[d.site] && DATASETS[d.site].key);
    return {
      id: shortId(legacy), legacy_keys: [legacy], kind: "sqlite", source: "admin", source_ref: r.id, dataset, title: d.title, body: d.task, intro: "",
      topic: d.topic, topics: [d.topic], level: Number(d.level) || TOPIC_LEVEL[d.topic] || 1, diff: d.diff, order: 3000000 + i, check: isWriteSql(d) ? "state" : "solution", state: isWriteSql(d) ? { setup: null, freeValues: false } : undefined, reference: isWriteSql(d) || undefined,
      solution: d.solution_sql, added_at: r.created_at, summary: d.summary || undefined, origin: r.source,
      accepted: Array.isArray(d.accepted) && d.accepted.length ? [{ sql: d.solution_sql, label: "Answer 1" }].concat(d.accepted.map((s, k) => ({ sql: s, label: "Answer " + (k + 2) }))) : undefined,
      hints: Array.isArray(d.hints) && d.hints.length ? d.hints : undefined, ordered: d.ordered ? true : undefined, reference: d.ordered ? true : undefined,
    };
  });
}

// ---------- links between exercises ("rewrite question 3 ...") ----------
function linkReferences(drills) {
  const byChapter = new Map();
  for (const d of drills) {
    if (!byChapter.has(d.chapterKey)) byChapter.set(d.chapterKey, new Map());
    byChapter.get(d.chapterKey).set(d.num, d);
  }
  const sectionOf = (site, name) => {
    const f = db.prepare("SELECT name FROM folders WHERE site_id = ? ORDER BY order_index").all(site).findIndex((x) => x.name.toUpperCase().includes(name.toUpperCase()));
    return f < 0 ? null : `${site}/${f}`;
  };
  let links = 0;
  for (const d of drills) {
    const site = d.chapterKey.split("/")[0];
    d.refs = [];
    d.body = d.body.replace(/\b(questions?)\s+(\d+)(\s+of the ([A-Za-z ]+?) section)?\b/g, (m, word, num, sec, secName) => {
      const chapter = sec ? sectionOf(site, secName) : d.chapterKey;
      const target = chapter && byChapter.get(chapter) && byChapter.get(chapter).get(Number(num));
      if (!target || target === d) return m;
      d.refs.push(target.id);
      links++;
      return `[[ref:${target.id}|${target.title}]]`;
    });
  }
  return links;
}

// ---------- duplicates ----------
// Only true duplicates: the same exercise text on the same dataset (one copy kept, the first in
// the original order), plus the exact cross-site copies found in the audit (same prompt word
// for word). Variants on different data, or with different numbers, are kept.
function findDuplicates(items) {
  // the same words (any order or spacing) = the same exercise; for course exercises the
  // solution must match too. References to other exercises count as the word "question".
  const tokens = (s) => [...new Set(String(s || "").toLowerCase().replace(/\[\[ref:[^|]+\|[^\]]+\]\]/g, " question ").replace(/[^a-z0-9_]+/g, " ").split(" ").filter(Boolean))].sort().join(" ");
  // drills: the audit's rule (filler words ignored), which found the 6 exact pairs
  const STOP = new Set("the a an and or of to in on for with from by is are be as at it its this that each all any show list find write return query using use your you which what how who whose their them than then into per not no only also one two".split(" "));
  const drillKey = (s) => [...new Set(String(s || "").toLowerCase().replace(/\[\[ref:[^|]+\|[^\]]+\]\]/g, " question ").replace(/[^a-z0-9_]+/g, " ").split(" ").filter((w) => w.length > 1 && !STOP.has(w)))].sort().join(" ");
  const seen = new Map(), dups = [];
  for (const it of items) {
    if (it.source === "admin") continue;
    const key = it.kind === "sqlite" ? `d|${drillKey(it.title + " " + it.body)}` : `${it.source}|${tokens(it.title + " " + it.body)}|${tokens(it.solKey)}`;
    if (seen.has(key)) dups.push({ item: it, keep: seen.get(key) });
    else seen.set(key, it);
  }
  return dups;
}

// ---------- ordering inside a level: Easy -> Hard, prerequisites first ----------
function orderLevel(items, byId) {
  const inLevel = new Set(items.map((i) => i.id));
  const deps = new Map(items.map((i) => [i.id, (i.prereqs || []).filter((p) => inLevel.has(p) && p !== i.id)]));
  const rank = (i) => DIFF_RANK[i.diff] * 1e8 + i.order;
  const done = new Set(), out = [];
  const remaining = items.slice().sort((a, b) => rank(a) - rank(b));
  // repeatedly take the easiest item whose prerequisites are placed; a prerequisite is pulled
  // forward with the item that needs it
  const place = (it, stack = new Set()) => {
    if (done.has(it.id) || stack.has(it.id)) return;
    stack.add(it.id);
    for (const p of deps.get(it.id)) place(byId.get(p), stack);
    done.add(it.id);
    out.push(it);
  };
  for (const it of remaining) place(it);
  out.forEach((it, i) => (it.seq = i + 1));
  return out;
}

// words in a that b doesn't have (filler words ignored)
const FILLER = new Set("the a an and or of to in on for with from by is are be as at it its this that each all any show list find write return query using use your you which what how who whose their them than then into per not no only also one two do does".split(" "));
const wordSet = (s) => new Set(String(s || "").toLowerCase().replace(/\[\[ref:[^|]+\|[^\]]+\]\]/g, " ").replace(/[^a-z0-9_]+/g, " ").split(" ").filter((w) => w.length > 1 && !FILLER.has(w)));
const newWords = (a, b) => { const t = wordSet(b); return [...wordSet(a)].filter((w) => !t.has(w)).length; };

// ---------- the tables an exercise uses (shown in the lists instead of the dataset name) ----------
// In-browser datasets: their CREATE TABLE names. Server exercises: what the solution reads/writes.
function datasetTables() {
  const out = {};
  for (const site of Object.keys(DATASETS)) {
    const names = new Set();
    for (const sql of datasetSql(DATASETS[site].key) || []) for (const m of sql.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"[]?(\w+)/gi)) names.add(m[1].toLowerCase());
    out[DATASETS[site].key] = [...names];
  }
  return out;
}
function tablesUsed(i, tableNames) {
  const found = [];
  const add = (t) => { t = t.toLowerCase(); if (!found.includes(t)) found.push(t); };
  if (i.kind === "sqlite") {
    const names = tableNames[i.dataset] || [];
    const text = `${i.solution || ""}\n${i.title}\n${i.body}`.toLowerCase();
    // in order of first mention
    const mentioned = (t) => names.map((n) => [n, t.search(new RegExp(`\\b${n}\\b`))]).filter(([, at]) => at > -1).sort((a, b) => a[1] - b[1]).map(([n]) => n);
    // the exercise's own text first; otherwise the tables its chapter introduces
    (mentioned(text).length ? mentioned(text) : mentioned(String(i.intro || "").toLowerCase())).forEach(add);
  } else {
    const sql = String(i.solKey || "").replace(/--[^\n]*/g, " ");
    const ctes = new Set([...sql.matchAll(/(?:WITH|,)\s*(?:RECURSIVE\s+)?(\w+)\s*(?:\([^)]*\))?\s+AS\s*\(/gi)].map((m) => m[1].toLowerCase()));
    for (const m of sql.matchAll(/\b(?:FROM|JOIN|INTO|UPDATE|TABLE(?:\s+IF\s+(?:NOT\s+)?EXISTS)?)\s+(?:`|")?(?:(\w+)\.)?(\w+)/gi)) {
      if (/^(information_schema|pg_catalog|mysql|performance_schema|sys)$/i.test(m[1] || "")) continue;
      const t = m[2].toLowerCase();
      if (!ctes.has(t) && !/^(select|lateral|unnest|json_table|generate_series|dual|information_schema|values|the|a)$/.test(t)) add(t);
    }
  }
  return found.slice(0, 3);
}

// ---------- build ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS library_items (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    level INTEGER NOT NULL,
    seq INTEGER NOT NULL,
    diff TEXT NOT NULL,
    status TEXT NOT NULL,             -- active | duplicate | removed | auto_setup
    duplicate_of TEXT,
    legacy_keys TEXT NOT NULL,
    added_at TEXT NOT NULL
  );
  -- one row per Check / Submit (or failed run): drives "Failed" and the review queue
  CREATE TABLE IF NOT EXISTS attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id TEXT NOT NULL,
    result TEXT NOT NULL,             -- pass | fail
    hints INTEGER NOT NULL DEFAULT 0, -- hints / solution steps used before this attempt
    at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS attempts_item ON attempts (item_id, at);
  -- Library health decisions: merge an exercise into another, or delete it from the library
  -- reference answers for the built-in drills (library/refs.js); "matched" ones are result-checked
  CREATE TABLE IF NOT EXISTS drill_refs (
    item_id TEXT PRIMARY KEY, status TEXT NOT NULL, sql TEXT, columns TEXT, rows TEXT, ordered INTEGER NOT NULL DEFAULT 0,
    a TEXT, b TEXT, reason TEXT, created_at TEXT NOT NULL, verified_at TEXT
  );
  CREATE TABLE IF NOT EXISTS library_overrides (id TEXT PRIMARY KEY, action TEXT NOT NULL, target TEXT, at TEXT NOT NULL);
`);
// learner-facing text, stored with the item (summary <= 110 characters, never cut with "…")
for (const [col, type] of [["title", "TEXT"], ["summary", "TEXT"], ["tables", "TEXT"]]) {
  if (!db.prepare("PRAGMA table_info(library_items)").all().some((c) => c.name === col)) db.exec(`ALTER TABLE library_items ADD COLUMN ${col} ${type}`);
}

let cache = null;
function build() {
  const drills = readDrills();
  const links = linkReferences(drills);
  const course = readCourse("mysql", "postgres", "course30");
  const wiki = readCourse("ex-mysql", "ex-postgres", "exercises");
  const extras = readExtras();
  const all = drills.concat(course, wiki, extras);
  const byId = new Map(all.map((i) => [i.id, i]));
  const byCode = new Map(course.map((c) => [c.code, c]));
  for (const c of course) c.prereqs = c.prereq_codes.map((code) => byCode.get(code)).filter(Boolean).map((p) => p.id);
  for (const d of drills) d.prereqs = d.refs;

  // duplicates
  const dups = findDuplicates(all);
  // decisions taken in Library health: "merge" (keep target, progress carries over) or "delete"
  const deleted = new Set();
  for (const o of db.prepare("SELECT id, action, target FROM library_overrides").all()) {
    const it = byId.get(o.id), keep = o.target && byId.get(o.target);
    if (!it || dups.some((d) => d.item === it)) continue;
    if (o.action === "merge" && keep && keep !== it) dups.push({ item: it, keep, manual: true });
    else if (o.action === "delete") deleted.add(it.id);
  }
  const dupIds = new Set(dups.map((d) => d.item.id));
  for (const d of dups) {
    d.item.status = "duplicate";
    d.item.duplicate_of = d.keep.id;
    // progress on a removed copy counts for the copy that's kept
    d.keep.legacy_keys = d.keep.legacy_keys.concat(d.item.legacy_keys);
  }
  for (const id of deleted) byId.get(id).status = "removed";
  const active = all.filter((i) => !dupIds.has(i.id) && !deleted.has(i.id));
  for (const i of active) i.status = "active";

  // learner-facing text: re-join wrapped drill questions, short titles, one-sentence summaries
  // (after duplicate detection, which works on the original text)
  // built-in drills with an agreed reference answer: checked against its result, like admin drills
  const refCols = db.prepare("PRAGMA table_info(drill_refs)").all().map((c) => c.name);
  const hasState = refCols.includes("mode") && refCols.includes("setup");
  // self-check drills: Claude's model answer / solution, shown after "Show answer"
  if (refCols.includes("model_answer")) for (const r of db.prepare("SELECT item_id, sql, model_answer FROM drill_refs WHERE status = 'self'").all()) {
    const i = byId.get(r.item_id);
    if (!i || i.kind !== "sqlite" || !i.source.startsWith("drills:")) continue;
    i.check = "self"; i.solution = r.sql || null; i.modelAnswer = r.model_answer || null;
  }
  for (const r of db.prepare(`SELECT item_id, sql, ordered${hasState ? ", mode, setup, free_values" + (refCols.includes("probe") ? ", probe" : "") + (refCols.includes("accepted") ? ", accepted" : "") : ""} FROM drill_refs WHERE status = 'matched'`).all()) {
    const i = byId.get(r.item_id);
    if (!i || i.kind !== "sqlite" || !i.source.startsWith("drills:")) continue;
    i.solution = r.sql; i.reference = true;
    // write-query drills: checked by the end state on a scratch MySQL copy
    const acc = r.accepted ? JSON.parse(r.accepted) : null;
    if (acc && acc.length > 1) i.accepted = acc.map((x) => ({ sql: x.sql, setup: x.setup || null, label: { a: "A", b: "B", c: "C" }[x.key] || "yours" }));
    if (r.mode === "state") { i.check = "state"; i.state = { setup: r.setup || null, freeValues: !!r.free_values, probe: r.probe || null, accepted: i.accepted || null }; }
    else {
      i.check = "solution"; i.ordered = !!r.ordered; if (r.setup) i.prep = r.setup;
      // "today" drills run at a frozen clock; random samples are checked against their pool
      if (SqlCompare.usesClock(r.sql)) i.clock = SqlCompare.FROZEN.slice(0, 10);
      const sp = SqlCompare.samplePool(r.sql);
      if (sp) i.sample = sp.limit || true;
    }
  }
  const fixes = TEXT_FIXES();
  const tableNames = datasetTables();
  for (const i of active) {
    i.origTitle = i.title;
    i.tables = tablesUsed(i, tableNames);
    if (i.kind === "sqlite" && i.source !== "admin") {
      const u = unwrap(i.title, i.body);
      if (u) {
        i.body = u.prompt + (u.rest ? "\n" + u.rest : "");
        i.summarySrc = u.rest;
        i.title = shortTitle(u.prompt) || i.title;
      }
    }
    // course / SQL Exercises titles cut short at import ("… index first," / "… boxes is gre…"):
    // complete them from the prompt sentence they start
    // final exam "changed requirement" questions: name the redefined metric, state the new rule
    const changed = /^(Final Part R Q\w+) - changed requirement:/.exec(i.title);
    const def = changed && /changes the definition of '([^':]+)[^']*'\. Now: ([^.]+)\./.exec(String(i.body).replace(/\s+/g, " "));
    if (def) { i.title = `${changed[1]}: ${def[1]}, redefined`; i.summary = `New rule: ${def[2]}.`; }
    const review = /^Review (\d+) \(Day (\d+)\) - /.exec(i.title);
    if (review) i.summary = `From memory, without looking back at Day ${review[2]}.`;
    if (i.kind === "server" && (review || i.title.length >= 66 || /[,…]$|\.\.\.$|\s(the|a|an|of|to|in|on|for|and|or|by|with|from|is|are|that|than|at|as|when|which|who|not)$/i.test(i.title))) {
      const dash = i.title.lastIndexOf(" - ");
      const head = dash > -1 ? i.title.slice(0, dash) : "";
      const cut = (dash > -1 ? i.title.slice(dash + 3) : i.title).replace(/(…|\.\.\.|,)$/, "").trim();
      const flat = String(i.body || "").replace(/\s+/g, " ");
      const at = flat.indexOf(cut);
      if (cut.length > 10 && at > -1) {
        const end = flat.slice(at).search(/(?<!\.)\.(?!\.)(?=\s|$)|[?!](?=\s|$)/);
        const full = end > -1 ? flat.slice(at, at + end + 1) : flat.slice(at);
        const short = full.length <= 100 ? full.replace(/\.$/, "") : shortTitle(full);
        if (short && short.length > cut.length) i.title = (head ? head.replace(/^Review (\d+) \(Day \d+\)$/, "Review $1") + ": " : "") + short;
      }
    }
    const fix = fixes[i.source_ref] || {};
    if (fix.title) i.title = fix.title;
    i.summary = fix.summary != null ? fix.summary : i.summary != null ? i.summary : summarize(i.title, i.summarySrc != null ? i.summarySrc : i.body).summary;
    // no summary, but the prompt asks for more than the (shortened) title says: summarise the prompt
    if (!i.summary && fix.summary == null) {
      const whole = summarize("", i.body).summary;
      if (whole && newWords(whole, i.title) >= 3) i.summary = whole;
    }
    i.summaryAuto = fix.summary == null && i.summary != null && !/^(From memory|New rule)/.test(i.summary);
  }
  // a generic instruction shared by many exercises ("Which constraint stops it?") says little in a
  // list: use the exercise's own next sentence instead, when there is one
  const freq = new Map();
  for (const i of active) if (i.summary) freq.set(i.summary, (freq.get(i.summary) || 0) + 1);
  const generic = new Set([...freq].filter(([, n]) => n >= 4).map(([s]) => s));
  const alts = new Map();
  for (const i of active) {
    if (!i.summaryAuto || !generic.has(i.summary)) continue;
    const alt = summarize(i.title, i.summarySrc != null ? i.summarySrc : i.body, generic).summary;
    if (alt) alts.set(i, alt);
  }
  const altFreq = new Map();
  for (const s of alts.values()) altFreq.set(s, (altFreq.get(s) || 0) + 1);
  for (const [i, alt] of alts) if (altFreq.get(alt) < 4) i.summary = alt;
  // a vague drill prompt rewritten by the reference pipeline to name its columns, or a drill-text fix
  // applied in the review queue (whatever the drill's status now; the original is kept in drill_refs)
  for (const r of db.prepare("SELECT item_id, prompt_rewritten, columns FROM drill_refs WHERE prompt_rewritten IS NOT NULL").all()) {
    const i = byId.get(r.item_id);
    if (!i || i.status !== "active") continue;
    let text = r.prompt_rewritten;
    // the rewrite saw links as text ("the exercise “Title”"): put the links back
    for (const m of String(i.body || "").matchAll(/\[\[ref:([^|]+)\|([^\]]+)\]\]/g)) {
      // curly or straight quotes, with or without "the exercise"
      const found = [`the exercise “${m[2]}”`, `the exercise "${m[2]}"`, `“${m[2]}”`, `"${m[2]}"`].find((p) => text.includes(p));
      if (found) text = text.replace(found, m[0]);
    }
    i.body = text;
    const cols = JSON.parse(r.columns || "[]").filter((c) => r.columns !== '["state"]' && c);
    i.summary = summarize(i.title, i.body).summary || (cols.length ? `Columns: ${cols.join(", ")}.`.slice(0, 110) : i.summary);
  }

  // auto_setup: a prerequisite that sits later in the path than an exercise needing it (usually a
  // "build the star schema" step in Schema design, needed by a JOIN exercise) is not a learner
  // exercise: the checker runs it silently first. It leaves the lists, the totals and progress;
  // admin shows it under the exercises it supports. (Its own later prerequisites follow it.)
  for (const i of active) { i.homeLevel = i.level; i.section = sectionIndex(i); }
  const place = (i) => i.level * 10 + i.section;
  const needAt = new Map(); // setup id -> earliest place that needs it
  for (let changed = true; changed; ) {
    changed = false;
    for (const i of active) {
      const at = needAt.has(i.id) ? needAt.get(i.id) : place(i);
      for (const p of i.prereqs || []) {
        const q = byId.get(p);
        if (!q || q.status !== "active" || place(q) <= at) continue;
        if (!needAt.has(q.id) || needAt.get(q.id) > at) { needAt.set(q.id, at); changed = true; }
      }
    }
  }
  const setups = active.filter((i) => needAt.has(i.id));
  for (const s of setups) {
    s.status = "auto_setup";
    s.supports = active.filter((i) => (i.prereqs || []).includes(s.id)).map((i) => i.id);
  }
  for (let k = active.length - 1; k >= 0; k--) if (active[k].status === "auto_setup") active.splice(k, 1);

  // levels + order (Level 14: section by section)
  const levels = LEVELS.map((L) => {
    const inLevel = active.filter((i) => i.level === L.n);
    const parts = (L.sections || [null]).map((s, k) => orderLevel(inLevel.filter((i) => i.section === k), byId));
    const items = [].concat(...parts);
    items.forEach((it, k) => (it.seq = k + 1));
    return { ...L, items };
  });

  // added_at: kept from earlier builds; new items get "now"; first build backfills import times
  const known = new Map(db.prepare("SELECT id, added_at FROM library_items").all().map((r) => [r.id, r.added_at]));
  const firstBuild = known.size === 0;
  const IMPORTED = {
    drills: birth(path.join(__dirname, "..", "seed.js")),
    course30: birth(path.join(__dirname, "..", "course", "parse.js")),
    exercises: birth(path.join(__dirname, "..", "exercises", "answer-key.js")),
  };
  const nowIso = new Date().toISOString();
  for (const i of all) {
    i.added_at = known.get(i.id) || i.added_at || (firstBuild ? IMPORTED[i.source.split(":")[0]] || nowIso : nowIso);
  }
  const upsert = db.prepare(`INSERT INTO library_items (id, source, source_ref, level, seq, diff, status, duplicate_of, legacy_keys, added_at, title, summary, tables)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET level = excluded.level, seq = excluded.seq, diff = excluded.diff, status = excluded.status,
      duplicate_of = excluded.duplicate_of, legacy_keys = excluded.legacy_keys, source_ref = excluded.source_ref,
      title = excluded.title, summary = excluded.summary, tables = excluded.tables`);
  db.exec("BEGIN");
  for (const i of all) upsert.run(i.id, i.source, i.source_ref, i.level, i.seq || 0, i.diff, i.status, i.duplicate_of || null, JSON.stringify(i.legacy_keys), i.added_at, i.title, i.summary || "", JSON.stringify(i.tables || []));
  // items whose source is gone (e.g. a drill deleted in admin) stay on record but are no longer active
  const retire = db.prepare("UPDATE library_items SET status = 'removed' WHERE id = ? AND status <> 'removed'");
  for (const id of known.keys()) if (!byId.has(id)) retire.run(id);
  db.exec("COMMIT");

  // which library item each original progress key belongs to (activity feed, bookmarks)
  const byLegacy = new Map();
  for (const i of all) for (const k of i.legacy_keys) byLegacy.set(k, i.status === "duplicate" ? i.duplicate_of : i.id);
  // bookmarks saved under an original key move to the library item
  for (const b of db.prepare("SELECT qid FROM bookmarks").all()) {
    const id = byLegacy.get(b.qid);
    if (id && id !== b.qid) {
      db.prepare("INSERT OR IGNORE INTO bookmarks (qid, created_at) SELECT ?, created_at FROM bookmarks WHERE qid = ?").run(id, b.qid);
      db.prepare("DELETE FROM bookmarks WHERE qid = ?").run(b.qid);
    }
  }
  cache = { levels, byId, all, active, setups, dups, links, byLegacy, builtAt: nowIso };
  return cache;
}
const get = () => cache || build();

/**
 * The one count of the library: per-level rows and the total, from the same list, so a header
 * total and a level table can never disagree (the total IS the sum of the rows).
 */
function summary() {
  const c = get();
  const keys = doneKeys();
  const levels = c.levels.map((L) => {
    const row = { n: L.n, title: L.title, total: L.items.length, easy: 0, medium: 0, hard: 0, selfCheck: 0, done: 0, server: 0, browser: 0, sources: {} };
    for (const i of L.items) {
      row[i.diff]++;
      if (i.check === "self") row.selfCheck++;
      if (isDone(i, keys)) row.done++;
      row[i.kind === "server" ? "server" : "browser"]++;
      const s = i.source.split(":")[0];
      row.sources[s] = (row.sources[s] || 0) + 1;
    }
    if (L.sections) row.sections = L.sections.map((s, k) => ({ key: s.key, title: s.title, total: L.items.filter((i) => i.section === k).length }));
    return row;
  });
  const sum = (k) => levels.reduce((a, L) => a + L[k], 0);
  const total = sum("total");
  if (total !== c.active.length) console.error(`[library] level rows add up to ${total} but ${c.active.length} items are active`);
  return { levels, total, easy: sum("easy"), medium: sum("medium"), hard: sum("hard"), selfCheck: sum("selfCheck"), done: sum("done"), server: sum("server"), browser: sum("browser"), builtAt: c.builtAt };
}

// ---------- progress (stored under the original keys) ----------
function doneKeys() { return new Set(db.prepare("SELECT qid FROM progress WHERE done = 1").all().map((r) => r.qid)); }
const isDone = (item, keys) => item.legacy_keys.some((k) => keys.has(k));
/** The ids of the exercises learners see that are done (the learning model reads it). */
function doneIds() { const keys = doneKeys(); return new Set(get().levels.flatMap((L) => L.items).filter((i) => isDone(i, keys)).map((i) => i.id)); }

/** Items whose most recent attempt failed. */
function lastFailed() {
  const rows = db.prepare("SELECT item_id, result FROM attempts a WHERE at = (SELECT MAX(at) FROM attempts b WHERE b.item_id = a.item_id)").all();
  return new Set(rows.filter((r) => r.result === "fail").map((r) => r.item_id));
}
/** Records a Check / Submit result. */
// ---- review mistakes: an exercise you failed, or solved with a hint, comes back after 1, 3 and 7 days;
// a clean solve (no hint) when it is due moves it to the next step, and the clean solve at the 7-day review removes it
db.exec("CREATE TABLE IF NOT EXISTS review_queue (item_id TEXT PRIMARY KEY, stage INTEGER NOT NULL, due_at TEXT NOT NULL, reason TEXT NOT NULL, added_at TEXT NOT NULL, last_at TEXT NOT NULL)");
const REVIEW_DAYS = [1, 3, 7];
const DAY_MS = 864e5;
function reviewAfterAttempt(id, pass, hints, now = Date.now()) {
  const row = db.prepare("SELECT * FROM review_queue WHERE item_id = ?").get(id);
  const at = new Date(now).toISOString(), dueIn = (stage) => new Date(now + REVIEW_DAYS[stage - 1] * DAY_MS).toISOString();
  if (!pass || hints > 0) {
    // a failure or a hint: (back) to the first step, due tomorrow
    db.prepare("INSERT INTO review_queue (item_id, stage, due_at, reason, added_at, last_at) VALUES (?, 1, ?, ?, ?, ?) ON CONFLICT(item_id) DO UPDATE SET stage = 1, due_at = excluded.due_at, reason = excluded.reason, last_at = excluded.last_at")
      .run(id, dueIn(1), pass ? "solved with a hint" : "failed", at, at);
    return;
  }
  if (!row || row.due_at > at) return; // clean, but not due yet: nothing changes
  if (row.stage >= REVIEW_DAYS.length) { db.prepare("DELETE FROM review_queue WHERE item_id = ?").run(id); return; }
  db.prepare("UPDATE review_queue SET stage = ?, due_at = ?, last_at = ? WHERE item_id = ?").run(row.stage + 1, dueIn(row.stage + 1), at, id);
}
/** Due now and coming up, with the item fields the learner app lists. */
function reviewList(now = Date.now()) {
  const c = get(), at = new Date(now).toISOString();
  const rows = db.prepare("SELECT * FROM review_queue ORDER BY due_at").all().filter((r) => (c.byId.has(r.item_id) && c.byId.get(r.item_id).status === "active") || r.item_id.startsWith("qc:"));
  const view = (r) => ({ id: r.item_id, stage: r.stage, of: REVIEW_DAYS.length, due_at: r.due_at, reason: r.reason, last_at: r.last_at, nextGap: REVIEW_DAYS[r.stage - 1] });
  return { due: rows.filter((r) => r.due_at <= at).map(view), upcoming: rows.filter((r) => r.due_at > at).map(view), days: REVIEW_DAYS };
}
function recordAttempt(id, result, hints) {
  if (!get().byId.has(id)) return false;
  const h = Math.max(0, Math.min(9, Number(hints) || 0));
  db.prepare("INSERT INTO attempts (item_id, result, hints, at) VALUES (?, ?, ?, ?)").run(id, result === "pass" ? "pass" : "fail", h, new Date().toISOString());
  reviewAfterAttempt(id, result === "pass", h);
  return true;
}

/** The list learners see: no source, no solutions. */
function publicList() {
  const { levels } = get();
  const keys = doneKeys();
  const bm = new Set(db.prepare("SELECT qid FROM bookmarks").all().map((r) => r.qid));
  const fails = lastFailed();
  return {
    baselineAt: BASELINE_AT,
    levels: levels.map((L) => ({ n: L.n, title: L.title, blurb: L.blurb, sections: L.sections })),
    datasets: Object.fromEntries(Object.values(DATASETS).map((d) => [d.key, d.label]).concat([["practice", "Practice database (retail + school)"], ["exercises", "Exercise databases"]])),
    items: levels.flatMap((L) => L.items.map((i) => ({
      id: i.id, level: i.level, section: L.sections ? L.sections[i.section].key : undefined, seq: i.seq, diff: i.diff, title: i.title, summary: i.summary || "", tables: i.tables || [], topic: i.topic || LEVEL_TOPIC[i.level], setup: i.level !== i.homeLevel || undefined,
      engine: i.kind, dataset: i.dataset, check: i.check, minutes: i.minutes || MINUTES[i.diff], added_at: i.added_at,
      done: isDone(i, keys), failed: !isDone(i, keys) && fails.has(i.id) || undefined, ordered: i.reference ? i.ordered : undefined, model: i.check === "self" && (i.modelAnswer || i.solution) ? true : undefined, prep: i.prep || undefined, accepted: i.accepted ? i.accepted.length : undefined, clock: i.clock || undefined, sample: i.sample || undefined, bookmarked: bm.has(i.id), dialects: i.kind === "server" ? (i.ref.postgres ? ["mysql", "postgres"] : ["mysql"]) : undefined,
    }))),
  };
}
function describe(body) {
  return String(body || "").replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”").split("\n")
    .filter((l) => l.trim() && !/^\s{3,}\S/.test(l) && !/^\s*(SELECT|FROM|WHERE|INSERT|UPDATE|DELETE|CREATE)\b/i.test(l)).join(" ").replace(/\s+/g, " ").trim().slice(0, 220);
}
/** One exercise for the learner (sqlite drills: text + dataset; server ones come from the course API). */
function publicItem(id) {
  const i = get().byId.get(id);
  if (!i || i.status !== "active") return null;
  const keys = doneKeys();
  return {
    id: i.id, level: i.level, seq: i.seq, diff: i.diff, title: i.title, body: i.body, intro: i.intro, topic: i.topic || LEVEL_TOPIC[i.level],
    engine: i.kind, dataset: i.dataset, check: i.check, minutes: i.minutes || MINUTES[i.diff], added_at: i.added_at, done: isDone(i, keys),
    dialects: i.kind === "server" ? (i.ref.postgres ? ["mysql", "postgres"] : ["mysql"]) : undefined, hasSolution: !!i.solution, hints: i.hints || undefined,
  };
}
/** The auto_setup exercises an exercise needs, as course codes ("D22-P001"), run before it. */
function setupCodesFor(id) {
  const c = get(), i = c.byId.get(id);
  if (!i) return [];
  return (i.prereqs || []).map((p) => c.byId.get(p)).filter((q) => q && q.status === "auto_setup" && q.code).map((q) => q.code);
}
/** The original course exercise id for a dialect ("mysql:D05-C03"). */
function courseRef(id, dialect) {
  const i = get().byId.get(id);
  if (!i || i.kind !== "server") return null;
  return (dialect === "postgres" && i.ref.postgres) || i.ref.mysql;
}
function datasetSql(key) {
  const site = SITE_OF_DATASET[key];
  if (!site) return null;
  const seen = new Set();
  return db.prepare(`SELECT f.name, f.content FROM files f JOIN folders fo ON fo.id = f.folder_id WHERE fo.site_id = ? AND f.type = 'sql' ORDER BY fo.order_index, f.order_index`).all(site)
    .filter((f) => !seen.has(f.name) && seen.add(f.name)).map((f) => f.content);
}
function primaryKey(id) { const i = get().byId.get(id); return i ? i.legacy_keys[0] : null; }
/** Write-query drill: { site, sql, setup, freeValues } for the MySQL state check, or null. */
function stateRefOf(id) {
  const i = get().byId.get(id);
  if (!i || i.check !== "state") return null;
  const site = Object.keys(DATASETS).find((k) => DATASETS[k].key === i.dataset);
  return site ? { site, sql: i.solution, ...i.state } : null;
}
function acceptedOf(id) { const i = get().byId.get(id); return i && i.accepted ? i.accepted : null; }
function modelAnswerOf(id) { const i = get().byId.get(id); return i && i.modelAnswer ? i.modelAnswer : null; }
function solutionOf(id) { const i = get().byId.get(id); return i && i.solution ? i.solution : null; }
/** Hint context: which schema the AI should see. */
function hintSite(id, dialect) {
  const i = get().byId.get(id);
  if (!i) return "";
  if (i.kind === "sqlite") return SITE_OF_DATASET[i.dataset] || "";
  const ex = i.source === "exercises";
  return dialect === "postgres" ? (ex ? "expg" : "coursepg") : ex ? "exmysql" : "coursemysql";
}

/** Completions as library items: [{ id, at }] (MCQ keys pass through as "mcq:<id>"). */
function activity() {
  const { byLegacy } = get();
  return db.prepare("SELECT qid, updated_at AS at FROM progress WHERE done = 1 ORDER BY updated_at").all()
    .map((r) => ({ id: r.qid.startsWith("mcq:") ? r.qid : byLegacy.get(r.qid) || null, at: r.at }));
}
function connectionFor(id, dialect) {
  const i = get().byId.get(id);
  if (!i || i.kind !== "server") return null;
  const ex = i.source === "exercises";
  return dialect === "postgres" ? (ex ? "expg" : "coursepg") : ex ? "exmysql" : "coursemysql";
}

module.exports = {
  doneIds, activity, connectionFor, BASELINE_AT, recordAttempt, summary, setupCodesFor,
  LEVELS, DATASETS, registerDataset, reloadCustomDatasets, TOPIC_LEVEL, build, get, publicList, publicItem, courseRef, datasetSql, primaryKey, solutionOf, reviewList, reviewAfterAttempt, REVIEW_DAYS, acceptedOf, modelAnswerOf, stateRefOf, hintSite, clean, levelFromSql,
};
