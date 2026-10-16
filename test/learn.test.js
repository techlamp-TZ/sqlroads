// The 5-stage learning model's rules (library/learn-rules.js): spaced repetition, the practise set, stage status,
// mastery (Levels 1-13 and Level 14) and level completion.
const test = require("node:test");
const assert = require("node:assert");
const R = require("../library/learn-rules.js");

const T0 = Date.parse("2026-10-14T09:00:00Z");
const days = (n) => T0 + n * R.DAY_MS;

test("spaced repetition: right answers when due move a card 1 → 3 → 7 → 14 days, then it stays at 14", () => {
  let s = R.schedule(null, true, T0);
  assert.equal(s.interval, 1);
  assert.equal(s.due_at, new Date(days(1)).toISOString());
  const gaps = [];
  let now = T0;
  for (let i = 0; i < 5; i++) { now = Date.parse(s.due_at); s = R.schedule(s, true, now); gaps.push(s.interval); }
  assert.deepStrictEqual(gaps, [3, 7, 14, 14, 14]);
  assert.equal(s.reps, 6);
  assert.equal(s.lapses, 0);
});

test("spaced repetition: a wrong answer resets the card to 1 day, from any gap", () => {
  let s = { interval: 14, due_at: new Date(days(0)).toISOString(), reps: 5, lapses: 0, last_result: "right" };
  s = R.schedule(s, false, days(0));
  assert.equal(s.interval, 1);
  assert.equal(s.due_at, new Date(days(1)).toISOString());
  assert.equal(s.lapses, 1);
  assert.equal(s.last_result, "wrong");
  // a wrong first answer is also a 1-day gap
  assert.equal(R.schedule(null, false, T0).interval, 1);
  // and climbing starts again from there
  assert.equal(R.schedule(s, true, days(1)).interval, 3);
});

test("spaced repetition: a right answer before the card is due doesn't move the schedule", () => {
  const s = { interval: 3, due_at: new Date(days(3)).toISOString(), reps: 2, lapses: 0, last_result: "right" };
  const early = R.schedule(s, true, days(1));
  assert.equal(early.interval, 3);
  assert.equal(early.due_at, s.due_at);
  assert.equal(early.reps, 3);
  assert.ok(!R.isDue(s, days(1)));
  assert.ok(R.isDue(s, days(3)));
  assert.ok(R.isDue(null, T0), "a new card is due");
});

test("practise set: Easy → Medium → Hard, at most 5, with one Hard when the concept has one", () => {
  const items = [
    { id: "h1", diff: "hard", seq: 1, main: true }, { id: "h2", diff: "hard", seq: 2, main: true },
    { id: "m1", diff: "medium", seq: 3, main: false }, { id: "m2", diff: "medium", seq: 4, main: true },
    { id: "e1", diff: "easy", seq: 5, main: true }, { id: "e2", diff: "easy", seq: 6, main: true }, { id: "e3", diff: "easy", seq: 7, main: false },
  ];
  const set = R.practiseSet(items).map((i) => i.id);
  assert.deepStrictEqual(set, ["e1", "e2", "e3", "m2", "h1"]);
  assert.deepStrictEqual(R.practiseSet(items.filter((i) => i.diff !== "hard")).map((i) => i.id), ["e1", "e2", "e3", "m2", "m1"]);
  assert.deepStrictEqual(R.practiseSet([{ id: "x", diff: "hard", seq: 1 }]).map((i) => i.id), ["x"]);
  assert.deepStrictEqual(R.practiseSet([]), []);
});

const base = (o = {}) => ({
  level: 3,
  flash: { total: 6, reviewed: 6, atLeast3: 6 },
  understand: { seen: true, predicts: 3, correct: 2, answered: 3 },
  practise: { set: 5, setDone: 5, anyDone: true },
  reflections: 1,
  transfer: { total: 2, passed: 1, tried: true },
  ...o,
});

test("mastery (Levels 1-13): flashcards at 3 days+, practise set solved, a reflection and a transfer task passed", () => {
  assert.ok(R.mastered(base()));
  assert.ok(!R.mastered(base({ flash: { total: 6, reviewed: 6, atLeast3: 5 } })), "one card still below the 3-day gap");
  assert.ok(!R.mastered(base({ practise: { set: 5, setDone: 4, anyDone: true } })), "practise set not finished (the Hard one is in it)");
  assert.ok(!R.mastered(base({ reflections: 0 })), "no reflection");
  assert.ok(!R.mastered(base({ transfer: { total: 2, passed: 0, tried: true } })), "no transfer passed");
  // understand isn't part of mastery
  assert.ok(R.mastered(base({ understand: { seen: false, predicts: 3, correct: 0, answered: 0 } })));
  // a stage with nothing approved yet isn't required
  assert.ok(R.mastered(base({ flash: { total: 0, reviewed: 0, atLeast3: 0 }, transfer: { total: 0, passed: 0, tried: false } })));
});

test("stage status and the transfer lock", () => {
  const s = R.stages(base({ practise: { set: 5, setDone: 2, anyDone: true }, transfer: { total: 1, passed: 0, tried: false }, reflections: 0, understand: { seen: true, predicts: 3, correct: 1, answered: 2 } }));
  assert.deepStrictEqual(s, { memorize: "done", understand: "started", practise: "started", reflect: "todo", transfer: "locked" });
  assert.ok(!R.transferUnlocked(base({ practise: { set: 5, setDone: 4, anyDone: true } })));
  assert.ok(R.transferUnlocked(base()));
  assert.equal(R.stages(base({ flash: { total: 0, reviewed: 0, atLeast3: 0 } })).memorize, "na");
  assert.equal(R.stages(base({ understand: { seen: true, predicts: 1, correct: 1, answered: 1 } })).understand, "done", "with one predict item, one right answer is enough");
});

test("Level 14 mastery: a reflection written and 2 project tasks passed (no flashcards, no practise)", () => {
  const l14 = (o) => ({ level: 14, flash: { total: 0, reviewed: 0, atLeast3: 0 }, understand: { seen: false, predicts: 2, correct: 0, answered: 0 }, practise: { set: 1, setDone: 0, anyDone: false }, reflections: 1, transfer: { total: 40, passed: 2, tried: true }, ...o });
  assert.ok(R.mastered(l14()));
  assert.ok(!R.mastered(l14({ transfer: { total: 40, passed: 1, tried: true } })), "only 1 project task passed");
  assert.ok(!R.mastered(l14({ reflections: 0 })), "no reflection");
  assert.ok(R.mastered(l14({ transfer: { total: 1, passed: 1, tried: true } })), "a concept with a single project task needs that one");
  assert.ok(!R.mastered(l14({ transfer: { total: 0, passed: 0, tried: false } })), "no project task at all: can't be mastered");
  const st = R.stages(l14({ reflections: 0, transfer: { total: 40, passed: 1, tried: true } }));
  assert.equal(st.memorize, "na");
  assert.equal(st.practise, "na");
  assert.equal(st.transfer, "started", "transfer is open from the start in Level 14");
  assert.equal(R.stages(l14()).transfer, "done");
});

test("level complete: 80% of concepts mastered, OR every exercise done + the level quiz passed (no 70% path)", () => {
  assert.deepStrictEqual(R.levelComplete({ concepts: 10, masteredCount: 8, items: 100, done: 10 }), { complete: true, via: "concepts" });
  assert.deepStrictEqual(R.levelComplete({ concepts: 10, masteredCount: 7, items: 100, done: 10 }), { complete: false, via: null });
  assert.equal(R.levelComplete({ concepts: 9, masteredCount: 8, items: 100, done: 0 }).via, "concepts", "8 of 9 is 89%");
  assert.deepStrictEqual(R.levelComplete({ concepts: 10, masteredCount: 0, items: 100, done: 100, quizPassed: true }), { complete: true, via: "all" });
  assert.equal(R.levelComplete({ concepts: 10, masteredCount: 0, items: 100, done: 100, quizPassed: false }).complete, false, "all done but the quiz not passed");
  assert.equal(R.levelComplete({ concepts: 10, masteredCount: 0, items: 100, done: 70, quizPassed: true }).complete, false, "70% + quiz no longer completes a level");
  assert.equal(R.levelComplete({ concepts: 10, masteredCount: 0, items: 100, done: 99, quizPassed: true }).complete, false);
  assert.equal(R.levelComplete({ concepts: 12, masteredCount: 0, items: 50, done: 50, hasQuiz: false }).complete, true, "a level without MCQs has no quiz: all done is enough");
});

test("mastery is kept when items are approved later; new items show as new, other concepts must meet them", () => {
  // mastered before any flashcard or transfer task was approved
  const then = base({ flash: { total: 0, reviewed: 0, atLeast3: 0 }, practise: { set: 3, setDone: 3, anyDone: true, ids: ["a", "b", "c"] }, transfer: { total: 0, passed: 0, tried: false } });
  assert.ok(R.mastered(then));
  const record = R.masteryRecord(then);
  assert.deepStrictEqual(record, { flash: 0, practiseSet: ["a", "b", "c"], transfer: 0 });
  // later: 6 flashcards, a Hard exercise and a transfer task get approved
  const later = base({ flash: { total: 6, reviewed: 0, atLeast3: 0 }, practise: { set: 4, setDone: 3, anyDone: true, ids: ["a", "b", "c", "h"] }, transfer: { total: 1, passed: 0, tried: false } });
  assert.ok(!R.mastered(later), "by today's rules it isn't mastered");
  const st = R.masteryState(later, record);
  assert.equal(st.mastered, true, "mastery already earned is kept");
  assert.equal(st.earnedNow, false);
  assert.deepStrictEqual(st.newItems, ["flashcards", "practise", "transfer"]);
  // a concept not mastered yet has to meet the new requirements
  assert.deepStrictEqual(R.masteryState(later, null), { mastered: false, earnedNow: false, newItems: [] });
  // once the new cards reach the 3-day gap they stop being "new"
  assert.deepStrictEqual(R.masteryState(base({ flash: { total: 6, reviewed: 6, atLeast3: 6 }, practise: { set: 3, setDone: 3, anyDone: true, ids: ["a", "b", "c"] }, transfer: { total: 0, passed: 0, tried: false } }), record).newItems, []);
  // an exercise marked not done again isn't "new": nothing was added
  const undone = base({ flash: { total: 0, reviewed: 0, atLeast3: 0 }, practise: { set: 3, setDone: 2, anyDone: true, ids: ["a", "b", "c"] }, transfer: { total: 0, passed: 0, tried: false } });
  assert.deepStrictEqual(R.masteryState(undone, record), { mastered: true, earnedNow: false, newItems: [] });
  // earning it for the first time
  assert.deepStrictEqual(R.masteryState(then, null), { mastered: true, earnedNow: true, newItems: [] });
});
