// Imports the SQL Exercises (answer-key.js) into data.sqlite's course_exercises table as two
// tracks, ex-mysql and ex-postgres, one "day" per set. Each answer is run once on the loaded
// databases (inside a rolled-back transaction) to record the expected result shown to learners.
// Re-run after editing answer-key.js: node exercises/import-exercises.js
// (needs the databases: node exercises/load-exercises.js)
const fs = require("node:fs");
const path = require("node:path");
const db = require("../db.js");
const { splitSql } = require("../course/split-sql.js");
const { SETS, buildSet } = require("./load-exercises.js");
const KEY = require("./answer-key.js");

const ENV = path.join(__dirname, "..", ".env");
// Also when course/import-course.js runs this after rebuilding the table.
if (!process.env.MYSQL_ROOT_PASSWORD && fs.existsSync(ENV)) process.loadEnvFile(ENV);

const TRACKS = { "ex-mysql": "mysql", "ex-postgres": "postgres" };
const LEVEL = { 1: "Beginner", 2: "Beginner", 3: "Beginner", 4: "Beginner", 5: "Intermediate", 6: "Intermediate", 7: "Intermediate", 8: "Advanced", 9: "Intermediate", 10: "Intermediate" };

const firstWord = (stmt) => (stmt.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "").match(/^[A-Za-z]+/) || [""])[0].toUpperCase();
const READS = new Set(["SELECT", "WITH"]);

// ---------- hints, generated from the answer ----------
const CONCEPTS = [
  [/\bINSERT\b/, "INSERT INTO table (columns) VALUES (...) adds a row."],
  [/\bUPDATE\b/, "UPDATE table SET column = new value WHERE ... changes rows (all rows without WHERE)."],
  [/\bDELETE\b/, "DELETE FROM table WHERE ... removes rows (all rows without WHERE)."],
  [/\bCREATE\s+INDEX\b/, "CREATE INDEX name ON table (column) adds an index."],
  [/\bDROP\s+INDEX\b/, "DROP INDEX removes an index."],
  [/\bSHOW\s+INDEX\b|\bPG_INDEXES\b/, "Each database lists indexes its own way (SHOW INDEX in MySQL, the pg_indexes view in PostgreSQL)."],
  [/\bDISTINCT\b/, "DISTINCT removes duplicate rows (or counts each value once inside COUNT)."],
  [/\bLEFT\s+JOIN\b|\bRIGHT\s+JOIN\b/, "An outer join (LEFT/RIGHT JOIN) keeps rows that have no match, filling the other side with NULL."],
  [/\bJOIN\b|\bFROM\s+\w+\s+\w*\s*,\s*\w+/, "Combine tables: JOIN ... ON the columns that link them (a foreign key to a primary key)."],
  [/\bWHERE\b/, "WHERE keeps only the rows that match a condition."],
  [/\bBETWEEN\b/, "BETWEEN low AND high includes both ends."],
  [/\bLIKE\b/, "LIKE matches text patterns: % stands for any characters."],
  [/\bIS\s+(NOT\s+)?NULL\b/, "Missing values are NULL: test them with IS NULL / IS NOT NULL, never = NULL."],
  [/\bNOT\s+IN\b/, "NOT IN (subquery) is false for every row if the subquery returns a NULL: filter NULLs out."],
  [/\bIN\s*\(/, "IN (...) tests membership in a list or a subquery's results."],
  [/\bEXISTS\b/, "EXISTS (subquery) is true when the subquery returns at least one row."],
  [/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/, "Aggregate functions (COUNT, SUM, AVG, MIN, MAX) turn many rows into one value."],
  [/\bGROUP\s+BY\b/, "GROUP BY makes one result row per group; every selected column must be grouped or aggregated."],
  [/\bHAVING\b/, "HAVING filters groups after aggregation (WHERE filters rows before)."],
  [/\(\s*SELECT\b/, "A subquery (a SELECT inside brackets) can supply a value, a list or a table."],
  [/\bORDER\s+BY\b/, "ORDER BY sorts the result: ASC (default) or DESC, and by several columns in turn."],
  [/\bLIMIT\b/, "LIMIT n keeps the first n rows (OFFSET skips some first)."],
  [/\bOVER\s*\(/, "Window functions (ROW_NUMBER() OVER (PARTITION BY ... ORDER BY ...)) number rows within groups."],
  [/\bSUBSTR\b|\bLENGTH\b|\bROUND\b/, "Functions such as SUBSTR, LENGTH and ROUND work on each value."],
];
const CONCEPT_NAMES = [
  [/\bINSERT\b/, "INSERT"], [/\bUPDATE\b/, "UPDATE"], [/\bDELETE\b/, "DELETE"], [/\bINDEX\b/, "indexes"],
  [/\bLEFT\s+JOIN\b|\bRIGHT\s+JOIN\b/, "outer joins"], [/\bJOIN\b/, "joins"], [/\(\s*SELECT\b/, "subqueries"],
  [/\bGROUP\s+BY\b/, "GROUP BY"], [/\bHAVING\b/, "HAVING"], [/\b(COUNT|SUM|AVG|MIN|MAX)\s*\(/, "aggregates"],
  [/\bIS\s+(NOT\s+)?NULL\b/, "NULL"], [/\bORDER\s+BY\b/, "ORDER BY"], [/\bDISTINCT\b/, "DISTINCT"], [/\bWHERE\b/, "WHERE"],
];

const KEYWORDS = new Set(
  ("SELECT DISTINCT FROM JOIN INNER LEFT RIGHT OUTER ON WHERE AND OR NOT IN EXISTS IS NULL BETWEEN LIKE GROUP BY HAVING ORDER " +
    "ASC DESC LIMIT OFFSET AS INSERT INTO VALUES UPDATE SET DELETE COUNT SUM AVG MIN MAX LENGTH SUBSTR ROUND CREATE INDEX DROP " +
    "SHOW ROW_NUMBER OVER PARTITION TRUE FALSE").split(" ")
);

/** The answer with only keywords and table names left: "SELECT … FROM Products WHERE … ORDER BY … DESC". */
function skeleton(sql, tableNames) {
  const tokens = sql.replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, " ").match(/'(?:[^']|'')*'|"[^"]*"|`[^`]*`|\w+|<=|>=|<>|!=|[(),*=<>+\-/.;]/g) || [];
  const out = tokens.map((t, i) => {
    const u = t.toUpperCase();
    if (tokens[i - 1] === ".") return "…"; // alias.column
    if (KEYWORDS.has(u)) return u;
    if (tableNames.has(t)) return t; // case-sensitive: in set 10 the column address is not the table ADDRESS
    if (/^[(),;*]$/.test(t)) return t;
    return "…";
  });
  const FUNCTIONS = /^(COUNT|SUM|AVG|MIN|MAX|LENGTH|SUBSTR|ROUND|ROW_NUMBER)$/;
  let text = "";
  out.forEach((t, i) => {
    const glue = /^[),;]$/.test(t) || text.endsWith("(") || (t === "(" && FUNCTIONS.test(out[i - 1] || ""));
    text += glue ? t : (text ? " " : "") + t;
  });
  let prev;
  do {
    prev = text;
    text = text
      .replace(/…(\s*(?:[*,]|…)\s*…)+/g, "…")
      .replace(/… \. …/g, "…")
      .replace(/\(\s*…\s*\)/g, "(…)")
      .replace(/… …/g, "…");
  } while (text !== prev);
  return text.replace(/\s*;\s*/g, ";\n").trim();
}

function hintsFor(sql, set, tables) {
  const upper = sql.replace(/'(?:[^']|'')*'/g, "''").toUpperCase();
  const names = new Set(tables.map((t) => t.name));
  const used = tables.filter((t) => new RegExp(`\\b${t.name}\\b`, "i").test(sql));
  const hint1 =
    `Tables to use: ${used.map((t) => t.name).join(", ") || "see the list of tables"}.\n` +
    used.map((t) => `  ${t.name}(${t.columns.map((c) => c.name).join(", ")})`).join("\n");
  const concepts = CONCEPTS.filter(([re]) => re.test(upper)).map(([, text]) => `- ${text}`);
  const hint2 = concepts.length ? `What you'll need:\n${concepts.join("\n")}` : "";
  const hint3 = `The shape of one answer (… = fill in):\n${skeleton(sql, names)}`;
  return [hint1, hint2, hint3].filter(Boolean);
}

const listing = (items) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}` : items[0] || "");

const conceptNames = (sql) => {
  const upper = sql.replace(/'(?:[^']|'')*'/g, "''").toUpperCase();
  const seen = [];
  for (const [re, name] of CONCEPT_NAMES) if (re.test(upper) && !seen.includes(name) && !(name === "joins" && seen.includes("outer joins"))) seen.push(name);
  return seen;
};

// ---------- expected results (run once, rolled back) ----------
function asText(columns, rows, total) {
  const cells = [columns, ...rows.map((r) => r.map((v) => (v === null || v === undefined ? "NULL" : String(v))))];
  const widths = columns.map((_, i) => Math.min(28, Math.max(...cells.map((r) => String(r[i]).length))));
  const line = (r) => r.map((v, i) => String(v).slice(0, 28).padEnd(widths[i])).join(" | ").trimEnd();
  const shown = [line(cells[0]), widths.map((w) => "-".repeat(w)).join("-+-"), ...cells.slice(1).map(line)];
  return `${shown.join("\n")}\n(${total} row${total === 1 ? "" : "s"}${total > rows.length ? `, first ${rows.length} shown` : ""})`;
}

async function connect(engine) {
  if (engine === "mysql") {
    const c = await require("mysql2/promise").createConnection({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_ROOT_PASSWORD,
      dateStrings: true,
      charset: "utf8mb4_0900_ai_ci",
    });
    return {
      async run(sql) {
        const [rows, fields] = await c.query({ sql, rowsAsArray: true });
        return Array.isArray(fields) && Array.isArray(rows) ? { columns: fields.map((f) => f.name), rows } : { affected: rows.affectedRows };
      },
      close: () => c.end(),
    };
  }
  const pg = require("pg");
  const c = new pg.Client({
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD,
    database: "sql_exercises",
    types: { getTypeParser: (oid, fmt) => ([1082, 1083, 1114, 1184].includes(oid) ? (v) => v : pg.types.getTypeParser(oid, fmt)) },
  });
  await c.connect();
  return {
    async run(sql) {
      const r = await c.query({ text: sql, rowMode: "array" });
      return r.fields && r.fields.length ? { columns: r.fields.map((f) => f.name), rows: r.rows } : { affected: r.rowCount };
    },
    close: () => c.end(),
  };
}

/** What the answer returns or changes, as text. */
async function expectedText(conn, context, sql, mode) {
  await conn.run(context);
  await conn.run(mode === "manual" ? "SELECT 1" : "BEGIN");
  try {
    let last = null;
    const changes = [];
    for (const stmt of splitSql(sql)) {
      const r = await conn.run(stmt);
      if (r.columns) last = r;
      else if (r.affected !== undefined) changes.push(r.affected);
    }
    if (mode === "diff") {
      const n = changes.reduce((a, b) => a + b, 0);
      return `${changes.length > 1 ? `${changes.length} statements, ` : ""}${n} row${n === 1 ? "" : "s"} affected. Check answer compares exactly which rows change (and rolls everything back).`;
    }
    return last ? asText(last.columns, last.rows.slice(0, 12), last.rows.length) : "";
  } finally {
    await conn.run("ROLLBACK").catch(() => {});
  }
}

// ---------- import ----------
async function run(log = console.log) {
  for (const col of ["order_spec", "accept_sql"]) {
    const cols = db.prepare("PRAGMA table_info(course_exercises)").all().map((c) => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE course_exercises ADD COLUMN ${col} TEXT`);
  }
  const insert = db.prepare(`INSERT INTO course_exercises (
      id, track, day, day_title, code, kind, seq, title, level, minutes, mode, mode_note, check_mode,
      context_sql, setup_sql, objective, idea, tables_text, example_intro, example_sql, example_output,
      question, starter, hint1, hint2, hint3, solution_sql, why, expected_text, expected_error, ordered,
      cleanup_sql, after_text, file, prereq_text, prereq_codes, order_spec, accept_sql)
    VALUES (?, ?, ?, ?, ?, 'P', ?, ?, ?, 5, ?, '', ?, ?, '', ?, '', ?, '', '', '', ?, '', ?, ?, ?, ?, ?, ?, NULL, ?, '', '', ?, '', '[]', ?, ?)`);

  const rows = [];
  for (const [track, engine] of Object.entries(TRACKS)) {
    const conn = await connect(engine);
    try {
      for (const set of SETS) {
        const { tables } = buildSet(set, engine);
        const context = engine === "mysql" ? `USE ${set.schema};` : `SET search_path TO ${set.schema};`;
        const tablesText = tables.map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type}`).join(", ")})`).join("\n");
        const questions = KEY.filter((k) => Number(k.code.split(".")[0]) === set.n);
        questions.forEach((k, i) => (k._seq = i + 1));
        for (const k of questions) {
          const sql = (engine === "postgres" && k.pg) || k.sql;
          const words = splitSql(sql).map(firstWord);
          const mode = k.mode || (words.every((w) => READS.has(w)) ? "results" : "diff");
          const [hint1, hint2, hint3] = hintsFor(sql, set, tables);
          const alts = (k.alts || []).map((a) => a.trim());
          const why = [k.note || "", alts.length ? `Other correct answers:\n\n${alts.join("\n\n")}` : ""].filter(Boolean).join("\n\n");
          let expected = k.expected || "";
          if (mode !== "manual") {
            try {
              expected = await expectedText(conn, context.replace(/;$/, ""), sql, mode);
            } catch (e) {
              throw new Error(`${track} ${k.code}: the answer fails: ${e.message}`);
            }
          }
          const concepts = conceptNames(sql);
          const title = k.q.split("\n")[0].replace(/\s*\([^)]*\)\s*\.?$/, "").replace(/\.$/, "");
          rows.push([
            `${track}:${k.code}`, track, set.n, set.title, k.code, k._seq, title.length > 110 ? title.slice(0, 107) + "…" : title,
            LEVEL[set.n], mode === "results" ? "read" : mode === "diff" ? "change" : "other", mode, context,
            `Practise ${listing(concepts) || "SQL"}. Database: ${set.title} (set ${set.n} of the Wikibooks SQL Exercises).`,
            tablesText, k.q, hint1 || null, hint2 || null, hint3 || null, sql, why, expected, k.order ? 1 : null,
            path.join("SQL-exercise-master", `SQL_exercise_${String(set.n).padStart(2, "0")}`),
            k.order ? JSON.stringify(k.order) : null, k.accept ? JSON.stringify(k.accept.map((a) => (engine === "postgres" && k.pgAccept) || a)) : null,
          ]);
        }
      }
    } finally {
      await conn.close();
    }
  }
  db.exec("BEGIN");
  try {
    db.prepare("DELETE FROM course_exercises WHERE track LIKE 'ex-%'").run();
    for (const r of rows) insert.run(...r);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  const counts = {};
  for (const r of rows) counts[`${r[1]} ${r[9]}`] = (counts[`${r[1]} ${r[9]}`] || 0) + 1;
  log(`Imported ${rows.length} SQL Exercises questions:`, counts);
  return counts;
}

module.exports = { run, skeleton };

if (require.main === module) {
  run().catch((e) => {
    console.error("FAILED:", e.message);
    process.exit(1);
  });
}
