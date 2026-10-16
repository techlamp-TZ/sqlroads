// Lessons (the Study step): the text rules (admin/lesson-rules.js).
const test = require("node:test");
const assert = require("node:assert");
const L = require("../admin/lesson-rules.js");

test("a lesson may not name a source, account or link", () => {
  for (const t of ["Follow @curious_.programmer", "see https://example.org", "from the SQL-101 guide", "posted on Telegram", "www.example.com"]) assert.ok(L.SOURCE_NAME.test(t), t);
  for (const t of ["Use `WHERE` to keep matching rows.", "A primary key identifies each row.", "SELECT name FROM employees;", "INSERT INTO es_users VALUES (1, 'ana@shop.test');"]) assert.ok(!L.SOURCE_NAME.test(t), t);
});

test("ten words in a row copied from the notes are found; a rewrite passes", () => {
  const notes = "The TRUNCATE statement is used to remove all rows from a table. It is similar to DELETE with no WHERE clause.";
  assert.ok(L.copiedRun("Note: the TRUNCATE statement is used to remove all rows from a table quickly.", notes));
  assert.strictEqual(L.copiedRun("TRUNCATE empties a whole table at once, much like a DELETE that has no condition.", notes), null);
  assert.strictEqual(L.copiedRun("anything", ""), null);
});
