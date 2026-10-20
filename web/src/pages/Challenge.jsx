// The Today plan's Challenge (#/challenge?level=N): one item, due for review or from the weakest concept. Same text,
// calls (/api/learn/today, POST /api/learn/challenge with the confidence) and behaviour as the old view (app.js
// viewChallenge, challengeItemHtml, challengeAnswer): a card is the shared interaction card (it saves itself and
// says so with "sqldrills:challenge-done"); the rest is checked here, with the card engine for typed answers.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./home.scss";
import "./learn.scss";
import "./flashcards.scss";
import { OldIcon } from "../shared/OldIcon.jsx";
import { InteractionCard, LegacyHtml, TablesPanel, useShared } from "../shared/shared.jsx";

function DoneBox({ right }) {
  const a = useRef(null);
  useLayoutEffect(() => { if (a.current) a.current.focus(); }, []);
  return <Card as="section"><div className="wf-card-pad"><p>{right ? "Saved. It comes back when it is due." : "Saved. It comes back tomorrow."}</p><div className="wf-actions"><Button type="link" appearance="primary" href="#/home" ref={a}>Back to Today</Button></div></div></Card>;
}

function Item({ ch, onAnswered, icon }) {
  const s = useShared(), it = ch.item;
  const [opts] = useState(() => (ch.kind === "predict" ? s.predictOptions(it) : null));
  const [revealed, setRevealed] = useState(false);
  const [out, setOut] = useState(null);      // { msg } | { right, html }
  const [locked, setLocked] = useState(false);
  const root = useRef(null);
  const spot = it.type === "error" && s.spotBugUsable(it);
  const self = ch.kind === "flashcard" && !(it.type === "blank" || spot);
  const hi = (sql) => ({ __html: s.highlight(sql) });
  const gradeRef = useRef(null);
  useLayoutEffect(() => { if (revealed && gradeRef.current) gradeRef.current.focus(); }, [revealed]);

  const answer = (right, html) => {
    const sec = root.current;
    sec.querySelectorAll("input, textarea, select").forEach((x) => { x.disabled = true; });
    setLocked(true); setOut({ right, html: html || "" });
    s.api("/api/learn/challenge", { ref: ch.ref, kind: ch.kind, correct: right, confidence: s.confOf(sec, "ch") }).then(() => onAnswered(right)).catch((e) => s.toast(e.message));
  };
  const check = () => {
    const sec = root.current;
    if (ch.kind === "predict") {
      const o = sec.querySelector('[name="ch-opt"]:checked');
      if (!o) { setOut({ msg: "Choose an answer first." }); return; }
      answer(o.getAttribute("data-right") === "1", '<div class="muted small">The real output</div>' + (it.variant === "endstate" ? s.outcomeHtml(it.answer) : s.miniTable(it.answer)));
    } else if (it.type === "blank") {
      const v = sec.querySelector(".ch-blank").value, ok = window.Cards.checkBlank(v, it);
      answer(ok, '<pre class="mcq-code">' + s.highlight(String(it.sql).replace("___", it.answer)) + "</pre>" + (it.explanation ? "<p>" + s.esc(it.explanation) + "</p>" : ""));
    } else if (it.type === "error") {
      s.spotBugCheck(sec, it, "ch").then((r) => { if (r.msg) setOut({ msg: r.msg }); else if (!r.fallback) answer(r.right, r.html); });
    }
  };

  let body;
  if (ch.kind === "predict") body = (
    <>
      <div className="pq">{it.question}</div>
      {it.variant === "endstate"
        ? <><pre className="mcq-code" dangerouslySetInnerHTML={hi(s.numberedScript(it.script))} />{it.check_sql && it.mode !== "error" && <pre className="mcq-code" dangerouslySetInnerHTML={hi(it.check_sql)} />}</>
        : <><LegacyHtml label="inputs" html={s.inputsHtml(it)} /><pre className="mcq-code" dangerouslySetInnerHTML={hi(it.sql)} /></>}
      <fieldset className="po-opts"><legend>Which result is right?</legend>
        {opts.map((o, i) => (
          <label className="po-opt" key={i}><input type="radio" name="ch-opt" value={i} data-right={o.right ? 1 : 0} /><span className="po-l">{"ABCD".charAt(i)}</span>
            <span className="po-body" dangerouslySetInnerHTML={{ __html: it.variant === "endstate" ? s.outcomeHtml(o.table) : s.miniTable(o.table) }} /></label>
        ))}
      </fieldset>
    </>
  );
  else if (spot) body = <LegacyHtml label="spotBug" html={s.spotBugHtml(it, "ch")} />;
  else if (it.type === "blank") body = (
    <><div className="wf-fc-q">{it.prompt || "Fill in the blank"}</div><pre className="mcq-code" dangerouslySetInnerHTML={hi(it.sql)} />
      <label className="wf-fc-in"><span>Your answer for ___</span><input className="wf-control mono ch-blank" autoComplete="off" spellCheck={false} /></label></>
  );
  else body = (
    <><div className="wf-fc-q">{it.front || it.prompt || ""}</div>{it.wrong_sql && <pre className="mcq-code" dangerouslySetInnerHTML={hi(it.wrong_sql)} />}
      {revealed && <div className="ch-back">{it.back && <p>{it.back}</p>}{it.parts && <pre className="mcq-code" dangerouslySetInnerHTML={hi(it.parts.join("\n"))} />}{it.fixed_sql && <><pre className="mcq-code" dangerouslySetInnerHTML={hi(it.fixed_sql)} /><p>{it.explanation || ""}</p></>}</div>}</>
  );
  // the first control gets focus, as before (the tables toggle is never first)
  useLayoutEffect(() => { const f = root.current && root.current.querySelector("input, textarea, select, .wf-btn"); if (f) f.focus(); }, []);
  return (
    <Card as="section"><div className="wf-card-pad wf-ch-item" ref={root} data-ch-kind={ch.kind}>
      {body}
      {it.type !== "keyword" && <TablesPanel dataset={it.dataset} sql={it.sql || it.fixed_sql || it.wrong_sql} />}
      <LegacyHtml label="confidence" html={s.confHtml("ch")} />
      <div className="wf-actions">
        {self ? (!revealed
          ? <button type="button" className="wf-btn primary" disabled={locked} onClick={() => setRevealed(true)}>Show the answer</button>
          : <span className="wf-actions"><button type="button" className="wf-btn ok" ref={gradeRef} disabled={locked} onClick={() => answer(true)}><OldIcon icon={icon} name="check" />I knew it</button><button type="button" className="wf-btn" disabled={locked} onClick={() => answer(false)}><OldIcon icon={icon} name="x" />I didn't</button></span>)
          : <button type="button" className="wf-btn primary" disabled={locked} onClick={check}><OldIcon icon={icon} name="checkCircle" />Check</button>}
      </div>
      <div aria-live="polite">
        {out && out.msg && <p className="wf-small wf-bad-txt">{out.msg}</p>}
        {out && !out.msg && <><LegacyHtml label="verdict" html={s.verdictHtml(out.right)} />{out.html && <div dangerouslySetInnerHTML={{ __html: out.html }} />}</>}
      </div>
    </div></Card>
  );
}

export default function ChallengePage({ route, icon }) {
  const s = useShared(), S = s.state;
  const lv = Number(route.q && route.q.get("level")) || 1;
  const [t, setT] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  useEffect(() => { s.api("/api/learn/today?level=" + lv).then(setT, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // a card saves itself (the shared card): app.js says when, and with what result
  useEffect(() => { const on = (e) => setDone({ right: e.detail.right }); window.addEventListener("sqldrills:challenge-done", on); return () => window.removeEventListener("sqldrills:challenge-done", on); }, []);
  const answered = (right) => { S.learn.today = null; s.markConceptStale(); setDone({ right }); };
  const page = (body) => <div className="wf-lw-page"><div className="wf-fc-page wf-challenge">{body}</div></div>;
  if (error) return page(<Card><div className="wf-card-pad">{error.message}</div></Card>);
  if (!t) return page(<Card><div className="wf-card-pad" aria-busy="true"><p className="wf-muted">Finding your challenge…</p></div></Card>);
  const ch = t.challenge;
  const crumbs = <nav className="wf-crumbs" aria-label="Breadcrumb"><a href="#/home">Home</a><OldIcon icon={icon} name="chevRight" /><span>Challenge</span></nav>;
  if (!ch) return page(<>{crumbs}<Card><div className="wf-card-pad wf-empty-card"><OldIcon icon={icon} name="trophy" /><div><p>Nothing to challenge you with right now: nothing is due and this level's concepts are going well.</p><Button type="link" size="small" href="#/home">Back to today's plan</Button></div></div></Card></>);
  return page(
    <>
      {crumbs}
      <Card as="section"><div className="wf-card-pad wf-ch-intro">
        <div className="wf-eyebrow">{ch.why === "due" ? "Due for review" : "Your weakest concept in this level"}</div>
        <h1 className="wf-h3">{ch.name}</h1>
        <p className="wf-muted wf-small">Answer it, say how sure you are, and it is scheduled for the right day.</p>
      </div></Card>
      {ch.kind === "card" ? <InteractionCard card={ch.item} challenge /> : <Item ch={ch} onAnswered={answered} icon={icon} />}
      <div aria-live="polite">{done && <DoneBox right={done.right} />}</div>
    </>,
  );
}
