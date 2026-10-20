// Group 4 (concept page, exercise page) with a stand-in for app.js's pieces. The real engine (editor, checker,
// stage panels) is compared with the old pages in Chrome (behave-4d: 43 checks, request bodies included).
import { test, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { SharedProvider } from "../shared/shared.jsx";
import Concept from "./Concept.jsx";
import Drill from "./Drill.jsx";

const icon = (n) => '<svg data-name="' + n + '" aria-hidden="true"></svg>';
const STAGES = ["memorize", "understand", "practise", "reflect", "transfer"];
const C = { slug: "b", name: "B", level: 1, summary: "Bee.", siblings: [{ slug: "a", name: "A" }, { slug: "b", name: "B" }, { slug: "c", name: "C" }], lessons: [{}], stages: { memorize: "done", understand: "started", practise: "todo", reflect: "todo", transfer: "locked" }, mastered: false };
function conceptShared(over) {
  const S = { learn: { concept: { b: C } } };
  return {
    state: S, STAGES, CTABS: ["study"].concat(STAGES), STAGE_LABEL: { memorize: "Memorize", understand: "Understand", practise: "Practise", reflect: "Reflect", transfer: "Transfer" },
    STAGE_STATUS: { done: "done", started: "in progress", todo: "not started", locked: "locked", na: "n/a" }, levelOf: () => ({ title: "SELECT basics" }),
    stageRing: () => '<svg role="img" aria-label="ring"></svg>', stagesDone: () => 1, stagesUsed: () => 5, newItemsHtml: () => "", masteryList: () => '<ul aria-label="Mastery"><li>x</li></ul>', stageMark: () => "",
    stagePanel: vi.fn((c, tab) => '<p class="panel">' + tab + " panel</p>"), schemaMount: () => {}, loadConcept: vi.fn(() => Promise.resolve(C)), refreshConcept: vi.fn(), takeConceptStale: () => false,
    ...over,
  };
}
const route = (qs, args) => ({ q: new URLSearchParams(qs), args });

test("Concept: head, the first stage not done is open, tabs move with the keys and replace the address", async () => {
  const s = conceptShared();
  history.replaceState(null, "", "#/concept/b");
  render(<SharedProvider value={s}><main><Concept route={route("", ["b"])} icon={icon} /></main></SharedProvider>);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("B");
  expect(screen.getByText("Concept 2 of 3 · Level 1")).toBeTruthy();
  expect(screen.getByRole("tab", { selected: true }).id).toBe("tab-understand");
  expect(screen.getByText("understand panel")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Previous concept: A" }).getAttribute("href")).toBe("#/concept/a");
  screen.getByRole("tab", { selected: true }).focus();
  fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowRight" });
  await waitFor(() => expect(document.activeElement.id).toBe("tab-practise"));
  expect(location.hash).toBe("#/concept/b?tab=practise");
  expect(screen.getByText("practise panel")).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("tablist"), { key: "Home" });
  await waitFor(() => expect(document.activeElement.id).toBe("tab-study"));
  fireEvent.keyDown(screen.getByRole("tablist"), { key: "ArrowLeft" });
  await waitFor(() => expect(document.activeElement.id).toBe("tab-transfer"));
  // a background refresh from app.js re-renders the panel
  s.state.learn.concept.b = { ...C, summary: "Fresh." };
  window.dispatchEvent(new CustomEvent("sqldrills:concept-render", { detail: { slug: "b" } }));
  await screen.findByText("Fresh.");
});

test("Concept: loads when not cached; a stale one is shown and refreshed", async () => {
  const s = conceptShared({ takeConceptStale: () => true });
  s.state.learn.concept = {};
  s.loadConcept = vi.fn(() => { s.state.learn.concept.b = C; return Promise.resolve(C); }); // the real one keeps it in the state
  render(<SharedProvider value={s}><Concept route={route("tab=reflect", ["b"])} icon={icon} /></SharedProvider>);
  expect(screen.getByText("Loading the concept…")).toBeTruthy();
  await screen.findByText("reflect panel");
  expect(s.loadConcept).toHaveBeenCalledWith("b");
  const s2 = conceptShared({ takeConceptStale: () => true });
  render(<SharedProvider value={s2}><Concept route={route("", ["b"])} icon={icon} /></SharedProvider>);
  expect(s2.refreshConcept).toHaveBeenCalledWith("b");
});

const D = { id: "d2", key: "d2", title: "Finding NULL", level: 2, seq: 2, diff: "easy", check: "solution", engine: "sqlite", dataset: "world", tables: ["teacher"] };
function drillShared(over) {
  const items = [{ id: "d1", seq: 1, title: "One", level: 2 }, D, { id: "d3", seq: 3, title: "Three", level: 2 }];
  return {
    state: { byId: { d2: D }, bookmarks: {}, datasets: { world: "World" } }, itemsIn: () => items, levelOf: () => ({ title: "Filtering" }), levelName: () => "Level 2 · Filtering",
    href: (x) => "#/drill/" + x.id, diffBadge: () => '<span class="dbadge easy">Easy</span>', statusHtml: () => "", CHECK_LABEL: { solution: "Auto-checked" }, isDone: () => false,
    toggleBookmark: vi.fn(() => true), store: vi.fn(), drillWire: vi.fn(), drillEditorHtml: () => '<section class="card editor-card"><textarea id="sql" aria-label="Your SQL"></textarea></section>',
    quickCheck: () => "", schemaPanel: () => '<section aria-label="Schema">schema</section>', schemaMount: () => {}, spIsPhone: () => false, dialect: () => "mysql", icon: () => "",
    ...over,
  };
}
test("Exercise page: head, previous / next with their keys, bookmark, the engine wired after the page is on screen", async () => {
  const s = drillShared();
  const { container } = render(<SharedProvider value={s}><main><Drill route={route("", ["d2"])} icon={icon} /></main></SharedProvider>);
  expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Finding NULL");
  expect(screen.getByText("Exercise 2 of 3")).toBeTruthy();
  expect(container.querySelector("#exPrev").getAttribute("aria-keyshortcuts")).toBe("Alt+ArrowLeft");
  expect(container.querySelector("#exNext").getAttribute("href")).toBe("#/drill/d3");
  expect(s.drillWire).toHaveBeenCalledWith(D);
  expect(container.querySelector("#sql")).not.toBeNull();   // the editor existed when the engine was wired
  expect(container.querySelector("#extra")).not.toBeNull();
  expect(container.querySelector("[data-drill-status]")).not.toBeNull();
  expect(s.store).toHaveBeenCalledWith("sqldrills.lastItem", "d2");
  fireEvent.click(screen.getByRole("button", { name: "Bookmark" }));
  expect(s.toggleBookmark).toHaveBeenCalledWith("d2");
  await screen.findByRole("button", { name: "Bookmarked" });
  const r = await axe.run(container);
  expect(r.violations.map((v) => v.id + ": " + v.help)).toEqual([]);
});

test("Exercise page: an id that is gone says so", () => {
  render(<SharedProvider value={drillShared()}><Drill route={route("", ["nope"])} icon={icon} /></SharedProvider>);
  expect(screen.getByText(/That exercise doesn't exist any more/)).toBeTruthy();
});
