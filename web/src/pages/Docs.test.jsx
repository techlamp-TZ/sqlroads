// Docs: a stand-in for app.js's shared pieces and the docs API. The search keeps the same box (so its focus),
// filters 250 ms after typing stops and rewrites the address like the old page; checked again in Chrome.
import { test, expect, vi, beforeAll, afterEach } from "vitest";
import { createRequire } from "node:module";
import { act, fireEvent, render, screen } from "@testing-library/react";
import axe from "axe-core";
import DocsPage from "./Docs.jsx";
import { SharedProvider } from "../shared/shared.jsx";

const Help = createRequire(import.meta.url)("../../../public/help.js");
const lesson = (sql) => ({ what: "Picks columns. More text.", example: { sql }, dataset: "world" });
const DOCS = [
  { slug: "joins-inner", name: "INNER JOIN", level: 3, summary: "Match rows.", keywords: ["JOIN", "ON", "INNER", "USING", "extra"], lesson: lesson("SELECT * FROM a JOIN b ON a.id = b.id;") },
  { slug: "choosing-columns", name: "Choosing columns", level: 1, summary: "Pick columns.", keywords: ["SELECT"], lesson: lesson("SELECT name FROM world;") },
  { slug: "no-lesson", name: "Aliases", level: 1, summary: "Rename things.", keywords: [], lesson: null },
];
const icon = (name) => '<svg data-name="' + name + '" viewBox="0 0 24 24"></svg>';
const shared = {
  api: vi.fn(() => Promise.resolve(DOCS)),
  rail: () => '<aside class="rail" aria-label="Your progress"></aside>',
  levels: () => [{ n: 1, title: "SELECT basics" }, { n: 2, title: "Filtering" }, { n: 3, title: "Joins" }],
  levelOf: (n) => ({ n, title: ["", "SELECT basics", "Filtering", "Joins"][n] }),
  highlight: (s) => s,
  lessonCard: (l) => '<section class="card lesson"><p>' + l.what + "</p></section>",
  sqlWorkspace: (l, slug) => '<section class="card ws-card" data-ex="' + slug + '"><textarea class="ln-sql" aria-label="Query">' + l.example.sql + "</textarea></section>",
  wsMount: () => {}, tablesPanel: () => "", schemaMount: () => {},
  emptyStage: (ic, text, link) => '<div class="empty-stage"><p>' + text + '</p><a href="' + link[0] + '">' + link[1] + "</a></div>",
};
const route = (qs = "") => ({ name: "docs", q: new URLSearchParams(qs) });
const docs = (r) => render(<SharedProvider value={shared}><main><DocsPage route={r} icon={icon} /></main></SharedProvider>);
beforeAll(() => { window.Help = Help; });
afterEach(() => vi.useRealTimers());

test("A-Z: the old heading, tabs, count, letters and concepts in name order", async () => {
  const { container } = docs(route(""));
  await screen.findByRole("heading", { level: 1, name: "SQL reference" });
  expect(shared.api).toHaveBeenCalledWith("/api/learn/docs");
  expect(screen.getAllByRole("tab").map((t) => [t.textContent, t.getAttribute("href"), t.getAttribute("aria-selected")])).toEqual([
    ["Concepts A-Z", "#/docs?t=az", "true"], ["Cheat sheets", "#/docs?t=sheets", "false"], ["MySQL · PostgreSQL · SQLite", "#/docs?t=engines", "false"]]);
  expect(screen.getByText("3 concepts, A-Z")).toBeTruthy();
  expect(screen.getByRole("searchbox", { name: "Search the reference" }).getAttribute("placeholder")).toBe("Search 3 concepts: names, keywords, lessons…");
  expect([...screen.getByRole("navigation", { name: "Jump to a letter" }).querySelectorAll("a")].map((a) => a.textContent)).toEqual(["A", "C", "I"]);
  expect([...container.querySelectorAll(".wf-doc-n")].map((n) => n.textContent)).toEqual(["Aliases", "Choosing columns", "INNER JOIN"]);
  expect(container.querySelector("details[open]")).toBeNull();
  // the old delegated handlers must not see these (they would fill/route the page a second time)
  expect(container.querySelector(".doc-c, [data-az], [data-docs-q]")).toBeNull();
});

test("search: same box and focus while typing, filters after 250 ms, address replaced", async () => {
  docs(route(""));
  const box = await screen.findByRole("searchbox");
  vi.useFakeTimers();
  const replace = vi.spyOn(history, "replaceState");
  box.focus();
  fireEvent.change(box, { target: { value: "jo" } });
  fireEvent.change(box, { target: { value: "join" } });
  expect(screen.getByText("3 concepts, A-Z")).toBeTruthy(); // not yet
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(screen.getByRole("searchbox")).toBe(box);
  expect(document.activeElement).toBe(box);
  expect(screen.getByText("1 of 3 concepts match “join”")).toBeTruthy();
  expect(replace).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenLastCalledWith(null, "", "#/docs?t=az&q=join");
  fireEvent.change(box, { target: { value: "zzz" } });
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(screen.getByText("No concept matches that search.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Show every concept" }).getAttribute("href")).toBe("#/docs?t=az");
  fireEvent.change(box, { target: { value: "" } });
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(replace).toHaveBeenLastCalledWith(null, "", "#/docs?t=az");
  replace.mockRestore();
});

test("?c= opens that concept with its lesson, workspace and links; a letter moves focus to its group", async () => {
  const { container } = docs(route("t=az&c=choosing-columns"));
  await screen.findByRole("heading", { level: 1 });
  const d = container.querySelector("details[open]");
  expect(d.getAttribute("data-wf-doc")).toBe("choosing-columns");
  expect(document.activeElement).toBe(d.querySelector("summary"));
  expect(d.querySelector(".ws-card")).not.toBeNull();
  expect(screen.getByRole("link", { name: "Learn it step by step" }).getAttribute("href")).toBe("#/learn/choosing-columns?s=1");
  expect(screen.getByRole("link", { name: "Practise it" }).getAttribute("href")).toBe("#/concept/choosing-columns");
  fireEvent.click(screen.getByRole("link", { name: "I" }));
  expect(document.activeElement.id).toBe("azh-I");
});

test("a concept with no lesson points at its concept page", async () => {
  const { container } = docs(route("t=az&c=no-lesson"));
  await screen.findByRole("heading", { level: 1 });
  expect(container.querySelector("details[open]").textContent).toContain("No lesson for this concept yet.");
  expect(screen.getByRole("link", { name: "Open the concept page" }).getAttribute("href")).toBe("#/concept/no-lesson");
});

test("cheat sheet: level chips, the title, first sentence and four keywords", async () => {
  const { container } = docs(route("t=sheets&l=3"));
  await screen.findByRole("heading", { level: 2, name: "Level 3 · Joins cheat sheet" });
  expect([...container.querySelectorAll(".wf-chip")].map((a) => a.getAttribute("href") + (a.getAttribute("aria-current") ? "*" : ""))).toEqual(["#/docs?t=sheets&l=1", "#/docs?t=sheets&l=2", "#/docs?t=sheets&l=3*"]);
  const row = container.querySelector("tbody tr");
  expect(row.querySelector("a").getAttribute("href")).toBe("#/docs?t=az&c=joins-inner");
  expect([...row.querySelectorAll("code")].map((c) => c.textContent)).toEqual(["JOIN", "ON", "INNER", "USING"]);
  expect(row.querySelectorAll("td")[0].textContent).toBe("Picks columns.");
  expect(screen.getByText("Open a concept to run its example.")).toBeTruthy();
});

test("engines: the differences table from Help.DIFFS", async () => {
  const { container } = docs(route("t=engines"));
  await screen.findByRole("heading", { level: 2, name: "The same thing in MySQL, PostgreSQL and SQLite" });
  expect(container.querySelectorAll("tbody tr").length).toBe(Help.DIFFS.length);
  expect(container.querySelector("tbody th").textContent).toBe(Help.DIFFS[0][0]);
});

test("no axe violations on each tab (all rules on)", async () => {
  for (const qs of ["", "t=az&c=choosing-columns", "t=sheets&l=1", "t=engines"]) {
    const { container, unmount } = docs(route(qs));
    await screen.findByRole("heading", { level: 1 });
    const r = await axe.run(container);
    expect(r.violations.map((v) => qs + " " + v.id + ": " + v.help)).toEqual([]);
    unmount();
  }
});
