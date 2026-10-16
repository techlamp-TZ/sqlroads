// Imports every standard-layout exercise (core D..-C.. and practice D..-P.. files) of the
// 30-day course, both tracks, into data.sqlite (table course_exercises).
// Re-run after editing course files: node course/import-course.js
const fs = require("node:fs");
const path = require("node:path");
const db = require("../db.js");
const { parseExercise } = require("./parse.js");

const COURSE = path.join(__dirname, "..", "..", "learning SQL", "SQL PRACTICES");
const TRACKS = { mysql: "01 MySQL - 30 days", postgres: "02 PostgreSQL - 30 days" };

const { splitSql } = require("./split-sql.js");

const firstWord = (stmt) =>
  (stmt.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "").match(/^[A-Za-z]+/) || [""])[0].toUpperCase();

// Classified by what the solution actually runs (some "only READS data" headers are wrong):
//   results: only reads -> compare result sets
//   diff:    reads + row changes -> compare rows changed, in a rolled-back transaction
//   error:   must fail with the expected error code
//   manual:  DDL, transactions, GRANT, CALL, EXPLAIN (timings), ... can't be undone on MySQL or
//            vary run to run -> compare with the expected result by eye
//   concept: the "solution" is only notes -> nothing to run; read it and tick the exercise off
const READ = new Set(["SELECT", "WITH", "TABLE", "VALUES", "SHOW", "DESCRIBE", "DESC"]);
const ROW_CHANGE = new Set(["INSERT", "UPDATE", "DELETE", "REPLACE", "MERGE"]);

// MySQL privilege errors: these exercises need a second connection as the restricted user
// (MySQL can't switch user inside a session; guide 02 section 6), so the root check can't see them.
const MYSQL_PRIVILEGE_ERRORS = new Set(["1142", "1143", "1044", "1045", "1227", "1370"]);

function checkMode(e, track) {
  const words = splitSql(e.solutionSql).map(firstWord);
  if (!words.length) return "concept";
  if (e.mode === "fail" && track === "mysql" && MYSQL_PRIVILEGE_ERRORS.has(String(e.expectedError))) return "manual";
  if (e.mode === "fail") return e.expectedError ? "error" : "manual";
  if (words.includes("EXPLAIN")) return "manual";
  if (words.every((w) => READ.has(w))) return "results";
  if (words.every((w) => READ.has(w) || ROW_CHANGE.has(w))) return "diff";
  return "manual";
}

/** Exercise codes named in the header's "Prerequisites .." line (e.g. "run the solution of D18-P036"). */
function prerequisites(text) {
  const line = (/Prerequisites \.+ ([^\n]+(?:\n {18}[^\n]+)*)/.exec(text) || [])[1] || "";
  const clean = line.replace(/\s+/g, " ").trim();
  return { text: /^none\b/i.test(clean) ? "" : clean, codes: [...new Set(clean.match(/D\d+-[CP]\d+/g) || [])] };
}

// Rebuilt from the course files on every import, so its columns can simply change.
db.exec(`
  DROP TABLE IF EXISTS course_exercises;
  CREATE TABLE course_exercises (
    id TEXT PRIMARY KEY,            -- "mysql:D05-C03"
    track TEXT NOT NULL,            -- mysql | postgres (30-day course), ex-mysql | ex-postgres (SQL Exercises)
    day INTEGER NOT NULL,
    day_title TEXT NOT NULL,
    code TEXT NOT NULL,
    kind TEXT NOT NULL,             -- C (core) | P (practice)
    seq INTEGER NOT NULL,
    title TEXT NOT NULL,
    level TEXT, minutes INTEGER,
    mode TEXT NOT NULL,             -- read | change | fail | python | other
    mode_note TEXT,
    check_mode TEXT NOT NULL,       -- results | diff | error | manual
    context_sql TEXT, setup_sql TEXT,
    objective TEXT, idea TEXT, tables_text TEXT,
    example_intro TEXT, example_sql TEXT, example_output TEXT,
    question TEXT, starter TEXT,
    hint1 TEXT, hint2 TEXT, hint3 TEXT,
    solution_sql TEXT, why TEXT,
    expected_text TEXT, expected_error TEXT, ordered INTEGER,
    cleanup_sql TEXT, after_text TEXT,
    file TEXT NOT NULL,
    prereq_text TEXT,               -- the header's "Prerequisites .." text ("" = none)
    prereq_codes TEXT,              -- JSON array of exercise codes to run first
    order_spec TEXT,                -- JSON [[column, "asc"|"desc"], ...]: sort to check, ties in any order
    accept_sql TEXT                 -- JSON array of other solutions that also count as correct
  );
  CREATE INDEX IF NOT EXISTS idx_course_track_day ON course_exercises(track, day, kind, seq);
`);

function run() {
  db.exec("DELETE FROM course_exercises");
  const insert = db.prepare(`INSERT INTO course_exercises VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`);
  const counts = {};
  const skipped = [];
  for (const [track, dir] of Object.entries(TRACKS)) {
    const trackDir = path.join(COURSE, dir);
    for (const dayDir of fs.readdirSync(trackDir).filter((d) => /^Day \d+/.test(d))) {
      const day = Number(/^Day (\d+)/.exec(dayDir)[1]);
      const dayTitle = dayDir.replace(/^Day \d+ - /, "");
      for (const f of fs.readdirSync(path.join(trackDir, dayDir))) {
        const m = /^D\d+-([CP])(\d+)\b.*\.sql$/.exec(f);
        if (!m) continue;
        const rel = path.join(dir, dayDir, f);
        const raw = fs.readFileSync(path.join(trackDir, dayDir, f), "utf8");
        const e = parseExercise(raw);
        const pre = prerequisites(raw);
        if (!e.standard || !e.code || !e.solutionSql) {
          skipped.push(`${track} ${f}`);
          continue;
        }
        const check = checkMode(e, track);
        insert.run(
          `${track}:${e.code}`, track, day, dayTitle, e.code, m[1], Number(m[2]), e.title, e.level, e.minutes,
          e.mode, e.modeNote, check, e.context, e.setupSql, e.objective, e.idea, e.tablesText,
          e.exampleIntro, e.exampleSql, e.exampleOutput, e.question, e.starter,
          e.hints[0], e.hints[1], e.hints[2], e.solutionSql, e.why,
          e.expectedText, e.expectedError, e.ordered, e.cleanupSql, e.afterText, rel,
          pre.text, JSON.stringify(pre.codes)
        );
        const k = `${track} ${check}`;
        counts[k] = (counts[k] || 0) + 1;
      }
    }
  }
  return { counts, skipped };
}

if (require.main === module) {
  const { counts, skipped } = run();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  console.log(`Imported ${total} exercises:`, counts);
  console.log(`Skipped ${skipped.length} files without the standard layout (e.g. ${skipped.slice(0, 3).join("; ")})`);
  // The table was rebuilt: put the SQL Exercises tracks back too.
  require("../exercises/import-exercises.js")
    .run()
    .catch((e) => {
      console.error("SQL Exercises import failed:", e.message);
      process.exitCode = 1;
    });
}

module.exports = { run };
