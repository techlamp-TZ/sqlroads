// Admin settings kept in the database (not secrets: those stay in .env).
//   provider order for Generate (drafts) and for Review (the independent check of a draft).
// The reviewer is always a different provider from the one that generated the draft.
const db = require("../db.js");

db.exec("CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)");
const PROVIDERS = ["claude", "openai", "deepseek"];
// defaults follow the roles in hints.js: OpenAI generates, DeepSeek reviews, Claude last (it also breaks ties)
const DEFAULTS = { "order.generate": ["openai", "deepseek", "claude"], "order.review": ["deepseek", "openai", "claude"] };

function get(key) {
  const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key);
  return row ? JSON.parse(row.value) : DEFAULTS[key];
}
function set(key, value) {
  db.prepare("INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at")
    .run(key, JSON.stringify(value), new Date().toISOString());
}
const clean = (list) => {
  const seen = [...new Set((Array.isArray(list) ? list : []).map((s) => String(s).toLowerCase()).filter((id) => PROVIDERS.includes(id)))];
  return seen.concat(PROVIDERS.filter((id) => !seen.includes(id)));
};
function providerOrder() { return { generate: clean(get("order.generate")), review: clean(get("order.review")), defaults: DEFAULTS }; }
function setProviderOrder({ generate, review }) {
  if (generate) set("order.generate", clean(generate));
  if (review) set("order.review", clean(review));
  return providerOrder();
}
/** The reviewer for a draft: the first ready provider in the Review order that didn't generate it. */
function reviewerFor(generatedBy, ready) {
  const order = providerOrder().review.filter((id) => ready.includes(id));
  return order.find((id) => id !== generatedBy) || null;
}

// ---- changes made to the local MySQL server for SQL Drills (shown in Settings -> System)
const MY_INI = process.env.MYSQL_INI || "C:\\ProgramData\\MySQL\\MySQL Server 8.0\\my.ini";
const SERVER_CHANGES = [
  { id: "trust", at: "2026-10-14", what: "log_bin_trust_function_creators = 1",
    why: "Binary logging is on, so without it nobody but a SUPER user can create triggers or functions: write drills that create them couldn't be checked.",
    how: "SET PERSIST: MySQL stores it in mysqld-auto.cnf and applies it on every start, so my.ini isn't needed. To undo: SET PERSIST log_bin_trust_function_creators = 0.", info: ["myIni"] },
  { id: "scratch", at: "2026-10-13", what: "MySQL user sqldrills_scratch",
    why: "Runs learners' and the checker's SQL for write drills. It can only touch databases named sqlscratch_*; its password is random and changes on every start.",
    how: "Created by the app (library/writecheck.js). Limits per statement: 5 s, 10,000 rows returned. Scratch databases older than 10 minutes are dropped every minute." },
];
async function serverChanges() {
  const mysql = require("mysql2/promise");
  const out = SERVER_CHANGES.map((c) => ({ ...c, live: null }));
  let iniHas = null;
  try { iniHas = /^\s*log_bin_trust_function_creators\s*=\s*(1|on)\s*$/im.test(require("fs").readFileSync(MY_INI, "utf8")); } catch { iniHas = null; }
  let c;
  try {
    c = await mysql.createConnection({ host: process.env.MYSQL_HOST || "127.0.0.1", port: Number(process.env.MYSQL_PORT || 3306), user: process.env.MYSQL_USER || "root", password: process.env.MYSQL_ROOT_PASSWORD });
    const [[v]] = await c.query("SHOW GLOBAL VARIABLES LIKE 'log_bin_trust_function_creators'");
    const [p] = await c.query("SELECT variable_value AS v FROM performance_schema.persisted_variables WHERE variable_name = 'log_bin_trust_function_creators'");
    const [u] = await c.query("SELECT host FROM mysql.user WHERE user = 'sqldrills_scratch'");
    const [s] = await c.query("SELECT COUNT(*) AS n FROM information_schema.schemata WHERE schema_name LIKE 'sqlscratch\\_%'");
    out[0].live = { now: v ? v.Value : "?", persisted: p.length ? p[0].v : "no", myIni: iniHas === null ? "can't read my.ini (not needed)" : iniHas ? "yes" : "no (not needed: SET PERSIST keeps it)" };
    out[1].live = { exists: u.length ? "yes (" + u.map((r) => r.host).join(", ") + ")" : "no (created on first use)", scratchNow: s[0].n };
  } catch (e) {
    out.forEach((x) => (x.live = { error: "MySQL is offline: " + e.message }));
  } finally { if (c) await c.end().catch(() => {}); }
  return out;
}

module.exports = { providerOrder, setProviderOrder, reviewerFor, PROVIDERS, serverChanges };
