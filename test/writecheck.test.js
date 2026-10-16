// End-state comparison for write-query drills (no database needed: states are plain objects).
const test = require("node:test");
const assert = require("node:assert");
const { compareStates } = require("../library/writecheck.js");

const table = (rows, extra = {}) => ({
  columns: [{ name: "id", type: "int", nullable: false, default: null, auto: false }, { name: "title", type: "text", nullable: true, default: null, auto: false }],
  primary: ["id"], unique: [], foreign: [], checks: [], indexes: [], rows, ...extra,
});

test("same end state is the same, whatever SQL produced it", () => {
  const a = { "table:games": table(['[1,"Chess"]', '[2,"Go"]']) };
  const b = { "table:games": table(['[1,"Chess"]', '[2,"Go"]']) };
  assert.deepStrictEqual(compareStates(a, b), { same: true, why: [] });
});

test("different rows are reported with counts", () => {
  const r = compareStates({ "table:games": table(['[1,"Chess"]', '[2,"Go"]']) }, { "table:games": table(['[1,"Chess"]', '[2,"Shogi"]']) });
  assert.strictEqual(r.same, false);
  assert.match(r.why[0], /2 rows after your SQL, 2 expected; 1 expected row is missing or different/);
});

test("structure: a missing NOT NULL and a missing key are named", () => {
  const exp = table([], {});
  const got = table([], { primary: [], columns: [exp.columns[0], { ...exp.columns[1] }].map((c, k) => (k === 0 ? { ...c, nullable: true } : c)) });
  const r = compareStates({ "table:wish": exp }, { "table:wish": got });
  assert.ok(r.why.some((w) => /column id should be NOT NULL/.test(w)), r.why.join("; "));
  assert.ok(r.why.some((w) => /primary key/.test(w)), r.why.join("; "));
});

test("changing a table the task leaves alone, or leaving one it changes, is reported", () => {
  const r = compareStates({ "table:games": table(['[1,"Chess"]']) }, { "table:players": table(['[1,"Ann"]']) });
  assert.ok(r.why.some((w) => /games: the task changes it, your SQL leaves it as it was/.test(w)));
  assert.ok(r.why.some((w) => /players: you changed it, the task leaves it as it was/.test(w)));
});

test("dropped objects", () => {
  assert.strictEqual(compareStates({ "view:v1": null }, { "view:v1": null }).same, true);
  assert.match(compareStates({ "view:v1": null }, {}).why[0], /the task removes it/);
});

test("free values ('a game of your choosing'): only structure and row counts count", () => {
  const exp = { "table:games": table(['[1,"Chess"]', '[21,"Mystery Manor"]']) };
  const got = { "table:games": table(['[1,"Chess"]', '[99,"Nebula Riders"]']) };
  assert.strictEqual(compareStates(exp, got).same, false);
  assert.strictEqual(compareStates(exp, got, { freeValues: true }).same, true);
  assert.strictEqual(compareStates(exp, { "table:games": table(['[1,"Chess"]']) }, { freeValues: true }).same, false);
});

test("views: same rows with the columns in another order are the same view", () => {
  const v = (rows) => ({ columns: 2, rows: rows.map((r) => JSON.stringify(r)).sort() });
  assert.strictEqual(compareStates({ "view:cheap": v([["Pen", "1.5"], ["Cup", "3"]]) }, { "view:cheap": v([["1.5", "Pen"], ["3", "Cup"]]) }).same, true);
  assert.strictEqual(compareStates({ "view:cheap": v([["Pen", "1.5"], ["Cup", "3"]]) }, { "view:cheap": v([["Pen", "1.5"]]) }).same, false);
});

test("trigger drills: behaviour after the test statements counts, not only the trigger's shape", () => {
  const { compareRuns } = require("../library/writecheck.js");
  const trig = { "trigger:employees:before:insert": { exists: true } };
  const exp = { changed: trig, probed: { "table:employees": table(['[9001,"user@example.com"]']) } };
  // right shape, wrong body: the inserted email isn't lower-cased
  const wrong = compareRuns(exp, { changed: trig, probed: { "table:employees": table(['[9001,"User@Example.com"]']) } });
  assert.strictEqual(wrong.same, false);
  assert.match(wrong.why[0], /^after the test statements: table employees/);
  assert.strictEqual(compareRuns(exp, { changed: trig, probed: exp.probed }).same, true);
  assert.match(compareRuns(exp, { changed: trig, probeError: "Column 'email' cannot be null" }).why[0], /test statements .* failed after your SQL/);
  // drills without a behaviour test compare the end state only
  assert.strictEqual(compareRuns({ changed: trig }, { changed: trig, probed: { "table:x": table([]) } }).same, true);
});

test("CALL drills: the returned rows are compared like a SELECT (columns in any order, names ignored)", () => {
  const { compareRuns } = require("../library/writecheck.js");
  const exp = { changed: {}, result: { columns: ["title", "genre"], rows: [["Dune", "SF"], ["Emma", "Classic"]], count: 2 } };
  assert.strictEqual(compareRuns(exp, { changed: {}, result: { columns: ["g", "t"], rows: [["Classic", "Emma"], ["SF", "Dune"]], count: 2 } }).same, true);
  assert.strictEqual(compareRuns(exp, { changed: {}, result: { columns: ["title", "genre"], rows: [["Dune", "SF"]], count: 1 } }).same, false);
  assert.match(compareRuns(exp, { changed: {} }).why[0], /returned no rows/);
  // changing data instead of only reading it is wrong here
  assert.strictEqual(compareRuns(exp, { changed: { "table:books": table([]) }, result: exp.result }).same, false);
});

test("write drills with several accepted answers: any match is correct, otherwise the closest explains", () => {
  const { compareRunsBest } = require("../library/writecheck.js");
  const A = { changed: { "table:games": table(['[1,"Chess"]', '[2,"Go"]']) } };
  const B = { changed: { "table:games": table(['[1,"Chess"]', '[2,"Shogi"]']) } };
  const learnerB = { changed: { "table:games": table(['[1,"Chess"]', '[2,"Shogi"]']) } };
  assert.strictEqual(compareRunsBest([A, B], learnerB).same, true);
  assert.strictEqual(compareRunsBest([A, B], learnerB).index, 1);
  assert.strictEqual(compareRunsBest([A], learnerB).same, false);
});
