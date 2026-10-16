// Self-test for the SQL Exercises tracks: every answer, every alternative answer and every
// accepted answer must be marked correct by the checker, and a wrong answer must not.
// Usage: node exercises/selftest.js [--track ex-mysql|ex-postgres]
const fs = require("node:fs");
const path = require("node:path");
const ENV = path.join(__dirname, "..", ".env");
if (fs.existsSync(ENV)) process.loadEnvFile(ENV);
const db = require("../db.js");
const { checkExercise } = require("../course/check.js");
const KEY = require("./answer-key.js");

const i = process.argv.indexOf("--track");
const tracks = i > -1 ? [process.argv[i + 1]] : ["ex-mysql", "ex-postgres"];

(async () => {
  const failures = [];
  let checks = 0;
  for (const track of tracks) {
    const engine = track === "ex-mysql" ? "mysql" : "postgres";
    const list = db.prepare("SELECT * FROM course_exercises WHERE track = ? ORDER BY day, seq").all(track);
    for (const ex of list) {
      if (ex.check_mode === "manual") continue;
      const k = KEY.find((x) => x.code === ex.code);
      const candidates = [["answer", ex.solution_sql], ...(k.alts || []).map((a, n) => [`alt ${n + 1}`, a]), ...(k.accept || []).map((a, n) => [`accept ${n + 1}`, a])];
      if (engine === "postgres" && k.pg) candidates.splice(1, (k.alts || []).length); // alternatives are written for MySQL
      for (const [label, sql] of candidates) {
        checks++;
        const r = await checkExercise(ex, sql);
        if (r.verdict !== "correct") failures.push(`${track} ${ex.code} ${label}: ${r.verdict}: ${r.message}`);
      }
      checks++;
      const wrong = ex.check_mode === "diff" ? "UPDATE Products SET Price = Price WHERE 1 = 0" : "SELECT 1 AS x WHERE 1 = 0";
      const r = await checkExercise(ex, wrong);
      if (r.verdict === "correct") failures.push(`${track} ${ex.code} wrong answer accepted: ${r.message}`);
    }
  }
  console.log(`${checks} checks, ${failures.length} failed`);
  for (const f of failures) console.log(" -", f.slice(0, 400));
  process.exit(failures.length ? 1 : 0);
})();
