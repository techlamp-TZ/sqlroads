// Schema browser for course / SQL Exercises items (MySQL, PostgreSQL): the tables of the exercise's own schema, with
// columns, types, primary and foreign keys, row counts and a 5-row preview. Always through the read-only user
// (admin/db-users.js), never root; the only SQL run is built here from names read out of the catalog.
const { readOnly } = require("../admin/db-users.js");

const PG_DATABASE = { postgres: "sql_course", "ex-postgres": "sql_exercises" };
const MAX_TABLES = 60, PREVIEW_ROWS = 5;
const trackOf = (ex) => String(ex.id).split(":")[0];
const isMysql = (track) => track === "mysql" || track === "ex-mysql";
/** The schema unqualified names resolve to: the exercise's USE / SET search_path line, else practice (as course/check.js). */
const schemaOf = (ex) => { const m = /\bUSE\s+`?(\w+)|\bsearch_path\s+TO\s+"?(\w+)/i.exec(ex.context_sql || ""); return m ? m[1] || m[2] : "practice"; };
const ready = () => !!process.env.SQLDRILLS_RO_PASSWORD;

async function withMysql(schema, fn) {
  const c = await require("mysql2/promise").createConnection({ ...readOnly.mysql(schema), connectTimeout: 5000, dateStrings: true }); // dates as stored, not shifted into the local time zone
  try { await c.query("SET SESSION MAX_EXECUTION_TIME = 3000"); return await fn(c); } finally { await c.end(); }
}
async function withPg(track, fn) {
  const { Client } = require("pg");
  const c = new Client({ ...readOnly.postgres(PG_DATABASE[track]), statement_timeout: 3000, connectionTimeoutMillis: 5000,
    // dates / timestamps as stored, not shifted into the local time zone
    types: { getTypeParser: (oid, fmt) => ([1082, 1114, 1184].includes(oid) ? (v) => v : require("pg").types.getTypeParser(oid, fmt)) } });
  await c.connect();
  try { await c.query("SET default_transaction_read_only = on"); return await fn(c); } finally { await c.end(); }
}

/** [{ name, rows, cols: [{ name, type, pk, fk: { table, column } | null }] }] for the exercise's schema. */
async function tablesFor(ex) {
  const track = trackOf(ex), schema = schemaOf(ex);
  if (isMysql(track)) {
    return withMysql(schema, async (c) => {
      const [cols] = await c.query("SELECT table_name AS t, column_name AS c, column_type AS ty, column_key AS k FROM information_schema.columns WHERE table_schema = ? ORDER BY table_name, ordinal_position", [schema]);
      const [fks] = await c.query("SELECT table_name AS t, column_name AS c, referenced_table_name AS rt, referenced_column_name AS rc FROM information_schema.key_column_usage WHERE table_schema = ? AND referenced_table_name IS NOT NULL", [schema]);
      const [kinds] = await c.query("SELECT table_name AS t, table_type AS ty FROM information_schema.tables WHERE table_schema = ?", [schema]);
      return build(cols.map((r) => ({ t: r.t, c: r.c, type: r.ty, pk: r.k === "PRI" })), fks, kinds, (t) => c.query(`SELECT COUNT(*) AS n FROM \`${schema}\`.\`${t.replace(/`/g, "``")}\``).then(([r]) => r[0].n));
    });
  }
  return withPg(track, async (c) => {
    // keys from pg_catalog: information_schema's constraint views only list tables the user owns
    const keyCols = (type) => c.query(`SELECT cl.relname AS t, a.attname AS c, rcl.relname AS rt, ra.attname AS rc
      FROM pg_constraint co JOIN pg_class cl ON cl.oid = co.conrelid JOIN pg_namespace n ON n.oid = cl.relnamespace
      CROSS JOIN LATERAL unnest(co.conkey, COALESCE(co.confkey, co.conkey)) AS k(a1, a2)
      JOIN pg_attribute a ON a.attrelid = co.conrelid AND a.attnum = k.a1
      LEFT JOIN pg_class rcl ON rcl.oid = co.confrelid LEFT JOIN pg_attribute ra ON ra.attrelid = co.confrelid AND ra.attnum = k.a2
      WHERE co.contype = $2 AND n.nspname = $1`, [schema, type]).then((r) => r.rows);
    const pks = await keyCols("p"), fks = await keyCols("f");
    const cols = (await c.query("SELECT table_name AS t, column_name AS c, data_type AS ty FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position", [schema])).rows
      .map((r) => ({ ...r, pk: pks.some((k) => k.t === r.t && k.c === r.c) }));
    const kinds = (await c.query("SELECT table_name AS t, table_type AS ty FROM information_schema.tables WHERE table_schema = $1", [schema])).rows;
    const q = (x) => '"' + x.replace(/"/g, '""') + '"';
    return build(cols.map((r) => ({ t: r.t, c: r.c, type: r.ty, pk: r.pk })), fks, kinds, (t) => c.query(`SELECT COUNT(*)::int AS n FROM ${q(schema)}.${q(t)}`).then((r) => r.rows[0].n));
  });
}
async function build(cols, fks, kinds, count) {
  const byTable = new Map();
  for (const r of cols) {
    if (!byTable.has(r.t)) byTable.set(r.t, []);
    const fk = fks.find((f) => f.t === r.t && f.c === r.c);
    byTable.get(r.t).push({ name: r.c, type: String(r.type || ""), pk: !!r.pk, fk: fk ? { table: fk.rt, column: fk.rc } : null });
  }
  const view = new Set(kinds.filter((k) => /VIEW/i.test(k.ty)).map((k) => k.t));
  const out = [];
  for (const [name, list] of [...byTable].slice(0, MAX_TABLES)) {
    let rows = null;
    try { rows = Number(await count(name)); } catch { rows = null; }
    out.push({ name, view: view.has(name) || undefined, rows, cols: list });
  }
  return out;
}

/** The first rows of one table of the exercise's schema: { columns, rows }. The table must be in the catalog. */
async function preview(ex, table) {
  const track = trackOf(ex), schema = schemaOf(ex);
  const known = (await tablesFor(ex)).some((t) => t.name === table);
  if (!known) throw Object.assign(new Error("No such table"), { status: 404 });
  if (isMysql(track)) {
    return withMysql(schema, async (c) => {
      const [rows, fields] = await c.query({ sql: `SELECT * FROM \`${schema}\`.\`${table.replace(/`/g, "``")}\` LIMIT ${PREVIEW_ROWS}`, rowsAsArray: true });
      return { columns: fields.map((f) => f.name), rows: rows.map(plain) };
    });
  }
  return withPg(track, async (c) => {
    const q = (x) => '"' + x.replace(/"/g, '""') + '"';
    const r = await c.query({ text: `SELECT * FROM ${q(schema)}.${q(table)} LIMIT ${PREVIEW_ROWS}`, rowMode: "array" });
    return { columns: r.fields.map((f) => f.name), rows: r.rows.map(plain) };
  });
}
const plain = (row) => row.map((v) => (v === null || typeof v !== "object" ? v : v instanceof Date ? v.toISOString().slice(0, 19).replace("T", " ") : Buffer.isBuffer(v) ? "(binary)" : String(v)));

module.exports = { tablesFor, preview, ready, schemaOf };
