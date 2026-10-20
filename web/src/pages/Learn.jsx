// Learn (#/learn and #/learn/<concept>?s=1-3): the guided path. The overview (start / continue, levels, jump) and
// the three-column workspace (the step, the dataset's tables, the guidance column). Same text, addresses, calls,
// stored keys (sqldrills.learnAt, sqldrills.learnSteps.*) and focus as the old views (app.js viewLearn,
// viewLearnStep, learnSide). The lesson, the editor, the schema and the quick-check questions are the shared pieces,
// with their own handlers; their answers reach the guidance column through "sqldrills:learn-changed".
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./home.scss";
import "./learn.scss";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, SchemaPanel, SqlWorkspace, useShared } from "../shared/shared.jsx";

export function LearnBar({ read, total, label }) {
  const pc = total ? Math.round((100 * read) / total) : 0;
  return (
    <div className="wf-ln-bar">
      <span className="wf-bar" role="progressbar" aria-label={label} aria-valuemin="0" aria-valuemax={total} aria-valuenow={read}><span style={{ width: pc + "%" }} /></span>
      <span className="wf-small mono">{read + "/" + total}</span>
    </div>
  );
}

function Jump({ p, current }) {
  return (
    <label className="wf-ln-jump">
      <span>Jump to a concept</span>
      <select className="wf-control" value={current || ""} onChange={(e) => { if (e.target.value) location.hash = "#/learn/" + encodeURIComponent(e.target.value) + "?s=1"; }}>
        {!current && <option value="">Choose…</option>}
        {p.levels.map((L) => (
          <optgroup key={L.n} label={"Level " + L.n + " · " + L.title}>
            {L.concepts.map((c) => <option key={c.slug} value={c.slug}>{(c.read ? "✓ " : "") + c.name}</option>)}
          </optgroup>
        ))}
      </select>
    </label>
  );
}

function LearnHome({ icon }) {
  const s = useShared();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { s.learnPathLoad(true).then(setP, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const frame = (body) => <div className="wf-with-rail"><div className="wf-main">{body}</div><LegacyHtml html={s.rail()} label="rail" /></div>;
  if (error) return <div className="wf-with-rail"><Card><div className="wf-card-pad">{error.message}</div></Card></div>;
  if (!p) return frame(<Card><div className="wf-card-pad" aria-busy="true"><p className="wf-muted">Loading the path…</p></div></Card>);
  const go = s.learnContinue(p), cur = go.c.level, STEPS = s.LEARN_STEPS;
  return frame(
    <>
      <div className="wf-hero">
        <div className="wf-eyebrow">Learn</div>
        <h1>Learn step by step</h1>
        <p>{"All " + p.total + " concepts in course order. Each step is a short lesson, its example to edit and run, then a quick check. Levels and exercises stay where they are; this is the guided way through them."}</p>
      </div>
      <Card as="section">
        <div className="wf-card-pad">
          <div className="wf-ln-start-h">
            <div>
              <div className="wf-eyebrow">{go.done ? "Every lesson read" : go.resume ? "Continue where you left off" : "Start"}</div>
              <h2 className="wf-h3">{go.c.name}</h2>
              <p className="wf-muted wf-small">{"Level " + go.c.level + " · step " + go.s + " of 3: " + STEPS[go.s - 1][1]}</p>
            </div>
            <Button type="link" appearance="primary" href={"#/learn/" + encodeURIComponent(go.c.slug) + "?s=" + go.s}>{go.done ? "Start again" : go.resume ? "Continue" : "Start"}</Button>
          </div>
          <LearnBar read={p.read} total={p.total} label="Lessons read across all levels" />
          <Jump p={p} current="" />
        </div>
      </Card>
      <section aria-labelledby="ln-lv" className="wf-ln-levels">
        <h2 className="wf-h3" id="ln-lv">Levels</h2>
        {p.levels.map((L) => (
          <details className="wf-ln-level" key={L.n} open={L.n === cur || undefined}>
            <summary><span className="wf-ln-lt">{"Level " + L.n + " · " + L.title}</span><LearnBar read={L.read} total={L.total} label={"Level " + L.n + " lessons read"} /></summary>
            <ol className="wf-ln-list">
              {L.concepts.map((c) => (
                <li key={c.slug}><a href={"#/learn/" + encodeURIComponent(c.slug) + "?s=1"}><span className="wf-ln-mark" aria-hidden="true">{c.read && <OldIcon icon={icon} name="check" />}</span><span>{c.name}</span>{c.read && <span className="wf-sr-only"> (read)</span>}</a></li>
              ))}
            </ol>
          </details>
        ))}
      </section>
    </>,
  );
}

// the guidance column: the concept's goal, real progress through its three steps, its key points and its tip
function Side({ c, slug, s, icon }) {
  const sh = useShared();
  const l = (c.lessons || [])[0], st = sh.learnStepState(c, slug), n = [1, 2, 3].filter((k) => st[k]).length;
  const points = l ? String(l.what || "").replace(/`([^`]+)`/g, "$1").match(/[^.!?]+[.!?]/g) || [] : [];
  const desc = { 1: "Read the concept and its key points", 2: "Run and change the example", 3: "Answer the quick check" };
  return (
    <>
      <Card as="section"><div className="wf-lw-side-card" aria-labelledby="lw-goal">
        <h2 className="wf-lw-side-h" id="lw-goal"><OldIcon icon={icon} name="target" />Learning goal</h2><p>{c.summary || ""}</p>
      </div></Card>
      <Card as="section"><div className="wf-lw-side-card" aria-labelledby="lw-prog">
        <h2 className="wf-lw-side-h" id="lw-prog"><OldIcon icon={icon} name="chart" />Your progress</h2>
        <div className="wf-lw-prog-top">
          <svg className="wf-lw-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" className="wf-lw-ring-bg" /><circle cx="22" cy="22" r="18" className="wf-lw-ring-fg" strokeDasharray={(113.1 * n / 3).toFixed(1) + " 113.1"} /></svg>
          <div><b className="mono">{n + "/3"}</b> steps done<br /><span className="wf-muted wf-small">{c.lessonRead ? "Lesson finished" : "This concept"}</span></div>
        </div>
        <ol className="wf-lw-prog-list">
          {sh.LEARN_STEPS.map((x, k) => {
            const i = k + 1, now = i === s;
            return (
              <li key={i} className={st[i] ? "done" : now ? "now" : ""} aria-current={now ? "step" : undefined}>
                <span className="wf-lw-dot" aria-hidden="true">{st[i] && <OldIcon icon={icon} name="check" />}</span>
                <a href={"#/learn/" + encodeURIComponent(slug) + "?s=" + i}><b>{i + ". " + x[1]}</b><span className="wf-muted wf-small">{desc[i]}</span><span className="wf-sr-only">{" (" + (st[i] ? "done" : now ? "current step" : "to do") + ")"}</span></a>
              </li>
            );
          })}
        </ol>
      </div></Card>
      {s !== 1 && points.length > 0 && (
        <Card as="section"><div className="wf-lw-side-card" aria-labelledby="lw-keys">
          <h2 className="wf-lw-side-h" id="lw-keys"><OldIcon icon={icon} name="bulb" />Key points</h2>
          <ul className="wf-lw-keys">{points.slice(0, 4).map((pt, i) => <li key={i}>{pt.trim()}</li>)}</ul>
        </div></Card>
      )}
      {s !== 1 && l && l.tip && (
        <section className="wf-lw-tip" aria-labelledby="lw-tip">
          <h2 className="wf-lw-side-h" id="lw-tip"><OldIcon icon={icon} name="code" />Watch out</h2>
          <p dangerouslySetInnerHTML={{ __html: sh.lessonText(l.tip) }} />
        </section>
      )}
    </>
  );
}

// the schema column: the dataset's tables, the example's own first and open; an example with its own tables says so
function Schema({ l, icon }) {
  const sh = useShared();
  const sql = sh.exampleSqlOf(l);
  if (/\bCREATE\s+(TEMP(ORARY)?\s+)?TABLE\b/i.test(sql)) return <Card as="section"><div className="wf-card-pad wf-lw-own" aria-label="Tables"><OldIcon icon={icon} name="db" /><p>This example creates its own tables: they are in its script.</p></div></Card>;
  return <SchemaPanel src={{ kind: "sqlite", key: l.dataset }} open hint="its tables first" sql={sql} title="Database schema" cls="lw-schema" />;
}

function QuickCheck({ c, slug, icon }) {
  const sh = useShared(), S = sh.state;
  // the questions are chosen once per visit of the step (as before), and remembered for the guidance column
  const [qs] = useState(() => { const q = sh.learnChecks(c); S.learnQs = S.learnQs || {}; S.learnQs[slug] = q; return q; });
  return (
    <>
      <p className="wf-muted wf-small wf-ln-qnote">{qs.length ? "Answer " + (qs.length === 1 ? "this question" : "these " + qs.length + " questions") + ". A wrong answer comes back in Review mistakes." : ""}</p>
      {qs.length ? qs.map((q, i) => (
        <LegacyHtml key={i} label="quickCheck" keepStarted mount={sh.schemaMount}
          html={q.kind === "predict" ? sh.predictCard(q.item) : q.kind === "mcq" ? '<section class="card card-pad">' + sh.mcqBlock(q.item, false, true) + "</section>" : sh.xcardHtml(q.item)} />
      )) : <LegacyHtml label="empty" html={sh.emptyStage("checkCircle", "No quick-check question for this concept yet: they appear once they are approved.", ["#/concept/" + encodeURIComponent(slug) + "?tab=understand", "Open the concept page"])} />}
    </>
  );
}

function LearnStep({ slug, route, icon }) {
  const sh = useShared(), S = sh.state;
  const s = Math.min(3, Math.max(1, Number(route.q && route.q.get("s")) || 1));
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [, bump] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const title = useRef(null);
  useEffect(() => {
    Promise.all([sh.learnPathLoad(), sh.loadConcept(slug)]).then(([p, c]) => { sh.store("sqldrills.learnAt", slug + "|" + s); setData({ p, c }); }, setError);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { if (data && title.current) title.current.focus(); }, [data]);
  // a step done, or a quick-check answer: the guidance column again (and step 3 done once every question is answered)
  const onChange = useCallback(() => {
    const c = S.learn.concept[slug];
    const shown = s === 3 && S.learnQs && S.learnQs[slug];
    if (c && shown && sh.learnCheckAnswered(c, shown) && !sh.learnStepsOf(slug)[3]) { sh.learnStepDone(slug, 3); return; }
    bump((n) => n + 1);
  }, [slug, s]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { window.addEventListener("sqldrills:learn-changed", onChange); return () => window.removeEventListener("sqldrills:learn-changed", onChange); }, [onChange]);

  if (error) return <div className="wf-lw-page"><Card><div className="wf-card-pad">{error.message} <a href="#/learn">Back to Learn</a></div></Card></div>;
  if (!data) return <div className="wf-lw-page"><Card><div className="wf-card-pad" aria-busy="true"><p className="wf-muted">Loading…</p></div></Card></div>;

  const { p } = data, c = S.learn.concept[slug] || data.c;
  const flat = sh.learnFlat(p), i = flat.map((x) => x.slug).indexOf(slug), L = p.levels.filter((x) => x.n === c.level)[0];
  const l = (c.lessons || [])[0], prev = flat[i - 1], next = flat[i + 1], st = sh.learnStepState(c, slug), STEPS = sh.LEARN_STEPS;
  const dialect = l && sh.exampleSqlOf(l) ? (sh.exampleLocal(l) ? "SQLite" : "MySQL") : "";
  const hasSchema = !!(l && l.dataset);
  const back = s > 1 ? "#/learn/" + encodeURIComponent(slug) + "?s=" + (s - 1) : prev ? "#/learn/" + encodeURIComponent(prev.slug) + "?s=3" : null;
  const finish = () => {
    setFinishing(true);
    sh.api("/api/learn/lesson/" + encodeURIComponent(slug) + "/read", {}).then(() => { S.learnPath = null; location.hash = next ? "#/learn/" + encodeURIComponent(next.slug) + "?s=1" : "#/learn"; })
      .catch((er) => { setFinishing(false); sh.toast("Couldn't save: " + er.message); });
  };
  const open = !window.matchMedia || window.matchMedia("(min-width: 900px)").matches;
  const empty = (ic) => <LegacyHtml label="empty" html={sh.emptyStage(ic, "No lesson for this concept yet.", ["#/concept/" + encodeURIComponent(slug), "Open the concept page"])} />;

  return (
    <div className="wf-lw-page">
      <div className={"wf-lw" + (hasSchema ? "" : " no-schema")}>
        <div className="wf-lw-head">
          <nav className="wf-crumbs" aria-label="Breadcrumb"><a href="#/learn">Learn</a><OldIcon icon={icon} name="chevRight" /><a href={"#/level/" + c.level}>{"Level " + c.level}</a><OldIcon icon={icon} name="chevRight" /><span>{L ? L.title : ""}</span></nav>
          <Card as="section"><div className="wf-lw-over" aria-labelledby="lw-title">
            <div className="wf-lw-over-top">
              <div className="wf-lw-over-txt">
                <div className="wf-eyebrow">{"Concept " + (i + 1) + " of " + flat.length + " · Level " + c.level}</div>
                <h1 id="lw-title" tabIndex={-1} ref={title}>{c.name}</h1>
                <p className="wf-lw-obj">{c.summary || ""}</p>
              </div>
              <div className="wf-lw-over-meta">
                {dialect && <span className="wf-dialect" title="Where the example runs"><OldIcon icon={icon} name="db" />{dialect}</span>}
                {L && <LearnBar read={L.read} total={L.total} label={"Level " + c.level + " lessons read"} />}
              </div>
            </div>
            <ol className="wf-lw-steps" aria-label="Steps">
              {STEPS.map((x, k) => {
                const n = k + 1, cls = n === s ? "on" : st[n] ? "done" : "";
                return (
                  <li key={n} className={cls} aria-current={n === s ? "step" : undefined}>
                    <a href={"#/learn/" + encodeURIComponent(slug) + "?s=" + n}>
                      <span className="wf-lw-stepi" aria-hidden="true">{st[n] && n !== s ? <OldIcon icon={icon} name="check" /> : n}</span>
                      <span>{x[1]}</span><span className="wf-sr-only">{" (" + (n === s ? "current" : st[n] ? "done" : "to do") + ")"}</span>
                    </a>
                  </li>
                );
              })}
            </ol>
            <Jump p={p} current={slug} />
          </div></Card>
        </div>
        <div className="wf-lw-main">
          {s === 1 && (l ? <LegacyHtml label="lesson" html={sh.lessonCard(l, { noTables: true })} /> : empty("file"))}
          {s === 2 && (l ? <SqlWorkspace lesson={l} slug={slug} opts={{ hLevel: 2 }} /> : empty("code"))}
          {s === 3 && <QuickCheck c={c} slug={slug} icon={icon} />}
          <nav className="wf-ln-nav" aria-label="Step navigation">
            {back ? <Button type="link" href={back}>Back</Button> : <span />}
            {s < 3
              ? <Button type="link" appearance="primary" href={"#/learn/" + encodeURIComponent(slug) + "?s=" + (s + 1)} onClick={s === 1 ? () => sh.learnStepDone(slug, 1) : undefined}>{"Next: " + STEPS[s][1]}</Button>
              : <Button appearance="primary" onClick={finish} disabled={finishing}>{next ? "Done · next concept" : "Done · back to Learn"}</Button>}
          </nav>
        </div>
        {hasSchema && <div className="wf-lw-schema-col"><Schema l={l} icon={icon} /></div>}
        <aside className="wf-lw-side" aria-label="Learning guidance">
          {open ? <Side c={c} slug={slug} s={s} icon={icon} /> : (
            <details className="wf-lw-side-fold"><summary>Learning goal, progress and key points</summary><Side c={c} slug={slug} s={s} icon={icon} /></details>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function LearnPage({ route, icon }) {
  const slug = route && route.args && route.args[0];
  return slug ? <LearnStep key={slug + "?" + (route.q && route.q.get("s"))} slug={slug} route={route} icon={icon} /> : <LearnHome icon={icon} />;
}
