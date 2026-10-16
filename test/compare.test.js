// node --test test/compare.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { compare, asksForOrder } = require("../public/compare.js");

const res = (columns, rows) => ({ columns, rows });

test("ignores column alias names and their case", () => {
  const expected = res(["name", "population"], [["France", 68000000], ["Italy", 59000000]]);
  assert.equal(compare(expected, res(["Country", "POP"], [["France", 68000000], ["Italy", 59000000]])).ok, true);
  assert.equal(compare(expected, res(["NAME", "Population"], [["France", 68000000], ["Italy", 59000000]])).ok, true);
  // values themselves stay case-sensitive
  assert.equal(compare(expected, res(["name", "population"], [["france", 68000000], ["Italy", 59000000]])).ok, false);
});

test("tolerates float rounding to 2 decimal places", () => {
  const expected = res(["name", "per_capita"], [["Brazil", 9673.123456], ["India", 2389.5]]);
  assert.equal(compare(expected, res(["n", "p"], [["Brazil", 9673.12], ["India", 2389.5]])).ok, true);
  assert.equal(compare(expected, res(["n", "p"], [["Brazil", 9673.1249], ["India", "2389.50"]])).ok, true); // numbers as text too
  assert.equal(compare(expected, res(["n", "p"], [["Brazil", 9673.13], ["India", 2389.5]])).ok, false); // a real difference
  assert.equal(compare(res(["x"], [[0.1 + 0.2]]), res(["x"], [[0.3]])).ok, true);
});

test("ignores row order unless the task asks for ORDER BY", () => {
  const expected = res(["name"], [["Austria"], ["Belgium"], ["Chile"]]);
  const shuffled = res(["name"], [["Chile"], ["Austria"], ["Belgium"]]);
  assert.equal(compare(expected, shuffled, false).ok, true);
  const ordered = compare(expected, shuffled, true);
  assert.equal(ordered.ok, false);
  assert.match(ordered.reason, /wrong order/);
  assert.equal(compare(expected, res(["name"], [["Austria"], ["Belgium"], ["Chile"]]), true).ok, true);
  // the task wording decides
  assert.equal(asksForOrder("List the countries, highest population first."), true);
  assert.equal(asksForOrder("Order the results by name."), true);
  assert.equal(asksForOrder("Show the name and continent of every country."), false);
});

test("treats NULL and the empty string as different values", () => {
  const withNull = res(["name", "dept"], [["Shrivell", null], ["Throd", 1]]);
  assert.equal(compare(withNull, res(["n", "d"], [["Shrivell", null], ["Throd", 1]])).ok, true);
  assert.equal(compare(withNull, res(["n", "d"], [["Shrivell", ""], ["Throd", 1]])).ok, false);
  assert.equal(compare(withNull, res(["n", "d"], [["Shrivell", "NULL"], ["Throd", 1]])).ok, false); // the text "NULL" isn't NULL
  assert.equal(compare(res(["x"], [[""]]), res(["x"], [[""]])).ok, true);
  assert.equal(compare(res(["x"], [[0]]), res(["x"], [[null]])).ok, false); // 0 isn't NULL either
});

test("reports the number of columns and rows that differ", () => {
  const expected = res(["a", "b"], [[1, 2], [3, 4]]);
  assert.match(compare(expected, res(["a"], [[1], [3]])).reason, /1 column; the answer has 2/);
  assert.match(compare(expected, res(["a", "b"], [[1, 2]])).reason, /returns 1 row; the answer has 2/);
  assert.match(compare(expected, res(["a", "b"], [[1, 2], [3, 5]])).reason, /1 row of yours isn't in the answer/);
});

test("accepts the right columns in a different order, and says so", () => {
  const expected = res(["name", "continent", "population"], [["France", "Europe", 68], ["Peru", "South America", 34]]);
  const swapped = compare(expected, res(["population", "name", "continent"], [[68, "France", "Europe"], [34, "Peru", "South America"]]));
  assert.equal(swapped.ok, true);
  assert.equal(swapped.columnsReordered, true);
  assert.match(swapped.reason, /columns in a different order/);
  // a wrong value is still wrong, whatever the column order
  assert.equal(compare(expected, res(["population", "name", "continent"], [[68, "France", "Europe"], [35, "Peru", "South America"]])).ok, false);
  // same order: no special message
  assert.equal(compare(expected, res(["n", "c", "p"], [["France", "Europe", 68], ["Peru", "South America", 34]])).columnsReordered, undefined);
  // reordered columns + rows in the wrong order on an ordered task
  const shuffled = res(["population", "name", "continent"], [[34, "Peru", "South America"], [68, "France", "Europe"]]);
  assert.equal(compare(expected, shuffled, true).ok, false);
  assert.equal(compare(expected, shuffled, false).ok, true);
});

test("clock drills: 'now' and CURRENT_DATE are frozen the same way for reference and learner", () => {
  const C = require("../public/compare.js");
  assert.strictEqual(C.freezeClock("SELECT julianday('now') - julianday(loan_date) FROM loans"), "SELECT julianday('2026-01-15 12:00:00') - julianday(loan_date) FROM loans");
  assert.strictEqual(C.freezeClock("SELECT date('now', '-30 days'), strftime('%Y', 'now'), CURRENT_DATE"), "SELECT date('2026-01-15 12:00:00', '-30 days'), strftime('%Y', '2026-01-15 12:00:00'), '2026-01-15'");
  assert.strictEqual(C.freezeClock("SELECT * FROM t WHERE note = 'now'"), "SELECT * FROM t WHERE note = 'now'");
  assert.strictEqual(C.usesClock("SELECT DATE('now')"), true);
  assert.strictEqual(C.usesClock("SELECT 1"), false);
});

test("random-sample drills: right columns, right count, every row from the pool", () => {
  const C = require("../public/compare.js");
  assert.deepStrictEqual(C.samplePool("SELECT title, artist FROM tracks ORDER BY RANDOM() LIMIT 2;"), { pool: "SELECT title, artist FROM tracks", limit: 2 });
  const pool = { columns: ["title", "artist"], rows: [["A", "x"], ["B", "y"], ["C", "z"]] };
  assert.strictEqual(C.compareSample(pool, 2, { columns: ["title", "artist"], rows: [["C", "z"], ["A", "x"]] }).ok, true);
  assert.strictEqual(C.compareSample(pool, 2, { columns: ["artist", "title"], rows: [["z", "C"], ["x", "A"]] }).ok, true);
  assert.match(C.compareSample(pool, 2, { columns: ["title", "artist"], rows: [["C", "z"]] }).reason, /returns 1 row; the answer returns 2/);
  assert.match(C.compareSample(pool, 2, { columns: ["title", "artist"], rows: [["C", "z"], ["Q", "q"]] }).reason, /1 row of yours isn't in the table/);
  assert.strictEqual(C.compareSample(pool, 2, { columns: ["title", "artist"], rows: [["A", "x"], ["A", "x"]] }).ok, false);
});

test("several accepted answers: Correct when the learner matches any of them", () => {
  const C = require("../public/compare.js");
  const A = { columns: ["name"], rows: [["Ann"], ["Bob"]], label: "A" };
  const B = { columns: ["name"], rows: [["Ann"], ["Bob"], ["Cy"]], label: "B" };
  const learnerB = { columns: ["n"], rows: [["Cy"], ["Ann"], ["Bob"]] };
  const both = C.compareBest([A, B], learnerB, false);
  assert.strictEqual(both.ok, true);
  assert.strictEqual(both.index, 1);
  assert.match(both.reason, /one of 2 accepted answers/);
  // only A accepted: the same result is not correct
  const onlyA = C.compareBest([A], learnerB, false);
  assert.strictEqual(onlyA.ok, false);
  assert.match(onlyA.reason, /returns 3 rows; the answer has 2/);
});

test("several accepted answers: a wrong result is compared with the closest one", () => {
  const C = require("../public/compare.js");
  const A = { columns: ["name", "pop"], rows: [["Ann", 1], ["Bob", 2]], label: "A" };
  const B = { columns: ["name"], rows: [["Ann"], ["Bob"], ["Cy"], ["Di"]], label: "B" };
  const wrong = { columns: ["name"], rows: [["Ann"], ["Bob"], ["Cy"]] };
  const r = C.compareBest([A, B], wrong, false);
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.closest, 1);
  assert.match(r.reason, /closest of 2 accepted answers \(B\): Your query returns 3 rows; the answer has 4: 1 expected row is missing/);
});
