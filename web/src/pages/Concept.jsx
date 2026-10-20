// The concept page (#/concept/<slug>?tab=): the head (stage ring, mastery, previous / next) and the stage tabs
// (Study, then Memorize → Transfer). Same text, addresses, calls and keys as the old view (app.js viewConcept): a tab
// replaces the address (?tab=) and takes focus; ←/→/Home/End move between tabs. Each stage's content is the shared
// piece (stagePanel, with its handlers); a background refresh (app.js refreshConcept → "sqldrills:concept-render")
// never replaces a card the learner has started.
import { useEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import { ChevronLeftIcon } from "@waffles/icons";
import "../shared/page.scss";
import "./home.scss";
import "./learn.scss";
import "./concept.scss";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, useShared } from "../shared/shared.jsx";

export default function ConceptPage({ route, icon }) {
  const s = useShared(), S = s.state;
  const slug = route.args[0];
  const [, bump] = useState(0);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(() => route.q && route.q.get("tab"));
  const tabs = useRef(null);
  const c = S.learn.concept[slug];
  // load (first visit) or refresh (stale, e.g. after a stage was finished elsewhere), as before
  useEffect(() => {
    const stale = s.takeConceptStale(); // the old view's viewConcept.stale: read once, then cleared
    if (!c || c.slug !== slug) s.loadConcept(slug).then(() => bump((n) => n + 1), setError);
    else if (stale) s.refreshConcept(slug);
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const on = (e) => { if (e.detail && e.detail.slug === slug) bump((n) => n + 1); };
    window.addEventListener("sqldrills:concept-render", on);
    return () => window.removeEventListener("sqldrills:concept-render", on);
  }, [slug]);

  if (error) return (
    <div className="wf-lw-page"><Card><div className="wf-card-pad wf-empty-card"><OldIcon icon={icon} name="x" /><div>{error.message} · <a href="#/levels">Back to the levels</a></div></div></Card></div>
  );
  if (!c || c.slug !== slug) return <div className="wf-lw-page"><Card><div className="wf-card-pad" aria-busy="true"><p className="wf-muted">Loading the concept…</p></div></Card></div>;

  let cur = tab || s.STAGES.filter((k) => c.stages[k] !== "done" && c.stages[k] !== "na" && c.stages[k] !== "locked")[0] || "understand";
  if (s.CTABS.indexOf(cur) < 0) cur = "understand";
  const L = s.levelOf(c.level), idx = c.siblings.map((x) => x.slug).indexOf(c.slug), prev = c.siblings[idx - 1], next = c.siblings[idx + 1];
  const pick = (k) => {
    const q = new URLSearchParams(route.q); q.set("tab", k);
    history.replaceState(null, "", "#/concept/" + slug + "?" + q); route.q = q;
    setTab(k);
    setTimeout(() => { const b = document.getElementById("tab-" + k); if (b) b.focus(); }, 0);
  };
  const onKey = (e) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const i = s.CTABS.indexOf(cur), N = s.CTABS.length, n = e.key === "Home" ? 0 : e.key === "End" ? N - 1 : (i + (e.key === "ArrowRight" ? 1 : N - 1)) % N;
    pick(s.CTABS[n]);
  };
  return (
    <div className="wf-lw-page">
      <div className="wf-concept">
        <nav className="wf-crumbs" aria-label="Breadcrumb"><a href="#/levels">Levels</a><OldIcon icon={icon} name="chevRight" /><a href={"#/level/" + c.level}>{"Level " + c.level + " · " + (L ? L.title : "")}</a><OldIcon icon={icon} name="chevRight" /><span>{c.name}</span></nav>
        <Card as="section"><div className="wf-card-pad wf-concept-head">
          <LegacyHtml label="ring" html={s.stageRing(c.stages, 92, s.stagesDone(c.stages) + "/" + s.stagesUsed(c.stages))} />
          <div className="wf-ch-body">
            <div className="wf-eyebrow">{"Concept " + (idx + 1) + " of " + c.siblings.length + " · Level " + c.level}</div>
            <h1>{c.name}{c.mastered && <>{" "}<span className="wf-pill done"><OldIcon icon={icon} name="checkCircle" />Mastered</span><LegacyHtml label="new" html={s.newItemsHtml(c)} /></>}</h1>
            <p className="wf-muted">{c.summary || ""}</p>
            <LegacyHtml label="mastery" html={s.masteryList(c)} />
          </div>
          <div className="wf-actions">
            {prev && <Button type="link" href={"#/concept/" + prev.slug} ariaLabel={"Previous concept: " + prev.name}><ChevronLeftIcon /></Button>}
            {next && <Button type="link" href={"#/concept/" + next.slug}>Next concept</Button>}
          </div>
        </div></Card>
        <h2 className="wf-sr-only" id="stages-h">Stages</h2>{/* the stages' heading, so the panels' card headings follow in order */}
        <div className="wf-stage-tabs" role="tablist" aria-labelledby="stages-h" ref={tabs} onKeyDown={onKey}>
          {s.CTABS.map((k) => {
            const on = cur === k;
            if (k === "study") return (
              <button key={k} type="button" role="tab" id="tab-study" aria-controls="panel-study" aria-selected={on} tabIndex={on ? 0 : -1} className={"wf-st-tab study" + (on ? " on" : "")} onClick={() => pick(k)}>
                <span className="wf-st-mark"><OldIcon icon={icon} name="file" /></span>Study<span className="wf-sr-only">{" (optional reading" + ((c.lessons || []).length ? "" : ", no lesson yet") + ")"}</span>
              </button>
            );
            const st = c.stages[k];
            return (
              <button key={k} type="button" role="tab" id={"tab-" + k} aria-controls={"panel-" + k} aria-selected={on} tabIndex={on ? 0 : -1} className={"wf-st-tab " + st + (on ? " on" : "")} onClick={() => pick(k)}>
                <span className="wf-st-mark" dangerouslySetInnerHTML={{ __html: s.stageMark(st) }} />{s.STAGE_LABEL[k]}<span className="wf-sr-only">{" (" + s.STAGE_STATUS[st] + ")"}</span>
              </button>
            );
          })}
        </div>
        <section className="wf-stage-panel" role="tabpanel" id={"panel-" + cur} aria-labelledby={"tab-" + cur} tabIndex={0}>
          <LegacyHtml key={cur} label="stage" keepStarted mount={s.schemaMount} html={s.stagePanel(c, cur)} />
        </section>
      </div>
    </div>
  );
}
