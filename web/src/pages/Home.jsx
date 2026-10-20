// Home (#/home): the dashboard, with the Today plan. Same text, links, calls and behaviour as the old view
// (app.js viewHome, todayHtml): the level path, progress strip and quiz picker are the shared pieces; the plan is
// fetched once per level (/api/learn/today) and kept in app.js's state, and the review list is refreshed after load.
import { useEffect, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./home.scss";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, useShared } from "../shared/shared.jsx";

let reviewBusy = false; // the old page's viewHome.busy: one review refresh at a time

export function TodayPlan({ lv, icon }) {
  const s = useShared(), S = s.state;
  const fresh = S.learn.today && S.learn.today.level === lv ? S.learn.today : null;
  const [T, setT] = useState(fresh);
  const [error, setError] = useState(null);
  useEffect(() => {
    if (T) return;
    s.api("/api/learn/today?level=" + lv + "&weekend=" + (s.isWeekend() ? 1 : 0)).then((t) => {
      S.learn.today = t; S.flashDue = t.flashcards.due; s.renderNav(); setT(t);
    }, setError);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const head = (id) => <div className="wf-panel-h"><h2 className="wf-h3" id={id}><OldIcon icon={icon} name="target" />Today</h2></div>;
  if (error) return <Card as="section"><div className="wf-card-pad wf-today" id="todayPlan">{head()}<div className="wf-err">{error.message}</div></div></Card>;
  if (!T) return <Card as="section"><div className="wf-card-pad wf-today" id="todayPlan" aria-busy="true">{head()}<p className="wf-muted wf-small">Loading your plan…</p></div></Card>;

  const st = s.streak(), goal = s.dailyGoal(), steps = [];
  steps.push(T.flashcards.due ? ["cards", "Memorize", s.plural(T.flashcards.due, "flashcard") + " due", "#/flashcards?study=1", "Review"]
    : T.flashcards.newConcept ? ["cards", "Memorize", "New cards: " + T.flashcards.newConcept.name, "#/flashcards?concept=" + T.flashcards.newConcept.slug, "Start"]
      : ["cards", "Memorize", "No flashcards due" + (T.flashcards.newConcept === null ? " (cards appear once approved)" : ""), null, null]);
  steps.push(T.understand ? ["bulb", "Understand", "Next concept: " + T.understand.name, "#/concept/" + T.understand.slug + "?tab=understand", T.understand.stage === "started" ? "Continue" : "Open"] : ["bulb", "Understand", "Every concept of this level is understood", null, null]);
  const rf = T.reflection;
  steps.push(rf && rf.item && S.byId[rf.item] ? ["note", "Reflect", "One sentence on “" + S.byId[rf.item].title + "” (you " + (rf.result === "pass" ? "solved it" : "didn't solve it yet") + ")", "#/drill/" + rf.item + "?reflect=" + rf.result, "Reflect"]
    : rf && rf.concept ? ["note", "Reflect", "Explain " + rf.name + " in one sentence", "#/concept/" + rf.concept + "?tab=reflect", "Reflect"] : ["note", "Reflect", "Nothing to reflect on yet", null, null]);
  if (T.challenge) steps.push(["spark", "Challenge", (T.challenge.why === "due" ? "Due for review: " : "Your weakest concept: ") + T.challenge.name, "#/challenge?level=" + lv, "Start"]);
  if (T.weekend) steps.push(T.transfer && T.transfer.id && S.byId[T.transfer.id] ? ["compass", "Transfer · weekend", S.byId[T.transfer.id].title + " (" + T.transfer.name + ")", s.href(S.byId[T.transfer.id]), "Try it"] : ["compass", "Transfer · weekend", "Finish a concept's practise set to unlock a transfer challenge", null, null]);
  const prac = T.practise.map((id) => S.byId[id]).filter(Boolean);
  return (
    <Card as="section">
      <div className="wf-card-pad wf-today" id="todayPlan" aria-labelledby="today-h">
        <div className="wf-panel-h">
          <h2 className="wf-h3" id="today-h"><OldIcon icon={icon} name="target" />Today</h2>
          <span className="wf-muted wf-small">Daily goal <b className="mono">{Math.min(st.today, 99) + "/" + goal}</b> · every stage counts</span>
          <a className="wf-more" href={"#/level/" + lv}>{"Level " + lv + " "}<OldIcon icon={icon} name="chevRight" /></a>
        </div>
        <ul className="wf-today-list">
          {steps.map((x) => (
            <li key={x[1]}>
              <span className="wf-today-ic"><OldIcon icon={icon} name={x[0]} /></span>
              <span className="wf-tl-main"><span className="wf-eyebrow">{x[1]}</span><span>{x[2]}</span></span>
              {x[3] && <Button type="link" size="small" href={x[3]}>{x[4]}</Button>}
            </li>
          ))}
        </ul>
        <h3 className="wf-today-sub"><OldIcon icon={icon} name="play" />{"Practise · " + s.plural(prac.length, "exercise")}</h3>
        {prac.length ? <div className="clist"><LegacyHtml html={prac.map((d) => s.compactRow(d)).join("")} label="practise" /></div> : <p className="wf-muted wf-small">Every practise set in this level is done.</p>}
      </div>
    </Card>
  );
}

export default function HomePage({ icon }) {
  const s = useShared(), S = s.state;
  const lv = s.currentLevel();
  useEffect(() => {
    if (reviewBusy) return;
    reviewBusy = true;
    const t = setTimeout(() => { s.loadReview().then(() => { reviewBusy = false; }, () => { reviewBusy = false; }); }, 0);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const due = (S.review && S.review.due.length) || 0;
  return (
    <div className="wf-with-rail">
      <div className="wf-main wf-home">
        <div className="wf-hero">
          <div className="wf-eyebrow">Welcome back</div>
          <h1>Your SQL dashboard</h1>
          <p>{"One path from SELECT basics to capstone projects: " + S.levels.length + " levels, " + S.items.length.toLocaleString() + " exercises, easiest first."}</p>
        </div>
        <LegacyHtml html={s.levelPath() + s.progressStrip()} label="levelPath" />
        {due > 0 && (
          <a className="wf-review-due" href="#/review">
            <OldIcon icon={icon} name="reset" />
            <span><b>{"Review due: " + due}</b>{" " + (due === 1 ? "exercise" : "exercises") + " you got wrong or solved with a hint " + (due === 1 ? "is" : "are") + " ready for another try."}</span>
            <span className="wf-go"><OldIcon icon={icon} name="chevRight" /></span>
          </a>
        )}
        <TodayPlan lv={lv} icon={icon} />
        <LegacyHtml html={s.quizPicker()} label="quizPicker" />
      </div>
      <LegacyHtml html={s.rail()} label="rail" />
    </div>
  );
}
