// The hand-off between the old router and React.
import { describe, test, expect, beforeEach } from "vitest";
import { createBridge, installBridge, PAGES } from "./bridge.jsx";

function Probe({ route }) { return <p className="probe">{route.name}</p>; }

describe("bridge", () => {
  let view;
  beforeEach(() => { document.body.innerHTML = '<div id="view"><div class="loading">old page</div></div>'; view = document.getElementById("view"); });

  test("owns only the routes it has pages for, per app", () => {
    const b = createBridge({ learner: { probe: Probe }, admin: { other: Probe } });
    expect(b.has("probe")).toBe(true); // no app named: the learner app
    expect(b.has("probe", "learner")).toBe(true);
    expect(b.has("probe", "admin")).toBe(false);
    expect(b.has("other", "admin")).toBe(true);
    expect(b.has("toString")).toBe(false);
    expect(createBridge().has("licenses")).toBe(true);
    expect(createBridge().has("licenses", "admin")).toBe(false);
    expect(Object.keys(PAGES.learner)).toEqual(["licenses", "help", "docs", "home", "learn", "notes", "flashcards", "challenge", "concept", "drill"]);
    expect(Object.keys(PAGES.admin)).toEqual(["help", "create", "settings", "backups", "health"]);
    expect(createBridge().has("help", "admin")).toBe(true);
    expect(createBridge().has("docs", "admin")).toBe(false);
  });

  test("mount renders synchronously into #view, replacing the old page", () => {
    const b = createBridge({ probe: Probe });
    b.mount("probe", view, { route: { name: "probe" } });
    expect(view.querySelector(".loading")).toBeNull();
    expect(view.querySelector('.wf-root[data-route="probe"] .probe').textContent).toBe("probe");
    expect(b.mounted).toBe(true);
  });

  test("unmount leaves #view empty for the old router, and is safe to repeat", () => {
    const b = createBridge({ probe: Probe });
    b.mount("probe", view, { route: { name: "probe" } });
    b.unmount();
    b.unmount();
    expect(view.children.length).toBe(0);
    expect(b.mounted).toBe(false);
  });

  test("mounting again replaces the previous page (one root at a time)", () => {
    const b = createBridge({ probe: Probe });
    b.mount("probe", view, { route: { name: "probe" } });
    b.mount("probe", view, { route: { name: "probe" } });
    expect(view.querySelectorAll(".wf-root").length).toBe(1);
  });

  test("installBridge exposes the bridge and announces it", () => {
    let heard = 0;
    window.addEventListener("sqldrills:react-ready", () => heard++, { once: true });
    installBridge(window);
    expect(typeof window.SQLDrillsReact.mount).toBe("function");
    expect(heard).toBe(1);
  });
});
