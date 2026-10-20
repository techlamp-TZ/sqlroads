// Catalog and test page only: boots the real old front end (src/legacy/app.js and the scripts it needs) in the page,
// with the shell elements app.js expects (the chrome is hidden), so the wrappers can be shown next to the old
// pieces with their real handlers. /api and the app's files must reach a server on a database copy (:4100).
const SCRIPTS = [
  "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-asm.min.js",
  "/compare.js",
  "/cards.js",
  "/help.js",
];

// the elements of public/index.html that app.js looks up; everything but #view and #toast is hidden (inline
// display:none, since app.css gives the chrome its own display, which would beat the hidden attribute)
const SHELL = `<div class="shell" id="shell" data-harness style="display:block">
  <aside class="side" id="side" style="display:none"><nav class="nav" id="nav"></nav><div class="side-streak" id="sideStreak"></div></aside>
  <div class="scrim" id="scrim" style="display:none"></div>
  <main class="main" style="min-width:0">
    <header class="top" style="display:none"><button class="top-menu" id="menuBtn" aria-label="Open navigation"></button>
      <div class="search" id="searchWrap"><input id="searchInput" type="text" aria-label="Search drills"><div class="search-results" id="searchResults" hidden></div></div>
      <div class="top-stats" id="topStats"></div><a class="icon-btn help-btn" id="helpBtn" href="#/help" aria-label="How to use this page"></a>
      <button class="icon-btn" id="themeBtn" aria-label="Toggle dark mode"></button>
      <div class="settings-wrap"><button class="icon-btn" id="settingsBtn" aria-label="Settings"></button><div class="settings-menu card" id="settingsMenu" hidden></div></div>
      <span class="avatar" id="avatar">S</span></header>
    <div class="body" id="view" tabindex="-1"></div>
  </main>
</div><div class="toast" id="toast" hidden></div>`;

const loadScript = (src) => new Promise((ok, fail) => {
  const s = document.createElement("script");
  s.src = src; s.onload = ok; s.onerror = () => fail(new Error("Could not load " + src));
  document.body.appendChild(s);
});

let booting = null;

/** Resolves with a fresh host element inside #view once app.js has booted (only boots once per page). */
export function legacyApp() {
  if (!booting) {
    booting = (async () => {
      if (!document.getElementById("view")) {
        await import("../../legacy/app.css");
        const wrap = document.createElement("div");
        wrap.innerHTML = SHELL;
        while (wrap.firstChild) document.body.appendChild(wrap.firstChild);
      }
      const booted = new Promise((ok) => window.addEventListener("sqldrills:booted", ok, { once: true }));
      if (!window.SQLDrillsShared) { for (const src of SCRIPTS) await loadScript(src); await import("../../legacy/app.js"); }
      if (!window.SQLDrillsShared.booted) await booted;
      await new Promise((r) => setTimeout(r, 0)); // app.js renders its first page right after booting
    })();
  }
  return booting.then(() => {
    const view = document.getElementById("view");
    view.innerHTML = "";
    const host = document.createElement("div");
    host.className = "page full";
    view.appendChild(host);
    return host;
  });
}

/** The data the side-by-side examples use, from the API (a real lesson and a real interaction card). */
export async function sampleData(slug = "choosing-columns") {
  const c = await (await fetch("/api/learn/concept/" + encodeURIComponent(slug))).json();
  return { concept: c, lesson: c.lessons && c.lessons[0], card: c.cards && c.cards[0] };
}
