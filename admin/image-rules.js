// Pure helpers for Generate → From images (no database): image headers, the vision token estimate, and the
// portable SQL for a small dataset made from the rows in a screenshot.
/** { type, w, h } from the file's own header (PNG / JPEG only), else null. */
function imageInfo(buf) {
  if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { type: "png", w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
    for (let i = 2; i + 9 < buf.length;) {
      if (buf[i] !== 0xff) { i++; continue; }
      const m = buf[i + 1], len = buf.readUInt16BE(i + 2);
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) return { type: "jpeg", w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      i += 2 + len;
    }
  }
  return null;
}
/** Image input tokens on gpt-4.1-mini: 32 px patches, at most 1,536 (the image is scaled down), times 1.62. */
function visionTokens(w, h) {
  let patches = Math.ceil(w / 32) * Math.ceil(h / 32);
  if (patches > 1536) { const s = Math.sqrt((1536 * 1024) / (w * h)); patches = Math.min(1536, Math.ceil((w * s) / 32) * Math.ceil((h * s) / 32)); }
  return Math.ceil(patches * 1.62);
}
const ident = (s, i) => { let x = String(s || "").toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, ""); if (!x || /^\d/.test(x)) x = "c" + (i + 1) + (x ? "_" + x : ""); return x.slice(0, 40); };
const RESERVED = new Set(["order", "group", "select", "from", "where", "table", "user", "key", "index", "values", "limit", "rank", "row", "rows", "desc", "asc", "check", "default", "range"]);
const safe = (x) => (RESERVED.has(x) ? x + "_" : x);
const isInt = (v) => typeof v === "number" ? Number.isInteger(v) : /^-?\d{1,15}$/.test(String(v).trim());
const isNum = (v) => typeof v === "number" || /^-?\d+(\.\d+)?$/.test(String(v).trim());
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v).trim());
const isNull = (v) => v === null || v === undefined || /^(null)?$/i.test(String(v).trim());
/** Portable CREATE TABLE + INSERT for the tables shown (runs the same on SQLite, MySQL and PostgreSQL). */
function datasetSql(tables) {
  const used = new Set();
  const out = [], plan = [];
  for (const t of tables) {
    let name = safe(ident(t.name, 0)); while (used.has(name)) name += "_2"; used.add(name);
    const cols = [];
    t.columns.forEach((c, i) => { let n = safe(ident(c, i)); while (cols.includes(n)) n += "_2"; cols.push(n); });
    const rows = t.rows.filter((r) => r.length).map((r) => cols.map((_, i) => (isNull(r[i]) ? null : r[i])));
    const types = cols.map((_, i) => {
      const shown = sqlType((t.types || [])[i]);
      if (shown) return shown;
      const vals = rows.map((r) => r[i]).filter((v) => v !== null);
      if (!vals.length) return "VARCHAR(100)";
      if (vals.every(isInt)) return "INT";
      if (vals.every(isNum)) return "DECIMAL(14,2)";
      if (vals.every(isDate)) return "DATE";
      const len = Math.max(...vals.map((v) => String(v).length));
      return "VARCHAR(" + Math.min(255, Math.max(20, Math.ceil(len / 10) * 10 + 10)) + ")";
    });
    const first = rows.map((r) => r[0]);
    const pk = types[0] === "INT" && /(^id$|_id$|^no$|^code$)/.test(cols[0]) && first.length && first.every((v) => v !== null) && new Set(first.map(String)).size === first.length;
    const lit = (v, ty) => (v === null ? "NULL" : ty === "INT" || ty.startsWith("DECIMAL") ? String(Number(v)) : "'" + String(v).replace(/'/g, "''") + "'");
    out.push(`CREATE TABLE ${name} (\n  ${cols.map((c, i) => c + " " + types[i] + (pk && i === 0 ? " PRIMARY KEY" : "")).join(",\n  ")}\n);`);
    if (rows.length) out.push(`INSERT INTO ${name} (${cols.join(", ")}) VALUES\n${rows.map((r) => "  (" + r.map((v, i) => lit(v, types[i])).join(", ") + ")").join(",\n")};`);
    plan.push({ name, rows: rows.length, columns: cols });
  }
  return { sql: out.join("\n\n"), plan };
}
/** A portable SQL type for a type shown in a screenshot (Oracle / MySQL / SQL Server spellings), or null. */
function sqlType(shown) {
  const t = String(shown || "").trim().toUpperCase();
  if (!t) return null;
  let m;
  if ((m = /^(?:N?VARCHAR2?|N?CHAR(?:ACTER)?(?:\s+VARYING)?|TEXT|STRING)\s*(?:\((\d+)\))?/.exec(t))) return "VARCHAR(" + Math.min(255, Math.max(1, Number(m[1]) || 100)) + ")";
  if ((m = /^(?:NUMBER|NUMERIC|DECIMAL)\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/.exec(t))) return Number(m[2]) > 0 ? "DECIMAL(" + Math.min(30, Number(m[1])) + "," + Math.min(10, Number(m[2])) + ")" : "INT";
  if (/^(?:NUMBER|INT|INTEGER|BIGINT|SMALLINT|TINYINT|SERIAL)\b/.test(t)) return "INT";
  if (/^(?:FLOAT|REAL|DOUBLE|NUMERIC|DECIMAL)/.test(t)) return "DECIMAL(14,2)";
  if (/^DATE$/.test(t)) return "DATE";
  if (/^(?:DATETIME|TIMESTAMP)/.test(t)) return "VARCHAR(19)";
  if (/^(?:BOOL|BIT)/.test(t)) return "INT";
  return null;
}

module.exports = { imageInfo, visionTokens, datasetSql, sqlType };
