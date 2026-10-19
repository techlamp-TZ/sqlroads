// Parks the bulk-imported content (17-18 Oct 2026) out of the app, keeping every row, and puts it back.
//
//   node tools/park-imports.js --db <file> --status     count what is in the app and what is parked (read-only)
//   node tools/park-imports.js --db <file> --park       move the imported rows into parked_<table> tables
//   node tools/park-imports.js --db <file> --restore    move them back, unchanged
//
// Add --live to act on the live database (sql-drills-server/data.sqlite); without it the tool refuses.
// Back up first (admin Backups, or admin/backup.js create("manual")). After --park or --restore, restart the
// server so it rebuilds the library (library_items marks parked items "removed" and restored ones active again).
//
// Parking moves each row, unchanged, into a table with the same columns (parked_content_items, …). Nothing is
// deleted: a row is either in its table or in its parked table, and the counts are checked before committing.
// The app reads only its own tables, so it sees the original content; the Review queue is not touched.
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// what each import added (source / batch / id prefix), in parking order (files before the folders they belong to)
const MASTER_SITES = "SELECT id FROM sites WHERE id LIKE 'master500k-%' OR id = 'imgdca50519'";
const SETS = [
  { table: "content_items", where: "source IN ('imported', 'import:sql_mcqs_50000', 'master500k')", what: "exercises and MCQs (imported, import:sql_mcqs_50000, master500k)" },
  { table: "stage_items", where: "source IN ('import:sql_flashcards_51000', 'master500k')", what: "flashcards (import:sql_flashcards_51000) and lessons (master500k)" },
  { table: "item_tags", where: "source = 'master500k'", what: "concept tags of the master500k items" },
  { table: "concepts", where: "slug LIKE 'master500k-%'", what: "master500k concepts" },
  { table: "custom_datasets", where: "batch = 'master500k-curriculum' OR key = 'imgdca50519'", what: "their datasets (incl. 'SQL Mastery Exercises', imgdca50519)" },
  { table: "files", where: `folder_id IN (SELECT id FROM folders WHERE site_id IN (${MASTER_SITES}))`, what: "their dataset files (schema.sql)" },
  { table: "folders", where: `site_id IN (${MASTER_SITES})`, what: "their dataset folders" },
  { table: "sites", where: `id IN (${MASTER_SITES})`, what: "their dataset sites ('Master curriculum · …', 'SQL Mastery Exercises')" },
];

const args = process.argv.slice(2);
const flag = (f) => args.includes(f);
const dbArg = args[args.indexOf("--db") + 1];
const mode = flag("--park") ? "park" : flag("--restore") ? "restore" : flag("--status") ? "status" : null;
const die = (m) => { console.error("park-imports: " + m); process.exit(1); };
if (!mode || args.indexOf("--db") < 0 || !dbArg) die("usage: node tools/park-imports.js --db <file> --status | --park | --restore [--live]");
const file = path.resolve(dbArg);
const LIVE = path.resolve(__dirname, "..", "data.sqlite");
if (file.toLowerCase() === LIVE.toLowerCase() && mode !== "status" && !flag("--live")) die("that is the live database; add --live if you mean it (and back up first)");

const db = new DatabaseSync(file);
const count = (sql) => db.prepare(sql).get().n;
const exists = (t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(t);
const colsOf = (t) => db.prepare(`PRAGMA table_info(${t})`).all().map((c) => `"${c.name}"`).join(", ");

function report() {
  return SETS.map((s) => ({ table: s.table, inApp: count(`SELECT COUNT(*) n FROM ${s.table} WHERE ${s.where}`), parked: exists("parked_" + s.table) ? count(`SELECT COUNT(*) n FROM parked_${s.table}`) : 0, what: s.what }));
}

if (mode === "status") {
  console.table(report());
  process.exit(0);
}

db.exec("BEGIN IMMEDIATE");
try {
  const moved = [];
  if (mode === "park") {
    for (const s of SETS) {
      const p = "parked_" + s.table;
      if (!exists(p)) db.exec(`CREATE TABLE ${p} AS SELECT * FROM ${s.table} WHERE 0`); // same columns, no rows
      const before = count(`SELECT COUNT(*) n FROM ${s.table} WHERE ${s.where}`), already = count(`SELECT COUNT(*) n FROM ${p}`);
      db.exec(`INSERT INTO ${p} (${colsOf(p)}) SELECT ${colsOf(p)} FROM ${s.table} WHERE ${s.where}`);
      if (count(`SELECT COUNT(*) n FROM ${p}`) !== already + before) throw new Error(s.table + ": copy count mismatch");
      db.exec(`DELETE FROM ${s.table} WHERE ${s.where}`);
      moved.push({ table: s.table, moved: before });
    }
  } else {
    for (const s of [...SETS].reverse()) { // sites before folders before files
      const p = "parked_" + s.table;
      if (!exists(p)) continue;
      const n = count(`SELECT COUNT(*) n FROM ${p}`), before = count(`SELECT COUNT(*) n FROM ${s.table}`);
      db.exec(`INSERT INTO ${s.table} (${colsOf(p)}) SELECT ${colsOf(p)} FROM ${p}`);
      if (count(`SELECT COUNT(*) n FROM ${s.table}`) !== before + n) throw new Error(s.table + ": restore count mismatch");
      db.exec(`DELETE FROM ${p}`);
      moved.push({ table: s.table, restored: n });
    }
  }
  db.exec("COMMIT");
  console.table(moved);
  console.log("park-imports: " + mode + " done. Restart the server so it rebuilds the library.");
} catch (e) {
  db.exec("ROLLBACK");
  die(mode + " failed, nothing changed: " + e.message);
}
