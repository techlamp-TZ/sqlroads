// Checks a learner's SQL for a course exercise against the course's own solution, on the
// local MySQL / PostgreSQL servers, in fresh connections. Nothing a check runs is kept:
// reads and row changes run inside a transaction that is always rolled back.
//   results: run both, compare the final result sets (in order when order matters)
//   diff:    run each in a rolled-back transaction, compare the rows each one added/removed
//   error:   the learner's SQL must be rejected with the course's expected error code
const mysql = require("mysql2/promise");
const pg = require("pg");
const { splitSql } = require("./split-sql.js");

const MAX_ROWS = 10000;
const TIMEOUT_MS = 30000;
// Statement took too long: MySQL 3024 (MAX_EXECUTION_TIME, SELECT only) / 1317 (killed by our
// timer, for INSERT/UPDATE/DELETE); PostgreSQL 57014 (statement_timeout).
const TIMEOUT_ERRORS = new Set(["3024", "1317", "57014"]);
const TOO_SLOW = `stopped after ${TIMEOUT_MS / 1000} seconds`;
const LOCK_WAIT_S = 6;
// Lock waits: MySQL 1205 (row lock) / 3572 / 1213 (deadlock), MySQL metadata-lock timeout is
// also 1205; PostgreSQL 55P03 (lock_not_available) / 40P01 (deadlock).
const LOCK_ERRORS = new Set(["1205", "1213", "3572", "55P03", "40P01"]);
const LOCKED_HINT =
  "The database is waiting on a lock held by another session, most likely an open transaction in your editor (BEGIN / START TRANSACTION without COMMIT or ROLLBACK). Run COMMIT or ROLLBACK in the editor and check again.";

// ---------- connections ----------
// Tracks: the 30-day course (mysql / postgres) and the SQL Exercises (ex-mysql / ex-postgres).
const isMysqlTrack = (track) => track === "mysql" || track === "ex-mysql";
const testTarget = require("./test-target.js");
const PG_DATABASE = { postgres: "sql_course", "ex-postgres": "sql_exercises" };

/** The schema unqualified names resolve to for an exercise: its USE / SET search_path line, else practice. */
function exerciseSchema(ex) {
  const m = /\bUSE\s+`?(\w+)|\bsearch_path\s+TO\s+"?(\w+)/i.exec(ex.context_sql || "");
  return m ? m[1] || m[2] : "practice";
}

async function connect(track) {
  if (isMysqlTrack(track)) {
    const c = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_ROOT_PASSWORD,
      dateStrings: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      // MySQL 8's default collation, which the course tables use; the driver's default
      // (utf8mb4_unicode_ci) causes "Illegal mix of collations" in UNIONs with literals.
      charset: "utf8mb4_0900_ai_ci",
    });
    // Short lock waits: an open transaction in the editor's session must not freeze a check for
    // MySQL's default 50 s (per statement) - fail fast and say why instead.
    await c.query(`SET SESSION MAX_EXECUTION_TIME = ${TIMEOUT_MS}, innodb_lock_wait_timeout = ${LOCK_WAIT_S}, lock_wait_timeout = ${LOCK_WAIT_S}`);
    // MAX_EXECUTION_TIME only limits SELECT; stop slow INSERT/UPDATE/DELETE from a second connection.
    const killAfterTimeout = () =>
      setTimeout(async () => {
        try {
          const k = await mysql.createConnection({
            host: process.env.MYSQL_HOST || "127.0.0.1",
            port: Number(process.env.MYSQL_PORT || 3306),
            user: process.env.MYSQL_USER || "root",
            password: process.env.MYSQL_ROOT_PASSWORD,
          });
          await k.query(`KILL QUERY ${c.threadId}`);
          await k.end();
        } catch {
          // the statement finished meanwhile, or the server is gone
        }
      }, TIMEOUT_MS + 1000);
    return {
      track,
      async run(sql) {
        const timer = killAfterTimeout();
        try {
          // the self-test: course database names point at the test databases
          if (track === "mysql") sql = testTarget.mapMysql(sql);
          const [rows, fields] = await c.query({ sql, rowsAsArray: true });
          if (Array.isArray(rows) && Array.isArray(fields) && !Array.isArray(rows[0] && rows[0][0])) {
            return { columns: fields.map((f) => f.name), rows: rows.slice(0, MAX_ROWS + 1) };
          }
          return { columns: null, affected: rows && rows.affectedRows };
        } finally {
          clearTimeout(timer);
        }
      },
      errorCode: (e) => (e.errno ? String(e.errno) : e.code),
      begin: () => c.query("START TRANSACTION"),
      rollback: () => c.query("ROLLBACK").catch(() => {}),
      close: () => c.end().catch(() => {}),
    };
  }
  const c = new pg.Client({
    host: process.env.POSTGRES_HOST || "127.0.0.1",
    port: Number(process.env.POSTGRES_PORT || 5432),
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD,
    database: testTarget.pgDatabase(PG_DATABASE[track] || "sql_course"),
    types: {
      getTypeParser: (oid, fmt) => ([1082, 1114, 1184].includes(oid) ? (v) => v : pg.types.getTypeParser(oid, fmt)),
    },
  });
  await c.connect();
  await c.query(`SET statement_timeout = ${TIMEOUT_MS}; SET lock_timeout = '${LOCK_WAIT_S}s'`);
  return {
    track,
    async run(sql) {
      const r = await c.query({ text: sql, rowMode: "array" });
      const last = Array.isArray(r) ? r[r.length - 1] : r;
      if (last.fields && last.fields.length) return { columns: last.fields.map((f) => f.name), rows: last.rows.slice(0, MAX_ROWS + 1) };
      return { columns: null, affected: last.rowCount };
    },
    errorCode: (e) => e.code,
    begin: () => c.query("BEGIN"),
    rollback: () => c.query("ROLLBACK").catch(() => {}),
    close: () => c.end().catch(() => {}),
  };
}

// ---------- values ----------
const NUMERIC = /^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i;

function canon(v) {
  if (v === null || v === undefined) return "NULL";
  if (Buffer.isBuffer(v)) return "0x" + v.toString("hex");
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  if (NUMERIC.test(s.trim())) {
    const n = Number(s);
    if (Number.isFinite(n)) return String(Number(n.toFixed(6)));
  }
  return s.replace(/\s+$/, "");
}
const rowKey = (row) => JSON.stringify(row.map(canon));
const display = (row) => row.map((v) => (v === null || v === undefined ? "NULL" : String(v))).join(" | ");

function multiset(keys) {
  const m = new Map();
  for (const k of keys) m.set(k, (m.get(k) || 0) + 1);
  return m;
}
/** Items of a not (or less often) in b. */
function minus(a, b) {
  const out = [];
  for (const [k, n] of a) {
    const extra = n - (b.get(k) || 0);
    for (let i = 0; i < extra; i++) out.push(k);
  }
  return out;
}

const firstWord = (stmt) =>
  (stmt.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "").match(/^[A-Za-z]+/) || [""])[0].toUpperCase();
const READ_WORDS = new Set(["SELECT", "WITH", "TABLE", "VALUES", "SHOW", "DESCRIBE", "DESC", "EXPLAIN", "USE", "SET"]);
const ROW_WORDS = new Set(["INSERT", "UPDATE", "DELETE", "REPLACE", "MERGE"]);

/** True when the outermost query ends with ORDER BY (ignoring ORDER BY inside brackets). */
function hasOuterOrderBy(sql) {
  let s = sql.replace(/'(?:[^']|'')*'/g, "''");
  let prev;
  do {
    prev = s;
    s = s.replace(/\([^()]*\)/g, "");
  } while (s !== prev);
  return /\bORDER\s+BY\b/i.test(s);
}

/** Runs statements in order; returns the last result set (or an error with the failing statement). */
async function runAll(conn, statements) {
  let last = null;
  for (let i = 0; i < statements.length; i++) {
    try {
      const r = await conn.run(statements[i]);
      if (r.columns) last = r;
    } catch (e) {
      return { error: { code: conn.errorCode(e), message: e.message, statement: i + 1, sql: statements[i] } };
    }
  }
  return { result: last };
}

// "doesn't exist" errors: table/view, function/procedure, schema, other object.
const MISSING_OBJECT = new Set(["1146", "1305", "1049", "1356", "42P01", "42883", "3F000", "42704"]);

/** Verdict when the course's own solution can't run: usually earlier exercises haven't been done yet. */
function solutionFailed(ex, error) {
  if (LOCK_ERRORS.has(String(error.code))) return { verdict: "unavailable", message: LOCKED_HINT };
  if (TIMEOUT_ERRORS.has(String(error.code))) {
    return { verdict: "manual", message: `The course's own solution is too slow to check automatically (${TOO_SLOW}). Run yours and compare with the expected result below.` };
  }
  if (MISSING_OBJECT.has(String(error.code)) && ex.prereq_text) {
    return {
      verdict: "needs-prereq",
      message: `This exercise builds on earlier ones (${error.message}). Prerequisites: ${ex.prereq_text} Use "Run prerequisites" and check again.`,
    };
  }
  return {
    verdict: "unavailable",
    message: `The course solution can't run on your database right now (${error.message}). If you changed data in an earlier exercise, use "Undo exercise changes" there, or Reset database, and check again.`,
  };
}

/** Verdict when the learner's own SQL fails. */
function userFailed(error, statements) {
  const code = String(error.code);
  if (LOCK_ERRORS.has(code)) return { verdict: "unavailable", message: LOCKED_HINT };
  if (TIMEOUT_ERRORS.has(code)) {
    return { verdict: "error", message: `Your SQL was ${TOO_SLOW}. Look for a missing join condition or an unfiltered self-join.` };
  }
  const where = statements.length > 1 ? ` at statement ${error.statement}` : "";
  return { verdict: "error", message: `Your SQL failed${where}: ${error.message}` };
}

// ---------- check modes ----------
/** Value multiset of each column, to recognise the same columns in a different order. */
const columnSignature = (rows, i) => rows.map((r) => canon(r[i])).sort().join("\u0001");

/** got's column positions in exp's order (perm[i] = got column for exp column i), or null. */
function matchColumns(exp, got) {
  const expSig = exp.columns.map((_, i) => columnSignature(exp.rows, i));
  const gotSig = got.columns.map((_, i) => columnSignature(got.rows, i));
  const used = new Set();
  const perm = [];
  for (let i = 0; i < expSig.length; i++) {
    const j = gotSig[i] === expSig[i] && !used.has(i) ? i : gotSig.findIndex((g, k) => !used.has(k) && g === expSig[i]);
    if (j < 0) return null;
    used.add(j);
    perm.push(j);
  }
  return perm;
}

function compareValues(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return 0; // NULLs sort first or last depending on the database
  const x = canon(a);
  const y = canon(b);
  if (NUMERIC.test(x) && NUMERIC.test(y)) return Number(x) - Number(y);
  return x.localeCompare(y, undefined, { sensitivity: "base" });
}

/** First row (index) that breaks the sort spec [[column number, "asc" | "desc"], ...], or -1. */
function unsortedAt(rows, spec) {
  for (let r = 1; r < rows.length; r++) {
    for (const [col, dir] of spec) {
      const c = compareValues(rows[r - 1][col - 1], rows[r][col - 1]) * (dir === "desc" ? -1 : 1);
      if (c < 0) break;
      if (c > 0) return r;
    }
  }
  return -1;
}

/** Compares result sets: same columns (in any order), same rows, and the required order. */
function compareResults(ex, exp, got) {
  const details = {
    expected: { columns: exp.columns, rows: exp.rows.slice(0, 8), count: exp.rows.length },
    got: { columns: got.columns, rows: got.rows.slice(0, 8), count: got.rows.length },
  };
  if (got.columns.length !== exp.columns.length) {
    return { verdict: "incorrect", details, message: `Your result has ${got.columns.length} column${got.columns.length === 1 ? "" : "s"} (${got.columns.join(", ")}); the course expects ${exp.columns.length} (${exp.columns.join(", ")}).` };
  }
  if (got.rows.length !== exp.rows.length) {
    // say which side is short: expected rows you don't have, rows of yours the course doesn't have
    const lost = minus(multiset(exp.rows.map(rowKey)), multiset(got.rows.map(rowKey))).length;
    const extra = got.rows.length > MAX_ROWS ? 0 : minus(multiset(got.rows.map(rowKey)), multiset(exp.rows.map(rowKey))).length;
    const parts = [];
    if (lost) parts.push(`${lost} expected row${lost === 1 ? " is" : "s are"} missing`);
    if (extra) parts.push(`${extra} row${extra === 1 ? "" : "s"} of yours ${extra === 1 ? "isn't" : "aren't"} in the expected result`);
    return { verdict: "incorrect", details, message: `Your query returns ${got.rows.length > MAX_ROWS ? `over ${MAX_ROWS}` : got.rows.length} row${got.rows.length === 1 ? "" : "s"}; the course expects ${exp.rows.length}` + (parts.length ? `: ${parts.join(" and ")}.` : ".") };
  }

  // order_spec: sort columns, so rows that tie may come in any order. Otherwise the exact order
  // when the solution sorts (ORDER BY) or the exercise says so.
  const spec = ex.order_spec ? JSON.parse(ex.order_spec) : null;
  const ordered = !spec && (ex.ordered === 1 || (ex.ordered !== 0 && hasOuterOrderBy(splitSql(ex.solution_sql).pop() || "")));
  const expKeys = exp.rows.map(rowKey);
  let gotRows = got.rows;
  let gotKeys = gotRows.map(rowKey);
  let reordered = false;

  if (minus(multiset(expKeys), multiset(gotKeys)).length) {
    // The same columns in another order (e.g. AVG(Price), Manufacturer) are fine.
    const perm = matchColumns(exp, got);
    if (perm && perm.some((j, i) => j !== i)) {
      const remapped = got.rows.map((row) => perm.map((j) => row[j]));
      const keys = remapped.map(rowKey);
      if (!minus(multiset(expKeys), multiset(keys)).length) {
        gotRows = remapped;
        gotKeys = keys;
        reordered = true;
      }
    }
  }

  if (minus(multiset(expKeys), multiset(gotKeys)).length) {
    const missing = minus(multiset(expKeys), multiset(gotKeys));
    const extra = minus(multiset(gotKeys), multiset(expKeys));
    const show = (k) => display(JSON.parse(k));
    return {
      verdict: "incorrect",
      details,
      message:
        `Same number of rows (${exp.rows.length}) but different values: ${missing.length} expected row${missing.length === 1 ? " is" : "s are"} missing` +
        (missing.length ? ` (e.g. ${show(missing[0])})` : "") +
        (extra.length ? ` and you have ${extra.length} the course doesn't (e.g. ${show(extra[0])}).` : "."),
    };
  }
  if (spec) {
    const r = unsortedAt(gotRows, spec);
    if (r !== -1) {
      const by = spec.map(([c, d]) => `${exp.columns[c - 1]} ${d === "desc" ? "descending" : "ascending"}`).join(", then ");
      return { verdict: "incorrect", details, message: `Right rows, wrong order: rows should be sorted by ${by}, but row ${r + 1} ("${display(gotRows[r])}") comes after "${display(gotRows[r - 1])}". Check your ORDER BY.` };
    }
  } else if (ordered) {
    const i = expKeys.findIndex((k, idx) => k !== gotKeys[idx]);
    if (i !== -1) {
      return { verdict: "incorrect", details, message: `Right rows, wrong order: row ${i + 1} should be "${display(exp.rows[i])}" but yours is "${display(gotRows[i])}". Check your ORDER BY.` };
    }
  }
  const isOrdered = !!spec || ordered;
  const namesDiffer = !reordered && got.columns.some((c, i) => c.toLowerCase() !== exp.columns[i].toLowerCase());
  return {
    verdict: "correct",
    details,
    message:
      (exp.rows.length === 1
        ? "Correct: the row matches."
        : `Correct: all ${exp.rows.length} rows match${isOrdered ? ", in the right order" : ""}.`) +
      (reordered ? " (Your columns are in a different order than the course's: fine unless the task asks for an order.)" : "") +
      (namesDiffer ? ` (Your column names ${got.columns.join(", ")} differ from the course's ${exp.columns.join(", ")}: fine unless the task asks for those names.)` : ""),
  };
}

async function checkResults(conn, ex, userStatements) {
  const sol = await runAll(conn, splitSql(ex.solution_sql));
  if (sol.error) return solutionFailed(ex, sol.error);
  if (!sol.result) return { verdict: "manual", message: "This exercise has no result table to compare automatically. Compare with the expected result below." };

  const mine = await runAll(conn, userStatements);
  if (mine.error) return userFailed(mine.error, userStatements);
  if (!mine.result) return { verdict: "incorrect", message: "Your SQL ran but returned no result table. This exercise expects a SELECT that returns rows." };

  const verdict = compareResults(ex, sol.result, mine.result);
  if (verdict.verdict === "correct") return verdict;
  // Questions with more than one right result ("optionally, include ...") list the others.
  for (const other of ex.accept_sql ? JSON.parse(ex.accept_sql) : []) {
    const alt = await runAll(conn, splitSql(other));
    if (alt.error || !alt.result) continue;
    const v = compareResults(ex, alt.result, mine.result);
    if (v.verdict === "correct") return { ...v, message: `${v.message} (One of the accepted answers: the solution shows the other.)` };
  }
  return verdict;
}

/** Tables a set of statements writes to (INSERT INTO / UPDATE / DELETE FROM / REPLACE / MERGE). */
function targetTables(statements) {
  const out = new Set();
  for (const s of statements) {
    // "DELETE p FROM payments p JOIN ..." is MySQL's multi-table delete: the table follows FROM.
    const m = /^\s*(?:INSERT\s+(?:IGNORE\s+)?INTO|REPLACE\s+INTO|MERGE\s+INTO|UPDATE|DELETE\s+(?:\w+\s+)?FROM)\s+([`"\w.]+)/i.exec(
      s.replace(/^(\s|--[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "")
    );
    if (m) out.add(m[1].replace(/[`"]/g, "").toLowerCase());
  }
  return [...out];
}

/** Columns whose values differ run to run (auto ids, CURRENT_TIMESTAMP defaults): left out of row comparisons. */
async function volatileColumns(conn, schema, table) {
  const sql =
    isMysqlTrack(conn.track)
      ? `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}'
           AND (extra LIKE '%auto_increment%' OR extra LIKE '%on update%' OR column_default LIKE '%CURRENT_TIMESTAMP%' OR column_default LIKE '%now()%')`
      : `SELECT column_name FROM information_schema.columns WHERE table_schema = '${schema}' AND table_name = '${table}'
           AND (is_identity = 'YES' OR column_default LIKE 'nextval(%' OR column_default ILIKE '%now()%' OR column_default ILIKE '%current_%')`;
  const r = await conn.run(sql);
  return new Set((r.rows || []).map((x) => String(x[0]).toLowerCase()));
}

async function snapshot(conn, tables) {
  const snap = {};
  for (const t of tables) {
    const r = await conn.run(`SELECT * FROM ${t.ref}`);
    const keep = r.columns.map((c, i) => (t.volatile.has(c.toLowerCase()) ? -1 : i)).filter((i) => i >= 0);
    snap[t.name] = { columns: keep.map((i) => r.columns[i]), keys: r.rows.map((row) => rowKey(keep.map((i) => row[i]))) };
  }
  return snap;
}

/** Rows each table gained and lost when the statements run (inside a rolled-back transaction). */
async function rowChanges(conn, tables, statements) {
  await conn.begin();
  try {
    const before = await snapshot(conn, tables);
    const run = await runAll(conn, statements);
    if (run.error) return { error: run.error };
    const after = await snapshot(conn, tables);
    const out = {};
    for (const t of tables) {
      const b = multiset(before[t.name].keys);
      const a = multiset(after[t.name].keys);
      out[t.name] = { columns: after[t.name].columns, added: minus(a, b).sort(), removed: minus(b, a).sort() };
    }
    return { changes: out };
  } finally {
    await conn.rollback();
  }
}

function describeChange(c) {
  const parts = [];
  if (c.added.length) parts.push(`${c.added.length} row${c.added.length === 1 ? "" : "s"} added`);
  if (c.removed.length) parts.push(`${c.removed.length} removed`);
  return parts.join(", ") || "no change";
}

async function checkDiff(conn, ex, userStatements) {
  const bad = userStatements.map(firstWord).find((w) => !READ_WORDS.has(w) && !ROW_WORDS.has(w));
  if (bad) {
    return { verdict: "manual", message: `Checking runs your SQL in a transaction that is then rolled back, so it can't include ${bad}. Compare with the expected result below instead.` };
  }
  const solStatements = splitSql(ex.solution_sql);
  const schema = exerciseSchema(ex);
  const names = [...new Set([...targetTables(solStatements), ...targetTables(userStatements)])];
  const tables = [];
  for (const n of names) {
    const [s, t] = n.includes(".") ? n.split(".") : [schema, n];
    const ref = isMysqlTrack(conn.track) ? `\`${s}\`.\`${t}\`` : `"${s}"."${t}"`;
    tables.push({ name: n, ref, volatile: await volatileColumns(conn, s, t) });
  }
  if (!tables.length) return { verdict: "manual", message: "Couldn't tell which tables this exercise changes. Compare with the expected result below." };

  let sol;
  try {
    sol = await rowChanges(conn, tables, solStatements);
  } catch (e) {
    sol = { error: { code: conn.errorCode(e), message: e.message } }; // e.g. a table from an earlier exercise is missing
  }
  if (sol.error) {
    const code = String(sol.error.code);
    if (MISSING_OBJECT.has(code) || LOCK_ERRORS.has(code) || TIMEOUT_ERRORS.has(code)) return solutionFailed(ex, sol.error);
    return {
      verdict: "unavailable",
      message: `The course solution can't run on your database right now (${sol.error.message}). Your database probably already contains changes from this exercise: click "Undo exercise changes" (or Reset database) and check again.`,
    };
  }
  const mine = await rowChanges(conn, tables, userStatements);
  if (mine.error) return userFailed(mine.error, userStatements);

  const diffs = [];
  for (const t of tables) {
    const e = sol.changes[t.name];
    const g = mine.changes[t.name];
    const same = e.added.join("\n") === g.added.join("\n") && e.removed.join("\n") === g.removed.join("\n");
    if (!same) diffs.push({ table: t.name, expected: e, got: g });
  }
  const summary = tables
    .filter((t) => sol.changes[t.name].added.length || sol.changes[t.name].removed.length)
    .map((t) => `${t.name}: ${describeChange(sol.changes[t.name])}`)
    .join("; ");
  if (!diffs.length) {
    return { verdict: "correct", message: `Correct: your SQL makes exactly the course's changes (${summary || "no change"}). Nothing was saved: the check rolled it back.` };
  }
  const d = diffs[0];
  const sample = (keys) => (keys.length ? display(JSON.parse(keys[0])) : "");
  const cols = `(${d.expected.columns.join(", ")})`;
  const missingAdded = minus(multiset(d.expected.added), multiset(d.got.added));
  const extraAdded = minus(multiset(d.got.added), multiset(d.expected.added));
  const missingRemoved = minus(multiset(d.expected.removed), multiset(d.got.removed));
  const extraRemoved = minus(multiset(d.got.removed), multiset(d.expected.removed));
  const sameCounts = describeChange(d.expected) === describeChange(d.got);
  let message = sameCounts
    ? `${d.table}: like the course's solution, yours gives ${describeChange(d.got)}, but the values differ.`
    : `${d.table}: the course's solution gives ${describeChange(d.expected)}; yours gives ${describeChange(d.got)}.`;
  if (missingAdded.length) message += ` Expected a row ${cols} = ${sample(missingAdded)}`;
  if (extraAdded.length) message += `${missingAdded.length ? "; yours is" : " Your extra row:"} ${sample(extraAdded)}`;
  if (missingAdded.length || extraAdded.length) message += ".";
  if (missingRemoved.length) message += ` The course's solution also removes/changes ${sample(missingRemoved)}.`;
  if (extraRemoved.length) message += ` Yours removes/changes a row it shouldn't: ${sample(extraRemoved)}.`;
  return { verdict: "incorrect", message: message + " (Nothing was saved: the check rolled it back.)" };
}

async function checkError(conn, ex, userStatements) {
  await conn.begin();
  try {
    const run = await runAll(conn, userStatements);
    if (!run.error) {
      return { verdict: "incorrect", message: `Your SQL ran without an error. In this exercise the database should reject it with error ${ex.expected_error}: that rejection is the rule you're testing.` };
    }
    if (String(run.error.code) === String(ex.expected_error)) {
      return { verdict: "correct", message: `Correct: rejected with error ${run.error.code} (${run.error.message}), exactly the error the exercise demonstrates.` };
    }
    if (MISSING_OBJECT.has(String(run.error.code)) && ex.prereq_text) return solutionFailed(ex, run.error);
    return { verdict: "incorrect", message: `Rejected, but with error ${run.error.code} (${run.error.message}). The exercise expects error ${ex.expected_error}.` };
  } finally {
    await conn.rollback();
  }
}

async function checkExercise(ex, sql) {
  const userStatements = splitSql(String(sql || ""));
  if (ex.check_mode === "concept") {
    return { verdict: "concept", message: "Nothing to run for this one: it's about understanding the idea. Read the solution notes, then mark it done." };
  }
  if (!userStatements.length) return { verdict: "error", message: "Write your answer in the editor first." };
  if (ex.check_mode === "manual") {
    return { verdict: "manual", message: "This exercise changes the database structure, permissions or transactions, so it can't be checked automatically. Run it, then compare with the expected result below." };
  }
  if (ex.check_mode === "results") {
    const bad = userStatements.map(firstWord).find((w) => !READ_WORDS.has(w) && !ROW_WORDS.has(w));
    if (bad) return { verdict: "manual", message: `This exercise only reads data, but your SQL contains ${bad}. Checking runs read-only work, so remove it and check again.` };
  }
  const conn = await connect(ex.track);
  try {
    if (ex.context_sql) await conn.run(ex.context_sql.replace(/;\s*$/, ""));
    if (ex.check_mode === "results") {
      await conn.begin();
      try {
        return await checkResults(conn, ex, userStatements);
      } finally {
        await conn.rollback();
      }
    }
    if (ex.check_mode === "diff") return await checkDiff(conn, ex, userStatements);
    if (ex.check_mode === "error") return await checkError(conn, ex, userStatements);
    return { verdict: "manual", message: "Compare with the expected result below." };
  } finally {
    await conn.close();
  }
}

/** Runs the exercise's CLEANUP block to undo what the exercise changed. */
async function runCleanup(ex) {
  if (!ex.cleanup_sql) return { ok: false, message: "This exercise has no cleanup block." };
  const conn = await connect(ex.track);
  try {
    if (ex.context_sql) await conn.run(ex.context_sql.replace(/;\s*$/, ""));
    const r = await runAll(conn, splitSql(ex.cleanup_sql));
    if (r.error) return { ok: false, message: `Cleanup stopped at statement ${r.error.statement}: ${r.error.message}` };
    return { ok: true, message: "Undone: the database is back to how it was before this exercise." };
  } finally {
    await conn.close();
  }
}

// "already exists" / duplicate errors: a prerequisite that was already done.
// (1396 = "Operation CREATE USER failed": the user exists.)
const ALREADY_DONE = new Set(["1050", "1304", "1062", "1061", "1060", "1826", "1359", "1396", "42P07", "42723", "23505", "42710", "42701", "42P06"]);

/**
 * Runs (and keeps) the solutions this exercise's "Prerequisites .." line names, their own
 * prerequisites first, so a learner can start any exercise without doing the earlier ones.
 * getExercise(track, code) looks an exercise up.
 */
async function runPrerequisites(ex, getExercise) {
  const order = [];
  const seen = new Set();
  const visit = (code, depth) => {
    if (seen.has(code) || depth > 20) return;
    seen.add(code);
    const p = getExercise(ex.track, code);
    if (!p) return;
    for (const c of JSON.parse(p.prereq_codes || "[]")) visit(c, depth + 1);
    order.push(p);
  };
  for (const c of JSON.parse(ex.prereq_codes || "[]")) visit(c, 0);
  if (!order.length) return { ok: true, ran: [], message: "This exercise has no prerequisites." };

  // Statement by statement, best effort: "already exists" means done before, and some solutions
  // end with a test call that fails on purpose (e.g. CALL record_payment(10, -5, ...)) after the
  // object they create is in place. Other failures are reported but don't stop the rest.
  const conn = await connect(ex.track);
  const ran = [];
  try {
    for (const p of order) {
      if (p.context_sql) await conn.run(p.context_sql.replace(/;\s*$/, ""));
      const problems = [];
      let already = false;
      for (const stmt of splitSql(p.solution_sql)) {
        try {
          await conn.run(stmt);
        } catch (e) {
          const code = String(conn.errorCode(e));
          if (ALREADY_DONE.has(code)) already = true;
          else if (LOCK_ERRORS.has(code)) return { ok: false, ran, message: LOCKED_HINT };
          else problems.push(e.message);
        }
      }
      ran.push({ code: p.code, ok: true, already, problems });
    }
  } finally {
    await conn.close();
  }
  const notes = ran.filter((r) => r.problems.length).map((r) => `${r.code}: ${r.problems[0]}`);
  return {
    ok: true,
    ran,
    message:
      `Ran ${ran.map((r) => r.code + (r.already ? " (already done)" : "")).join(", ")}.` +
      (notes.length ? ` Some statements reported errors, often a deliberate failing test: ${notes.join("; ")}` : ""),
  };
}

/**
 * Runs a learner's SQL for an exercise on its database (as the Playground did): the exercise's
 * USE / SET search_path first, then each statement. Changes are kept (CREATE TABLE in one
 * exercise is used by later ones); "Undo exercise changes" and Reset database undo them.
 * Returns the last result set (first 500 rows), or what changed, or the error.
 */
async function runForLearner(ex, sql) {
  const statements = splitSql(String(sql || ""));
  if (!statements.length) return { ok: false, error: "Write a query first." };
  const conn = await connect(ex.track);
  const t0 = Date.now();
  try {
    if (ex.context_sql) await conn.run(ex.context_sql.replace(/;\s*$/, ""));
    let last = null, affected = 0;
    for (let i = 0; i < statements.length; i++) {
      try {
        const r = await conn.run(statements[i]);
        if (r.columns) last = r;
        else if (typeof r.affected === "number") affected += r.affected;
      } catch (e) {
        const code = String(conn.errorCode(e));
        const hint = LOCK_ERRORS.has(code) ? ` ${LOCKED_HINT}` : TIMEOUT_ERRORS.has(code) ? ` (${TOO_SLOW})` : "";
        return { ok: false, error: (statements.length > 1 ? `Statement ${i + 1}: ` : "") + e.message + hint, ms: Date.now() - t0 };
      }
    }
    if (last) return { ok: true, columns: last.columns, rows: last.rows.slice(0, 500).map((r) => r.map((v) => (v instanceof Date ? v.toISOString() : v))), count: last.rows.length, statements: statements.length, ms: Date.now() - t0 };
    return { ok: true, columns: null, affected, statements: statements.length, ms: Date.now() - t0 };
  } finally {
    await conn.close();
  }
}

/** Is the exercise's database server reachable? Throws the connection error if not. */
async function ping(track) {
  const conn = await connect(track);
  await conn.close();
}

module.exports = { checkExercise, runCleanup, runPrerequisites, hasOuterOrderBy, runForLearner, ping };
