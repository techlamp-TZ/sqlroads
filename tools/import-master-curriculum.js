// Import the 500k SQL curriculum into the learner database.
// Usage: node tools/import-master-curriculum.js "C:\\path\\to\\sql_master_curriculum_500k"
// The source contains concept folders with exercises.json, mcqs.json, lesson.json and schema.sql.
// This importer intentionally reads only modules/; the zips/ tree is a duplicate archive tree.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

// Guard (added in review, 2026-10-19): this tool publishes every row it imports, so it never touches the live
// database by default. It runs on SQLDRILLS_DB (a copy); to write to data.sqlite itself, pass --live-db.
// Checked before the database is opened.
const LIVE_DB = path.resolve(__dirname, "..", "data.sqlite");
const TARGET_DB = path.resolve(process.env.SQLDRILLS_DB || LIVE_DB);
if (TARGET_DB.toLowerCase() === LIVE_DB.toLowerCase() && !process.argv.includes("--live-db")) {
  console.error("import-master-curriculum: refusing to write to the live database (" + LIVE_DB + ").\n" +
    "Set SQLDRILLS_DB to a copy, or pass --live-db if you really mean the live one (back up first).");
  process.exit(1);
}
const db = require("../db.js");

const ROOT = path.resolve(process.argv.slice(2).find((a) => !a.startsWith("--")) || "");
const SOURCE = "master500k";
const BATCH = "master500k-curriculum";
const now = new Date().toISOString();

if (!ROOT || !fs.existsSync(path.join(ROOT, "modules"))) {
  throw new Error("Expected a curriculum directory containing modules/: " + ROOT);
}

const slugify = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const text = (v) => String(v == null ? "" : v).trim();
const list = (v) => Array.isArray(v) ? v.map(text).filter(Boolean) : [];
const hashId = (s) => "e" + crypto.createHash("sha1").update(s).digest("hex").slice(0, 9);
const libraryId = (contentId) => hashId("x:" + contentId);

function moduleNumber(name) {
  const m = /^module_(\d+)/i.exec(name);
  return m ? Number(m[1]) : 99;
}

function levelFor(moduleName, conceptName, topic) {
  const n = moduleNumber(moduleName);
  const s = (moduleName + " " + conceptName + " " + topic).toLowerCase();
  if (n === 1) {
    if (/order|limit|offset|pagination|top[- ]n|sorting/.test(s)) return 3;
    if (/where|filter|operator|between|like|in[_ -]|null|comparison|boolean/.test(s)) return 2;
    return 1;
  }
  if (n === 2) return 4;
  if (n === 3) return 5;
  if (n === 4) return 6;
  if (n === 5) return /cte|with|recursive/.test(s) ? 9 : 7;
  if (n === 6) return 9;
  if (n === 7) return 11;
  if (n === 8) return /transaction|trigger|procedure|routine|security|permission|grant|role|rollback|commit/.test(s) ? 13 : 10;
  if (n === 9) return 12;
  return 1;
}

function topicFor(level, moduleName, conceptName, topic) {
  const s = (moduleName + " " + conceptName + " " + topic).toLowerCase();
  if (level === 4 && /date|time/.test(s)) return "dates";
  return ({ 1: "select", 2: "where", 3: "order", 4: "functions", 5: "group", 6: "join", 7: "subquery", 8: "set", 9: "window", 10: "modify", 11: "ddl", 12: "views", 13: "tx", 14: "group" })[level] || "select";
}

function diffOf(v) {
  const s = text(v).toLowerCase();
  return s === "beginner" || s === "easy" ? "easy" : s === "intermediate" || s === "medium" ? "medium" : "hard";
}

function conceptRows() {
  const out = [];
  const modules = fs.readdirSync(path.join(ROOT, "modules"), { withFileTypes: true })
    .filter((x) => x.isDirectory() && /^module_\d+/i.test(x.name))
    .sort((a, b) => moduleNumber(a.name) - moduleNumber(b.name) || a.name.localeCompare(b.name));
  for (const mod of modules) {
    const dirs = fs.readdirSync(path.join(ROOT, "modules", mod.name), { withFileTypes: true })
      .filter((x) => x.isDirectory() && /^concept_/i.test(x.name))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    for (const dir of dirs) {
      const base = path.join(ROOT, "modules", mod.name, dir.name);
      const lesson = json(path.join(base, "lesson.json"));
      const topic = text(lesson.topic) || text(lesson.title) || dir.name;
      const level = levelFor(mod.name, dir.name, topic);
      const conceptKey = slugify("m" + moduleNumber(mod.name) + "-" + dir.name);
      const slug = SOURCE + "-" + conceptKey;
      const dataset = SOURCE + "-" + conceptKey;
      const breakdown = lesson.concept_breakdown || {};
      const keyPoints = list(lesson.key_points);
      const watchOuts = list(lesson.watch_outs);
      const keywords = [...new Set([topic, text(lesson.schema_reference), text(lesson.domain), ...keyPoints].filter(Boolean))].slice(0, 20);
      out.push({
        mod: mod.name, dir: dir.name, base, lesson, topic, level, slug, dataset,
        moduleTitle: text(lesson.module) || mod.name.replace(/^module_\d+_/, ""),
        name: topic || dir.name.replace(/^concept_\d+_/, ""),
        summary: text(breakdown.what || breakdown.why || lesson.title).slice(0, 180),
        keywords,
        ord: moduleNumber(mod.name) * 100000 + (Number((/^concept_(\d+)/i.exec(dir.name) || [0, 0])[1]) || 0),
        schema: fs.readFileSync(path.join(base, "schema.sql"), "utf8"),
        exercises: json(path.join(base, "exercises.json")),
        mcqs: json(path.join(base, "mcqs.json")),
      });
    }
  }
  return out;
}

function ensureTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS concepts (slug TEXT PRIMARY KEY, level INTEGER NOT NULL, ord INTEGER NOT NULL, name TEXT NOT NULL, summary TEXT NOT NULL, keywords TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS item_tags (key TEXT PRIMARY KEY, kind TEXT NOT NULL, level INTEGER, concepts TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL, source TEXT NOT NULL, a TEXT, b TEXT, why TEXT, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS content_items (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('mcq', 'drill')), status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'rejected', 'hidden')), data TEXT NOT NULL, verify TEXT, source TEXT NOT NULL, job_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS stage_items (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK (kind IN ('flashcard', 'predict', 'lesson', 'card')), concept TEXT NOT NULL, level INTEGER NOT NULL, status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'rejected')), data TEXT NOT NULL, verify TEXT, source TEXT NOT NULL, batch TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_content_kind_status ON content_items(kind, status);
    CREATE INDEX IF NOT EXISTS idx_stage_kind_status ON stage_items(kind, status);
  `);
}

function importAll(rows) {
  const siteInsert = db.prepare("INSERT INTO sites (id, name, order_index) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name, order_index = excluded.order_index");
  const folderFind = db.prepare("SELECT id FROM folders WHERE site_id = ? AND name = ?");
  const folderInsert = db.prepare("INSERT INTO folders (site_id, name, order_index) VALUES (?, ?, ?)");
  const fileFind = db.prepare("SELECT id FROM files WHERE folder_id = ? AND name = ?");
  const fileInsert = db.prepare("INSERT INTO files (folder_id, name, type, content, order_index) VALUES (?, ?, ?, ?, ?)");
  const fileUpdate = db.prepare("UPDATE files SET content = ?, type = ?, order_index = ? WHERE id = ?");
  const datasetUpsert = db.prepare("INSERT INTO custom_datasets (key, site, label, tables, batch, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET site = excluded.site, label = excluded.label, tables = excluded.tables, batch = excluded.batch");
  const conceptUpsert = db.prepare("INSERT INTO concepts (slug, level, ord, name, summary, keywords, created_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(slug) DO UPDATE SET level = excluded.level, ord = excluded.ord, name = excluded.name, summary = excluded.summary, keywords = excluded.keywords");
  const contentUpsert = db.prepare("INSERT INTO content_items (id, kind, status, data, verify, source, job_id, created_at, updated_at) VALUES (?, ?, 'published', ?, ?, ?, NULL, ?, ?) ON CONFLICT(id) DO UPDATE SET status = 'published', data = excluded.data, verify = excluded.verify, source = excluded.source, updated_at = excluded.updated_at");
  const tagUpsert = db.prepare("INSERT INTO item_tags (key, kind, level, concepts, stage, status, source, a, b, why, updated_at) VALUES (?, ?, ?, ?, ?, 'ok', 'master500k', NULL, NULL, 'Imported curriculum mapping', ?) ON CONFLICT(key) DO UPDATE SET level = excluded.level, concepts = excluded.concepts, stage = excluded.stage, status = 'ok', source = 'master500k', why = excluded.why, updated_at = excluded.updated_at");
  const stageUpsert = db.prepare("INSERT INTO stage_items (id, kind, concept, level, status, data, verify, source, batch, created_at, updated_at) VALUES (?, ?, ?, ?, 'published', ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET kind = excluded.kind, concept = excluded.concept, level = excluded.level, status = 'published', data = excluded.data, verify = excluded.verify, source = excluded.source, batch = excluded.batch, updated_at = excluded.updated_at");

  let exercises = 0, mcqs = 0, lessons = 0, schemas = 0;
  for (let ci = 0; ci < rows.length; ci++) {
    const c = rows[ci];
    const site = c.dataset;
    const label = "Master curriculum · " + c.name;
    siteInsert.run(site, label, c.ord);
    let folder = folderFind.get(site, c.dir);
    const folderId = folder ? folder.id : Number(folderInsert.run(site, c.dir, 0).lastInsertRowid);
    const oldFile = fileFind.get(folderId, "schema.sql");
    if (oldFile) fileUpdate.run(c.schema, "sql", 0, oldFile.id); else fileInsert.run(folderId, "schema.sql", "sql", c.schema, 0);
    datasetUpsert.run(site, site, label, JSON.stringify({ schema: c.schema }), BATCH, now);
    schemas++;

    conceptUpsert.run(c.slug, c.level, c.ord, c.name, c.summary, JSON.stringify(c.keywords), now);

    const firstExercise = c.exercises[0] || {};
    const breakdown = c.lesson.concept_breakdown || {};
    const lessonData = {
      title: text(c.lesson.title) || c.name,
      what: text(breakdown.what),
      when: list([breakdown.why, breakdown.how]),
      explain: list(c.lesson.key_points).join("\n"),
      tip: list(c.lesson.watch_outs).join("\n"),
      example: { sql: text(firstExercise.solution), engine: "SQLite" },
      schema_reference: text(c.lesson.schema_reference),
      domain: text(c.lesson.domain),
      concept: c.slug,
      site,
    };
    stageUpsert.run(SOURCE + ":" + c.slug + ":lesson", "lesson", c.slug, c.level, JSON.stringify(lessonData), JSON.stringify({ status: "pass", source: SOURCE }), SOURCE, BATCH, now, now);
    lessons++;

    for (const [i, e] of c.exercises.entries()) {
      const id = SOURCE + ":" + c.slug + ":exercise:" + text(e.exercise_id || String(i + 1));
      const data = {
        dataset: site, site, level: c.level, topic: topicFor(c.level, c.mod, c.dir, c.topic), diff: diffOf(e.difficulty),
        title: text(e.problem_statement) || (c.name + " exercise " + (i + 1)), task: text(e.problem_statement), solution_sql: text(e.solution),
        summary: text(e.expected_result).slice(0, 180), hints: [text(e.hint), text(e.schema_context)].filter(Boolean).slice(0, 3), accepted: [], ordered: /\border\s+by\b/i.test(text(e.solution)),
        concepts: [c.slug], stage: "practise", source_category: "master500k", source_id: text(e.exercise_id), module: c.moduleTitle, source_topic: c.topic,
      };
      contentUpsert.run(id, "drill", JSON.stringify(data), JSON.stringify({ status: "pass", source: SOURCE, imported: true }), SOURCE, now, now);
      tagUpsert.run("item:" + libraryId(id), "item", c.level, JSON.stringify([c.slug]), "practise", now);
      exercises++;
    }

    for (const [i, m] of c.mcqs.entries()) {
      const id = SOURCE + ":" + c.slug + ":mcq:" + text(m.mcq_id || String(i + 1));
      const keys = Object.keys(m.options || {}).sort();
      const options = keys.map((k) => text(m.options[k])).filter(Boolean);
      let answer = keys.indexOf(text(m.correct_answer));
      if (answer < 0) answer = Math.max(0, options.findIndex((x) => x === text(m.correct_answer)));
      const data = {
        q: text(m.question_text), code: text(m.code || m.query), options, answer, why: text(m.explanation), why_wrong: [],
        topic: topicFor(c.level, c.mod, c.dir, c.topic), diff: diffOf(m.difficulty), level: c.level, check: "",
        concepts: [c.slug], stage: /syntax|keyword|clause|order/i.test(text(m.question_type)) ? "memorize" : "understand", source_category: "master500k", source_id: text(m.mcq_id), module: c.moduleTitle, source_topic: c.topic,
      };
      const stage = data.stage;
      contentUpsert.run(id, "mcq", JSON.stringify(data), JSON.stringify({ status: "pass", source: SOURCE, imported: true }), SOURCE, now, now);
      tagUpsert.run("mcq:" + id, "mcq", c.level, JSON.stringify([c.slug]), stage, now);
      mcqs++;
    }
    if ((ci + 1) % 250 === 0) console.log(`Processed ${ci + 1}/${rows.length} concepts · ${exercises} exercises · ${mcqs} MCQs`);
  }
  return { concepts: rows.length, exercises, mcqs, lessons, schemas };
}

ensureTables();
const rows = conceptRows();
console.log(`Found ${rows.length} concepts under ${ROOT}`);
db.exec("BEGIN IMMEDIATE");
try {
  const result = importAll(rows);
  db.exec("COMMIT");
  console.log("MASTER_IMPORT_COMPLETE " + JSON.stringify(result));
} catch (e) {
  db.exec("ROLLBACK");
  console.error("MASTER_IMPORT_FAILED " + e.stack);
  process.exitCode = 1;
}
