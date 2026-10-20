// Docs (#/docs): every concept's lesson A-Z and searchable, a cheat sheet per level, and the engine differences.
// Same text, addresses, API call (/api/learn/docs through app.js's api()) and behaviour as the old view
// (app.js viewDocs). The search filters 250 ms after typing stops and rewrites the address the same way, but the
// box is never re-created, so it keeps its focus. A concept's lesson, editor and tables are the shared pieces.
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./docs.scss";
import LinkTabs from "../shared/LinkTabs.jsx";
import Loader from "../shared/Loader.jsx";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, SqlWorkspace, TablesPanel, useShared } from "../shared/shared.jsx";

let docsCache = null; // the old page kept the list for the whole visit (S.docs)

const TABS = [["az", "Concepts A-Z", "search"], ["sheets", "Cheat sheets", "file"], ["engines", "MySQL · PostgreSQL · SQLite", "db"]];
const firstSentence = (t) => { const m = String(t || "").match(/^[^.!?]*[.!?]/); return (m ? m[0] : String(t || "")).replace(/`([^`]+)`/g, "$1").trim(); };
const exampleSqlOf = (l) => { const ex = (l && l.example) || {}; return ex.sql || (ex.before && ex.before.sql) || ""; };
const hay = (c) => [c.name, c.summary, c.keywords.join(" "), c.lesson ? c.lesson.what : ""].join(" ").toLowerCase();
const letterOf = (c) => c.name.replace(/^[^A-Za-z]+/, "").charAt(0).toUpperCase() || "#";

export default function DocsPage({ route, icon }) {
  const shared = useShared();
  const q0 = (route && route.q) || new URLSearchParams();
  const tab = q0.get("t") || "az";
  const [all, setAll] = useState(docsCache);
  const [error, setError] = useState(null);
  useEffect(() => { if (!all) shared.api("/api/learn/docs").then((d) => { docsCache = d; setAll(d); }, setError); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const frame = (body) => <div className="wf-with-rail"><div className="wf-main wf-docs-page">{body}</div><LegacyHtml html={shared.rail()} label="rail" /></div>;
  if (error) return frame(<Card><div className="wf-card-pad">{error.message}</div></Card>);
  if (!all) return frame(<Card><div className="wf-card-pad" aria-busy="true"><Loader label="Loading the reference…" showLabel inline /></div></Card>);

  return frame(
    <>
      <div className="wf-hero">
        <div className="wf-eyebrow">Docs</div>
        <h1>SQL reference</h1>
        <p>Every concept's lesson, a cheat sheet per level, and how the three course databases differ.</p>
      </div>
      <LinkTabs tabs={TABS.map(([k, text, ic]) => ({ key: k, href: "#/docs?t=" + k, text, icon: ic }))} current={tab} icon={icon} />
      {tab === "sheets" ? <Sheets all={all} level={Number(q0.get("l")) || 1} shared={shared} />
        : tab === "engines" ? <Engines />
        : <AZ all={all} route={route} shared={shared} icon={icon} />}
    </>,
  );
}

function Sheets({ all, level, shared }) {
  const levels = shared.levels(), L = shared.levelOf(level);
  const rows = all.filter((c) => c.level === level);
  return (
    <>
      <div className="wf-chips" role="group" aria-label="Level">
        {levels.map((x) => <a key={x.n} className={"wf-chip" + (x.n === level ? " is-on" : "")} href={"#/docs?t=sheets&l=" + x.n} aria-current={x.n === level ? "page" : undefined}>{"Level " + x.n}</a>)}
      </div>
      <Card as="section">
        <div className="wf-card-pad" aria-labelledby="sh-h" role="region">
          <h2 className="wf-docs-h" id="sh-h">{"Level " + level + " · " + (L ? L.title : "") + " cheat sheet"}</h2>
          <div className="wf-table-wrap" tabIndex={0} role="group" aria-label={"The concepts of Level " + level}>
            <table className="wf-table wf-sheet">
              <caption className="wf-sr-only">{"The concepts of Level " + level}</caption>
              <thead><tr><th scope="col">Concept</th><th scope="col">In one line</th><th scope="col">Example</th></tr></thead>
              <tbody>
                {rows.map((c) => {
                  const ex = c.lesson && c.lesson.example, sql = ex && (ex.sql || (ex.before && ex.before.sql));
                  return (
                    <tr key={c.slug}>
                      <th scope="row">
                        <a href={"#/docs?t=az&c=" + encodeURIComponent(c.slug)}>{c.name}</a>
                        {c.keywords.length > 0 && <div className="wf-sheet-k">{c.keywords.slice(0, 4).map((k, i) => <Fragment key={k}>{i > 0 && " "}<code>{k}</code></Fragment>)}</div>}
                      </th>
                      <td>{firstSentence(c.lesson ? c.lesson.what : c.summary)}</td>
                      <td>{sql ? <pre className="wf-sql" dangerouslySetInnerHTML={{ __html: shared.highlight(sql) }} /> : null}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="wf-muted wf-small">Open a concept to run its example.</p>
        </div>
      </Card>
    </>
  );
}

function Engines() {
  return (
    <Card as="section">
      <div className="wf-card-pad" aria-labelledby="en-h" role="region">
        <h2 className="wf-docs-h" id="en-h">The same thing in MySQL, PostgreSQL and SQLite</h2>
        <p className="wf-muted wf-small">The course runs exercises on SQLite in your browser and on MySQL 8 and PostgreSQL on this computer. These are the differences you meet most.</p>
        <div className="wf-table-wrap" tabIndex={0} role="group" aria-label="Differences between MySQL, PostgreSQL and SQLite">
          <table className="wf-table wf-eng">
            <caption className="wf-sr-only">Differences between MySQL, PostgreSQL and SQLite</caption>
            <thead><tr><th scope="col">Task</th><th scope="col">MySQL 8</th><th scope="col">PostgreSQL</th><th scope="col">SQLite</th></tr></thead>
            <tbody>{window.Help.DIFFS.map((r) => <tr key={r[0]}><th scope="row">{r[0]}</th>{r.slice(1).map((v, i) => <td key={i} className="mono">{v}</td>)}</tr>)}</tbody>
          </table>
        </div>
      </div>
    </Card>
  );
}

function AZ({ all, route, shared, icon }) {
  const q0 = route.q;
  const [typed, setTyped] = useState(q0.get("q") || "");   // what is in the box
  const [query, setQuery] = useState(q0.get("q") || "");   // what the list shows (250 ms after typing stops)
  const [open, setOpen] = useState(q0.get("c"));
  const timer = useRef(null);
  const onType = (v) => {
    setTyped(v);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // the same address as the old page (no new history entry), and the old router's route.q follows it
      const qs = "t=az" + (v ? "&q=" + encodeURIComponent(v) : "");
      history.replaceState(null, "", "#/docs?" + qs);
      route.q = new URLSearchParams(qs);
      setOpen(null); // the old page re-rendered here, so an open concept closed
      setQuery(v);
    }, 250);
  };
  useEffect(() => () => clearTimeout(timer.current), []);

  const list = useMemo(() => all.filter((c) => !query || hay(c).indexOf(query.toLowerCase()) > -1).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" })), [all, query]);
  const letters = useMemo(() => { const out = []; list.forEach((c) => { if (!out.includes(letterOf(c))) out.push(letterOf(c)); }); return out; }, [list]);

  // ?c=: that concept open, in view, its summary focused (as before)
  const openRef = useRef(null);
  useEffect(() => { if (openRef.current) { openRef.current.scrollIntoView(); openRef.current.querySelector("summary").focus(); } }, []);

  const jump = (e, L) => { e.preventDefault(); const g = document.getElementById("azh-" + L); if (g) { g.setAttribute("tabindex", "-1"); g.scrollIntoView(); g.focus(); } };

  return (
    <>
      <label className="wf-docs-search">
        <span className="wf-sr-only">Search the reference</span>
        <OldIcon icon={icon} name="search" />
        <input type="search" className="wf-input" value={typed} onChange={(e) => onType(e.target.value)} placeholder={"Search " + all.length + " concepts: names, keywords, lessons…"} data-wf-docs-q="" />
      </label>
      <p className="wf-muted wf-small" aria-live="polite">{query ? list.length + " of " + all.length + " concepts match “" + query + "”" : all.length + " concepts, A-Z"}</p>
      <nav className="wf-az-index" aria-label="Jump to a letter">{letters.map((L) => <a key={L} href={"#az-" + L} onClick={(e) => jump(e, L)}>{L}</a>)}</nav>
      {!list.length && <LegacyHtml html={shared.emptyStage("search", "No concept matches that search.", ["#/docs?t=az", "Show every concept"])} label="empty" />}
      <div key={query}>
        {letters.map((L) => (
          <section className="wf-az-group" id={"az-" + L} aria-labelledby={"azh-" + L} key={L}>
            <h2 className="wf-docs-h wf-az-h" id={"azh-" + L}>{L}</h2>
            {list.filter((c) => letterOf(c) === L).map((c) => (
              <Concept key={c.slug} c={c} startOpen={c.slug === open} openRef={c.slug === open ? openRef : null} shared={shared} />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}

// a concept's lesson and runnable example, built when it is opened (161 at once would be slow)
function Concept({ c, startOpen, openRef, shared }) {
  const [opened, setOpened] = useState(!!startOpen);
  return (
    <details className="wf-doc" data-wf-doc={c.slug} open={startOpen || undefined} ref={openRef} onToggle={(e) => { if (e.currentTarget.open) setOpened(true); }}>
      <summary><span className="wf-doc-n">{c.name}</span><span className="wf-muted wf-small">{"Level " + c.level}</span></summary>
      <div className="wf-doc-body">
        {opened && (c.lesson ? (
          <>
            <LegacyHtml html={shared.lessonCard(c.lesson, { noTables: true })} label="lesson" />
            <SqlWorkspace lesson={c.lesson} slug={c.slug} />
            <TablesPanel dataset={c.lesson.dataset} sql={exampleSqlOf(c.lesson)} open />
            <p className="wf-small"><a href={"#/learn/" + encodeURIComponent(c.slug) + "?s=1"}>Learn it step by step</a>{" · "}<a href={"#/concept/" + encodeURIComponent(c.slug)}>Practise it</a></p>
          </>
        ) : <LegacyHtml html={shared.emptyStage("file", "No lesson for this concept yet.", ["#/concept/" + encodeURIComponent(c.slug), "Open the concept page"])} label="empty" />)}
      </div>
    </details>
  );
}
