// Admin → AI & settings (#/settings): providers and the test prompt, generation roles, provider order, the system
// changes on this computer's MySQL, the course-database reset, and the .env reference. Same text, calls and behaviour
// as the old view (admin.js viewSettings, loadRoles(full), loadOrder). Keys are never sent to the browser.
import { useEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import { CogIcon, DesktopIcon, ListIcon, PlayIcon, SparklesIcon } from "@waffles/icons";
import { AdminPage, ErrorLine, Loading, Panel, PanelHead, useAdmin } from "../../admin/admin.jsx";
import "./settings.scss";

const ROLE_LABEL = { generator: "Generates", reviewer: "Reviews", tieBreaker: "Breaks ties" };
const PROV_LABEL = { openai: "OpenAI", deepseek: "DeepSeek", claude: "Claude" };
const ENV = [["OPENAI_API_KEY / OPENAI_MODEL", "OpenAI key, and the model for learners' hints (default gpt-5-nano)"], ["GENERATOR_MODEL", "OpenAI model for content generation (default gpt-4.1-mini)"], ["ANTHROPIC_API_KEY / ANTHROPIC_MODEL", "Claude key and model (default claude-haiku-4-5)"], ["DEEPSEEK_API_KEY / DEEPSEEK_MODEL", "DeepSeek key and model (default deepseek-flash; the reviewer)"], ["HINT_PROVIDER_ORDER", "Fallback order for Auto, e.g. openai,claude,deepseek"]];
const SYS_LABELS = { now: "Now", persisted: "Persisted by MySQL", myIni: "In my.ini", exists: "User exists", scratchNow: "Scratch databases right now", error: "Status" };
const price = (p) => (p ? "$" + p[0] + " in / $" + p[1] + " out per million tokens" : "price unknown");

function Providers({ list }) {
  const A = useAdmin();
  const ready = list.filter((p) => p.configured);
  const [pick, setPick] = useState(ready[0] ? ready[0].id : "");
  const [out, setOut] = useState("");
  // one short prompt to the chosen provider (a real call, so it is only ever sent by a click)
  const test = () => {
    setOut("Asking…");
    A.api("/providers/test", "POST", { provider: pick }).then((r) => setOut(r.label + " (" + r.model + ") answered in " + r.ms + " ms: " + r.text)).catch((e) => setOut(e.message));
  };
  return (
    <Panel>
      {list.map((p) => (
        <div className="wf-prov" key={p.id}>
          <span className={"wf-st" + (p.configured ? " on" : "")} aria-hidden="true" />
          <div><b>{p.label}</b>{p.model ? <>{" "}<span className="wf-muted wf-small">{p.model}</span></> : null}</div>
          <span className="wf-muted wf-small">{p.configured ? "ready" : "no API key"}</span>
        </div>
      ))}
      <div className="wf-actions wf-prov-test">
        <select className="wf-control wf-auto" id="tp" aria-label="Provider for the test prompt" value={pick} onChange={(e) => setPick(e.target.value)}>
          {ready.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <Button onClick={test} dataAttributes={{ act: "test" }}>{[<PlayIcon key="i" />, "Send a test prompt"]}</Button>
        <span id="tpOut" className="wf-muted wf-small">{out}</span>
      </div>
    </Panel>
  );
}

function Roles() {
  const A = useAdmin();
  const [roles, setRoles] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { A.api("/ai-roles").then(setRoles, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel id="rolesCard" aria-labelledby="roles-h">
      {error ? <ErrorLine error={error} /> : !roles ? <div className="wf-empty">Loading…</div> : (
        <>
          <PanelHead id="roles-h" icon={<SparklesIcon aria-hidden="true" />} title="Content generation roles" />
          <p className="wf-muted wf-small wf-lead">One provider generates, a different one reviews, Claude Sonnet breaks ties. If the tie-breaker can't run (e.g. no Anthropic credit), the item is flagged for manual review instead.</p>
          <div className="wf-table-wrap" tabIndex={0} role="group" aria-label="Content generation roles">
            <table className="wf-table">
              <thead><tr><th scope="col">Role</th><th scope="col">Provider</th><th scope="col">Model</th><th scope="col">Price</th><th scope="col">Key</th></tr></thead>
              <tbody>{roles.map((r) => (
                <tr key={r.role}><td>{ROLE_LABEL[r.role]}</td><td>{PROV_LABEL[r.provider]}</td><td className="mono">{r.model}</td><td className="wf-small">{price(r.price)}</td>
                  <td>{r.configured ? <span className="wf-ok-txt">set</span> : <span className="wf-bad-txt">missing</span>}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}

const NAMES = { claude: "Claude", openai: "OpenAI", deepseek: "DeepSeek" };
function Order() {
  const A = useAdmin();
  const [st, setSt] = useState(null);
  const [msg, setMsg] = useState("");
  const box = useRef(null);
  const focusAfter = useRef(null);
  useEffect(() => { A.api("/settings/providers").then(setSt); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // after a move the same arrow keeps focus (when it is still enabled), as before
  useEffect(() => {
    const f = focusAfter.current; focusAfter.current = null;
    if (f && box.current) { const b = box.current.querySelector(`[data-ord="${f[0]}"][data-id="${f[1]}"][data-dir="${f[2]}"]`); if (b && !b.disabled) b.focus(); }
  });
  const move = (kind, id, dir) => {
    const list = st[kind].slice(), i = list.indexOf(id), j = i + dir;
    if (j < 0 || j >= list.length) return;
    list.splice(j, 0, list.splice(i, 1)[0]);
    focusAfter.current = [kind, id, dir];
    setSt({ ...st, [kind]: list }); setMsg("Not saved yet");
  };
  const reset = () => { setSt({ ...st, generate: st.defaults["order.generate"].slice(), review: st.defaults["order.review"].slice() }); setMsg("Defaults restored: not saved yet"); };
  const save = () => A.api("/settings/providers", "PUT", { generate: st.generate, review: st.review }).then((o) => { setSt(o); setMsg("Saved"); A.toast("Provider order saved"); });
  const col = (kind, title, help) => (
    <div className="wf-order-col">
      <h4>{title}</h4>
      <p className="wf-muted wf-small">{help}</p>
      <ol className="wf-order-list" aria-label={title}>
        {st[kind].map((id, k, all) => (
          <li key={id}>
            <span className="mono wf-muted">{k + 1}</span><b>{NAMES[id]}</b><span className="wf-grow" />
            <button type="button" className="wf-arrow" data-ord={kind} data-id={id} data-dir="-1" aria-label={"Move " + NAMES[id] + " up in " + title} disabled={k === 0} onClick={() => move(kind, id, -1)}>↑</button>
            <button type="button" className="wf-arrow" data-ord={kind} data-id={id} data-dir="1" aria-label={"Move " + NAMES[id] + " down in " + title} disabled={k === all.length - 1} onClick={() => move(kind, id, 1)}>↓</button>
          </li>
        ))}
      </ol>
    </div>
  );
  return (
    <Panel id="orderCard">
      {!st ? <div className="wf-empty">Loading…</div> : (
        <div ref={box}>
          <PanelHead icon={<ListIcon aria-hidden="true" />} title="Provider order" />
          <div className="wf-order-grid">
            {col("generate", "Generate", "Who drafts new content. Auto tries them in this order and moves on when one fails.")}
            {col("review", "Review", "Who checks a draft independently: the first in this list that did not generate it.")}
          </div>
          <div className="wf-actions">
            <Button appearance="primary" size="small" onClick={save} dataAttributes={{ "ord-save": "" }}>Save order</Button>
            <Button size="small" onClick={reset} dataAttributes={{ "ord-reset": "" }}>Back to the defaults</Button>
            <span className="wf-muted wf-small" id="ordMsg" aria-live="polite">{msg}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}

function CourseDb() {
  const A = useAdmin();
  const [st, setSt] = useState(undefined);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => { A.api("/settings/course-db").then(setSt, () => {}); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (st === undefined) return null;
  const last = st && st.last;
  const reset = (btn) => {
    if (!A.confirmClick(btn, "Reset the course databases?\n\nMySQL practice, manual and sqlbolt and the PostgreSQL sql_course schemas are reloaded from the course's seed scripts. Everything changed in course exercises is undone.\n\nA full backup is saved first (backups/course-<time>/).", "Back up and reset")) return;
    setBusy(true); setMsg("Backing up, then resetting… (a few seconds)");
    A.api("/settings/course-db/reset", "POST").then((r) => {
      setMsg(<>{"Done in " + r.seconds + " s. Backup: "}<span className="mono">{r.backup.dir}</span>{" (" + r.backup.files.length + " files)."}</>);
      A.toast("Course databases reset; backup saved"); setBusy(false);
    }).catch((er) => { setMsg(er.message); setBusy(false); });
  };
  return (
    <div className="wf-sys-change" id="courseDb">
      <div className="wf-sys-change-h"><b>Course databases</b><span className="wf-muted wf-small">MySQL practice, manual, sqlbolt · PostgreSQL sql_course</span></div>
      <p className="wf-small">Resetting reloads them from the course's own seed scripts, as on day 1: every change made in course exercises is undone, and the hidden setup exercises run again the next time they are needed. A full backup (SQL files) is made first.</p>
      <p className="wf-small wf-muted">{last ? <>{"Last reset " + A.fmtDate(last.at, true) + " · backup in "}<span className="mono">{last.backup}</span></> : "Not reset from here yet."}</p>
      <Button size="small" intent="danger" disabled={busy} onClick={(e) => reset(e.currentTarget)} dataAttributes={{ "course-reset": "" }}>Reset course database</Button>{" "}
      <span className="wf-small" id="courseMsg" aria-live="polite">{msg}</span>
    </div>
  );
}

function SystemChanges() {
  const A = useAdmin();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { A.api("/settings/system").then(setList, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Panel id="sysChanges" aria-labelledby="sc-h">
      <PanelHead id="sc-h" icon={<DesktopIcon aria-hidden="true" />} title="System" aside={<span className="wf-muted wf-small">changes made to this computer's MySQL server for SQL Drills</span>} />
      {error ? <div className="wf-empty">{error.message}</div> : !list ? <div className="wf-empty">Checking…</div> : list.map((c) => (
        <div className="wf-sys-change" key={c.what}>
          <div className="wf-sys-change-h"><b className="mono">{c.what}</b><span className="wf-muted wf-small mono">{c.at}</span></div>
          <p className="wf-small">{c.why}</p>
          <p className="wf-small wf-muted">{c.how}</p>
          {c.live && (
            <dl className="wf-kv-inline">
              {Object.keys(c.live).map((k) => {
                const info = (c.info || []).indexOf(k) > -1;
                return <div key={k} className={info ? "info" : undefined}><dt>{SYS_LABELS[k] || k}</dt><dd className="mono">{info && <span className="wf-info-dot" aria-hidden="true">i</span>}{String(c.live[k])}</dd></div>;
              })}
            </dl>
          )}
        </div>
      ))}
      <CourseDb />{/* the old card appended it whenever its own request came back */}
    </Panel>
  );
}

export default function SettingsPage() {
  const A = useAdmin();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { A.api("/providers").then(setList, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (error) return <AdminPage><ErrorLine error={error} /></AdminPage>;
  if (!list) return <AdminPage><Loading /></AdminPage>;
  return (
    <AdminPage eyebrow="AI & settings" title="AI providers" intro="Used for learners' hints and for the content generation machine. Keys live in sql-drills-server/.env (never in the browser).">
      <Providers list={list} />
      <Roles />
      <Order />
      <SystemChanges />
      <Panel>
        <PanelHead icon={<CogIcon aria-hidden="true" />} title="Configuration (.env)" />
        <div className="wf-table-wrap" tabIndex={0} role="group" aria-label="Configuration (.env)">
          <table className="wf-table"><tbody>{ENV.map((r) => <tr key={r[0]}><td><code>{r[0]}</code></td><td className="wf-muted">{r[1]}</td></tr>)}</tbody></table>
        </div>
        <p className="wf-muted wf-small wf-foot">Edit .env, then restart with npm start.</p>
      </Panel>
    </AdminPage>
  );
}
