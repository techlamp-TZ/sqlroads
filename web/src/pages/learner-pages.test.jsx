// Group 3 (Home + Today, Learn, Notes, Flashcards, Challenge) with a stand-in for app.js's shared pieces and state.
// The pages are compared with the old ones in Chrome (behave-4c: API bodies, focus, keys, stored keys).
import { test, expect, vi, afterEach } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { SharedProvider } from "../shared/shared.jsx";
import Home from "./Home.jsx";
import Learn from "./Learn.jsx";
import Notes from "./Notes.jsx";
import Flashcards from "./Flashcards.jsx";
import Challenge from "./Challenge.jsx";

afterEach(() => vi.useRealTimers()); // a failed timer test must not leak into the next
const icon = (n) => '<svg data-name="' + n + '"></svg>';
function fakeShared(routes, over = {}) {
  const S = { learn: { concept: {}, levels: {} }, levels: [{ n: 1, title: "SELECT basics" }], items: [{ id: "d1", title: "First drill" }], byId: { d1: { id: "d1", title: "First drill" } }, review: { due: [], upcoming: [] } };
  const api = vi.fn((path, body) => {
    const k = (body ? "POST " : "GET ") + path;
    const hit = Object.keys(routes).find((r) => (r.endsWith("*") ? k.startsWith(r.slice(0, -1)) : r === k));
    if (!hit) return Promise.reject(new Error("unexpected " + k));
    const v = routes[hit];
    return Promise.resolve(typeof v === "function" ? v(body, path) : v);
  });
  return {
    state: S, api, store: vi.fn(), toast: vi.fn(), plural: (n, w) => n + " " + w + (n === 1 ? "" : "s"), href: (d) => "#/drill/" + d.id, seeded: () => () => 0.5,
    renderNav: vi.fn(), learnEvent: vi.fn(), versionHeaders: () => ({}), watchVersion: (r) => r, markConceptStale: vi.fn(),
    levelPath: () => '<section class="lp">path</section>', progressStrip: () => "", quizPicker: () => '<section class="qp">quiz</section>', compactRow: (d) => '<a class="crow" href="#/drill/' + d.id + '">' + d.title + "</a>",
    streak: () => ({ today: 2 }), dailyGoal: () => 5, currentLevel: () => 1, isWeekend: () => false, loadReview: vi.fn(() => Promise.resolve()),
    rail: () => '<aside class="rail" aria-label="Your progress"></aside>', emptyStage: (ic, t, l) => '<div class="empty"><p>' + t + '</p><a href="' + l[0] + '">' + l[1] + "</a></div>",
    confirmClick: vi.fn(() => true), highlight: (x) => x, esc: (x) => x, miniTable: () => "<table></table>", schemaMount: () => {}, tablesPanel: () => "",
    LEARN_STEPS: [["file", "Lesson"], ["code", "Try the example"], ["checkCircle", "Quick check"]],
    ...over,
  };
}
const withShared = (s, ui) => render(<SharedProvider value={s}><main>{ui}</main></SharedProvider>);
const route = (qs = "", args = []) => ({ q: new URLSearchParams(qs), args });

test("Home: the Today plan from /api/learn/today, its rows and links; kept in the state", async () => {
  const T = { level: 1, flashcards: { due: 2 }, understand: { name: "DISTINCT", slug: "distinct", stage: "started" }, reflection: { concept: "distinct", name: "DISTINCT" }, challenge: { why: "due", name: "Choosing columns" }, weekend: false, practise: ["d1"] };
  const s = fakeShared({ "GET /api/learn/today?level=1&weekend=0": T });
  const { container } = withShared(s, <Home icon={icon} />);
  expect(screen.getByText("Loading your plan…")).toBeTruthy();
  await screen.findByText("2 flashcards due");
  expect([...container.querySelectorAll("#todayPlan li")].map((li) => li.textContent)).toEqual(["Memorize2 flashcards dueReview", "UnderstandNext concept: DISTINCTContinue", "ReflectExplain DISTINCT in one sentenceReflect", "ChallengeDue for review: Choosing columnsStart"]);
  expect([...container.querySelectorAll("#todayPlan li a")].map((a) => a.getAttribute("href"))).toEqual(["#/flashcards?study=1", "#/concept/distinct?tab=understand", "#/concept/distinct?tab=reflect", "#/challenge?level=1"]);
  expect(s.state.learn.today).toBe(T);
  expect(s.state.flashDue).toBe(2);
  expect(container.querySelector(".crow").getAttribute("href")).toBe("#/drill/d1");
  expect(screen.getByText("Practise · 1 exercise")).toBeTruthy();
  await waitFor(() => expect(s.loadReview).toHaveBeenCalled());
});

const PATH = { total: 3, read: 1, levels: [{ n: 1, title: "SELECT basics", read: 1, total: 3, concepts: [{ slug: "a", name: "A", read: true }, { slug: "b", name: "B" }, { slug: "c", name: "C" }] }] };
const CONCEPT = { slug: "b", name: "B", level: 1, summary: "Bee. Two.", lessons: [{ what: "One. Two. Three.", tip: "Mind it", dataset: "world", example: { sql: "SELECT 1" } }], lessonRead: false };
function learnShared(over) {
  const s = fakeShared({ "POST /api/learn/lesson/b/read": { ok: true } }, {
    learnPathLoad: () => Promise.resolve(PATH), loadConcept: () => Promise.resolve(CONCEPT), learnFlat: (p) => p.levels[0].concepts.map((c) => ({ ...c, level: 1 })),
    learnContinue: () => ({ c: { slug: "b", name: "B", level: 1 }, s: 1, resume: false }), learnStepState: (c, slug) => { const st = s.learnStepsOf(slug); return { 1: !!st[1], 2: !!st[2], 3: !!st[3] }; },
    steps: {}, learnStepsOf: (slug) => s.steps, learnStepDone: vi.fn((slug, n) => { s.steps[n] = 1; window.dispatchEvent(new Event("sqldrills:learn-changed")); }),
    learnChecks: () => [], learnCheckAnswered: () => false, lessonText: (t) => t, exampleSqlOf: (l) => l.example.sql, exampleLocal: () => true,
    lessonCard: () => '<section class="lesson">lesson</section>', schemaPanel: () => '<section class="sp">schema</section>', sqlWorkspace: () => '<section class="ws">ws</section>', wsMount: () => {},
    predictCard: () => "", mcqBlock: () => "", xcardHtml: () => "", ...over,
  });
  s.state.learn.concept.b = CONCEPT;
  return s;
}
test("Learn overview: start, levels, jump", async () => {
  const s = learnShared();
  const { container } = withShared(s, <Learn route={route()} icon={icon} />);
  await screen.findByRole("heading", { level: 1, name: "Learn step by step" });
  expect(screen.getByRole("link", { name: "Start" }).getAttribute("href")).toBe("#/learn/b?s=1");
  expect(container.querySelector("details[open] summary").textContent).toContain("Level 1 · SELECT basics");
  expect([...container.querySelectorAll("select option")].map((o) => o.textContent)).toEqual(["Choose…", "✓ A", "B", "C"]);
});
test("Learn step: focus on the title, stored place, step 1 → done, side column follows, finish saves and moves on", async () => {
  const s = learnShared();
  const { container } = withShared(s, <Learn route={route("s=1", ["b"])} icon={icon} />);
  await screen.findByRole("heading", { level: 1, name: "B" });
  expect(document.activeElement.id).toBe("lw-title");
  expect(s.store).toHaveBeenCalledWith("sqldrills.learnAt", "b|1");
  expect(screen.getByText("Concept 2 of 3 · Level 1")).toBeTruthy();
  expect(container.querySelector(".lesson")).not.toBeNull();
  expect(screen.getByLabelText("Learning guidance").textContent).toContain("0/3 steps done");
  const next = screen.getByRole("link", { name: "Next: Try the example" });
  next.addEventListener("click", (e) => e.preventDefault());
  fireEvent.click(next);
  expect(s.learnStepDone).toHaveBeenCalledWith("b", 1);
  await waitFor(() => expect(screen.getByLabelText("Learning guidance").textContent).toContain("1/3 steps done"));
});
test("Learn step 3: the finish button saves the lesson as read and goes to the next concept", async () => {
  const s = learnShared();
  withShared(s, <Learn route={route("s=3", ["b"])} icon={icon} />);
  await screen.findByRole("heading", { level: 1, name: "B" });
  expect(screen.getByText("No quick-check question for this concept yet: they appear once they are approved.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Done · next concept" }));
  await waitFor(() => expect(location.hash).toBe("#/learn/c?s=1"));
  expect(s.api).toHaveBeenCalledWith("/api/learn/lesson/b/read", {});
  expect(s.state.learnPath).toBe(null);
});

test("Notes: list, search after typing (focus kept), clear, delete asks first", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const notes = [{ id: 7, at: "2026-10-20T08:00:00Z", explain: "SELECT lists columns.", confidence: 4, concepts: [{ slug: "b", name: "B" }] }];
  const s = fakeShared({ "GET /api/learn/reflections?q=": { notes, total: 1 }, "GET /api/learn/reflections?q=zz": { notes: [], total: 1 } });
  globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }));
  withShared(s, <Notes icon={icon} />);
  await screen.findByText("SELECT lists columns.");
  expect(screen.getByText("1 note")).toBeTruthy();
  const box = screen.getByRole("searchbox", { name: "Search my notes" });
  box.focus(); fireEvent.change(box, { target: { value: "zz" } });
  await act(async () => { vi.advanceTimersByTime(200); });
  await screen.findByText("No note matches “zz”.");
  expect(document.activeElement).toBe(box);
  expect(s.state.learn.notesQ).toBe("zz");
  fireEvent.click(screen.getByRole("button", { name: "Clear the search" }));
  await screen.findByText("SELECT lists columns.");
  expect(document.activeElement).toBe(box);
  fireEvent.click(screen.getByRole("button", { name: "Delete this note" }));
  expect(s.confirmClick.mock.calls[0][1]).toBe("Delete this note? It can't be undone.");
  await waitFor(() => expect(globalThis.fetch).toHaveBeenCalledWith("/api/learn/reflections/7", { method: "DELETE", headers: {} }));
  vi.useRealTimers();
});

const LIB = { total: 2, page: 0, pages: 3, size: 25, levels: [{ level: 1 }], concepts: [{ slug: "b", name: "B", level: 1, count: 2 }], items: [{ id: "f1", type: "keyword", front: "SELECT", back: "Picks columns", level: 1, concept: "b", conceptName: "B" }] };
test("Flashcards library: chips, card link, pager, search goes to the address 250 ms after typing", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  const s = fakeShared({ "GET /api/learn/flashcards?level=1": LIB });
  withShared(s, <Flashcards route={route("level=1")} icon={icon} />);
  await screen.findByRole("heading", { level: 1, name: "SQL Flashcard Library" });
  expect(screen.getByRole("link", { name: "Level 1" }).getAttribute("aria-current")).toBe("true");
  expect(screen.getByRole("link", { name: "All levels" }).getAttribute("href")).toBe("#/flashcards");
  expect(screen.getByRole("link", { name: "Study this card" }).getAttribute("href")).toBe("#/flashcards?concept=b&card=f1");
  expect(screen.getByText("Showing 1–2 of 2 flashcards")).toBeTruthy();
  fireEvent.change(screen.getByRole("textbox", { name: "Search flashcards" }), { target: { value: "sel" } });
  expect(location.hash).not.toBe("#/flashcards?level=1&q=sel");
  await act(async () => { vi.advanceTimersByTime(250); });
  expect(location.hash).toBe("#/flashcards?level=1&q=sel");
  fireEvent.click(screen.getByRole("button", { name: "Next page" }));
  expect(location.hash).toBe("#/flashcards?level=1&page=1");
  vi.useRealTimers();
});

test("Flashcards session: Space shows the answer, Y grades and moves on, the end says how it went", async () => {
  const cards = [{ id: "k1", type: "keyword", front: "SELECT", back: "Picks columns" }, { id: "k2", type: "keyword", front: "FROM", back: "The table" }];
  const s = fakeShared({ "GET /api/learn/flash/session?concept=b": { cards, later: 0 }, "POST /api/learn/flash/*": { ok: true } });
  withShared(s, <Flashcards route={route("concept=b")} icon={icon} />);
  await screen.findByText("Card 1 of 2");
  expect(document.activeElement.textContent).toContain("Show the answer");
  fireEvent.keyDown(document.body, { key: " " });
  await screen.findByText("Picks columns");
  expect(document.activeElement.textContent).toContain("I knew it");
  fireEvent.keyDown(document.body, { key: "y" });
  await screen.findByText("Card 2 of 2");
  expect(s.api).toHaveBeenCalledWith("/api/learn/flash/k1", { correct: true });
  await waitFor(() => expect(document.activeElement.textContent).toContain("Show the answer")); // the next card is ready for keys
  fireEvent.keyDown(document.body, { key: "Enter" });
  await screen.findByText("The table");
  fireEvent.keyDown(document.body, { key: "n" });
  await screen.findByRole("heading", { level: 2, name: "Session done" });
  expect(screen.getByText("1 right, 1 to review again tomorrow.")).toBeTruthy();
  expect(s.learnEvent).toHaveBeenCalledWith("flashcard", "k2");
  expect(document.activeElement.textContent).toBe("Session done");
});

test("Challenge: a typed answer is checked by the card engine and saved with the confidence", async () => {
  window.Cards = { checkBlank: (v, it) => v.trim() === it.answer };
  const ch = { ref: "fc1", kind: "flashcard", why: "weak", name: "B", item: { type: "blank", prompt: "Fill it", sql: "SELECT ___ FROM t", answer: "a", dataset: "world" } };
  const s = fakeShared({ "GET /api/learn/today?level=1": { challenge: ch }, "POST /api/learn/challenge": { ok: true } }, {
    confHtml: () => '<fieldset><legend>How sure</legend><label><input type="radio" name="ch-conf" value="4" checked> 4</label></fieldset>', confOf: (root) => Number(root.querySelector('[name="ch-conf"]:checked').value),
    spotBugUsable: () => false, verdictHtml: (r) => '<p class="verdict">' + (r ? "Right" : "Not quite") + "</p>",
  });
  const { container } = withShared(s, <Challenge route={route("level=1")} icon={icon} />);
  await screen.findByRole("heading", { level: 1, name: "B" });
  expect(document.activeElement.className).toContain("ch-blank");
  fireEvent.change(container.querySelector(".ch-blank"), { target: { value: "a" } });
  container.querySelector(".ch-blank").value = "a";
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("Saved. It comes back when it is due.");
  expect(s.api).toHaveBeenCalledWith("/api/learn/challenge", { ref: "fc1", kind: "flashcard", correct: true, confidence: 4 });
  expect(document.activeElement.textContent).toBe("Back to Today");
});

test("no axe violations: Home, Notes, the library", async () => {
  const s = fakeShared({ "GET /api/learn/today?level=1&weekend=0": { level: 1, flashcards: { due: 0, newConcept: null }, understand: null, reflection: null, weekend: false, practise: [] }, "GET /api/learn/reflections?q=": { notes: [], total: 0 }, "GET /api/learn/flashcards": LIB });
  for (const [ui, ready] of [[<Home icon={icon} />, "Every practise set in this level is done."], [<Notes icon={icon} />, "0 notes"], [<Flashcards route={route()} icon={icon} />, "Study this card"]]) {
    const { container, unmount } = withShared(s, ui);
    await screen.findByText(ready);
    const r = await axe.run(container);
    expect(r.violations.map((v) => v.id + ": " + v.help + " " + v.nodes.map((n) => n.target).join(","))).toEqual([]);
    unmount();
  }
});
