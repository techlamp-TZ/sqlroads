// Group 5 (admin Overview, Concepts) with a stand-in for admin.js's helpers; compared with the old pages in Chrome
// (behave-4e: 32 checks, request bodies included). Review queue and Generate are hosted (the old views draw them).
import { test, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import axe from "axe-core";
import { AdminProvider } from "../../admin/admin.jsx";
import Overview from "./Overview.jsx";
import Concepts from "./Concepts.jsx";
import { hosted } from "./Hosted.jsx";

function fakeAdmin(routes, over = {}) {
  const api = vi.fn((path, method, body) => {
    const k = (method || "GET") + " " + path;
    if (!(k in routes)) return Promise.reject(new Error("unexpected " + k));
    const v = routes[k]; return Promise.resolve(typeof v === "function" ? v(body) : v);
  });
  return {
    api, toast: vi.fn(), confirmClick: vi.fn(() => false), refreshCounts: vi.fn(), setCount: vi.fn(), fmtDate: (x) => (x ? "D" : "–"), plural: (n, w) => n + " " + w + (n === 1 ? "" : "s"),
    icon: () => "", openEditor: vi.fn(), openImport: vi.fn(), barChart: () => '<svg role="img" aria-label="chart"></svg>', spendHtml: () => "", stateDot: (s) => '<span class="st-pill">' + s + "</span>",
    DIFF_COLORS: { easy: "#4ADE80", medium: "#F59E0B", hard: "#9F1239" }, LSTAGES: ["memorize", "understand", "practise", "reflect", "transfer"],
    LSTAGE_LABEL: { memorize: "Memorize", understand: "Understand", practise: "Practise", reflect: "Reflect", transfer: "Transfer" },
    stageCellParts: (c, s) => ({ cls: "n", html: '<span class="mono">' + s + "</span>" }), kwList: (k) => (Array.isArray(k) ? k : String(k || "").split(/,\s*/).filter(Boolean)),
    setTagStage: vi.fn(), stagePicker: (key) => '<select data-tagstage="' + key + '" aria-label="Stage"><option value="practise">Practise</option><option value="transfer">Transfer</option></select>',
    hostView: vi.fn((name, el) => { el.innerHTML = "<h2>" + name + " drawn by the old view</h2>"; }), ...over,
  };
}
const L = (n, total, easy, flags = []) => ({ n, title: "L" + n, total, easy, medium: 1, hard: 1, selfCheck: n, selfPct: 10, donePct: 0, done: 0, flags });
const DASH = {
  kpis: { exercises: 30, browser: 10, server: 20, selfCheck: 3, selfPct: 10, mcq: { total: 5, easy: 1, medium: 2, hard: 2 }, queue: 0, completed30: 0 },
  summary: { levels: [L(1, 10, 8), L(2, 20, 2, [{ kind: "easy", text: "few easy" }])], builtAt: "x" }, lastBackup: null, gaps: [], health: { open: 0, running: false, checks: [], lastRun: null },
  recent: { count: 0, baseline: 3020, items: [] }, gen: { runs: 0, passedPct: null, approvedPct: null }, spend: null, footer: { links: 1, duplicates: 2, bookmarks: 3 }, activity: {},
};
const COV = { pct: 50, covered: 1, total: 2, pctWithDrafts: 50, coveredWithDrafts: 1, gapCount: { memorize: 0, understand: 1, practise: 0, transfer: 0 }, target: { flashcards: 3, predicts: 2, practise: 5, transfer: 1 }, exceptions: {},
  levels: [{ level: 1, covered: 1, total: 2, concepts: [{ slug: "a", name: "A", ord: 1, summary: "Aa", keywords: "SELECT, FROM", tagsInReview: 0 }, { slug: "b", name: "B", ord: 2, summary: "Bb", keywords: "[]", tagsInReview: 2 }] }] };

test("Overview: numbers, the level table sorts and filters, quick actions open the admin's dialogs", async () => {
  const A = fakeAdmin({ "GET /dashboard": DASH, "GET /learning/coverage": COV, "GET /system": { providers: [], mysql: { state: "online", serves: 1 }, postgres: { state: "offline", serves: 0 }, browser: { state: "ready", datasets: 3, serves: 10 }, checkedAt: Date.now() } });
  const { container } = render(<AdminProvider value={A}><main><Overview /></main></AdminProvider>);
  await screen.findByRole("heading", { level: 2, name: "Content & learning" });
  const rows = () => [...container.querySelectorAll("#lvlTable tbody th")].map((t) => t.textContent.trim().split(" ")[0]);
  expect(rows()).toEqual(["1", "2"]);
  fireEvent.click(screen.getByRole("button", { name: "Largest" }));
  expect(rows()).toEqual(["2", "1"]);
  expect(screen.getByRole("button", { name: "Largest" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("switch"));
  expect(rows()).toEqual(["2"]);
  expect(container.querySelector("#lvlTable tfoot").textContent).toContain("1 levels shown");
  fireEvent.click(screen.getByRole("switch")); fireEvent.click(screen.getByRole("button", { name: "Level order" }));
  fireEvent.click(screen.getByRole("button", { name: /Write an exercise/ }));
  expect(A.openEditor).toHaveBeenCalledWith("drill", null, expect.any(Function), { write: true });
  fireEvent.click(screen.getByRole("button", { name: /Import exercises/ }));
  expect(A.openImport).toHaveBeenCalled();
  await screen.findByText("50%");
  await waitFor(() => expect(container.querySelector("#sysAt").textContent).toMatch(/^checked /));
  expect(container.querySelector(".wf-sys-foot").textContent).toBe("1 cross-links · 2 duplicates removed · 3 bookmarks");
});

test("Concepts: per-level tables, Edit row (save, cancel returns focus), Items with a stage change, Re-tag asks first", async () => {
  const A = fakeAdmin({ "GET /learning/coverage": COV, "POST /learning/concepts/a": { ok: true }, "GET /learning/concepts/a/items": { items: [{ key: "item:x", kind: "item", title: "X", level: 1, stage: "practise", main: true }], drafts: [] } });
  const { container } = render(<AdminProvider value={A}><main><Concepts route={{ q: new URLSearchParams() }} /></main></AdminProvider>);
  await screen.findByRole("heading", { level: 2, name: "Concepts" });
  expect(screen.getByText("2 tags in review").getAttribute("href")).toBe("#/review?type=tag");
  const rowA = container.querySelector('tr[data-slug="a"]');
  const edit = within(rowA).getByRole("button", { name: "Edit" });
  fireEvent.click(edit);
  await waitFor(() => expect(document.activeElement.name).toBe("name"));
  expect(edit.getAttribute("aria-expanded")).toBe("true");
  expect(container.querySelector('input[name="keywords"]').value).toBe("SELECT, FROM");
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(document.activeElement).toBe(within(container.querySelector('tr[data-slug="a"]')).getByRole("button", { name: "Edit" })));
  fireEvent.click(within(container.querySelector('tr[data-slug="a"]')).getByRole("button", { name: "Edit" }));
  fireEvent.change(container.querySelector('input[name="summary"]'), { target: { value: "New" } });
  fireEvent.submit(container.querySelector("form"));
  await waitFor(() => expect(A.api).toHaveBeenCalledWith("/learning/concepts/a", "POST", { name: "A", summary: "New", keywords: "SELECT, FROM", ord: "1" }));
  expect(A.toast).toHaveBeenCalledWith("Concept saved");
  fireEvent.click(within(container.querySelector('tr[data-slug="a"]')).getByRole("button", { name: "Items" }));
  const sel = await screen.findByRole("combobox", { name: "Stage" });
  sel.value = "transfer"; sel.dispatchEvent(new Event("change", { bubbles: true }));
  expect(A.setTagStage).toHaveBeenCalledWith(sel);
  fireEvent.click(within(container.querySelector('tr[data-slug="a"]')).getByRole("button", { name: "Re-tag" }));
  expect(A.confirmClick.mock.calls[0][1]).toMatch(/^Re-tag the exercises and MCQs of “A”\?/);
  expect(A.api.mock.calls.some((c) => /retag/.test(c[0]))).toBe(false);
  const r = await axe.run(container);
  expect(r.violations.map((v) => v.id + ": " + v.help)).toEqual([]);
});

test("a hosted page gives the old view its box, outside .wf-root", () => {
  const A = fakeAdmin({});
  const Page = hosted("review");
  expect(Page.hosted).toBe(true);
  const { container } = render(<AdminProvider value={A}><Page /></AdminProvider>);
  expect(A.hostView).toHaveBeenCalledWith("review", container.querySelector('[data-hosted="review"]'));
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("review drawn by the old view");
});
