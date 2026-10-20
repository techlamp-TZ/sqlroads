// The exercise page (#/drill/<id>): the head (status, check kind, tables, bookmark, previous / next with Alt+←/→),
// the task, notes and schema on the left, the editor on the right. Same text, ids, calls and keys as the old view
// (app.js viewDrill). The exercise engine is the one copy in app.js: the editor card (drillEditorHtml: Run with
// Ctrl+Enter, Submit with Ctrl+Shift+Enter, hints with Ctrl+I, format, solution, Reset data, the result and its diff)
// and its wiring (drillWire: the draft, the task text, the server checker, the Reflect box, the mistake card in
// #extra). React draws the page once; the engine updates its own parts.
import { useLayoutEffect, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import { BookmarkIcon, ChevronLeftIcon } from "@waffles/icons";
import "../shared/page.scss";
import "./home.scss";
import "./learn.scss";
import "./drill.scss";
import { attrs } from "../admin/admin.jsx";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, SchemaPanel, useShared } from "../shared/shared.jsx";

function Note({ icon, name, cls = "", children }) {
  return <div className={"wf-self-note " + cls}><OldIcon icon={icon} name={name} /><div>{children}</div></div>;
}

export default function DrillPage({ route, icon }) {
  const s = useShared(), S = s.state;
  const id = route.args[0], d = S.byId[id];
  const [marked, setMarked] = useState(() => !!(d && S.bookmarks[d.key]));
  // the engine wires the editor and fills the task once the page is on screen (as the old view did)
  useLayoutEffect(() => { if (d) { s.store("sqldrills.lastItem", d.id); s.drillWire(d); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return <div className="wf-lw-page"><Card><div className="wf-card-pad">That exercise doesn't exist any more. <a href="#/drills">Back to all exercises</a></div></Card></div>;

  const ctx = S.lastList && S.lastList.indexOf(d) > -1 ? S.lastList : s.itemsIn(d.level);
  const i = ctx.indexOf(d), prev = ctx[i - 1], next = ctx[i + 1], server = d.engine === "server";
  const L = s.levelOf(d.level), secOf = L.sections && L.sections.filter((x) => x.key === d.section)[0];
  const lvl = s.itemsIn(d.level), at = lvl.indexOf(d), from = Math.max(0, at - 6), near = lvl.slice(from, from + 14);
  const bookmark = () => { const on = s.toggleBookmark(d.key); setMarked(on); };
  return (
    <div className="wf-lw-page">
      <div className="wf-drill">
        <nav className="wf-crumbs" aria-label="Breadcrumb">
          <a href="#/levels">Levels</a><OldIcon icon={icon} name="chevRight" /><a href={"#/level/" + d.level}>{s.levelName(d.level)}</a><OldIcon icon={icon} name="chevRight" />
          {secOf && <><span>{secOf.title}</span><OldIcon icon={icon} name="chevRight" /></>}
          <span>{"Exercise " + d.seq + " of " + lvl.length}</span>
        </nav>
        <div className="wf-dhead">
          <div>
            <h1>{d.title}</h1>
            <div className="wf-dmeta">
              <LegacyHtml label="diff" html={s.diffBadge(d.diff)} />
              <span data-drill-status=""><LegacyHtml label="status" html={s.statusHtml(d)} /></span>
              {d.check === "self" ? <span className="wf-tag wf-self-tag"><OldIcon icon={icon} name="selfcheck" />Self-check</span> : <span className="wf-tag wf-tag-plain">{s.CHECK_LABEL[d.check] || "Auto-checked"}</span>}
              {d.tables && d.tables.length ? <span className="wf-dset" title={S.datasets[d.dataset] || ""}><OldIcon icon={icon} name="table" /><span className="mono">{d.tables.join(", ")}</span></span>
                : S.datasets[d.dataset] ? <span className="wf-dset"><OldIcon icon={icon} name={server ? "server" : "db"} />{S.datasets[d.dataset]}</span> : null}
            </div>
          </div>
          <div className="wf-actions wf-dacts">
            <Button appearance={marked ? "primary" : "default"} onClick={bookmark} dataAttributes={{ "wf-bm": d.key }}>{[<BookmarkIcon key="i" />, marked ? "Bookmarked" : "Bookmark"]}</Button>
            {prev && <Button type="link" href={s.href(prev)} ariaLabel="Previous exercise" ref={attrs({ id: "exPrev", "aria-keyshortcuts": "Alt+ArrowLeft", title: "Previous (Alt+←)" })}><ChevronLeftIcon /></Button>}
            {next && <Button type="link" href={s.href(next)} ref={attrs({ id: "exNext", "aria-keyshortcuts": "Alt+ArrowRight", title: "Next (Alt+→)" })}>Next</Button>}
          </div>
        </div>
        <div className="wf-ex-split">
          <div className="wf-ws-left">
            <LegacyHtml label="task" html={'<section class="card card-pad ws-task" id="task"><div class="card-h"><h2 class="rail-h">' + s.icon("target") + 'Your task</h2></div><div class="dq"><p class="muted">Loading…</p></div></section>'} />
            {d.clock && <Note icon={icon} name="bulb" cls="wf-clock-note"><strong>{"Today is " + new Date(d.clock + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) + " in this exercise."}</strong>{" Queries that use the current date (date('now'), CURRENT_DATE …) all see this day, so your answer and the solution are compared on the same date."}</Note>}
            {d.sample && <Note icon={icon} name="bulb" cls="wf-clock-note"><strong>A random sample.</strong>{" Any " + (d.sample === true ? "" : d.sample + " ") + "rows of the right set count as correct: they don't have to be the solution's rows."}</Note>}
            {d.check === "run" && <Note icon={icon} name="bulb" cls="wf-nc-note"><strong>Practice · not checked.</strong>{" This drill doesn't have a reference answer yet, so your result isn't compared with anything: it counts as done as soon as your query runs without an error. Read your result against the task to judge it yourself."}</Note>}
            {d.check === "self" && <Note icon={icon} name="selfcheck"><strong>Self-check exercise.</strong>{" This one can't be marked automatically (it changes structure, needs judgement, or is about understanding). Do it, compare with the expected result and the solution, then press "}<b>Mark as done</b>.</Note>}
            <SchemaPanel src={server ? { kind: "server", item: d.id, dialect: s.dialect() } : { kind: "sqlite", key: d.dataset }} insert open={!s.spIsPhone()} cls="ws-schema" hint="click a name to insert it" />
            <Card as="section"><div className="wf-card-pad wf-ws-levels">
              <h2 className="wf-h3 wf-h3-sm"><OldIcon icon={icon} name="levels" />{s.levelName(d.level)}</h2>
              <div className="wf-mini-list">
                {near.map((x) => (
                  <a key={x.id} href={s.href(x)} className={x === d ? "on" : ""} aria-current={x === d ? "page" : undefined}>
                    <span className={"wf-mn" + (s.isDone(x) ? " done" : "")}>{s.isDone(x) ? <OldIcon icon={icon} name="check" /> : x.seq}</span><span>{x.title}</span>
                  </a>
                ))}
              </div>
              <a className="wf-more" href={"#/level/" + d.level}>{"Whole level (" + lvl.length + ") "}<OldIcon icon={icon} name="chevRight" /></a>
            </div></Card>
          </div>
          <div className="wf-ws-right">
            {server && <LegacyHtml label="db" html={'<div id="dbBanner"></div>'} />}
            <LegacyHtml label="editor" html={s.drillEditorHtml(d)} />
            <LegacyHtml label="extra" html={'<div id="extra"></div>'} />
            <LegacyHtml label="quickCheck" html={s.quickCheck(d)} />
          </div>
        </div>
      </div>
    </div>
  );
}
