// Flashcards (#/flashcards): the library (filters, search, sort, pages) and a study session (?concept=, ?card=,
// ?study=1). Same text, addresses, calls and keys as the old views (app.js viewFlashcardLibrary, viewFlashcards,
// flashStep…): Space / Enter shows the answer, Y / N grades, Enter checks a typed answer, Backspace undoes the last
// clause. The card engine (public/cards.js) checks answers; "spot the error" and the tables are the shared pieces.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./home.scss";
import "./learn.scss";
import "./docs.scss";
import "./flashcards.scss";
import { OldIcon } from "../shared/OldIcon.jsx";
import { LegacyHtml, TablesPanel, useShared } from "../shared/shared.jsx";

const TYPE_LABEL = { keyword: "Keyword", blank: "Fill in the blank", order: "Clause order", error: "Spot the error" };
const typeLabel = (t) => TYPE_LABEL[t] || t || "Flashcard";
let typing = null; // the search box across the re-render its address change causes: { value, pos, at }

// ---------------- the library ----------------
function LibCard({ c, icon }) {
  const front = c.type === "keyword" ? c.front : c.prompt || typeLabel(c.type);
  const detail = c.type === "keyword" ? c.back : c.type === "blank" ? c.sql : c.type === "order" ? (c.parts || []).join("  →  ") : c.wrong_sql;
  const answer = c.type === "blank" ? "Answer: " + (c.answer || "") : c.type === "error" ? "Fixed: " + (c.fixed_sql || "") : c.type === "keyword" ? c.back : c.type === "order" ? "Correct order: " + (c.parts || []).join("  →  ") : "";
  const go = "#/flashcards?concept=" + encodeURIComponent(c.concept) + "&card=" + encodeURIComponent(c.id);
  const open = (e) => { if (e.target.closest("a,button,summary,details")) return; location.hash = go; };
  const key = (e) => { if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); location.hash = go; } };
  return (
    <article className="wf-fc-lib-card" tabIndex={0} aria-label={"Open flashcard: " + front} onClick={open} onKeyDown={key}>
      <div className="wf-fc-lib-head">
        <span className="wf-tag">{typeLabel(c.type)}</span><span className="wf-tag wf-tag-plain">{"Level " + c.level}</span><span className="wf-tag wf-tag-plain">{c.conceptName}</span>
        <span className="wf-grow" />
        <Button type="link" size="small" href={go}>Study this card</Button>
      </div>
      <h2 className="wf-fc-lib-h">{front}</h2>
      {detail && <pre className="wf-fc-lib-code">{detail}</pre>}
      {answer && c.type !== "keyword" && <details><summary className="wf-small">Show answer</summary><p className="wf-small">{answer}</p></details>}
    </article>
  );
}

function Pager({ page, pages, total, size, q, icon }) {
  const to = (p) => { const n = new URLSearchParams(q); n.set("page", p); location.hash = "#/flashcards?" + n; };
  const nums = [];
  for (let i = 0; i < pages; i++) if (i < 1 || i >= pages - 1 || Math.abs(i - page) <= 2) nums.push(i); else if (nums[nums.length - 1] !== -1) nums.push(-1);
  const setSize = (v) => { const n = new URLSearchParams(q); if (v === "25") n.delete("size"); else n.set("size", v); n.delete("page"); location.hash = "#/flashcards" + (n.toString() ? "?" + n : ""); };
  return (
    <nav className="wf-pager" aria-label="Pages">
      <button type="button" className="wf-page-btn" disabled={page <= 0} aria-label="Previous page" onClick={() => to(page - 1)}><OldIcon icon={icon} name="chevLeft" /></button>
      {nums.map((i, k) => (i < 0 ? <button type="button" className="wf-page-btn" key={"e" + k} disabled>…</button>
        : <button type="button" key={i} className={"wf-page-btn" + (i === page ? " on" : "")} aria-current={i === page ? "page" : undefined} onClick={() => to(i)}>{i + 1}</button>))}
      <button type="button" className="wf-page-btn" disabled={page >= pages - 1} aria-label="Next page" onClick={() => to(page + 1)}><OldIcon icon={icon} name="chevRight" /></button>
      <span className="wf-pager-info">{"Showing " + (total ? page * size + 1 : 0) + "–" + Math.min(total, (page + 1) * size) + " of " + total.toLocaleString() + " flashcards"}</span>
      <select className="wf-control wf-auto" aria-label="Per page" value={String(size)} onChange={(e) => setSize(e.target.value)}>
        {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n + " / page"}</option>)}
      </select>
    </nav>
  );
}

function Library({ route, icon }) {
  const s = useShared();
  const q = route.q;
  const [r, setR] = useState(null);
  const [error, setError] = useState(null);
  const search = useRef(null), timer = useRef(null);
  useEffect(() => {
    const params = new URLSearchParams();
    ["q", "type", "level", "concept", "sort", "page", "size"].forEach((k) => { if (q.get(k)) params.set(k, q.get(k)); });
    s.api("/api/learn/flashcards" + (params.toString() ? "?" + params : "")).then(setR, setError);
    return () => clearTimeout(timer.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // the search re-renders the page: keep the learner typing (what they typed, keys pressed while it loaded, the caret)
  useLayoutEffect(() => {
    if (!r || !typing || Date.now() - typing.at >= 3000 || !search.current) return;
    const b = search.current; b.value = typing.value; b.focus(); b.selectionStart = b.selectionEnd = Math.min(typing.pos, typing.value.length);
  }, [r]);
  const onSearch = (e) => {
    const v = e.target.value, fq = new URLSearchParams(q);
    if (v) fq.set("q", v); else fq.delete("q"); fq.delete("page");
    typing = { value: v, pos: e.target.selectionStart, at: Date.now() };
    clearTimeout(timer.current); timer.current = setTimeout(() => { location.hash = "#/flashcards?" + fq; }, 250);
  };
  const onSelect = (key) => (e) => {
    const fq = new URLSearchParams(q), value = e.target.value;
    if (!value || value === "all" || (key === "sort" && value === "path")) fq.delete(key); else fq.set(key, value);
    fq.delete("page"); location.hash = "#/flashcards" + (fq.toString() ? "?" + fq : "");
  };
  if (error) return <div className="wf-lw-page"><Card><div className="wf-card-pad"><div className="wf-bad-txt">{error.message}</div></div></Card></div>;
  if (!r) return <div className="wf-with-rail"><div className="wf-main" /><LegacyHtml html={s.rail()} label="rail" /></div>;
  const type = q.get("type") || "all", level = q.get("level") || "all", concept = q.get("concept") || "all", sort = q.get("sort") || "path";
  const chip = (key, value, label, current) => {
    const n = new URLSearchParams(q); if (value === "all") n.delete(key); else n.set(key, value); n.delete("page"); n.delete("study");
    return <a key={key + value} className={"wf-chip" + (String(current) === value ? " is-on" : "")} aria-current={String(current) === value ? "true" : undefined} href={"#/flashcards" + (n.toString() ? "?" + n : "")}>{label}</a>;
  };
  return (
    <div className="wf-with-rail">
      <div className="wf-main">
        <div className="wf-hero wf-hero-act">
          <div>
            <div className="wf-eyebrow">Flashcards</div>
            <h1>SQL Flashcard Library</h1>
            <p>{r.total.toLocaleString() + " published flashcards. Browse the full bank, filter by level or card type, then study a concept."}</p>
          </div>
          <Button type="link" appearance="primary" href="#/flashcards?study=1">Start today's review</Button>
        </div>
        <Card as="section"><div className="wf-card-pad wf-fc-filters">
          <div className="wf-f-group"><div className="wf-f-label"><OldIcon icon={icon} name="cards" />Card type</div>
            <div className="wf-chips">{[["all", "All types"], ["keyword", "Keyword"], ["blank", "Fill in the blank"], ["order", "Clause order"], ["error", "Spot the error"]].map((x) => chip("type", x[0], x[1], type))}</div></div>
          <div className="wf-f-group"><div className="wf-f-label"><OldIcon icon={icon} name="levels" />Level</div>
            <div className="wf-chips">{chip("level", "all", "All levels", level)}{(r.levels || []).map((x) => chip("level", String(x.level), "Level " + x.level, level))}</div></div>
          <div className="wf-f-group"><label className="wf-f-label" htmlFor="fc-concept"><OldIcon icon={icon} name="search" />Concept</label>
            <select className="wf-control" id="fc-concept" value={concept} onChange={onSelect("concept")}>
              <option value="all">All concepts</option>
              {(r.concepts || []).map((x) => <option key={x.slug} value={x.slug}>{"Level " + x.level + " · " + x.name + " (" + x.count.toLocaleString() + ")"}</option>)}
            </select></div>
        </div></Card>
        <div className="wf-listbar">
          <label className="wf-docs-search"><OldIcon icon={icon} name="search" /><input className="wf-input" ref={search} defaultValue={q.get("q") || ""} onChange={onSearch} placeholder="Search flashcards…" aria-label="Search flashcards" /></label>
          <label className="wf-sortsel">Sort by <select className="wf-control wf-auto" value={sort} onChange={onSelect("sort")}><option value="path">Level order</option><option value="new">Newest first</option></select></label>
        </div>
        {r.items.length ? <div className="wf-fc-lib-list">{r.items.map((c) => <LibCard key={c.id} c={c} icon={icon} />)}</div>
          : <Card><div className="wf-card-pad wf-empty-card"><OldIcon icon={icon} name="search" /><div>Nothing matches these filters.</div><p><Button type="link" href="#/flashcards">Clear filters</Button></p></div></Card>}
        <Pager page={r.page} pages={r.pages} total={r.total} size={r.size} q={q} icon={icon} />
      </div>
      <LegacyHtml html={s.rail()} label="rail" />
    </div>
  );
}

// ---------------- a study session ----------------
function Shell({ F, icon, children }) {
  const c = F.cards[F.i];
  return (
    <div className="wf-lw-page"><div className="wf-fc-page">
      <nav className="wf-crumbs" aria-label="Breadcrumb">
        {F.slug ? <a href={"#/concept/" + F.slug + "?tab=memorize"}>{(c && c.conceptName) || "Concept"}</a> : <a href="#/flashcards">Flashcard library</a>}
        <OldIcon icon={icon} name="chevRight" /><span>Flashcards</span>
      </nav>
      <div className="wf-fc-top">
        <span className="mono">{F.i < F.cards.length ? "Card " + (F.i + 1) + " of " + F.cards.length : "Done"}</span>
        <span className="wf-bar" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax={F.cards.length} aria-valuenow={F.i}><span style={{ width: (F.cards.length ? Math.round((100 * F.i) / F.cards.length) : 0) + "%" }} /></span>
        <span className="wf-small"><b className="wf-ok-txt">{F.right}</b> right · <b className="wf-bad-txt">{F.wrong}</b> to review</span>
      </div>
      {children}
    </div></div>
  );
}

const Kbd = ({ k }) => <kbd className="wf-kbd">{k}</kbd>;

function NothingDue({ F, icon }) {
  const s = useShared(), S = s.state;
  const [info, setInfo] = useState(null);
  const h = useRef(null);
  useLayoutEffect(() => { if (h.current) h.current.focus(); }, [info]);
  useEffect(() => {
    const lv = s.currentLevel();
    // the next review: the earliest due date of the cards already studied (concepts with reviewed cards, every level)
    const nextDue = Promise.all(S.levels.map((L) => s.api("/api/learn/levels/" + L.n).catch(() => ({ concepts: [] })))).then((ls) => {
      const slugs = [].concat(...ls.map((x) => (x.concepts || []).filter((c) => c.counts && c.counts.flash && c.counts.flash.reviewed).map((c) => c.slug)));
      return Promise.all(slugs.map((sl) => s.loadConcept(sl).catch(() => null))).then((cs) => {
        const due = []; cs.forEach((c) => { ((c && c.flashcards) || []).forEach((f) => { if (f.state && f.state.due_at) due.push(f.state.due_at); }); });
        return due.sort()[0] || null;
      });
    });
    Promise.all([s.api("/api/learn/today?level=" + lv), nextDue]).then((r) => setInfo({ lv, nc: r[0] && r[0].flashcards && r[0].flashcards.newConcept, when: r[1] }), (e) => setInfo({ error: e.message }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  let body;
  if (!info) body = <><h2 tabIndex={-1} ref={h}>No cards due</h2><p className="wf-muted">Looking for new cards…</p></>;
  else if (info.error) body = <><h2 tabIndex={-1} ref={h}>No cards due</h2><p className="wf-bad-txt">{info.error}</p><div className="wf-actions"><Button type="link" href="#/home">Back to Home</Button></div></>;
  else {
    const { nc, when, lv } = info, whenTxt = when ? new Date(when).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : null;
    body = (
      <>
        <OldIcon icon={icon} name="cards" />
        <h2 tabIndex={-1} ref={h}>No cards due</h2>
        <p>{when ? <>Your next review is on <b>{whenTxt}</b>.</> : "You haven't studied any flashcards yet, so none is due for review."}</p>
        <p className="wf-muted wf-small">How reviews work: a card you answer comes back after 1, 3, 7 and 14 days; a wrong answer brings it back tomorrow. New cards start from a concept.</p>
        <div className="wf-actions">{nc ? <Button type="link" appearance="primary" href={"#/flashcards?concept=" + encodeURIComponent(nc.slug)}>{"Start new cards: " + nc.name + " (" + nc.fresh + " " + (nc.fresh === 1 ? "card" : "cards") + ")"}</Button>
          : <Button type="link" appearance="primary" href={"#/level/" + lv}>{"Open Level " + lv}</Button>}</div>
        {!nc && <p className="wf-muted wf-small">{"Every flashcard in Level " + lv + " is started. The next level's cards appear as you move on."}</p>}
      </>
    );
  }
  return <Shell F={F} icon={icon}><Card as="section"><div className="wf-card-pad wf-fc-done" role="status" aria-busy={!info || undefined}>{body}</div></Card></Shell>;
}

function Done({ F, icon }) {
  const s = useShared(), S = s.state;
  const h = useRef(null);
  useLayoutEffect(() => { if (h.current) h.current.focus(); s.markConceptStale(); S.learn.levels = {}; S.learn.today = null; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell F={F} icon={icon}>
      <Card as="section"><div className="wf-card-pad wf-fc-done" role="status">
        <OldIcon icon={icon} name="trophy" />
        <h2 tabIndex={-1} ref={h}>{F.cards.length ? "Session done" : "No cards due"}</h2>
        <p>{F.cards.length ? F.right + " right, " + F.wrong + " to review again tomorrow." + (F.extra ? " These were extra practice: only a card that is due moves on in the schedule." : "") : "Nothing is due right now" + (F.later ? ": " + s.plural(F.later, "card") + " come back later." : ".")}</p>
        <div className="wf-actions">
          {F.slug && <Button type="link" appearance="primary" href={"#/concept/" + F.slug + "?tab=understand"}>Next: Understand</Button>}
          <Button type="link" href="#/home">Dashboard</Button>
        </div>
      </div></Card>
    </Shell>
  );
}

/** One card: its face, reveal / check, the result; grade(right) moves on. */
function FlashCard({ F, c, grade, busy, icon }) {
  const s = useShared();
  const [shown, setShown] = useState(false);     // keyword / error without the checker: the back is shown
  const [result, setResult] = useState(null);    // { right, html, checked }
  const [order, setOrder] = useState([]);        // clause order: the parts picked
  const [answer, setAnswer] = useState("");
  const [checking, setChecking] = useState(false);
  const root = useRef(null), sbRef = useRef(null);
  const shuffled = useRef(null);
  if (c.type === "order" && !shuffled.current) {
    const rnd = s.seeded(c.id + F.i), parts = c.parts.map((p, i) => ({ p, i }));
    for (let k = parts.length - 1; k > 0; k--) { const j = Math.floor(rnd() * (k + 1)); const t = parts[k]; parts[k] = parts[j]; parts[j] = t; }
    shuffled.current = parts;
  }
  const spot = c.type === "error" && s.spotBugUsable(c);
  // focus: the answer box, the fix box, the reveal button or the first part (as before); the result's first button
  useLayoutEffect(() => {
    const r = root.current; if (!r) return;
    const first = r.querySelector("#fcAnswer") || r.querySelector(".sb-fix") || r.querySelector("[data-wf-fc=reveal]") || r.querySelector("[data-wf-fc-part]");
    if (first) first.focus();
  }, []);
  useLayoutEffect(() => { if (result && root.current) { const b = root.current.querySelector(".wf-fc-res button"); if (b) b.focus(); } }, [result]);
  useLayoutEffect(() => { if (shown && root.current) { const b = root.current.querySelector(".wf-fc-grade button"); if (b) b.focus(); } }, [shown]);

  const show = (right, html, checked) => setResult({ right, html: html || "", checked: !!checked });
  const check = () => { const ok = window.Cards ? window.Cards.checkBlank(answer, c) : false; show(ok, '<pre class="mcq-code">' + s.highlight(String(c.sql).replace("___", c.answer)) + "</pre>"); };
  const pick = (n) => {
    const next = order.concat([n]); setOrder(next);
    if (next.length === shuffled.current.length) {
      const ok = next.every((m, i) => shuffled.current[m].p === c.parts[i]);
      show(ok, ok ? "" : '<div class="muted small">The right order</div><pre class="mcq-code">' + s.highlight(c.parts.join("\n")) + "</pre>");
    } else setTimeout(() => { const b = root.current && root.current.querySelector("[data-wf-fc-part]:not(:disabled)"); if (b) b.focus(); }, 0);
  };
  const undo = () => setOrder(order.slice(0, -1));
  const fix = (reveal) => {
    // a wrong fix (or showing the answer) counts as wrong: the card comes back tomorrow, like any flashcard
    const r = root.current;
    const done = (x) => { r.querySelectorAll(".sb-fix, .sb-diag input").forEach((el) => { el.disabled = true; }); setChecking(true); show(x.right, x.html, true); };
    if (reveal) s.Engine.run(c.dataset, c.fixed_sql).then((x) => { const exp = s.lastResult(x); done({ right: false, html: '<div class="muted small">A corrected query</div><pre class="mcq-code">' + s.highlight(c.fixed_sql) + "</pre>" + (c.explanation ? "<p>" + s.esc(c.explanation) + "</p>" : "") + (exp ? '<div class="muted small">Its real result</div>' + s.miniTable(exp) : "") }); });
    else s.spotBugCheck(r, c, "fc").then((x) => { if (x.msg) setResult({ msg: x.msg }); else if (x.fallback) done({ right: false, html: '<pre class="mcq-code">' + s.highlight(c.fixed_sql) + "</pre>" }); else done(x); });
  };

  // keys (as before; never while typing, except Enter in the answer box)
  useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || busy.current) return;
      const t = e.target.closest && e.target.closest("input,textarea");
      if (t) { if (e.key === "Enter" && e.target.id === "fcAnswer" && !result) { e.preventDefault(); check(); } return; }
      const reveal = (c.type === "keyword" || (c.type === "error" && !spot)) && !shown;
      const gradeOn = (c.type === "keyword" || (c.type === "error" && !spot)) && shown;
      if ((e.key === " " || e.key === "Enter") && reveal) { e.preventDefault(); setShown(true); }
      else if (gradeOn && (e.key === "y" || e.key === "Y")) { e.preventDefault(); grade(true); }
      else if (gradeOn && (e.key === "n" || e.key === "N")) { e.preventDefault(); grade(false); }
      else if (e.key === "Backspace" && c.type === "order" && order.length && !result) { e.preventDefault(); undo(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const revealBar = (
    <>
      {!shown && <div className="wf-actions wf-fc-reveal"><button type="button" className="wf-btn primary" data-wf-fc="reveal" onClick={() => setShown(true)}>Show the answer <Kbd k="Space" /></button></div>}
      {shown && <div className="wf-actions wf-fc-grade">
        <button type="button" className="wf-btn ok" onClick={() => grade(true)}><OldIcon icon={icon} name="check" />I knew it <Kbd k="Y" /></button>
        <button type="button" className="wf-btn" onClick={() => grade(false)}><OldIcon icon={icon} name="x" />I didn't <Kbd k="N" /></button>
      </div>}
    </>
  );
  let face;
  if (c.type === "keyword") face = <><div className="wf-fc-front">{c.front}</div>{shown && <div className="wf-fc-back">{c.back}</div>}{revealBar}</>;
  else if (c.type === "blank") face = (
    <>
      <div className="wf-fc-q">{c.prompt || "Fill in the blank"}</div>
      <pre className="mcq-code" dangerouslySetInnerHTML={{ __html: s.highlight(c.sql) }} />
      <label className="wf-fc-in"><span>Your answer for ___</span><input className="wf-control mono" id="fcAnswer" autoComplete="off" spellCheck={false} value={answer} readOnly={!!result} onChange={(e) => setAnswer(e.target.value)} /></label>
      {!result && <div className="wf-actions"><button type="button" className="wf-btn primary" onClick={check}>Check <Kbd k="Enter" /></button></div>}
    </>
  );
  else if (c.type === "order") face = (
    <>
      <div className="wf-fc-q">{c.prompt || "Put the clauses in the right order"}</div>
      <p className="wf-muted wf-small">Press the parts in order (Tab to move, Enter to pick). Backspace undoes the last one.</p>
      <ol className="wf-fc-built mono" aria-live="polite">{order.map((n) => <li key={n}>{shuffled.current[n].p}</li>)}</ol>
      <div className="wf-fc-parts">{shuffled.current.map((x, n) => <button type="button" key={n} className="wf-btn sm mono" data-wf-fc-part={n} disabled={order.indexOf(n) > -1 || !!result} onClick={() => pick(n)}>{x.p}</button>)}</div>
      <div className="wf-actions"><button type="button" className="wf-btn sm" disabled={!!result} onClick={undo}>Undo</button></div>
    </>
  );
  else if (spot) face = (
    <>
      <div ref={sbRef}><LegacyHtml label="spotBug" html={s.spotBugHtml(c, "fc")} /></div>
      <div className="wf-actions"><button type="button" className="wf-btn primary" disabled={checking} onClick={() => fix(false)}><OldIcon icon={icon} name="checkCircle" />Check</button><button type="button" className="wf-btn sm" disabled={checking} onClick={() => fix(true)}>Show the answer</button></div>
    </>
  );
  else face = (
    <>
      <div className="wf-fc-q">{c.prompt || "Spot the error"}</div>
      <pre className="mcq-code" dangerouslySetInnerHTML={{ __html: s.highlight(c.wrong_sql) }} />
      {shown && <div className="wf-fc-back"><div className="wf-muted wf-small">Fixed</div><pre className="mcq-code" dangerouslySetInnerHTML={{ __html: s.highlight(c.fixed_sql) }} /><p>{c.explanation || ""}</p></div>}
      {revealBar}
    </>
  );
  const resBox = (c.type === "blank" || c.type === "order" || spot) && (
    <div className="wf-fc-res" aria-live="polite">
      {result && result.msg && <p className="wf-small wf-bad-txt">{result.msg}</p>}
      {result && !result.msg && (
        <>
          <p className={"wf-verdict " + (result.right ? "wf-ok-txt" : "wf-bad-txt")}><OldIcon icon={icon} name={result.right ? "checkCircle" : "x"} />{result.right ? "Right" : "Not quite"}</p>
          {result.html && <div dangerouslySetInnerHTML={{ __html: result.html }} />}
          <div className="wf-actions">
            <button type="button" className="wf-btn primary" onClick={() => grade(result.right)}>Next card <Kbd k="Enter" /></button>
            {!(result.right || result.checked) && <button type="button" className="wf-btn sm" onClick={() => grade(true)}>I was right (typo)</button>}
          </div>
        </>
      )}
    </div>
  );
  return (
    <div ref={root}>
      <Card as="section"><div className="wf-card-pad wf-fc-card" aria-label="Flashcard">
        <div className="wf-fc-meta">
          <span className="wf-tag">{TYPE_LABEL[c.type] || c.type}</span>
          {!F.slug && <span className="wf-muted wf-small">{c.conceptName || ""}</span>}
          {c.state ? <span className="wf-muted wf-small">{c.state.interval + "-day gap"}</span> : <span className="wf-muted wf-small">new card</span>}
        </div>
        {face}
        {resBox}
      </div></Card>
      {c.type !== "keyword" && <TablesPanel dataset={c.dataset} sql={c.sql || c.fixed_sql || (c.parts || []).join(" ")} />}
    </div>
  );
}

function Session({ route, icon }) {
  const s = useShared();
  const slug = route.q.get("concept"), selectedCard = route.q.get("card");
  const [F, setF] = useState(null);
  const [error, setError] = useState(null);
  const busy = useRef(false);
  useEffect(() => {
    const sq = []; if (slug) sq.push("concept=" + encodeURIComponent(slug)); if (selectedCard) sq.push("card=" + encodeURIComponent(selectedCard));
    s.api("/api/learn/flash/session" + (sq.length ? "?" + sq.join("&") : "")).then((x) => {
      const base = { slug, cards: x.cards, i: 0, right: 0, wrong: 0, later: x.later };
      // nothing due: practise the concept's cards anyway (the schedule only moves when a card is due)
      if (!x.cards.length && slug) return s.loadConcept(slug).then((c) => setF({ ...base, cards: c.flashcards.map((f) => ({ conceptName: c.name, ...f })), extra: true }));
      setF(base);
    }).catch(setError);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const grade = (right) => {
    const c = F.cards[F.i];
    if (!c || busy.current) return;
    busy.current = true;
    s.api("/api/learn/flash/" + c.id, { correct: right }).then(() => {
      busy.current = false; s.learnEvent("flashcard", c.id);
      setF((f) => ({ ...f, right: f.right + (right ? 1 : 0), wrong: f.wrong + (right ? 0 : 1), i: f.i + 1 }));
    }).catch((e) => { busy.current = false; s.toast("Couldn't save: " + e.message); });
  };
  if (error) return <div className="wf-lw-page"><Card><div className="wf-card-pad">{error.message}</div></Card></div>;
  if (!F) return <div className="wf-lw-page"><div className="wf-fc-page"><Card><div className="wf-card-pad" aria-busy="true"><p className="wf-muted">Loading cards…</p></div></Card></div></div>;
  if (F.i >= F.cards.length) return !F.cards.length && !F.slug ? <NothingDue F={F} icon={icon} /> : <Done F={F} icon={icon} />;
  return <Shell F={F} icon={icon}><FlashCard key={F.i + ":" + F.cards[F.i].id} F={F} c={F.cards[F.i]} grade={grade} busy={busy} icon={icon} /></Shell>;
}

export default function FlashcardsPage({ route, icon }) {
  const q = route.q || new URLSearchParams();
  return !q.get("concept") && q.get("study") !== "1" ? <Library route={{ ...route, q }} icon={icon} /> : <Session route={{ ...route, q }} icon={icon} />;
}
