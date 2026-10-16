// Builds one SQLite database file per track (datasets/<siteId>.db) from that track's
// .sql dataset files; SQLPad connects to each file as that track's practice database.
// `node build-datasets.js` rebuilds all of them; server.js calls buildDataset() for
// the Playground's "Reset database".
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");
const db = require("./db.js");

const OUT_DIR = path.join(__dirname, "datasets");

const sqlFilesFor = db.prepare(`
  SELECT f.name, f.content FROM files f
  JOIN folders fo ON fo.id = f.folder_id
  WHERE fo.site_id = ? AND f.type = 'sql'
  ORDER BY fo.order_index, f.order_index
`);

// Rebuilds in place (drop everything, then reload) instead of deleting the file, so it
// works while SQLPad holds the database open.
function buildDataset(siteId) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = new DatabaseSync(path.join(OUT_DIR, `${siteId}.db`));
  const errors = [];
  const loaded = [];
  try {
    out.exec("PRAGMA foreign_keys = OFF");
    const objects = out
      .prepare("SELECT type, name FROM sqlite_master WHERE type IN ('view','table') AND name NOT LIKE 'sqlite_%'")
      .all();
    for (const o of objects.filter((x) => x.type === "view")) out.exec(`DROP VIEW IF EXISTS "${o.name.replace(/"/g, '""')}"`);
    for (const o of objects.filter((x) => x.type === "table")) out.exec(`DROP TABLE IF EXISTS "${o.name.replace(/"/g, '""')}"`);

    const seen = new Set();
    for (const f of sqlFilesFor.all(siteId)) {
      if (seen.has(f.name)) continue;
      seen.add(f.name);
      try {
        out.exec(f.content);
        loaded.push(f.name);
      } catch (e) {
        errors.push(`${f.name}: ${e.message}`);
      }
    }
    const tables = out.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='table'").get().n;
    return { siteId, loaded, tables, errors };
  } finally {
    out.close();
  }
}

function buildAll() {
  const sites = db.prepare("SELECT id FROM sites ORDER BY order_index").all();
  return sites.map((s) => buildDataset(s.id));
}

module.exports = { buildDataset, buildAll };

if (require.main === module) {
  for (const r of buildAll()) {
    console.log(`${r.siteId}.db  <- ${r.loaded.join(", ") || "(no datasets)"}  [${r.tables} tables]`);
    r.errors.forEach((e) => console.error(`  ! ${e}`));
  }
}
