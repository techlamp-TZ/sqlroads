// The shared card engine (public/cards.js): one test per card type of Phase 1, plus regression tests that the
// existing items keep their behaviour (types, renderers, mastery flags, the flashcard answer check).
const test = require("node:test");
const assert = require("node:assert");
const C = require("../public/cards.js");

test("regression: existing items map to their card types, renderers and mastery flags, unchanged", () => {
  assert.strictEqual(C.cardTypeOf("flashcard", { type: "keyword" }), "recall");
  assert.strictEqual(C.cardTypeOf("flashcard", { type: "blank" }), "syntax_builder");
  assert.strictEqual(C.cardTypeOf("flashcard", { type: "order" }), "query_ordering");
  assert.strictEqual(C.cardTypeOf("flashcard", { type: "error" }), "spot_bug");
  assert.strictEqual(C.cardTypeOf("predict", {}), "predict");
  assert.strictEqual(C.cardTypeOf("mcq", {}), "mcq");
  assert.strictEqual(C.cardTypeOf("drill", {}), "query_translation");
  // the flashcard types that count for Memorize still count; the new types never do (user decision)
  for (const t of ["recall", "syntax_builder", "query_ordering", "spot_bug", "predict"]) assert.strictEqual(C.TYPES[t].counts, true, t);
  for (const t of ["join_mapper", "compare_queries", "challenge"]) assert.strictEqual(C.TYPES[t].counts, false, t);
  assert.deepStrictEqual(["recall", "syntax_builder", "predict", "join_mapper", "compare_queries"].map(C.rendererOf), ["recall", "code", "result", "result", "result"]);
});

test("#2 syntax builder: the old exact check is unchanged; accepted alternatives pass once approved", () => {
  const card = { answer: "SELECT" };
  assert.ok(C.checkBlank(" select ", card));
  assert.ok(C.checkBlank("SELECT;", card));
  assert.ok(!C.checkBlank("SELECT DISTINCT", card));
  assert.ok(!C.checkBlank("", card));
  const up = { answer: "COUNT(*)", accepted: ["count( * )", "COUNT(1)"] };
  assert.ok(C.checkBlank("count(1)", up));
  assert.ok(!C.checkBlank("SUM(1)", up));
});

test("#6 spot the bug: any fix with the same real result passes; only one read-only statement may run", () => {
  const fixed = { columns: ["name"], rows: [["Ann"], ["Bo"]] };
  assert.ok(C.checkFix({ columns: ["NAME"], rows: [["Bo"], ["Ann"]] }, fixed, false).ok, "same rows, other order, unsorted task");
  assert.ok(!C.checkFix({ columns: ["name"], rows: [["Bo"], ["Ann"]] }, fixed, true).ok, "order counts when the fix sorts");
  assert.ok(!C.checkFix({ columns: ["name"], rows: [["Ann"]] }, fixed, false).ok);
  assert.ok(C.isReadOnlySql("SELECT name FROM guests;"));
  assert.ok(C.isReadOnlySql("WITH x AS (SELECT 1) SELECT * FROM x"));
  assert.ok(C.isReadOnlySql("SELECT 'a;b' FROM t"));
  assert.ok(!C.isReadOnlySql("SELECT 1; DROP TABLE t"));
  assert.ok(!C.isReadOnlySql("DELETE FROM guests"));
  assert.ok(C.sortsRows("SELECT * FROM t ORDER BY a") && !C.sortsRows("SELECT RANK() OVER (ORDER BY a) FROM t"));
  // diagnosis choice: the card's own explanation + other errors' explanations, no duplicates, stable order
  const card = { explanation: "FROM is missing." };
  const pool = [{ explanation: "A comma is missing between columns." }, { explanation: "FROM is missing." }, { explanation: "The alias is used in WHERE." }, { explanation: "The string isn't quoted." }];
  const o = C.diagnosisOptions(card, pool, "fc-1");
  assert.strictEqual(o.length, 4);
  assert.strictEqual(o.filter((x) => x.right).length, 1);
  assert.strictEqual(new Set(o.map((x) => x.text)).size, 4);
  assert.deepStrictEqual(C.diagnosisOptions(card, pool, "fc-1"), o);
  assert.strictEqual(C.diagnosisOptions(card, [{ explanation: "x" }], "fc-1"), null, "too few other diagnoses: no choice shown");
});

test("#7 MCQ: the type and renderer exist; it stays outside mastery as before", () => {
  assert.strictEqual(C.TYPES.mcq.renderer, "recall");
  assert.strictEqual(C.UPGRADES.mcq_upgrade, "mcq");
});

test("#8 join mapper: the key pair in either order and the join type must both be right", () => {
  const card = { key: { left: "students.student_id", right: "results.student_id" }, join_type: "LEFT" };
  assert.deepStrictEqual(C.checkJoinMapper({ left: "results.student_id", right: "students.student_id", join: "left" }, card), { right: true, keyRight: true, typeRight: true });
  assert.deepStrictEqual(C.checkJoinMapper({ left: "students.student_id", right: "results.result_id", join: "LEFT" }, card), { right: false, keyRight: false, typeRight: true });
  assert.deepStrictEqual(C.checkJoinMapper({ left: "students.student_id", right: "results.student_id", join: "INNER" }, card), { right: false, keyRight: true, typeRight: false });
});

test("#12 compare two queries: four distinct statements, exactly one true, built from the real results", () => {
  const card = { id: "cd-1", result_a: { rows: [[1], [1], [2]] }, result_b: { rows: [[1], [2]] } };
  const o = C.compareOptions(card);
  assert.strictEqual(o.length, 4);
  assert.strictEqual(o.filter((x) => x.right).length, 1);
  assert.strictEqual(o.find((x) => x.right).text, "Query A returns 3 rows, query B returns 2");
  assert.strictEqual(new Set(o.map((x) => x.text)).size, 4);
  const same = C.compareOptions({ id: "cd-2", result_a: { rows: [[1], [2]] }, result_b: { rows: [[2], [1]] } });
  assert.strictEqual(same.find((x) => x.right).text, "Both return the same 2 rows");
  assert.deepStrictEqual(C.rowDiff([[1], [1], [2]], [[1], [2]]), { onlyA: [1], onlyB: [] });
  // queries that differ in their columns (SELECT id, name vs SELECT *): the options name columns too
  const cols = C.compareOptions({ id: "cd-3", result_a: { columns: ["id", "name"], rows: [[1, "a"], [2, "b"], [3, "c"]] }, result_b: { columns: ["id", "name", "dept"], rows: [[1, "a", "x"], [2, "b", "x"], [3, "c", "y"]] } });
  assert.strictEqual(cols.find((x) => x.right).text, "Query A returns 3 rows of 2 columns, query B returns 3 rows of 3 columns");
  assert.strictEqual(cols.length, 4);
  assert.strictEqual(new Set(cols.map((x) => x.text)).size, 4);
});

test("#20 challenge: a due item first (longest overdue), else the weakest concept; confidence 1-5 shapes the next review", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  const cands = [
    { ref: "fc-a", kind: "flashcard", concept: "x", due_at: "2026-10-14T12:00:00Z" },
    { ref: "fc-b", kind: "flashcard", concept: "y", due_at: "2026-10-10T12:00:00Z" },
    { ref: "po-c", kind: "predict", concept: "z", weakness: 3 },
  ];
  assert.strictEqual(C.pickChallenge(cands, now).ref, "fc-b");
  assert.strictEqual(C.pickChallenge(cands.slice(2), now).why, "weakest");
  assert.strictEqual(C.pickChallenge([], now), null);
  assert.strictEqual(C.confidenceDays(7, 5, true), 7);
  assert.strictEqual(C.confidenceDays(7, 2, true), 1, "right but unsure: tomorrow");
  assert.strictEqual(C.confidenceDays(7, 5, false), 1, "wrong: tomorrow, like other flashcards");
});

test("regression: Phase 2 adds optional types only; Phase 1 types and existing items are unchanged", () => {
  for (const t of ["result_set", "join_compare", "find_difference", "exec_timeline", "schema_detective"]) {
    assert.strictEqual(C.TYPES[t].counts, false, t);
    assert.strictEqual(C.TYPES[t].renderer, "result", t);
    assert.ok(C.STANDALONE.includes(t), t);
  }
  assert.deepStrictEqual(["join_mapper", "compare_queries"].map((t) => C.STANDALONE.includes(t)), [true, true]);
  assert.strictEqual(C.cardTypeOf("flashcard", { type: "error" }), "spot_bug");
  assert.strictEqual(C.TYPES.spot_bug.counts, true);
});

test("#5 result-set reasoning: exactly the matching rows, by key, in any order", () => {
  assert.deepStrictEqual(C.checkRowPick([3, 1], ["1", "3"]), { right: true, missing: [], extra: [] });
  assert.deepStrictEqual(C.checkRowPick([1], [1, 3]), { right: false, missing: ["3"], extra: [] });
  assert.deepStrictEqual(C.checkRowPick([1, 2, 3], [1, 3]), { right: false, missing: [], extra: ["2"] });
  assert.ok(C.checkRowPick([], []).right, "no matching rows, none picked");
});

test("#9 join comparison: the unmatched rows a join type adds are picked by key", () => {
  // LEFT JOIN adds the students with no result: ids 3 and 4
  assert.ok(C.checkRowPick(["4", "3"], [3, 4]).right);
  assert.ok(!C.checkRowPick(["3"], [3, 4]).right);
});

test("#13 find the difference: the changed tokens are marked on both sides, nothing else", () => {
  const d = C.tokenDiff("SELECT * FROM t WHERE a > 1 AND b = 'x y'", "SELECT * FROM t WHERE a > 1 OR b = 'x y'");
  assert.deepStrictEqual(d.a.filter((x) => x.changed).map((x) => x.t), ["AND"]);
  assert.deepStrictEqual(d.b.filter((x) => x.changed).map((x) => x.t), ["OR"]);
  assert.strictEqual(d.a.find((x) => /^'/.test(x.t)).t, "'x y'", "a quoted string stays one token");
  assert.strictEqual(C.tokenDiff("SELECT 1", "select 1").a.filter((x) => x.changed).length, 0, "case doesn't count as a change");
});

test("#15 execution timeline: options are the distinct real states; the state after step N is right", () => {
  const card = { id: "cd-t", snapshots: [{ rows: [[1, 100]] }, { rows: [[1, 50]] }, { rows: [[1, 100]] }] };
  const o = C.timelineOptions(card, 3);
  assert.strictEqual(o.length, 2, "the rolled-back state equals the first: only 2 distinct states");
  assert.deepStrictEqual(o.find((x) => x.right).snap.rows, [[1, 100]]);
  assert.strictEqual(C.timelineOptions({ snapshots: [{ rows: [[1]] }, { rows: [[1]] }] }, 2), null, "one state only: no question");
});

test("#16 schema detective: the key is the only column with all values distinct and no NULL", () => {
  const stats = [{ column: "student_no", rows: 5, distinct: 5, nulls: 0 }, { column: "email", rows: 5, distinct: 4, nulls: 1 }, { column: "name", rows: 5, distinct: 4, nulls: 0 }];
  assert.deepStrictEqual(C.keyColumns(stats), ["student_no"]);
  assert.deepStrictEqual(C.checkSchemaPick("STUDENT_NO", { stats }), { right: true, key: "student_no" });
  assert.strictEqual(C.checkSchemaPick("email", { stats }).right, false);
  assert.strictEqual(C.checkSchemaPick("a", { stats: [{ column: "a", rows: 2, distinct: 2, nulls: 0 }, { column: "b", rows: 2, distinct: 2, nulls: 0 }] }).right, false, "two candidate keys: not a valid card");
});

test("regression: Phase 3 adds optional types only; earlier types, renderers and mastery flags are unchanged", () => {
  for (const t of ["sort_filter", "query_optimizer", "mistake_reflection"]) assert.strictEqual(C.TYPES[t].counts, false, t);
  assert.deepStrictEqual(["sort_filter", "query_optimizer", "mistake_reflection"].map(C.rendererOf), ["scenario", "result", "scenario"]);
  assert.ok(C.STANDALONE.includes("sort_filter") && C.STANDALONE.includes("query_optimizer"));
  assert.ok(!C.STANDALONE.includes("mistake_reflection"), "built from the learner's attempt, never stored as an item");
  for (const t of ["recall", "syntax_builder", "query_ordering", "spot_bug", "predict"]) assert.strictEqual(C.TYPES[t].counts, true, t);
  for (const t of ["result_set", "join_compare", "find_difference", "exec_timeline", "schema_detective"]) assert.ok(C.STANDALONE.includes(t), t);
});

test("#14 sort and filter: only the card's own pieces are assembled, filters by AND in a stable order, one sort", () => {
  const card = { select: "name, marks", from: "students", filters: ["status = 'active'", "marks > 70", "marks >= 70"], sorts: ["marks DESC", "marks ASC", "name"] };
  assert.strictEqual(C.assembleQuery(card, { filters: [1, 0], sort: 0 }), "SELECT name, marks FROM students WHERE status = 'active' AND marks > 70 ORDER BY marks DESC");
  assert.strictEqual(C.assembleQuery(card, { filters: [], sort: null }), "SELECT name, marks FROM students");
  assert.strictEqual(C.assembleQuery(card, { filters: [9], sort: 7 }), "SELECT name, marks FROM students", "unknown pieces are ignored");
  assert.ok(C.isReadOnlySql(C.assembleQuery(card, { filters: [0, 1, 2], sort: 2 })));
  // the result is compared in order (a sort is part of the task)
  const exp = { columns: ["name", "marks"], rows: [["Ann", 90], ["Bo", 80]] };
  assert.ok(C.checkFix({ columns: ["name", "marks"], rows: [["Ann", 90], ["Bo", 80]] }, exp, true).ok);
  assert.ok(!C.checkFix({ columns: ["name", "marks"], rows: [["Bo", 80], ["Ann", 90]] }, exp, true).ok, "the right rows in the wrong order are wrong");
});

test("#17 query optimizer: plain words for the real plan; the plan with the index is right, the plan without it is a choice", () => {
  assert.strictEqual(C.planText(["SCAN orders"]), "Reads every row of orders (full scan)");
  assert.strictEqual(C.planText(["SEARCH orders USING INDEX idx_cust (customer_id=?)"]), "Looks up the matching rows of orders through index idx_cust (customer_id=?)");
  assert.strictEqual(C.planText(["SCAN orders", "USE TEMP B-TREE FOR ORDER BY"]), "Reads every row of orders (full scan); then sorts the rows in a temporary B-tree for ORDER BY");
  const helps = { id: "cd-q1", table: "orders", index_name: "idx_cust", index_columns: ["customer_id"], plan_before: ["SCAN orders"], plan_after: ["SEARCH orders USING INDEX idx_cust (customer_id=?)"] };
  const o = C.optimizerOptions(helps);
  assert.ok(o.length >= 3 && o.length <= 4);
  assert.strictEqual(o.filter((x) => x.right).length, 1);
  assert.strictEqual(o.find((x) => x.right).text, C.planText(helps.plan_after));
  assert.ok(o.some((x) => x.text === C.planText(helps.plan_before)), "the plan without the index is offered");
  assert.strictEqual(new Set(o.map((x) => x.text)).size, o.length);
  // the index doesn't help (LIKE '%x'): the right answer is the unchanged full scan
  const noHelp = { id: "cd-q2", table: "orders", index_name: "idx_note", index_columns: ["note"], plan_before: ["SCAN orders"], plan_after: ["SCAN orders"] };
  const o2 = C.optimizerOptions(noHelp);
  assert.strictEqual(o2.find((x) => x.right).text, "Reads every row of orders (full scan)");
  assert.strictEqual(new Set(o2.map((x) => x.text)).size, o2.length);
  assert.ok(C.usesIndex(helps.plan_after, "idx_cust") && !C.usesIndex(noHelp.plan_after, "idx_note"));
});

test("#19 mistake reflection: the diagnosis comes from the real results (no AI), one right misconception", () => {
  const exp = { columns: ["name"], rows: [["Ann"], ["Bo"]] };
  const d = (got, extra) => C.diagnoseAttempt(Object.assign({ expected: exp, got }, extra), "it-1");
  assert.strictEqual(d({ columns: ["name"], rows: [["Ann"], ["Bo"], ["Cy"]] }).kind, "extra");
  assert.strictEqual(d({ columns: ["name"], rows: [["Ann"]] }).kind, "missing");
  assert.strictEqual(d({ columns: ["name"], rows: [["Ann"], ["Bo"], ["Bo"]] }).kind, "duplicates");
  assert.strictEqual(d({ columns: ["name"], rows: [["Bo"], ["Ann"]] }).kind, "order");
  assert.strictEqual(d({ columns: ["name", "id"], rows: [["Ann", 1], ["Bo", 2]] }).kind, "columns");
  assert.strictEqual(d({ columns: ["email"], rows: [["a@x"], ["b@x"]] }).kind, "columns", "other column, same count");
  assert.strictEqual(d({ columns: ["name"], rows: [["Ann"], ["Cy"]] }).kind, "rows");
  assert.strictEqual(d(null, { error: "no such column: nme" }).kind, "error");
  const r = d({ columns: ["name"], rows: [["Ann"], ["Bo"], ["Cy"]] });
  assert.strictEqual(r.options.length, 4);
  assert.strictEqual(r.options.filter((x) => x.right).length, 1);
  assert.strictEqual(r.options.find((x) => x.right).text, C.MISTAKES.extra);
  assert.match(r.facts.join(" "), /3 rows × 1 column; the answer: 2 rows/);
  assert.deepStrictEqual(d({ columns: ["name"], rows: [["Ann"], ["Bo"], ["Cy"]] }).options, r.options, "stable for the same attempt");
});
