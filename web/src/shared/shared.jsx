// React wrappers for the shared pieces of the old front end (public/app.js). The one copy of each piece stays
// in app.js (window.SQLDrillsShared); a wrapper renders through it inside #view, so the old delegated handlers,
// keyboard use and API calls apply unchanged. New pages use these instead of rewriting the pieces.
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";

const SharedContext = createContext(null);

/** Tests and the catalog can pass their own implementation; pages use the one app.js exposes. */
export const SharedProvider = SharedContext.Provider;

export function useShared() {
  const injected = useContext(SharedContext);
  const shared = injected || (typeof window !== "undefined" ? window.SQLDrillsShared : null);
  if (!shared) throw new Error("The shared pieces are not loaded (public/app.js exposes window.SQLDrillsShared).");
  return shared;
}

/** True once app.js has loaded the library (some pieces, like the cards, read it). */
export function useBooted() {
  const shared = useShared();
  const [booted, setBooted] = useState(() => !!shared.booted);
  useEffect(() => {
    if (booted) return undefined;
    const on = () => setBooted(true);
    window.addEventListener("sqldrills:booted", on);
    if (shared.booted) setBooted(true);
    return () => window.removeEventListener("sqldrills:booted", on);
  }, [booted, shared]);
  return booted;
}

/**
 * Renders HTML built by an old piece and runs its mount step. The box uses display: contents, so the page lays
 * out exactly as if the old markup were there on its own. With keepStarted, markup the learner has started
 * (data-started, set by app.js's markStarted) is not replaced: the new markup waits until it is safe, like
 * app.js's refreshConcept.
 */
export function LegacyHtml({ html, mount, keepStarted = false, label }) {
  const ref = useRef(null);
  const shown = useRef(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || shown.current === html) return;
    if (keepStarted && el.querySelector("[data-started]")) return;
    el.innerHTML = html;
    shown.current = html;
    if (mount) mount(el);
  }, [html, mount, keepStarted]);
  return <div ref={ref} className="wf-legacy" data-shared={label} style={{ display: "contents" }} />;
}

// a stable key for option objects, so a re-render with equal props does not rebuild the markup
const key = (v) => JSON.stringify(v === undefined ? null : v);

/** schemaPanel(src, opts): src { kind: "sqlite", key } or { kind: "server", item, dialect }; opts { open, hint, sql, title, cls, insert } */
export function SchemaPanel({ src, open, hint, sql, title, cls, insert }) {
  const s = useShared();
  const opts = { open, hint, sql, title, cls, insert };
  const k = key([src, opts]);
  const html = useMemoByKey(k, () => s.schemaPanel(src, stripUndefined(opts)));
  return <LegacyHtml html={html} mount={s.schemaMount} label="schemaPanel" />;
}

/** tablesPanel(dataset, sql, open): the tables a piece of SQL runs on; nothing when the SQL creates its own tables */
export function TablesPanel({ dataset, sql = "", open = false }) {
  const s = useShared();
  const html = useMemoByKey(key([dataset, sql, open]), () => s.tablesPanel(dataset, sql, open));
  if (!html) return null;
  return <LegacyHtml html={html} mount={s.schemaMount} label="tablesPanel" />;
}

/** sqlWorkspace(lesson, slug, opts): the course editor with Run / Back to the example / Copy, and the result */
export function SqlWorkspace({ lesson, slug, opts }) {
  const s = useShared();
  const html = useMemoByKey(key([lesson, slug, opts]), () => s.sqlWorkspace(lesson, slug, opts));
  return <LegacyHtml html={html} mount={s.wsMount} label="sqlWorkspace" />;
}

/** lessonExample(example): a lesson's example (query and its real result, before/after, not-run, error) */
export function ExampleBox({ example }) {
  const s = useShared();
  const html = useMemoByKey(key(example), () => (example ? s.lessonExample(example) : ""));
  if (!html) return null;
  return <LegacyHtml html={html} label="exampleBox" />;
}

/** resultTable(r): a result grid ({ columns, values, total }) */
export function ResultTable({ result }) {
  const s = useShared();
  const html = useMemoByKey(key(result), () => s.resultTable(result));
  return <LegacyHtml html={html} label="resultTable" />;
}

/** diffTables(expected, got): expected vs your result, rows marked (.rdiff), with the legend */
export function ResultDiff({ expected, got }) {
  const s = useShared();
  const html = useMemoByKey(key([expected, got]), () => s.diffTables(expected, got));
  return <LegacyHtml html={html} label="resultDiff" />;
}

/** miniTable(r): the small table used in lessons and cards ({ columns, rows }) */
export function MiniTable({ result }) {
  const s = useShared();
  const html = useMemoByKey(key(result), () => s.miniTable(result));
  return <LegacyHtml html={html} label="miniTable" />;
}

/** xcardHtml(card, opts): an interaction card; a started card is never replaced by a re-render */
export function InteractionCard({ card, challenge = false }) {
  const s = useShared();
  const html = useMemoByKey(key([card, challenge]), () => s.xcardHtml(card, challenge ? { challenge: true } : undefined));
  if (!html) return null;
  return <LegacyHtml html={html} keepStarted label="card" />;
}

/** askConfirm / confirmClick: the in-page confirm on <dialog id="confirmDlg"> ([data-confirm=ok]) */
export function useConfirm() {
  const s = useShared();
  return { askConfirm: s.askConfirm, confirmClick: s.confirmClick };
}

function stripUndefined(o) { return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)); }

// useMemo keyed by a string (the old builders take plain objects; a new object with the same content must not
// rebuild the markup, which would reset what the learner typed)
function useMemoByKey(k, build) {
  const memo = useRef({ k: undefined, v: undefined });
  if (memo.current.k !== k) memo.current = { k, v: build() };
  return memo.current.v;
}
