// How to use: the real guides (public/help.js), a stand-in for app.js's shared pieces and the numbers API.
// The pages are compared with the old ones in Chrome (text, addresses, focus, API calls).
import { test, expect, vi, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { render, screen, waitFor } from "@testing-library/react";
import axe from "axe-core";
import HelpPage from "./Help.jsx";
import { SharedProvider } from "../shared/shared.jsx";

const Help = createRequire(import.meta.url)("../../../public/help.js");
const NUMS = { levels: 14, concepts: 161, lessons: 161, flashcards: 1025, exercises: 3020 };
const icon = (name) => '<svg data-name="' + name + '" viewBox="0 0 24 24"></svg>';
const shared = { api: vi.fn(() => Promise.resolve(NUMS)), rail: () => '<aside class="rail" aria-label="Your progress"></aside>' };
const route = (qs = "") => ({ name: "help", q: new URLSearchParams(qs) });
beforeAll(() => { window.Help = Help; globalThis.fetch = vi.fn(() => Promise.resolve({ json: () => Promise.resolve(NUMS) })); });

const learner = (qs) => render(<SharedProvider value={shared}><main><HelpPage app="learner" route={route(qs)} icon={icon} /></main></SharedProvider>);

test("learner guide: the old heading, tabs, contents and every section, numbers filled in", async () => {
  const { container } = learner("");
  expect(screen.getByText("Loading…")).toBeTruthy();
  await screen.findByRole("heading", { level: 1, name: "How to use SQL Drills" });
  expect(shared.api).toHaveBeenCalledWith("/api/help/numbers");
  const tabs = screen.getAllByRole("tab").map((t) => [t.textContent, t.getAttribute("href"), t.getAttribute("aria-selected")]);
  expect(tabs).toEqual([["Learner guide", "#/help", "true"], ["Admin guide", "#/help?g=admin", "false"]]);
  const toc = [...screen.getByRole("navigation", { name: "Sections" }).querySelectorAll("a")].map((a) => a.getAttribute("href"));
  expect(toc).toEqual(Help.LEARNER.map((s) => "#/help?s=" + s.id));
  expect([...container.querySelectorAll("h2[tabindex='-1']")].map((h) => h.id)).toEqual(Help.LEARNER.map((s) => "hh-" + s.id));
  expect(container.textContent).not.toMatch(/\{\{/); // every {{token}} filled
  expect(container.querySelector(".rail")).not.toBeNull();
  expect(container.querySelector('a[href="/admin"]')).toBeNull();
});

test("?g=admin shows the admin guide with the link to the admin; ?s= focuses that heading", async () => {
  learner("g=admin&s=backups");
  await waitFor(() => expect(document.activeElement && document.activeElement.id).toBe("hh-backups"));
  expect(screen.getByRole("tab", { name: "Admin guide" }).getAttribute("aria-selected")).toBe("true");
  expect(screen.getByRole("link", { name: "Open the admin" }).getAttribute("href")).toBe("/admin");
  expect(screen.getByRole("link", { name: Help.ADMIN[0].title }).getAttribute("href")).toBe("#/help?g=admin&s=" + Help.ADMIN[0].id);
});

test("admin app: the admin guide first, h2/h3 headings, numbers read with fetch, no rail", async () => {
  const { container } = render(<main><HelpPage app="admin" route={route("")} icon={icon} /></main>);
  await screen.findByRole("heading", { level: 2, name: "How to use SQL Drills" });
  expect(screen.getAllByRole("tab").map((t) => t.getAttribute("href"))).toEqual(["#/help", "#/help?g=learner"]);
  expect([...container.querySelectorAll("h3")].map((h) => h.id)).toEqual(Help.ADMIN.map((s) => "hh-" + s.id));
  expect(container.querySelector(".rail")).toBeNull();
  expect(container.querySelector('svg[data-name="cog"]')).not.toBeNull();
});

test("no axe violations (all rules on)", async () => {
  const { container } = learner("");
  await screen.findByRole("heading", { level: 1 });
  const r = await axe.run(container);
  expect(r.violations.map((v) => v.id + ": " + v.help)).toEqual([]);
});
