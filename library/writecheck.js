// Write-query drills (INSERT / UPDATE / DELETE, DDL, views, indexes, routines, triggers,
// transactions), checked on the MySQL server:
//   - every run gets its own scratch schema (sqlscratch_<random>), seeded from the drill's dataset
//     file, and dropped afterwards;
//   - the learner's SQL runs as a restricted MySQL user (sqldrills_scratch) that may only touch
//     sqlscratch_* schemas: it can't reach the practice databases, users or server settings;
//   - the result is the STATE of the schema, not the statement text: every object that differs
//     from the freshly seeded dataset is compared - tables (columns, type family, nullability,
//     defaults, keys, unique / foreign keys, CHECKs, indexes by their columns, and all rows),
//     views (their result), routines and triggers.
const crypto = require("node:crypto");
const mysql = require("mysql2/promise");
const db = require("../db.js");
const { splitSql } = require("../course/split-sql.js");
const SqlCompare = require("../public/compare.js");

const SCRATCH_USER = "sqldrills_scratch";
const PASSWORD = crypto.randomBytes(18).toString("base64url"); // new every start, kept in memory only
const PREFIX = "sqlscratch_";
const host = () => ({ host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306) });
const root = (extra) => mysql.createConnection({ ...host(), user: process.env.MYSQL_USER || "root", password: process.env.MYSQL_ROOT_PASSWORD, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true, ...extra });

// statements that reach beyond one scratch schema are refused before anything runs
const FORBIDDEN = /^\s*(create|drop|alter|rename)\s+user\b|^\s*(grant|revoke)\b|^\s*set\s+(global|persist|password)\b|^\s*(create|drop|alter)\s+(database|schema)\b|^\s*use\s|\binto\s+(out|dump)file\b|^\s*load\s+(data|xml)\b|^\s*(shutdown|kill|install|uninstall)\b|^\s*flush\b/i;

let ready = null;
/** Creates (or refreshes) the restricted user once per server start. */
function ensureUser() {
  if (ready) return ready;
  ready = (async () => {
    const c = await root();
    try {
      for (const h of ["localhost", "127.0.0.1"]) {
        await c.query(`CREATE USER IF NOT EXISTS '${SCRATCH_USER}'@'${h}' IDENTIFIED BY ?`, [PASSWORD]);
        await c.query(`ALTER USER '${SCRATCH_USER}'@'${h}' IDENTIFIED BY ?`, [PASSWORD]);
        await c.query(`GRANT ALL PRIVILEGES ON \`${PREFIX.replace(/_/g, "\\_")}%\`.* TO '${SCRATCH_USER}'@'${h}'`);
      }
    } finally { await c.end(); }
    await sweep();
    if (!sweeper) sweeper = setInterval(() => sweep().catch(() => {}), SWEEP_EVERY).unref();
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// ---- limits for every statement run in a scratch schema
const STATEMENT_MS = 5000; // a statement still running after 5 s is killed
const MAX_ROWS = 10000; // rows a query may return
const MAX_AGE_MS = 10 * 60 * 1000; // a scratch schema older than this is a leftover (a crashed check)
const SWEEP_EVERY = 60 * 1000;
let sweeper = null;
// the schema name carries its creation time: sqlscratch_<ms base36>_<random>
const scratchName = () => `${PREFIX}${Date.now().toString(36)}_${crypto.randomBytes(5).toString("hex")}`;
const bornAt = (name) => { const m = /^sqlscratch_([0-9a-z]+)_[0-9a-f]+$/.exec(name); return m ? parseInt(m[1], 36) : 0; };
/** Drops scratch schemas older than 10 minutes (and any without a time in their name). */
async function sweep() {
  const c = await root();
  try {
    const [list] = await c.query("SELECT schema_name AS s FROM information_schema.schemata WHERE schema_name LIKE ?", [PREFIX.replace(/_/g, "\\_") + "%"]);
    const old = list.map((r) => r.s).filter((s) => Date.now() - bornAt(s) > MAX_AGE_MS);
    for (const s of old) await c.query(`DROP DATABASE IF EXISTS \`${s}\``);
    if (old.length) console.log(`[writecheck] dropped ${old.length} leftover scratch schema${old.length === 1 ? "" : "s"}`);
    return old.length;
  } finally { await c.end(); }
}

/** The dataset's SQL files, in order (the same text the browser engine loads). */
function seedSql(site) {
  const seen = new Set();
  return db.prepare("SELECT f.name, f.content FROM files f JOIN folders fo ON fo.id = f.folder_id WHERE fo.site_id = ? AND f.type = 'sql' ORDER BY fo.order_index, f.order_index").all(site)
    .filter((f) => !seen.has(f.name) && seen.add(f.name)).map((f) => f.content);
}

/** Runs fn(conn, schema) in a fresh, seeded scratch schema, as the restricted user; always cleans up. */
async function withScratch(site, fn) {
  await ensureUser();
  const schema = scratchName();
  const admin = await root({ multipleStatements: true });
  try {
    await admin.query(`CREATE DATABASE \`${schema}\``);
    await admin.query(`USE \`${schema}\``);
    for (const file of seedSql(site)) await admin.query(file);
    const conn = await mysql.createConnection({ ...host(), user: SCRATCH_USER, password: PASSWORD, database: schema, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
    try {
      await conn.query(`SET SESSION MAX_EXECUTION_TIME = ${STATEMENT_MS}, innodb_lock_wait_timeout = 5, lock_wait_timeout = 5`);
      conn.killer = admin; // KILL QUERY for statements MAX_EXECUTION_TIME doesn't cover (DML, DDL, CALL)
      return await fn(conn, schema, admin);
    } finally { await conn.end().catch(() => {}); }
  } finally {
    await admin.query(`DROP DATABASE IF EXISTS \`${schema}\``).catch(() => {});
    await admin.end().catch(() => {});
  }
}

/** Runs the statements one by one. Returns { ok, error, statement, results: [{columns, rows} | {affected}] }. */
/** Splits a script into statements, honouring the mysql client's DELIMITER lines. */
function statementsOf(sql) {
  const out = [];
  let delim = ";", buf = [];
  const flush = () => {
    const text = buf.join("\n");
    buf = [];
    if (!text.trim()) return;
    if (delim === ";") out.push(...splitSql(text));
    else out.push(...text.split(delim));
  };
  for (const line of String(sql || "").split(/\r?\n/)) {
    const m = /^\s*DELIMITER\s+(\S+)\s*$/i.exec(line);
    if (m) { flush(); delim = m[1]; } else buf.push(line);
  }
  flush();
  return out.map((x) => x.trim()).filter((x) => x && x !== ";");
}
// MySQL has no RENAME VIEW: the forms other databases use are run as MySQL's RENAME TABLE (which renames views)
const mysqlForm = (s) => s.replace(/^\s*RENAME\s+VIEW\b/i, "RENAME TABLE").replace(/^\s*ALTER\s+VIEW\s+(\S+)\s+RENAME\s+TO\s+(\S+)\s*$/i, "RENAME TABLE $1 TO $2");
async function runStatements(conn, sql) {
  const statements = (Array.isArray(sql) ? sql : statementsOf(sql)).map(mysqlForm);
  if (!statements.length) return { ok: false, error: "Write your SQL first." };
  const bad = statements.find((s) => FORBIDDEN.test(s));
  if (bad) return { ok: false, error: "This statement reaches outside the exercise's own database (users, privileges, other databases or server settings), so it can't be run here: " + bad.trim().slice(0, 80) };
  const results = [];
  await conn.query(`SET SESSION sql_select_limit = ${MAX_ROWS}`);
  try {
    for (const [k, s] of statements.entries()) {
      let killed = false;
      const timer = conn.killer && setTimeout(() => { killed = true; conn.killer.query(`KILL QUERY ${conn.threadId}`).catch(() => {}); }, STATEMENT_MS);
      try {
        const [rows, fields] = await conn.query({ sql: s, rowsAsArray: true });
        // SLEEP() and some loops return normally when killed: a kill is a time-out all the same
        if (killed) throw Object.assign(new Error("killed"), { errno: 1317 });
        // CALL: the procedure's first result set (MySQL adds a status packet after it)
        if (Array.isArray(fields) && Array.isArray(fields[0]) && Array.isArray(rows) && Array.isArray(rows[0])) results.push({ columns: fields[0].map((f) => f.name), rows: rows[0].slice(0, 200), count: rows[0].length, call: true });
        else if (Array.isArray(fields) && Array.isArray(rows)) results.push({ columns: fields.map((f) => f.name), rows: rows.slice(0, 200), count: rows.length, capped: rows.length >= MAX_ROWS || undefined });
        else results.push({ affected: rows && rows.affectedRows != null ? rows.affectedRows : 0 });
      } catch (e) {
        const msg = killed || e.errno === 3024 || e.errno === 1317 ? `stopped after ${STATEMENT_MS / 1000} seconds (the time limit for one statement)` : e.message;
        return { ok: false, error: (statements.length > 1 ? `Statement ${k + 1}: ` : "") + msg, statement: k + 1, results, timedOut: killed || undefined };
      } finally { clearTimeout(timer); }
    }
  } finally {
    // the snapshot reads whole tables on this connection
    await conn.query("SET SESSION sql_select_limit = DEFAULT").catch(() => {});
  }
  return { ok: true, results, statements: statements.length };
}

// ---- the state of a schema
const family = (colType) => {
  const t = String(colType).toLowerCase();
  if (/^tinyint\(1\)/.test(t) || /^bool/.test(t)) return "bool";
  if (/^(tiny|small|medium|big)?int|^integer/.test(t)) return "int";
  const dec = t.match(/^(decimal|numeric)\(\d+,(\d+)\)/);
  if (dec) return "decimal(" + dec[2] + ")";
  if (/^(float|double|real)/.test(t)) return "float";
  if (/^(var)?char|text$|^(tiny|medium|long)?text/.test(t)) return "text";
  if (/^datetime|^timestamp/.test(t)) return "datetime";
  if (/^(date|time|year|json|enum|set)/.test(t)) return t.replace(/\s+/g, "");
  if (/blob|binary/.test(t)) return "blob";
  return t;
};
const normClause = (s) => String(s || "").toLowerCase().replace(/_utf8mb4\\?'/g, "'").replace(/\\'/g, "'").replace(/[`\s()]/g, "");
const normDefault = (d) => (d == null ? null : String(d).replace(/^'(.*)'$/, "$1").replace(/^_utf8mb4\\?'(.*)\\?'$/, "$1"));
const rowsOf = async (conn, schema, table) => {
  const [rows, fields] = await conn.query({ sql: `SELECT * FROM \`${schema}\`.\`${table}\``, rowsAsArray: true });
  const order = fields.map((f, k) => [f.name.toLowerCase(), k]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return rows.map((r) => JSON.stringify(order.map(([, k]) => SqlCompare.cell(r[k])))).sort();
};
/** Everything in the schema, by object key ("table:products", "view:v", "index"...). */
async function snapshot(conn, schema) {
  const q = async (sql, args) => (await conn.query(sql, args))[0];
  const out = {};
  const tables = await q("SELECT table_name AS name, table_type AS type FROM information_schema.tables WHERE table_schema = ?", [schema]);
  const cols = await q("SELECT table_name AS t, column_name AS c, column_type AS type, is_nullable AS n, column_default AS d, extra AS extra FROM information_schema.columns WHERE table_schema = ? ORDER BY ordinal_position", [schema]);
  const keys = await q(`SELECT k.table_name AS t, k.constraint_name AS name, tc.constraint_type AS type, k.column_name AS c, k.referenced_table_name AS rt, k.referenced_column_name AS rc
    FROM information_schema.key_column_usage k JOIN information_schema.table_constraints tc ON tc.constraint_schema = k.constraint_schema AND tc.table_name = k.table_name AND tc.constraint_name = k.constraint_name
    WHERE k.table_schema = ? ORDER BY k.ordinal_position`, [schema]);
  const checks = await q(`SELECT tc.table_name AS t, cc.check_clause AS clause FROM information_schema.table_constraints tc JOIN information_schema.check_constraints cc ON cc.constraint_schema = tc.constraint_schema AND cc.constraint_name = tc.constraint_name
    WHERE tc.table_schema = ? AND tc.constraint_type = 'CHECK'`, [schema]);
  const idx = await q("SELECT table_name AS t, index_name AS name, non_unique AS nu, column_name AS c FROM information_schema.statistics WHERE table_schema = ? AND index_name <> 'PRIMARY' ORDER BY seq_in_index", [schema]);
  for (const tb of tables) {
    const key = (tb.type === "VIEW" ? "view:" : "table:") + tb.name.toLowerCase();
    const mine = (list) => list.filter((x) => x.t === tb.name);
    if (tb.type === "VIEW") {
      const [rows, fields] = await conn.query({ sql: `SELECT * FROM \`${schema}\`.\`${tb.name}\``, rowsAsArray: true });
      out[key] = { columns: fields.length, rows: rows.map((r) => JSON.stringify(r.map(SqlCompare.cell))).sort() };
      continue;
    }
    const group = (list, by) => Object.values(list.reduce((m, x) => ((m[x[by]] = m[x[by]] || []).push(x), m), {}));
    const kc = mine(keys);
    out[key] = {
      columns: mine(cols).map((c) => ({ name: c.c.toLowerCase(), type: family(c.type), nullable: c.n === "YES", default: normDefault(c.d), auto: /auto_increment/i.test(c.extra || "") })).sort((a, b) => (a.name < b.name ? -1 : 1)),
      primary: kc.filter((k) => k.type === "PRIMARY KEY").map((k) => k.c.toLowerCase()),
      unique: group(kc.filter((k) => k.type === "UNIQUE"), "name").map((g) => g.map((k) => k.c.toLowerCase()).join(",")).sort(),
      foreign: group(kc.filter((k) => k.type === "FOREIGN KEY"), "name").map((g) => g.map((k) => k.c.toLowerCase()).join(",") + "->" + String(g[0].rt).toLowerCase() + "(" + g.map((k) => String(k.rc).toLowerCase()).join(",") + ")").sort(),
      checks: mine(checks).map((c) => normClause(c.clause)).sort(),
      // an index on exactly a foreign key's (or unique key's) columns is that key's own index
      indexes: group(mine(idx), "name").filter((g) => {
        const cols = g.map((k) => k.c.toLowerCase()).join(",");
        return !group(kc.filter((k) => k.type !== "PRIMARY KEY"), "name").some((kg) => kg.map((k) => k.c.toLowerCase()).join(",") === cols) && !kc.some((k) => k.type === "UNIQUE" && k.name === g[0].name);
      }).map((g) => (g[0].nu ? "" : "unique ") + g.map((k) => k.c.toLowerCase()).join(",")).sort(),
      rows: await rowsOf(conn, schema, tb.name),
    };
  }
  for (const r of await q("SELECT routine_name AS name, routine_type AS type FROM information_schema.routines WHERE routine_schema = ?", [schema])) {
    const params = await q("SELECT parameter_mode AS m, data_type AS t FROM information_schema.parameters WHERE specific_schema = ? AND specific_name = ? AND ordinal_position > 0 ORDER BY ordinal_position", [schema, r.name]);
    out[`${r.type.toLowerCase()}:${r.name.toLowerCase()}`] = { params: params.map((p) => `${p.m || ""} ${family(p.t)}`.trim()) };
  }
  for (const t of await q("SELECT trigger_name AS name, event_object_table AS t, action_timing AS timing, event_manipulation AS event FROM information_schema.triggers WHERE trigger_schema = ?", [schema])) {
    out[`trigger:${t.t.toLowerCase()}:${t.timing.toLowerCase()}:${t.event.toLowerCase()}`] = { exists: true };
  }
  return out;
}
/** Temporary tables the statements created: they exist only on this connection. */
async function tempTables(conn, statements) {
  const out = {};
  for (const s of statements) {
    const m = /^\s*CREATE\s+TEMPORARY\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i.exec(s);
    if (!m) continue;
    try {
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${m[1]}\``);
      const [rows, fields] = await conn.query({ sql: `SELECT * FROM \`${m[1]}\``, rowsAsArray: true });
      const order = fields.map((f, k) => [f.name.toLowerCase(), k]).sort((a, b) => (a[0] < b[0] ? -1 : 1));
      out["temp:" + m[1].toLowerCase()] = {
        columns: cols.map((c) => ({ name: c.Field.toLowerCase(), type: family(c.Type), nullable: c.Null === "YES", default: normDefault(c.Default), auto: /auto_increment/i.test(c.Extra || "") })).sort((a, b) => (a.name < b.name ? -1 : 1)),
        primary: [], unique: [], foreign: [], checks: [], indexes: [],
        rows: rows.map((r) => JSON.stringify(order.map(([, k]) => SqlCompare.cell(r[k])))).sort(),
      };
    } catch { /* dropped again by the statements */ }
  }
  return out;
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The objects that differ from the seeded dataset: { key: state | null (removed) }. */
function changes(seed, after) {
  const out = {};
  for (const k of new Set([...Object.keys(seed), ...Object.keys(after)])) if (!same(seed[k], after[k])) out[k] = after[k] === undefined ? null : after[k];
  return out;
}
const seeds = new Map();
async function seedState(site) {
  if (!seeds.has(site)) seeds.set(site, await withScratch(site, (conn, schema) => snapshot(conn, schema)));
  return seeds.get(site);
}

/** Runs SQL on a fresh copy of the dataset: { ok, error, results, changed: {key: state|null} }. */
// the clock a behaviour test runs at, so NOW() in a trigger gives the same value for the reference and the learner
const PROBE_CLOCK = Date.UTC(2026, 0, 15, 12, 0, 0) / 1000;
/**
 * opts.probe: a fixed test (INSERT / UPDATE / DELETE) run after the SQL, at a frozen clock, to see what a
 * trigger actually does; its effect comes back as probed (changes from the start, test included).
 * opts.clock: unix seconds for the whole run (a check runs the reference and the learner's SQL at the same clock).
 */
async function runOnDataset(site, sql, setup, opts = {}) {
  const seed = setup ? null : await seedState(site);
  return withScratch(site, async (conn, schema) => {
    if (opts.clock) await conn.query("SET SESSION timestamp = ?", [opts.clock]);
    // setup: objects an earlier exercise created (a view to drop, a table to fill); the comparison starts after it
    let base = seed;
    if (setup) {
      const s = await runStatements(conn, setup);
      if (!s.ok) return { ok: false, error: "the setup failed: " + s.error, setupFailed: true };
      base = await snapshot(conn, schema);
    }
    // a transaction that ends in ROLLBACK leaves nothing behind: look at the state inside it, just before the ROLLBACK
    const list = statementsOf(sql);
    const endsInRollback = list.length > 1 && /^\s*ROLLBACK\s*;?\s*$/i.test(list[list.length - 1]);
    let r, inTx;
    if (endsInRollback) {
      r = await runStatements(conn, list.slice(0, -1));
      if (!r.ok) return r;
      inTx = changes(base, await snapshot(conn, schema));
      const end = await runStatements(conn, list.slice(-1));
      if (!end.ok) return end;
      r.statements++;
    } else {
      r = await runStatements(conn, sql);
      if (!r.ok) return r;
    }
    // a transaction left open counts as not committed: roll it back before looking at the state
    await conn.query("ROLLBACK").catch(() => {});
    const changed = { ...changes(base, await snapshot(conn, schema)), ...(await tempTables(conn, list)) };
    // the last result set (a CALL or a final SELECT): compared like a query when the SQL changes nothing
    const sets = r.results.filter((x) => x.columns);
    const result = sets.length ? sets[sets.length - 1] : null;
    if (!opts.probe) return { ...r, changed, result, inTx };
    await conn.query("SET SESSION timestamp = ?", [PROBE_CLOCK]);
    const p = await runStatements(conn, opts.probe);
    await conn.query("ROLLBACK").catch(() => {});
    if (!p.ok) return { ...r, changed, result, inTx, probeError: p.error };
    // only tables and views: the trigger itself is already compared in changed
    const probed = Object.fromEntries(Object.entries(changes(base, await snapshot(conn, schema))).filter(([k]) => /^(table|view):/.test(k)));
    return { ...r, changed, result, inTx, probed };
  });
}

// ---- comparing two end states
const describeKey = (k) => { const [kind, name, timing, event] = k.split(":"); return kind === "trigger" ? `the ${timing} ${event} trigger on ${name}` : kind === "temp" ? `temporary table ${name}` : `${kind} ${name}`; };
/** expected / got: change maps. Returns { same, why: [differences] }. */
function compareStates(expected, got, opts = {}) {
  const why = [];
  for (const k of new Set([...Object.keys(expected), ...Object.keys(got)])) {
    const e = k in expected ? expected[k] : "unchanged", g = k in got ? got[k] : "unchanged";
    if (same(e, g)) continue;
    const what = describeKey(k);
    if (e === "unchanged") { why.push(`${what}: you changed it, the task leaves it as it was`); continue; }
    if (e === null) { why.push(`${what}: the task removes it, yours still exists`); continue; }
    if (g === "unchanged") { why.push(`${what}: the task changes it, your SQL leaves it as it was`); continue; }
    if (g === null) { why.push(`${what}: yours was removed, the task keeps it`); continue; }
    if (k.startsWith("table:") || k.startsWith("temp:")) {
      const colsE = e.columns.map((c) => c.name), colsG = g.columns.map((c) => c.name);
      const miss = colsE.filter((c) => !colsG.includes(c)), extra = colsG.filter((c) => !colsE.includes(c));
      if (miss.length) why.push(`${what}: missing column ${miss.join(", ")}`);
      if (extra.length) why.push(`${what}: unexpected column ${extra.join(", ")}`);
      for (const c of e.columns) {
        const o = g.columns.find((x) => x.name === c.name);
        if (!o) continue;
        if (o.type !== c.type) why.push(`${what}: column ${c.name} is ${o.type}, expected ${c.type}`);
        if (o.nullable !== c.nullable) why.push(`${what}: column ${c.name} ${c.nullable ? "should allow NULL" : "should be NOT NULL"}`);
        if (o.default !== c.default) why.push(`${what}: column ${c.name} default is ${o.default === null ? "none" : o.default}, expected ${c.default === null ? "none" : c.default}`);
        if (o.auto !== c.auto) why.push(`${what}: column ${c.name} ${c.auto ? "should" : "shouldn't"} be AUTO_INCREMENT`);
      }
      for (const [prop, label] of [["primary", "primary key"], ["unique", "unique constraints"], ["foreign", "foreign keys"], ["checks", "CHECK constraints"], ["indexes", "indexes"]]) {
        if (!same(e[prop], g[prop])) why.push(`${what}: ${label} are ${JSON.stringify(g[prop])}, expected ${JSON.stringify(e[prop])}`);
      }
      if (opts.freeValues ? e.rows.length !== g.rows.length : !same(e.rows, g.rows)) {
        const bag = {}; e.rows.forEach((r) => (bag[r] = (bag[r] || 0) + 1));
        let missing = 0; g.rows.forEach((r) => (bag[r] ? bag[r]-- : 0));
        missing = Object.values(bag).reduce((a, n) => a + n, 0);
        why.push(`${what}: ${g.rows.length} rows after your SQL, ${e.rows.length} expected; ${missing} expected ${missing === 1 ? "row is" : "rows are"} missing or different`);
      }
    } else if (k.startsWith("view:")) {
      if (opts.freeValues && e.columns === g.columns && e.rows.length === g.rows.length) continue;
      // a view is a query: same rows with the columns in another order (or other names) is the same view
      const asResult = (v) => ({ columns: Array.from({ length: v.columns }, (_, n) => "c" + n), rows: v.rows.map((r) => JSON.parse(r)) });
      if (e.columns === g.columns && SqlCompare.compare(asResult(e), asResult(g), false).ok) continue;
      why.push(`${what}: its result differs (${g.rows.length} rows × ${g.columns} columns, expected ${e.rows.length} × ${e.columns})`);
    } else why.push(`${what}: ${JSON.stringify(g)} vs expected ${JSON.stringify(e)}`);
  }
  return { same: !why.length, why };
}

/**
 * Two runs (reference, learner) compared: the end state, and when the drill has a behaviour test (triggers),
 * the state after that test too. Returns { same, why }.
 */
function compareRuns(exp, got, opts = {}) {
  // nothing changed but rows came back (a CALL): compare the rows like a SELECT drill's
  if (!Object.keys(exp.changed || {}).length && exp.result) {
    if (Object.keys(got.changed || {}).length) return { same: false, why: compareStates({}, got.changed).why };
    if (!got.result) return { same: false, why: ["your SQL returned no rows to compare (the task's returns " + exp.result.count + ")"] };
    const c = SqlCompare.compare({ columns: exp.result.columns, rows: exp.result.rows }, { columns: got.result.columns, rows: got.result.rows }, false);
    return { same: c.ok, why: c.ok ? [] : [c.reason] };
  }
  const first = compareStates(exp.changed, got.changed, opts);
  const why = first.why.slice();
  if (exp.inTx && Object.keys(exp.inTx).length) {
    if (!got.inTx) why.push("the task's transaction ends with ROLLBACK; yours doesn't");
    else why.push(...compareStates(exp.inTx, got.inTx, opts).why.map((w) => "inside the transaction, before ROLLBACK: " + w));
  }
  if (!exp.probed) return { same: !why.length, why };
  if (got.probeError) why.push("the test statements (an INSERT / UPDATE that fires the trigger) failed after your SQL: " + got.probeError);
  else if (got.probed) why.push(...compareStates(exp.probed, got.probed, opts).why.map((w) => "after the test statements: " + w));
  return { same: !why.length, why };
}

/** Several accepted answers: the first that matches, else the closest (fewest differences). */
function compareRunsBest(expList, got, opts = {}) {
  let best = null;
  for (let i = 0; i < expList.length; i++) {
    const c = compareRuns(expList[i], got, opts);
    if (c.same) return { same: true, why: [], index: i };
    if (!best || c.why.length < best.why.length) best = { ...c, index: i };
  }
  return best;
}

/** Does this SQL need the write checker (anything but a single read-only query)? */
const isWrite = (sql) => statementsOf(sql).some((s) => !/^\s*(with|select)\b/i.test(s));

module.exports = { runOnDataset, compareStates, compareRuns, compareRunsBest, PROBE_CLOCK, seedState, isWrite, ensureUser, sweep, FORBIDDEN, STATEMENT_MS, MAX_ROWS, MAX_AGE_MS };
