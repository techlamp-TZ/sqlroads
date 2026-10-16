// The 5-stage learning model: concepts per level, and every exercise / MCQ tagged with 1-3 concepts and a stage
// (memorize, understand, practise, reflect, transfer). Concepts are drafted by AI from each level's real content;
// tags are proposed by one provider, reviewed by a second, and fixed by rules where a rule is certain.
// Disagreements go to the admin review queue as type "tag".
const db = require("../db.js");
const library = require("./library.js");
const { complete } = require("../hints.js");

db.exec(`
  CREATE TABLE IF NOT EXISTS concepts (slug TEXT PRIMARY KEY, level INTEGER NOT NULL, ord INTEGER NOT NULL, name TEXT NOT NULL, summary TEXT NOT NULL, keywords TEXT, created_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS item_tags (
    key TEXT PRIMARY KEY,            -- "item:<library id>" or "mcq:<mcq id>"
    kind TEXT NOT NULL, level INTEGER, concepts TEXT NOT NULL, stage TEXT NOT NULL,
    status TEXT NOT NULL,            -- ok | review
    source TEXT NOT NULL,            -- agreed | rule | admin
    a TEXT, b TEXT, why TEXT, updated_at TEXT NOT NULL
  );
`);
const STAGES = ["memorize", "understand", "practise", "reflect", "transfer"];
const now = () => new Date().toISOString();
// a = generator, b = reviewer (always a different provider), strong = tie-breaker: the roles in hints.js
const { ROLES, costOf } = require("../hints.js");
const MODELS = { a: ROLES.generator, b: ROLES.reviewer, strong: ROLES.tieBreaker };
const usage = {};
function track(u) { const x = (usage[u.model] = usage[u.model] || { input: 0, output: 0, calls: 0 }); x.input += u.input; x.output += u.output; x.calls++; }
const cost = () => costOf(usage);
const jsonOf = (text) => { const m = String(text || "").match(/[[{][\s\S]*[\]}]/); return m ? JSON.parse(m[0]) : null; };
// a dropped connection ("fetch failed", a time-out) is retried with growing pauses, about 7 minutes in all;
// other errors (no credit, a bad key, a refused request) fail at once
const NETWORK_ERROR = /fetch failed|reach the AI provider|timeout|timed out|ECONNRESET|ETIMEDOUT|socket/i;
async function ask(who, system, user, maxTokens, images) {
  for (let k = 0; ; k++) {
    try {
      const r = await complete({ provider: who.provider, model: who.model, system, user, maxTokens, images, onUsage: track });
      return { text: r.text, model: r.model };
    } catch (e) {
      if (k >= 6 || !NETWORK_ERROR.test(e.message)) throw e;
      await new Promise((res) => setTimeout(res, 20000 * (k + 1)));
    }
  }
}

// ---------- the items, with the evidence a tagger needs ----------
function itemsForTagging() {
  const c = library.get();
  const refs = new Map(db.prepare("SELECT item_id, sql, status, model_answer FROM drill_refs").all().map((r) => [r.item_id, r]));
  const course = db.prepare("SELECT * FROM course_exercises WHERE id = ?");
  const out = [];
  for (const i of c.active) {
    let sql = "", prompt = String(i.body || ""), day = null, mode = i.check;
    if (i.kind === "server") {
      const ex = course.get(i.ref.mysql) || course.get(i.ref.postgres);
      if (ex) { prompt = ex.question || prompt; sql = ex.solution_sql || ""; day = ex.day + " " + ex.day_title; mode = ex.check_mode; }
    } else {
      const r = refs.get(i.id);
      if (r) { sql = r.sql || ""; if (r.status === "self") mode = r.model_answer && !r.sql ? "self-words" : r.model_answer ? "self-both" : "self-sql"; }
      else if (i.solution) sql = i.solution;
    }
    out.push({ key: "item:" + i.id, kind: "item", level: i.level, title: i.title, prompt: prompt.replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”").replace(/\s+/g, " ").slice(0, 420), sql: String(sql).replace(/\s+/g, " ").slice(0, 300), dataset: i.dataset, check: mode, day, section: i.section || null, order: i.order || 0, seq: i.seq || 0 });
  }
  for (const m of require("../admin/content.js").publicMcqs()) out.push({ key: "mcq:" + m.id, kind: "mcq", level: m.level, title: m.q, prompt: m.q + " | options: " + m.options.join(" / ") + " | answer: " + m.options[m.answer], sql: "", dataset: null, check: "mcq", day: null });
  return out;
}

// ---------- concepts per level ----------
const SYSTEM_CONCEPTS = `You design the concept list for one level of a SQL course. A concept is one teachable idea a learner can memorize, understand, practise, reflect on and transfer (e.g. for joins: INNER JOIN, LEFT JOIN, RIGHT / FULL JOIN, self join, joining on several keys, anti-join with LEFT JOIN ... IS NULL).
Reply with ONLY a JSON array of 8 to 12 objects, in teaching order:
[{"slug": "kebab-case-id", "name": "short name", "summary": "one sentence, at most 100 characters", "keywords": ["SQL keywords or functions"]}]
- Cover what this level's exercises and questions actually practise (given below); don't invent topics they don't touch.
- Don't repeat a concept from an earlier level (listed below); a level may build on them.
- Slugs must be unique and specific (e.g. "left-join", not "join2").`;
async function draftConcepts() {
  const items = itemsForTagging();
  const made = [];
  db.exec("DELETE FROM concepts");
  for (const L of library.LEVELS) {
    const mine = items.filter((x) => x.level === L.n);
    const ex = mine.filter((x) => x.kind === "item"), mc = mine.filter((x) => x.kind === "mcq");
    // a spread sample of the level's exercises (titles + a little of the prompt) and all its MCQs
    const step = Math.max(1, Math.floor(ex.length / 70));
    const sample = ex.filter((_, k) => k % step === 0).slice(0, 70).map((x) => "- " + x.title + (x.prompt && x.prompt !== x.title ? ": " + x.prompt.slice(0, 90) : ""));
    const user = `LEVEL ${L.n}: ${L.title} — ${L.blurb}${L.sections ? "\nSECTIONS: " + L.sections.map((s) => s.title + " (" + s.blurb + ")").join("; ") : ""}
EARLIER LEVELS' CONCEPTS: ${made.map((c) => c.slug).join(", ") || "(none)"}
THIS LEVEL'S EXERCISES (${ex.length}, a sample):\n${sample.join("\n")}
THIS LEVEL'S MULTIPLE-CHOICE QUESTIONS (${mc.length}):\n${mc.map((x) => "- " + x.title).join("\n") || "(none)"}`;
    const r = await ask(MODELS.strong, SYSTEM_CONCEPTS, user, 2500);
    const list = (jsonOf(r.text) || []).filter((x) => x && x.slug && x.name && x.summary);
    list.forEach((x, k) => {
      const slug = String(x.slug).toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "");
      if (made.some((m) => m.slug === slug)) return;
      const row = { slug, level: L.n, ord: k + 1, name: String(x.name).trim(), summary: String(x.summary).trim().slice(0, 120), keywords: JSON.stringify(x.keywords || []) };
      db.prepare("INSERT INTO concepts (slug, level, ord, name, summary, keywords, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").run(row.slug, row.level, row.ord, row.name, row.summary, row.keywords, now());
      made.push(row);
    });
  }
  return { concepts: made.length, cost: cost() };
}
const allConcepts = () => db.prepare("SELECT * FROM concepts ORDER BY level, ord").all();

// ---------- tagging ----------
// course days that mix topics (projects, reviews, analytical problem solving, capstone, exams): transfer
const MIXED_DAYS = [7, 13, 14, 21, 24, 26, 27, 28, 29, 30];
/** The stage a rule fixes for sure, or null when the AI decides. */
function ruleStage(it) {
  if (it.kind === "mcq") return null; // memorize or understand: AI (restricted)
  if (it.level === 14) return { stage: "transfer", rule: "Level 14 projects, capstone and exams" };
  const day = it.day ? Number(String(it.day).split(" ")[0]) : null;
  if (day && MIXED_DAYS.includes(day)) return { stage: "transfer", rule: "mixed-topic course day (" + String(it.day).replace(/^\d+ /, "") + ")" };
  if (it.check === "self-words") return { stage: "reflect", rule: "explain-in-words self-check" };
  return null;
}
/** Stages an item may have at all. */
function allowedStages(it) {
  if (it.kind === "mcq") return ["memorize", "understand"];
  const selfCheck = /^self|^concept$|^manual$/.test(it.check || "");
  return selfCheck ? ["practise", "reflect", "transfer"] : ["practise", "transfer"];
}
const SYSTEM_TAG = `You tag items of a SQL course with the concepts they teach and a learning stage.
For EACH item reply with: "concepts": 1 to 3 concept slugs from the CONCEPT LIST (most important first; prefer this level's concepts, but use an earlier level's when that is what the item is really about), and "stage":
- memorize: a multiple-choice question about syntax, keywords or clause order (recall).
- understand: a multiple-choice question about why something works or what a query returns / what happens.
- practise: a coding exercise that drills the concept directly.
- reflect: a self-check task that asks to explain, compare or describe in words rather than write a query.
- transfer: applying the concept in a new context: a business-style word problem, a mixed-topic task combining concepts from different levels, or a project-style task.
Use only the stages allowed for each item (given as "allowed").
Reply with ONLY a JSON array: [{"key": "...", "concepts": ["slug"], "stage": "..."}]`;
const SYSTEM_REVIEW = `You review concept and stage tags for items of a SQL course. For EACH item decide whether the proposed tags are right: the concepts (1-3 slugs from the CONCEPT LIST, most important first) must be what the item teaches, and the stage must fit (memorize = MCQ on syntax/keywords; understand = MCQ on why / what happens; practise = coding drill; reflect = explain-in-words self-check; transfer = new context, business word problem, mixed topics, project).
Reply with ONLY a JSON array: [{"key": "...", "ok": true}] or, when you disagree, [{"key": "...", "ok": false, "concepts": ["slug"], "stage": "...", "why": "short reason"}]`;
function conceptListFor(level, concepts) {
  const own = concepts.filter((c) => c.level === level), before = concepts.filter((c) => c.level < level), after = concepts.filter((c) => c.level > level && level < 14);
  return "THIS LEVEL (" + level + "):\n" + own.map((c) => `${c.slug}: ${c.name}`).join("\n") +
    (before.length ? "\nEARLIER LEVELS:\n" + before.map((c) => `${c.slug} (L${c.level}): ${c.name}`).join("\n") : "") +
    (after.length ? "\nLATER LEVELS (only if clearly needed):\n" + after.map((c) => `${c.slug} (L${c.level})`).join(", ") : "");
}
const view = (it) => ({ key: it.key, kind: it.kind, title: it.title, task: it.prompt && it.prompt !== it.title ? it.prompt : undefined, solution_sql: it.sql || undefined, check: it.check, allowed: allowedStages(it) });
/** Tag a batch of items (same level): proposal by A, review by B, rules on top. Writes item_tags. */
async function tagBatch(batch, concepts) {
  const slugs = new Set(concepts.map((c) => c.slug));
  const level = batch[0].level;
  const list = conceptListFor(level, concepts);
  const clean = (x, it) => {
    const cs = [...new Set((x && Array.isArray(x.concepts) ? x.concepts : []).map(String).filter((c) => slugs.has(c)))].slice(0, 3);
    const st = x && allowedStages(it).includes(x.stage) ? x.stage : null;
    return { concepts: cs, stage: st };
  };
  let A = [];
  try { A = jsonOf((await ask(MODELS.a, SYSTEM_TAG, "CONCEPT LIST\n" + list + "\n\nITEMS\n" + JSON.stringify(batch.map(view)), 4000)).text) || []; } catch (e) { A = []; }
  const aBy = new Map(A.filter((x) => x && x.key).map((x) => [x.key, x]));
  const proposals = batch.map((it) => ({ key: it.key, ...clean(aBy.get(it.key), it) }));
  let B = [];
  try { B = jsonOf((await ask(MODELS.b, SYSTEM_REVIEW, "CONCEPT LIST\n" + list + "\n\nITEMS WITH PROPOSED TAGS\n" + JSON.stringify(batch.map((it, k) => ({ ...view(it), proposed: proposals[k] }))), 4000)).text) || []; } catch (e) { B = []; }
  const bBy = new Map(B.filter((x) => x && x.key).map((x) => [x.key, x]));
  const out = { ok: 0, review: 0 };
  batch.forEach((it, k) => {
    const a = proposals[k], braw = bBy.get(it.key), rule = ruleStage(it);
    const b = braw ? (braw.ok === true ? { ...a, ok: true } : { ...clean(braw, it), ok: false, why: braw.why || "" }) : { ok: null, concepts: [], stage: null, why: "no review" };
    let status = "ok", stage = rule ? rule.stage : a.stage, concepts = a.concepts, why = rule ? rule.rule : "", source = rule ? "rule" : "agreed";
    if (!a.concepts.length || (!a.stage && !rule)) {
      // A gave nothing usable: B's answer, if it has one, but a person confirms
      status = "review"; concepts = b.concepts.length ? b.concepts : []; stage = rule ? rule.stage : b.stage || allowedStages(it)[0]; why = "the first tagger gave no usable answer";
    } else if (b.ok === false && !b.concepts.length) {
      // an objection without a valid alternative isn't a disagreement: the first proposal stands
      why = "reviewer objected without a valid alternative; first proposal kept";
    } else if (b.ok === false) {
      const sameConcept = b.concepts.length && b.concepts.includes(a.concepts[0]);
      const sameStage = rule || !b.stage || b.stage === a.stage;
      if (!(sameConcept && sameStage)) { status = "review"; why = (sameConcept ? "" : "concepts differ") + (sameConcept || sameStage ? "" : ", ") + (sameStage ? "" : "stage differs") + (b.why ? ": " + b.why : ""); }
    } else if (b.ok === null) { status = "review"; why = "the reviewer gave no answer"; }
    db.prepare("INSERT OR REPLACE INTO item_tags (key, kind, level, concepts, stage, status, source, a, b, why, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .run(it.key, it.kind, it.level, JSON.stringify(concepts), stage, status, status === "review" ? "pending" : source, JSON.stringify(a), JSON.stringify(b), why, now());
    out[status]++;
  });
  return out;
}
/** Tag everything not tagged yet (or everything with all=true). Batches of 20 by level, 4 at a time. */
async function tagAll({ all = false, onProgress } = {}) {
  const concepts = allConcepts();
  const done = new Set(db.prepare("SELECT key FROM item_tags").all().map((r) => r.key));
  const items = itemsForTagging().filter((x) => all || !done.has(x.key));
  const batches = [];
  for (const L of library.LEVELS) {
    const mine = items.filter((x) => x.level === L.n);
    for (const kind of ["mcq", "item"]) { const k = mine.filter((x) => x.kind === kind); for (let i = 0; i < k.length; i += 20) batches.push(k.slice(i, i + 20)); }
  }
  const tally = { ok: 0, review: 0, batches: batches.length };
  let next = 0, doneN = 0;
  const worker = async () => {
    while (next < batches.length) {
      const b = batches[next++];
      const r = await tagBatch(b, concepts);
      tally.ok += r.ok; tally.review += r.review; doneN++;
      if (onProgress) onProgress(doneN, batches.length, tally);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { ...tally, cost: cost() };
}
/**
 * Transfer by context: an exercise whose main concept comes from an EARLIER level, on a different dataset than
 * that concept's first practise exercises, applies the concept somewhere new.
 */
function transferByContext() {
  const items = new Map(itemsForTagging().map((x) => [x.key, x]));
  const concepts = new Map(allConcepts().map((c) => [c.slug, c]));
  const tags = db.prepare("SELECT * FROM item_tags WHERE kind = 'item'").all();
  // the datasets of each concept's first practise exercises (in path order)
  const firsts = {};
  tags.filter((t) => t.stage === "practise").map((t) => ({ t, it: items.get(t.key) })).filter((x) => x.it)
    .sort((a, b) => a.it.level - b.it.level || a.it.order - b.it.order)
    .forEach(({ t, it }) => { const c = JSON.parse(t.concepts)[0]; if (!c) return; const f = (firsts[c] = firsts[c] || []); if (f.length < 5) f.push(it.dataset); });
  let moved = 0;
  for (const t of tags) {
    if (t.stage !== "practise") continue;
    const it = items.get(t.key), c = concepts.get(JSON.parse(t.concepts)[0]);
    if (!it || !c || c.level >= it.level || !it.dataset) continue;
    if ((firsts[c.slug] || []).includes(it.dataset)) continue;
    db.prepare("UPDATE item_tags SET stage = 'transfer', why = ?, source = CASE WHEN source = 'pending' THEN source ELSE 'rule' END, updated_at = ? WHERE key = ?")
      .run(`earlier-level concept (L${c.level} ${c.name}) on a different dataset`, now(), t.key);
    moved++;
  }
  return moved;
}
/** Coverage per level and concept, with the gaps. */
function coverage() {
  const concepts = allConcepts();
  const tags = db.prepare("SELECT key, kind, level, concepts, stage, status FROM item_tags").all().map((t) => ({ ...t, concepts: JSON.parse(t.concepts) }));
  const items = new Map(itemsForTagging().map((x) => [x.key, x]));
  const per = new Map(concepts.map((c) => [c.slug, { ...c, memorize: 0, understand: 0, practise: 0, reflect: 0, transfer: 0, hardPractise: 0 }]));
  for (const t of tags.filter((x) => x.status !== "review")) t.concepts.forEach((slug) => { const p = per.get(slug); if (!p) return; p[t.stage]++; if (t.stage === "practise" && items.get(t.key) && items.get(t.key).diff === "hard") p.hardPractise++; });
  const gapsOf = (p) => [!p.memorize && "no memorize items", !p.understand && "no understand items", p.practise < 3 && "fewer than 3 practise exercises (" + p.practise + ")", !p.reflect && "no reflect task", !p.transfer && "no transfer task"].filter(Boolean);
  return library.LEVELS.map((L) => {
    const cs = [...per.values()].filter((p) => p.level === L.n).map((p) => ({ ...p, gaps: gapsOf(p) }));
    const lv = tags.filter((t) => t.level === L.n);
    const stages = Object.fromEntries(STAGES.map((s) => [s, lv.filter((t) => t.stage === s && t.status !== "review").length]));
    return { level: L.n, title: L.title, concepts: cs, stages, items: lv.length, review: lv.filter((t) => t.status === "review").length };
  });
}
// ---------- the stricter transfer rule ----------
// project, capstone and exam days of the course (Level 14 items are always these)
const PROJECT_DAYS = [7, 14, 21, 24, 26, 27, 28, 29, 30];
// (only Level 14 holds the project, capstone and exam tasks; course items from those days placed in earlier levels are review / support exercises)
const isProjectTask = (it) => it.level === 14;
const SYSTEM_WORD = `For each SQL exercise, decide two things:
- "word": true if it is a business-style word problem: a realistic request from a manager, analyst or customer framed as a business question (what to find out and why), rather than an instruction naming the SQL to write.
- "combines": true if solving it needs concepts from clearly different topics together (e.g. a join plus grouping plus a window function, or a subquery inside an aggregate report).
Reply with ONLY a JSON array: [{"key": "...", "word": true|false, "combines": true|false}]`;
const SYSTEM_WORD_REVIEW = `You check flags on SQL exercises. "word" = a business-style word problem (a realistic business question, not an instruction naming the SQL). "combines" = it needs concepts from clearly different topics together. For each item, say whether you agree with BOTH flags.
Reply with ONLY a JSON array: [{"key": "...", "ok": true}] or [{"key": "...", "ok": false, "word": true|false, "combines": true|false}]`;
/** Flags word problems / mixed-concept tasks (both providers must agree for a flag to be set). */
async function classifyWordProblems({ onProgress } = {}) {
  try { db.exec("ALTER TABLE item_tags ADD COLUMN word INTEGER"); } catch {}
  const items = itemsForTagging().filter((x) => x.kind === "item" && !isProjectTask(x));
  const batches = [];
  for (let i = 0; i < items.length; i += 40) batches.push(items.slice(i, i + 40));
  let next = 0, done = 0, flagged = 0;
  const worker = async () => {
    while (next < batches.length) {
      const b = batches[next++];
      const shown = b.map((it) => ({ key: it.key, title: it.title, task: it.prompt && it.prompt !== it.title ? it.prompt.slice(0, 300) : undefined, solution_sql: it.sql ? it.sql.slice(0, 200) : undefined }));
      let A = [], B = [];
      try { A = jsonOf((await ask(MODELS.a, SYSTEM_WORD, JSON.stringify(shown), 3500)).text) || []; } catch {}
      const aBy = new Map(A.filter((x) => x && x.key).map((x) => [x.key, x]));
      try { B = jsonOf((await ask(MODELS.b, SYSTEM_WORD_REVIEW, JSON.stringify(shown.map((x) => ({ ...x, flags: aBy.get(x.key) ? { word: !!aBy.get(x.key).word, combines: !!aBy.get(x.key).combines } : null }))), 3500)).text) || []; } catch {}
      const bBy = new Map(B.filter((x) => x && x.key).map((x) => [x.key, x]));
      for (const it of b) {
        const a = aBy.get(it.key), r = bBy.get(it.key);
        if (!a) { db.prepare("UPDATE item_tags SET word = 0 WHERE key = ?").run(it.key); continue; }
        // a flag counts only when both agree on it
        const word = !!a.word && (r ? (r.ok === true ? true : !!r.word) : false);
        const combines = !!a.combines && (r ? (r.ok === true ? true : !!r.combines) : false);
        const v = word || combines ? 1 : 0;
        flagged += v;
        db.prepare("UPDATE item_tags SET word = ? WHERE key = ?").run(v, it.key);
      }
      done++;
      if (onProgress) onProgress(done, batches.length, flagged);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  return { items: items.length, flagged, cost: cost() };
}
/** Re-applies the transfer rule to every exercise. Returns the moves. */
function applyTransferRule() {
  const items = new Map(itemsForTagging().map((x) => [x.key, x]));
  const tags = db.prepare("SELECT * FROM item_tags WHERE kind = 'item'").all();
  const moves = { toPractise: 0, toTransfer: 0, project: 0 };
  // 1. project / capstone / exam tasks are transfer; other transfer tags go back to practise for now
  for (const t of tags) {
    const it = items.get(t.key);
    if (!it) continue;
    if (isProjectTask(it)) { if (t.stage !== "transfer") db.prepare("UPDATE item_tags SET stage = 'transfer', why = ?, updated_at = ? WHERE key = ?").run("project, capstone or exam task", now(), t.key); t.stage = "transfer"; moves.project++; continue; }
    if (t.stage === "transfer") { db.prepare("UPDATE item_tags SET stage = 'practise', why = ?, updated_at = ? WHERE key = ?").run("not a project task: practise unless it qualifies as transfer", now(), t.key); t.stage = "practise"; moves.toPractise++; }
  }
  // 2. each concept's practise set: the datasets of its practise exercises that are plain (not word problems)
  const practiseSets = {};
  for (const t of tags) {
    const it = items.get(t.key);
    if (!it || t.stage !== "practise" || t.word) continue;
    const main = JSON.parse(t.concepts)[0];
    if (main && it.dataset) (practiseSets[main] = practiseSets[main] || new Set()).add(it.dataset);
  }
  // 3. a word problem / mixed task on a dataset its main concept's practise set doesn't use: transfer
  for (const t of tags) {
    const it = items.get(t.key);
    if (!it || t.stage !== "practise" || !t.word) continue;
    const main = JSON.parse(t.concepts)[0];
    if (!main || !it.dataset || (practiseSets[main] && practiseSets[main].has(it.dataset))) continue;
    db.prepare("UPDATE item_tags SET stage = 'transfer', why = ?, updated_at = ? WHERE key = ?").run("word problem or mixed task, on a dataset the concept's practise set doesn't use", now(), t.key);
    moves.toTransfer++;
  }
  return moves;
}

// ---------- the review queue: uncertain tags ----------
function tagReviewList() {
  const items = new Map(itemsForTagging().map((x) => [x.key, x]));
  const names = new Map(allConcepts().map((c) => [c.slug, c.name + " (L" + c.level + ")"]));
  const named = (p) => p ? { concepts: (p.concepts || []).map((s) => ({ slug: s, name: names.get(s) || s })), stage: p.stage || null } : null;
  return db.prepare("SELECT * FROM item_tags WHERE status = 'review' ORDER BY level, key").all().map((r) => {
    const it = items.get(r.key) || {};
    return { key: r.key, kind: r.kind, level: r.level, stage: r.stage, title: it.title || r.key, task: it.prompt && it.prompt !== it.title ? it.prompt : "", sql: it.sql || "", why: r.why, a: named(JSON.parse(r.a || "null")), b: named(JSON.parse(r.b || "null")), allowed: it.key ? allowedStages(it) : STAGES };
  });
}
/** Decide an uncertain tag: use A's or B's proposal (a rule-fixed stage stays). */
function decideTag({ key, use }) {
  const r = db.prepare("SELECT * FROM item_tags WHERE key = ?").get(key);
  if (!r) throw Object.assign(new Error("Unknown item"), { status: 404 });
  const p = JSON.parse(r[use === "b" ? "b" : "a"] || "null");
  if (!p || !p.concepts || !p.concepts.length) throw Object.assign(new Error("That proposal has no concepts"), { status: 400 });
  const it = itemsForTagging().find((x) => x.key === key);
  const rule = it ? ruleStage(it) : null;
  const stage = rule ? rule.stage : p.stage && (!it || allowedStages(it).includes(p.stage)) ? p.stage : r.stage;
  db.prepare("UPDATE item_tags SET concepts = ?, stage = ?, status = 'ok', source = 'admin', why = ?, updated_at = ? WHERE key = ?").run(JSON.stringify(p.concepts), stage, "chosen in review (" + (use === "b" ? "B" : "A") + ")", now(), key);
  return { ok: true, key, stage };
}
module.exports = { classifyWordProblems, applyTransferRule, isProjectTask, tagReviewList, decideTag, tagAll, tagBatch, transferByContext, coverage, ruleStage, allowedStages, STAGES, itemsForTagging, draftConcepts, allConcepts, usage, cost, ask, jsonOf, MODELS, now };
