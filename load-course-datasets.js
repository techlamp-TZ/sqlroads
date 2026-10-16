// Loads the 30-day course datasets (practice, manual, sqlbolt) into the local MySQL and
// PostgreSQL servers, as guide "03 - Load the datasets and check them.md" describes:
//   MySQL:      databases practice, manual, sqlbolt
//   PostgreSQL: schemas practice, manual, sqlbolt inside database sql_course
// WARNING: each course script drops its own database/schema first, so re-running resets them.
// Usage: node load-course-datasets.js [--only practice|manual|sqlbolt] [--engine mysql|postgres]
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { Client } = require("pg");
const testTarget = require("./course/test-target.js");

const ENV = path.join(__dirname, ".env");
if (require.main === module && fs.existsSync(ENV)) process.loadEnvFile(ENV);

const COURSE = path.join(__dirname, "..", "learning SQL", "SQL PRACTICES");
const TRACK = { mysql: "01 MySQL - 30 days", postgres: "02 PostgreSQL - 30 days" };
const FILES = {
  practice: "D01-E001.Practice - Practice dataset (retail + school) - build before any P file.sql",
  manual: "D01-E001 - Manual database - PERSONS, COUNTRIES, ARMIES, JOBS, RELIGIONS (build first).sql",
  sqlbolt: "D01-E001.SQLBolt - SQLBolt database (build before the SQLBolt lessons).sql",
};

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : null;
}

function scriptPath(engine, dataset) {
  const trackDir = path.join(COURSE, TRACK[engine]);
  const day1 = fs.readdirSync(trackDir).find((d) => d.startsWith("Day 01"));
  return path.join(trackDir, day1, FILES[dataset]);
}

const fmt = (rows) => rows.map((r) => Object.values(r).join(" ")).join(", ");

async function loadMysql(datasets) {
  const conn = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_ROOT_PASSWORD,
    multipleStatements: true,
  });
  try {
    for (const ds of datasets) {
      const t0 = Date.now();
      const [results] = await conn.query(testTarget.mapMysql(fs.readFileSync(scriptPath("mysql", ds), "utf8")));
      const sets = (Array.isArray(results) ? results : [results]).filter((r) => Array.isArray(r) && r.length);
      console.log(`MySQL ${ds.padEnd(8)} loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${sets.length ? fmt(sets[sets.length - 1]) : "(no counts returned)"}`);
    }
  } finally {
    await conn.end();
  }
}

async function loadPostgres(datasets) {
  const base = {
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD,
  };
  const target = testTarget.pgDatabase("sql_course");
  const admin = new Client({ ...base, database: "postgres" });
  await admin.connect();
  const exists = (await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [target])).rowCount > 0;
  if (!exists) {
    await admin.query(`CREATE DATABASE "${target}"`);
    console.log("PostgreSQL: created database " + target);
  }
  await admin.end();

  const db = new Client({ ...base, database: target });
  await db.connect();
  try {
    for (const ds of datasets) {
      const t0 = Date.now();
      const res = await db.query(fs.readFileSync(scriptPath("postgres", ds), "utf8"));
      const sets = (Array.isArray(res) ? res : [res]).filter((r) => r.rows && r.rows.length);
      console.log(`PostgreSQL ${ds.padEnd(8)} loaded in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${sets.length ? fmt(sets[sets.length - 1].rows) : "(no counts returned)"}`);
    }
  } finally {
    await db.end();
  }
}

const ALL = ["practice", "manual", "sqlbolt"];
module.exports = { loadMysql: (ds = ALL) => loadMysql(ds), loadPostgres: (ds = ALL) => loadPostgres(ds) };

if (require.main === module) {
  (async () => {
    const only = arg("only");
    const engine = arg("engine");
    const datasets = only ? [only] : ALL;
    if (datasets.some((d) => !FILES[d])) throw new Error(`--only must be one of: ${Object.keys(FILES).join(", ")}`);
    if (!engine || engine === "mysql") await loadMysql(datasets);
    if (!engine || engine === "postgres") await loadPostgres(datasets);
  })().catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
}
