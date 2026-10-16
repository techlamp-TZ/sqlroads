// The rules of the 5-stage learning model (MEMORIZE → UNDERSTAND → PRACTISE → REFLECT → TRANSFER), with no
// database access so they can be tested on their own (test/learn.test.js). library/learn.js feeds them.

// ---------- flashcards: spaced repetition ----------
// A right answer when the card is due moves it to the next gap (1 → 3 → 7 → 14 days, then it stays at 14);
// a wrong answer resets it to 1 day. A right answer before the card is due changes nothing.
const INTERVALS = [1, 3, 7, 14];
const DAY_MS = 864e5;
const iso = (ms) => new Date(ms).toISOString();
function schedule(prev, correct, now = Date.now()) {
  const at = iso(now), reps = (prev ? prev.reps : 0) + 1, lapses = prev ? prev.lapses : 0;
  if (!correct) return { interval: 1, due_at: iso(now + DAY_MS), reps, lapses: lapses + 1, last_result: "wrong", last_at: at };
  if (!prev) return { interval: 1, due_at: iso(now + DAY_MS), reps, lapses, last_result: "right", last_at: at };
  if (prev.due_at > at) return { ...prev, reps, last_result: "right", last_at: at };
  const k = INTERVALS.indexOf(prev.interval);
  const interval = INTERVALS[Math.min(INTERVALS.length - 1, k < 0 ? 0 : k + 1)];
  return { interval, due_at: iso(now + interval * DAY_MS), reps, lapses, last_result: "right", last_at: at };
}
const isDue = (state, now = Date.now()) => !state || state.due_at <= iso(now);

// ---------- practise: Easy → Medium → Hard ----------
const DIFF_RANK = { easy: 0, medium: 1, hard: 2 };
/** Exercises of a concept in learning order: easiest first; within a difficulty, the ones where it is the main concept. */
function orderPractise(items) {
  return items.slice().sort((a, b) => (DIFF_RANK[a.diff] ?? 1) - (DIFF_RANK[b.diff] ?? 1) || (b.main ? 1 : 0) - (a.main ? 1 : 0) || (a.seq || 0) - (b.seq || 0));
}
/** The practise set that mastery needs: up to `size` exercises, Easy → Medium → Hard, with one Hard when the concept has one. */
const SET_SIZE = 5;
// the other rule numbers (the learner app uses the same values; How to use shows these through /api/help/numbers)
const PREDICTS_NEEDED = 2;     // predict-the-output items right for Understand
const QUIZ_PASS = 0.7;         // a level quiz is passed at 70%
const UNLOCK_SHARE = 0.7;      // optional level locks: the previous level 70% done
const DEFAULT_GOAL = 5;        // the daily goal until the learner changes it
const CONFIDENCE_MAX = 5;      // how sure: 1 (guessing) to 5 (could teach it)
function practiseSet(items, size = SET_SIZE) {
  const ordered = orderPractise(items);
  const hard = ordered.find((i) => i.diff === "hard");
  if (!hard) return ordered.slice(0, size);
  return ordered.filter((i) => i.diff !== "hard").slice(0, size - 1).concat(hard);
}

// ---------- stages and mastery ----------
// c = { level, flash: { total, reviewed, atLeast3 }, understand: { seen, predicts, correct },
//       practise: { set, setDone, anyDone }, reflections, transfer: { total, passed, tried } }
const isL14 = (c) => c.level === 14;
const PROJECT_TASKS_NEEDED = 2;
function practiseDone(c) { return !isL14(c) && c.practise.set > 0 && c.practise.setDone >= c.practise.set; }
function transferUnlocked(c) { return isL14(c) || c.practise.set === 0 || practiseDone(c); }
/** Status of each stage: "done" | "started" | "todo" | "locked" | "na" (not part of this concept). */
function stages(c) {
  const f = c.flash, u = c.understand, p = c.practise, t = c.transfer;
  const memorize = isL14(c) || !f.total ? "na" : f.atLeast3 >= f.total ? "done" : f.reviewed ? "started" : "todo";
  const needPredict = Math.min(PREDICTS_NEEDED, u.predicts);
  const understand = u.seen && u.correct >= needPredict ? "done" : u.seen || u.correct || u.answered ? "started" : "todo";
  const practise = isL14(c) || !p.set ? "na" : practiseDone(c) ? "done" : p.anyDone ? "started" : "todo";
  const reflect = c.reflections > 0 ? "done" : "todo";
  const need = isL14(c) ? Math.min(PROJECT_TASKS_NEEDED, t.total) : 1;
  const transfer = !t.total ? "na" : !transferUnlocked(c) ? "locked" : t.passed >= need ? "done" : t.passed || t.tried ? "started" : "todo";
  return { memorize, understand, practise, reflect, transfer };
}
/**
 * Mastery. Levels 1-13: flashcards all at the 3-day gap or better, the practise set solved (it holds the Hard one),
 * one reflection and one transfer task passed. Level 14: a reflection written and 2 project tasks passed.
 * A stage with no published items yet isn't required.
 */
function mastered(c) {
  if (isL14(c)) return c.reflections > 0 && c.transfer.total > 0 && c.transfer.passed >= Math.min(PROJECT_TASKS_NEEDED, c.transfer.total);
  const memorize = !c.flash.total || c.flash.atLeast3 >= c.flash.total;
  const practise = !c.practise.set || practiseDone(c);
  const transfer = !c.transfer.total || c.transfer.passed >= 1;
  return memorize && practise && c.reflections > 0 && transfer;
}
/**
 * Mastery once earned is kept. `record` is what the concept had when it was mastered ({ flash, practiseSet, transfer }),
 * or null. Items approved after that don't take mastery away; they show as "new" until the learner does them.
 * A requirement that isn't met for another reason (e.g. an exercise marked not done again) isn't "new".
 */
function masteryState(c, record) {
  const now = mastered(c);
  if (!record) return { mastered: now, earnedNow: now, newItems: [] };
  const newItems = [];
  if (!isL14(c)) {
    if (c.flash.total > (record.flash || 0) && c.flash.atLeast3 < c.flash.total) newItems.push("flashcards");
    const before = new Set(record.practiseSet || []);
    if ((c.practise.ids || []).some((id) => !before.has(id)) && !practiseDone(c)) newItems.push("practise");
    if (!record.transfer && c.transfer.total > 0 && c.transfer.passed < 1) newItems.push("transfer");
  }
  return { mastered: true, earnedNow: false, newItems };
}
/** What is stored when a concept is mastered: what it had at that moment. */
const masteryRecord = (c) => ({ flash: c.flash.total, practiseSet: (c.practise.ids || []).slice(), transfer: c.transfer.total });
/**
 * A level is complete at 80% of its concepts mastered, OR with all its exercises done and the level quiz passed.
 * (A level without multiple-choice questions has no quiz: all exercises done is enough there.)
 */
const MASTERY_SHARE = 0.8;
function levelComplete({ concepts = 0, masteredCount = 0, items = 0, done = 0, quizPassed = false, hasQuiz = true }) {
  if (concepts > 0 && masteredCount / concepts >= MASTERY_SHARE) return { complete: true, via: "concepts" };
  if (items > 0 && done === items && (quizPassed || !hasQuiz)) return { complete: true, via: "all" };
  return { complete: false, via: null };
}

module.exports = { CONFIDENCE_MAX, PREDICTS_NEEDED, QUIZ_PASS, UNLOCK_SHARE, DEFAULT_GOAL, INTERVALS, DAY_MS, schedule, isDue, orderPractise, practiseSet, SET_SIZE, stages, mastered, masteryState, masteryRecord, transferUnlocked, levelComplete, MASTERY_SHARE, PROJECT_TASKS_NEEDED };
