// Admin read models: sidebar counts, global search, the Library list and one exercise's details.
// Everything is computed from the library build (library.js) and the content tables, never typed in.
const db = require("../db.js");
const library = require("../library/library.js");
const content = require("./content.js");

const ORIGIN = (src) => (src.startsWith("drills:") ? "built-in drill" : src === "course30" ? "30-day course" : src === "exercises" ? "SQL Exercises set" : src === "admin" ? "added in admin" : src);
const flat = (s) => String(s || "").replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”").replace(/\s+/g, " ").trim();

function liveMcqs() { return content.allMcqs().filter((m) => m.status === "published"); }

/** Counts for the sidebar badges. */
/** Everything waiting in the review queue, counted once: MCQ / drill drafts, reference answers to check, learning-model
 *  drafts (flashcards, predict items, lessons) and concept tags. The sidebar and the Overview both use this. */
function queueCounts() {
  const drafts = content.allItems("mcq").concat(content.allItems("drill")).filter((i) => i.status === "draft").length;
  const refReview = require("../library/refs.js").reviewList().length;
  const stage = db.prepare("SELECT COUNT(*) n FROM stage_items WHERE status = 'draft'").get().n;
  const tags = db.prepare("SELECT COUNT(*) n FROM item_tags WHERE status = 'review'").get().n;
  return { total: drafts + refReview + stage + tags, drafts, refReview, stage, tags };
}
function navCounts() {
  const s = library.summary(), q = queueCounts();
  return { queue: q.total, drafts: q.drafts, refReview: q.refReview, stage: q.stage, tags: q.tags, library: s.total, mcqs: liveMcqs().length, health: require("./health.js").summary().open };
}

/** Grouped search over exercises (title, prompt, level), MCQs and levels. */
function search(q, limit = 6) {
  q = String(q || "").trim().toLowerCase();
  if (q.length < 2) return { q, groups: [] };
  const words = q.split(/\s+/);
  const hit = (text) => words.every((w) => text.includes(w));
  const c = library.get();
  const levelName = (n) => `Level ${n} · ${library.LEVELS[n - 1].title}`;
  const exercises = [];
  for (const i of c.active) {
    const head = `${i.title} ${i.summary || ""}`.toLowerCase();
    const text = `${head} ${flat(i.body).toLowerCase()} ${levelName(i.level).toLowerCase()} ${(i.tables || []).join(" ")}`;
    if (hit(text)) exercises.push({ id: i.id, title: i.title, sub: `${levelName(i.level)} · ${i.diff}${(i.tables || []).length ? " · " + i.tables.join(", ") : ""}`, rank: hit(i.title.toLowerCase()) ? 0 : hit(head) ? 1 : 2 });
  }
  exercises.sort((a, b) => a.rank - b.rank);
  const mcqs = content.allMcqs().filter((m) => hit(`${m.q} ${(m.options || []).join(" ")} ${m.code || ""}`.toLowerCase()))
    .map((m) => ({ id: m.id, title: m.q, sub: `${levelName(Number(m.level) || 1)} · ${m.diff} · ${m.status === "published" ? "live" : m.status}` }));
  const levels = library.LEVELS.filter((L) => hit(`level ${L.n} ${L.title} ${L.blurb}`.toLowerCase()))
    .map((L) => ({ id: String(L.n), title: `Level ${L.n} · ${L.title}`, sub: `${c.levels[L.n - 1].items.length} exercises` }));
  const group = (key, label, list) => ({ key, label, total: list.length, items: list.slice(0, limit).map(({ rank, ...x }) => x) });
  return { q, groups: [group("levels", "Levels", levels), group("exercises", "Exercises", exercises), group("mcqs", "MCQs", mcqs)].filter((g) => g.total) };
}

/** The Library page: every exercise, filterable, one page at a time. */
function libraryItems(f) {
  const c = library.get();
  const q = String(f.q || "").trim().toLowerCase();
  let list = (f.status === "auto_setup" ? c.setups : c.active).slice().sort((a, b) => a.level - b.level || a.seq - b.seq);
  if (f.level) list = list.filter((i) => i.level === Number(f.level));
  if (f.diff) list = list.filter((i) => i.diff === f.diff);
  if (f.check === "self") list = list.filter((i) => i.check === "self");
  if (f.check === "auto") list = list.filter((i) => i.check !== "self");
  if (f.engine) list = list.filter((i) => (f.engine === "server" ? i.kind === "server" : i.kind !== "server"));
  if (f.origin) list = list.filter((i) => ORIGIN(i.source) === f.origin);
  if (f.section) list = list.filter((i) => i.level === 14 && library.LEVELS[13].sections[i.section].key === f.section);
  if (q) list = list.filter((i) => `${i.title} ${i.summary || ""} ${flat(i.body)} ${(i.tables || []).join(" ")}`.toLowerCase().includes(q));
  const size = Math.min(100, Math.max(10, Number(f.size) || 25));
  const pages = Math.max(1, Math.ceil(list.length / size));
  const page = Math.min(pages - 1, Math.max(0, Number(f.page) || 0));
  return {
    total: list.length, page, pages, size,
    items: list.slice(page * size, page * size + size).map((i) => ({
      id: i.id, level: i.level, seq: i.seq, title: i.title, summary: i.summary || "", diff: i.diff, check: i.check, engine: i.kind === "server" ? "server" : "browser",
      tables: i.tables || [], origin: ORIGIN(i.source), added_at: i.added_at,
    })),
    origins: [...new Set(c.active.map((i) => ORIGIN(i.source)))],
  };
}

/** One exercise as the admin sees it: text, solution, where it came from, what it links to. */
function itemDetail(id) {
  const c = library.get();
  const i = c.byId.get(id);
  if (!i) return null;
  let solution = i.solution || "", extra = {};
  if (i.kind === "server") {
    const ex = db.prepare("SELECT solution_sql, check_mode, objective FROM course_exercises WHERE id = ?").get(i.ref.mysql) || {};
    solution = ex.solution_sql || "";
    extra = { check_mode: ex.check_mode, objective: library.clean(ex.objective || "") };
  }
  const refs = [...String(i.body || "").matchAll(/\[\[ref:([^|]+)\|([^\]]+)\]\]/g)].map((m) => ({ id: m[1], title: (c.byId.get(m[1]) || {}).title || m[2], ok: !!(c.byId.get(m[1]) && c.byId.get(m[1]).status === "active") }));
  return {
    id: i.id, status: i.status, title: i.title, original_title: i.origTitle || i.title, summary: i.summary || "", body: i.body || "", level: i.level, seq: i.seq,
    level_title: library.LEVELS[i.level - 1].title, diff: i.diff, check: i.check, engine: i.kind === "server" ? "server" : "browser", dataset: i.dataset,
    tables: i.tables || [], origin: ORIGIN(i.source), source_ref: i.source_ref, added_at: i.added_at, solution, prereqs: (i.prereqs || []).map((p) => ({ id: p, title: (c.byId.get(p) || {}).title || p, auto: (c.byId.get(p) || {}).status === "auto_setup" })),
    refs, legacy_keys: i.legacy_keys, ...extra,
    auto_setup: i.status === "auto_setup", supports: (i.supports || []).map((p) => ({ id: p, title: (c.byId.get(p) || {}).title || p, level: (c.byId.get(p) || {}).level })),
  };
}

module.exports = { queueCounts, navCounts, search, libraryItems, itemDetail, ORIGIN };
