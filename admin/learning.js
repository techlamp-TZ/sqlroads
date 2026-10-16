// Admin side of the 5-stage learning model: coverage per concept (what is live and what is still a draft),
// editing a concept, AI re-tagging of its exercises, and "fill gaps" generation runs (admin/stage-gen.js).
const db = require("../db.js");
const cc = require("../library/concepts.js");
const learn = require("../library/learn.js");

// Understand exceptions (user decisions 2026-10-15): ACID / isolation, cursors, random rows and query rewrites are
// understood through flashcards + MCQs; Level 14 project concepts through the concept card + the project tasks.
// Everything else: predict items.
const UNDERSTAND_EXCEPTION = { "acid-and-isolation-levels": "flashcards", "cursors-and-routine-design": "flashcards", "random-sampling": "flashcards", "query-rewrites-for-speed": "flashcards" };
// stages a concept has no items for (user decision 2026-10-15): Random rows' results are random, so no practise or
// transfer exercise can be checked; it is covered without them
const STAGE_EXCEPTION = { "random-sampling": { stages: ["practise", "transfer"], why: "random results: no checkable practise or transfer" } };
const understandRule = (c) => (c.level === 14 ? "project" : UNDERSTAND_EXCEPTION[c.slug] || "predict");
const UNDERSTAND_NOTE = { flashcards: "Understand = 5+ flashcards and 1+ MCQ (no predict items)", project: "Understand = concept card + project tasks" };
// what a concept needs before its stage counts as covered (Level 14: no flashcards and no practise)
const TARGET = { flashcards: 5, predicts: 2, practise: 3, transfer: 1 };
const STAGE_KIND = { flashcards: "flashcard", predicts: "predict" };

function draftCounts() {
  const out = new Map();
  const get = (slug) => { if (!out.has(slug)) out.set(slug, { flashcards: 0, predicts: 0, practise: 0, transfer: 0, mcqs: 0, warn: 0 }); return out.get(slug); };
  for (const r of db.prepare("SELECT kind, concept, json_extract(verify, '$.status') v FROM stage_items WHERE status = 'draft' AND kind IN ('flashcard', 'predict')").all()) { const g = get(r.concept); g[r.kind === "flashcard" ? "flashcards" : "predicts"]++; if (r.v !== "pass") g.warn++; }
  for (const r of db.prepare("SELECT data, json_extract(verify, '$.status') v FROM content_items WHERE kind = 'drill' AND status = 'draft' AND (source LIKE 'ai:stage%' OR source = 'mine')").all()) {
    const d = JSON.parse(r.data);
    (d.concepts || []).forEach((s) => { const g = get(s); g[d.stage === "transfer" ? "transfer" : "practise"]++; if (r.v !== "pass") g.warn++; });
  }
  // draft MCQs tagged to a concept (the flashcards + MCQ rule for Understand)
  for (const r of db.prepare("SELECT t.concepts, json_extract(i.verify, '$.status') v FROM item_tags t JOIN content_items i ON i.id = substr(t.key, 5) WHERE t.kind = 'mcq' AND t.status = 'ok' AND i.kind = 'mcq' AND i.status = 'draft'").all()) {
    JSON.parse(r.concepts || "[]").forEach((s) => { const g = get(s); g.mcqs++; if (r.v !== "pass") g.warn++; });
  }
  return out;
}
function reviewTags() {
  const out = new Map();
  for (const r of db.prepare("SELECT concepts FROM item_tags WHERE status = 'review'").all()) for (const s of JSON.parse(r.concepts || "[]")) out.set(s, (out.get(s) || 0) + 1);
  return out;
}
/** Per level and concept: live counts per stage, drafts waiting, gaps, and the share fully covered. */
function coverage() {
  const map = learn.contentMap(), drafts = draftCounts(), inReview = reviewTags();
  const levels = [];
  let total = 0, covered = 0, coveredWithDrafts = 0;
  const gapCount = { memorize: 0, understand: 0, practise: 0, reflect: 0, transfer: 0 };
  for (const c of map.concepts) {
    const p = map.per.get(c.slug), d = drafts.get(c.slug) || { flashcards: 0, predicts: 0, practise: 0, transfer: 0, mcqs: 0, warn: 0 };
    const l14 = c.level === 14, ex = STAGE_EXCEPTION[c.slug];
    const na = l14 ? ["memorize", "practise"] : ex ? ex.stages : [];
    const live = {
      flashcards: p.flashcards.length, memorizeMcq: p.mcqs.memorize.length,
      predicts: p.predicts.length, understandMcq: p.mcqs.understand.length,
      practise: p.practise.length, transfer: p.transfer.length,
    };
    const need = (n, k) => n >= TARGET[k];
    const gapsLive = [], gapsAll = [];
    const check = (stage, ok, okWithDrafts) => { if (!ok) gapsLive.push(stage); if (!okWithDrafts) gapsAll.push(stage); };
    check("memorize", l14 || need(live.flashcards, "flashcards"), l14 || need(live.flashcards + d.flashcards, "flashcards"));
    // Understand: predict-the-output (or predict the end state) items, except where the user set another rule
    const rule = understandRule(c);
    const mcqs = live.memorizeMcq + live.understandMcq;
    if (rule === "project") check("understand", live.transfer >= TARGET.transfer, live.transfer + d.transfer >= TARGET.transfer);
    else if (rule === "flashcards") check("understand", need(live.flashcards, "flashcards") && mcqs >= 1, need(live.flashcards + d.flashcards, "flashcards") && mcqs + d.mcqs >= 1);
    else check("understand", need(live.predicts, "predicts"), need(live.predicts + d.predicts, "predicts"));
    check("practise", na.includes("practise") || need(live.practise, "practise"), na.includes("practise") || need(live.practise + d.practise, "practise"));
    // Reflect is covered for every concept by the learner's reflection box (decision of Part 1)
    check("transfer", na.includes("transfer") || need(live.transfer, "transfer"), na.includes("transfer") || need(live.transfer + d.transfer, "transfer"));
    gapsLive.forEach((g) => gapCount[g]++);
    total++; if (!gapsLive.length) covered++; if (!gapsAll.length) coveredWithDrafts++;
    let L = levels.find((x) => x.level === c.level);
    if (!L) levels.push((L = { level: c.level, concepts: [] }));
    L.concepts.push({ slug: c.slug, name: c.name, summary: c.summary, keywords: c.keywords, ord: c.ord, level: c.level, live, drafts: d, tagsInReview: inReview.get(c.slug) || 0, understandRule: rule, understandNote: UNDERSTAND_NOTE[rule] || null, gaps: gapsLive, gapsWithDrafts: gapsAll, na, naWhy: l14 ? "not used in Level 14" : ex ? ex.why : null });
  }
  for (const L of levels) { L.covered = L.concepts.filter((c) => !c.gaps.length).length; L.total = L.concepts.length; }
  const exceptions = { flashcards: levels.flatMap((L) => L.concepts).filter((x) => x.understandRule === "flashcards").map((x) => x.name), noPractiseTransfer: levels.flatMap((L) => L.concepts).filter((x) => x.level !== 14 && x.na.includes("transfer")).map((x) => x.name) };
  return { exceptions, total, covered, pct: total ? Math.round((100 * covered) / total) : 0, coveredWithDrafts, pctWithDrafts: total ? Math.round((100 * coveredWithDrafts) / total) : 0, gapCount, target: TARGET, levels };
}

/** Edits a concept's name, summary, keywords or order. */
function updateConcept(slug, b = {}) {
  const c = db.prepare("SELECT * FROM concepts WHERE slug = ?").get(slug);
  if (!c) throw Object.assign(new Error("No such concept"), { status: 404 });
  const name = b.name != null ? String(b.name).trim().slice(0, 120) : c.name;
  const summary = b.summary != null ? String(b.summary).trim().slice(0, 400) : c.summary;
  let keywords = c.keywords;
  if (b.keywords != null) keywords = JSON.stringify(String(b.keywords).split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12));
  const ord = b.ord != null && Number.isFinite(Number(b.ord)) ? Math.max(1, Math.round(Number(b.ord))) : c.ord;
  if (!name) throw Object.assign(new Error("A concept needs a name"), { status: 400 });
  db.prepare("UPDATE concepts SET name = ?, summary = ?, keywords = ?, ord = ? WHERE slug = ?").run(name, summary, keywords, ord, slug);
  return db.prepare("SELECT * FROM concepts WHERE slug = ?").get(slug);
}

/**
 * Re-tags the exercises and MCQs tagged with a concept: the AI proposes concepts again (a second provider reviews,
 * disagreements go to the review queue). Each item keeps its learning stage (the transfer rules set those).
 */
async function retagConcept(slug) {
  if (!db.prepare("SELECT 1 FROM concepts WHERE slug = ?").get(slug)) throw Object.assign(new Error("No such concept"), { status: 404 });
  const tagged = db.prepare("SELECT key, concepts, stage, status FROM item_tags").all().filter((t) => JSON.parse(t.concepts || "[]").includes(slug));
  const keys = new Set(tagged.map((t) => t.key));
  const before = new Map(tagged.map((t) => [t.key, t]));
  const items = cc.itemsForTagging().filter((x) => keys.has(x.key));
  const concepts = cc.allConcepts();
  const cost0 = cc.cost();
  let ok = 0, review = 0;
  for (let i = 0; i < items.length; i += 20) { const r = await cc.tagBatch(items.slice(i, i + 20), concepts); ok += r.ok; review += r.review; }
  let changed = 0;
  for (const t of db.prepare("SELECT key, concepts, stage FROM item_tags").all().filter((x) => keys.has(x.key))) {
    const b = before.get(t.key);
    if (t.stage !== b.stage) db.prepare("UPDATE item_tags SET stage = ? WHERE key = ?").run(b.stage, t.key);
    if (t.concepts !== b.concepts) changed++;
  }
  return { items: items.length, changed, review, cost: +(cc.cost() - cost0).toFixed(4) };
}

// ---------- fill-gaps runs (one at a time) ----------
// cost per concept and stage = typical tokens (from the Part 2 runs, incl. retries and repair) x the roles' prices
// (hints.js). DeepSeek is priced at its peak rate, and its budget includes the reasoning it does before answering.
const TOKENS = {
  flashcard: { generator: [3500, 2500], reviewer: [2500, 4000] },
  predict: { generator: [10000, 4500], reviewer: [2500, 4000] },
  practise: { generator: [9000, 3500], reviewer: [7000, 9000], tieBreaker: [1500, 400] },
  transfer: { generator: [10000, 4000], reviewer: [8000, 10000], tieBreaker: [1500, 400] },
};
function unitCost(stage) {
  const { ROLES, PRICE } = require("../hints.js");
  return Object.entries(TOKENS[stage]).reduce((sum, [role, [inp, out]]) => { const p = PRICE[ROLES[role].model]; return sum + (p ? (inp * p[0] + out * p[1]) / 1e6 : 0); }, 0);
}
const UNIT_COST = new Proxy({}, { get: (_, k) => unitCost(k) });
function needs(levels, stages) {
  const cov = coverage();
  const out = { flashcard: 0, predict: 0, practise: 0, transfer: 0 };
  for (const L of cov.levels) {
    if (levels && !levels.includes(L.level)) continue;
    for (const c of L.concepts) {
      const has = (k, live) => live + c.drafts[k];
      if (stages.includes("flashcard") && c.level < 14 && has("flashcards", c.live.flashcards) < TARGET.flashcards) out.flashcard++;
      if (stages.includes("predict") && c.understandRule === "predict" && has("predicts", c.live.predicts) < TARGET.predicts) out.predict++;
      if (stages.includes("practise") && c.level < 14 && has("practise", c.live.practise) < TARGET.practise) out.practise++;
      if (stages.includes("transfer") && c.level < 14 && has("transfer", c.live.transfer) < TARGET.transfer) out.transfer++;
    }
  }
  const cost = Object.entries(out).reduce((s, [k, n]) => s + n * UNIT_COST[k], 0);
  return { concepts: out, estimate: +cost.toFixed(2) };
}
const STAGES = ["flashcard", "predict", "practise", "transfer"];
let job = null;
function startFill({ level, stages }) {
  if (job && job.running) throw Object.assign(new Error("A fill-gaps run is already going."), { status: 409 });
  const lv = Number(level);
  if (!(lv >= 1 && lv <= 14)) throw Object.assign(new Error("Pick a level"), { status: 400 });
  const st = (Array.isArray(stages) && stages.length ? stages : STAGES).filter((s) => STAGES.includes(s));
  if (!st.length) throw Object.assign(new Error("Pick a stage"), { status: 400 });
  const plan = needs([lv], st);
  const sg = require("./stage-gen.js");
  const before = JSON.parse(JSON.stringify(sg.stats)), cost0 = cc.cost();
  job = { id: Date.now(), level: lv, stages: st, plan, running: true, progress: "starting…", startedAt: new Date().toISOString(), result: null, error: null };
  const mine = job;
  sg.fillGaps({ levels: [lv], stages: st, onProgress: (t) => { mine.progress = t; } }).then((r) => {
    const made = {}, dropped = {};
    for (const k of Object.keys(r.stats)) { made[k] = r.stats[k].made - before[k].made; dropped[k] = r.stats[k].dropped - before[k].dropped; }
    mine.result = { made, dropped, repaired: r.repaired, cost: +(cc.cost() - cost0).toFixed(3) };
  }).catch((e) => { mine.error = e.message; }).finally(() => { mine.running = false; mine.endedAt = new Date().toISOString(); });
  return job;
}
const fillStatus = () => job;


/**
 * Drafts that block coverage: suppose bulk Approve publishes everything it would (passed checks and, unless
 * includeRewritten, not rewritten by AI). A concept still short in a stage then needs the remaining drafts of that
 * stage: those are its blockers. Returns { [draftId]: [{ slug, name, level, stage }] } and the concepts they unblock.
 */
function blockers({ includeRewritten = false } = {}) {
  const cov = coverage();
  const bulkOk = (v) => v && v.status === "pass" && (includeRewritten || !v.rewritten);
  const drafts = [];
  for (const r of db.prepare("SELECT id, kind, concept, verify FROM stage_items WHERE status = 'draft' AND kind IN ('flashcard', 'predict')").all()) drafts.push({ id: r.id, concepts: [r.concept], key: r.kind === "flashcard" ? "flashcards" : "predicts", v: JSON.parse(r.verify || "{}") });
  for (const r of db.prepare("SELECT id, data, verify FROM content_items WHERE kind = 'drill' AND status = 'draft' AND source LIKE 'ai:stage%'").all()) { const d = JSON.parse(r.data); drafts.push({ id: r.id, concepts: d.concepts || [], key: d.stage === "transfer" ? "transfer" : "practise", v: JSON.parse(r.verify || "{}") }); }
  const STAGE_OF = { flashcards: "memorize", predicts: "understand", practise: "practise", transfer: "transfer" };
  const out = {}, unblocks = [];
  for (const L of cov.levels) for (const c of L.concepts) {
    const short = [];
    for (const key of Object.keys(STAGE_OF)) {
      if (c.na.includes(STAGE_OF[key])) continue;
      const mine = drafts.filter((d) => d.key === key && d.concepts.includes(c.slug));
      const projected = c.live[key] + mine.filter((d) => bulkOk(d.v)).length;
      if (projected >= TARGET[key]) continue;
      const need = mine.filter((d) => !bulkOk(d.v));
      if (!need.length) continue;
      short.push(STAGE_OF[key]);
      for (const d of need) (out[d.id] = out[d.id] || []).push({ slug: c.slug, name: c.name, level: c.level, stage: STAGE_OF[key] });
    }
    if (short.length) unblocks.push({ slug: c.slug, name: c.name, level: c.level, stages: short });
  }
  return { items: out, concepts: unblocks };
}


/** The tagged exercises and MCQs of a concept (any stage), and its generated drafts, for the Concepts page. */
function conceptItems(slug) {
  if (!db.prepare("SELECT 1 FROM concepts WHERE slug = ?").get(slug)) throw Object.assign(new Error("No such concept"), { status: 404 });
  const lib = require("../library/library.js").get();
  const mcqs = new Map(require("./content.js").publicMcqs().map((m) => [String(m.id), m]));
  const tagged = db.prepare("SELECT key, kind, level, concepts, stage, status, source FROM item_tags").all().filter((t) => JSON.parse(t.concepts || "[]").includes(slug)).map((t) => {
    const id = t.key.slice(t.kind === "mcq" ? 4 : 5), it = t.kind === "mcq" ? mcqs.get(id) : lib.byId.get(id);
    return { key: t.key, kind: t.kind, level: t.level, stage: t.stage, status: t.status, source: t.source, main: JSON.parse(t.concepts)[0] === slug, title: it ? (t.kind === "mcq" ? it.q : it.title) : id, diff: it ? it.diff : null };
  });
  const order = { transfer: 0, practise: 1, reflect: 2, understand: 3, memorize: 4 };
  tagged.sort((a, b) => (order[a.stage] ?? 9) - (order[b.stage] ?? 9) || a.level - b.level || String(a.title).localeCompare(String(b.title)));
  const drafts = db.prepare("SELECT id, data, status FROM content_items WHERE kind = 'drill' AND source LIKE 'ai:stage%' AND status = 'draft'").all().map((r) => ({ id: r.id, d: JSON.parse(r.data) })).filter((x) => (x.d.concepts || []).includes(slug)).map((x) => ({ id: x.id, title: x.d.title, stage: x.d.stage }));
  return { slug, items: tagged, drafts };
}

module.exports = { understandRule, conceptItems, blockers, coverage, updateConcept, retagConcept, needs, startFill, fillStatus, TARGET, UNIT_COST };
