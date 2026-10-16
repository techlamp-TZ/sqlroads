// Backups: a .zip with a consistent copy of data.sqlite (VACUUM INTO) and the non-secret settings.
// API keys and database passwords from .env are never written into a backup.
// Restore copies every table back from the backup into the live database (after taking a
// "before restore" backup), so the running server keeps working.
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const db = require("../db.js");
const library = require("../library/library.js");

const DIR = path.join(__dirname, "..", "backups");
// screenshots uploaded on Generate → From images (admin only, never shown to learners): kept in backups too
const UPLOADS = path.join(__dirname, "..", "uploads", "images");
const UPLOAD_NAME = /^uploads\/images\/img-[0-9a-f]{10}\/\d+\.(png|jpg)$/;
function uploadedImages() {
  if (!fs.existsSync(UPLOADS)) return [];
  return fs.readdirSync(UPLOADS).filter((b) => /^img-[0-9a-f]{10}$/.test(b)).flatMap((b) => fs.readdirSync(path.join(UPLOADS, b)).filter((f) => /^\d+\.(png|jpg)$/.test(f)).map((f) => ({ name: "uploads/images/" + b + "/" + f, data: fs.readFileSync(path.join(UPLOADS, b, f)) })));
}
const SECRET = /KEY|PASSWORD|SECRET|TOKEN/i;

// ---- a minimal zip writer / reader (deflate), enough for our own backups
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function zip(files) {
  const parts = [], central = [];
  let offset = 0;
  for (const f of files) {
    const name = Buffer.from(f.name), data = Buffer.isBuffer(f.data) ? f.data : Buffer.from(f.data), comp = zlib.deflateRawSync(data), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0, 6); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(0, 10); local.writeUInt32LE(crc, 14); local.writeUInt32LE(comp.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26); local.writeUInt16LE(0, 28);
    parts.push(local, name, comp);
    const cen = Buffer.alloc(46);
    cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(20, 4); cen.writeUInt16LE(20, 6); cen.writeUInt16LE(0, 8); cen.writeUInt16LE(8, 10);
    cen.writeUInt32LE(0, 12); cen.writeUInt32LE(crc, 16); cen.writeUInt32LE(comp.length, 20); cen.writeUInt32LE(data.length, 24);
    cen.writeUInt16LE(name.length, 28); cen.writeUInt32LE(offset, 42);
    central.push(cen, name);
    offset += 30 + name.length + comp.length;
  }
  const cenBuf = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cenBuf.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cenBuf, end]);
}
function unzip(buf) {
  const out = {};
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error("Not a zip file");
  let p = buf.readUInt32LE(end + 16);
  const n = buf.readUInt16LE(end + 10);
  for (let k = 0; k < n; k++) {
    const method = buf.readUInt16LE(p + 10), size = buf.readUInt32LE(p + 20), nameLen = buf.readUInt16LE(p + 28), extra = buf.readUInt16LE(p + 30), comment = buf.readUInt16LE(p + 32), local = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString();
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const data = buf.slice(start, start + size);
    out[name] = method === 8 ? zlib.inflateRawSync(data) : data;
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

function settings() {
  const env = {};
  try {
    for (const line of fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(line);
      if (m && !SECRET.test(m[1])) env[m[1]] = m[2].trim();
    }
  } catch { /* no .env */ }
  return { note: "API keys and database passwords are never included in a backup.", env, port: process.env.PORT || 4000 };
}

function create(label = "manual") {
  fs.mkdirSync(DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const tmp = path.join(DIR, `.snapshot-${stamp}.sqlite`);
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  const data = fs.readFileSync(tmp);
  fs.unlinkSync(tmp);
  const s = library.summary();
  const images = uploadedImages();
  const manifest = { created_at: new Date().toISOString(), label, exercises: s.total, levels: s.levels.length, database_bytes: data.length, images: images.length, contents: ["data.sqlite", "settings.json", "manifest.json"].concat(images.length ? ["uploads/images/*"] : []) };
  const name = `sql-drills-backup-${stamp}${label === "before-restore" ? "-before-restore" : ""}.zip`;
  fs.writeFileSync(path.join(DIR, name), zip([
    { name: "data.sqlite", data },
    { name: "settings.json", data: JSON.stringify(settings(), null, 2) },
    { name: "manifest.json", data: JSON.stringify(manifest, null, 2) },
  ].concat(images)));
  return describe(name);
}
function describe(name) {
  const file = path.join(DIR, name);
  const st = fs.statSync(file);
  let manifest = {};
  try { manifest = JSON.parse(unzip(fs.readFileSync(file))["manifest.json"].toString()); } catch { /* foreign zip */ }
  return { name, bytes: st.size, created_at: manifest.created_at || st.mtime.toISOString(), label: manifest.label || "", exercises: manifest.exercises };
}
function list() {
  if (!fs.existsSync(DIR)) return [];
  return fs.readdirSync(DIR).filter((f) => /^sql-drills-backup-.*\.zip$/.test(f)).map(describe).sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
}
function fileOf(name) {
  if (!/^sql-drills-backup-[\w-]+\.zip$/.test(name)) throw Object.assign(new Error("Unknown backup"), { status: 404 });
  const file = path.join(DIR, name);
  if (!fs.existsSync(file)) throw Object.assign(new Error("Unknown backup"), { status: 404 });
  return file;
}
function restore(name) {
  const files = unzip(fs.readFileSync(fileOf(name)));
  if (!files["data.sqlite"]) throw new Error("This backup has no data.sqlite");
  const safety = create("before-restore");
  const tmp = path.join(DIR, `.restore-${Date.now()}.sqlite`);
  fs.writeFileSync(tmp, files["data.sqlite"]);
  try {
    db.exec(`ATTACH DATABASE '${tmp.replace(/'/g, "''")}' AS bk`);
    const tables = db.prepare("SELECT name FROM bk.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
    const live = new Set(db.prepare("SELECT name FROM main.sqlite_master WHERE type = 'table'").all().map((r) => r.name));
    db.exec("BEGIN");
    let rows = 0;
    for (const t of tables) {
      if (!live.has(t)) continue;
      const cols = db.prepare(`PRAGMA bk.table_info("${t}")`).all().map((c) => c.name).filter((c) => db.prepare(`PRAGMA main.table_info("${t}")`).all().some((m) => m.name === c));
      const list = cols.map((c) => `"${c}"`).join(", ");
      db.exec(`DELETE FROM main."${t}"`);
      rows += db.prepare(`INSERT INTO main."${t}" (${list}) SELECT ${list} FROM bk."${t}"`).run().changes;
    }
    db.exec("COMMIT");
    db.exec("DETACH DATABASE bk");
    // the screenshots, then the image-built datasets back into the in-memory dataset maps
    let images = 0;
    for (const [name, buf] of Object.entries(files)) {
      if (!UPLOAD_NAME.test(name)) continue;
      const to = path.join(__dirname, "..", ...name.split("/"));
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.writeFileSync(to, buf); images++;
    }
    const custom = library.reloadCustomDatasets();
    require("./content.js").reloadCustomDatasets(custom);
    custom.forEach((r) => require("./stage-gen.js").registerSite(r.key, r.site));
    library.build();
    return { ok: true, tables: tables.length, rows, images, datasets: custom.length, missingDatasets: missingDatasets(), safety: safety.name };
  } catch (e) {
    try { db.exec("ROLLBACK"); } catch { /* not in a transaction */ }
    try { db.exec("DETACH DATABASE bk"); } catch { /* not attached */ }
    throw e;
  } finally {
    fs.unlinkSync(tmp);
  }
}

/** Items whose dataset doesn't exist (should be none: items and datasets are restored together). */
function missingDatasets() {
  const known = require("./content.js").DATASETS, sites = library.DATASETS;
  const out = [];
  for (const r of db.prepare("SELECT id, data FROM content_items WHERE kind = 'drill' AND status != 'rejected'").all()) { const d = JSON.parse(r.data); if (d.dataset && !known[d.dataset]) out.push(r.id); }
  for (const r of db.prepare("SELECT id, data FROM stage_items WHERE status != 'rejected'").all()) { const d = JSON.parse(r.data); if (d.site && d.variant !== "endstate" && !sites[d.site]) out.push(r.id); }
  return out;
}

module.exports = { create, list, restore, fileOf, missingDatasets };
