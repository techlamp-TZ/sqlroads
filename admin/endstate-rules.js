// "Predict the end state" rules that need no database: wrong choices are the shown script with one edit, and a
// choice may only name what the learner can see in the shown script (statement numbers, values, tables, columns).
const { splitSql } = require("../course/split-sql.js");
const statementsOf = (sql) => splitSql(String(sql || "")).map((s) => s.trim()).filter(Boolean);

/** The shown script with one edit applied: { statement: N, sql } replaces statement N; { check_sql } swaps the check query. Null when invalid. */
function applyEdit(p, e) {
  if (!e || typeof e !== "object") return null;
  if (typeof e.check_sql === "string" && e.check_sql.trim()) return p.mode === "table" && e.check_sql.trim() !== String(p.check_sql || "").trim() ? { script: p.script, check: e.check_sql.trim(), edit: e } : null;
  const stmts = statementsOf(p.script), n = Number(e.statement);
  const one = statementsOf(e.sql);
  if (!Number.isInteger(n) || n < 1 || n > stmts.length || one.length !== 1 || one[0].replace(/\s+/g, " ") === stmts[n - 1].replace(/\s+/g, " ")) return null;
  const out = stmts.slice(); out[n - 1] = one[0];
  return { script: out.join(";\n") + ";", check: p.check_sql, edit: e };
}
// a stored full script (older items) counts as a variant only when it has exactly the shown script's statements count
const legacyVariant = (script, p, check) => (script && statementsOf(script).length === statementsOf(p.script).length ? { script, check: check || p.check_sql } : null);
const SCRATCH_NAME = /\b(?:sqlscratch_[a-z0-9_]+|es_[0-9a-f]{10})\./gi;
/** Null when a choice only names what the learner can see in the shown script (+ check query); else the reason. */
function ungrounded(o, shownScript, shownCheck) {
  const text = (String(shownScript) + " " + String(shownCheck || "")).toLowerCase();
  const seen = (v) => { const t = String(v).toLowerCase().trim(); return !t || text.includes(t); };
  // generated names (users_email_key, a_pkey, users.PRIMARY): every part must be visible, apart from the suffix
  const nameSeen = (tok) => tok.replace(SCRATCH_NAME, "").split(".").every((part) => seen(part) || /^primary$/i.test(part) || part.split("_").filter((w) => !/^(pkey|key|fkey|check|excl|idx|seq)$/i.test(w)).every((w) => seen(w)));
  if (o.kind === "error") {
    const n = statementsOf(shownScript).length;
    // a syntax error comes from a broken edit, not from a misunderstanding a learner could have
    if (/error in your SQL syntax|syntax error at or near/i.test(o.error)) return "is a syntax error, not a realistic mistake";
    if (o.failsAt > n) return "names statement " + o.failsAt + " but the script has " + n;
    // a quoted name: an apostrophe inside a word (can't, doesn't) is not a quote
    const bad = [...String(o.error).matchAll(/(?<![A-Za-z])'([^']*)'(?![A-Za-z])|"([^"]*)"/g)].map((m) => m[1] ?? m[2]).find((tok) => !nameSeen(tok));
    return bad !== undefined ? "names '" + bad + "', which isn't in the script" : null;
  }
  if (o.kind === "rows") {
    const col = o.rows.columns.find((c) => !seen(c));
    if (col) return "shows the column " + col + ", which isn't in the script";
    for (const row of o.rows.rows) for (const v of row) if (v !== null && v !== "" && isNaN(Number(v)) && !seen(v)) return "shows the value '" + v + "', which isn't in the script";
  }
  return null;
}

module.exports = { statementsOf, applyEdit, legacyVariant, ungrounded, SCRATCH_NAME };
