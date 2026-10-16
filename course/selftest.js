// Self-test: submits every auto-checked exercise's own solution as the answer; all should be
// "correct". Pass 1 checks exercises without prerequisites on freshly loaded data; pass 2
// reloads, then runs each exercise's prerequisites (as the learner's button does) before
// checking it. The datasets are reloaded at the end, so the databases end up clean.
// It runs ONLY on separate test databases (MySQL sqldrills_test_practice / _manual / _sqlbolt, PostgreSQL
// sqldrills_test_course), loaded from the course's own seed scripts, and drops them at the end. It refuses to
// start if the target would be a real course database. The real course databases are never touched.
// Usage: node course/selftest.js [mysql|postgres]
const fs = require("node:fs");
const path = require("node:path");
const ENV = path.join(__dirname, "..", ".env");
if (fs.existsSync(ENV)) process.loadEnvFile(ENV);
const testTarget = require("./test-target.js");
try {
  testTarget.useTestDatabases(process.env.SELFTEST_TARGET ? JSON.parse(process.env.SELFTEST_TARGET) : undefined);
} catch (e) {
  console.error(e.message);
  process.exit(2);
}
console.log("Self-test target: MySQL " + Object.values(testTarget.TEST.mysql).join(", ") + " · PostgreSQL " + testTarget.TEST.postgres + " (the real course databases are not touched)");
const db = require("../db.js");
const { checkExercise, runPrerequisites } = require("./check.js");
const { loadMysql, loadPostgres } = require("../load-course-datasets.js");

const getExercise = (track, code) => db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(`${track}:${code}`);
const reload = (track) => (track === "mysql" ? loadMysql() : loadPostgres());

async function dropTestDatabases() {
  const mysql = require("mysql2/promise");
  const { Client } = require("pg");
  try {
    const c = await mysql.createConnection({ host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || "root", password: process.env.MYSQL_ROOT_PASSWORD });
    for (const n of Object.values(testTarget.TEST.mysql)) await c.query(`DROP DATABASE IF EXISTS \`${n}\``);
    await c.end();
  } catch (e) { console.warn("could not drop the MySQL test databases: " + e.message); }
  try {
    const p = new Client({ host: process.env.POSTGRES_HOST || "127.0.0.1", port: Number(process.env.POSTGRES_PORT || 5432), user: process.env.POSTGRES_USER || "postgres", password: process.env.POSTGRES_PASSWORD, database: "postgres" });
    await p.connect();
    await p.query(`DROP DATABASE IF EXISTS "${testTarget.TEST.postgres}" WITH (FORCE)`);
    await p.end();
  } catch (e) { console.warn("could not drop the PostgreSQL test database: " + e.message); }
}

(async () => {
  if (!testTarget.isTest()) { console.error("Refusing to run: not pointed at the test databases."); process.exit(2); }
  const quiet = console.log;
  const tracks = ["mysql", "postgres"].includes(process.argv[2]) ? [process.argv[2]] : ["mysql", "postgres"];
  const tally = {};
  const problems = [];
  const slow = [];
  const t0 = Date.now();
  for (const track of tracks) {
    const all = db
      .prepare("SELECT * FROM course_exercises WHERE track = ? AND check_mode IN ('results','diff','error') ORDER BY day, kind, seq")
      .all(track);
    for (const pass of [1, 2]) {
      console.log = () => {};
      await reload(track);
      console.log = quiet;
      const list = all.filter((e) => (pass === 1 ? e.prereq_codes === "[]" : e.prereq_codes !== "[]"));
      for (const ex of list) {
        let r;
        const started = Date.now();
        try {
          if (pass === 2) {
            const p = await runPrerequisites(ex, getExercise);
            if (!p.ok) throw new Error("prerequisites: " + p.message);
          }
          r = await checkExercise(ex, ex.solution_sql);
        } catch (e) {
          r = { verdict: "crash", message: e.message };
        }
        slow.push({ ms: Date.now() - started, what: `${track} pass${pass} ${ex.code} [${ex.check_mode}] ${r.verdict}` });
        const k = `${track} pass${pass} ${ex.check_mode} ${r.verdict}`;
        tally[k] = (tally[k] || 0) + 1;
        if (r.verdict !== "correct") problems.push(`${track} ${ex.code} [${ex.check_mode}] ${r.verdict}: ${r.message.slice(0, 200)}`);
      }
      quiet(`${track} pass ${pass}: ${list.length} exercises done (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
  }
  // the test databases are thrown away; the real course databases were never touched
  await dropTestDatabases();
  console.log(JSON.stringify(tally, null, 1));
  console.log(`${problems.length} not correct`);
  slow.sort((a, b) => b.ms - a.ms);
  console.log("slowest:", slow.slice(0, 12).map((s) => `${(s.ms / 1000).toFixed(1)}s ${s.what}`).join("\n  "));
  fs.writeFileSync(path.join(__dirname, "selftest-problems.txt"), problems.join("\n"));
})();
