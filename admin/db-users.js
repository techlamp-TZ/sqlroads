// The non-root database users (user decision 2026-10-15):
//   sqldrills_ro      read-only (SELECT) on the course databases: the schema browser and SQLPad's "read-only" connections
//   sqldrills_course  everything INSIDE the course databases only (no server-wide rights, no CREATE USER): SQLPad's course
//                     connections, so the 30-day course's CREATE / INSERT / UPDATE days keep working without root
// Run at every start (idempotent): new course tables get their grants, and PostgreSQL objects a reload created as
// postgres move back to sqldrills_course (so it can ALTER / DROP them). Passwords are generated once into .env and
// never printed or logged.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const ENV_FILE = path.join(__dirname, "..", ".env");
const RO = "sqldrills_ro", COURSE = "sqldrills_course";
const MYSQL_DBS = /^(practice|manual|sqlbolt|ex\d\d_\w+)$/;
const PG_DBS = ["sql_course", "sql_exercises"];
const PG_SCHEMAS = /^(practice|manual|sqlbolt|ex\d\d_\w+)$/;

/** The two passwords: from the environment, else generated and appended to .env (never shown). */
function passwords() {
  const add = [];
  for (const k of ["SQLDRILLS_RO_PASSWORD", "SQLDRILLS_COURSE_PASSWORD"]) {
    if (!process.env[k]) { process.env[k] = crypto.randomBytes(18).toString("base64url"); add.push(`${k}=${process.env[k]}`); }
  }
  if (add.length) fs.appendFileSync(ENV_FILE, "\n# Non-root database users for the schema browser and SQLPad (generated; admin/db-users.js)\n" + add.join("\n") + "\n");
  return { ro: process.env.SQLDRILLS_RO_PASSWORD, course: process.env.SQLDRILLS_COURSE_PASSWORD };
}

async function mysqlUsers(pw) {
  const mysql = require("mysql2/promise");
  const c = await mysql.createConnection({ host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || "root", password: process.env.MYSQL_ROOT_PASSWORD });
  try {
    const [rows] = await c.query("SELECT schema_name AS s FROM information_schema.schemata");
    const dbs = rows.map((r) => r.s).filter((s) => MYSQL_DBS.test(s));
    for (const host of ["localhost", "127.0.0.1"]) {
      for (const [user, p] of [[RO, pw.ro], [COURSE, pw.course]]) {
        await c.query("CREATE USER IF NOT EXISTS ?@? IDENTIFIED BY ?", [user, host, p]);
        await c.query("ALTER USER ?@? IDENTIFIED BY ?", [user, host, p]);
      }
      for (const d of dbs) {
        await c.query(`GRANT SELECT, SHOW VIEW ON \`${d}\`.* TO ?@?`, [RO, host]);
        await c.query(`GRANT ALL PRIVILEGES ON \`${d}\`.* TO ?@?`, [COURSE, host]);
      }
    }
    return dbs.length;
  } finally { await c.end(); }
}

async function pgUsers(pw) {
  const { Client } = require("pg");
  const conn = (database) => new Client({ host: process.env.POSTGRES_HOST || "127.0.0.1", port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER || "postgres", password: process.env.POSTGRES_PASSWORD, database });
  const admin = conn("postgres");
  await admin.connect();
  try {
    for (const [role, p] of [[RO, pw.ro], [COURSE, pw.course]]) {
      const exists = (await admin.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [role])).rowCount;
      await admin.query(`${exists ? "ALTER" : "CREATE"} ROLE ${role} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD ${admin.escapeLiteral(p)}`);
    }
  } finally { await admin.end(); }
  let schemas = 0;
  for (const database of PG_DBS) {
    const c = conn(database);
    try { await c.connect(); } catch { continue; } // that database isn't loaded on this computer
    try {
      await c.query(`GRANT CONNECT ON DATABASE ${database} TO ${RO}, ${COURSE}`);
      const list = (await c.query("SELECT nspname FROM pg_namespace")).rows.map((r) => r.nspname).filter((s) => PG_SCHEMAS.test(s));
      for (const s of list) {
        schemas++;
        const q = (x) => '"' + x.replace(/"/g, '""') + '"';
        await c.query(`ALTER SCHEMA ${q(s)} OWNER TO ${COURSE}`);
        // tables, views and functions move to the course user (ALTER / DROP need ownership); a sequence owned by a
        // column moves with its table
        const objs = (await c.query(`SELECT c.relname, c.relkind FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = $1 AND c.relkind IN ('r','p','f','v','m','S') AND pg_get_userbyid(c.relowner) <> $2
          AND NOT (c.relkind = 'S' AND EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = c.oid AND d.deptype IN ('a','i')))
          ORDER BY c.relkind = 'S', c.relname`, [s, COURSE])).rows;
        const KIND = { r: "TABLE", p: "TABLE", f: "FOREIGN TABLE", v: "VIEW", m: "MATERIALIZED VIEW", S: "SEQUENCE" };
        for (const o of objs) { try { await c.query(`ALTER ${KIND[o.relkind]} ${q(s)}.${q(o.relname)} OWNER TO ${COURSE}`); } catch { /* owned by something else that moved it already */ } }
        const fns = (await c.query(`SELECT p.oid::regprocedure::text AS sig FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = $1 AND pg_get_userbyid(p.proowner) <> $2`, [s, COURSE])).rows;
        for (const f of fns) { try { await c.query(`ALTER ROUTINE ${f.sig} OWNER TO ${COURSE}`); } catch { /* an aggregate or a system-owned routine */ } }
        await c.query(`GRANT USAGE ON SCHEMA ${q(s)} TO ${RO}`);
        await c.query(`GRANT SELECT ON ALL TABLES IN SCHEMA ${q(s)} TO ${RO}`);
        for (const owner of [COURSE, process.env.POSTGRES_USER || "postgres"]) await c.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA ${q(s)} GRANT SELECT ON TABLES TO ${RO}`);
      }
    } finally { await c.end(); }
  }
  return schemas;
}

/** Creates / refreshes both users on MySQL and PostgreSQL. Never throws: a server that isn't running is reported. */
async function ensureDbUsers() {
  const pw = passwords();
  const out = {};
  if (process.env.MYSQL_ROOT_PASSWORD) { try { out.mysql = (await mysqlUsers(pw)) + " databases"; } catch (e) { out.mysql = "skipped: " + String(e.code || e.message).slice(0, 80); } }
  if (process.env.POSTGRES_PASSWORD) { try { out.postgres = (await pgUsers(pw)) + " schemas"; } catch (e) { out.postgres = "skipped: " + String(e.code || e.message).slice(0, 80); } }
  return out;
}

/** Read-only connection settings (the schema browser). */
const readOnly = {
  mysql: (database) => ({ host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306), user: RO, password: process.env.SQLDRILLS_RO_PASSWORD, database }),
  postgres: (database) => ({ host: process.env.POSTGRES_HOST || "127.0.0.1", port: Number(process.env.POSTGRES_PORT || 5432), user: RO, password: process.env.SQLDRILLS_RO_PASSWORD, database }),
};

module.exports = { ensureDbUsers, readOnly, RO, COURSE, PG_DBS };
