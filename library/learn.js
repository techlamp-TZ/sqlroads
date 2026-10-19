// The learner side of the 5-stage learning model: per-concept stage status, flashcard sessions (spaced
// repetition), predict-the-output answers, reflections ("My notes"), mastery and the dashboard's Today plan.
// Only PUBLISHED content reaches learners: approved flashcards / predict items (stage_items), exercises in the
// library (built-in ones and approved generated drills) and the tags that aren't waiting in the review queue.
// The rules themselves live in learn-rules.js.
const express = require("express");
const db = require("../db.js");
const lib = require("./library.js");
const R = require("./learn-rules.js");

db.exec(`
  CREATE TABLE IF NOT EXISTS flash_state (card_id TEXT PRIMARY KEY, concept TEXT NOT NULL, interval INTEGER NOT NULL, due_at TEXT NOT NULL,
    reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0, last_result TEXT, last_at TEXT);
  CREATE TABLE IF NOT EXISTS predict_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT NOT NULL, concept TEXT NOT NULL, correct INTEGER NOT NULL, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS concept_seen (concept TEXT PRIMARY KEY, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS reflections (id INTEGER PRIMARY KEY AUTOINCREMENT, item_id TEXT, concepts TEXT NOT NULL, result TEXT,
    explain TEXT, mistake TEXT, confidence INTEGER, sql TEXT, feedback TEXT, at TEXT NOT NULL);
  -- every stage action (a flashcard answered, a prediction, a concept card read, a reflection): the daily goal counts them
  CREATE TABLE IF NOT EXISTS learn_events (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, ref TEXT, concept TEXT, at TEXT NOT NULL);
  -- mastery is kept once earned; 'record' is what the concept had then (learn-rules.masteryState)
  CREATE TABLE IF NOT EXISTS concept_mastery (concept TEXT PRIMARY KEY, record TEXT NOT NULL, at TEXT NOT NULL);
  -- the extra card types (kind "card": optional practice) have their own schedule, so Memorize never counts them
  CREATE TABLE IF NOT EXISTS card_state (card_id TEXT PRIMARY KEY, concept TEXT NOT NULL, interval INTEGER NOT NULL, due_at TEXT NOT NULL,
    reps INTEGER NOT NULL DEFAULT 0, lapses INTEGER NOT NULL DEFAULT 0, confidence INTEGER, last_result TEXT, last_at TEXT);
  -- the Today plan's Challenge slot: what was answered, how sure the learner was (1-5, as in the Reflect box)
  CREATE TABLE IF NOT EXISTS challenge_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, ref TEXT NOT NULL, kind TEXT NOT NULL, concept TEXT, correct INTEGER NOT NULL, confidence INTEGER, at TEXT NOT NULL);
`);
// Learn: a concept's lesson read through the guided path (not part of mastery)
db.exec("CREATE TABLE IF NOT EXISTS lesson_read (concept TEXT PRIMARY KEY, at TEXT NOT NULL)");
try { db.exec("ALTER TABLE reflections ADD COLUMN source TEXT"); } catch {} // the Mistake reflection card's notes ('mistake_card')
// the content tables are made by concepts.js and stage-gen.js; they're required here so a fresh database works too
require("./concepts.js");
db.exec(`CREATE TABLE IF NOT EXISTS stage_items (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('flashcard', 'predict', 'lesson', 'card')), concept TEXT NOT NULL, level INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'rejected')), data TEXT NOT NULL, verify TEXT, source TEXT NOT NULL,
  batch TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`);
const nowIso = () => new Date().toISOString();
const STAGE_NAMES = ["memorize", "understand", "practise", "reflect", "transfer"];

// ---------- the content map: which published items belong to which concept and stage ----------
function contentMap() {
  const c = lib.get();
  const visible = new Map(c.levels.flatMap((L) => L.items).map((i) => [i.id, i]));
  const concepts = db.prepare("SELECT slug, level, ord, name, summary, keywords FROM concepts ORDER BY level, ord").all();
  const per = new Map(concepts.map((x) => [x.slug, { ...x, practise: [], transfer: [], mcqs: { memorize: [], understand: [] }, flashcards: [], predicts: [], lessons: [], cards: [] }]));
  const add = (slug, stage, entry) => { const p = per.get(slug); if (p && p[stage]) p[stage].push(entry); };
  // built-in exercises and MCQs: their tags (tags still in the review queue don't count yet)
  const notLive = new Set(db.prepare("SELECT id FROM content_items WHERE kind = 'mcq' AND status != 'published'").all().map((r) => r.id));
  for (const t of db.prepare("SELECT key, kind, concepts, stage FROM item_tags WHERE status = 'ok'").all()) {
    const slugs = JSON.parse(t.concepts || "[]");
    if (t.kind === "mcq" && notLive.has(t.key.slice(4))) continue;
    if (t.kind === "mcq") { slugs.forEach((s) => { const p = per.get(s); if (p && p.mcqs[t.stage]) p.mcqs[t.stage].push(t.key.slice(4)); }); continue; }
    const it = visible.get(t.key.slice(5));
    if (!it || (t.stage !== "practise" && t.stage !== "transfer")) continue;
    slugs.forEach((s, k) => add(s, t.stage, { id: it.id, diff: it.diff, seq: it.seq, level: it.level, main: k === 0 }));
  }
  // generated drills approved in the admin: in the library as source "admin", concepts and stage in their data
  const bySource = new Map([...visible.values()].filter((i) => i.source === "admin").map((i) => [i.source_ref, i]));
  for (const r of db.prepare("SELECT id, data FROM content_items WHERE kind = 'drill' AND status = 'published' AND (source LIKE 'ai:stage%' OR source = 'mine')").all()) {
    const it = bySource.get(r.id), d = JSON.parse(r.data);
    if (!it) continue;
    (d.concepts || []).forEach((s, k) => add(s, d.stage === "transfer" ? "transfer" : "practise", { id: it.id, diff: it.diff, seq: it.seq, level: it.level, main: k === 0 }));
  }
  for (const r of db.prepare("SELECT id, kind, concept, data FROM stage_items WHERE status = 'published' ORDER BY created_at").all()) {
    const p = per.get(r.concept);
    // "card" items (extra interaction types) are optional practice: listed apart, never counted for a stage or mastery
    if (p) {
      const data = JSON.parse(r.data);
      p[r.kind === "flashcard" ? "flashcards" : r.kind === "lesson" ? "lessons" : r.kind === "card" ? "cards" : "predicts"].push({ id: r.id, ...data, concept: r.concept });
    }
  }
  return { concepts, per, visible };
}

// ---------- the learner's state ----------
function learnerState() {
  const done = lib.doneIds();
  const flash = new Map(db.prepare("SELECT * FROM flash_state").all().map((r) => [r.card_id, r]));
  const predictRight = new Set(db.prepare("SELECT DISTINCT item_id FROM predict_answers WHERE correct = 1").all().map((r) => r.item_id));
  const predictTried = new Set(db.prepare("SELECT DISTINCT item_id FROM predict_answers").all().map((r) => r.item_id));
  const seen = new Set(db.prepare("SELECT concept FROM concept_seen").all().map((r) => r.concept));
  const tried = new Set(db.prepare("SELECT DISTINCT item_id FROM attempts").all().map((r) => r.item_id));
  const reflections = new Map();
  for (const r of db.prepare("SELECT concepts FROM reflections WHERE source IS NULL").all()) for (const s of JSON.parse(r.concepts || "[]")) reflections.set(s, (reflections.get(s) || 0) + 1);
  const masteredRec = new Map(db.prepare("SELECT concept, record FROM concept_mastery").all().map((r) => [r.concept, JSON.parse(r.record)]));
  return { done, flash, predictRight, predictTried, seen, tried, reflections, masteredRec };
}
/** One concept: its items per stage, the learner's numbers, stage statuses and mastery. */
function conceptInfo(p, st, now = Date.now()) {
  const set = R.practiseSet(p.practise);
  const setIds = new Set(set.map((i) => i.id));
  const more = R.orderPractise(p.practise.filter((i) => !setIds.has(i.id)));
  const transfer = p.transfer.slice().sort((a, b) => (a.seq || 0) - (b.seq || 0));
  const states = p.flashcards.map((f) => st.flash.get(f.id));
  const c = {
    level: p.level,
    flash: { total: p.flashcards.length, reviewed: states.filter(Boolean).length, atLeast3: states.filter((s) => s && s.interval >= 3 && s.last_result === "right").length, due: p.flashcards.filter((f) => st.flash.has(f.id) && R.isDue(st.flash.get(f.id), now)).length, fresh: states.filter((s) => !s).length },
    understand: { seen: st.seen.has(p.slug), predicts: p.predicts.length, correct: p.predicts.filter((x) => st.predictRight.has(x.id)).length, answered: p.predicts.filter((x) => st.predictTried.has(x.id)).length },
    practise: { set: set.length, setDone: set.filter((i) => st.done.has(i.id)).length, anyDone: p.practise.some((i) => st.done.has(i.id)), total: p.practise.length, hardInSet: set.some((i) => i.diff === "hard"), ids: set.map((i) => i.id) },
    reflections: st.reflections.get(p.slug) || 0,
    transfer: { total: transfer.length, passed: transfer.filter((i) => st.done.has(i.id)).length, tried: transfer.some((i) => st.tried.has(i.id)) },
  };
  const ms = R.masteryState(c, st.masteredRec.get(p.slug) || null);
  if (ms.earnedNow) { const rec = R.masteryRecord(c); db.prepare("INSERT INTO concept_mastery (concept, record, at) VALUES (?, ?, ?) ON CONFLICT(concept) DO NOTHING").run(p.slug, JSON.stringify(rec), nowIso()); st.masteredRec.set(p.slug, rec); }
  return {
    slug: p.slug, name: p.name, summary: p.summary, level: p.level, ord: p.ord, keywords: p.keywords,
    counts: c, stages: R.stages(c), mastered: ms.mastered, newItems: ms.newItems, masteredAt: st.masteredRec.has(p.slug) ? true : undefined, transferUnlocked: R.transferUnlocked(c),
    practiseSet: set.map((i) => i.id), practiseMore: more.map((i) => i.id), transferItems: transfer.map((i) => i.id),
  };
}
function levelInfo(n, map = contentMap(), st = learnerState()) {
  const list = map.concepts.filter((c) => c.level === n).map((c) => conceptInfo(map.per.get(c.slug), st));
  const items = map.visible.size ? [...map.visible.values()].filter((i) => i.level === n) : [];
  const done = items.filter((i) => st.done.has(i.id)).length;
  const quizPassed = !!db.prepare("SELECT 1 FROM progress WHERE qid = ? AND done = 1").get("quiz:level-" + n);
  const masteredCount = list.filter((c) => c.mastered).length;
  // the level quiz draws from the level's live multiple-choice questions; a level without any has no quiz
  const hasQuiz = require("../admin/content.js").publicMcqs().some((m) => (m.level || 1) === n);
  return { level: n, concepts: list, masteredCount, total: list.length, items: items.length, done, quizPassed, hasQuiz, complete: R.levelComplete({ concepts: list.length, masteredCount, items: items.length, done, quizPassed, hasQuiz }) };
}

// ---------- events, reflections, failed transfers ----------
// ---------- the shared card engine (public/cards.js): upgrades, spot-the-bug data, the extra card types ----------
const Cards = require("../public/cards.js");
/** Approved upgrades (kind "card", card_type syntax_upgrade / mcq_upgrade) by the id of the item they enrich. */
function approvedUpgrades() {
  const m = new Map();
  for (const r of db.prepare("SELECT data FROM stage_items WHERE kind = 'card' AND status = 'published'").all()) { const d = JSON.parse(r.data); if (Cards.UPGRADES[d.card_type] && d.base_id) m.set(d.base_id, d); }
  return m;
}
/** A flashcard as the learner gets it: its card type, an approved upgrade, and for spot the bug the dataset + diagnoses. */
function flashOut(f, ctx) {
  const out = { ...f, card_type: Cards.cardTypeOf("flashcard", f) };
  const up = ctx.ups.get(f.id);
  if (up) { if (Array.isArray(up.accepted) && up.accepted.length) out.accepted = up.accepted; if (up.explanation) out.explanation = up.explanation; }
  if (f.type !== "keyword" && f.site && lib.DATASETS[f.site]) out.dataset = lib.DATASETS[f.site].key;
  if (f.type === "error") {
    out.dataset = lib.DATASETS[f.site] ? lib.DATASETS[f.site].key : undefined;
    const lv = (ctx.map.per.get(f.concept) || {}).level || 0;
    const near = ctx.errors.filter((e) => e.id !== f.id && Math.abs(e.level - lv) <= 1);
    out.diagnosis = Cards.diagnosisOptions(f, Cards.shuffle(near, f.id), f.id);
  }
  return out;
}
function flashCtx(map) {
  const errors = [];
  for (const p of map.per.values()) for (const f of p.flashcards) if (f.type === "error") errors.push({ id: f.id, explanation: f.explanation, level: p.level });
  return { map, ups: approvedUpgrades(), errors };
}
const standaloneCards = (p) => (p.cards || []).filter((c) => Cards.STANDALONE.includes(c.card_type));
const logEvent = (kind, ref, concept) => db.prepare("INSERT INTO learn_events (kind, ref, concept, at) VALUES (?, ?, ?, ?)").run(kind, ref || null, concept || null, nowIso());
/** The concepts an exercise practises (and whether it is one of their transfer tasks). */
function conceptsOfItem(id, map = contentMap()) {
  const out = [];
  for (const p of map.per.values()) {
    if (p.practise.some((i) => i.id === id)) out.push({ slug: p.slug, stage: "practise" });
    else if (p.transfer.some((i) => i.id === id)) out.push({ slug: p.slug, stage: "transfer" });
  }
  return out;
}
/** A failed transfer task sends its concepts' practise sets back into "Review mistakes" (due tomorrow). */
function afterAttempt(id, pass, now = Date.now()) {
  if (pass) return [];
  const map = contentMap();
  const transferOf = conceptsOfItem(id, map).filter((x) => x.stage === "transfer");
  const queued = [];
  const at = new Date(now).toISOString(), due = new Date(now + R.DAY_MS).toISOString();
  for (const x of transferOf) {
    for (const item of R.practiseSet(map.per.get(x.slug).practise)) {
      const r = db.prepare("INSERT INTO review_queue (item_id, stage, due_at, reason, added_at, last_at) VALUES (?, 1, ?, ?, ?, ?) ON CONFLICT(item_id) DO NOTHING")
        .run(item.id, due, "practise again: a transfer task on this concept failed", at, at);
      if (r.changes) queued.push(item.id);
    }
  }
  return queued;
}

// ---------- the Today plan ----------
function today({ level, weekend, now = Date.now() }) {
  const map = contentMap(), st = learnerState();
  const lv = Math.min(14, Math.max(1, Number(level) || 1));
  const infos = map.concepts.filter((c) => c.level <= lv).map((c) => conceptInfo(map.per.get(c.slug), st, now));
  const here = infos.filter((c) => c.level === lv);
  // flashcards: the ones due, else new cards of the first concept here still being memorized
  const due = [];
  for (const p of map.per.values()) for (const f of p.flashcards) { const s = st.flash.get(f.id); if (s && R.isDue(s, now)) due.push(f.id); }
  const learnNew = here.find((c) => c.stages.memorize === "todo" || c.stages.memorize === "started");
  const understand = here.find((c) => c.stages.understand !== "done") || null;
  // practise: the next 5 not-done exercises of this level's practise sets, concept by concept
  const practise = [];
  for (const c of here) for (const id of c.practiseSet) if (practise.length < 5 && !st.done.has(id) && !practise.includes(id)) practise.push(id);
  // reflection: the latest exercise tried in the last 3 days without a note, else a concept without a reflection
  const noted = new Set(db.prepare("SELECT item_id FROM reflections WHERE item_id IS NOT NULL AND source IS NULL").all().map((r) => r.item_id));
  const since = new Date(now - 3 * R.DAY_MS).toISOString();
  const last = db.prepare("SELECT item_id, result FROM attempts WHERE at >= ? ORDER BY at DESC").all(since).find((a) => !noted.has(a.item_id) && map.visible.has(a.item_id));
  const reflectConcept = !last ? here.find((c) => !c.counts.reflections) || null : null;
  // weekends: one transfer challenge, from a concept whose transfer is unlocked
  let transfer = null;
  if (weekend) for (const c of infos.slice().reverse()) { if (!c.transferUnlocked || c.stages.transfer === "done") continue; const id = c.transferItems.find((x) => !st.done.has(x)); if (id) { transfer = { id, concept: c.slug, name: c.name }; break; } }
  const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
  const events = db.prepare("SELECT kind, COUNT(*) n FROM learn_events WHERE at >= ? GROUP BY kind").all(todayStart.toISOString());
  const challenge = challengeFor(map, st, here, now);
  return {
    level: lv,
    flashcards: { due: due.length, newConcept: learnNew ? { slug: learnNew.slug, name: learnNew.name, fresh: learnNew.counts.flash.fresh } : null },
    understand: understand && { slug: understand.slug, name: understand.name, stage: understand.stages.understand },
    practise,
    reflection: last ? { item: last.item_id, result: last.result } : reflectConcept ? { concept: reflectConcept.slug, name: reflectConcept.name } : null,
    transfer: weekend ? transfer || { none: true } : null,
    weekend: !!weekend,
    stageEvents: Object.fromEntries(events.map((e) => [e.kind, e.n])),
    challenge,
  };
}
/**
 * The Challenge: a due item first (flashcards and extra cards, the longest overdue), else one item of the weakest
 * concept of this level (most stages not done): a predict item not yet right, else a flashcard, else an extra card.
 */
function challengeFor(map, st, here, now) {
  const cands = [];
  for (const p of map.per.values()) for (const f of p.flashcards) { const s = st.flash.get(f.id); if (s && R.isDue(s, now)) cands.push({ ref: f.id, kind: "flashcard", concept: f.concept, due_at: s.due_at }); }
  for (const r of db.prepare("SELECT card_id, concept, due_at FROM card_state").all()) if (Date.parse(r.due_at) <= now) cands.push({ ref: r.card_id, kind: "card", concept: r.concept, due_at: r.due_at });
  for (const c of here) {
    if (c.mastered) continue;
    const weakness = Object.values(c.stages).filter((s) => s !== "done" && s !== "na").length;
    const p = map.per.get(c.slug);
    const po = p.predicts.find((x) => !st.predictRight.has(x.id)), fc = p.flashcards[0], cd = standaloneCards(p)[0];
    const it = po ? { ref: po.id, kind: "predict" } : fc ? { ref: fc.id, kind: "flashcard" } : cd ? { ref: cd.id, kind: "card" } : null;
    if (it && weakness) cands.push({ ...it, concept: c.slug, weakness });
  }
  const pick = Cards.pickChallenge(cands, now);
  if (!pick) return null;
  const p = map.per.get(pick.concept);
  const find = (list) => (list || []).find((x) => x.id === pick.ref);
  let item = null;
  if (pick.kind === "flashcard") item = flashOut(find(p.flashcards), flashCtx(map));
  else if (pick.kind === "predict") { const x = find(p.predicts); item = x && { ...x, dataset: x.variant !== "endstate" && lib.DATASETS[x.site] ? lib.DATASETS[x.site].key : undefined }; }
  else item = find(p.cards);
  return item ? { ref: pick.ref, kind: pick.kind, concept: pick.concept, name: p.name, why: pick.why, item } : null;
}

// ---------- AI feedback on a reflection (optional, off by default in the learner settings) ----------
async function reflectionFeedback(r, itemTitle) {
  const hints = require("../hints.js");
  const out = await hints.complete({
    provider: "auto", maxTokens: 220,
    system: "You coach a SQL learner. They wrote a one-sentence explanation of their query (and maybe what their mistake was). In at most 3 short sentences: say what is right, correct anything wrong, and add one tip. Plain English, no code longer than one line.",
    user: `Exercise: ${itemTitle || "(concept reflection)"}\nResult: ${r.result || "-"}\nTheir SQL: ${r.sql || "-"}\nTheir explanation: ${r.explain || "-"}\nTheir mistake: ${r.mistake || "-"}\nConfidence (1-5): ${r.confidence || "-"}`,
  });
  return String(out.text || "").trim().slice(0, 1200);
}

// ---------- HTTP ----------
const router = express.Router();
const wrap = (fn) => async (req, res) => { try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); } };
const bad = (msg) => Object.assign(new Error(msg), { status: 400 });

router.get("/levels", wrap(() => {
  const map = contentMap(), st = learnerState();
  return Array.from({ length: 14 }, (_, k) => { const L = levelInfo(k + 1, map, st); return { level: L.level, masteredCount: L.masteredCount, total: L.total, complete: L.complete }; });
}));
router.get("/levels/:n", wrap((req) => levelInfo(Number(req.params.n))));
router.get("/concept/:slug", wrap((req) => {
  const map = contentMap(), p = map.per.get(req.params.slug);
  if (!p) throw Object.assign(new Error("No such concept"), { status: 404 });
  const st = learnerState(), info = conceptInfo(p, st);
  const level = levelInfo(p.level, map, st);
  return {
    ...info,
    siblings: level.concepts.map((c) => ({ slug: c.slug, name: c.name, mastered: c.mastered })),
    flashcards: (() => { const ctx = flashCtx(map); return p.flashcards.map((f) => ({ ...flashOut(f, ctx), state: st.flash.get(f.id) || null })); })(),
    // the extra card types: optional practice, with their own schedule
    cards: (() => { const cs = new Map(db.prepare("SELECT * FROM card_state").all().map((r) => [r.card_id, r])); return standaloneCards(p).map((c) => ({ ...c, state: cs.get(c.id) || null })); })(),
    // the dataset a predict item runs on (its schema panel); end-state items create their own tables
    predicts: p.predicts.map((x) => ({ ...x, dataset: x.variant !== "endstate" && lib.DATASETS[x.site] ? lib.DATASETS[x.site].key : undefined, right: st.predictRight.has(x.id), tried: st.predictTried.has(x.id) })),
    mcqs: p.mcqs,
    // the Study step (optional): approved lessons, without where they came from
    lessons: p.lessons.map((x) => ({ id: x.id, title: x.title, what: x.what, when: x.when, example: x.example, explain: x.explain, tip: x.tip, dataset: lib.DATASETS[x.site] ? lib.DATASETS[x.site].key : undefined })),
    lessonRead: !!db.prepare("SELECT 1 FROM lesson_read WHERE concept = ?").get(p.slug),
    reflections: db.prepare("SELECT * FROM reflections ORDER BY at DESC").all().filter((r) => JSON.parse(r.concepts).includes(p.slug)),
  };
}));
// A paginated learner-facing catalogue. The study session remains concept-based, but the catalogue lets learners
// browse the whole approved flashcard bank without sending tens of thousands of cards to the browser at once.
router.get("/flashcards", wrap((req) => {
  const q = String(req.query.q || "").trim().toLowerCase().slice(0, 120);
  const type = ["keyword", "blank", "order", "error"].includes(String(req.query.type || "")) ? String(req.query.type) : "all";
  const level = /^\d+$/.test(String(req.query.level || "")) ? Number(req.query.level) : 0;
  const concept = String(req.query.concept || "").trim().slice(0, 120);
  const sort = req.query.sort === "new" ? "new" : "path";
  const size = Math.min(100, Math.max(10, Number(req.query.size) || 25));
  const page = Math.max(0, Number(req.query.page) || 0);
  const where = ["s.kind = 'flashcard'", "s.status = 'published'"], params = [];
  if (level >= 1 && level <= 14) { where.push("s.level = ?"); params.push(level); }
  if (type !== "all") { where.push("json_extract(s.data, '$.type') = ?"); params.push(type); }
  if (concept) { where.push("s.concept = ?"); params.push(concept); }
  if (q) { const like = `%${q}%`; where.push("(lower(s.data) LIKE ? OR lower(s.concept) LIKE ? OR lower(COALESCE(c.name, '')) LIKE ?)"); params.push(like, like, like); }
  const from = "FROM stage_items s LEFT JOIN concepts c ON c.slug = s.concept WHERE " + where.join(" AND ");
  const total = db.prepare("SELECT COUNT(*) n " + from).get(...params).n;
  const pages = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(page, pages - 1), offset = safePage * size;
  const order = sort === "new" ? "s.created_at DESC, s.id DESC" : "s.level, s.concept, s.created_at, s.id";
  const rows = db.prepare("SELECT s.id, s.concept, s.level, s.data, s.created_at, COALESCE(c.name, s.concept) conceptName " + from + " ORDER BY " + order + " LIMIT ? OFFSET ?").all(...params, size, offset);
  const items = rows.map((r) => ({ id: r.id, concept: r.concept, conceptName: r.conceptName, level: r.level, created_at: r.created_at, ...JSON.parse(r.data) }));
  const concepts = db.prepare("SELECT c.slug, c.name, c.level, COUNT(s.id) count FROM concepts c JOIN stage_items s ON s.concept = c.slug AND s.kind = 'flashcard' AND s.status = 'published' GROUP BY c.slug, c.name, c.level ORDER BY c.level, c.ord").all();
  return { items, total, page: safePage, pages, size, sort, type, level: level || "all", concept: concept || "all", q, concepts,
    types: db.prepare("SELECT json_extract(data, '$.type') type, COUNT(*) count FROM stage_items WHERE kind = 'flashcard' AND status = 'published' GROUP BY type ORDER BY type").all(),
    levels: db.prepare("SELECT level, COUNT(*) count FROM stage_items WHERE kind = 'flashcard' AND status = 'published' GROUP BY level ORDER BY level").all() };
}));
router.post("/concept/:slug/seen", wrap((req) => {
  if (!db.prepare("SELECT 1 FROM concepts WHERE slug = ?").get(req.params.slug)) throw bad("No such concept");
  const first = db.prepare("INSERT INTO concept_seen (concept, at) VALUES (?, ?) ON CONFLICT(concept) DO NOTHING").run(req.params.slug, nowIso()).changes;
  if (first) logEvent("card", req.params.slug, req.params.slug);
  return { ok: true, first: !!first };
}));
// a flashcard session: a concept's due and new cards, or every due card (the Today plan)
router.get("/flash/session", wrap((req) => {
  const map = contentMap(), st = learnerState(), slug = req.query.concept;
  const pool = slug ? (map.per.get(slug) || { flashcards: [] }).flashcards : [...map.per.values()].flatMap((p) => p.flashcards);
  const due = pool.filter((f) => st.flash.has(f.id) && R.isDue(st.flash.get(f.id)));
  const fresh = slug ? pool.filter((f) => !st.flash.has(f.id)) : [];
  const later = slug ? pool.filter((f) => st.flash.has(f.id) && !R.isDue(st.flash.get(f.id))) : [];
  const selected = req.query.card ? pool.find((f) => f.id === String(req.query.card)) : null;
  const ordered = selected ? [selected].concat(due.concat(fresh).filter((f) => f.id !== selected.id)) : due.concat(fresh);
  const name = (f) => (map.per.get(f.concept) || {}).name, ctx = flashCtx(map);
  return { concept: slug || null, cards: ordered.slice(0, 30).map((f) => ({ ...flashOut(f, ctx), conceptName: name(f), state: st.flash.get(f.id) || null })), later: later.length, intervals: R.INTERVALS };
}));
router.post("/flash/:id", wrap((req) => {
  const card = db.prepare("SELECT id, concept FROM stage_items WHERE id = ? AND kind = 'flashcard' AND status = 'published'").get(req.params.id);
  if (!card) throw Object.assign(new Error("No such flashcard"), { status: 404 });
  const prev = db.prepare("SELECT * FROM flash_state WHERE card_id = ?").get(card.id) || null;
  const next = R.schedule(prev, !!(req.body || {}).correct);
  db.prepare("INSERT INTO flash_state (card_id, concept, interval, due_at, reps, lapses, last_result, last_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(card_id) DO UPDATE SET interval = excluded.interval, due_at = excluded.due_at, reps = excluded.reps, lapses = excluded.lapses, last_result = excluded.last_result, last_at = excluded.last_at")
    .run(card.id, card.concept, next.interval, next.due_at, next.reps, next.lapses, next.last_result, next.last_at);
  logEvent("flashcard", card.id, card.concept);
  return { ok: true, state: next };
}));
router.post("/card/:id", wrap((req) => {
  const card = db.prepare("SELECT id, concept, data FROM stage_items WHERE id = ? AND kind = 'card' AND status = 'published'").get(req.params.id);
  if (!card || !Cards.STANDALONE.includes(JSON.parse(card.data).card_type)) throw Object.assign(new Error("No such card"), { status: 404 });
  const b = req.body || {}, state = scheduleCard(card, !!b.correct, b.confidence);
  logEvent("card", card.id, card.concept);
  return { ok: true, state };
}));
/** The extra cards' schedule: the 1/3/7/14 steps, back tomorrow when wrong or unsure (confidence 1-2). */
function scheduleCard(card, correct, confidence) {
  const prev = db.prepare("SELECT * FROM card_state WHERE card_id = ?").get(card.id) || null;
  const next = R.schedule(prev, correct);
  const conf = confidence == null || confidence === "" ? null : Math.max(1, Math.min(5, Math.round(Number(confidence))));
  const days = Cards.confidenceDays(next.interval, conf || 3, correct);
  if (days !== next.interval) { next.interval = days; next.due_at = new Date(Date.now() + days * R.DAY_MS).toISOString(); }
  db.prepare("INSERT INTO card_state (card_id, concept, interval, due_at, reps, lapses, confidence, last_result, last_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(card_id) DO UPDATE SET interval = excluded.interval, due_at = excluded.due_at, reps = excluded.reps, lapses = excluded.lapses, confidence = excluded.confidence, last_result = excluded.last_result, last_at = excluded.last_at")
    .run(card.id, card.concept, next.interval, next.due_at, next.reps, next.lapses, conf, next.last_result, next.last_at);
  return { ...next, confidence: conf };
}
// the Today plan's Challenge: the item is recorded exactly as answering it elsewhere would be (same rules), plus a
// "challenge" event and the confidence; no "flashcard" / "predict" event, so the other daily counts don't change
router.post("/challenge", wrap((req) => {
  const b = req.body || {}, correct = !!b.correct;
  const conf = b.confidence == null || b.confidence === "" ? null : Math.max(1, Math.min(5, Math.round(Number(b.confidence))));
  const kind = ["flashcard", "predict", "card"].includes(b.kind) ? b.kind : null;
  const row = kind && db.prepare("SELECT id, concept, data FROM stage_items WHERE id = ? AND kind = ? AND status = 'published'").get(String(b.ref || ""), kind);
  if (!row) throw Object.assign(new Error("No such item"), { status: 404 });
  let state = null;
  if (kind === "flashcard") {
    const prev = db.prepare("SELECT * FROM flash_state WHERE card_id = ?").get(row.id) || null;
    state = R.schedule(prev, correct);
    db.prepare("INSERT INTO flash_state (card_id, concept, interval, due_at, reps, lapses, last_result, last_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(card_id) DO UPDATE SET interval = excluded.interval, due_at = excluded.due_at, reps = excluded.reps, lapses = excluded.lapses, last_result = excluded.last_result, last_at = excluded.last_at")
      .run(row.id, row.concept, state.interval, state.due_at, state.reps, state.lapses, state.last_result, state.last_at);
  } else if (kind === "predict") db.prepare("INSERT INTO predict_answers (item_id, concept, correct, at) VALUES (?, ?, ?, ?)").run(row.id, row.concept, correct ? 1 : 0, nowIso());
  else state = scheduleCard(row, correct, conf);
  db.prepare("INSERT INTO challenge_answers (ref, kind, concept, correct, confidence, at) VALUES (?, ?, ?, ?, ?, ?)").run(row.id, kind, row.concept, correct ? 1 : 0, conf, nowIso());
  logEvent("challenge", row.id, row.concept);
  return { ok: true, correct, state };
}));
router.post("/predict/:id", wrap((req) => {
  const item = db.prepare("SELECT id, concept FROM stage_items WHERE id = ? AND kind = 'predict' AND status = 'published'").get(req.params.id);
  if (!item) throw Object.assign(new Error("No such item"), { status: 404 });
  const correct = !!(req.body || {}).correct;
  db.prepare("INSERT INTO predict_answers (item_id, concept, correct, at) VALUES (?, ?, ?, ?)").run(item.id, item.concept, correct ? 1 : 0, nowIso());
  logEvent("predict", item.id, item.concept);
  return { ok: true, correct };
}));
// My notes
router.get("/reflections", wrap((req) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  const names = new Map(db.prepare("SELECT slug, name, level FROM concepts").all().map((c) => [c.slug, c]));
  const c = lib.get();
  const rows = db.prepare("SELECT * FROM reflections ORDER BY at DESC").all().map((r) => {
    const concepts = JSON.parse(r.concepts).map((s) => names.get(s)).filter(Boolean).map((x) => ({ slug: x.slug, name: x.name, level: x.level }));
    const it = r.item_id && c.byId.get(r.item_id);
    return { ...r, concepts, itemTitle: it ? it.title : null };
  });
  const hay = (r) => [r.explain, r.mistake, r.feedback, r.sql, r.itemTitle].concat(r.concepts.map((x) => x.name)).join(" ").toLowerCase();
  return { total: rows.length, notes: q ? rows.filter((r) => hay(r).includes(q)) : rows };
}));
router.post("/reflections", wrap(async (req) => {
  const b = req.body || {};
  const explain = String(b.explain || "").trim().slice(0, 1000), mistake = String(b.mistake || "").trim().slice(0, 1000);
  const confidence = b.confidence == null || b.confidence === "" ? null : Math.max(1, Math.min(5, Math.round(Number(b.confidence))));
  if (!explain && !mistake) throw bad("Write at least one sentence.");
  let concepts = [];
  const it = b.item_id ? lib.get().byId.get(String(b.item_id)) : null;
  if (b.item_id && !it) throw bad("No such exercise");
  if (it) concepts = conceptsOfItem(it.id).map((x) => x.slug);
  if (b.concept) { if (!db.prepare("SELECT 1 FROM concepts WHERE slug = ?").get(b.concept)) throw bad("No such concept"); if (!concepts.includes(b.concept)) concepts.unshift(b.concept); }
  if (!concepts.length && !it) throw bad("A reflection belongs to an exercise or a concept.");
  // the Mistake reflection card's note (optional practice): in My notes, but not a reflection for mastery or the daily goal
  const source = b.source === "mistake_card" ? "mistake_card" : null;
  const r = { item_id: it ? it.id : null, concepts: JSON.stringify(concepts), result: ["pass", "fail"].includes(b.result) ? b.result : null, explain, mistake, confidence, sql: String(b.sql || "").slice(0, 4000) || null, at: nowIso() };
  const id = db.prepare("INSERT INTO reflections (item_id, concepts, result, explain, mistake, confidence, sql, at, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(r.item_id, r.concepts, r.result, r.explain, r.mistake, r.confidence, r.sql, r.at, source).lastInsertRowid;
  logEvent(source ? "card" : "reflection", String(id), concepts[0] || null);
  let feedback = null, feedbackError = null;
  if (b.ai === true && !source) {
    try { feedback = await reflectionFeedback(r, it && it.title); db.prepare("UPDATE reflections SET feedback = ? WHERE id = ?").run(feedback, id); }
    catch (e) { feedbackError = "AI feedback isn't available right now: " + e.message; }
  }
  return { ok: true, id: Number(id), concepts, feedback, feedbackError };
}));
router.delete("/reflections/:id", wrap((req) => ({ ok: true, removed: db.prepare("DELETE FROM reflections WHERE id = ?").run(Number(req.params.id)).changes })));
router.get("/today", wrap((req) => today({ level: req.query.level, weekend: req.query.weekend === "1" })));
// ---------- Docs: every concept's lesson (A-Z, cheat sheets) ----------
router.get("/docs", wrap(() => {
  const map = contentMap();
  return map.concepts.map((c) => {
    const p = map.per.get(c.slug), l = p.lessons[0];
    let keywords = []; try { keywords = JSON.parse(c.keywords || "[]"); } catch { keywords = String(c.keywords || "").split(/,\s*/).filter(Boolean); }
    return { slug: c.slug, name: c.name, level: c.level, summary: c.summary, keywords, lesson: l ? { id: l.id, title: l.title, what: l.what, when: l.when, example: l.example, explain: l.explain, tip: l.tip, dataset: lib.DATASETS[l.site] ? lib.DATASETS[l.site].key : undefined } : null };
  });
}));
// an example that needs MySQL (Docs, Learn): it runs on a fresh MySQL scratch copy of the lesson's dataset, which is dropped after
router.post("/docs/run", wrap(async (req) => {
  const b = req.body || {}, r = db.prepare("SELECT data FROM stage_items WHERE kind = 'lesson' AND status = 'published' AND concept = ?").get(String(b.slug || ""));
  if (!r) throw Object.assign(new Error("No lesson for this concept"), { status: 404 });
  const sql = String(b.sql || "").slice(0, 8000);
  if (!sql.trim()) throw bad("Write a query first");
  const site = JSON.parse(r.data).site;
  const out = await require("./writecheck.js").runOnDataset(site, sql).catch((e) => ({ ok: false, error: e.message }));
  return out.ok ? { ok: true, engine: "MySQL", result: out.result ? { columns: out.result.columns, rows: (out.result.rows || []).slice(0, 50) } : null } : { ok: false, engine: "MySQL", error: String(out.error || "it didn't run").replace(/\bsqlscratch_[a-z0-9_]+\./gi, "") };
}));

// ---------- Learn: the guided path (lesson → example → quick check), one concept per step, in course order ----------
// Finishing a step marks the concept's lesson as read: that is all it records (mastery rules don't use it).
router.get("/path", wrap(() => {
  const map = contentMap(), read = new Set(db.prepare("SELECT concept FROM lesson_read").all().map((r) => r.concept));
  const levels = [];
  for (const c of map.concepts) {
    const p = map.per.get(c.slug);
    let L = levels.find((x) => x.n === c.level);
    if (!L) levels.push((L = { n: c.level, title: (lib.LEVELS.find((x) => x.n === c.level) || {}).title || "", concepts: [] }));
    L.concepts.push({ slug: c.slug, name: c.name, read: read.has(c.slug), lesson: p.lessons.length > 0, checks: p.predicts.length + p.mcqs.memorize.length + p.mcqs.understand.length + p.cards.length });
  }
  levels.forEach((L) => { L.read = L.concepts.filter((c) => c.read).length; L.total = L.concepts.length; });
  return { levels, read: read.size, total: map.concepts.length };
}));
router.post("/lesson/:slug/read", wrap((req) => {
  if (!db.prepare("SELECT 1 FROM concepts WHERE slug = ?").get(req.params.slug)) throw Object.assign(new Error("No such concept"), { status: 404 });
  db.prepare("INSERT INTO lesson_read (concept, at) VALUES (?, ?) ON CONFLICT(concept) DO UPDATE SET at = excluded.at").run(req.params.slug, nowIso());
  return { ok: true, concept: req.params.slug };
}));
// a quick-check answer in Learn: a mistake goes into Review mistakes like an exercise's (due tomorrow, then 3 and 7 days);
// a right answer when it is due moves it on
const QC_KINDS = ["predict", "mcq", "card"];
router.post("/quickcheck", wrap((req) => {
  const b = req.body || {};
  if (!QC_KINDS.includes(b.kind) || !b.ref) throw bad("kind and ref are needed");
  if (!qcInfo("qc:" + b.kind + ":" + b.ref)) throw Object.assign(new Error("No such question"), { status: 404 });
  lib.reviewAfterAttempt("qc:" + b.kind + ":" + b.ref, !!b.correct, 0);
  return { ok: true };
}));
// stage actions for the streak and the daily goal (exercises come from /api/library/activity)
// (the extra cards and the Challenge are left out: the daily goal and streak count what they always counted)
router.get("/activity", wrap(() => db.prepare("SELECT kind, ref, at FROM learn_events WHERE kind NOT IN ('card', 'challenge') ORDER BY at").all().map((e) => ({ id: "learn:" + e.kind + ":" + e.ref, at: e.at }))));

/** Removes the learner's learning-model progress (Settings → reset, tests). */
function resetLearning() {
  let n = db.prepare("DELETE FROM lesson_read").run().changes + db.prepare("DELETE FROM review_queue WHERE item_id LIKE 'qc:%'").run().changes;
  for (const t of ["flash_state", "predict_answers", "concept_seen", "reflections", "learn_events", "concept_mastery", "card_state", "challenge_answers"]) n += db.prepare("DELETE FROM " + t).run().changes;
  return n;
}

/** A quick-check question in Review mistakes ("qc:<kind>:<id>"): its title, concept and where to answer it again. */
function qcInfo(id) {
  const m = /^qc:(predict|mcq|card):(.+)$/.exec(String(id || ""));
  if (!m) return null;
  const [, kind, ref] = m;
  if (kind === "mcq") {
    const q = require("../admin/content.js").publicMcqs().find((x) => x.id === ref);
    const tag = db.prepare("SELECT concepts FROM item_tags WHERE key = ? AND status = 'ok'").get("mcq:" + ref);
    const concept = tag ? JSON.parse(tag.concepts)[0] : null;
    return q ? { kind, ref, title: q.q, concept, href: concept ? "#/learn/" + concept + "?s=3" : "#/mcq/" + ref } : null;
  }
  const r = db.prepare("SELECT concept, data FROM stage_items WHERE id = ? AND status = 'published'").get(ref);
  if (!r) return null;
  const d = JSON.parse(r.data);
  return { kind, ref, title: d.question || "Quick check", concept: r.concept, href: "#/learn/" + r.concept + "?s=3" };
}
module.exports = { qcInfo, router, contentMap, learnerState, conceptInfo, levelInfo, conceptsOfItem, afterAttempt, today, resetLearning, STAGE_NAMES };
