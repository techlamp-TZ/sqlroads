// Admin → Create (#/create): one item by hand (every type, the same checks as generated items, a live learner
// preview), a new dataset, and bulk import (?tab=import); ?id= edits an item. Same text, ids, calls and behaviour as
// the old view (admin.js viewCreate…importRun). The fields are read from the form as before (cCollect), so the
// values typed in survive a type or dataset change exactly as they did.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import { CheckmarkCircleIcon, CheckmarkIcon, CrossIcon, DownloadIcon, PlusIcon, VisibleIcon, AttentionIcon } from "@waffles/icons";
import LinkTabs from "../../shared/LinkTabs.jsx";
import { AdminPage, ErrorLine, Loading, PanelHead, useAdmin } from "../../admin/admin.jsx";
import "./create.scss";

// [key, label, kind, extra] kinds: text, area, sql, list (one per line), check, num, select (extra: options), table
// (a name + rows: the first line holds the column names), inputs (predict: the rows to show), answer/whywrong (MCQ)
const TBL = (k, label, opt) => [k, label, "table", opt ? { optional: true } : null];
export const CF = {
  exercise: [["title", "Title", "text"], ["task", "Task: what the learner must do", "area"], ["solution_sql", "Reference solution", "sql"], ["accepted", "Accepted alternative answers (one query per line, optional)", "list"], ["hints", "Hints, easiest first (one per line, up to 3, optional)", "list"], ["ordered", "The order of the rows matters", "check"], ["summary", "Short description (optional)", "text"]],
  mcq: [["q", "Question", "area"], ["code", "Code shown with the question (optional)", "sql"], ["options", "Options (one per line, 2-5)", "list"], ["answer", "Right option", "answer"], ["why", "Why the right option is right", "area"], ["why_wrong", "Why each wrong option is wrong", "whywrong"]],
  predict: [["question", "Question", "text"], ["sql", "The query", "sql"], ["inputs", "Rows to show (a table and a WHERE that picks 1-8 rows)", "inputs"], ["mistakes", "Wrong choices: mistaken queries, one per line (each must really give a different result)", "list"]],
  flashcard_keyword: [["front", "Front: a keyword, clause or function", "text"], ["back", "Back: what it means or does", "area"]],
  flashcard_blank: [["prompt", "Instruction (optional)", "text"], ["sql", "Statement with exactly one ___", "sql"], ["answer", "The text that fills ___", "text"]],
  flashcard_order: [["prompt", "Instruction (optional)", "text"], ["parts", "Clauses in the right order (one per line, 3-7)", "list"]],
  flashcard_error: [["prompt", "Instruction (optional)", "text"], ["wrong_sql", "Statement with one mistake", "sql"], ["fixed_sql", "The corrected statement", "sql"], ["explanation", "What was wrong (one sentence)", "text"]],
  lesson: [["title", "Title", "text"], ["what", "What it is", "area"], ["when", "When to use it (one point per line)", "list"], ["example_sql", "Example (runs on the dataset; its real result is stored)", "sql"], ["explain", "What the example shows", "area"], ["tip", "Watch out", "text"]],
  join_mapper: [["question", "Question (don't name the join type)", "text"], TBL("left", "Left table"), TBL("right", "Right table"), ["key_left", "Key in the left table (table.column)", "text"], ["key_right", "Key in the right table (table.column)", "text"], ["join_type", "Join type", "select", ["INNER", "LEFT", "RIGHT", "FULL"]], ["why", "Why (1-2 sentences)", "area"]],
  compare_queries: [["question", "Question", "text"], TBL("table", "Table"), TBL("table2", "Second table (optional)", true), ["query_a", "Query A", "sql"], ["query_b", "Query B", "sql"], ["why", "Why the results differ", "area"]],
  result_set: [["question", "Question", "text"], TBL("table", "Table (first column: a unique id)"), ["query", "Query (returns the id first)", "sql"], ["why", "Why", "area"]],
  join_compare: [["question", "Question", "text"], TBL("left", "Left table"), TBL("right", "Right table"), ["key_left", "Key in the left table (table.column)", "text"], ["key_right", "Key in the right table (table.column)", "text"], ["pair", "Join types compared", "select", ["INNER>LEFT", "INNER>RIGHT", "LEFT>FULL"]], ["why", "Why", "area"]],
  find_difference: [["question", "Question", "text"], TBL("table", "Table (first column: a unique id)"), ["query_a", "Query A", "sql"], ["query_b", "Query B (1-4 tokens changed)", "sql"], ["why", "Why", "area"]],
  exec_timeline: [["question", "Question", "text"], ["script", "Script: 4-8 statements, the first creates a table named es_…", "sql"], ["check_sql", "Check query (SELECT … ORDER BY)", "sql"], ["ask_step", "Ask about the table after statement", "num"], ["why", "Why", "area"]],
  schema_detective: [["question", "Question", "text"], TBL("table", "Table (6-8 rows)"), ["candidates", "Candidate key columns (one per line, 3-4)", "list"], ["why", "Why", "area"]],
  sort_filter: [["question", "Task in words", "text"], TBL("table", "Table (6-8 rows)"), ["select", "Columns returned (e.g. name, marks)", "text"], ["filters", "Conditions to choose from (one per line, 3-5)", "list"], ["sorts", "Sort orders to choose from (one per line, 2-4)", "list"], ["answer_filters", "Right conditions: their numbers (e.g. 1, 3)", "text"], ["answer_sort", "Right sort: its number", "num"], ["why", "Why", "area"]],
  query_optimizer: [["question", "Question", "text"], ["schema", "CREATE TABLE", "sql"], ["index", "CREATE INDEX", "sql"], ["query", "Query (one table)", "sql"], ["why", "Why the planner does what it does (never \"an index always helps\")", "area"]],
};
export const NEEDS_DATASET = (t) => ["exercise", "predict", "lesson", "flashcard_blank", "flashcard_order", "flashcard_error"].indexOf(t) > -1;
export const HAS_LEVEL = (t) => t === "exercise" || t === "mcq";
const LETTERS = "ABCDE";

// kept for the visit, as before: the meta, and the form's state between visits (a new item, not an edit)
let CM = null, CS = null;

function conceptOf(text) {
  const t = String(text || "").trim().toLowerCase();
  return CM.concepts.filter((c) => c.slug === t || (c.name + " (Level " + c.level + ")").toLowerCase() === t || c.name.toLowerCase() === t)[0] || null;
}
const $$ = (root, sel) => Array.prototype.slice.call(root.querySelectorAll(sel));

// ---------- one field ----------
function InputsField({ f, value }) {
  const [rows, setRows] = useState(Array.isArray(value) && value.length ? value : [{ table: "", where: "" }]);
  const box = useRef(null);
  const add = () => {
    // what is typed stays: read the rows first
    const now = $$(box.current, ".c-in").map((r) => ({ table: r.querySelector('[data-ci="table"]').value, where: r.querySelector('[data-ci="where"]').value }));
    setRows(now.concat([{ table: "", where: "" }]));
    setTimeout(() => { const ins = $$(box.current, ".c-in [data-ci='table']"); if (ins.length) ins[ins.length - 1].focus(); }, 0);
  };
  return (
    <fieldset className="wf-fieldset c-f c-inputs" ref={box}>
      <legend>{f[1]}</legend>
      {rows.map((r, k) => (
        <div className="c-in" key={k + ":" + rows.length}>
          <label><span className="wf-sr-only">{"Table " + (k + 1)}</span><input className="wf-control mono" placeholder="table" data-ci="table" defaultValue={r.table} /></label>
          <label className="wf-grow"><span className="wf-sr-only">{"WHERE for table " + (k + 1)}</span><input className="wf-control mono" placeholder="WHERE condition, e.g. id <= 4" data-ci="where" defaultValue={r.where} /></label>
        </div>
      ))}
      {rows.length < 3 && <div><Button size="small" onClick={add} dataAttributes={{ c: "add-input" }}>{[<PlusIcon key="i" />, "Another table"]}</Button></div>}
    </fieldset>
  );
}

function Field({ f, value, vals, mcq }) {
  const id = "cf-" + f[0], v = value == null ? "" : value;
  const lab = <label htmlFor={id}>{f[1]}</label>;
  switch (f[2]) {
    case "check": return <label className="wf-check c-check"><input type="checkbox" id={id} data-cf={f[0]} defaultChecked={!!v} /><span>{f[1]}</span></label>;
    case "select": return <div className="wf-field c-f">{lab}<select className="wf-control" id={id} data-cf={f[0]} defaultValue={f[3].indexOf(v) > -1 ? v : f[3][0]}>{f[3].map((o) => <option key={o}>{o}</option>)}</select></div>;
    case "num": return <div className="wf-field c-f c-num">{lab}<input className="wf-control" type="number" min="1" id={id} data-cf={f[0]} defaultValue={v} /></div>;
    case "text": return <div className="wf-field c-f">{lab}<input className="wf-control" id={id} data-cf={f[0]} defaultValue={v} /></div>;
    case "table": return (
      <fieldset className="wf-fieldset c-f c-table">
        <legend>{f[1]}</legend>
        <div className="wf-field"><label htmlFor={id + "-n"}>Table name</label><input className="wf-control mono" id={id + "-n"} data-cf={f[0] + "_name"} defaultValue={(vals || {})[f[0] + "_name"] || ""} /></div>
        <div className="wf-field"><label htmlFor={id + "-c"}>Rows: the first line holds the column names; comma or tab separated</label><textarea className="wf-control mono" rows={6} id={id + "-c"} data-cf={f[0] + "_csv"} spellCheck={false} defaultValue={(vals || {})[f[0] + "_csv"] || ""} /></div>
      </fieldset>
    );
    case "inputs": return <InputsField f={f} value={v} />;
    case "answer": return <McqAnswer mcq={mcq} />;
    case "whywrong": return <McqWhy mcq={mcq} />;
    default: {
      const rows = f[2] === "area" ? 3 : f[2] === "list" ? 4 : 5;
      const onInput = f[0] === "options" && mcq ? (e) => mcq.setOptions(e.target.value) : undefined;
      return <div className="wf-field c-f">{lab}<textarea className={"wf-control" + (f[2] === "sql" ? " mono" : "")} rows={rows} id={id} data-cf={f[0]} spellCheck={f[2] === "sql" ? false : undefined} defaultValue={Array.isArray(v) ? v.join("\n") : v} onInput={onInput} /></div>;
    }
  }
}

// MCQ: the right option and a "why not" per wrong option follow the options as they are typed
const optsOf = (text) => String(text || "").split("\n").map((x) => x.trim()).filter(Boolean).slice(0, 5);
function McqAnswer({ mcq }) {
  return (
    <div className="wf-field c-f" data-cdyn="answer">
      <label htmlFor="cf-answer">Right option</label>
      <select className="wf-control" id="cf-answer" data-cf="answer" value={String(mcq.answer)} onChange={(e) => mcq.setAnswer(Number(e.target.value))}>
        {mcq.opts.map((o, k) => <option key={k} value={k}>{LETTERS.charAt(k) + ". " + o}</option>)}
      </select>
    </div>
  );
}
function McqWhy({ mcq }) {
  return (
    <div className="c-f" data-cdyn="whywrong">
      <fieldset className="wf-fieldset c-why">
        <legend>Why each wrong option is wrong</legend>
        {mcq.opts.length < 2 ? <p className="wf-muted wf-small">Type at least two options first.</p> : mcq.opts.map((o, k) => (k === mcq.answer ? null : (
          <div className="wf-field" key={k}>
            <label htmlFor={"cw-" + k}>{LETTERS.charAt(k) + ". " + o}</label>
            <input className="wf-control" id={"cw-" + k} data-cw={k} value={mcq.why[k] || ""} onChange={(e) => mcq.setWhy(k, e.target.value)} />
          </div>
        )))}
      </fieldset>
    </div>
  );
}

// ---------- the concept / level / difficulty / stage / dataset row ----------
function Common({ type, onDataset }) {
  const c = CM.concepts.filter((x) => x.slug === CS.concept)[0];
  const [locked, setLocked] = useState(c ? c.level : null);
  const [level, setLevel] = useState(c ? c.level : CS.level);
  const onConcept = (e) => { const k = conceptOf(e.target.value); if (k) { setLevel(k.level); setLocked(k.level); } else setLocked(null); };
  return (
    <div className="c-grid">
      <div className="wf-field c-f c-wide">
        <label htmlFor="c-concept">{"Concept" + (HAS_LEVEL(type) ? " (optional)" : "")}</label>
        <input className="wf-control" id="c-concept" list="c-concepts" autoComplete="off" placeholder="Type to search 161 concepts" defaultValue={c ? c.name + " (Level " + c.level + ")" : ""} onChange={onConcept} />
        <datalist id="c-concepts">{CM.concepts.map((x) => <option key={x.slug} value={x.name + " (Level " + x.level + ")"} />)}</datalist>
      </div>
      {HAS_LEVEL(type) && (
        <>
          <div className="wf-field c-f"><label htmlFor="c-level">Level</label>
            <select className="wf-control" id="c-level" disabled={locked != null} value={String(level)} onChange={(e) => setLevel(Number(e.target.value))}>
              {CM.levels.map((L) => <option key={L.n} value={L.n}>{L.n + ". " + L.title}</option>)}
            </select></div>
          <div className="wf-field c-f"><label htmlFor="c-diff">Difficulty</label>
            <select className="wf-control" id="c-diff" defaultValue={CS.diff || "medium"}>{CM.diffs.map((d) => <option key={d}>{d}</option>)}</select></div>
        </>
      )}
      {type === "exercise" && <div className="wf-field c-f"><label htmlFor="c-stage">Stage</label><select className="wf-control" id="c-stage" defaultValue={CS.stage === "transfer" ? "transfer" : "practise"}><option value="practise">Practise</option><option value="transfer">Transfer</option></select></div>}
      {type === "mcq" && <div className="wf-field c-f"><label htmlFor="c-stage">Stage</label><select className="wf-control" id="c-stage" defaultValue={CS.stage === "memorize" ? "memorize" : "understand"}><option value="understand">Understand</option><option value="memorize">Memorize</option></select></div>}
      {NEEDS_DATASET(type) && (
        <div className="wf-field c-f"><label htmlFor="c-ds">Dataset</label>
          <select className="wf-control" id="c-ds" defaultValue={CS.dataset || ""} onChange={(e) => onDataset(e.target.value === "__new")}>
            <option value="">Choose…</option>
            {CM.datasets.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            <option value="__new">+ New dataset…</option>
          </select></div>
      )}
    </div>
  );
}

// ---------- a new dataset: pasted rows / CSV per table, or a CREATE TABLE + INSERT script ----------
function DatasetForm({ onCreated }) {
  const A = useAdmin();
  const [mode, setMode] = useState("tables");
  const [tables, setTables] = useState(1);
  const [out, setOut] = useState(null);
  const box = useRef(null);
  useEffect(() => { const i = box.current && box.current.querySelector("input"); if (i) i.focus(); }, []);
  const run = (save) => {
    const root = box.current;
    const body = { label: root.querySelector("#ds-label").value, mode, script: (root.querySelector("#ds-script") || {}).value, tables: $$(root, ".c-dst").map((f) => ({ name: f.querySelector("[data-dsn]").value, csv: f.querySelector("[data-dsc]").value })) };
    setOut({ busy: true });
    A.api(save ? "/create/dataset" : "/create/dataset/preview", "POST", body).then((r) => {
      if (save && r.ok) return onCreated(r);
      setOut({ r, save });
    }).catch((e) => setOut({ error: e.message }));
  };
  return (
    <section className="c-ds wf-sub-card" aria-labelledby="ds-h" ref={box}>
      <h4 id="ds-h">New dataset</h4>
      <p className="wf-muted wf-small">It must run with every row on SQLite, a MySQL scratch schema and PostgreSQL (rolled back) before it is saved.</p>
      <div className="wf-field"><label htmlFor="ds-label">Name</label><input className="wf-control" id="ds-label" placeholder="e.g. Pet clinic" /></div>
      <fieldset className="wf-fieldset c-save"><legend>From</legend>
        <label className="wf-check c-check"><input type="radio" name="c-dsmode" value="tables" checked={mode === "tables"} onChange={() => setMode("tables")} /><span>Rows or CSV</span></label>
        <label className="wf-check c-check"><input type="radio" name="c-dsmode" value="script" checked={mode === "script"} onChange={() => setMode("script")} /><span>A CREATE TABLE + INSERT script</span></label>
      </fieldset>
      <div id="c-dstables" hidden={mode !== "tables"}>
        {Array.from({ length: tables }, (_, k) => (
          <fieldset className="wf-fieldset c-dst" key={k}><legend>{"Table " + (k + 1)}</legend>
            <div className="wf-field"><label htmlFor={"dsn-" + k}>Name</label><input className="wf-control mono" id={"dsn-" + k} data-dsn="" /></div>
            <div className="wf-field"><label htmlFor={"dsc-" + k}>Rows: first line the column names; paste from a sheet or CSV</label><textarea className="wf-control mono" rows={6} id={"dsc-" + k} data-dsc="" spellCheck={false} /></div>
          </fieldset>
        ))}
        <Button size="small" onClick={() => setTables(tables + 1)} dataAttributes={{ c: "ds-add" }}>{[<PlusIcon key="i" />, "Another table"]}</Button>
      </div>
      <div id="c-dsscript" hidden={mode !== "script"}>
        <div className="wf-field"><label htmlFor="ds-script">Script</label><textarea className="wf-control mono" rows={8} id="ds-script" spellCheck={false} placeholder={"CREATE TABLE pets (id INT PRIMARY KEY, name VARCHAR(40));\nINSERT INTO pets VALUES (1, 'Rex');"} /></div>
      </div>
      <div className="wf-actions">
        <Button onClick={() => run(false)} dataAttributes={{ c: "ds-check" }}>Check dataset</Button>
        <Button appearance="primary" onClick={() => run(true)} dataAttributes={{ c: "ds-save" }}>Create dataset</Button>
      </div>
      <div id="ds-out" aria-live="polite">
        {out && out.busy && <p className="wf-muted wf-small">Running on SQLite, MySQL and PostgreSQL…</p>}
        {out && out.error && <p className="wf-bad-txt" role="alert">{out.error}</p>}
        {out && out.r && (
          <>
            <CheckList checks={out.r.checks} />
            <p className="wf-small">{out.r.tables.map((t, i) => <span key={i}>{i > 0 && ", "}<span className="mono">{t.name}</span>{" (" + t.rows + " rows)"}</span>)}</p>
            {out.save && <p className="wf-bad-txt">Not saved: a check failed.</p>}
          </>
        )}
      </div>
    </section>
  );
}

const Mark = ({ c }) => (c.ok ? <span className="wf-ok-txt"><CheckmarkIcon aria-hidden="true" /><span className="wf-sr-only">passed</span></span>
  : c.warn ? <span className="wf-warn-txt"><AttentionIcon aria-hidden="true" /><span className="wf-sr-only">warning</span></span>
    : <span className="wf-bad-txt"><CrossIcon aria-hidden="true" /><span className="wf-sr-only">failed</span></span>);
function CheckList({ checks }) {
  return <ul className="c-checks">{checks.map((c, i) => <li key={i} className={c.ok ? "ok" : c.warn ? "warn" : "bad"}><Mark c={c} /><span>{c.label}{c.detail ? <>{" "}<span className="wf-muted">{c.detail}</span></> : null}</span></li>)}</ul>;
}
function Checks({ r }) {
  const A = useAdmin();
  const failed = r.checks.filter((c) => !c.ok && !c.warn).length, warned = r.checks.filter((c) => !c.ok && c.warn).length;
  return (
    <div className={"c-res " + r.status} role="status">
      <p className="c-sum"><b>{r.status === "fail" ? A.plural(failed, "check") + " failed: nothing was saved." : r.status === "warn" ? "Passes, with " + A.plural(warned, "warning") + "." : "Every check passes."}</b></p>
      <CheckList checks={r.checks} />
    </div>
  );
}

// ---------- bulk import ----------
function Import() {
  const A = useAdmin();
  const [out, setOut] = useState(null);
  const [canSave, setCanSave] = useState(false);
  const box = useRef(null);
  const focus = useRef(false);
  useEffect(() => { if (focus.current) { focus.current = false; const s = box.current.querySelector(".c-sum"); if (s) s.focus(); } });
  const run = (save) => {
    const root = box.current, f = root.querySelector("#imp-file").files[0], kind = root.querySelector("#imp-kind").value;
    const publish = (root.querySelector('[name="imp-pub"]:checked') || {}).value !== "0";
    (f ? f.text() : Promise.resolve(root.querySelector("#imp-text").value)).then((text) => {
      let rows;
      try { rows = A.importRows(text); } catch (e) { setOut({ error: "Couldn't read it: " + e.message }); return; }
      if (!rows.length) { setOut({ error: "No rows found." }); return; }
      setOut({ busy: "Checking " + A.plural(rows.length, "row") + " (write drills run on MySQL; this can take a minute)…" });
      return A.api(save ? "/create/import" : "/create/import/preview", "POST", { kind, rows, publish }).then((r) => {
        focus.current = true;
        setOut({ r, save }); setCanSave(!save && !!(r.pass + r.warn));
        if (save) A.refreshCounts();
      });
    }).catch((e) => setOut({ error: e.message }));
  };
  return (
    <section className="wf-card-box c-imp" aria-labelledby="imp-h" ref={box}>
      <PanelHead id="imp-h" icon={<DownloadIcon aria-hidden="true" />} title="Import exercises, MCQs or flashcards" />
      <p className="wf-muted wf-small">Choose the row type, then provide flat CSV / JSON fields. Flashcards use: keyword = front, back; blank = prompt, sql, answer; order = prompt, parts (one clause per line or ||); error = prompt, wrong_sql, fixed_sql, explanation. Shared fields are level and concept; SQL-based cards also need dataset. Every row runs the same checks as one item; nothing is saved until you choose.</p>
      <div className="c-grid">
        <div className="wf-field c-f"><label htmlFor="imp-kind">Rows are</label>
          <select className="wf-control" id="imp-kind" defaultValue="exercise"><option value="exercise">Exercises</option><option value="mcq">MCQs</option><option value="flashcard_keyword">Flashcards: keyword</option><option value="flashcard_blank">Flashcards: fill in the blank</option><option value="flashcard_order">Flashcards: clause order</option><option value="flashcard_error">Flashcards: spot the error</option></select></div>
        <div className="wf-field c-f"><label htmlFor="imp-file">CSV or JSON file</label><input type="file" className="wf-control" id="imp-file" accept=".csv,.json,.txt,text/csv,application/json" /></div>
      </div>
      <div className="wf-field"><label htmlFor="imp-text">…or paste CSV / JSON</label><textarea className="wf-control mono" rows={8} id="imp-text" spellCheck={false} /></div>
      <fieldset className="wf-fieldset c-save"><legend>Rows that pass</legend>
        <label className="wf-check c-check"><input type="radio" name="imp-pub" value="1" defaultChecked /><span>Publish</span></label>
        <label className="wf-check c-check"><input type="radio" name="imp-pub" value="0" /><span>Save as drafts</span></label>
      </fieldset>
      <div className="wf-actions">
        <Button onClick={() => run(false)} dataAttributes={{ c: "imp-check" }}>{[<CheckmarkCircleIcon key="i" />, "Check rows"]}</Button>
        <Button appearance="primary" onClick={() => run(true)} disabled={!canSave} dataAttributes={{ c: "imp-save" }}>Save the rows that pass</Button>
      </div>
      <div id="imp-out" aria-live="polite">
        {out && out.error && <p className="wf-bad-txt" role="alert">{out.error}</p>}
        {out && out.busy && <p className="wf-muted wf-small">{out.busy}</p>}
        {out && out.r && (
          <>
            <p className="c-sum" role="status" tabIndex={-1}><b>{out.r.pass + " pass · " + out.r.warn + " with warnings · " + out.r.fail + " fail"}</b>{out.save ? " · " + A.plural(out.r.saved, "row") + " saved" : ""}</p>
            <div className="wf-table-wrap" tabIndex={0} role="group" aria-label="Rows checked">
              <table className="wf-table">
                <caption className="wf-sr-only">Rows checked</caption>
                <thead><tr><th scope="col">Row</th><th scope="col">Item</th><th scope="col">Result</th></tr></thead>
                <tbody>{out.r.rows.map((x) => (
                  <tr key={x.row}><td className="n mono">{x.row}</td>
                    <td>{x.title || ""}{x.failed.length ? <ul className="wf-small wf-muted">{x.failed.map((m, i) => <li key={i}>{m}</li>)}</ul> : null}</td>
                    <td><span className={x.status === "fail" ? "wf-bad-txt" : x.status === "warn" ? "wf-warn-txt" : "wf-ok-txt"}>{x.status}</span></td></tr>
                ))}</tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

// ---------- the page ----------
export default function CreatePage({ route }) {
  const A = useAdmin();
  const q = (route && route.q) || new URLSearchParams();
  const editId = q.get("id");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [type, setType] = useState(null);
  const [gen, setGen] = useState(0);          // remounts the fields (a type change)
  const [commonGen, setCommonGen] = useState(0); // remounts the concept/level/dataset row
  const [newDs, setNewDs] = useState(null);   // null | "form" | {created}
  const [out, setOut] = useState(null);
  const [busy, setBusy] = useState(null);
  const [opts, setOpts] = useState([]);
  const [answer, setAnswer] = useState(0);
  const [why, setWhyState] = useState([]);
  const [prevNote, setPrevNote] = useState("Press Check to see the item as learners will.");
  const form = useRef(null), outRef = useRef(null), dsNote = useRef(null), frame = useRef(null);

  useEffect(() => {
    Promise.all([CM ? Promise.resolve(CM) : A.api("/create/meta"), editId ? A.api("/create/item/" + encodeURIComponent(editId)) : Promise.resolve(null)]).then(([m, it]) => {
      CM = m;
      CS = it ? { id: it.id, type: it.form.type, concept: it.form.concept, level: Number(it.form.level) || 1, diff: it.form.diff, stage: it.form.stage, dataset: it.form.dataset, vals: it.form.fields || {}, status: it.status, mine: it.mine }
        : (CS && !CS.id ? CS : { type: q.get("type") || "exercise", level: 1, vals: {} });
      setType(CS.type); initMcq(); setReady(true);
    }, setError);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function initMcq() {
    const v = CS.vals || {};
    setOpts(optsOf(Array.isArray(v.options) ? v.options.join("\n") : v.options));
    setAnswer(Number(v.answer || 0));
    setWhyState(v.why_wrong ? v.why_wrong.slice() : []);
  }
  const mcq = { opts, answer, why, setOptions: (t) => setOpts(optsOf(t)), setAnswer, setWhy: (k, val) => setWhyState((w) => { const n = w.slice(); n[k] = val; return n; }) };

  // read the form, as cCollect did
  function collect() {
    const root = form.current, vals = {};
    $$(root, "[data-cf]").forEach((el) => { vals[el.getAttribute("data-cf")] = el.type === "checkbox" ? el.checked : el.value; });
    if (CS.type === "mcq") { vals.answer = Number(vals.answer || 0); vals.why_wrong = []; $$(root, "[data-cw]").forEach((el) => { vals.why_wrong[Number(el.getAttribute("data-cw"))] = el.value; }); why.forEach((w, k) => { if (vals.why_wrong[k] == null && w != null) vals.why_wrong[k] = w; }); }
    if (root.querySelector(".c-inputs")) vals.inputs = $$(root, ".c-in").map((r) => ({ table: r.querySelector('[data-ci="table"]').value, where: r.querySelector('[data-ci="where"]').value }));
    CS.vals = vals;
    const ce = root.querySelector("#c-concept"), c = ce ? conceptOf(ce.value) : null;
    CS.concept = c ? c.slug : "";
    const g = (s) => root.querySelector(s);
    if (g("#c-level")) CS.level = Number(g("#c-level").value);
    if (g("#c-diff")) CS.diff = g("#c-diff").value;
    if (g("#c-stage")) CS.stage = g("#c-stage").value;
    if (g("#c-ds")) CS.dataset = g("#c-ds").value === "__new" ? "" : g("#c-ds").value;
    return { type: CS.type, concept: CS.concept, level: CS.level, diff: CS.diff, stage: CS.stage, dataset: CS.dataset, fields: vals, review: !!(g("#c-review") && g("#c-review").checked), publish: (g('[name="c-pub"]:checked') || {}).value !== "0" };
  }

  const changeType = (t) => {
    collect();
    CS = { type: t, level: CS.level, concept: CS.concept, dataset: CS.dataset, diff: CS.diff, vals: {} };
    setType(t); initMcq(); setNewDs(null); setGen(gen + 1); setCommonGen(commonGen + 1); setOut(null);
  };

  // after a run: focus the saved line, or the summary (as before)
  const focusAfter = useRef(null);
  useLayoutEffect(() => { if (focusAfter.current && outRef.current) { const f = outRef.current.querySelector(focusAfter.current); focusAfter.current = null; if (f) { f.setAttribute("tabindex", "-1"); f.focus(); } } });
  useLayoutEffect(() => { if (newDs && newDs.created && dsNote.current) dsNote.current.focus(); }, [newDs]);

  function sendPreview(r) {
    const item = A.previewItem(r);
    setPrevNote(item ? "" : "The preview appears once the item's own checks pass.");
    const fr = frame.current;
    if (!fr || !item) return;
    const post = () => fr.contentWindow.postMessage({ type: "sqld-preview", item }, location.origin);
    post(); fr.onload = post;
  }
  function run(save) {
    const body = collect();
    setBusy(save ? "save" : "check"); setOut({ busy: save ? "Checking and saving…" : "Checking…" });
    const req = save ? (CS.id ? A.api("/create/item/" + encodeURIComponent(CS.id), "PUT", body) : A.api("/create", "POST", body)) : A.api("/create/check", "POST", body);
    return req.then((r) => {
      setBusy(null);
      const saved = save && r.ok;
      focusAfter.current = saved ? ".c-saved" : ".c-sum";
      setOut({ r, saved, wasEdit: !!CS.id });
      sendPreview(r);
      if (saved) { A.refreshCounts(); if (!CS.id) CS = { type: CS.type, level: CS.level, concept: CS.concept, dataset: CS.dataset, diff: CS.diff, stage: CS.stage, vals: {} }; }
    }).catch((e) => { setBusy(null); setOut({ error: e.message }); });
  }

  const onCreated = (r) => {
    CM.datasets.push({ key: r.key, label: r.label });
    collect(); CS.dataset = r.key;
    setCommonGen(commonGen + 1);
    setNewDs({ created: r });
  };

  const tab = q.get("tab") === "import" ? "import" : "one";
  if (error) return <AdminPage><ErrorLine error={error} /></AdminPage>;
  if (!ready) return <AdminPage><Loading /></AdminPage>;
  const groups = {};
  CM.types.forEach((t) => { (groups[t.group] = groups[t.group] || []).push(t); });

  const intro = <>Every item runs the same checks as generated ones before it is saved, and shows each failure. Saved items are marked <span className="wf-tag">Mine</span> and logged in Review → History, with Undo.</>;
  const tabs = CS.id ? null : <LinkTabs tabs={[{ key: "one", href: "#/create", text: "One item", icon: "plus" }, { key: "import", href: "#/create?tab=import", text: "Bulk import", icon: "download" }]} current={tab} icon={A.icon} />;
  if (tab === "import" && !CS.id) return <AdminPage className="c-page" eyebrow="Content" title="Create by hand" intro={intro}>{tabs}<Import /></AdminPage>;

  return (
    <AdminPage className="c-page" eyebrow="Content" title={CS.id ? "Edit an item" : "Create by hand"} intro={intro}>
      {tabs}
      <div className="c-cols">
        <form className="wf-card-box c-form" id="cForm" noValidate ref={form} onSubmit={(e) => { e.preventDefault(); run(true); }}>
          <div className="wf-field c-f"><label htmlFor="c-type">Type</label>
            <select className="wf-control" id="c-type" disabled={!!CS.id} value={type} onChange={(e) => changeType(e.target.value)}>
              {Object.keys(groups).map((g) => <optgroup key={g} label={g}>{groups[g].map((t) => <option key={t.type} value={t.type}>{t.label}</option>)}</optgroup>)}
            </select></div>
          <div id="cCommon"><Common key={type + ":" + commonGen} type={type} onDataset={(isNew) => setNewDs(isNew ? "form" : null)} /></div>
          {NEEDS_DATASET(type) && (
            <div id="c-newds" hidden={!newDs}>
              {newDs === "form" && <DatasetForm onCreated={onCreated} />}
              {newDs && newDs.created && <p className="wf-ok-txt" id="ds-out" role="status" tabIndex={-1} ref={dsNote}><CheckmarkCircleIcon aria-hidden="true" />{"Dataset “" + newDs.created.label + "” created (" + newDs.created.tables.map((t) => t.name + ", " + t.rows + " rows").join("; ") + ") and selected."}</p>}
            </div>
          )}
          <div id="cFields" key={type + ":" + gen}>{CF[type].map((f) => <Field key={f[0]} f={f} value={CS.vals[f[0]]} vals={CS.vals} mcq={mcq} />)}</div>
          <fieldset className="wf-fieldset c-save"><legend>When saved</legend>
            <label className="wf-check c-check"><input type="radio" name="c-pub" value="1" defaultChecked={!(CS.id && CS.status === "draft")} /><span>Publish now</span></label>
            <label className="wf-check c-check"><input type="radio" name="c-pub" value="0" defaultChecked={!!(CS.id && CS.status === "draft")} /><span>Save as draft (review queue)</span></label>
            <label className="wf-check c-check"><input type="checkbox" id="c-review" /><span>Ask DeepSeek to review (a second opinion, about $0.001)</span></label>
          </fieldset>
          <div className="wf-actions">
            <Button onClick={() => run(false)} disabled={busy === "check"} dataAttributes={{ c: "check" }}>{[<CheckmarkCircleIcon key="i" />, "Check"]}</Button>
            <Button type="submit" appearance="primary" disabled={busy === "save"} dataAttributes={{ c: "save" }}>{[<CheckmarkIcon key="i" />, CS.id ? "Save changes" : "Save"]}</Button>
            <span className="wf-grow" />
            {CS.id && <Button type="link" size="small" href="#/create">New item</Button>}
          </div>
          <div id="cOut" aria-live="polite" ref={outRef}>
            {out && out.busy && <p className="wf-muted wf-small">{out.busy}</p>}
            {out && out.error && <p className="wf-bad-txt" role="alert">{out.error}</p>}
            {out && out.r && <Checks r={out.r} />}
            {out && out.saved && (
              <p className="c-saved wf-ok-txt" tabIndex={-1}><CheckmarkCircleIcon aria-hidden="true" />{(out.wasEdit ? "Saved" : "Saved as ") + (out.r.status === "published" ? "published" : "a draft") + " · "}<span className="wf-tag">Mine</span>{" · "}<a href={"#/create?id=" + encodeURIComponent(out.r.id)}>Edit it</a>{" · "}<a href="#/review?view=history">History (Undo)</a></p>
            )}
          </div>
        </form>
        <section className="wf-card-box c-prev" aria-labelledby="cp-h">
          <PanelHead id="cp-h" icon={<VisibleIcon aria-hidden="true" />} title="Learner preview" aside={<span className="wf-muted wf-small">the real learner view · answers aren't saved</span>} />
          <iframe id="cPrev" src="/#/preview" title="Learner preview of this item" loading="lazy" ref={frame} />
          <p className="wf-muted wf-small" id="cPrevNote">{prevNote}</p>
        </section>
      </div>
    </AdminPage>
  );
}
