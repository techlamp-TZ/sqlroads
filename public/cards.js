// The shared card engine's rules (no DOM, no database): the 20-type registry, which renderer and stage each card uses,
// whether it counts for mastery, and the automatic checks. Loaded by the learner app (window.Cards), by the server and
// by the tests (require). Existing items keep their own records; card_type is derived from them, never stored twice.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("./compare.js"));
  else root.Cards = factory(root.SqlCompare);
})(typeof self !== "undefined" ? self : this, function (SqlCompare) {
  "use strict";
  // renderer: recall (flip / reveal / choose), code (type or fix SQL), result (tables, joins, predictions), scenario
  // counts: true = part of a stage's mastery today (unchanged); new types are optional practice (user decision)
  var TYPES = {
    recall: { n: 1, label: "Recall", renderer: "recall", stage: "memorize", counts: true },
    syntax_builder: { n: 2, label: "Syntax builder", renderer: "code", stage: "memorize", counts: true },
    query_ordering: { n: 3, label: "Query ordering", renderer: "code", stage: "memorize", counts: true },
    predict: { n: 4, label: "Predict the output", renderer: "result", stage: "understand", counts: true },
    spot_bug: { n: 6, label: "Spot the bug", renderer: "code", stage: "memorize", counts: true },
    mcq: { n: 7, label: "Multiple choice", renderer: "recall", stage: "memorize", counts: false },
    join_mapper: { n: 8, label: "Join mapper", renderer: "result", stage: "understand", counts: false },
    query_translation: { n: 10, label: "Query translation", renderer: "scenario", stage: "practise", counts: true },
    cloze: { n: 11, label: "Cloze", renderer: "code", stage: "memorize", counts: true },
    compare_queries: { n: 12, label: "Compare two queries", renderer: "result", stage: "understand", counts: false },
    challenge: { n: 20, label: "Challenge", renderer: "any", stage: "all", counts: false },
    // Phase 2: optional practice, outside mastery and coverage
    result_set: { n: 5, label: "Result-set reasoning", renderer: "result", stage: "understand", counts: false },
    join_compare: { n: 9, label: "Join comparison", renderer: "result", stage: "understand", counts: false },
    find_difference: { n: 13, label: "Find the difference", renderer: "result", stage: "practise", counts: false },
    exec_timeline: { n: 15, label: "Execution timeline", renderer: "result", stage: "understand", counts: false },
    schema_detective: { n: 16, label: "Schema detective", renderer: "result", stage: "understand", counts: false },
    // Phase 3: optional practice too (#19 is built from the learner's own last attempt, not stored as an item)
    sort_filter: { n: 14, label: "Sort and filter", renderer: "scenario", stage: "practise", counts: false },
    query_optimizer: { n: 17, label: "Query optimizer", renderer: "result", stage: "transfer", counts: false },
    mistake_reflection: { n: 19, label: "Mistake reflection", renderer: "scenario", stage: "reflect", counts: false },
  };
  // card types stored as kind "card" that a learner answers (upgrades only enrich an existing item)
  var STANDALONE = ["join_mapper", "compare_queries", "result_set", "join_compare", "find_difference", "exec_timeline", "schema_detective", "sort_filter", "query_optimizer"];
  var UPGRADES = { syntax_upgrade: "flashcard", mcq_upgrade: "mcq" };
  var FLASH_TYPE = { keyword: "recall", blank: "syntax_builder", order: "query_ordering", error: "spot_bug" };

  /** The card type of any learning item, from what it already is. kind: flashcard | predict | lesson | card | mcq | drill */
  function cardTypeOf(kind, data) {
    data = data || {};
    if (kind === "flashcard") return FLASH_TYPE[data.type] || "recall";
    if (kind === "predict") return "predict";
    if (kind === "mcq") return "mcq";
    if (kind === "drill") return "query_translation";
    if (kind === "card") return data.card_type || null;
    return null;
  }
  function rendererOf(type) { return (TYPES[type] || {}).renderer || null; }

  // ---------- checks ----------
  // the same normalisation as the flashcards always used: trim, no trailing ;, one space, any case
  function normAns(s) { return String(s == null ? "" : s).trim().replace(/;$/, "").replace(/\s+/g, " ").toLowerCase(); }
  /** Syntax builder / cloze: the answer, or one of the accepted alternatives (an approved upgrade). */
  function checkBlank(answer, card) {
    var a = normAns(answer);
    if (!a) return false;
    return [card.answer].concat(card.accepted || []).some(function (x) { return normAns(x) === a; });
  }
  /** Only one read-only statement may run for a learner's fix (it runs in the browser's copy of the dataset). */
  function isReadOnlySql(sql) {
    var s = String(sql || "").replace(/--[^\n]*/g, " ").replace(/\/\*[\s\S]*?\*\//g, " ").trim().replace(/;\s*$/, "");
    if (!s || /;/.test(s.replace(/'(?:[^']|'')*'/g, "''"))) return false;
    return /^(select|with)\b/i.test(s) && !/\b(insert|update|delete|drop|alter|create|replace|attach|detach|pragma|vacuum)\b/i.test(s.replace(/'(?:[^']|'')*'/g, "''"));
  }
  /** Spot the bug: any fix whose real result equals the fixed query's real result passes (order only when it sorts). */
  function checkFix(learner, expected, ordered) {
    if (!learner || !expected) return { ok: false, why: "no result" };
    var r = SqlCompare.compare({ columns: learner.columns, rows: learner.rows }, { columns: expected.columns, rows: expected.rows }, !!ordered);
    return { ok: !!r.ok, why: r.ok ? "" : r.reason || r.message || "a different result" };
  }
  var sortsRows = function (sql) { return /\border\s+by\b/i.test(String(sql || "").replace(/over\s*\([^)]*\)/gi, "")); };
  /** Spot the bug: four diagnoses: the card's own explanation and up to three other errors' explanations (same pool). */
  function diagnosisOptions(card, pool, seedId) {
    var right = String(card.diagnosis || card.explanation || "").trim();
    if (!right) return null;
    var seen = {}, wrong = [];
    seen[right.toLowerCase()] = 1;
    (pool || []).forEach(function (p) { var t = String(p.diagnosis || p.explanation || "").trim(); if (t && !seen[t.toLowerCase()] && wrong.length < 3) { seen[t.toLowerCase()] = 1; wrong.push(t); } });
    if (wrong.length < 2) return null;
    var opts = [{ text: right, right: true }].concat(wrong.map(function (t) { return { text: t, right: false }; }));
    return shuffle(opts, seedId || right);
  }
  /** Join mapper: the right key pair (either side order) and the right join type. */
  function checkJoinMapper(pick, card) {
    var k = card.key || {}, p = pick || {};
    var keyRight = (eq(p.left, k.left) && eq(p.right, k.right)) || (eq(p.left, k.right) && eq(p.right, k.left));
    var typeRight = String(p.join || "").toUpperCase() === String(card.join_type || "").toUpperCase();
    return { right: keyRight && typeRight, keyRight: keyRight, typeRight: typeRight };
  }
  function eq(a, b) { return String(a || "").toLowerCase() === String(b || "").toLowerCase(); }
  /** Compare two queries: four statements about the two real results; exactly one is true. */
  function compareOptions(card) {
    var a = (card.result_a || {}).rows || [], b = (card.result_b || {}).rows || [];
    var na = a.length, nb = b.length;
    var key = function (r) { return JSON.stringify(r); };
    var inB = {}; b.forEach(function (r) { inB[key(r)] = (inB[key(r)] || 0) + 1; });
    var onlyA = 0; a.forEach(function (r) { if (inB[key(r)]) inB[key(r)]--; else onlyA++; });
    var ca = ((card.result_a || {}).columns || []).length, cb = ((card.result_b || {}).columns || []).length;
    var truth, cands;
    if (ca !== cb) {
      // the queries differ in their columns: the statements are about rows AND columns
      var rc = function (r, c) { return r + (r === 1 ? " row" : " rows") + " of " + c + (c === 1 ? " column" : " columns"); };
      var sayC = function (r1, c1, r2, c2) { return "Query A returns " + rc(r1, c1) + ", query B returns " + rc(r2, c2); };
      truth = sayC(na, ca, nb, cb);
      cands = [sayC(na, cb, nb, ca), sayC(na, ca, nb, ca), sayC(na, cb, nb, cb), sayC(nb + 1, ca, nb, cb), "Both return the same " + rc(na, Math.max(ca, cb))];
    } else {
      var same = na === nb && onlyA === 0;
      var say = function (x, y, s) { return s ? "Both return the same " + x + (x === 1 ? " row" : " rows") : "Query A returns " + x + (x === 1 ? " row" : " rows") + ", query B returns " + y; };
      truth = say(na, nb, same);
      cands = [say(nb, na, false), say(na, na, true), say(nb, nb, true), say(na + 1, nb, false), say(na, Math.max(0, nb - 1), false), say(Math.max(0, na - 1), nb + 1, false)];
    }
    var out = [{ text: truth, right: true }];
    cands.forEach(function (t) { if (out.length < 4 && out.every(function (o) { return o.text !== t; })) out.push({ text: t, right: false }); });
    return shuffle(out, card.id || truth);
  }
  /** Rows only in one result (for highlighting the difference), as row indexes. */
  function rowDiff(ra, rb) {
    var key = function (r) { return JSON.stringify(r); };
    var count = function (rows) { var m = {}; rows.forEach(function (r) { m[key(r)] = (m[key(r)] || 0) + 1; }); return m; };
    var mb = count(rb), ma = count(ra), onlyA = [], onlyB = [];
    ra.forEach(function (r, i) { if (mb[key(r)]) mb[key(r)]--; else onlyA.push(i); });
    rb.forEach(function (r, i) { if (ma[key(r)]) ma[key(r)]--; else onlyB.push(i); });
    return { onlyA: onlyA, onlyB: onlyB };
  }

  // ---------- the adaptive challenge ----------
  /**
   * One item for the Today plan's Challenge slot. candidates: [{ ref, kind, concept, due_at?, weakness? }].
   * A due item first (the longest overdue), else an item of the weakest concept (highest weakness), else none.
   */
  function pickChallenge(candidates, now) {
    var due = candidates.filter(function (c) { return c.due_at && Date.parse(c.due_at) <= now; }).sort(function (a, b) { return Date.parse(a.due_at) - Date.parse(b.due_at); });
    if (due.length) return Object.assign({ why: "due" }, due[0]);
    var weak = candidates.filter(function (c) { return !c.due_at && c.weakness > 0; }).sort(function (a, b) { return b.weakness - a.weakness || (a.ref < b.ref ? -1 : 1); });
    return weak.length ? Object.assign({ why: "weakest" }, weak[0]) : null;
  }
  /** Confidence 1-5 (the same scale as the Reflect box) nudges the next review: low confidence comes back sooner. */
  function confidenceDays(intervalDays, confidence, correct) {
    var c = Math.max(1, Math.min(5, Math.round(Number(confidence) || 3)));
    // wrong, or right but unsure (1-2): tomorrow; otherwise the normal 1/3/7/14 step is kept
    return !correct || c <= 2 ? 1 : intervalDays;
  }

  // ---------- Phase 2 checks ----------
  /** Result-set reasoning, join comparison, find the difference: the rows picked (by key) are exactly the right ones. */
  function checkRowPick(picked, right) {
    var a = (picked || []).map(String), b = (right || []).map(String);
    var inB = {}; b.forEach(function (x) { inB[x] = 1; });
    var inA = {}; a.forEach(function (x) { inA[x] = 1; });
    var missing = b.filter(function (x) { return !inA[x]; }), extra = a.filter(function (x) { return !inB[x]; });
    return { right: !missing.length && !extra.length, missing: missing, extra: extra };
  }
  /** Find the difference: the two queries' tokens, each marked when it isn't in the other query (LCS over tokens). */
  function tokenDiff(a, b) {
    var tok = function (s) { return String(s || "").match(/'(?:[^']|'')*'|\w+|[^\s\w]/g) || []; };
    var x = tok(a), y = tok(b), n = x.length, m = y.length, L = [];
    for (var i = 0; i <= n; i++) { L.push(new Array(m + 1).fill(0)); }
    for (i = n - 1; i >= 0; i--) for (var j = m - 1; j >= 0; j--) L[i][j] = x[i].toLowerCase() === y[j].toLowerCase() ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    var ka = [], kb = [];
    i = 0; j = 0;
    while (i < n && j < m) {
      if (x[i].toLowerCase() === y[j].toLowerCase()) { ka.push({ t: x[i], changed: false }); kb.push({ t: y[j], changed: false }); i++; j++; }
      else if (L[i + 1][j] >= L[i][j + 1]) ka.push({ t: x[i++], changed: true });
      else kb.push({ t: y[j++], changed: true });
    }
    while (i < n) ka.push({ t: x[i++], changed: true });
    while (j < m) kb.push({ t: y[j++], changed: true });
    return { a: ka, b: kb };
  }
  /** Execution timeline: the distinct real states as options; the state after statement `step` is the right one. */
  function timelineOptions(card, step) {
    var snaps = card.snapshots || [], key = function (s) { return JSON.stringify(s.rows); };
    var right = snaps[step - 1];
    if (!right) return null;
    var seen = {}, out = [{ snap: right, right: true }];
    seen[key(right)] = 1;
    snaps.forEach(function (s) { if (!seen[key(s)] && out.length < 4) { seen[key(s)] = 1; out.push({ snap: s, right: false }); } });
    return out.length >= 2 ? shuffle(out, (card.id || "") + ":" + step) : null;
  }
  /** Schema detective: from the real per-column counts, the columns that identify every row (all distinct, no NULL). */
  function keyColumns(stats) {
    return (stats || []).filter(function (s) { return s.rows > 0 && s.distinct === s.rows && s.nulls === 0; }).map(function (s) { return s.column; });
  }
  function checkSchemaPick(column, card) {
    var keys = keyColumns(card.stats);
    return { right: keys.length === 1 && eq(column, keys[0]), key: keys[0] || null };
  }

  /** Sort and filter: the query assembled from the card's own pieces (the chosen filters joined by AND, one sort). */
  function assembleQuery(card, pick) {
    var f = (pick.filters || []).slice().sort(function (a, b) { return a - b; }).map(function (i) { return card.filters[i]; }).filter(Boolean);
    var s = pick.sort == null ? null : card.sorts[pick.sort];
    return "SELECT " + card.select + " FROM " + card.from + (f.length ? " WHERE " + f.join(" AND ") : "") + (s ? " ORDER BY " + s : "");
  }

  /** Query optimizer: SQLite's EXPLAIN QUERY PLAN lines in plain words (one sentence per step). */
  function planStep(d) {
    var m;
    d = String(d || "").trim();
    if ((m = d.match(/^SCAN (\w+)$/i))) return "Reads every row of " + m[1] + " (full scan)";
    if ((m = d.match(/^SCAN (\w+) USING COVERING INDEX (\w+)$/i))) return "Reads all of index " + m[2] + " (covering: the table itself isn't read)";
    if ((m = d.match(/^SCAN (\w+) USING INDEX (\w+)$/i))) return "Reads all of " + m[1] + " in the order of index " + m[2];
    if ((m = d.match(/^SEARCH (\w+) USING COVERING INDEX (\w+) \((.+)\)$/i))) return "Looks up only index " + m[2] + " (" + m[3] + "), covering: the table itself isn't read";
    if ((m = d.match(/^SEARCH (\w+) USING INDEX (\w+) \((.+)\)$/i))) return "Looks up the matching rows of " + m[1] + " through index " + m[2] + " (" + m[3] + ")";
    if ((m = d.match(/^SEARCH (\w+) USING INTEGER PRIMARY KEY \((.+)\)$/i))) return "Looks up rows of " + m[1] + " by its primary key (" + m[2] + ")";
    if ((m = d.match(/^USE TEMP B-TREE FOR (.+)$/i))) return "sorts the rows in a temporary B-tree for " + m[1];
    return d;
  }
  function planText(details) { return (details || []).map(planStep).join("; then "); }
  /** The real plan with the index is right; the plan without it and plausible other access paths are the wrong choices. */
  function optimizerOptions(card) {
    var t = card.table, i = card.index_name, col = card.index_columns && card.index_columns[0], after = card.plan_after || [];
    var temp = after.filter(function (d) { return /^USE TEMP B-TREE/i.test(d); }), noTemp = function (x) { return x.filter(function (d) { return !/^USE TEMP B-TREE/i.test(d); }); };
    var cands = [after, card.plan_before || [],
      ["SCAN " + t].concat(temp), ["SEARCH " + t + " USING INDEX " + i + " (" + col + "=?)"], ["SCAN " + t + " USING COVERING INDEX " + i],
      ["SEARCH " + t + " USING COVERING INDEX " + i + " (" + col + "=?)"], noTemp(after).concat(temp.length ? [] : ["USE TEMP B-TREE FOR ORDER BY"])];
    var seen = {}, out = [];
    cands.forEach(function (c, k) { var txt = planText(c); if (!c.length || seen[txt] || out.length >= 4) return; seen[txt] = 1; out.push({ text: txt, right: k === 0 }); });
    return out.length >= 2 ? shuffle(out, (card.id || "") + ":plan") : null;
  }
  /** Does the plan use the card's index at all? (the index may not help: the planner decides, never "always") */
  function usesIndex(details, name) { return (details || []).some(function (d) { return new RegExp("\\bINDEX " + name + "\\b", "i").test(d); }); }

  /**
   * Mistake reflection: a diagnosis of the learner's real last attempt, from the same result comparison as the Check
   * (no AI). expected/got: { columns, rows, count? }. Returns { kind, facts: [...], options: [{ text, right }] }.
   */
  var MISTAKES = {
    columns: "I returned the wrong columns (one missing, one extra, or a different expression)",
    extra: "My filter let in rows it should have left out (the condition is too loose)",
    missing: "My filter or join dropped rows it should have kept (the condition is too strict)",
    duplicates: "My query repeated rows (DISTINCT is missing, or a join multiplied them)",
    rows: "My query picked partly the wrong rows or computed different values",
    order: "I had the right rows in the wrong order (ORDER BY is missing or wrong)",
    error: "My query didn't run (a syntax error or a wrong table or column name)",
  };
  function diagnoseAttempt(a, seed) {
    var exp = a.expected, got = a.got, facts = [], kind;
    var pl = function (n, w) { return n + " " + w + (n === 1 ? "" : "s"); };
    if (a.error || !got) { kind = "error"; facts.push("Your query failed: " + String(a.error || "no result table").slice(0, 200)); }
    else {
      var en = exp.count != null ? exp.count : exp.rows.length, gn = got.count != null ? got.count : got.rows.length;
      facts.push("Your result: " + pl(gn, "row") + " × " + pl(got.columns.length, "column") + "; the answer: " + pl(en, "row") + " × " + pl(exp.columns.length, "column") + ".");
      if (got.columns.length !== exp.columns.length) { kind = "columns"; facts.push("The answer's columns: " + exp.columns.join(", ") + "; yours: " + got.columns.join(", ") + "."); }
      else {
        var key = function (r) { return JSON.stringify(r.map(SqlCompare.cell)); }, bag = {}, extra = [], seenGot = {};
        exp.rows.forEach(function (r) { var k = key(r); bag[k] = (bag[k] || 0) + 1; });
        var inExp = {}; exp.rows.forEach(function (r) { inExp[key(r)] = 1; });
        got.rows.forEach(function (r) { var k = key(r); seenGot[k] = (seenGot[k] || 0) + 1; if (bag[k]) bag[k]--; else extra.push(k); });
        var lost = Object.keys(bag).reduce(function (n, k) { return n + bag[k]; }, 0);
        var dupOnly = extra.length && extra.every(function (k) { return inExp[k]; });
        if (!extra.length && !lost) { kind = "order"; facts.push("Every row matches; only the order differs."); }
        else if (!lost && dupOnly) { kind = "duplicates"; facts.push(pl(extra.length, "row") + " of yours " + (extra.length === 1 ? "repeats" : "repeat") + " a row that is already in the answer."); }
        else if (!lost) { kind = "extra"; facts.push(pl(extra.length, "row") + " of yours " + (extra.length === 1 ? "isn't" : "aren't") + " in the answer; none of the answer's rows is missing."); }
        else if (!extra.length) { kind = "missing"; facts.push(pl(lost, "row") + " of the answer " + (lost === 1 ? "is" : "are") + " missing from yours; you have no extra rows."); }
        else {
          // every row different and other column names: most likely other columns, not other rows
          var names = function (c) { return c.map(function (x) { return String(x).toLowerCase(); }).sort().join(","); };
          kind = lost === exp.rows.length && extra.length === got.rows.length && names(exp.columns) !== names(got.columns) ? "columns" : "rows";
          facts.push(pl(lost, "row") + " of the answer " + (lost === 1 ? "is" : "are") + " missing and " + pl(extra.length, "row") + " of yours " + (extra.length === 1 ? "isn't" : "aren't") + " in the answer.");
          if (kind === "columns") facts.push("The answer's columns: " + exp.columns.join(", ") + "; yours: " + got.columns.join(", ") + ".");
        }
      }
    }
    var others = Object.keys(MISTAKES).filter(function (k) { return k !== kind && k !== "error"; });
    var opts = [{ kind: kind, text: MISTAKES[kind], right: true }].concat(shuffle(others, (seed || "") + ":m").slice(0, 3).map(function (k) { return { kind: k, text: MISTAKES[k], right: false }; }));
    return { kind: kind, misconception: MISTAKES[kind], facts: facts, options: shuffle(opts, (seed || "") + ":o") };
  }

  function shuffle(list, id) {
    var h = 2166136261, s = String(id);
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    var rnd = function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
    var a = list.slice();
    for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)); var t = a[k]; a[k] = a[j]; a[j] = t; }
    return a;
  }

  return { TYPES: TYPES, STANDALONE: STANDALONE, UPGRADES: UPGRADES, cardTypeOf: cardTypeOf, rendererOf: rendererOf, normAns: normAns, checkBlank: checkBlank, isReadOnlySql: isReadOnlySql, checkFix: checkFix, sortsRows: sortsRows, diagnosisOptions: diagnosisOptions, checkJoinMapper: checkJoinMapper, compareOptions: compareOptions, rowDiff: rowDiff, pickChallenge: pickChallenge, confidenceDays: confidenceDays, shuffle: shuffle, checkRowPick: checkRowPick, tokenDiff: tokenDiff, timelineOptions: timelineOptions, keyColumns: keyColumns, checkSchemaPick: checkSchemaPick, assembleQuery: assembleQuery, planStep: planStep, planText: planText, optimizerOptions: optimizerOptions, usesIndex: usesIndex, MISTAKES: MISTAKES, diagnoseAttempt: diagnoseAttempt };
});
