// The admin app's pieces for React pages: its helpers come from public/admin.js (window.SQLDrillsAdmin, the one
// copy: api() with the stale-page guard, toast, askConfirm / confirmClick, nav counts…); tests inject their own.
import { createContext, useContext, useEffect, useRef } from "react";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./admin.scss";

const AdminContext = createContext(null);
export const AdminProvider = AdminContext.Provider;

export function useAdmin() {
  const injected = useContext(AdminContext);
  const a = injected || (typeof window !== "undefined" ? window.SQLDrillsAdmin : null);
  if (!a) throw new Error("The admin helpers are not loaded (public/admin.js exposes window.SQLDrillsAdmin).");
  return a;
}

/** The admin page frame: one column, the old hero (eyebrow, the page's h2, a line, actions on the right). */
export function AdminPage({ eyebrow, title, intro, actions, className = "", children }) {
  return (
    <div className={"wf-with-rail wf-admin " + className}>
      <div className="wf-main">
        {(eyebrow || title) && (
          <div className="wf-hero wf-admin-hero">
            <div>
              {eyebrow && <div className="wf-eyebrow">{eyebrow}</div>}
              {title != null && <h2>{title}</h2>}
              {intro && <p>{intro}</p>}
            </div>
            {actions && <div className="wf-actions">{actions}</div>}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}

/** A Waffles card with the usual padding; `as`, id and aria pass through. */
export function Panel({ as = "section", className = "", children, ...rest }) {
  return <Card as={as}><div className={"wf-card-pad " + className} {...rest}>{children}</div></Card>;
}

/** A card heading row: an h3 with an icon, and something on the right. */
export function PanelHead({ icon, title, id, aside }) {
  return <div className="wf-panel-h"><h3 id={id}>{icon}{title}</h3>{aside}</div>;
}

export function ErrorLine({ error }) { return <div className="wf-err" role="alert">{error.message || String(error)}</div>; }

/** The old pages' "Loading…" while the first request is out. */
export function Loading({ label = "Loading…" }) { return <div className="wf-loading" aria-busy="true">{label}</div>; }

/** Numbers as the old n(): monospace, grouped, "–" when missing. */
export const Num = ({ v }) => <span className="mono">{v == null ? "–" : Number(v).toLocaleString()}</span>;

/** A ref callback that sets plain attributes Waffles components don't take (download, title). */
export const attrs = (map) => (el) => { if (el) Object.keys(map).forEach((k) => (map[k] == null ? el.removeAttribute(k) : el.setAttribute(k, map[k]))); };

/** setTimeout that is cleared when the page goes away (the old router cleared its timers on every route change). */
export function useTimer() {
  const t = useRef(null);
  useEffect(() => () => clearTimeout(t.current), []);
  return (fn, ms) => { clearTimeout(t.current); t.current = setTimeout(fn, ms); };
}
