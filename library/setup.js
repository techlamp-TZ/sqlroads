// auto_setup: setup exercises hidden from learners (e.g. "Build the star schema") run once, silently,
// before the first Run / Check of an exercise that needs them. Used by the learner routes and by
// the Library health check; "Reset data" forgets what ran.
const db = require("../db.js");
const lib = require("./library.js");
const { runPrerequisites } = require("../course/check.js");

db.exec("CREATE TABLE IF NOT EXISTS setup_runs (track TEXT NOT NULL, code TEXT NOT NULL, at TEXT NOT NULL, PRIMARY KEY (track, code))");
const getExercise = (track, code) => db.prepare("SELECT * FROM course_exercises WHERE id = ?").get(`${track}:${code}`);

async function ensureSetups(id, ex) {
  const codes = lib.setupCodesFor(id).filter((code) => !db.prepare("SELECT 1 FROM setup_runs WHERE track = ? AND code = ?").get(ex.track, code));
  if (!codes.length) return;
  const r = await runPrerequisites({ track: ex.track, prereq_codes: JSON.stringify(codes) }, getExercise);
  if (r.ok) for (const code of codes) db.prepare("INSERT OR REPLACE INTO setup_runs (track, code, at) VALUES (?, ?, ?)").run(ex.track, code, new Date().toISOString());
}
function forgetSetups(tracks) { for (const t of tracks) db.prepare("DELETE FROM setup_runs WHERE track = ?").run(t); }

module.exports = { ensureSetups, forgetSetups };
