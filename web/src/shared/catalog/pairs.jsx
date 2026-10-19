import "./pairs.scss";
// Catalog and test page only: each shared piece twice, the old way (app.js's HTML put into the page and mounted,
// exactly as the old pages do) next to the React wrapper, with the same data. Inside the real app's #view, so
// both get the old handlers.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Button from "@waffles/button";
import {
  ConfirmButton, ExampleBox, InteractionCard, Loader, MiniTable, ResultDiff, ResultTable, SchemaPanel, SqlWorkspace,
  TablesPanel, WhenBooted,
} from "../index.jsx";
import { sampleData } from "./legacyApp.js";

/** The old way: innerHTML from the app.js function, then its mount step. */
function Old({ build, mount }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const s = window.SQLDrillsShared;
    ref.current.innerHTML = build(s);
    if (mount) mount(s)(ref.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div ref={ref} data-side="old" />;
}

let pairSeq = 0;
export function Pair({ name, old, children }) {
  const ref = useRef(null);
  const [id] = useState(() => "pair" + (++pairSeq));
  // side by side, the two copies of a piece are landmarks with the same name ("Try the example"); on a real page
  // there is only one. Harness only: each copy's name gets its column's label in front.
  useEffect(() => {
    const t = setTimeout(() => {
      for (const side of ["old", "new"]) {
        const col = ref.current && ref.current.querySelector(".wf-pair-col-" + side);
        if (!col) continue;
        for (const lm of col.querySelectorAll("section[aria-labelledby], aside[aria-labelledby], nav[aria-labelledby], form[aria-labelledby]")) {
          if (!lm.getAttribute("aria-labelledby").startsWith(id)) lm.setAttribute("aria-labelledby", id + "-" + side + " " + lm.getAttribute("aria-labelledby"));
        }
      }
    }, 0);
    return () => clearTimeout(t);
  });
  return (
    <section className="wf-pair" aria-label={name} ref={ref}>
      <h2 className="wf-pair-h">{name}</h2>
      <div className="wf-pair-cols">
        <div className="wf-pair-col wf-pair-col-old"><h3 className="wf-pair-tag" id={id + "-old"}>Old (app.js)</h3>{old}</div>
        <div className="wf-pair-col wf-pair-col-new" data-side="new"><h3 className="wf-pair-tag" id={id + "-new"}>New (React wrapper)</h3>{children}</div>
      </div>
    </section>
  );
}

function useSample() {
  const [d, setD] = useState(null);
  useEffect(() => { sampleData().then(setD); }, []);
  return d;
}

const RESULT = { columns: ["first_name", "country"], values: [["Ada", "Kenya"], ["Ben", null], ["Chi", "Ghana"]] };
const EXPECTED = { columns: ["first_name"], rows: [["Ada"], ["Ben"], ["Chi"]], count: 3 };
const GOT = { columns: ["first_name"], rows: [["Ada"], ["Chi"], ["Dee"]], count: 3 };
const MINI = { columns: ["id", "name"], rows: [[1, "Ada"], [2, null]] };

export function SchemaPair() {
  const d = useSample(); if (!d) return <Loader />;
  const src = { kind: "sqlite", key: d.lesson.dataset }, sql = d.lesson.example.sql;
  return <Pair name="schemaPanel" old={<Old build={(s) => s.schemaPanel(src, { open: true, sql })} mount={(s) => s.schemaMount} />}><SchemaPanel src={src} open sql={sql} /></Pair>;
}
export function TablesPair() {
  const d = useSample(); if (!d) return <Loader />;
  const { dataset } = d.lesson, sql = d.lesson.example.sql;
  return <Pair name="tablesPanel" old={<Old build={(s) => s.tablesPanel(dataset, sql, true)} mount={(s) => s.schemaMount} />}><TablesPanel dataset={dataset} sql={sql} open /></Pair>;
}
// the two workspaces get different slugs here only because element ids come from the slug and both are on one page
export function WorkspacePair() {
  const d = useSample(); if (!d) return <Loader />;
  return <Pair name="sqlWorkspace" old={<Old build={(s) => s.sqlWorkspace(d.lesson, "pair-old")} mount={(s) => s.wsMount} />}><SqlWorkspace lesson={d.lesson} slug="pair-new" /></Pair>;
}
export function ExamplePair() {
  const d = useSample(); if (!d) return <Loader />;
  return <Pair name="exampleBox" old={<Old build={(s) => s.exampleBox(d.lesson)} />}><ExampleBox lesson={d.lesson} /></Pair>;
}
export function ResultTablePair() {
  return <Pair name="resultTable" old={<Old build={(s) => s.resultTable(RESULT)} />}><ResultTable result={RESULT} /></Pair>;
}
export function ResultDiffPair() {
  return <Pair name="diffTables (.rdiff)" old={<Old build={(s) => s.diffTables(EXPECTED, GOT)} />}><ResultDiff expected={EXPECTED} got={GOT} /></Pair>;
}
export function MiniTablePair() {
  return <Pair name="miniTable" old={<Old build={(s) => s.miniTable(MINI)} />}><MiniTable result={MINI} /></Pair>;
}
// a card's ids come from its id, so the two copies differ by a suffix here only
export function CardPair() {
  const d = useSample(); if (!d) return <Loader />;
  if (!d.card) return <p>No interaction card for this concept.</p>;
  const a = { ...d.card, id: d.card.id + "-old" }, b = { ...d.card, id: d.card.id + "-new" };
  return <WhenBooted><Pair name="card (xcardHtml)" old={<Old build={(s) => s.xcardHtml(a)} />}><InteractionCard card={b} /></Pair></WhenBooted>;
}
export function ConfirmPair() {
  const [said, setSaid] = useState("");
  const oldAsk = () => window.SQLDrillsShared.askConfirm("Delete this note?", "Delete").then((ok) => setSaid("old: " + (ok ? "ok" : "cancel")));
  return (
    <Pair name="askConfirm" old={<button type="button" className="btn" data-pair="old-confirm" onClick={oldAsk}>Delete (old button)</button>}>
      <ConfirmButton message="Delete this note?" okLabel="Delete" intent="danger" dataAttributes={{ pair: "new-confirm" }} onConfirm={() => setSaid("new: ok")}>Delete (Waffles button)</ConfirmButton>
      <p className="wf-pair-said" role="status" data-testid="confirm-said">{said}</p>
    </Pair>
  );
}
export function LoaderSet() {
  return (
    <section className="wf-pair" aria-label="Loader">
      <h2 className="wf-pair-h">Loader (ours, neutral)</h2>
      <div className="wf-pair-row"><Loader size="small" /><Loader /><Loader size="large" /><Loader showLabel label="Running the query" inline /></div>
      <Button onClick={() => {}}>A Waffles Button for scale</Button>
    </section>
  );
}

export const PAIRS = [SchemaPair, TablesPair, WorkspacePair, ExamplePair, ResultTablePair, ResultDiffPair, MiniTablePair, CardPair, ConfirmPair];
