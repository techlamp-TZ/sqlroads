// Starts both halves of SQL Drills: this drills server (:4000) and SQLPad (:3010) as the Playground.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const SQLPAD_SERVER = path.join(__dirname, "..", "sqlpad-master", "sqlpad-master", "server");

const ENV_FILE = path.join(__dirname, ".env");
if (fs.existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
const { ensureDbUsers, RO, COURSE } = require("./admin/db-users.js");
const DATASETS = path.join(__dirname, "datasets");
// the read-only SQLite connections show the same names as the writable ones in sqlpad-master/.../sql-drills.env
const DATASET_NAME = { sqlzoo: "SQL Zoo", sqltutorialorg: "SQLTutorial.org", tpointtech: "Tpoint Tech", w3schools: "W3Schools", geeksforgeeks: "GeeksforGeeks", tutorialspoint: "TutorialsPoint", sqlcourse: "SQLCourse", tutorialrepublic: "TutorialRepublic" };

// The 30-day course connections, added only when their passwords are in .env, so the
// passwords live in one place instead of SQLPad's config file. They keep a database
// session per editor tab (multiStatementTransactionEnabled), which the course relies on
// for USE / SET search_path and transactions across runs.
function courseConnections() {
  const env = {};
  const add = (id, fields) => {
    for (const [k, v] of Object.entries(fields)) env[`SQLPAD_CONNECTIONS__${id}__${k}`] = String(v);
  };
  if (process.env.MYSQL_ROOT_PASSWORD) {
    add("coursemysql", {
      name: "SQL Course - MySQL",
      driver: "mysql2",
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: process.env.MYSQL_PORT || 3306,
      // No default database: SQLPad's schema list then shows the course databases.
      // The Playground runs "USE practice" when it opens the editor's session.
      username: COURSE,
      password: process.env.SQLDRILLS_COURSE_PASSWORD,
      multiStatementTransactionEnabled: true,
      idleTimeoutSeconds: 3600,
    });
  }
  if (process.env.POSTGRES_PASSWORD) {
    add("coursepg", {
      name: "SQL Course - PostgreSQL",
      driver: "postgres",
      host: process.env.POSTGRES_HOST || "127.0.0.1",
      port: process.env.POSTGRES_PORT || 5432,
      database: "sql_course",
      username: COURSE,
      password: process.env.SQLDRILLS_COURSE_PASSWORD,
      preQueryStatements: "SET search_path TO practice, public",
      multiStatementTransactionEnabled: true,
      idleTimeoutSeconds: 3600,
    });
  }
  // The SQL Exercises (SQL-exercise-master): one MySQL database / PostgreSQL schema per set.
  // The Playground opens the session in set 1 (USE / SET search_path); each exercise switches.
  if (process.env.MYSQL_ROOT_PASSWORD) {
    add("exmysql", {
      name: "SQL Exercises - MySQL",
      driver: "mysql2",
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: process.env.MYSQL_PORT || 3306,
      username: COURSE,
      password: process.env.SQLDRILLS_COURSE_PASSWORD,
      multiStatementTransactionEnabled: true,
      idleTimeoutSeconds: 3600,
    });
  }
  if (process.env.POSTGRES_PASSWORD) {
    add("expg", {
      name: "SQL Exercises - PostgreSQL",
      driver: "postgres",
      host: process.env.POSTGRES_HOST || "127.0.0.1",
      port: process.env.POSTGRES_PORT || 5432,
      database: "sql_exercises",
      username: COURSE,
      password: process.env.SQLDRILLS_COURSE_PASSWORD,
      multiStatementTransactionEnabled: true,
      idleTimeoutSeconds: 3600,
    });
  }
  // Read-only connections for browsing the datasets (the schema sidebar): a SELECT-only user, never root.
  if (process.env.MYSQL_ROOT_PASSWORD) {
    add("romysql", { name: "Datasets (read-only) - MySQL", driver: "mysql2", host: process.env.MYSQL_HOST || "127.0.0.1", port: process.env.MYSQL_PORT || 3306, username: RO, password: process.env.SQLDRILLS_RO_PASSWORD });
  }
  if (process.env.POSTGRES_PASSWORD) {
    add("ropgcourse", { name: "Datasets (read-only) - PostgreSQL course", driver: "postgres", host: process.env.POSTGRES_HOST || "127.0.0.1", port: process.env.POSTGRES_PORT || 5432, database: "sql_course", username: RO, password: process.env.SQLDRILLS_RO_PASSWORD });
    add("ropgex", { name: "Datasets (read-only) - PostgreSQL exercises", driver: "postgres", host: process.env.POSTGRES_HOST || "127.0.0.1", port: process.env.POSTGRES_PORT || 5432, database: "sql_exercises", username: RO, password: process.env.SQLDRILLS_RO_PASSWORD });
  }
  // the SQLite practice datasets, opened read-only (the writable Playground copies stay as they are)
  for (const f of fs.existsSync(DATASETS) ? fs.readdirSync(DATASETS).filter((x) => x.endsWith(".db")) : []) {
    const id = f.slice(0, -3);
    if (!/^[a-z0-9]+$/.test(id)) continue;
    add("ro" + id, { name: "Datasets (read-only) - SQLite " + (DATASET_NAME[id] || id), driver: "sqlite", filename: path.join(DATASETS, f), readonly: true });
  }
  return env;
}

(async () => {
// creates / refreshes the non-root users (passwords are generated into .env, never printed)
const users = await ensureDbUsers();
console.log("[users] non-root database users ready:", Object.entries(users).map(([k, v]) => k + " " + v).join(", ") || "no MySQL / PostgreSQL configured");
const procs = [
  { name: "drills", cwd: __dirname, args: ["server.js"], env: process.env },
  {
    name: "sqlpad",
    cwd: SQLPAD_SERVER,
    args: ["server.js", "--config", "./sql-drills.env"],
    env: { ...process.env, ...courseConnections() },
  },
].map(({ name, cwd, args, env }) => {
  const p = spawn(process.execPath, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
  const tag = (line) => line && !/AWS SDK|maintenance mode|migrate your code|blog post|trace-warnings|DEP0169|url\.parse/.test(line) && console.log(`[${name}] ${line}`);
  p.stdout.on("data", (d) => String(d).split(/\r?\n/).forEach(tag));
  p.stderr.on("data", (d) => String(d).split(/\r?\n/).forEach(tag));
  p.on("exit", (code) => console.log(`[${name}] exited with code ${code}`));
  return p;
});

console.log("SQL Drills:      http://localhost:4000");
console.log("SQLPad playground: http://localhost:3010");

const stop = () => { procs.forEach((p) => p.kill()); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
})();
