// The wrappers' plumbing, with a stand-in for app.js's shared pieces (the real output is compared with the old
// pages in Chrome: tools/check-shared.mjs).
import { describe, test, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import axe from "axe-core";
import {
  ConfirmButton, ExampleBox, InteractionCard, Loader, MiniTable, ResultDiff, ResultTable, SchemaPanel, SharedProvider,
  SqlWorkspace, TablesPanel, WhenBooted, useShared,
} from "./index.jsx";

function fakeShared(over = {}) {
  return {
    schemaPanel: vi.fn((src, opts) => `<section class="card schema-panel" data-sp="sp1"><h2>Schema ${src.key}</h2><span class="sp-used">${opts.sql || ""}</span></section>`),
    schemaMount: vi.fn(),
    tablesPanel: vi.fn((ds, sql) => (/CREATE TABLE/i.test(sql) ? "" : `<section class="card schema-panel" data-sp="sp2">${ds}</section>`)),
    sqlWorkspace: vi.fn((l, slug) => `<section class="card ws-card" data-ex="${slug}"><textarea class="ln-sql" aria-label="Query">${l.example.sql}</textarea><button type="button" data-ex-run>Run</button></section>`),
    wsMount: vi.fn(),
    exampleBox: vi.fn((l) => `<pre class="mcq-code">${l.example.sql}</pre>`),
    resultTable: vi.fn((r) => `<div class="grid-wrap"><table class="grid"><thead><tr><th>${r.columns[0]}</th></tr></thead></table></div>`),
    diffTables: vi.fn(() => '<div class="diff-legend small"></div><div class="compare"><table class="grid rdiff" aria-label="Expected result"><thead><tr><th scope="col">a</th></tr></thead><tbody></tbody></table></div>'),
    miniTable: vi.fn(() => '<div class="tbl-wrap po-tbl"><table class="grid"><thead><tr><th>x</th></tr></thead></table></div>'),
    xcardHtml: vi.fn((c) => `<section class="card card-pad xcard" data-xcard="${c.id}"><p class="pq">${c.question}</p><label>Answer <input data-xc></label></section>`),
    askConfirm: vi.fn(() => Promise.resolve(true)),
    confirmClick: vi.fn(),
    booted: true,
    ...over,
  };
}
const withShared = (s, ui) => render(<SharedProvider value={s}>{ui}</SharedProvider>);

describe("wrappers render through the one copy in app.js", () => {
  test("SchemaPanel passes src and options, then runs schemaMount on its markup", () => {
    const s = fakeShared();
    const { container } = withShared(s, <SchemaPanel src={{ kind: "sqlite", key: "hotel" }} open sql="SELECT * FROM guests" />);
    expect(s.schemaPanel).toHaveBeenCalledWith({ kind: "sqlite", key: "hotel" }, { open: true, sql: "SELECT * FROM guests" });
    expect(container.querySelector(".schema-panel h2").textContent).toBe("Schema hotel");
    expect(s.schemaMount).toHaveBeenCalledWith(container.querySelector(".wf-legacy"));
  });

  test("the wrapper box has no layout of its own (display: contents), so the old markup lays out as before", () => {
    const { container } = withShared(fakeShared(), <ResultTable result={{ columns: ["a"], values: [] }} />);
    expect(container.querySelector(".wf-legacy").style.display).toBe("contents");
  });

  test("TablesPanel renders nothing when the SQL creates its own tables (as tablesPanel)", () => {
    const s = fakeShared();
    const { container } = withShared(s, <TablesPanel dataset="hotel" sql="CREATE TABLE t (a INT)" />);
    expect(container.innerHTML).toBe("");
    expect(s.schemaMount).not.toHaveBeenCalled();
  });

  test("SqlWorkspace runs wsMount; the same props again do not rebuild it (what was typed stays)", () => {
    const s = fakeShared();
    const lesson = { example: { sql: "SELECT 1" } };
    const { container, rerender } = withShared(s, <SqlWorkspace lesson={lesson} slug="choosing-columns" />);
    const ta = container.querySelector("textarea");
    ta.value = "SELECT 2";
    rerender(<SharedProvider value={s}><SqlWorkspace lesson={{ example: { sql: "SELECT 1" } }} slug="choosing-columns" /></SharedProvider>);
    expect(s.sqlWorkspace).toHaveBeenCalledTimes(1);
    expect(s.wsMount).toHaveBeenCalledTimes(1);
    expect(container.querySelector("textarea")).toBe(ta);
    expect(ta.value).toBe("SELECT 2");
  });

  test("new props rebuild the markup", () => {
    const s = fakeShared();
    const { container, rerender } = withShared(s, <ExampleBox lesson={{ example: { sql: "SELECT 1" } }} />);
    rerender(<SharedProvider value={s}><ExampleBox lesson={{ example: { sql: "SELECT 2" } }} /></SharedProvider>);
    expect(container.querySelector("pre").textContent).toBe("SELECT 2");
  });

  test("ResultDiff uses the .rdiff tables and never the .diff difficulty badge class", () => {
    const { container } = withShared(fakeShared(), <ResultDiff expected={{ columns: ["a"], rows: [] }} got={{ columns: ["a"], rows: [] }} />);
    expect(container.querySelector("table.rdiff")).not.toBeNull();
    expect(container.querySelector(".diff")).toBeNull();
  });

  test("MiniTable", () => {
    const { container } = withShared(fakeShared(), <MiniTable result={{ columns: ["x"], rows: [] }} />);
    expect(container.querySelector(".po-tbl th").textContent).toBe("x");
  });
});

describe("cards keep the refresh guard (markStarted)", () => {
  function Host({ s }) {
    const [q, setQ] = useState("Which rows?");
    return <SharedProvider value={s}><button type="button" onClick={() => setQ("New question")}>refresh</button><InteractionCard card={{ id: "c1", question: q }} /></SharedProvider>;
  }

  test("a card nobody has started is replaced by fresh data", () => {
    const s = fakeShared();
    const { container } = render(<Host s={s} />);
    fireEvent.click(screen.getByText("refresh"));
    expect(container.querySelector(".pq").textContent).toBe("New question");
  });

  test("a started card (data-started) is not replaced: what the learner typed stays", () => {
    const s = fakeShared();
    const { container } = render(<Host s={s} />);
    const input = container.querySelector("[data-xc]");
    input.value = "my answer";
    container.querySelector(".xcard").setAttribute("data-started", "1"); // what app.js's markStarted does on input
    fireEvent.click(screen.getByText("refresh"));
    expect(container.querySelector(".pq").textContent).toBe("Which rows?");
    expect(container.querySelector("[data-xc]").value).toBe("my answer");
  });

  test("a card type the engine cannot show renders nothing", () => {
    const { container } = withShared(fakeShared({ xcardHtml: () => "" }), <InteractionCard card={{ id: "x" }} />);
    expect(container.innerHTML).toBe("");
  });
});

describe("confirm", () => {
  test("ConfirmButton (a Waffles Button) asks through askConfirm and acts only on OK", async () => {
    const yes = fakeShared(), no = fakeShared({ askConfirm: vi.fn(() => Promise.resolve(false)) });
    const onYes = vi.fn(), onNo = vi.fn();
    withShared(yes, <ConfirmButton message="Delete?" okLabel="Delete" intent="danger" onConfirm={onYes}>Delete</ConfirmButton>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Delete" })); });
    expect(yes.askConfirm).toHaveBeenCalledWith("Delete?", "Delete");
    expect(onYes).toHaveBeenCalledTimes(1);
    withShared(no, <ConfirmButton message="Reset?" onConfirm={onNo}>Reset</ConfirmButton>);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Reset" })); });
    expect(onNo).not.toHaveBeenCalled();
  });

  test("without app.js the wrappers say what is missing", () => {
    const Probe = () => { useShared(); return null; };
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow(/window\.SQLDrillsShared/);
    spy.mockRestore();
  });
});

describe("Loader (our own, no brand graphic)", () => {
  test("a status with a label, three sizes, and no image or logo", () => {
    const { container } = render(<><Loader /><Loader size="small" label="Running" showLabel /><Loader size="large" inline /></>);
    const all = container.querySelectorAll('[role="status"]');
    expect(all.length).toBe(3);
    expect(all[0].textContent).toBe("Loading");
    expect([...all].map((e) => e.querySelector("svg").getAttribute("width"))).toEqual(["32", "18", "48"]);
    expect(container.querySelector("img, image, use")).toBeNull();
    expect(container.querySelectorAll("svg circle").length).toBe(6);
  });

  test("WhenBooted shows the loader until app.js has loaded the library", () => {
    const s = fakeShared({ booted: false });
    const { container } = withShared(s, <WhenBooted label="Loading the library"><p>ready</p></WhenBooted>);
    expect(container.textContent).toContain("Loading the library");
    act(() => { window.dispatchEvent(new Event("sqldrills:booted")); });
    expect(container.textContent).toBe("ready");
  });

  test("no axe violations", async () => {
    const { container } = render(<main><h1>t</h1><Loader /><Loader showLabel label="Running" /></main>);
    expect((await axe.run(container)).violations.map((v) => v.id)).toEqual([]);
  });
});
