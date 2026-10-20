// Admin → Library health (#/health): the last run's checks, the outcome bars, a check's rows (?check=), near-duplicate
// decisions, and the reference-answers card. Same text, calls and behaviour as the old view (admin.js viewHealth):
// the run is polled every 2 s while it runs; the nav badge follows the open count.
import { useEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import { ChevronLeftIcon, ChevronRightIcon, PlayIcon } from "@waffles/icons";
import { AdminPage, ErrorLine, Loading, Num, Panel, useAdmin, useTimer } from "../../admin/admin.jsx";
import "./health.scss";

const HEALTH_HELP = {
  near_dups: "In-browser drills whose prompts share at least 55% of their words. Many are the same task on different datasets: keep both, merge (progress carries over), or delete one.",
  failing: "Solutions that don't pass their own check: server exercises are run through the MySQL checker (rolled back), drills added in admin on their dataset.",
  leftover: "Titles or summaries that still contain text from the original source.",
  no_summary: "Exercises with a short title and no one-line summary, so the list says little about them.",
  broken_links: "Links inside a prompt to an exercise that is no longer in the library.",
  auto_setup: "Setup exercises hidden from learners: the checker runs them silently before the exercises listed under each one.",
};
const DECISION_WORDS = { keep_both: "Keep both exercises?", merge: "Merge: keep the chosen one and move the other's progress to it?", delete: "Delete the other exercise from the library? (Its source text stays on disk.)" };

/** A stacked bar and its legend (the old .outcome). parts: [className, label, count] */
export function Outcome({ label, parts, total }) {
  return (
    <div className="wf-outcome">
      <div className="wf-ob" role="img" aria-label={label}>{parts.map(([k, , v]) => (v ? <span key={k} className={"wf-seg-" + k} style={{ flex: v }} /> : null))}</div>
      <ul className="wf-ol">
        {parts.map(([k, text, v]) => <li key={k}><i className={"wf-seg-" + k} /><span className="mono">{v.toLocaleString()}</span>{" " + text}</li>)}
        <li className="wf-tot">{total}</li>
      </ul>
    </div>
  );
}

function HealthList({ h, onRun, running }) {
  const A = useAdmin();
  const o = h.outcome, dr = h.drills;
  return (
    <>
      <div className="wf-h-run">
        <Button size="small" onClick={onRun} disabled={h.running || running} dataAttributes={{ act: "health-run" }}>{[<PlayIcon key="i" />, h.running ? "Running…" : "Run health check"]}</Button>
        <span className="wf-muted wf-small" id="hProg">{h.running ? (h.progress || "Running…") : h.lastRun ? <>Last run: <span className="mono">{A.fmtDate(h.lastRun, true)}</span></> : "Not run yet"}</span>
      </div>
      {h.lastError && <div className="wf-err">{h.lastError}</div>}
      {!h.checks.length ? <div className="wf-empty">Run the check to see near-duplicates, failing solutions, leftover text, missing summaries and broken links.</div> : (
        <>
          {o && <Outcome
            label={"Every exercise counted once: " + o.ok + " ran OK, " + o.failed + " failed, " + o.self + " self-check, " + o.dependent + " depend on an earlier exercise, " + o.noref + " have no reference answer, " + o.total + " in total"}
            parts={[["ok", "ran OK", o.ok], ["failed", "failed", o.failed], ["self", "self-check", o.self], ["dependent", "depend on an earlier exercise", o.dependent], ["noref", "no reference answer", o.noref]]}
            total={<><span className="mono">{"= " + o.total.toLocaleString()}</span> exercises, each counted once</>} />}
          {dr && <Outcome
            label={"Built-in drills: " + dr.auto + " auto-checked, " + dr.self + " self-check, " + dr.review + " in review, " + dr.unchecked + " still unchecked, of " + dr.total}
            parts={[["ok", "auto-checked", dr.auto], ["selfchk", "self-check", dr.self], ["self", "in review", dr.review], ["noref", "still unchecked", dr.unchecked]]}
            total={<><span className="mono">{"= " + dr.total.toLocaleString()}</span> built-in drills · <a href="#/review">review queue</a></>} />}
          <ul className="wf-h-list">
            {h.checks.map((c) => (
              <li key={c.key}><a href={"#/health?check=" + c.key}><span>{c.label}</span><span className={"wf-h-n mono " + (c.issue ? (c.count ? "bad" : "ok") : "info")}>{c.count.toLocaleString()}</span></a></li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}

function Pair({ p, onDecide }) {
  const side = (x, label) => (
    <div className="wf-pair-side">
      <div className="wf-muted wf-small">{label + " · Level " + x.level + " · " + x.diff + " · "}<span className="mono">{x.tables.join(", ") || x.dataset}</span></div>
      <a href={"#/item/" + x.id}><b>{x.title}</b></a>
      <p className="wf-small">{x.body.slice(0, 260)}</p>
    </div>
  );
  const btn = (dec, keep, text, danger) => (
    <Button size="small" intent={danger ? "danger" : "neutral"} onClick={(e) => onDecide(e.currentTarget, p, dec, keep)} dataAttributes={keep ? { dec, keep: String(keep) } : { dec }}>{text}</Button>
  );
  return (
    <div className="wf-pair" data-a={p.a} data-b={p.b}>
      <div className="wf-pair-h"><span className="mono">{p.sim + "% similar"}</span>{p.sameDataset ? <span className="wf-flag">same dataset</span> : <span className="wf-muted wf-small">different datasets</span>}</div>
      <div className="wf-pair-body">{side(p.left, "A")}{side(p.right, "B")}</div>
      <div className="wf-actions">
        {btn("keep_both", null, "Keep both")}{btn("merge", p.a, "Merge, keep A")}{btn("merge", p.b, "Merge, keep B")}
        <span className="wf-grow" />
        {btn("delete", p.b, "Delete A", true)}{btn("delete", p.a, "Delete B", true)}
      </div>
    </div>
  );
}

function Detail({ k, h, det, page, onDecide }) {
  const c = h.checks.filter((x) => x.key === k)[0];
  let body;
  if (!det.rows.length) body = <div className="wf-empty">Nothing here.</div>;
  else if (k === "near_dups") {
    const size = 15, rows = det.rows.slice(page * size, page * size + size), pages = Math.ceil(det.rows.length / size);
    body = (
      <>
        {rows.map((p) => <Pair key={p.a + "-" + p.b} p={p} onDecide={onDecide} />)}
        {pages > 1 && (
          <div className="wf-pager-row">
            <span className="mono">{(page * size + 1) + "–" + Math.min(det.rows.length, (page + 1) * size) + " of " + det.rows.length}</span>
            <span className="wf-grow" />
            {page > 0 && <Button type="link" size="small" href={"#/health?check=near_dups&page=" + (page - 1)} ariaLabel="Previous page"><ChevronLeftIcon /></Button>}
            {page < pages - 1 && <Button type="link" size="small" href={"#/health?check=near_dups&page=" + (page + 1)} ariaLabel="Next page"><ChevronRightIcon /></Button>}
          </div>
        )}
      </>
    );
  } else if (k === "auto_setup") {
    body = det.rows.map((x) => (
      <div className="wf-setup" key={x.id}>
        <a href={"#/item/" + x.id}><b>{x.title}</b></a> <span className="wf-muted wf-small">{x.detail}</span>
        <ul className="wf-mini">{x.supports.map((p) => <li key={p.id}><a href={"#/item/" + p.id}>{p.title}</a> <span className="wf-muted wf-small">{"· Level " + p.level}</span></li>)}</ul>
      </div>
    ));
  } else {
    body = (
      <div className="wf-table-wrap" tabIndex={0} role="group" aria-label={c ? c.label : k}>
        <table className="wf-table">
          <thead><tr><th scope="col">Exercise</th><th scope="col">Level</th><th scope="col">Detail</th></tr></thead>
          <tbody>{det.rows.map((x) => <tr key={x.id}><td><a href={"#/item/" + x.id}><b>{x.title}</b></a></td><td>{x.level}</td><td className="wf-small">{x.detail || ""}</td></tr>)}</tbody>
        </table>
      </div>
    );
  }
  return (
    <Panel>
      <div className="wf-panel-h">
        <h3>{c ? c.label : k} <span className="mono wf-muted">{c ? c.count : det.rows.length}</span></h3>
        <a className="wf-link" href="#/health">Close</a>
      </div>
      <p className="wf-muted wf-small wf-help-line">{(HEALTH_HELP[k] || "") + (c && c.note ? " " + c.note + "." : "")}</p>
      {body}
    </Panel>
  );
}

/** The reference-answers card: the admin's shared piece (it starts AI runs), mounted into #refsCard as before. */
function RefsCard() {
  const A = useAdmin();
  useEffect(() => { A.loadRefs(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <section className="card card-pad wf-legacy-card" id="refsCard" aria-live="polite"><div className="empty-sm">Loading…</div></section>;
}

export default function HealthPage({ route }) {
  const A = useAdmin();
  const q = (route && route.q) || new URLSearchParams();
  const key = q.get("check"), page = Number(q.get("page")) || 0;
  const [h, setH] = useState(null);
  const [det, setDet] = useState(null);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);
  const timer = useTimer();
  const live = useRef(true);
  useEffect(() => () => { live.current = false; }, []);

  const load = () => Promise.all([A.api("/health"), key ? A.api("/health/" + key) : Promise.resolve(null)]).then(([hh, d]) => {
    if (!live.current) return;
    A.setCount("health", hh.open);
    setH(hh); setDet(d);
    if (hh.running) poll();
  }, setError);
  // while a run is going: refresh the list every 2 s; when it ends, the whole page again
  const poll = () => A.api("/health").then((hh) => {
    if (!live.current) return;
    setH(hh); A.setCount("health", hh.open);
    if (hh.running) timer(poll, 2000); else load();
  });
  useEffect(() => { load(); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = () => {
    setStarting(true);
    A.api("/health/run", "POST").then((r) => { setStarting(false); A.toast(r.started ? "Health check started: it runs in the background" : r.message); poll(); })
      .catch((e) => { setStarting(false); A.toast(e.message); });
  };
  const decide = (btn, p, dec, keep) => {
    if (!A.confirmClick(btn, DECISION_WORDS[dec])) return;
    A.api("/health/decide", "POST", { a: p.a, b: p.b, decision: dec, keep: keep }).then(() => {
      A.toast(dec === "keep_both" ? "Kept both" : dec === "merge" ? "Merged" : "Deleted"); A.refreshCounts(); load();
    }).catch((er) => A.toast(er.message));
  };

  if (error) return <AdminPage><ErrorLine error={error} /></AdminPage>;
  if (!h) return <AdminPage><Loading /></AdminPage>;
  return (
    <AdminPage eyebrow="Library health" title={h.checks.length ? <><Num v={h.open} />{" open issues"}</> : "Not checked yet"} intro="Checks run in the background; the counts below are from the last run.">
      <Panel id="healthCard"><HealthList h={h} onRun={run} running={starting} /></Panel>
      <RefsCard />
      {det && <Detail k={key} h={h} det={det} page={page} onDecide={decide} />}
    </AdminPage>
  );
}
