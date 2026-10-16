// "Predict the end state" rules (admin/endstate-rules.js): wrong choices are the shown script with one edit, and a
// choice may only name what the learner can see in the shown script.
const test = require("node:test");
const assert = require("node:assert");
const E = require("../admin/endstate-rules.js");

const TRUNCATE = "CREATE TABLE users (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(10)); INSERT INTO users (name) VALUES ('Alice'), ('Bob'); TRUNCATE TABLE users; INSERT INTO users (name) VALUES ('Carol'), ('Dave');";
const UNIQUE = "CREATE TABLE users (id INT PRIMARY KEY, email VARCHAR(50), nickname VARCHAR(50)); INSERT INTO users VALUES (1, 'a@example.com', 'nick1'); ALTER TABLE users ADD UNIQUE (email); INSERT INTO users VALUES (5, 'a@example.com', 'nick5');";
const err = (failsAt, error) => ({ kind: "error", failsAt, error });
const rows = (columns, r) => ({ kind: "rows", rows: { columns, rows: r } });

test("an edit replaces exactly one statement: the statement count and numbering stay the same", () => {
  const p = { script: TRUNCATE, check_sql: "SELECT * FROM users ORDER BY id", mode: "table" };
  const v = E.applyEdit(p, { statement: 3, sql: "DELETE FROM users" });
  assert.strictEqual(E.statementsOf(v.script).length, 4);
  assert.match(E.statementsOf(v.script)[2], /^DELETE FROM users$/);
  assert.strictEqual(v.check, p.check_sql);
  // invalid edits: out of range, two statements, no change, a check-query edit in error mode
  assert.strictEqual(E.applyEdit(p, { statement: 5, sql: "DELETE FROM users" }), null);
  assert.strictEqual(E.applyEdit(p, { statement: 3, sql: "DELETE FROM users; DROP TABLE users" }), null);
  assert.strictEqual(E.applyEdit(p, { statement: 3, sql: "TRUNCATE   TABLE users" }), null);
  assert.strictEqual(E.applyEdit({ ...p, mode: "error" }, { check_sql: "SELECT 1" }), null);
  assert.ok(E.applyEdit(p, { check_sql: "SELECT name FROM users ORDER BY id" }));
});

test("a stored full script counts as a variant only with the same statement count", () => {
  const p = { script: TRUNCATE, check_sql: "SELECT * FROM users" };
  assert.ok(E.legacyVariant(TRUNCATE.replace("TRUNCATE TABLE users", "DELETE FROM users"), p));
  assert.strictEqual(E.legacyVariant("DROP TABLE IF EXISTS users; " + TRUNCATE, p), null);
});

test("choices naming a statement, value, table or column not in the shown script are rejected", () => {
  // the held-back drafts: "Statement 1 fails: table doesn't exist" came from another script; 'c@example.com' isn't shown
  assert.strictEqual(E.ungrounded(err(1, "Table 'sqlscratch_mv9955e9_93c1033d6a.users' doesn't exist"), TRUNCATE, ""), null, "statement 1 exists and names only users");
  assert.match(E.ungrounded(err(6, "Duplicate entry 'c@example.com' for key 'users.email'"), UNIQUE, ""), /names statement 6/);
  assert.match(E.ungrounded(err(4, "Duplicate entry 'c@example.com' for key 'users.email'"), UNIQUE, ""), /c@example\.com/);
  assert.match(E.ungrounded(rows(["id", "name"], [[1, "Zed"]]), TRUNCATE, "SELECT * FROM users"), /Zed/);
  assert.match(E.ungrounded(rows(["id", "total"], [[1, 5]]), TRUNCATE, "SELECT * FROM users"), /column total/);
  // a syntax error comes from a broken edit, not a misunderstanding
  assert.match(E.ungrounded(err(3, "You have an error in your SQL syntax; check the manual"), TRUNCATE, ""), /syntax error/);
  assert.match(E.ungrounded(err(3, 'syntax error at or near "TABLE"'), TRUNCATE, ""), /syntax error/);
});

test("choices built only from what the script shows pass, including generated key names and computed numbers", () => {
  assert.strictEqual(E.ungrounded(err(4, "Duplicate entry 'a@example.com' for key 'users.email'"), UNIQUE, ""), null);
  assert.strictEqual(E.ungrounded(err(4, "Duplicate entry '1' for key 'users.PRIMARY'"), UNIQUE, ""), null);
  assert.strictEqual(E.ungrounded(err(3, 'duplicate key value violates unique constraint "users_email_key"'), UNIQUE, ""), null);
  assert.strictEqual(E.ungrounded(rows(["id", "name"], [[3, "Carol"], [4, "Dave"], [5, null]]), TRUNCATE, "SELECT * FROM users"), null);
  assert.strictEqual(E.ungrounded({ kind: "noerror" }, TRUNCATE, ""), null);
  // an apostrophe inside a word is not a quote: only 'users' is a name here
  assert.strictEqual(E.ungrounded(err(3, "You can't specify target table 'users' for update in FROM clause"), TRUNCATE, ""), null);
  assert.strictEqual(E.ungrounded(err(1, "Table 'users' doesn't exist"), TRUNCATE, ""), null);
});
