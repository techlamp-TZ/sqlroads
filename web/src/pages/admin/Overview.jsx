// Admin → Overview (#/overview): key numbers, quick actions, learning-model coverage, the library by level (sort,
// "needs attention"), content gaps, library health (run + 2 s polling), recently added, AI generation and spend, the
// system (checked every 60 s) and learner activity. Same text, calls and behaviour as the old view (admin.js
// viewOverview, renderLevels, loadLearningCard, loadSystem); the editor and import dialogs are the admin's own.
import { useEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import { AdminPage, ErrorLine, Loading, Num, Panel, useAdmin, useTimer } from "../../admin/admin.jsx";
import { LegacyHtml } from "../../shared/shared.jsx";
import { OldIcon } from "../../shared/OldIcon.jsx";
import { HealthList } from "./Health.jsx";
import "./health.scss";
import "./overview.scss";

let lvlState = { sort: "level", attention: false }; // kept for the visit, as before

function Head({ icon, ic, id, title, more }) {
  return <div className="wf-panel-h"><h3 id={id}><OldIcon icon={icon} name={ic} />{title}</h3>{more && <a className="wf-link" href={more[0]}>{more[1]}</a>}</div>;
}

function Coverage({ A }) {
  const [cov, setCov] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { A.api("/learning/coverage").then(setCov, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <div className="wf-err">{error.message}</div>;
  if (!cov) return <div className="wf-empty">Loading…</div>;
  return (
    <>
      <div className="wf-lm-big"><span className="mono">{cov.pct + "%"}</span><span>of concepts have all 5 stages covered<br /><span className="wf-muted wf-small">{cov.covered + " of " + cov.total + " live · " + cov.pctWithDrafts + "% once drafts are approved"}</span></span></div>
      <div className="wf-lm-bar" role="img" aria-label={cov.pct + "% covered"}><span style={{ width: cov.pct + "%" }} /></div>
      <ul className="wf-mini wf-lm-gaps">
        {A.LSTAGES.filter((s) => s !== "reflect").map((s) => <li key={s}>{A.LSTAGE_LABEL[s] + ": "}<b className={"mono" + (cov.gapCount[s] ? " wf-bad-txt" : "")}>{cov.gapCount[s]}</b>{" " + (cov.gapCount[s] === 1 ? "concept" : "concepts") + " below target"}</li>)}
        <li>Reflect: covered by the reflection box</li>
      </ul>
    </>
  );
}

function Levels({ A, s }) {
  const [st, setSt] = useState(lvlState);
  const set = (v) => { lvlState = { ...st, ...v }; setSt(lvlState); };
  const max = Math.max.apply(null, s.levels.map((L) => L.total));
  let rows = s.levels.slice();
  if (st.attention) rows = rows.filter((L) => L.flags.length);
  const by = { level: (a, b) => a.n - b.n, largest: (a, b) => b.total - a.total, easy: (a, b) => a.easy / a.total - b.easy / b.total, self: (a, b) => b.selfCheck / b.total - a.selfCheck / a.total }[st.sort];
  rows.sort(by);
  const sum = (k) => rows.reduce((a, L) => a + L[k], 0);
  const T = { total: sum("total"), easy: sum("easy"), medium: sum("medium"), hard: sum("hard"), self: sum("selfCheck"), done: sum("done") };
  const sortBtn = (v, label) => <button key={v} type="button" className={"wf-seg" + (st.sort === v ? " on" : "")} aria-pressed={st.sort === v} onClick={() => set({ sort: v })}>{label}</button>;
  const seg = (L, k) => (L[k] ? <span key={k} style={{ flex: L[k], background: A.DIFF_COLORS[k] }} /> : null);
  return (
    <>
      <div className="wf-lvl-tools">
        <div className="wf-segs" role="group" aria-label="Sort levels">{sortBtn("level", "Level order")}{sortBtn("largest", "Largest")}{sortBtn("easy", "Fewest easy (by %)")}{sortBtn("self", "Most self-check (by %)")}</div>
        <label className="wf-switch"><input type="checkbox" role="switch" id="attn" checked={st.attention} onChange={(e) => set({ attention: e.target.checked })} /><span className="wf-sw" aria-hidden="true" />Only levels that need attention</label>
      </div>
      <div className="wf-table-wrap" id="lvlTable">
        <table className="wf-table wf-lvl-t">
          <caption className="wf-sr-only">Library by level</caption>
          <thead><tr><th scope="col">Level</th><th scope="col">Size &amp; mix</th><th scope="col" className="n">Total</th><th scope="col" className="n">E / M / H</th><th scope="col" className="n">Self-check</th><th scope="col" className="n">Done %</th><th scope="col"><span className="wf-sr-only">Actions</span></th></tr></thead>
          <tbody>
            {rows.length ? rows.map((L) => (
              <tr key={L.n}>
                <th scope="row" className="wf-lvl-name"><span className="mono wf-muted">{L.n}</span>{" " + L.title}{L.flags.length > 0 && <span className="wf-flags">{L.flags.map((f, i) => <span key={i} className={"wf-flag " + f.kind}>{f.text}</span>)}</span>}</th>
                <td className="wf-mix-cell"><div className="wf-mix" role="img" aria-label={L.total + " exercises: " + L.easy + " easy, " + L.medium + " medium, " + L.hard + " hard"}><div className="wf-mix-bar" style={{ width: (max ? (100 * L.total) / max : 0).toFixed(1) + "%" }}>{seg(L, "easy")}{seg(L, "medium")}{seg(L, "hard")}</div></div></td>
                <td className="n">{L.total.toLocaleString()}</td><td className="n">{L.easy + " / " + L.medium + " / " + L.hard}</td>
                <td className="n">{L.selfCheck + " "}<span className="wf-muted">{"(" + L.selfPct + "%)"}</span></td><td className="n">{L.donePct + "%"}</td>
                <td className="acts"><Button type="link" size="small" href={"#/library?level=" + L.n} ariaLabel={"Open level " + L.n}>Open</Button>{" "}<Button type="link" size="small" href={"#/generate?level=" + L.n} ariaLabel={"Add exercises to level " + L.n}>Add</Button></td>
              </tr>
            )) : <tr><td colSpan={7} className="wf-empty">No level needs attention.</td></tr>}
          </tbody>
          <tfoot><tr><th scope="row">{rows.length === s.levels.length ? "All " + rows.length + " levels" : rows.length + " levels shown"}</th><td /><td className="n">{T.total.toLocaleString()}</td><td className="n">{T.easy + " / " + T.medium + " / " + T.hard}</td><td className="n">{T.self}</td><td className="n">{(T.total ? Math.round((100 * T.done) / T.total) : 0) + "%"}</td><td /></tr></tfoot>
        </table>
      </div>
      <div className="wf-mix-key" aria-hidden="true">{["easy", "medium", "hard"].map((k) => <span key={k}><i style={{ background: A.DIFF_COLORS[k] }} />{k[0].toUpperCase() + k.slice(1)}</span>)}</div>
    </>
  );
}

function System({ A, footer }) {
  const [sys, setSys] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const load = () => A.api("/system").then((x) => { if (live) { setSys(x); setFailed(false); } }, () => { if (live) setFailed(true); });
    load();
    const t = setInterval(load, 60000); // every minute while the page is open, as before
    return () => { live = false; clearInterval(t); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const dot = (state) => <LegacyHtml label="state" html={A.stateDot(state)} />;
  const row = (name, state, sub) => <div className="wf-sys-row"><div><b>{name}</b>{sub && <span className="wf-muted wf-small">{sub}</span>}</div>{dot(state)}</div>;
  let body;
  if (failed) body = <div className="wf-sys-row"><b>Status</b>{dot("unknown")}</div>;
  else if (!sys) body = <div className="wf-empty">Checking…</div>;
  else {
    const ready = sys.providers.filter((p) => p.state === "ready").length;
    body = (
      <>
        <div className="wf-sys-row"><div><b>AI providers (Auto chain)</b><span className="wf-muted wf-small">{sys.providers.map((p) => p.label + ": " + p.detail.split(" · ")[0]).join(" · ")}</span></div>{dot(ready === sys.providers.length ? "ready" : ready ? "failing" : "missing")}</div>
        <div className="wf-sys-sub">{sys.providers.map((p) => <div className="wf-sys-row sm" key={p.label}><span>{p.label + " "}<span className="wf-muted mono wf-small">{p.model || ""}</span></span>{dot(p.state)}</div>)}</div>
        {row("MySQL checker", sys.mysql.state, "serves " + sys.mysql.serves.toLocaleString() + " exercises")}
        {row("PostgreSQL checker", sys.postgres.state, sys.postgres.serves.toLocaleString() + " exercises have a PostgreSQL version")}
        {row("Browser datasets", sys.browser.state, sys.browser.datasets + " datasets · " + sys.browser.serves.toLocaleString() + " exercises")}
      </>
    );
  }
  return (
    <>
      <div className="wf-panel-h"><h3 id="s-h"><OldIcon icon={A.icon} name="cog" />System</h3><span className="wf-muted wf-small" id="sysAt">{sys ? <>checked <span className="mono">{new Date(sys.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span></> : "checking…"}</span></div>
      <div id="sysBody" aria-live="polite">{body}</div>
      <p className="wf-sys-foot"><Num v={footer.links} />{" cross-links · "}<Num v={footer.duplicates} />{" duplicates removed · "}<Num v={footer.bookmarks} />{" bookmarks"}</p>
    </>
  );
}

export default function OverviewPage({ route }) {
  const A = useAdmin(), icon = A.icon;
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [health, setHealth] = useState(null);
  const [backingUp, setBackingUp] = useState(false);
  const [starting, setStarting] = useState(false);
  const live = useRef(true);
  const timer = useTimer();
  useEffect(() => () => { live.current = false; }, []);
  const load = () => A.api("/dashboard").then((x) => { if (!live.current) return; setD(x); setHealth(x.health); if (x.health.running) poll(); }, setError);
  const poll = () => A.api("/health").then((h) => { if (!live.current) return; setHealth(h); A.setCount("health", h.open); if (h.running) timer(poll, 2000); });
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runHealth = () => {
    setStarting(true);
    A.api("/health/run", "POST").then((r) => { setStarting(false); A.toast(r.started ? "Health check started: it runs in the background" : r.message); poll(); }).catch((e) => { setStarting(false); A.toast(e.message); });
  };
  const backUp = () => {
    setBackingUp(true);
    A.api("/backups", "POST").then((b) => {
      setBackingUp(false); setD((x) => ({ ...x, lastBackup: b.created_at }));
      A.toast("Backup saved: " + b.name);
      const link = document.createElement("a"); link.href = "/api/admin/backups/" + encodeURIComponent(b.name) + "/download"; link.download = b.name; document.body.appendChild(link); link.click(); link.remove();
    }).catch((e) => { setBackingUp(false); A.toast(e.message); });
  };
  const write = () => A.openEditor("drill", null, () => { A.refreshCounts(); load(); }, { write: true });

  if (error) return <AdminPage><ErrorLine error={error} /></AdminPage>;
  if (!d) return <AdminPage><Loading /></AdminPage>;
  const k = d.kpis, s = d.summary;
  const cell = (label, value, sub, href) => <a className="wf-kpi" href={href} key={label}><span className="wf-kpi-l">{label}</span><span className="wf-kpi-v mono">{value}</span><span className="wf-kpi-s">{sub}</span></a>;
  const tile = (ic, title, text, props) => {
    const inner = <><span className="wf-qa-ic"><OldIcon icon={icon} name={ic} /></span><span className="wf-qa-t">{title}</span><span className="wf-qa-s">{text}</span></>;
    return props.href ? <a className="wf-qa" href={props.href} key={title}>{inner}</a> : <button type="button" className="wf-qa" key={title} onClick={props.onClick} disabled={props.disabled}>{inner}</button>;
  };
  const total30 = Object.keys(d.activity).reduce((a, x) => a + d.activity[x], 0);
  return (
    <AdminPage className="wf-ov" eyebrow="Overview" title="Content & learning"
      intro={<><Num v={k.exercises} />{" exercises in " + s.levels.length + " levels, "}<Num v={k.mcq.total} />{" live MCQs. Library built "}<span className="mono">{A.fmtDate(s.builtAt, true)}</span>.</>}
      actions={<div className="wf-muted wf-small">Last backup: <span className="mono">{A.fmtDate(d.lastBackup, true)}</span></div>}>
      <Card as="section"><div className="wf-kpis" aria-label="Key numbers" role="group">
        {cell("Exercises", k.exercises.toLocaleString(), <><Num v={k.browser} />{" in browser · "}<Num v={k.server} />{" on server"}</>, "#/library")}
        {cell("Self-check", k.selfCheck.toLocaleString(), k.selfPct + "% can't be auto-checked", "#/library?check=self")}
        {cell("MCQs", k.mcq.total.toLocaleString(), <><Num v={k.mcq.easy} />{" easy · "}<Num v={k.mcq.medium} />{" medium · "}<Num v={k.mcq.hard} />{" hard"}</>, "#/mcqs")}
        {cell("Review queue", k.queue.toLocaleString(), k.queue ? <><Num v={k.queue} />{" waiting"}</> : "nothing waiting", "#/review")}
        {cell("Completed by learners", k.completed30.toLocaleString(), "last 30 days", "#/learners")}
      </div></Card>
      <div className="wf-qas">
        {tile("spark", "Generate drills", "AI drafts, checked, then reviewed", { href: "#/generate?kind=drill" })}
        {tile("edit", "Write an exercise", "Level, prompt, solution; validated first", { onClick: write })}
        {tile("download", "Import exercises", "CSV or JSON, every solution is run", { onClick: () => A.openImport() })}
        {tile("archive", "Back up library", <>Last backup: <span className="mono" id="lastBk">{A.fmtDate(d.lastBackup, true)}</span></>, { onClick: backUp, disabled: backingUp })}
      </div>
      <div className="wf-ov-grid">
        <div className="wf-ov-main">
          <Panel aria-labelledby="lm-h"><Head icon={icon} ic="layers" id="lm-h" title="Learning model coverage" more={["#/concepts", "Concepts"]} /><div id="lmCard" aria-live="polite"><Coverage A={A} /></div></Panel>
          <Panel aria-labelledby="lvl-h"><Head icon={icon} ic="levels" id="lvl-h" title="Library by level" more={["#/library", "Open the library"]} /><Levels A={A} s={s} /></Panel>
        </div>
        <div className="wf-ov-side">
          <Panel aria-labelledby="gap-h"><Head icon={icon} ic="warn" id="gap-h" title="Content gaps" />
            {d.gaps.length ? <div className="wf-gaps">{d.gaps.map((g, i) => <div key={i} className={"wf-gap " + g.kind}><b>{g.title}</b><p>{g.text}</p><Button type="link" size="small" href={g.href}>{g.action}</Button></div>)}</div> : <div className="wf-empty">No level is flagged.</div>}
          </Panel>
          <Panel aria-labelledby="h-h"><Head icon={icon} ic="heart" id="h-h" title="Library health" more={["#/health", "Open"]} /><div id="healthCard"><HealthList h={health} onRun={runHealth} running={starting} /></div></Panel>
          <Panel aria-labelledby="r-h"><Head icon={icon} ic="clock" id="r-h" title="Recently added" more={["#/recent", "Open"]} />
            {d.recent.count ? (
              <>
                <p className="wf-big-n"><Num v={d.recent.count} />{" "}<span className="wf-muted wf-small">new since the starting library</span></p>
                <ul className="wf-mini">{d.recent.items.map((i, n) => <li key={n}>{i.kind === "exercise" ? <a href={"#/item/" + i.id}>{i.title}</a> : i.title}{" "}<span className="wf-muted wf-small">{"· " + (i.level ? "L" + i.level + " · " : "") + (i.diff || "") + " · " + i.origin + " · " + A.fmtDate(i.added_at)}</span></li>)}</ul>
              </>
            ) : <p className="wf-muted wf-flush"><Num v={0} />{" new since the starting library ("}<Num v={d.recent.baseline} />{" imported 12–13 Oct)."}</p>}
          </Panel>
          <Panel aria-labelledby="g-h"><Head icon={icon} ic="spark" id="g-h" title="AI generation" more={["#/generate", "Generate"]} />
            <dl className="wf-kv3"><div><dt>Runs this week</dt><dd><Num v={d.gen.runs} /></dd></div><div><dt>Drafts passed all checks</dt><dd className="mono">{d.gen.passedPct == null ? "–" : d.gen.passedPct + "%"}</dd></div><div><dt>Drafts approved</dt><dd className="mono">{d.gen.approvedPct == null ? "–" : d.gen.approvedPct + "%"}</dd></div></dl>
            <LegacyHtml label="spend" html={A.spendHtml(d.spend)} />
          </Panel>
          <Panel aria-labelledby="s-h"><System A={A} footer={d.footer} /></Panel>
          <Panel aria-labelledby="act-h" className="wf-wide"><Head icon={icon} ic="chart" id="act-h" title="Learner activity" />
            {total30 ? <LegacyHtml label="chart" html={A.barChart(d.activity)} /> : <div className="wf-empty">No completions yet. The 30-day chart appears once learners complete exercises.</div>}
          </Panel>
        </div>
      </div>
    </AdminPage>
  );
}
