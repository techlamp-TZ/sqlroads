// How to use (#/help), in both apps: the learner and admin guides from public/help.js (window.Help, the one copy:
// sections, Help.textHtml, ROUTE_HELP for the "?" buttons), numbers from /api/help/numbers as {{tokens}}.
// Same text, links, ids and behaviour as the old views (app.js / admin.js viewHelp): ?g= picks the guide,
// ?s= scrolls to a section and focuses its heading.
import { useEffect, useState } from "react";
import Card from "@waffles/card";
import "../shared/page.scss";
import "./help.scss";
import LinkTabs from "../shared/LinkTabs.jsx";
import Loader from "../shared/Loader.jsx";
import { LegacyHtml, useShared } from "../shared/shared.jsx";

let numbersCache = null; // like the old pages: fetched once per page load

function loadNumbers(app, shared) {
  if (numbersCache) return Promise.resolve(numbersCache);
  // the learner app goes through its api() (version check); the admin read it with fetch, as before
  const get = app === "admin" ? fetch("/api/help/numbers").then((r) => r.json()) : shared.api("/api/help/numbers");
  return get.then((n) => (numbersCache = n));
}

const COPY = {
  learner: {
    tabs: [{ key: "learner", href: "#/help", text: "Learner guide", icon: "graduation" }, { key: "admin", href: "#/help?g=admin", text: "Admin guide", icon: "gear" }],
    Title: "h1", sectionHeading: "h2",
    intro: "Two guides: one for learning, one for the admin where content is made and reviewed. Every number on this page comes from the app as it is now.",
    sectionHref: (g, id) => "#/help?" + (g === "admin" ? "g=admin&" : "") + "s=" + id,
    guideOf: (q) => (q.get("g") === "admin" ? "admin" : "learner"),
  },
  admin: {
    tabs: [{ key: "admin", href: "#/help", text: "Admin guide", icon: "cog" }, { key: "learner", href: "#/help?g=learner", text: "Learner guide", icon: "graduation" }],
    Title: "h2", sectionHeading: "h3",
    intro: "The admin guide (making and reviewing content) and the learner guide. Every number comes from the app as it is now.",
    sectionHref: (g, id) => "#/help?" + (g === "learner" ? "g=learner&" : "") + "s=" + id,
    guideOf: (q) => (q.get("g") === "learner" ? "learner" : "admin"),
  },
};

export default function HelpPage({ app = "learner", route, icon }) {
  const shared = app === "learner" ? useShared() : null; // eslint-disable-line react-hooks/rules-of-hooks
  const C = COPY[app] || COPY.learner;
  const q = (route && route.q) || new URLSearchParams();
  const g = C.guideOf(q), sec = q.get("s");
  const [nums, setNums] = useState(numbersCache);
  const [error, setError] = useState(null);
  useEffect(() => { if (!nums) loadNumbers(app, shared).then(setNums, (e) => setError(e)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ?s=: the section's heading in view and focused, as before
  useEffect(() => {
    if (!nums || !sec) return;
    const h = document.getElementById("hh-" + sec);
    if (h) { h.scrollIntoView(); h.focus(); }
  }, [nums, sec]);

  const H = window.Help;
  const frame = (body) => (app === "learner"
    ? <div className="wf-with-rail"><div className="wf-main wf-help-page">{body}</div><LegacyHtml html={shared.rail()} label="rail" /></div>
    : <div className="wf-with-rail wf-admin"><div className="wf-main wf-help-page">{body}</div></div>);

  if (error) return frame(<Card><div className="wf-card-pad">{error.message}</div></Card>);
  if (!nums) return frame(<Card><div className="wf-card-pad" aria-busy="true"><Loader label="Loading…" showLabel inline /></div></Card>);

  const list = g === "admin" ? H.ADMIN : H.LEARNER;
  const Title = C.Title, SectionH = C.sectionHeading;
  return frame(
    <>
      <div className="wf-hero">
        <div className="wf-eyebrow">How to use</div>
        <Title>How to use SQL Drills</Title>
        <p>{C.intro}</p>
      </div>
      <LinkTabs tabs={C.tabs} current={g} icon={icon} />
      <Card>
        <nav className="wf-card-pad wf-help-toc" aria-label="Sections">
          <ol>{list.map((s) => <li key={s.id}><a href={C.sectionHref(g, s.id)}>{s.title}</a></li>)}</ol>
          {app === "learner" && g === "admin" && <p className="wf-small"><a href="/admin">Open the admin</a></p>}
        </nav>
      </Card>
      {list.map((s) => (
        <Card as="section" key={s.id}>
          <div className="wf-card-pad wf-help-sec" id={"h-" + s.id} aria-labelledby={"hh-" + s.id} role="region">
            <SectionH id={"hh-" + s.id} tabIndex={-1}>{s.title}</SectionH>
            <div className="wf-prose" dangerouslySetInnerHTML={{ __html: H.textHtml(s.text, nums) }} />
            {s.shot && (
              <figure className="wf-help-shot">
                <img src={"/help/" + s.shot} alt={s.alt} loading="lazy" width="1200" height="750" />
                <figcaption>{s.alt + " (from the app)"}</figcaption>
              </figure>
            )}
          </div>
        </Card>
      ))}
    </>,
  );
}
