// Validates the MCQ bank: structure, unique ids and options, and runs every `check` query in
// SQLite to confirm its result equals the right option's text.
// Usage: node mcq/selftest.js
const { DatabaseSync } = require("node:sqlite");
const QS = require("./questions.js");

const TOPICS = new Set(["select", "where", "order", "join", "group", "aggregates", "subquery", "window", "set", "functions", "dates", "modify", "ddl", "views", "tx", "security"]);
const db = new DatabaseSync(":memory:");
const problems = [];
const ids = new Set();
let checks = 0;
for (const q of QS) {
  const where = q.id || "(no id)";
  if (!q.id || ids.has(q.id)) problems.push(`${where}: missing or duplicate id`);
  ids.add(q.id);
  if (!TOPICS.has(q.topic)) problems.push(`${where}: unknown topic ${q.topic}`);
  if (!["easy", "medium", "hard"].includes(q.diff)) problems.push(`${where}: bad diff`);
  if (!Array.isArray(q.options) || q.options.length !== 4) problems.push(`${where}: needs 4 options`);
  else if (new Set(q.options).size !== 4) problems.push(`${where}: duplicate options`);
  if (!(q.answer >= 0 && q.answer < 4)) problems.push(`${where}: answer out of range`);
  if (!q.q || !q.why) problems.push(`${where}: missing question or explanation`);
  if (q.check) {
    checks++;
    try {
      const row = db.prepare(q.check).get();
      const got = String(Object.values(row)[0]);
      const want = q.options[q.answer];
      const same = got === want || (!isNaN(got) && !isNaN(want) && Number(got) === Number(want));
      if (!same) problems.push(`${where}: check returned ${got}, right option is ${want}`);
    } catch (e) {
      problems.push(`${where}: check failed: ${e.message}`);
    }
  }
}
const byTopic = {};
for (const q of QS) byTopic[q.topic] = (byTopic[q.topic] || 0) + 1;
console.log(`${QS.length} questions, ${checks} verified by running SQL, ${problems.length} problems`);
console.log(byTopic);
for (const p of problems) console.log(" -", p);
process.exit(problems.length ? 1 : 0);
