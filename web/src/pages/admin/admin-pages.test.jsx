// Admin group 2 (Create, Settings, Backups, Health) with a stand-in for admin.js's helpers (window.SQLDrillsAdmin).
// The pages are compared with the old ones in Chrome (text, API bodies, dialogs): behave-4b.
import { test, expect, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import { AdminProvider } from "../../admin/admin.jsx";
import Backups from "./Backups.jsx";
import Settings from "./Settings.jsx";
import Health from "./Health.jsx";
import Create from "./Create.jsx";

function fakeAdmin(routes, over = {}) {
  const api = vi.fn((path, method, body) => {
    const k = (method || "GET") + " " + path;
    if (!(k in routes)) return Promise.reject(new Error("unexpected " + k));
    const v = routes[k];
    return Promise.resolve(typeof v === "function" ? v(body) : v);
  });
  return {
    api, toast: vi.fn(), askConfirm: vi.fn(() => Promise.resolve(true)), confirmClick: vi.fn(() => true), refreshCounts: vi.fn(), setCount: vi.fn(),
    fmtDate: (iso) => (iso ? "D(" + iso + ")" : "–"), plural: (n, w) => n + " " + w + (n === 1 ? "" : "s"), loadRefs: vi.fn(), previewItem: () => null,
    importRows: (t) => (t.trim() ? t.trim().split("\n").slice(1).map((l) => ({ line: l })) : []), icon: (n) => '<svg data-name="' + n + '"></svg>', ...over,
  };
}
const withAdmin = (A, ui) => render(<AdminProvider value={A}><main>{ui}</main></AdminProvider>);
const route = (qs = "") => ({ q: new URLSearchParams(qs) });

test("Backups: the list, Back up now (saved, downloaded, list again), Restore asks for the typed word", async () => {
  const list = [{ name: "b1.zip", created_at: "2026-10-01", bytes: 2097152, exercises: 3020, label: "manual" }];
  const A = fakeAdmin({ "GET /backups": list, "POST /backups": { name: "b2.zip", created_at: "2026-10-02" } });
  const { container } = withAdmin(A, <Backups />);
  await screen.findByRole("heading", { level: 2, name: "1 backup" });
  expect(container.querySelector("tbody").textContent).toContain("2.0 MB");
  expect(screen.getByText("Backed up from admin")).toBeTruthy();
  expect(container.querySelector('a[href="/api/admin/backups/b1.zip/download"]').hasAttribute("download")).toBe(true);
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  fireEvent.click(screen.getByRole("button", { name: "Back up now" }));
  await waitFor(() => expect(A.toast).toHaveBeenCalledWith("Backup saved: b2.zip"));
  expect(click).toHaveBeenCalled();
  click.mockRestore();
  const prompt = vi.spyOn(window, "prompt").mockReturnValue("no");
  fireEvent.click(screen.getByRole("button", { name: "Restore" }));
  expect(prompt.mock.calls[0][0]).toMatch(/^Restore b1\.zip\?\n\n.*Type RESTORE to confirm\.$/s);
  expect(A.api).not.toHaveBeenCalledWith("/backups/b1.zip/restore", "POST", expect.anything());
  prompt.mockRestore();
});

test("Backups with none: the empty row; no axe violations", async () => {
  const A = fakeAdmin({ "GET /backups": [] });
  const { container } = withAdmin(A, <Backups />);
  await screen.findByText("No backups yet.");
  expect(screen.getByRole("heading", { level: 2 }).textContent).toBe("0 backups");
  const r = await axe.run(container);
  expect(r.violations.map((v) => v.id + ": " + v.help)).toEqual([]);
});

const SETTINGS = {
  "GET /providers": [{ id: "auto", label: "Auto:", configured: true }, { id: "openai", label: "OpenAI only", model: "gpt-5-nano", configured: false }],
  "GET /ai-roles": [{ role: "generator", provider: "openai", model: "gpt-4.1-mini", price: [0.4, 1.6], configured: false }],
  "GET /settings/providers": { generate: ["openai", "claude", "deepseek"], review: ["deepseek", "claude", "openai"], defaults: { "order.generate": ["openai", "claude", "deepseek"], "order.review": ["deepseek", "claude", "openai"] } },
  "GET /settings/system": [{ what: "log_bin_trust_function_creators", at: "2026-10-13", why: "Why.", how: "How.", live: { now: 1, error: "x" }, info: ["error"] }],
  "GET /settings/course-db": { last: null },
};
test("Settings: providers, roles, order moves (not saved until Save), system changes, course reset asks first", async () => {
  const A = fakeAdmin({ ...SETTINGS, "PUT /settings/providers": (b) => ({ ...SETTINGS["GET /settings/providers"], ...b }) }, { confirmClick: vi.fn(() => false) });
  const { container } = withAdmin(A, <Settings />);
  await screen.findByRole("heading", { level: 2, name: "AI providers" });
  expect(screen.getByText("no API key")).toBeTruthy();
  await screen.findByText("gpt-4.1-mini");
  expect(screen.getByText("missing")).toBeTruthy();
  await screen.findByRole("list", { name: "Generate" });
  fireEvent.click(screen.getByRole("button", { name: "Move OpenAI down in Generate" }));
  expect([...screen.getByRole("list", { name: "Generate" }).querySelectorAll("b")].map((b) => b.textContent)).toEqual(["Claude", "OpenAI", "DeepSeek"]);
  expect(container.querySelector("#ordMsg").textContent).toBe("Not saved yet");
  expect(document.activeElement.getAttribute("aria-label")).toBe("Move OpenAI down in Generate");
  fireEvent.click(screen.getByRole("button", { name: "Save order" }));
  await waitFor(() => expect(A.api).toHaveBeenCalledWith("/settings/providers", "PUT", { generate: ["claude", "openai", "deepseek"], review: ["deepseek", "claude", "openai"] }));
  await waitFor(() => expect(container.querySelector("#ordMsg").textContent).toBe("Saved"));
  await screen.findByText("Not reset from here yet.");
  expect(container.querySelector(".wf-info-dot")).not.toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Reset course database" }));
  expect(A.confirmClick.mock.calls[0][1]).toMatch(/^Reset the course databases\?/);
  expect(A.api).not.toHaveBeenCalledWith("/settings/course-db/reset", "POST");
  // the test prompt is never sent by itself
  expect(A.api.mock.calls.some((c) => c[0] === "/providers/test")).toBe(false);
});

const HEALTH = {
  open: 3, running: false, lastRun: "2026-10-14", checks: [{ key: "near_dups", label: "Near-duplicate pairs", issue: true, count: 16 }, { key: "auto_setup", label: "Setup exercises", issue: false, count: 1 }],
  outcome: { ok: 5, failed: 1, self: 0, dependent: 0, noref: 0, total: 6 }, drills: null,
};
const pair = (i) => ({ a: "a" + i, b: "b" + i, sim: 60, sameDataset: i === 0, left: { id: "a" + i, level: 1, diff: "easy", tables: ["t"], title: "A" + i, body: "body" }, right: { id: "b" + i, level: 1, diff: "easy", tables: [], dataset: "world", title: "B" + i, body: "body" } });
test("Health: the list and outcome, the badge count, a check's pairs with a pager, decisions confirm first", async () => {
  const A = fakeAdmin({ "GET /health": HEALTH, "GET /health/near_dups": { rows: Array.from({ length: 16 }, (_, i) => pair(i)) }, "POST /health/decide": { ok: true } }, { confirmClick: vi.fn(() => true) });
  const { container } = withAdmin(A, <Health route={route("check=near_dups")} />);
  await screen.findByText("3", { selector: "h2 .mono" });
  expect(A.setCount).toHaveBeenCalledWith("health", 3);
  expect(A.loadRefs).toHaveBeenCalled();
  expect(container.querySelector("#refsCard")).not.toBeNull();
  expect(screen.getByRole("img").getAttribute("aria-label")).toMatch(/^Every exercise counted once: 5 ran OK, 1 failed/);
  expect(container.querySelectorAll(".wf-pair").length).toBe(15);
  expect(container.querySelector(".wf-pager-row").textContent).toContain("1–15 of 16");
  expect(screen.getByRole("link", { name: "Next page" }).getAttribute("href")).toBe("#/health?check=near_dups&page=1");
  fireEvent.click(screen.getAllByRole("button", { name: "Merge, keep B" })[0]);
  expect(A.confirmClick.mock.calls[0][1]).toBe("Merge: keep the chosen one and move the other's progress to it?");
  await waitFor(() => expect(A.api).toHaveBeenCalledWith("/health/decide", "POST", { a: "a0", b: "b0", decision: "merge", keep: "b0" }));
  await waitFor(() => expect(A.toast).toHaveBeenCalledWith("Merged"));
});

const META = {
  types: [{ type: "exercise", label: "Exercise / drill", group: "Practice" }, { type: "mcq", label: "Multiple choice (MCQ)", group: "Practice" }, { type: "flashcard_keyword", label: "Flashcard: keyword", group: "Flashcards" }],
  concepts: [{ slug: "choosing-columns", name: "Choosing columns", level: 1 }, { slug: "joins", name: "INNER JOIN", level: 3 }],
  levels: [{ n: 1, title: "SELECT basics" }, { n: 2, title: "Filtering" }, { n: 3, title: "Joins" }], diffs: ["easy", "medium", "hard"], datasets: [{ key: "world", label: "World" }],
};
test("Create: type groups, a concept locks its level, MCQ answers follow the options, Check sends the form", async () => {
  const A = fakeAdmin({ "GET /create/meta": META, "POST /create/check": (b) => ({ status: "fail", checks: [{ ok: false, label: "Explanation" }, { ok: true, label: "Concept" }], body: b }) });
  const { container } = withAdmin(A, <Create route={route("type=mcq")} />);
  await screen.findByRole("heading", { level: 2, name: "Create by hand" });
  expect([...container.querySelectorAll("#c-type optgroup")].map((g) => g.label)).toEqual(["Practice", "Flashcards"]);
  expect(screen.getAllByRole("tab").map((t) => t.getAttribute("href"))).toEqual(["#/create", "#/create?tab=import"]);
  fireEvent.change(container.querySelector("#c-concept"), { target: { value: "INNER JOIN (Level 3)" } });
  expect(container.querySelector("#c-level").disabled).toBe(true);
  expect(container.querySelector("#c-level").value).toBe("3");
  const opts = container.querySelector('[data-cf="options"]');
  opts.value = "DISTINCT\nUNIQUE\nGROUP"; fireEvent.input(opts);
  expect([...container.querySelectorAll("#cf-answer option")].map((o) => o.textContent)).toEqual(["A. DISTINCT", "B. UNIQUE", "C. GROUP"]);
  expect([...container.querySelectorAll("[data-cw]")].map((e) => e.id)).toEqual(["cw-1", "cw-2"]);
  fireEvent.change(container.querySelector("#cw-2"), { target: { value: "GROUP groups" } });
  fireEvent.change(container.querySelector("#cf-answer"), { target: { value: "1" } });
  expect([...container.querySelectorAll("[data-cw]")].map((e) => e.id + "=" + e.value)).toEqual(["cw-0=", "cw-2=GROUP groups"]);
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await screen.findByText("1 check failed: nothing was saved.");
  const body = A.api.mock.calls.find((c) => c[0] === "/create/check")[2];
  expect(body).toMatchObject({ type: "mcq", concept: "joins", level: 3, stage: "understand", review: false, publish: true });
  expect(body.fields).toMatchObject({ options: "DISTINCT\nUNIQUE\nGROUP", answer: 1, why_wrong: ["", undefined, "GROUP groups"].map((x) => x) });
  expect(document.activeElement.className).toBe("c-sum");
  // switching type keeps the concept, clears the fields
  fireEvent.change(container.querySelector("#c-type"), { target: { value: "flashcard_keyword" } });
  expect(container.querySelector("#c-concept").value).toBe("INNER JOIN (Level 3)");
  expect([...container.querySelectorAll("[data-cf]")].map((e) => e.getAttribute("data-cf"))).toEqual(["front", "back"]);
  expect(container.querySelector("#cOut").textContent).toBe("");
});

test("Create: no axe violations on the form and the import tab", async () => {
  for (const qs of ["type=exercise", "tab=import"]) {
    const A = fakeAdmin({ "GET /create/meta": META });
    const { container, unmount } = withAdmin(A, <Create route={route(qs)} />);
    await screen.findByRole("heading", { level: 2 });
    const r = await axe.run(container, { iframes: false }); // jsdom cannot enter the preview frame; Chrome axe covers it
    expect(r.violations.map((v) => qs + " " + v.id + ": " + v.help)).toEqual([]);
    unmount();
  }
});
