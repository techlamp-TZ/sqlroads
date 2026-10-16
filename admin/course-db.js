// The course databases (MySQL practice / manual / sqlbolt, PostgreSQL sql_course schemas practice / manual /
// sqlbolt): a backup as SQL files, and a reset to the clean starting state from the course's own seed scripts.
// A reset always makes a backup first. Backups go to backups/course-<time>/ (never anything from .env).
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { Client } = require("pg");
const db = require("../db.js");

const DATASETS = ["practice", "manual", "sqlbolt"];
const BACKUPS = path.join(__dirname, "..", "backups");
const stamp = () => new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const q = (id) => "`" + String(id).replace(/`/g, "``") + "`";
const pq = (id) => '"' + String(id).replace(/"/g, '""') + '"';

function mysqlLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (Buffer.isBuffer(v)) return "0x" + v.toString("hex");
  if (typeof v === "number" || typeof v === "bigint") return String(v);
  return "'" + String(v).replace(/\\/g, "\\\\").replace(/'/g, "''").replace(/\n/g, "\\n").replace(/\r/g, "\\r") + "'";
}
/** One MySQL database as a SQL script: tables (rows included), views, routines, triggers. */
async function dumpMysqlDatabase(c, name) {
  const out = [`-- MySQL database ${name}, backed up ${new Date().toISOString()}`, `DROP DATABASE IF EXISTS ${q(name)};`, `CREATE DATABASE ${q(name)};`, `USE ${q(name)};`, "SET FOREIGN_KEY_CHECKS = 0;"];
  const [objs] = await c.query("SELECT table_name AS t, table_type AS k FROM information_schema.tables WHERE table_schema = ? ORDER BY table_name", [name]);
  let rows = 0;
  for (const o of objs.filter((x) => x.k === "BASE TABLE")) {
    const [[create]] = await c.query(`SHOW CREATE TABLE ${q(name)}.${q(o.t)}`);
    out.push("", create["Create Table"] + ";");
    const [data] = await c.query({ sql: `SELECT * FROM ${q(name)}.${q(o.t)}`, rowsAsArray: true });
    for (let i = 0; i < data.length; i += 200) out.push(`INSERT INTO ${q(o.t)} VALUES ` + data.slice(i, i + 200).map((r) => "(" + r.map(mysqlLiteral).join(", ") + ")").join(",\n  ") + ";");
    rows += data.length;
  }
  for (const o of objs.filter((x) => x.k === "VIEW")) {
    const [[v]] = await c.query(`SHOW CREATE VIEW ${q(name)}.${q(o.t)}`);
    out.push("", v["Create View"].replace(/DEFINER=\S+\s/, "") + ";");
  }
  const [routines] = await c.query("SELECT routine_name AS n, routine_type AS k FROM information_schema.routines WHERE routine_schema = ?", [name]);
  const [triggers] = await c.query("SELECT trigger_name AS n FROM information_schema.triggers WHERE trigger_schema = ?", [name]);
  if (routines.length || triggers.length) out.push("", "DELIMITER $$");
  for (const r of routines) {
    const [[x]] = await c.query(`SHOW CREATE ${r.k} ${q(name)}.${q(r.n)}`);
    out.push(String(x[r.k === "PROCEDURE" ? "Create Procedure" : "Create Function"]).replace(/DEFINER=\S+\s/, "") + "$$");
  }
  for (const t of triggers) {
    const [[x]] = await c.query(`SHOW CREATE TRIGGER ${q(name)}.${q(t.n)}`);
    out.push(String(x["SQL Original Statement"]).replace(/DEFINER=\S+\s/, "") + "$$");
  }
  if (routines.length || triggers.length) out.push("DELIMITER ;");
  out.push("", "SET FOREIGN_KEY_CHECKS = 1;");
  return { sql: out.join("\n") + "\n", tables: objs.filter((x) => x.k === "BASE TABLE").length, views: objs.length - objs.filter((x) => x.k === "BASE TABLE").length, routines: routines.length, triggers: triggers.length, rows };
}
function pgLiteral(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number" || typeof v === "bigint" || typeof v === "boolean") return String(v);
  if (v instanceof Date) return "'" + v.toISOString() + "'";
  if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}
/** One PostgreSQL schema as a SQL script: tables with columns, defaults, constraints and rows; indexes; views; functions. */
async function dumpPgSchema(c, schema) {
  const out = [`-- PostgreSQL schema ${schema} (database sql_course), backed up ${new Date().toISOString()}`, `DROP SCHEMA IF EXISTS ${pq(schema)} CASCADE;`, `CREATE SCHEMA ${pq(schema)};`, `SET search_path TO ${pq(schema)};`];
  const tables = (await c.query("SELECT c.oid, c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind IN ('r','p') ORDER BY c.relname", [schema])).rows;
  let rows = 0;
  const fks = [];
  for (const t of tables) {
    const cols = (await c.query(`SELECT a.attname, pg_catalog.format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull, pg_get_expr(d.adbin, d.adrelid) AS def, a.attidentity
      FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum WHERE a.attrelid = $1 AND a.attnum > 0 AND NOT a.attisdropped ORDER BY a.attnum`, [t.oid])).rows;
    const cons = (await c.query("SELECT conname, contype, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1 ORDER BY contype", [t.oid])).rows;
    const lines = cols.map((x) => `  ${pq(x.attname)} ${x.type}${x.attidentity === "a" ? " GENERATED ALWAYS AS IDENTITY" : x.attidentity === "d" ? " GENERATED BY DEFAULT AS IDENTITY" : x.def ? " DEFAULT " + x.def.replace(new RegExp(schema + "\\.", "g"), "") : ""}${x.attnotnull ? " NOT NULL" : ""}`)
      .concat(cons.filter((k) => k.contype !== "f").map((k) => `  CONSTRAINT ${pq(k.conname)} ${k.def}`));
    out.push("", `CREATE TABLE ${pq(t.relname)} (\n${lines.join(",\n")}\n);`);
    cons.filter((k) => k.contype === "f").forEach((k) => fks.push(`ALTER TABLE ${pq(t.relname)} ADD CONSTRAINT ${pq(k.conname)} ${k.def};`));
    const data = (await c.query({ text: `SELECT * FROM ${pq(schema)}.${pq(t.relname)}`, rowMode: "array" })).rows;
    const names = cols.map((x) => pq(x.attname)).join(", ");
    const over = cols.some((x) => x.attidentity === "a") ? " OVERRIDING SYSTEM VALUE" : "";
    for (let i = 0; i < data.length; i += 200) out.push(`INSERT INTO ${pq(t.relname)} (${names})${over} VALUES ` + data.slice(i, i + 200).map((r) => "(" + r.map(pgLiteral).join(", ") + ")").join(",\n  ") + ";");
    rows += data.length;
  }
  // sequences behind serial columns: continue after the restored rows
  const seqs = (await c.query("SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col FROM pg_class s JOIN pg_depend d ON d.objid = s.oid JOIN pg_class t ON t.oid = d.refobjid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid JOIN pg_namespace n ON n.oid = s.relnamespace WHERE s.relkind = 'S' AND n.nspname = $1", [schema])).rows;
  for (const s of seqs) out.push(`SELECT setval(pg_get_serial_sequence('${schema}.${s.tbl}', '${s.col}'), COALESCE((SELECT MAX(${pq(s.col)}) FROM ${pq(s.tbl)}), 0) + 1, false);`);
  out.push("", ...fks);
  const idx = (await c.query("SELECT indexdef FROM pg_indexes WHERE schemaname = $1 AND indexname NOT IN (SELECT conname FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = $1)", [schema])).rows;
  idx.forEach((i) => out.push(i.indexdef + ";"));
  const views = (await c.query("SELECT c.relname, pg_get_viewdef(c.oid, true) AS def, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = $1 AND c.relkind IN ('v','m') ORDER BY c.oid", [schema])).rows;
  views.forEach((v) => out.push("", `CREATE ${v.relkind === "m" ? "MATERIALIZED VIEW" : "VIEW"} ${pq(v.relname)} AS\n${v.def}`));
  const fns = (await c.query("SELECT pg_get_functiondef(p.oid) AS def FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 AND p.prokind IN ('f','p')", [schema])).rows;
  fns.forEach((f) => out.push("", f.def + ";"));
  return { sql: out.join("\n") + "\n", tables: tables.length, views: views.length, routines: fns.length, rows };
}

/** Back up the course databases (both engines) to backups/course-<time>/. Returns what was saved. */
async function backupCourse() {
  const dir = path.join(BACKUPS, "course-" + stamp());
  fs.mkdirSync(dir, { recursive: true });
  const saved = [];
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || "root", password: process.env.MYSQL_ROOT_PASSWORD, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
  try {
    for (const name of DATASETS) {
      const d = await dumpMysqlDatabase(c, name);
      fs.writeFileSync(path.join(dir, `mysql-${name}.sql`), d.sql);
      saved.push({ engine: "MySQL", name, file: `mysql-${name}.sql`, tables: d.tables, views: d.views, routines: d.routines + d.triggers, rows: d.rows, bytes: Buffer.byteLength(d.sql) });
    }
  } finally { await c.end(); }
  const p = new Client({ host: process.env.POSTGRES_HOST || "127.0.0.1", port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER || "postgres", password: process.env.POSTGRES_PASSWORD, database: "sql_course" });
  await p.connect();
  try {
    for (const name of DATASETS) {
      const d = await dumpPgSchema(p, name);
      fs.writeFileSync(path.join(dir, `postgres-${name}.sql`), d.sql);
      saved.push({ engine: "PostgreSQL", name, file: `postgres-${name}.sql`, tables: d.tables, views: d.views, routines: d.routines, rows: d.rows, bytes: Buffer.byteLength(d.sql) });
    }
  } finally { await p.end(); }
  fs.writeFileSync(path.join(dir, "README.txt"), `Course databases backed up ${new Date().toISOString()} before a reset.\nMySQL files: run in the mysql client or SQLPad (each drops and recreates its database).\nPostgreSQL files: run in database sql_course (each drops and recreates its schema).\n`);
  return { dir: path.relative(path.join(__dirname, ".."), dir), files: saved };
}

let running = null;
/** Back up, then reload the course databases from the course's own seed scripts and forget the auto-setups. */
async function resetCourse() {
  if (running) throw Object.assign(new Error("A reset is already running."), { status: 409 });
  if (require("../course/test-target.js").isTest()) throw new Error("Refusing: this process is in self-test mode.");
  running = (async () => {
    const t0 = Date.now();
    const backup = await backupCourse();
    const { loadMysql, loadPostgres } = require("../load-course-datasets.js");
    const log = console.log;
    console.log = () => {};
    try { await loadMysql(); await loadPostgres(); } finally { console.log = log; }
    // the reload recreated the course objects as root / postgres: the non-root users get their rights back
    await require("./db-users.js").ensureDbUsers();
    // the hidden setup exercises (e.g. "Build the star schema") run again before the next Run / Check that needs them
    const forgot = db.prepare("DELETE FROM setup_runs WHERE track IN ('mysql', 'postgres')").run().changes;
    db.prepare("CREATE TABLE IF NOT EXISTS course_resets (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, backup TEXT NOT NULL, seconds INTEGER)").run();
    db.prepare("INSERT INTO course_resets (at, backup, seconds) VALUES (?, ?, ?)").run(new Date().toISOString(), backup.dir, Math.round((Date.now() - t0) / 1000));
    return { ok: true, backup, setupsForgotten: forgot, seconds: Math.round((Date.now() - t0) / 1000) };
  })();
  try { return await running; } finally { running = null; }
}
function lastReset() {
  try { return db.prepare("SELECT * FROM course_resets ORDER BY id DESC LIMIT 1").get() || null; } catch { return null; }
}
module.exports = { backupCourse, resetCourse, lastReset };
