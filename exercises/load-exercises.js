// Loads the 10 "SQL Exercises" databases (SQL-exercise-master, from the Wikibooks SQL Exercises)
// into the local servers, one per set:
//   MySQL:      databases ex01_computer_store ... ex10_people_addresses
//   PostgreSQL: schemas with the same names inside database sql_exercises
// The original build scripts are written for MySQL/SQLite; they are converted here (string quotes,
// booleans, DATETIME, ENGINE=, SQLite's bare CHAR and auto-numbered INTEGER PRIMARY KEY).
// Re-running drops and recreates them (= "Reset database").
// Usage: node exercises/load-exercises.js [--engine mysql|postgres] [--set 3]
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { Client } = require("pg");
const { splitSql } = require("../course/split-sql.js");

const ENV = path.join(__dirname, "..", ".env");
if (require.main === module && fs.existsSync(ENV)) process.loadEnvFile(ENV);

const SRC = path.join(__dirname, "..", "..", "SQL-exercise-master");
const PG_DATABASE = "sql_exercises";

/** The sets: number, schema/database name, title (from the Wikibooks page). */
const SETS = [
  { n: 1, schema: "ex01_computer_store", title: "The computer store" },
  { n: 2, schema: "ex02_employee_management", title: "Employee management" },
  { n: 3, schema: "ex03_warehouse", title: "The warehouse" },
  { n: 4, schema: "ex04_movie_theatres", title: "Movie theatres" },
  { n: 5, schema: "ex05_pieces_providers", title: "Pieces and providers" },
  { n: 6, schema: "ex06_scientists", title: "Scientists" },
  { n: 7, schema: "ex07_planet_express", title: "Planet Express" },
  { n: 8, schema: "ex08_hospital", title: "Hospital" },
  { n: 9, schema: "ex09_cran_logs", title: "R package downloads (CRAN logs)" },
  { n: 10, schema: "ex10_people_addresses", title: "People and address history" },
];

const setDir = (n) => path.join(SRC, `SQL_exercise_${String(n).padStart(2, "0")}`);
const figurePath = (n) => path.join(setDir(n), `${n}_schema_figure.png`);

// ---------- converting the build scripts ----------
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

/** Splits "a, 'b, c', (1,2)" at top-level commas, keeping quoted text intact. */
function splitTop(s) {
  const out = [];
  let depth = 0, cur = "", q = null;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      cur += ch;
      if (ch === q && s[i + 1] === q) cur += s[++i];
      else if (ch === q) q = null;
      continue;
    }
    if (ch === "'" || ch === '"') q = ch;
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Index of the bracket closing the one at `open`. */
function closing(s, open) {
  let depth = 0, q = null;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === q && s[i + 1] === q) i++;
      else if (ch === q) q = null;
    } else if (ch === "'" || ch === '"') q = ch;
    else if (ch === "(") depth++;
    else if (ch === ")" && --depth === 0) return i;
  }
  return -1;
}

/** "Al Gore's Head" (MySQL/SQLite double-quoted string) -> 'Al Gore''s Head'. */
const sqlString = (v) => (/^".*"$/s.test(v) ? `'${v.slice(1, -1).replace(/""/g, '"').replace(/'/g, "''")}'` : v);

/**
 * Parses a build script into tables ({name, columns: [{name, type}]}) and statements, converted
 * for the engine. Values of BOOLEAN columns become TRUE/FALSE (PostgreSQL won't take 0/1).
 */
function convertScript(text, engine, fixes = {}) {
  const tables = new Map();
  const out = [];
  for (let stmt of splitSql(stripComments(text))) {
    stmt = stmt.trim().replace(/;$/, "");
    if (!stmt || /^DROP\s+TABLE\b/i.test(stmt)) continue; // each set gets a fresh database anyway
    const create = /^CREATE\s+TABLE\s+(\w+)\s*\(/i.exec(stmt);
    if (create) {
      const open = stmt.indexOf("(");
      const body = stmt.slice(open + 1, closing(stmt, open));
      const columns = [];
      const defs = splitTop(body).map((d) => {
        const m = /^(\w+)\s+(\w+(?:\s*\([^)]*\))?)/.exec(d);
        if (!m || /^(PRIMARY|FOREIGN|CONSTRAINT|UNIQUE|KEY|INDEX|CHECK)$/i.test(m[1])) return d;
        let [, col, type] = m;
        let rest = d.slice(m[0].length);
        if (/^CHAR$/i.test(type)) type = "VARCHAR(50)"; // SQLite's bare CHAR is CHAR(1) on MySQL
        const fix = fixes[`${create[1]}.${col}`.toLowerCase()];
        if (fix) rest = fix[engine];
        if (engine === "postgres") {
          if (/^DATETIME$/i.test(type)) type = "TIMESTAMP";
          if (/^REAL$/i.test(type)) type = "DOUBLE PRECISION";
          if (/^end$/i.test(col)) col = '"end"'; // reserved in PostgreSQL
        }
        columns.push({ name: col.replace(/"/g, ""), type: type.toUpperCase() });
        return `${col} ${type}${rest}`;
      });
      tables.set(create[1].toLowerCase(), { name: create[1], columns });
      const tail = stmt.slice(closing(stmt, open) + 1).replace(/ENGINE\s*=\s*\w+/i, engine === "mysql" ? "ENGINE=InnoDB" : "");
      out.push(`CREATE TABLE ${create[1]} (\n  ${defs.join(",\n  ")}\n)${tail}`);
      continue;
    }
    const insert = /^INSERT\s+INTO\s+(\w+)\s*(\(([^)]*)\))?\s*VALUES\s*/i.exec(stmt);
    if (insert) {
      const t = tables.get(insert[1].toLowerCase());
      const names = insert[3] ? insert[3].split(",").map((c) => c.trim().toLowerCase()) : t.columns.map((c) => c.name.toLowerCase());
      const bool = new Set(t.columns.filter((c) => c.type === "BOOLEAN").map((c) => c.name.toLowerCase()));
      const tuples = splitTop(stmt.slice(insert[0].length)).map((tuple) => {
        const vals = splitTop(tuple.replace(/^\(/, "").replace(/\)$/, "")).map((v, i) => {
          if (bool.has(names[i]) && /^[01]$/.test(v)) return v === "1" ? "TRUE" : "FALSE";
          return sqlString(v);
        });
        return `(${vals.join(", ")})`;
      });
      out.push(`INSERT INTO ${insert[1]}${insert[2] ? ` ${insert[2]}` : ""} VALUES\n  ${tuples.join(",\n  ")}`);
      continue;
    }
    throw new Error(`Unexpected statement in a build script: ${stmt.slice(0, 60)}`);
  }
  return { tables: [...tables.values()], statements: out };
}

// Columns whose definition needs more than a type change.
const FIXES = {
  // SQLite numbers INTEGER PRIMARY KEY by itself; question 4.8 inserts a movie without a code.
  "movies.code": { mysql: " AUTO_INCREMENT PRIMARY KEY", postgres: " GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY" },
};
const AFTER_LOAD = {
  postgres: { 4: ["SELECT setval(pg_get_serial_sequence('movies', 'code'), (SELECT MAX(code) FROM movies))"] },
};

const CRAN_CSV = "cran_logs_2015-01-01.csv";
const CRAN_TABLE = "cran_logs_2015_01_01";
const CRAN_COLUMNS = [
  ["date", "DATE"], ["time", "TIME"], ["size", "INTEGER"], ["r_version", "VARCHAR(20)"], ["r_arch", "VARCHAR(20)"],
  ["r_os", "VARCHAR(40)"], ["package", "VARCHAR(100)"], ["version", "VARCHAR(40)"], ["country", "VARCHAR(10)"], ["ip_id", "INTEGER"],
];

function parseCsv(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line) continue;
    rows.push(splitTop(line).map((v) => (v === "NA" ? null : /^".*"$/.test(v) ? v.slice(1, -1) : v)));
  }
  return rows.slice(1);
}

/** Everything one set needs: {tables, statements, rows?} for the engine. */
function buildSet(set, engine) {
  if (set.n === 9) {
    const ddl = `CREATE TABLE ${CRAN_TABLE} (\n  ${CRAN_COLUMNS.map(([c, t]) => `${c} ${t}`).join(",\n  ")}\n)`;
    return {
      tables: [{ name: CRAN_TABLE, columns: CRAN_COLUMNS.map(([name, type]) => ({ name, type })) }],
      statements: [ddl],
      rows: parseCsv(fs.readFileSync(path.join(setDir(9), CRAN_CSV), "utf8")),
    };
  }
  const file = fs.readdirSync(setDir(set.n)).find((f) => /build_schema\.sql$/.test(f));
  const built = convertScript(fs.readFileSync(path.join(setDir(set.n), file), "utf8"), engine, FIXES);
  built.statements.push(...((AFTER_LOAD[engine] || {})[set.n] || []));
  return built;
}

const chunks = (list, n) => Array.from({ length: Math.ceil(list.length / n) }, (_, i) => list.slice(i * n, i * n + n));

// ---------- loading ----------
const mysqlConfig = () => ({
  host: process.env.MYSQL_HOST || "127.0.0.1",
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_ROOT_PASSWORD,
});
const pgConfig = (database) => ({
  host: process.env.POSTGRES_HOST || "127.0.0.1",
  port: Number(process.env.POSTGRES_PORT || 5432),
  user: process.env.POSTGRES_USER || "postgres",
  password: process.env.POSTGRES_PASSWORD,
  database,
});

async function loadMysql(sets = SETS, log = console.log) {
  const c = await mysql.createConnection({ ...mysqlConfig(), multipleStatements: true });
  try {
    for (const set of sets) {
      const t0 = Date.now();
      const b = buildSet(set, "mysql");
      await c.query(`DROP DATABASE IF EXISTS \`${set.schema}\``);
      await c.query(`CREATE DATABASE \`${set.schema}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
      await c.query(`USE \`${set.schema}\``);
      for (const s of b.statements) await c.query(s);
      for (const part of chunks(b.rows || [], 2000)) await c.query(`INSERT INTO ${CRAN_TABLE} VALUES ?`, [part]);
      log(`MySQL      ${set.schema.padEnd(26)} ${b.tables.length} tables${b.rows ? `, ${b.rows.length} rows` : ""} (${Date.now() - t0} ms)`);
    }
  } finally {
    await c.end();
  }
}

async function loadPostgres(sets = SETS, log = console.log) {
  const admin = new Client(pgConfig("postgres"));
  await admin.connect();
  if (!(await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [PG_DATABASE])).rowCount) {
    await admin.query(`CREATE DATABASE ${PG_DATABASE}`);
    log(`PostgreSQL: created database ${PG_DATABASE}`);
  }
  await admin.end();
  const c = new Client(pgConfig(PG_DATABASE));
  await c.connect();
  try {
    for (const set of sets) {
      const t0 = Date.now();
      const b = buildSet(set, "postgres");
      await c.query("BEGIN");
      await c.query(`DROP SCHEMA IF EXISTS ${set.schema} CASCADE; CREATE SCHEMA ${set.schema}; SET LOCAL search_path TO ${set.schema}`);
      for (const s of b.statements) await c.query(s);
      for (const part of chunks(b.rows || [], 2000)) {
        const params = part.flat();
        const width = CRAN_COLUMNS.length;
        const values = part.map((_, r) => `(${CRAN_COLUMNS.map((__, k) => `$${r * width + k + 1}`).join(", ")})`).join(", ");
        await c.query(`INSERT INTO ${CRAN_TABLE} VALUES ${values}`, params);
      }
      await c.query("COMMIT");
      log(`PostgreSQL ${set.schema.padEnd(26)} ${b.tables.length} tables${b.rows ? `, ${b.rows.length} rows` : ""} (${Date.now() - t0} ms)`);
    }
  } catch (e) {
    await c.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    await c.end();
  }
}

module.exports = { SETS, PG_DATABASE, buildSet, figurePath, loadMysql, loadPostgres };

if (require.main === module) {
  const arg = (name) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > -1 ? process.argv[i + 1] : null;
  };
  (async () => {
    const engine = arg("engine");
    const only = arg("set");
    const sets = only ? SETS.filter((s) => s.n === Number(only)) : SETS;
    if (!sets.length) throw new Error("--set must be 1..10");
    if (!engine || engine === "mysql") await loadMysql(sets);
    if (!engine || engine === "postgres") await loadPostgres(sets);
  })().catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
}
