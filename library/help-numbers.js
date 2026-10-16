// The numbers How to use shows (public/help.js {{tokens}}): each read from where it lives, nothing typed in.
const db = require("../db.js");
const library = require("./library.js");
const content = require("../admin/content.js");
const backup = require("../admin/backup.js");
function helpNumbers() {
  const R = require("./learn-rules.js"), learnMod = require("./learn.js"), map = learnMod.contentMap();
  const count = (sql) => db.prepare(sql).get().n;
  const list = (a) => (a.length > 1 ? a.slice(0, -1).join(", ") + " and " + a[a.length - 1] : String(a[0]));
  const { ROLES, listProviders } = require("../hints.js");
  const spend = db.prepare("SELECT COUNT(*) calls, SUM(cost) cost FROM ai_spend").get();
  const nav = require("../admin/insights.js").navCounts(), bk = backup.list(), learning = require("../admin/learning.js");
  const cards = db.prepare("SELECT json_extract(data, '$.card_type') t, COUNT(*) n FROM stage_items WHERE kind = 'card' AND status = 'published' GROUP BY 1").all().filter((r) => require("../public/cards.js").STANDALONE.includes(r.t));
  return {
    concepts: map.concepts.length, levels: library.LEVELS.length, exercises: library.summary().total, mcqs: content.publicMcqs().length,
    lessons: count("SELECT COUNT(*) n FROM stage_items WHERE kind = 'lesson' AND status = 'published'"),
    flashcards: count("SELECT COUNT(*) n FROM stage_items WHERE kind = 'flashcard' AND status = 'published'"),
    predicts: count("SELECT COUNT(*) n FROM stage_items WHERE kind = 'predict' AND status = 'published'"),
    cards: cards.reduce((n, r) => n + r.n, 0), card_types: cards.length,
    intervals: list(R.INTERVALS), gap: R.INTERVALS[1], review_days: list(library.REVIEW_DAYS), set_size: R.SET_SIZE, predicts_needed: R.PREDICTS_NEEDED,
    project_tasks: R.PROJECT_TASKS_NEEDED, mastery_pct: Math.round(R.MASTERY_SHARE * 100), quiz_pct: Math.round(R.QUIZ_PASS * 100), unlock_pct: Math.round(R.UNLOCK_SHARE * 100), daily_goal: R.DEFAULT_GOAL,
    target_flash: learning.TARGET.flashcards, target_predict: learning.TARGET.predicts, target_practise: learning.TARGET.practise, target_transfer: learning.TARGET.transfer, coverage_pct: learning.coverage().pct,
    queue: nav.queue, health_open: nav.health, backups: bk.length, last_backup: bk[0] ? new Date(bk[0].created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "—",
    generator: ROLES.generator.model, reviewer: ROLES.reviewer.model, tiebreaker: ROLES.tieBreaker.model, hint_model: ((listProviders().find((p) => p.id === "openai") || listProviders()[0] || {}).model) || "—",
    confidence: "1-" + R.CONFIDENCE_MAX, mcq_options: content.MCQ_OPTIONS.join("-"),
    spend_total: "$" + (spend.cost || 0).toFixed(2), spend_calls: spend.calls, sqlpad_url: "http://localhost:3010",
  };
}
module.exports = { helpNumbers };
