// My notes (#/notes): the learner's reflections, searchable. Same text, calls (/api/learn/reflections?q=, DELETE
// /api/learn/reflections/<id> after the in-page confirm) and behaviour as the old view (app.js viewNotes, noteCard,
// loadNotes): the search keeps its box and focus, runs 200 ms after typing, and is remembered for the visit.
import { useEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./home.scss";
import "./docs.scss";
import "./notes.scss";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, useShared } from "../shared/shared.jsx";

function NoteCard({ r, icon, onDelete }) {
  const s = useShared();
  const when = new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const it = r.item_id && s.state.byId[r.item_id];
  return (
    <Card as="article">
      <div className="wf-card-pad wf-note">
        <div className="wf-note-h">
          <span className="wf-muted wf-small">{when}</span>
          {r.source === "mistake_card" && <span className="wf-tag">Misconception</span>}
          {r.result && <span className={"wf-pill " + (r.result === "pass" ? "done" : "fail")}>{r.result === "pass" ? "Solved" : "Not yet"}</span>}
          {r.confidence ? <span className="wf-small wf-note-conf">Confidence <b className="mono">{r.confidence}</b>/5</span> : null}
          <button type="button" className="wf-icon-btn" aria-label="Delete this note" onClick={(e) => onDelete(e.currentTarget, r.id)}><OldIcon icon={icon} name="x" /></button>
        </div>
        {it ? <a className="wf-note-item" href={s.href(it)}>{it.title}</a> : r.itemTitle ? <span className="wf-note-item">{r.itemTitle}</span> : null}
        {(r.concepts || []).length > 0 && <div className="wf-note-tags">{r.concepts.map((x) => <a key={x.slug} className="wf-tag-link" href={"#/concept/" + x.slug}>{x.name}</a>)}</div>}
        {r.explain && <p className="wf-note-text">{r.explain}</p>}
        {r.mistake && <p className="wf-note-text"><b>Mistake:</b> {r.mistake}</p>}
        {r.feedback && <div className="wf-rf-feedback"><div className="wf-muted wf-small">AI feedback</div><p>{r.feedback}</p></div>}
      </div>
    </Card>
  );
}

export default function NotesPage({ icon }) {
  const s = useShared(), S = s.state;
  const [q, setQ] = useState(S.learn.notesQ || "");
  const [res, setRes] = useState(null);
  const [error, setError] = useState(null);
  const timer = useRef(null), box = useRef(null), seq = useRef(0);
  const load = (query) => {
    const n = ++seq.current;
    s.api("/api/learn/reflections?q=" + encodeURIComponent(query)).then((r) => { if (n === seq.current) { setError(null); setRes({ q: query, ...r }); } }, (e) => { if (n === seq.current) setError(e); });
  };
  useEffect(() => { load(S.learn.notesQ || ""); return () => clearTimeout(timer.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onType = (v) => { setQ(v); S.learn.notesQ = v; clearTimeout(timer.current); timer.current = setTimeout(() => load(v), 200); };
  const clear = () => { S.learn.notesQ = ""; setQ(""); load(""); if (box.current) box.current.focus(); };
  const del = (btn, id) => {
    if (!s.confirmClick(btn, "Delete this note? It can't be undone.", "Delete note")) return;
    fetch("/api/learn/reflections/" + id, { method: "DELETE", headers: s.versionHeaders() }).then(s.watchVersion).then(() => { s.markConceptStale(); S.learn.levels = {}; load(S.learn.notesQ || ""); });
  };

  let list;
  if (error) list = <div className="wf-err">{error.message}</div>;
  else if (!res) list = <p className="wf-muted wf-small">Loading…</p>;
  else list = (
    <>
      <p className="wf-muted wf-small">{res.q ? res.notes.length + " of " + s.plural(res.total, "note") + " match “" + res.q + "”" : s.plural(res.total, "note")}</p>
      {res.notes.length ? res.notes.map((r) => <NoteCard key={r.id} r={r} icon={icon} onDelete={del} />)
        : res.total ? (
          <Card><div className="wf-card-pad wf-empty-card"><OldIcon icon={icon} name="note" /><div><p>{"No note matches “" + res.q + "”."}</p><Button size="small" onClick={clear}>Clear the search</Button></div></div></Card>
        ) : <LegacyHtml label="empty" html={s.emptyStage("note", "No notes yet: a note is saved when you write a reflection. After an exercise the Reflect box asks for one sentence; every concept page has one too.", ["#/home", "Reflect from today's plan"])} />}
    </>
  );
  return (
    <div className="wf-with-rail">
      <div className="wf-main">
        <div className="wf-hero">
          <div className="wf-eyebrow">My notes</div>
          <h1>My notes</h1>
          <p>Your reflections: what you explained, the mistakes you named and how confident you felt. Search them to revise.</p>
        </div>
        <label className="wf-docs-search wf-notes-search">
          <span className="wf-sr-only">Search my notes</span>
          <OldIcon icon={icon} name="search" />
          <input type="search" className="wf-input" ref={box} value={q} onChange={(e) => onType(e.target.value)} placeholder="Search notes, exercises, concepts…" />
        </label>
        <div aria-live="polite" className="wf-notes-list">{list}</div>
      </div>
      <LegacyHtml html={s.rail()} label="rail" />
    </div>
  );
}
