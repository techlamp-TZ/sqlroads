// Comparing a learner's result with a reference result - one implementation for the browser
// (Check answer) and the server (reference answers), so both judge alike.
//   - column names are ignored (aliases, upper/lower case): values are compared by position
//   - numbers match when they agree to 2 decimal places (12.3456 = 12.35; "12.5" = 12.5)
//   - row order counts only when the exercise asks for an order
//   - NULL and the empty string are different values; neither equals the text "NULL"
(function (root) {
  "use strict";
  var NULL_KEY = "\u0000null";
  function cell(v) {
    if (v === null || v === undefined) return NULL_KEY;
    if (typeof v === "number" || typeof v === "bigint") return num(Number(v));
    var t = String(v).trim();
    return /^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t) ? num(Number(t)) : "s:" + t;
  }
  function num(n) {
    if (!isFinite(n)) return "n:" + String(n);
    var r = Math.round((n + (n >= 0 ? 1e-9 : -1e-9)) * 100) / 100;
    return "n:" + (r === 0 ? 0 : r).toFixed(2);
  }
  function rowKey(row) { return JSON.stringify(row.map(cell)); }
  function plural(n, w) { return n + " " + w + (n === 1 ? "" : "s"); }

  /** expected/got: { columns: [...], rows: [[...], ...] }. Returns { ok, reason, missing, extra }. */
  function compare(expected, got, ordered) {
    var ec = expected.columns.length, gc = got.columns.length;
    if (gc !== ec) return { ok: false, reason: "Your result has " + plural(gc, "column") + "; the answer has " + ec + " (" + expected.columns.join(", ") + ")." };
    var a = expected.rows.map(rowKey), b = got.rows.map(rowKey);
    var bag = {};
    a.forEach(function (k) { bag[k] = (bag[k] || 0) + 1; });
    var missing = 0; // rows of yours that aren't in the answer
    b.forEach(function (k) { if (bag[k]) bag[k]--; else missing++; });
    var lost = Object.keys(bag).reduce(function (n, k) { return n + bag[k]; }, 0); // answer rows you don't have
    var parts = [];
    if (lost) parts.push(plural(lost, "expected row") + (lost === 1 ? " is" : " are") + " missing");
    if (missing) parts.push(plural(missing, "row") + " of yours " + (missing === 1 ? "isn't" : "aren't") + " in the answer");
    if (got.rows.length !== expected.rows.length) return { ok: false, reason: "Your query returns " + plural(got.rows.length, "row") + "; the answer has " + expected.rows.length + (parts.length ? ": " + parts.join(" and ") : "") + ".", missing: missing, lost: lost };
    if (missing) {
      // the right data with the columns in another order is accepted (the reason says so)
      var perm = columnOrder(expected, got);
      if (perm) {
        var reordered = { columns: perm.map(function (k) { return got.columns[k]; }), rows: got.rows.map(function (r) { return perm.map(function (k) { return r[k]; }); }) };
        var again = compare(expected, reordered, ordered);
        if (again.ok) return { ok: true, columnsReordered: true, reason: "Correct: right data, with your columns in a different order (" + reordered.columns.join(", ") + " in the answer's order)." };
      }
      return { ok: false, reason: "Same number of rows, but " + plural(missing, "row") + " of yours " + (missing === 1 ? "isn't" : "aren't") + " in the answer (" + plural(lost, "expected row") + (lost === 1 ? " is" : " are") + " missing).", missing: missing, lost: lost };
    }
    if (ordered && a.join("\n") !== b.join("\n")) return { ok: false, reason: "Right rows, wrong order: check your ORDER BY." };
    return { ok: true, reason: "Correct: your result matches the answer (" + plural(expected.rows.length, "row") + ")." };
  }
  // for each expected column, a column of `got` holding the same values (as a multiset); null when
  // there is no such one-to-one match, or when the columns are already in the same order
  function columnOrder(expected, got) {
    var sig = function (res, k) { return res.rows.map(function (r) { return cell(r[k]); }).sort().join("\u0001"); };
    var want = expected.columns.map(function (_, k) { return sig(expected, k); });
    var have = got.columns.map(function (_, k) { return sig(got, k); });
    var used = {}, perm = [];
    for (var i = 0; i < want.length; i++) {
      var j = -1;
      if (have[i] === want[i] && !used[i]) j = i;
      else for (var k = 0; k < have.length; k++) if (!used[k] && have[k] === want[i]) { j = k; break; }
      if (j < 0) return null;
      used[j] = true; perm.push(j);
    }
    return perm.every(function (p, i) { return p === i; }) ? null : perm;
  }
  // does the exercise ask for an order? (the same words the reference pipeline uses)
  var ORDER_WORDS = /\border(ed)?\b[^.;]{0,40}?\bby\b|\bsort(ed)?\b|\bascending\b|\bdescending\b|\balphabetical(ly)?\b|\b(highest|lowest|largest|smallest|biggest|most|least|earliest|latest|newest|oldest)\b[^.]*\bfirst\b|\bin order\b|\brank(ed)?\b/i;
  function asksForOrder(text) { return ORDER_WORDS.test(String(text || "")); }

  // drills about "today": every run sees the same moment, so the reference and the learner agree.
  // The same instant the MySQL trigger tests run at.
  var FROZEN = "2026-01-15 12:00:00";
  var CLOCK_FUNCS = /((?:date|time|datetime|julianday|unixepoch)\s*\(\s*|strftime\s*\(\s*'[^']*'\s*,\s*)'now'/gi;
  function usesClock(sql) { CLOCK_FUNCS.lastIndex = 0; return CLOCK_FUNCS.test(String(sql || "")) || /\bCURRENT_(DATE|TIME|TIMESTAMP)\b/i.test(String(sql || "")); }
  function freezeClock(sql) {
    return String(sql || "").replace(CLOCK_FUNCS, "$1'" + FROZEN + "'")
      .replace(/\bCURRENT_TIMESTAMP\b/gi, "'" + FROZEN + "'").replace(/\bCURRENT_DATE\b/gi, "'" + FROZEN.slice(0, 10) + "'").replace(/\bCURRENT_TIME\b/gi, "'" + FROZEN.slice(11) + "'");
  }

  // drills that ask for a random sample (ORDER BY RANDOM() LIMIT n): the pool is the query without the
  // random order and the limit; any n distinct rows of the pool are right
  var RANDOM_TAIL = /\s+ORDER\s+BY\s+RANDOM\s*\(\s*\)\s*(?:LIMIT\s+(\d+))?\s*;?\s*$/i;
  function samplePool(sql) {
    var m = RANDOM_TAIL.exec(String(sql || ""));
    return m ? { pool: String(sql).replace(RANDOM_TAIL, ""), limit: m[1] ? Number(m[1]) : null } : null;
  }
  /** pool: the full result to sample from; count: how many rows the sample has (null: all). */
  function compareSample(pool, count, got) {
    var ec = pool.columns.length, gc = got.columns.length;
    if (gc !== ec) return { ok: false, reason: "Your result has " + plural(gc, "column") + "; the answer has " + ec + " (" + pool.columns.join(", ") + ")." };
    var want = count == null ? pool.rows.length : Math.min(count, pool.rows.length);
    if (got.rows.length !== want) return { ok: false, reason: "Your query returns " + plural(got.rows.length, "row") + "; the answer returns " + want + " (picked at random)." };
    var tryRows = function (rows) {
      var bag = {}, missing = 0;
      pool.rows.forEach(function (r) { var k = rowKey(r); bag[k] = (bag[k] || 0) + 1; });
      rows.forEach(function (r) { var k = rowKey(r); if (bag[k]) bag[k]--; else missing++; });
      return missing;
    };
    var missing = tryRows(got.rows);
    if (missing) {
      // columns in another order: match each of yours to a pool column by name, then try again
      var names = pool.columns.map(function (c) { return String(c).toLowerCase(); });
      var perm = names.map(function (n) { return got.columns.map(function (c) { return String(c).toLowerCase(); }).indexOf(n); });
      if (perm.every(function (p) { return p > -1; }) && !tryRows(got.rows.map(function (r) { return perm.map(function (k) { return r[k]; }); }))) missing = 0;
    }
    if (missing) return { ok: false, reason: plural(missing, "row") + " of yours " + (missing === 1 ? "isn't" : "aren't") + " in the table the sample should come from.", missing: missing };
    return { ok: true, reason: "Correct: " + plural(want, "row") + " picked from the right rows (a random sample, so the rows can differ from the answer's)." };
  }

  /**
   * Several accepted answers: correct when the result matches any of them. Otherwise the closest one (same
   * column count first, then the fewest missing + extra rows) gives the reason, saying which answer it was.
   * expectedList: [{ columns, rows, label? }]. Returns { ok, index, reason, closest }.
   */
  function compareBest(expectedList, got, ordered) {
    var best = null;
    for (var i = 0; i < expectedList.length; i++) {
      var c = compare(expectedList[i], got, ordered);
      if (c.ok) return { ok: true, index: i, reason: expectedList.length > 1 ? c.reason.replace(/^Correct: /, "Correct: ").replace(/\.$/, "") + " (one of " + expectedList.length + " accepted answers)." : c.reason };
      var colGap = Math.abs(expectedList[i].columns.length - got.columns.length);
      var score = colGap ? 100000 + colGap : (c.lost || 0) + (c.missing || 0) + Math.abs(expectedList[i].rows.length - got.rows.length) + (/order/.test(c.reason) ? 0.5 : 0);
      if (!best || score < best.score) best = { score: score, index: i, reason: c.reason };
    }
    var label = expectedList[best.index].label;
    return { ok: false, index: best.index, closest: best.index, reason: expectedList.length > 1 ? "Compared with the closest of " + expectedList.length + " accepted answers" + (label ? " (" + label + ")" : "") + ": " + best.reason : best.reason };
  }

  var api = { compareBest: compareBest, compare: compare, cell: cell, asksForOrder: asksForOrder, freezeClock: freezeClock, usesClock: usesClock, FROZEN: FROZEN, samplePool: samplePool, compareSample: compareSample };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SqlCompare = api;
})(typeof window !== "undefined" ? window : this);
