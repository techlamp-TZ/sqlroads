// Review mistakes: the 1 / 3 / 7-day schedule. Runs on a throwaway copy of the database.
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const os = require("node:os");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const copy = path.join(os.tmpdir(), `sqldrills-review-test-${process.pid}.sqlite`);
if (fs.existsSync(copy)) fs.unlinkSync(copy);
new DatabaseSync(path.join(__dirname, "..", "data.sqlite"), { readOnly: true }).exec(`VACUUM INTO '${copy.replace(/'/g, "''")}'`);
process.env.SQLDRILLS_DB = copy;
const db = require("../db.js");
const lib = require("../library/library.js");
lib.build();
const id = lib.get().active.find((i) => i.kind === "sqlite").id;
const DAY = 864e5, t0 = Date.UTC(2026, 9, 1, 9);
const entry = () => db.prepare("SELECT stage, due_at, reason FROM review_queue WHERE item_id = ?").get(id);
test.after(() => { try { db.close(); fs.unlinkSync(copy); } catch {} });

test("a failure enters the queue, due after 1 day", () => {
  db.exec("DELETE FROM review_queue");
  lib.reviewAfterAttempt(id, false, 0, t0);
  assert.deepStrictEqual({ ...entry() }, { stage: 1, due_at: new Date(t0 + DAY).toISOString(), reason: "failed" });
});

test("a clean solve before it is due changes nothing", () => {
  lib.reviewAfterAttempt(id, true, 0, t0 + DAY / 2);
  assert.strictEqual(entry().stage, 1);
});

test("clean solves at the reviews move it to 3 days, then 7 days, then out", () => {
  lib.reviewAfterAttempt(id, true, 0, t0 + DAY);
  assert.deepStrictEqual([entry().stage, entry().due_at], [2, new Date(t0 + DAY + 3 * DAY).toISOString()]);
  lib.reviewAfterAttempt(id, true, 0, t0 + 4 * DAY);
  assert.deepStrictEqual([entry().stage, entry().due_at], [3, new Date(t0 + 4 * DAY + 7 * DAY).toISOString()]);
  lib.reviewAfterAttempt(id, true, 0, t0 + 11 * DAY);
  assert.strictEqual(entry(), undefined);
});

test("solving with a hint enters the queue; a hint at a review starts it again", () => {
  lib.reviewAfterAttempt(id, true, 2, t0);
  assert.strictEqual(entry().reason, "solved with a hint");
  lib.reviewAfterAttempt(id, true, 0, t0 + DAY);
  assert.strictEqual(entry().stage, 2);
  lib.reviewAfterAttempt(id, true, 1, t0 + 4 * DAY);
  assert.strictEqual(entry().stage, 1);
});

test("the list splits due from upcoming", () => {
  const l = lib.reviewList(t0 + 6 * DAY);
  assert.strictEqual(l.due.length, 1);
  assert.strictEqual(lib.reviewList(t0 + 4.5 * DAY).due.length, 0);
});
