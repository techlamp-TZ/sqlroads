const { DatabaseSync } = require("node:sqlite");
const path = require("node:path");

// SQLDRILLS_DB: another database file (tests run on a copy, never on the real one)
const db = new DatabaseSync(process.env.SQLDRILLS_DB || path.join(__dirname, "data.sqlite"));
// a second process (a generation run, a test) waits up to 5 s for a write lock instead of failing at once
db.exec("PRAGMA busy_timeout = 5000");

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS folders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    folder_id INTEGER NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('quiz','sql')),
    content TEXT NOT NULL,
    order_index INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS progress (
    qid TEXT PRIMARY KEY,
    done INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS bookmarks (
    qid TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  -- Saved queries and imported tables moved to SQLPad and the per-track SQLite files.
  DROP TABLE IF EXISTS saved_queries;
  DROP TABLE IF EXISTS imported_datasets;
  CREATE INDEX IF NOT EXISTS idx_folders_site ON folders(site_id);
  CREATE INDEX IF NOT EXISTS idx_files_folder ON files(folder_id);
`);
// datasets made from the rows in a screenshot (admin/image-gen.js): their SQL is a sites/folders/files entry like
// every other dataset; this table names them for the dataset maps (library.js, content.js)
db.exec(`CREATE TABLE IF NOT EXISTS custom_datasets (key TEXT PRIMARY KEY, site TEXT NOT NULL UNIQUE, label TEXT NOT NULL,
  tables TEXT NOT NULL, batch TEXT, created_at TEXT NOT NULL)`);

// "lesson" items (the optional Study step) live with the flashcards and predict items: the kind check is widened
// once, by rebuilding the table in one transaction (every row is copied)
{
  const t = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stage_items'").get();
  if (t && !/'lesson'/.test(t.sql)) {
    db.exec("BEGIN");
    try {
      db.exec(t.sql.replace(/CREATE TABLE "?stage_items"?/, "CREATE TABLE stage_items_new").replace("CHECK (kind IN ('flashcard', 'predict'))", "CHECK (kind IN ('flashcard', 'predict', 'lesson'))"));
      const n = db.prepare("SELECT COUNT(*) n FROM stage_items").get().n;
      db.exec("INSERT INTO stage_items_new SELECT * FROM stage_items");
      if (db.prepare("SELECT COUNT(*) n FROM stage_items_new").get().n !== n) throw new Error("stage_items copy is incomplete");
      db.exec("DROP TABLE stage_items; ALTER TABLE stage_items_new RENAME TO stage_items;");
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
}

// "card" items (the extra interaction card types: optional practice, outside mastery and coverage): widened the same way
{
  const t = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'stage_items'").get();
  if (t && !/'card'/.test(t.sql)) {
    db.exec("BEGIN");
    try {
      db.exec(t.sql.replace(/CREATE TABLE "?stage_items"?/, "CREATE TABLE stage_items_new").replace("CHECK (kind IN ('flashcard', 'predict', 'lesson'))", "CHECK (kind IN ('flashcard', 'predict', 'lesson', 'card'))"));
      if (!/'card'/.test(db.prepare("SELECT sql FROM sqlite_master WHERE name = 'stage_items_new'").get().sql)) throw new Error("stage_items: the kind check wasn't found");
      const n = db.prepare("SELECT COUNT(*) n FROM stage_items").get().n;
      db.exec("INSERT INTO stage_items_new SELECT * FROM stage_items");
      if (db.prepare("SELECT COUNT(*) n FROM stage_items_new").get().n !== n) throw new Error("stage_items copy is incomplete");
      db.exec("DROP TABLE stage_items; ALTER TABLE stage_items_new RENAME TO stage_items;");
      db.exec("COMMIT");
    } catch (e) { db.exec("ROLLBACK"); throw e; }
  }
}

// AI spend: one row per billed provider call (hints.js logs every call; cost from hints.js PRICE at the time of the call,
// null when the model has no price). The admin Overview shows the total.
db.exec(`CREATE TABLE IF NOT EXISTS ai_spend (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
  purpose TEXT, input INTEGER NOT NULL, output INTEGER NOT NULL, cost REAL)`);
db.exec("CREATE INDEX IF NOT EXISTS ai_spend_at ON ai_spend (at)");

module.exports = db;
