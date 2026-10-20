// The hand-off between the old hash router (public/app.js) and React, one route at a time.
// The old router asks has(name); if React owns the route it calls mount(name, view, ctx) instead of
// its own view function, and unmount() at the start of every route change, so the old pages find
// #view exactly as before. Rendering is synchronous (flushSync), like the old innerHTML views.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import Licenses from "./pages/Licenses.jsx";

// the routes React owns in each app (learner: index.html, admin: admin.html)
export const PAGES = { learner: { licenses: Licenses }, admin: {} };

export function createBridge(pages = PAGES) {
  const byApp = pages.learner || pages.admin ? pages : { learner: pages }; // a flat map means the learner app
  const own = (app) => byApp[app || "learner"] || {};
  let current = null;
  return {
    has: (name, app) => Object.prototype.hasOwnProperty.call(own(app), name),
    mount(name, view, ctx = {}) {
      this.unmount();
      const Page = own(ctx.app)[name];
      view.innerHTML = "";
      const el = document.createElement("div");
      el.className = "wf-root";
      el.setAttribute("data-route", name);
      view.appendChild(el);
      const root = createRoot(el);
      flushSync(() => root.render(<StrictMode><Page {...ctx} /></StrictMode>));
      current = { root, el };
    },
    unmount() {
      if (!current) return;
      const { root, el } = current;
      current = null;
      root.unmount();
      el.remove();
    },
    get mounted() { return !!current; },
  };
}

export function installBridge(win) {
  win.SQLDrillsReact = createBridge();
  win.dispatchEvent(new Event("sqldrills:react-ready"));
}
