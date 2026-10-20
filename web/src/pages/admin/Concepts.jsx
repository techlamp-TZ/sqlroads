// Admin → Concepts (#/concepts?level=): coverage of the learning model per level and concept. Same text, calls and
// behaviour as the old view (admin.js viewConcepts): Edit opens a form row (name, summary, keywords, order), Items
// lists the tagged items with a stage picker per item (logged, undoable), Re-tag asks first (an AI run). The stage
// cells are the admin's own (stageCell), so their wording stays one copy.
import { Fragment, useEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import { AdminPage, ErrorLine, Loading, Num, Panel, useAdmin } from "../../admin/admin.jsx";
import { LegacyHtml } from "../../shared/shared.jsx";
import { OldIcon } from "../../shared/OldIcon.jsx";
import "./overview.scss";
import "./concepts.scss";

function EditRow({ c, onCancel, onSaved }) {
  const A = useAdmin();
  const first = useRef(null);
  useEffect(() => { if (first.current) first.current.focus(); }, []);
  const submit = (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const body = { name: f.elements.name.value, summary: f.elements.summary.value, keywords: f.elements.keywords.value, ord: f.elements.ord.value };
    A.api("/learning/concepts/" + c.slug, "POST", body).then(() => { A.toast("Concept saved"); onSaved(); }).catch((er) => A.toast(er.message));
  };
  return (
    <tr className="wf-lc-edit"><td colSpan={7}>
      <form className="wf-lc-form" onSubmit={submit}>
        <label className="wf-field">Name <input className="wf-control" name="name" defaultValue={c.name} required ref={first} /></label>
        <label className="wf-field">One-line summary <input className="wf-control" name="summary" defaultValue={c.summary || ""} /></label>
        <label className="wf-field">Keywords <span className="wf-muted wf-small">(comma separated)</span><input className="wf-control mono" name="keywords" defaultValue={A.kwList(c.keywords).join(", ")} /></label>
        <label className="wf-field">Order <input className="wf-control" name="ord" type="number" min="1" defaultValue={c.ord} /></label>
        <div className="wf-actions"><Button type="submit" appearance="primary" size="small">Save</Button><Button size="small" onClick={onCancel}>Cancel</Button></div>
      </form>
    </td></tr>
  );
}

function ItemsRow({ c }) {
  const A = useAdmin();
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { A.api("/learning/concepts/" + c.slug + "/items").then(setR, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the stage picker is the admin's own select ([data-tagstage], drawn as its markup): a native listener, since
  // React's change events don't reach a select it did not create
  const cell = useRef(null);
  useEffect(() => {
    const el = cell.current; if (!el) return undefined;
    const on = (e) => { if (e.target.matches && e.target.matches("[data-tagstage]")) A.setTagStage(e.target); };
    el.addEventListener("change", on);
    return () => el.removeEventListener("change", on);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <tr className="wf-lc-items"><td colSpan={7} ref={cell}>
      {error ? <div className="wf-err">{error.message}</div> : !r ? <div className="wf-empty">Loading…</div> : (
        <>
          <p className="wf-muted wf-small wf-lead-0">{r.items.length + " tagged exercises and MCQs. Changing a stage here sets only that item's stage (the concept isn't re-tagged); it is logged in Review → History and can be undone there. An item tagged with several concepts has one stage for all of them."}</p>
          <div className="wf-table-wrap">
            <table className="wf-table">
              <thead><tr><th scope="col">Item</th><th scope="col">Level</th><th scope="col">Stage</th></tr></thead>
              <tbody>{r.items.map((it) => (
                <tr key={it.key}>
                  <td>{it.kind === "mcq" && <><span className="wf-tag">MCQ</span>{" "}</>}{it.title}{!it.main && <>{" "}<span className="wf-muted wf-small">(secondary concept)</span></>}{it.status === "review" && <>{" "}<span className="wf-flag self">tag in review</span></>}{it.source === "admin" && <>{" "}<span className="wf-flag">set by hand</span></>}</td>
                  <td className="n">{it.level}</td>
                  <td><LegacyHtml label="stage" html={A.stagePicker(it.key, it.kind, it.stage)} /></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
          {r.drafts.length > 0 && <p className="wf-muted wf-small">{"Generated drafts waiting in the review queue: " + r.drafts.map((x) => x.title + " (" + x.stage + ")").join(", ")}</p>}
        </>
      )}
    </td></tr>
  );
}

function ConceptRow({ c, onReload }) {
  const A = useAdmin();
  const [edit, setEdit] = useState(false);
  const [items, setItems] = useState(false);
  const [retagging, setRetagging] = useState(false);
  const editBtn = useRef(null);
  const retag = (btn) => {
    if (!A.confirmClick(btn, "Re-tag the exercises and MCQs of “" + c.name + "”? The AI proposes their concepts again and a second provider reviews them; disagreements go to the review queue. Each item keeps its learning stage. Costs about $0.01–0.05.", "Re-tag")) return;
    setRetagging(true);
    A.api("/learning/concepts/" + c.slug + "/retag", "POST", {}).then((r) => { A.toast("Re-tagged " + r.items + " items: " + r.changed + " changed, " + r.review + " to review · $" + r.cost.toFixed(3)); A.refreshCounts(); onReload(); })
      .catch((er) => { setRetagging(false); A.toast(er.message); });
  };
  return (
    <Fragment>
      <tr data-slug={c.slug}>
        <th scope="row" className="wf-lc-name">
          <span className="mono wf-muted">{c.ord}</span>{" "}<b>{c.name}</b>
          {c.tagsInReview > 0 && <>{" "}<a className="wf-flag self" href="#/review?type=tag">{c.tagsInReview + " tag" + (c.tagsInReview === 1 ? "" : "s") + " in review"}</a></>}
          <div className="wf-muted wf-small">{c.summary || ""}</div>
        </th>
        {A.LSTAGES.map((s) => { const p = A.stageCellParts(c, s); return <td key={s} className={p.cls.replace(/\blc-/g, "wf-lc-").replace(/\bn\b/, "n")} dangerouslySetInnerHTML={{ __html: p.html.replace(/class="lc-/g, 'class="wf-lc-').replace(/class="sr-only"/g, 'class="wf-sr-only"') }} />; })}
        <td className="acts">
          <Button size="small" ref={(el) => { editBtn.current = el; if (el) el.setAttribute("aria-expanded", String(edit)); }} onClick={() => setEdit(!edit)} dataAttributes={{ "wf-lc": "edit" }}>Edit</Button>{" "}
          <Button size="small" ref={(el) => { if (el) el.setAttribute("aria-expanded", String(items)); }} onClick={() => setItems(!items)} dataAttributes={{ "wf-lc": "items" }}>Items</Button>{" "}
          <Button size="small" disabled={retagging} onClick={(e) => retag(e.currentTarget)} dataAttributes={{ "wf-lc": "retag" }}>{retagging ? "Re-tagging…" : "Re-tag"}</Button>
        </td>
      </tr>
      {edit && <EditRow c={c} onCancel={() => { setEdit(false); setTimeout(() => editBtn.current && editBtn.current.focus(), 0); }} onSaved={onReload} />}
      {items && <ItemsRow c={c} />}
    </Fragment>
  );
}

export default function ConceptsPage({ route }) {
  const A = useAdmin(), icon = A.icon;
  const lvq = Number(route && route.q && route.q.get("level")) || 0;
  const [cov, setCov] = useState(null);
  const [error, setError] = useState(null);
  const [gen, setGen] = useState(0);
  const load = () => A.api("/learning/coverage").then((x) => { setCov(x); setGen((g) => g + 1); }, setError);
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <AdminPage><ErrorLine error={error} /></AdminPage>;
  if (!cov) return <AdminPage><Loading /></AdminPage>;
  const ex = cov.exceptions || {};
  return (
    <AdminPage eyebrow="Learning model" title="Concepts" className="wf-ov"
      intro={<>
        <Num v={cov.total} />{" concepts in 14 levels. A stage is covered when its live (approved) items reach the target: " + cov.target.flashcards + " flashcards, " + cov.target.predicts + " predict-the-output, " + cov.target.practise + " practise exercises and " + cov.target.transfer + " transfer task. Reflect is covered by the learner's reflection box. Level 14 has no flashcards and no practise."}
        <span className="wf-intro-2 wf-small"><b>Understand exceptions:</b>{" " + (ex.flashcards || []).join(", ") + ": " + cov.target.flashcards + "+ flashcards and 1+ MCQ (no predict items). Level 14 project concepts: the concept card + project tasks. " + (ex.noPractiseTransfer && ex.noPractiseTransfer.length ? ex.noPractiseTransfer.join(", ") + ": no practise or transfer (random results can't be checked). " : "") + " Predict items for data/structure concepts can be \"predict the end state\" items (a short MySQL or PostgreSQL script: final table or failing statement)."}</span>
      </>}>
      <section className="wf-card-plain"><div className="wf-kpis" aria-label="Coverage" role="group">
        <div className="wf-kpi"><span className="wf-kpi-l">All 5 stages covered</span><span className="wf-kpi-v mono">{cov.pct + "%"}</span><span className="wf-kpi-s">{cov.covered + " of " + cov.total + " concepts, live"}</span></div>
        <div className="wf-kpi"><span className="wf-kpi-l">Once drafts are approved</span><span className="wf-kpi-v mono">{cov.pctWithDrafts + "%"}</span><span className="wf-kpi-s">{cov.coveredWithDrafts + " of " + cov.total + " concepts"}</span></div>
        {A.LSTAGES.filter((s) => s !== "reflect").map((s) => <div className="wf-kpi" key={s}><span className="wf-kpi-l">{A.LSTAGE_LABEL[s] + " gaps"}</span><span className={"wf-kpi-v mono" + (cov.gapCount[s] ? " wf-bad-txt" : "")}>{cov.gapCount[s]}</span><span className="wf-kpi-s">concepts below target</span></div>)}
      </div></section>
      <div className="wf-segs wf-lvl-pick" role="group" aria-label="Level">
        <a className={"wf-seg" + (!lvq ? " on" : "")} href="#/concepts" aria-current={!lvq ? "true" : undefined}>All</a>
        {cov.levels.map((L) => (
          <a key={L.level} className={"wf-seg" + (lvq === L.level ? " on" : "")} href={"#/concepts?level=" + L.level} aria-current={lvq === L.level ? "true" : undefined}>
            {L.level}{L.covered < L.total && <>{" "}<span className="wf-seg-gap" aria-label={(L.total - L.covered) + " with gaps"}>{L.total - L.covered}</span></>}
          </a>
        ))}
      </div>
      {cov.levels.filter((L) => !lvq || L.level === lvq).map((L) => (
        <Panel key={L.level + ":" + gen} aria-labelledby={"lc-" + L.level}>
          <div className="wf-panel-h">
            <h3 id={"lc-" + L.level}><OldIcon icon={icon} name="levels" />{"Level " + L.level}</h3>
            <span className="wf-muted wf-small">{L.covered + " of " + L.total + " concepts fully covered"}</span>
            <Button type="link" size="small" href={"#/generate?kind=stage&level=" + L.level}>Fill gaps for this level</Button>
          </div>
          <div className="wf-table-wrap">
            <table className="wf-table wf-lcov-t">
              <caption className="wf-sr-only">{"Stage coverage of the Level " + L.level + " concepts"}</caption>
              <thead><tr><th scope="col">Concept</th>{A.LSTAGES.map((s) => <th scope="col" className="n" key={s}>{A.LSTAGE_LABEL[s]}</th>)}<th scope="col"><span className="wf-sr-only">Actions</span></th></tr></thead>
              <tbody>{L.concepts.map((c) => <ConceptRow key={c.slug} c={c} onReload={load} />)}</tbody>
            </table>
          </div>
        </Panel>
      ))}
    </AdminPage>
  );
}
