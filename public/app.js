// SQL Drills: one drill library in 14 levels (easy -> hard), MCQs, quizzes, progress and a guide.
// Data comes from sql-drills-server:
//   /api/library            every exercise: level, order, difficulty, done (no sources, no answers)
//   /api/library/item/:id   one exercise; .../course, /run, /check, /solution, ... for exercises
//                           checked on the server (MySQL by default, PostgreSQL as a setting)
//   /api/library/dataset/k  the SQL that builds an in-browser practice database
//   /api/mcqs, /api/progress (MCQs), /api/library/activity, /api/bookmarks, /api/hint
(function () {
  "use strict";

  // ---------- icons ----------
  var P = {
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    stack: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v4c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 9v5c0 1.7 3.6 3 8 3s8-1.3 8-3V9"/><path d="M4 14v5c0 1.7 3.6 3 8 3s8-1.3 8-3v-5"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    levels: '<path d="M4 20h4v-6H4zM10 20h4V10h-4zM16 20h4V4h-4z"/>',
    brief: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/><path d="M20 16V6"/>',
    bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>', book: '<path d="M2 5c2-1 5-1.5 10 1 5-2.5 8-2 10-1v14c-2-1-5-1.5-10 1-5-2.5-8-2-10-1z"/><path d="M12 6v14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>', menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    chevDown: '<path d="m6 9 6 6 6-6"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>', chevRight: '<path d="m9 6 6 6-6 6"/>', chevLeft: '<path d="m15 6-6 6 6 6"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', expand: '<path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/>', code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.4.9 1 .9 1.7V16h5.2v-.4c0-.7.3-1.3.9-1.7A6 6 0 0 0 12 3Z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    flame: '<path d="M12 22c4 0 7-2.7 7-7 0-4-3-6-4-9-1 2-2 3-3 3 0-2-1-4-3-6 0 4-4 6-4 12 0 4.3 3 7 7 7z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    play: '<path d="M7 4v16l13-8z"/>', link: '<path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
    file: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M9 6h12M9 12h12M9 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.5"/>', gauge: '<path d="M12 14l4-4"/><path d="M3.3 17a9 9 0 1 1 17.4 0"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>', wand: '<path d="m15 4 5 5L9 20H4v-5z"/><path d="m13 6 5 5"/>',
    external: '<path d="M14 4h6v6M20 4 10 14"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>',
    tips: '<path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/><path d="M9 21h6"/>', eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>', graduation: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>', new: '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/><path d="M17 3l2 2"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    selfcheck: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
    cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
    note: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><path d="M8 13h8M8 17h5"/>',
    compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  };
  function icon(name, cls) { return '<svg' + (cls ? ' class="' + cls + '"' : "") + ' viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || "") + "</svg>"; }
  document.querySelectorAll("[data-icon]").forEach(function (el) { el.innerHTML = icon(el.getAttribute("data-icon")); });

  // ---------- utilities ----------
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function plural(n, w) { return n.toLocaleString() + " " + w + (n === 1 ? "" : "s"); }
  function pct(a, b) { return b ? Math.round((100 * a) / b) : 0; }
  function store(key, val) {
    try {
      if (val === undefined) { var raw = localStorage.getItem(key); return raw == null ? null : JSON.parse(raw); }
      if (val === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
    } catch (e) { return null; }
  }
  function toast(text) { var t = $("#toast"); t.textContent = text; t.hidden = false; clearTimeout(toast._t); toast._t = setTimeout(function () { t.hidden = true; }, 2400); }
  function localDay(d) { var x = new Date(d); return x.getFullYear() + "-" + String(x.getMonth() + 1).padStart(2, "0") + "-" + String(x.getDate()).padStart(2, "0"); }
  // ---------- in-page confirm (Chrome can silently switch native confirm() off for a page) ----------
  function askConfirm(message, okLabel) {
    return new Promise(function (resolve) {
      var d = document.getElementById("confirmDlg");
      if (!d) { d = document.createElement("dialog"); d.id = "confirmDlg"; d.className = "confirm-dlg"; d.setAttribute("aria-labelledby", "confirmMsg"); document.body.appendChild(d); }
      d.innerHTML = '<p class="confirm-msg" id="confirmMsg"></p><div class="confirm-act"><button type="button" class="btn sm" data-confirm="cancel">Cancel</button><button type="button" class="btn sm primary" data-confirm="ok"></button></div>';
      d.querySelector(".confirm-msg").textContent = message;
      d.querySelector('[data-confirm="ok"]').textContent = okLabel || "OK";
      var done = function (v) { if (d.open) d.close(); resolve(v); };
      d.onclick = function (e) { var b = e.target.closest("[data-confirm]"); if (b) done(b.getAttribute("data-confirm") === "ok"); };
      d.oncancel = function (e) { e.preventDefault(); done(false); };
      d.showModal();
      d.querySelector('[data-confirm="ok"]').focus();
    });
  }
  // for click handlers: false now and the dialog opens; on OK the same button is clicked again and this returns true
  function confirmClick(el, message, okLabel) {
    if (el && el.__confirmed) { el.__confirmed = false; return true; }
    askConfirm(message, okLabel).then(function (ok) { if (ok && el && el.isConnected) { el.__confirmed = true; el.click(); } });
    return false;
  }
  // ---------- version guard: this page vs the server ----------
  var PAGE_VERSION = (document.querySelector('meta[name="app-version"]') || {}).content || "";
  function versionHeaders(h) { h = h || {}; if (PAGE_VERSION) h["X-Page-Version"] = PAGE_VERSION; return h; }
  function watchVersion(r) {
    // a response the browser may keep (datasets, max-age) can carry the version it was first served with
    var v = r.headers.get("X-App-Version"), cached = /max-age=[1-9]/.test(r.headers.get("Cache-Control") || "");
    if (PAGE_VERSION && v && v !== PAGE_VERSION && !cached) staleBanner();
    return r;
  }
  // a write refused because this page is stale is already explained by the banner: not an error to report
  window.addEventListener("unhandledrejection", function (e) { if (e.reason && e.reason.stale) e.preventDefault(); });
  function staleError(msg) { var er = new Error(msg); er.stale = true; return er; }
  function staleBanner() {
    if (document.getElementById("staleBanner")) return;
    var b = document.createElement("div");
    b.id = "staleBanner"; b.className = "stale-banner"; b.setAttribute("role", "alert");
    b.innerHTML = "<span><b>New version of SQL Drills.</b> Reload to use it: changes from this page are not saved until you do.</span>";
    var btn = document.createElement("button"); btn.type = "button"; btn.className = "btn sm primary"; btn.textContent = "Reload";
    btn.onclick = function () { location.reload(); };
    b.appendChild(btn); document.body.appendChild(b);
  }
  // the admin's live preview (#/preview): nothing is saved from this window
  var PREVIEW_MODE = /^#\/preview\b/.test(location.hash);
  function api(path, body) {
    if (PREVIEW_MODE && body !== undefined) return Promise.resolve({ ok: true, preview: true, state: null, id: 0, concepts: [] });
    return fetch(path, body === undefined ? { headers: versionHeaders() } : { method: "POST", headers: versionHeaders({ "Content-Type": "application/json" }), body: JSON.stringify(body) })
      .then(watchVersion)
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) {
        if (b && b.stale) { staleBanner(); throw staleError(b.error); }
        if (b && b.offline) { var off = new Error(b.message || "Database server is offline"); off.offline = true; off.engine = b.engine; throw off; }
        if (!r.ok && !(b && (b.verdict || b.ok === false))) throw new Error(b.error || "Request failed (" + r.status + ")");
        return b;
      }); });
  }
  function fmtDate(iso) { return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }

  // ---------- state ----------
  var DIFF = ["easy", "medium", "hard"], DIFF_LABEL = { easy: "Easy", medium: "Medium", hard: "Hard" };
  var CHECK_LABEL = { results: "Auto-checked", diff: "Auto-checked (changes rolled back)", error: "Auto-checked (must fail)", self: "Self-check", run: "Practice · not checked", solution: "Auto-checked", state: "Auto-checked · runs on MySQL" };
  var S = {
    levels: [], items: [], byId: {}, datasets: {}, mcqs: [], byMcq: {}, mcqDone: {}, activity: [], bookmarks: {}, quiz: null,
    df: Object.assign({ diff: "all", level: "all", status: "all", check: "all", q: "", sort: "path", view: "list", page: 0, size: 25 }, store("sqldrills.filters.v3") || {}),
    mf: Object.assign({ diff: "all", level: "all", status: "all", check: "all", q: "", sort: "path", view: "list", page: 0, size: 25 }, store("sqldrills.mcqFilters.v3") || {}),
  };
  S.filters = S.df;
  function dialect() { return store("sqldrills.dialect") === "postgres" ? "postgres" : "mysql"; }

  function levelOf(n) { return S.levels[n - 1]; }
  function levelName(n) { var L = levelOf(n); return L ? "Level " + n + " · " + L.title : ""; }
  function itemsIn(n) { return S.items.filter(function (i) { return i.level === n; }); }
  function mcqsIn(levels) { return S.mcqs.filter(function (m) { return levels.indexOf(m.level) > -1; }); }

  function buildModel(lib, mcqs, progress) {
    S.levels = lib.levels;
    S.datasets = lib.datasets || {};
    S.baselineAt = lib.baselineAt || "";
    S.items = lib.items.map(function (i, k) {
      i.kind = "ex";
      i.n = k + 1;
      i.key = i.id;
      i.desc = i.summary || "";
      i.hay = (i.title + " " + i.desc + " " + (i.tables || []).join(" ") + " " + levelName(i.level) + " " + DIFF_LABEL[i.diff]).toLowerCase();
      S.byId[i.id] = i;
      return i;
    });
    S.mcqDone = {};
    Object.keys(progress || {}).forEach(function (k) { if (progress[k] && k.indexOf("mcq:") === 0) S.mcqDone[k] = true; });
    var n = 0;
    S.mcqs = mcqs.map(function (q) {
      var rnd = seeded(q.id), order = [0, 1, 2, 3];
      for (var i = 3; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
      var m = {
        kind: "mcq", key: "mcq:" + q.id, id: q.id, n: ++n, title: q.q, code: q.code || "", level: q.level || 1, diff: q.diff, minutes: 1, added_at: q.added_at,
        desc: q.code ? q.code.split("\n")[0] + (q.code.indexOf("\n") > -1 ? " …" : "") : "",
        options: order.map(function (k) { return q.options[k]; }), answer: order.indexOf(q.answer), why: q.why, whyWrong: q.why_wrong ? order.map(function (k) { return q.why_wrong[k] || ""; }) : null,
      };
      m.hay = (m.title + " " + m.code + " " + m.options.join(" ") + " " + levelName(m.level) + " multiple choice mcq quiz").toLowerCase();
      S.byMcq[m.id] = m;
      return m;
    });
  }
  function seeded(id) {
    var h = 2166136261;
    for (var i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
  }

  // ---------- status ----------
  function isDone(d) { return d.kind === "mcq" ? !!S.mcqDone[d.key] : !!d.done; }
  function isStarted(d) { return !isDone(d) && !!store(d.kind === "mcq" ? "sqldrills.mcqTried." + d.id : "sqldrills.draft." + d.id); }
  function statusOf(d) { return isDone(d) ? "done" : d.failed ? "fail" : isStarted(d) ? "prog" : "todo"; }
  var STATUS_LABEL = { done: "Done", prog: "In progress", fail: "Failed", todo: "Not started" };
  function markDone(d, already) {
    if (isDone(d)) return;
    if (d.kind === "mcq") {
      S.mcqDone[d.key] = true;
      api("/api/progress", { qid: d.key, done: true }).catch(function (e) { toast("Couldn't save progress: " + e.message); });
    } else {
      d.done = true;
      d.failed = false;
      if (!already) api("/api/library/item/" + d.id + "/done", { done: true, dialect: dialect() }).catch(function (e) { toast("Couldn't save progress: " + e.message); });
    }
    S.activity.push({ id: d.key, at: new Date().toISOString() });
    S.learn.levels = {}; S.learn.today = null; viewConcept.stale = true;
    store(d.kind === "mcq" ? "sqldrills.mcqTried." + d.id : "sqldrills.draft." + d.id, null);
    renderChrome();
  }
  function toggleBookmark(key) {
    var on = !S.bookmarks[key];
    if (on) S.bookmarks[key] = new Date().toISOString(); else delete S.bookmarks[key];
    api("/api/bookmarks", { qid: key, on: on }).catch(function (e) { toast("Couldn't save the bookmark: " + e.message); });
    renderNav();
    return on;
  }

  // ---------- streak, daily goal, rank ----------
  var RANKS = [[0, "SQL Beginner"], [25, "SQL Explorer"], [75, "Query Builder"], [150, "Data Wrangler"], [300, "Join Master"], [600, "SQL Pro"], [1200, "SQL Expert"], [2000, "SQL Legend"]];
  function doneCount() { return S.items.filter(isDone).length; }
  function rankInfo() {
    var done = doneCount(), i = 0;
    while (i + 1 < RANKS.length && done >= RANKS[i + 1][0]) i++;
    var next = RANKS[i + 1];
    return { rank: i + 1, name: RANKS[i][1], done: done, next: next ? next[1] : null, toNext: next ? next[0] - done : 0, pct: next ? pct(done - RANKS[i][0], next[0] - RANKS[i][0]) : 100 };
  }
  function activeDays() { var days = {}; S.activity.forEach(function (a) { var k = localDay(a.at); days[k] = (days[k] || 0) + 1; }); return days; }
  function streak() {
    var days = activeDays(), d = new Date(), n = 0;
    if (!days[localDay(d)]) d.setDate(d.getDate() - 1);
    while (days[localDay(d)]) { n++; d.setDate(d.getDate() - 1); }
    return { days: n, today: days[localDay(new Date())] || 0 };
  }
  function dailyGoal() { var g = Number(store("sqldrills.goal")); return g > 0 && g < 100 ? g : 5; }
  /** The level you're on: the first one that isn't finished. */
  function currentLevel() {
    for (var n = 1; n <= S.levels.length; n++) if (itemsIn(n).some(function (i) { return !isDone(i); })) return n;
    return S.levels.length;
  }
  /** Where "Continue learning" goes: the exercise you were on, else the next one in your level. */
  function nextItem() {
    var last = S.byId[store("sqldrills.lastItem")];
    if (last && !isDone(last)) return last;
    var lv = currentLevel(), list = itemsIn(lv);
    if (last && last.level === lv) { var after = list.slice(list.indexOf(last) + 1).filter(function (i) { return !isDone(i); })[0]; if (after) return after; }
    return list.filter(function (i) { return !isDone(i); })[0] || null;
  }

  // ---------- guide content ----------
  var CONCEPTS = [
    { id: "select", name: "SELECT", text: "SELECT picks the columns you want to see; FROM names the table they come from.", sql: "SELECT name, population\nFROM world;" },
    { id: "where", name: "WHERE", text: "WHERE keeps only the rows that match a condition. Combine conditions with AND / OR.", sql: "SELECT name FROM world\nWHERE continent = 'Europe' AND population > 50000000;" },
    { id: "order", name: "ORDER BY", text: "ORDER BY sorts the result: ASC (the default) or DESC, and by several columns in turn.", sql: "SELECT name, gdp FROM world\nORDER BY gdp DESC, name;" },
    { id: "limit", name: "LIMIT", text: "LIMIT n keeps the first n rows of the result (after sorting). OFFSET skips rows first.", sql: "SELECT name FROM world\nORDER BY area DESC\nLIMIT 5;" },
    { id: "distinct", name: "DISTINCT", text: "DISTINCT removes duplicate rows from the result, or counts each value once: COUNT(DISTINCT x).", sql: "SELECT DISTINCT continent FROM world;" },
    { id: "join", name: "JOIN", text: "The JOIN clause is used to combine rows from two or more tables based on a related column between them.", sql: "SELECT b.title, a.last_name\nFROM books b\nJOIN authors a ON a.author_id = b.author_id;" },
    { id: "left-join", name: "LEFT JOIN", text: "LEFT JOIN keeps every row of the left table, filling the right table's columns with NULL when nothing matches.", sql: "SELECT a.last_name, b.title\nFROM authors a\nLEFT JOIN books b ON b.author_id = a.author_id;" },
    { id: "group", name: "GROUP BY", text: "GROUP BY makes one result row per group. Every selected column must be grouped or aggregated.", sql: "SELECT continent, COUNT(*) AS countries\nFROM world\nGROUP BY continent;" },
    { id: "having", name: "HAVING", text: "HAVING filters groups after aggregation, where WHERE filters rows before it.", sql: "SELECT continent, SUM(population)\nFROM world\nGROUP BY continent\nHAVING SUM(population) > 100000000;" },
    { id: "aggregates", name: "Aggregate functions", text: "COUNT, SUM, AVG, MIN and MAX turn many rows into one value (per group with GROUP BY).", sql: "SELECT COUNT(*), AVG(population), MAX(gdp)\nFROM world;" },
    { id: "null", name: "NULL", text: "NULL means unknown or missing. Test it with IS NULL / IS NOT NULL: = NULL is never true.", sql: "SELECT name FROM teacher\nWHERE dept IS NULL;" },
    { id: "subquery", name: "Subqueries", text: "A subquery is a SELECT inside another query; it can supply a value, a list (IN) or a whole table.", sql: "SELECT name FROM world\nWHERE population > (SELECT population FROM world WHERE name = 'Russia');" },
    { id: "exists", name: "EXISTS", text: "EXISTS (subquery) is true when the subquery returns at least one row, often correlated with the outer row.", sql: "SELECT a.last_name FROM authors a\nWHERE EXISTS (SELECT 1 FROM books b WHERE b.author_id = a.author_id);" },
    { id: "case", name: "CASE", text: "CASE returns a value chosen by conditions, like if/else inside a query.", sql: "SELECT name,\n  CASE WHEN population > 100000000 THEN 'large' ELSE 'other' END AS size\nFROM world;" },
    { id: "union", name: "UNION", text: "UNION stacks the rows of two queries with the same columns and removes duplicates; UNION ALL keeps them.", sql: "SELECT name FROM world WHERE continent = 'Europe'\nUNION\nSELECT name FROM world WHERE gdp > 1000000000000;" },
    { id: "cte", name: "CTE (WITH)", text: "A common table expression names a subquery up front with WITH, so the main query reads top to bottom.", sql: "WITH big AS (\n  SELECT * FROM world WHERE population > 100000000\n)\nSELECT continent, COUNT(*) FROM big GROUP BY continent;" },
    { id: "window", name: "Window functions", text: "Window functions (RANK, ROW_NUMBER, SUM ... OVER) compute across related rows without collapsing them.", sql: "SELECT name, continent,\n  RANK() OVER (PARTITION BY continent ORDER BY population DESC) AS rnk\nFROM world;" },
    { id: "insert", name: "INSERT", text: "INSERT INTO adds rows: name the columns, then give the values in the same order.", sql: "INSERT INTO authors (first_name, last_name)\nVALUES ('Ada', 'Lovelace');" },
    { id: "update", name: "UPDATE", text: "UPDATE changes rows that match WHERE. Without WHERE it changes every row.", sql: "UPDATE books SET price = price * 0.9\nWHERE published_year < 2000;" },
    { id: "delete", name: "DELETE", text: "DELETE FROM removes the rows that match WHERE. Without WHERE it empties the table.", sql: "DELETE FROM loans\nWHERE returned_date IS NOT NULL;" },
    { id: "create", name: "CREATE TABLE", text: "CREATE TABLE defines columns, their types and constraints such as PRIMARY KEY, NOT NULL and FOREIGN KEY.", sql: "CREATE TABLE members (\n  member_id INTEGER PRIMARY KEY,\n  first_name TEXT NOT NULL,\n  joined DATE\n);" },
    { id: "index", name: "Indexes", text: "An index speeds up lookups on a column at the cost of slower writes and extra storage.", sql: "CREATE INDEX idx_books_author ON books(author_id);" },
    { id: "view", name: "Views", text: "A view is a saved query you can select from like a table.", sql: "CREATE VIEW big_countries AS\nSELECT name, population FROM world WHERE population > 100000000;" },
    { id: "transaction", name: "Transactions", text: "BEGIN ... COMMIT groups statements so they all happen or none do; ROLLBACK undoes them.", sql: "BEGIN;\nUPDATE accounts SET balance = balance - 50 WHERE id = 1;\nUPDATE accounts SET balance = balance + 50 WHERE id = 2;\nCOMMIT;" },
  ];
  // which level each concept belongs to: the concept of the day comes from the current level (Level 14 mixes them all)
  var CONCEPT_LEVEL = { select: 1, distinct: 1, where: 2, "null": 2, order: 3, limit: 3, "case": 4, aggregates: 5, group: 5, having: 5, join: 6, "left-join": 6, subquery: 7, exists: 7, union: 8, cte: 9, window: 9, insert: 10, update: 10, "delete": 10, create: 11, index: 12, view: 12, transaction: 13 };
  function conceptOfDay(level) {
    var d = new Date(), k = Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 864e5);
    var pool = CONCEPTS.filter(function (c) { return level >= 14 || CONCEPT_LEVEL[c.id] === level; });
    if (!pool.length) pool = CONCEPTS.filter(function (c) { return CONCEPT_LEVEL[c.id] <= level; });
    return pool[k % pool.length] || CONCEPTS[0];
  }
  // the key clauses of each level, with a tiny example each
  var CHEATS = {
    1: [["SELECT … FROM", "SELECT name, population FROM world"], ["*", "SELECT * FROM world"], ["AS", "SELECT name AS country FROM world"], ["DISTINCT", "SELECT DISTINCT continent FROM world"], ["LIMIT", "SELECT name FROM world LIMIT 5"]],
    2: [["WHERE", "WHERE population > 1000000"], ["AND / OR", "WHERE a = 1 AND (b = 2 OR c = 3)"], ["IN", "WHERE name IN ('France', 'Peru')"], ["BETWEEN", "WHERE area BETWEEN 100 AND 200"], ["LIKE", "WHERE name LIKE 'Al%'"], ["IS NULL", "WHERE dept IS NULL"]],
    3: [["ORDER BY", "ORDER BY population"], ["DESC", "ORDER BY gdp DESC"], ["Two keys", "ORDER BY continent, name"], ["LIMIT", "ORDER BY area DESC LIMIT 5"], ["OFFSET", "LIMIT 10 OFFSET 20"]],
    4: [["CASE", "CASE WHEN x > 0 THEN 'pos' ELSE 'neg' END"], ["COALESCE", "COALESCE(phone, 'none')"], ["ROUND", "ROUND(gdp / population, 2)"], ["UPPER / LENGTH", "UPPER(name), LENGTH(name)"], ["Dates", "date('now', '-7 days')"], ["CAST", "CAST(price AS INTEGER)"]],
    5: [["COUNT", "SELECT COUNT(*) FROM world"], ["SUM / AVG", "SUM(population), AVG(gdp)"], ["GROUP BY", "GROUP BY continent"], ["HAVING", "HAVING COUNT(*) > 10"], ["COUNT DISTINCT", "COUNT(DISTINCT continent)"]],
    6: [["JOIN … ON", "FROM a JOIN b ON b.a_id = a.id"], ["LEFT JOIN", "FROM a LEFT JOIN b ON b.a_id = a.id"], ["Self join", "FROM emp e JOIN emp m ON e.mgr = m.id"], ["Three tables", "JOIN c ON c.b_id = b.id"], ["Aliases", "FROM world w"]],
    7: [["Scalar", "WHERE gdp > (SELECT AVG(gdp) FROM world)"], ["IN (…)", "WHERE id IN (SELECT a_id FROM b)"], ["EXISTS", "WHERE EXISTS (SELECT 1 FROM b WHERE b.a_id = a.id)"], ["Correlated", "WHERE x > (SELECT AVG(x) FROM t t2 WHERE t2.g = t.g)"], ["Derived table", "FROM (SELECT …) AS t"]],
    8: [["UNION", "SELECT a FROM t1 UNION SELECT a FROM t2"], ["UNION ALL", "… UNION ALL … (keeps duplicates)"], ["INTERSECT", "SELECT a FROM t1 INTERSECT SELECT a FROM t2"], ["EXCEPT", "SELECT a FROM t1 EXCEPT SELECT a FROM t2"], ["Pivot with CASE", "SUM(CASE WHEN y = 2024 THEN v END)"]],
    9: [["WITH", "WITH big AS (SELECT …) SELECT * FROM big"], ["ROW_NUMBER", "ROW_NUMBER() OVER (ORDER BY gdp DESC)"], ["PARTITION BY", "RANK() OVER (PARTITION BY g ORDER BY v)"], ["Running total", "SUM(v) OVER (ORDER BY d)"], ["LAG / LEAD", "LAG(v) OVER (ORDER BY d)"]],
    10: [["INSERT", "INSERT INTO t (a, b) VALUES (1, 'x')"], ["Several rows", "VALUES (1, 'x'), (2, 'y')"], ["UPDATE", "UPDATE t SET a = a + 1 WHERE id = 3"], ["DELETE", "DELETE FROM t WHERE id = 3"], ["INSERT … SELECT", "INSERT INTO t2 SELECT * FROM t1"]],
    11: [["CREATE TABLE", "CREATE TABLE t (id INT PRIMARY KEY, name VARCHAR(40))"], ["NOT NULL / DEFAULT", "name VARCHAR(40) NOT NULL DEFAULT ''"], ["FOREIGN KEY", "FOREIGN KEY (a_id) REFERENCES a(id)"], ["UNIQUE / CHECK", "UNIQUE (email), CHECK (price > 0)"], ["ALTER TABLE", "ALTER TABLE t ADD COLUMN note TEXT"]],
    12: [["CREATE VIEW", "CREATE VIEW v AS SELECT …"], ["CREATE INDEX", "CREATE INDEX idx_name ON t (name)"], ["DROP INDEX", "DROP INDEX idx_name ON t"], ["EXPLAIN", "EXPLAIN SELECT … WHERE name = 'x'"], ["Sargable", "WHERE d >= '2024-01-01' (not YEAR(d) = 2024)"]],
    13: [["Transaction", "START TRANSACTION; … COMMIT;"], ["ROLLBACK", "… ROLLBACK; (undo it all)"], ["SAVEPOINT", "SAVEPOINT s1; … ROLLBACK TO s1;"], ["Trigger", "CREATE TRIGGER … BEFORE INSERT ON t FOR EACH ROW …"], ["Procedure", "CREATE PROCEDURE p() BEGIN … END"], ["GRANT", "GRANT SELECT ON db.* TO 'user'"]],
    14: [["Plan first", "Name the tables and the grain (one row per what?)"], ["Build up", "FROM → WHERE → GROUP BY → SELECT → ORDER BY"], ["Check counts", "SELECT COUNT(*) after every JOIN"], ["CTEs", "WITH step1 AS (…), step2 AS (…) SELECT …"], ["Verify", "Compare totals with a simpler query"]],
  };
  var TIPS = [
    "Read the exercise twice and name the table(s) and columns it needs before writing anything.",
    "Start with SELECT * FROM table LIMIT 10 to see the data, then narrow it down.",
    "Build the query one clause at a time: FROM, then WHERE, then GROUP BY, then SELECT, then ORDER BY.",
    "Check the row count: does it match what the question implies (one row per country, per author...)?",
    "When a JOIN returns too many rows, a join condition is missing or not unique.",
    "Stuck? Ask for a hint: each one gets more specific, and none of them gives the answer away.",
    "Self-check exercises can't be marked automatically: compare with the expected result and the solution, then mark them done.",
  ];

  // ---------- in-browser SQLite (sql.js), one database per dataset ----------
  var Engine = (function () {
    var ready = typeof initSqlJs === "function" ? initSqlJs().catch(function () { return null; }) : Promise.resolve(null);
    var dbs = {}, sqlCache = {}, schemaCache = {};
    function sqlFor(key) { return sqlCache[key] ? Promise.resolve(sqlCache[key]) : api("/api/library/dataset/" + encodeURIComponent(key)).then(function (r) { sqlCache[key] = r.sql; return r.sql; }); }
    function db(key) {
      return ready.then(function (SQL) {
        if (!SQL) throw new Error("The SQL engine (sql.js) didn't load: check your internet connection and reload.");
        if (dbs[key]) return dbs[key];
        return sqlFor(key).then(function (files) { var d = new SQL.Database(); files.forEach(function (f) { d.run(f); }); dbs[key] = d; return d; });
      });
    }
    function run(key, sql) {
      var t0 = performance.now();
      return db(key).then(function (d) {
        try { var res = d.exec(sql); return { ok: true, results: res, ms: Math.round(performance.now() - t0), changes: d.getRowsModified() }; }
        catch (e) { return { ok: false, error: e.message }; }
      }).catch(function (e) { return { ok: false, error: e.message }; });
    }
    function schema(key) {
      if (schemaCache[key]) return Promise.resolve(schemaCache[key]);
      return db(key).then(function (d) {
        var names = d.exec("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
        var tables = (names[0] ? names[0].values : []).map(function (r) {
          var q = '"' + r[0].replace(/"/g, '""') + '"';
          var cols = d.exec("PRAGMA table_info(" + q + ")"), count = d.exec("SELECT COUNT(*) FROM " + q), fks = d.exec("PRAGMA foreign_key_list(" + q + ")");
          var fk = {}; (fks[0] ? fks[0].values : []).forEach(function (f) { fk[f[3]] = { table: f[2], column: f[4] || "" }; });
          return { name: r[0], rows: count[0] ? count[0].values[0][0] : 0, cols: (cols[0] ? cols[0].values : []).map(function (c) { return { name: c[1], type: c[2] || "", pk: c[5] > 0, fk: fk[c[1]] || null }; }) };
        });
        schemaCache[key] = tables;
        return tables;
      });
    }
    function preview(key, table) {
      return schema(key).then(function (tables) {
        if (!tables.some(function (t) { return t.name === table; })) throw new Error("No such table");
        return db(key).then(function (d) { var r = d.exec('SELECT * FROM "' + table.replace(/"/g, '""') + '" LIMIT 5'); return r[0] ? { columns: r[0].columns, rows: r[0].values } : { columns: [], rows: [] }; });
      });
    }
    function reset(key) { if (dbs[key]) dbs[key].close(); delete dbs[key]; delete schemaCache[key]; }
    // a card's own small tables: a fresh in-memory database for each run, closed afterwards
    function scratch(setup, sql) {
      return ready.then(function (SQL) {
        if (!SQL) throw new Error("The SQL engine (sql.js) didn't load: check your internet connection and reload.");
        var d = new SQL.Database();
        try { d.run(setup); var res = d.exec(sql); return { ok: true, results: res }; }
        catch (e) { return { ok: false, error: e.message }; } finally { d.close(); }
      }).catch(function (e) { return { ok: false, error: e.message }; });
    }
    return { run: run, schema: schema, preview: preview, reset: reset, scratch: scratch, forget: function (k) { delete schemaCache[k]; } };
  })();

  // ---------- SQL helpers ----------
  var KWS = {};
  "SELECT FROM WHERE INSERT INTO VALUES UPDATE SET DELETE CREATE TABLE DROP ALTER ADD COLUMN PRIMARY KEY FOREIGN REFERENCES NOT NULL DEFAULT JOIN INNER LEFT RIGHT FULL OUTER CROSS ON USING GROUP BY ORDER HAVING AND OR AS DISTINCT LIMIT OFFSET IF EXISTS UNIQUE CHECK IN BETWEEN LIKE IS DESC ASC WITH UNION ALL INTERSECT EXCEPT CASE WHEN THEN ELSE END COUNT SUM AVG MIN MAX VIEW INDEX TRIGGER BEGIN COMMIT ROLLBACK TRANSACTION OVER PARTITION ROW_NUMBER RANK DENSE_RANK COALESCE IFNULL CAST ROUND LENGTH UPPER LOWER SUBSTR REPLACE USE PROCEDURE FUNCTION CALL GRANT REVOKE EXPLAIN RECURSIVE".split(" ").forEach(function (k) { KWS[k] = 1; });
  function highlight(raw) {
    return esc(raw).replace(/(--[^\n]*)|('(?:[^']|'')*')|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][A-Za-z0-9_]*\b)/g, function (m, c, s, n, w) {
      if (c) return '<span class="tok-c">' + c + "</span>";
      if (s) return '<span class="tok-s">' + s + "</span>";
      if (n) return '<span class="tok-n">' + n + "</span>";
      if (w && KWS[w.toUpperCase()]) return '<span class="tok-k">' + w + "</span>";
      return m;
    }) + "\n";
  }
  function formatSql(raw) {
    var sql = raw.replace(/\s+/g, " ").trim().replace(/\b([A-Za-z_]+)\b/g, function (w) { return KWS[w.toUpperCase()] ? w.toUpperCase() : w; });
    ["FROM", "WHERE", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "INNER JOIN", "LEFT JOIN", "RIGHT JOIN", "JOIN", "AND", "OR", "UNION ALL", "UNION", "VALUES", "SET"].forEach(function (kw) {
      sql = sql.replace(new RegExp("\\s+(" + kw.replace(/ /g, "\\s+") + ")\\b", "g"), "\n" + kw);
    });
    return sql.replace(/\bSELECT\b\s*/, "SELECT\n  ").replace(/,\s*/g, ",\n  ").split("\n").map(function (l) { return l.replace(/\s+$/, ""); }).filter(Boolean).join("\n").replace(/\n(AND|OR)\b/g, "\n  $1");
  }
  function renderMarkdown(src) {
    function inline(s) { return esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>"); }
    var out = [];
    src.replace(/\r\n/g, "\n").split(/```[a-zA-Z]*\n?/).forEach(function (block, i) {
      if (i % 2) { out.push("<pre><code>" + esc(block.replace(/\n$/, "")) + "</code></pre>"); return; }
      var list = null, table = [];
      function closeList() { if (list) { out.push("</" + list + ">"); list = null; } }
      function closeTable() {
        if (!table.length) return;
        var head = table.length > 1 && /^\|?\s*:?-{2,}/.test(table[1]);
        out.push("<table>" + table.filter(function (l) { return !/^\|?\s*:?-{2,}/.test(l); }).map(function (l, r) {
          var tag = head && !r ? "th" : "td";
          return "<tr>" + l.replace(/^\||\|$/g, "").split("|").map(function (c) { return "<" + tag + ">" + inline(c.trim()) + "</" + tag + ">"; }).join("") + "</tr>";
        }).join("") + "</table>");
        table = [];
      }
      block.split("\n").forEach(function (raw) {
        var line = raw.trim();
        if (line.charAt(0) === "|") { closeList(); table.push(line); return; }
        closeTable();
        var ul = /^[-*]\s+(.*)$/.exec(line), ol = /^\d+[.)]\s+(.*)$/.exec(line), h = /^(#{1,6})\s+(.*)$/.exec(line), q = /^>\s?(.*)$/.exec(line);
        if (ul || ol) { var k = ul ? "ul" : "ol"; if (list !== k) { closeList(); out.push("<" + k + ">"); list = k; } out.push("<li>" + inline((ul || ol)[1]) + "</li>"); }
        else if (!line) closeList();
        else { closeList(); out.push(h ? "<h" + Math.min(6, h[1].length + 2) + ">" + inline(h[2]) + "</h" + Math.min(6, h[1].length + 2) + ">" : q ? "<blockquote>" + inline(q[1]) + "</blockquote>" : "<p>" + inline(line) + "</p>"); }
      });
      closeList();
      closeTable();
    });
    return out.join("");
  }
  // exercise text: prose, indented example SQL as code, and links to other exercises
  function exerciseText(body) {
    return String(body || "").split("\n").map(function (l) {
      if (/^\s{3,}\S/.test(l) && l.indexOf("[[ref:") < 0) return '<span class="code-line">' + highlight(l.replace(/^\s{4}/, "")).replace(/\n$/, "") + "</span>";
      return esc(l).replace(/\[\[ref:(e[0-9a-f]+)\|([^\]]+)\]\]/g, function (m, id, title) { return '<a class="xref" href="#/drill/' + id + '">the exercise “' + title + "”</a>"; });
    }).join("\n").replace(/<\/span>\n<span class="code-line">/g, "\n");
  }

  // ---------- chrome ----------
  var NAV = [
    ["home", "Home", "home"], ["learn", "Learn", "graduation"], ["docs", "Docs", "file"], ["levels", "Levels", "levels"], ["drills", "All Exercises", "db"], ["mcqs", "MCQ Practice", "checkCircle"], ["recent", "Recently Added", "new"],
    ["interview", "Interview Practice", "brief"], ["review", "Review mistakes", "reset"], ["flashcards", "Flashcards", "cards"], ["notes", "My notes", "note"], ["progress", "My Progress", "chart"], ["bookmarks", "Bookmarks", "bookmark"], ["guide", "SQL Guide", "book"], ["help", "How to use", "help"],
  ];
  var route = { name: "home", args: [] };
  var recentCount = 0;
  function renderNav() {
    var bm = Object.keys(S.bookmarks).length;
    $("#nav").innerHTML = NAV.map(function (n) {
      var on = route.name === n[0] || (n[0] === "drills" && route.name === "drill") || (n[0] === "mcqs" && /^(mcq|quiz)$/.test(route.name)) || (n[0] === "levels" && (route.name === "level" || route.name === "concept"));
      var count = n[0] === "bookmarks" ? bm : n[0] === "mcqs" ? S.mcqs.length : n[0] === "recent" ? (recentCount <= 50 ? recentCount : 0) : n[0] === "review" ? ((S.review && S.review.due.length) || 0) : n[0] === "flashcards" ? S.flashDue || 0 : 0;
      return '<a href="#/' + n[0] + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + ">" + icon(n[2]) + "<span>" + n[1] + "</span>" + (count ? '<span class="count">' + count.toLocaleString() + "</span>" : "") + "</a>";
    }).join("");
  }
  function renderChrome() {
    var hb = $("#helpBtn");
    if (hb) { var sec = window.Help && Help.ROUTE_HELP.learner[route.name]; hb.setAttribute("href", "#/help" + (sec ? "?s=" + sec : "")); hb.setAttribute("aria-current", route.name === "help" ? "page" : "false"); }
    renderNav();
    var st = streak(), rk = rankInfo();
    $("#sideStreak").innerHTML =
      '<div class="ss-top"><span class="flame">' + (st.days ? "🔥" : "✨") + "</span><div><strong>" + (st.days ? plural(st.days, "day") + " streak" : "Start a streak") + "</strong><small>" + (st.days ? "Keep it up!" : "Complete an exercise today") + "</small></div></div>" +
      '<div class="ss-bar"><span class="bar"><span style="width:' + rk.pct + '%"></span></span>' + rk.pct + "%</div>" +
      "<p>" + (rk.next ? "Rank: " + esc(rk.name) + ". " + plural(rk.toNext, "more exercise") + " to " + esc(rk.next) + "." : "Top rank: " + esc(rk.name) + "!") + "</p>";
    $("#topStats").innerHTML = "<span>" + icon("levels") + S.levels.length + " levels</span><span>" + icon("db") + S.items.length.toLocaleString() + " exercises</span><span>" + icon("checkCircle") + S.mcqs.length + " MCQs</span>";
  }
  function applyTheme(mode) {
    if (mode === "dark") document.documentElement.setAttribute("data-theme", "dark"); else document.documentElement.removeAttribute("data-theme");
    $("#themeBtn").innerHTML = icon(mode === "dark" ? "sun" : "moon");
  }
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  $("#themeBtn").addEventListener("click", function () {
    var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(next);
    try { localStorage.setItem("sqldrills.theme.v2", next); } catch (e) {}
  });
  var HINT_KEY = "sqldrills.hintProvider.v2";
  S.providers = [];
  function loadProviders() {
    api("/api/hint/providers").then(function (list) { S.providers = list || []; }).catch(function () { S.providers = []; });
  }
  /** Hints use the provider order set in admin (AI & settings): the learner app doesn't choose. */
  function hintProvider() { return "auto"; }

  // ---------- shared components ----------
  function diffHtml(diff) {
    var lvl = DIFF.indexOf(diff) + 1;
    return '<span class="diff ' + diff + '"><span class="dots">' + [1, 2, 3, 4].map(function (i) { return "<i" + (i <= lvl + (lvl === 3 ? 1 : 0) ? ' class="f"' : "") + "></i>"; }).join("") + '</span><span class="lbl">' + DIFF_LABEL[diff] + "</span></span>";
  }
  function statusHtml(d) { var s = statusOf(d); return s === "todo" ? "" : '<span class="pill ' + s + '">' + icon(s === "done" ? "checkCircle" : s === "fail" ? "x" : "clock") + STATUS_LABEL[s] + "</span>"; }
  // records a Check / Submit result; a wrong answer marks the exercise "Failed" until it is solved
  function recordAttempt(d, pass) {
    if (d.kind === "mcq") return;
    if (!pass) d.failed = true;
    api("/api/library/item/" + d.id + "/attempt", { result: pass ? "pass" : "fail", hints: d.hintsUsed || 0 }).then(function (r) { if (r && r.requeued && r.requeued.length) toast("Transfer task missed: " + plural(r.requeued.length, "practise exercise") + " of this concept are back in Review mistakes"); S.learn.levels = {}; S.learn.today = null; viewConcept.stale = true; return loadReview(); }).catch(function () {});
    setTimeout(function () { if (route.name === "drill" && route.args[0] === d.id) reflectBox(d, pass); }, 0);
    // a clean start for the next attempt (a review): hints count per solve
    if (pass) { d.hintsUsed = 0; store("sqldrills.hints." + d.id, ""); }
  }
  function diffBadge(diff) { return '<span class="dbadge ' + diff + '">' + DIFF_LABEL[diff] + "</span>"; }
  // at most two table names; the rest as "+N" (all of them in the tooltip)
  function tablesHtml(d) {
    if (!d.tables || !d.tables.length) return "";
    var shown = d.tables.slice(0, 2).map(esc).join(", "), more = d.tables.length - 2;
    return '<span class="tbls" title="Table' + (d.tables.length > 1 ? "s" : "") + " used: " + esc(d.tables.join(", ")) + '">' + icon("table") + '<span class="names">' + shown + "</span>" + (more > 0 ? ' <span class="more">+' + more + "</span>" : "") + "</span>";
  }
  // compact row: number · title · one-line summary · status (if any) · difficulty · table · bookmark
  function compactRow(d, numLabel) {
    var done = isDone(d), st = statusOf(d);
    return '<div class="crow" data-go="' + href(d) + '">' +
      '<span class="num' + (done ? " done" : "") + '" aria-hidden="true">' + (done ? icon("check") : numLabel || d.seq || d.n) + "</span>" +
      '<div class="cmain"><a class="ctitle" href="' + href(d) + '">' + esc(d.title) + (done ? '<span class="sr-only"> (done)</span>' : "") + "</a>" + (d.desc ? '<div class="csum">' + esc(d.desc) + "</div>" : "") + "</div>" +
      (st === "prog" || st === "fail" ? statusHtml(d) : "") + checkIcon(d) + diffBadge(d.diff) + tablesHtml(d) +
      '<button class="bm' + (S.bookmarks[d.key] ? " on" : "") + '" data-bm="' + d.key + '" aria-pressed="' + !!S.bookmarks[d.key] + '" aria-label="Bookmark ' + esc(d.title) + '">' + icon("bookmark") + "</button>" +
      '<span class="chev" aria-hidden="true">' + icon("chevRight") + "</span></div>";
  }
  // the review list changes with time (items become due): fetched again whenever the dashboard or the Review page shows
  function loadReview() {
    var ids = function (R) { return R ? JSON.stringify([R.due.map(function (e) { return e.id; }), R.upcoming.map(function (e) { return e.id; })]) : ""; }, before = ids(S.review), beforeDue = JSON.stringify(S.review && S.review.due.map(function (e) { return e.id; }));
    return api("/api/library/review").then(function (r) {
      S.review = r; renderNav();
      var changed = JSON.stringify(r.due.map(function (e) { return e.id; })) !== beforeDue;
      if (changed && route.name === "home") viewHome();
      // the review page shows "Coming up" too: a new mistake due tomorrow must appear at once
      if (ids(r) !== before && route.name === "review") viewReviewMistakes();
    }).catch(function () {});
  }
  function href(d) { return d.kind === "mcq" ? "#/mcq/" + d.id : "#/drill/" + d.id; }
  var CHECK_KIND = {
    auto: ["Auto-checked", "Your answer is compared with the reference automatically"],
    self: ["Self-check", "Compare with the model answer yourself, then mark it done"],
    none: ["Not checked", "No reference answer yet: it counts as done once your query runs"],
  };
  function checkKind(d) { return d.kind === "mcq" ? null : d.check === "self" ? "self" : d.check === "run" ? "none" : "auto"; }
  function checkIcon(d) {
    var k = checkKind(d);
    if (!k) return "";
    var t = CHECK_KIND[k];
    return '<span class="ck ck-' + k + '" title="' + t[0] + ": " + t[1] + '"><svg viewBox="0 0 16 16" aria-hidden="true">' +
      (k === "auto" ? '<circle cx="8" cy="8" r="7" class="f"/><path d="m4.8 8.2 2.2 2.2 4.2-4.6" class="m"/>' : k === "self" ? '<circle cx="8" cy="8" r="6.3" class="o"/><path d="M8 1.7a6.3 6.3 0 0 1 0 12.6z" class="h"/>' : '<circle cx="8" cy="8" r="6.3" class="o d"/>') +
      '</svg><span class="sr-only">' + t[0] + "</span></span>";
  }
  function checkLegend() {
    return '<span class="ck-legend" aria-hidden="true">' + ["auto", "self", "none"].map(function (k) { return checkIcon({ check: k === "auto" ? "solution" : k === "self" ? "self" : "run" }).replace(/<span class="sr-only">[^<]*<\/span>/, "") + CHECK_KIND[k][0]; }).join("") + "</span>";
  }
  function checkTag(d) {
    if (d.kind === "mcq") return '<span class="tag plain mcq-tag">Multiple choice</span>';
    if (d.check === "self") return '<span class="tag self-tag" title="Can\'t be checked automatically: compare with the expected result and the solution">' + icon("selfcheck") + "Self-check</span>";
    if (d.check === "run") return '<span class="tag nc-tag" title="No reference answer yet: your result isn\'t compared with anything. It counts as done once your query runs.">Practice · not checked</span>';
    return "";
  }
  // inLevel: on a level page (the header names the level, so the rows don't)
  function row(d, numLabel, inLevel) {
    var done = isDone(d);
    return '<div class="card drow" data-go="' + href(d) + '" role="link" tabindex="0">' +
      '<span class="num' + (done ? " done" : "") + '">' + (done ? icon("check") : numLabel || d.n) + "</span>" +
      '<div class="dmain"><div class="dtitle">' + esc(d.title) + "</div>" + (d.desc ? '<div class="ddesc">' + esc(d.desc) + "</div>" : "") +
      '<div class="dmeta">' + checkIcon(d) + (inLevel ? "" : '<span class="tag">' + esc(levelName(d.level)) + "</span>") + (d.kind === "mcq" ? checkTag(d) : "") + (d.kind !== "mcq" ? tablesHtml(d) : "") +
      '<button class="bm' + (S.bookmarks[d.key] ? " on" : "") + '" data-bm="' + d.key + '" aria-pressed="' + !!S.bookmarks[d.key] + '" aria-label="Bookmark ' + esc(d.title) + '">' + icon("bookmark") + "</button></div></div>" +
      diffBadge(d.diff) + statusHtml(d) + '<span class="chev" aria-hidden="true">' + icon("chevRight") + "</span></div>";
  }
  function card(d) {
    return '<div class="card dcard" data-go="' + href(d) + '" role="link" tabindex="0">' +
      '<div class="row"><span class="num' + (isDone(d) ? " done" : "") + '">' + (isDone(d) ? icon("check") : d.n) + "</span>" + statusHtml(d) + checkIcon(d) + "</div>" +
      '<div class="dtitle">' + esc(d.title) + "</div>" + (d.desc ? '<div class="ddesc">' + esc(d.desc) + "</div>" : "") +
      '<div class="dmeta"><span class="tag">' + esc(levelName(d.level)) + "</span>" + checkTag(d) + "</div>" +
      '<div class="row">' + diffBadge(d.diff) + tablesHtml(d) + '<button class="bm' + (S.bookmarks[d.key] ? " on" : "") + '" data-bm="' + d.key + '" aria-label="Bookmark">' + icon("bookmark") + "</button></div></div>";
  }
  function ring(value, size, stroke, big, sub) {
    var r = (size - stroke) / 2, c = 2 * Math.PI * r, p = Math.max(0, Math.min(1, value));
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(big + " " + (sub || "")) + '">' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--soft)" stroke-width="' + stroke + '"/>' +
      '<circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--accent)" stroke-width="' + stroke + '" stroke-linecap="round" stroke-dasharray="' + c * p + " " + c + '" transform="rotate(-90 ' + size / 2 + " " + size / 2 + ')"/>' +
      '<text x="50%" y="' + (sub ? "46%" : "50%") + '" text-anchor="middle" dominant-baseline="central" class="ring-txt" font-size="' + Math.round(size / 4.6) + '">' + esc(big) + "</text>" +
      (sub ? '<text x="50%" y="66%" text-anchor="middle" class="ring-sub">' + esc(sub) + "</text>" : "") + "</svg>";
  }
  function statCard(color, ic, label, value, sub, link, progress) {
    return '<a class="card stat" href="' + link + '"><span class="ic ' + color + '">' + icon(ic) + '</span><div class="s-body"><div class="s-l">' + label + '</div><div class="s-v">' + value + "</div>" +
      (progress != null ? '<div class="s-bar"><span class="bar green"><span style="width:' + progress + '%"></span></span>' + progress + "%</div>" : "") +
      (sub ? '<div class="s-sub">' + esc(sub) + "</div>" : "") + '</div><span class="go">' + icon("chevRight") + "</span></a>";
  }
  // optional (Settings, off by default): a level opens once 70% of the previous one is done
  function lockOn() { return store("sqldrills.lockLevels") === "1"; }
  function lockedLevel(n) {
    if (!lockOn() || n <= 1) return false;
    var prev = itemsIn(n - 1);
    return prev.length > 0 && prev.filter(isDone).length / prev.length < 0.7;
  }
  function levelPath() {
    var cur = currentLevel();
    var nodes = S.levels.map(function (L) {
      var list = itemsIn(L.n), done = list.filter(isDone).length, sp = levelSplit(list), p = pct(done, list.length), isCur = L.n === cur, lock = lockedLevel(L.n), full = levelIsComplete(L.n, list, done);
      var bar = ["easy", "medium", "hard"].map(function (k) { return sp[k] ? '<span class="' + k + '" style="flex:' + sp[k] + '" title="' + sp[k] + " " + k + '"></span>' : ""; }).join("");
      var label = "Level " + L.n + ", " + L.title + ", " + p + "% done (" + sp.easy + " easy, " + sp.medium + " medium, " + sp.hard + " hard)" + (isCur ? ", current level" : "") + (lock ? ", locked until 70% of level " + (L.n - 1) + " is done" : "");
      var secs = L.sections ? '<span class="lp-secs">' + L.sections.map(function (s) { return '<a href="#/level/' + L.n + "?section=" + s.key + '" class="lp-sec">' + esc(s.title) + " <b>" + list.filter(function (i) { return i.section === s.key; }).length + "</b></a>"; }).join("") + "</span>" : "";
      return '<li class="lp-step' + (isCur ? " current" : "") + (full ? " complete" : "") + (lock ? " locked" : "") + '">' +
        '<a class="lp-node" href="#/level/' + L.n + '"' + (lock ? ' data-locked="' + L.n + '" aria-disabled="true"' : "") + ' aria-label="' + esc(label) + '"' + (isCur ? ' aria-current="step"' : "") + ">" +
        '<span class="lp-num" aria-hidden="true">' + (lock ? icon("lock") : full ? icon("check") : L.n) + "</span>" +
        '<span class="lp-body" aria-hidden="true"><span class="lp-name">' + esc(L.title) + '</span><span class="lp-pct">' + p + "% done</span>" +
        '<span class="lp-bar">' + bar + "</span>" + (isCur ? '<span class="lp-cur">Current</span>' : "") + "</span></a>" + secs + "</li>";
    }).join("");
    return '<section class="lpath card" aria-labelledby="lpath-h"><div class="card-h"><h2 id="lpath-h">' + icon("levels") + 'Your level path</h2><a class="more link" href="#/levels">All levels ' + icon("chevRight") + '</a></div><ol class="lp-track">' + nodes + "</ol></section>";
  }
  function progressStrip() {
    var lv = currentLevel(), L = levelOf(lv), list = itemsIn(lv), done = list.filter(isDone).length, st = streak(), goal = dailyGoal();
    return '<section class="pstrip card" aria-label="Your progress"><p><a href="#/level/' + lv + '"><b>Level ' + lv + " · " + esc(L.title) + "</b></a> — " +
      '<span class="mono">' + done + "</span> of " + list.length + " done · Streak " + plural(st.days, "day") + ' · Today <span class="mono">' + Math.min(st.today, 99) + "/" + goal + "</span></p>" +
      '<span class="bar" role="progressbar" aria-label="Level ' + lv + ' progress" aria-valuemin="0" aria-valuemax="' + list.length + '" aria-valuenow="' + done + '"><span style="width:' + pct(done, list.length) + '%"></span></span></section>';
  }
  /** The level-complete rule (same as library/learn-rules.js): 80% of concepts mastered, or every exercise done + the level quiz passed. */
  function levelIsComplete(n, list, done) {
    var LL = S.learn && S.learn.levels[n];
    if (LL && LL.complete && LL.complete.complete) return true;
    return !!list.length && done === list.length && (!mcqsIn([n]).length || !!(S.quizPassed && S.quizPassed[n]));
  }
  function levelSplit(list) { var d = { easy: 0, medium: 0, hard: 0 }; list.forEach(function (i) { d[i.diff]++; }); return d; }
  function levelCard(L) {
    var list = itemsIn(L.n), done = list.filter(isDone).length, cur = currentLevel() === L.n, sp = levelSplit(list);
    return '<a class="card level-card' + (cur ? " current" : "") + (levelIsComplete(L.n, list, done) ? " complete" : "") + '" href="#/level/' + L.n + '">' +
      '<div class="lc-top"><span class="lc-n">' + (levelIsComplete(L.n, list, done) ? icon("check") : L.n) + '</span><div><h3>' + esc(L.title) + "</h3>" + (cur ? '<span class="pill prog">Current level</span>' : "") + "</div></div>" +
      '<p class="muted small">' + esc(L.blurb) + "</p>" +
      '<div class="lc-split"><span class="e">' + sp.easy + ' easy</span><span class="m">' + sp.medium + ' medium</span><span class="h">' + sp.hard + " hard</span></div>" +
      (L.sections ? '<div class="lc-sections">' + L.sections.map(function (s) { return "<span>" + esc(s.title) + " · " + list.filter(function (i) { return i.section === s.key; }).length + "</span>"; }).join("") + "</div>" : "") +
      '<div class="tc-row"><span class="bar"><span style="width:' + pct(done, list.length) + '%"></span></span>' + done + "/" + list.length + "</div></a>";
  }

  // ---------- right rail ----------
  function rail() {
    var d = nextItem(), st = streak(), goal = dailyGoal(), lvNow = d ? d.level : currentLevel(), concept = conceptOfDay(lvNow);
    var html = "";
    if (d) {
      var list = itemsIn(d.level), done = list.filter(isDone).length;
      html += '<section class="card card-pad continue"><div class="card-h"><h3>' + icon("graduation") + 'Continue Learning</h3><a class="more" href="' + href(d) + '" aria-label="Continue">' + icon("chevRight") + "</a></div>" +
        '<div class="cl-item"><span class="ic">' + icon("file") + "</span><div><strong>" + esc(d.title) + "</strong><small>" + esc(levelName(d.level)) + " · " + d.seq + " of " + list.length + "</small></div></div>" +
        '<div class="cl-bar"><span class="bar"><span style="width:' + pct(done, list.length) + '%"></span></span>' + pct(done, list.length) + "%</div>" +
        '<a class="btn" href="' + href(d) + '">Continue ' + icon("chevRight") + "</a></section>";
    }
    html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("target") + 'Daily Goal</h3><button class="more link" data-act="set-goal" title="Change the daily goal">' + icon("chevRight") + "</button></div>" +
      '<div class="goal">' + ring(st.today / goal, 104, 10, Math.min(st.today, 99) + "/" + goal, "done") + "<div><p>" +
      (st.today >= goal ? "Goal reached today. Great work!" : "Do " + plural(goal, "activity").replace("activitys", "activities") + " today (exercises, flashcards, predictions, reflections) to keep your streak alive!") + '</p><a class="btn primary" href="#/progress">View Progress</a></div></div></section>';
    html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("bulb") + 'SQL Concept of the Day</h3><a class="more" href="#/guide/commands/' + concept.id + '">' + icon("chevRight") + "</a></div>" +
      '<div class="concept"><h4>' + esc(concept.name) + "</h4><p>" + esc(concept.text) + '</p><a class="btn sm ghost-accent" href="#/guide/commands/' + concept.id + '">Read More ' + icon("chevRight") + "</a></div></section>";
    var cheat = CHEATS[lvNow] || [];
    if (cheat.length) html += '<section class="card card-pad cheat" aria-labelledby="cheat-h"><div class="card-h"><h3 id="cheat-h">' + icon("file") + "Level " + lvNow + ' cheat sheet</h3></div><dl class="cheat-list">' +
      cheat.map(function (c) { return "<div><dt>" + esc(c[0]) + '</dt><dd><code>' + esc(c[1]) + "</code></dd></div>"; }).join("") + "</dl></section>";
    html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("link") + 'Quick Links</h3></div><div class="qlinks">' +
      '<a href="#/guide/commands">' + icon("file") + 'Common SQL Commands<span class="go">' + icon("chevRight") + "</span></a>" +
      '<a href="#/guide/tips">' + icon("tips") + 'Practice Tips<span class="go">' + icon("chevRight") + "</span></a></div></section>";
    return '<aside class="rail">' + html + "</aside>";
  }

  // ---------- views ----------
  var view = $("#view");

  function viewHome() {
    var done = doneCount(), total = S.items.length, st = streak(), started = S.items.filter(isStarted).length, lv = currentLevel();
    var html = '<div class="page"><div class="col">';
    html += '<div><div class="eyebrow">Welcome back</div><div class="hero"><div><h1>Your SQL dashboard</h1><p>One path from SELECT basics to capstone projects: ' + S.levels.length + " levels, " + total.toLocaleString() + " exercises, easiest first.</p></div></div></div>";
    html += levelPath() + progressStrip();
    var due = (S.review && S.review.due.length) || 0;
    if (due) html += '<a class="card review-due" href="#/review">' + icon("reset") + "<span><b>Review due: " + due + "</b> " + (due === 1 ? "exercise" : "exercises") + " you got wrong or solved with a hint " + (due === 1 ? "is" : "are") + ' ready for another try.</span><span class="go">' + icon("chevRight") + "</span></a>";
    html += todayHtml(lv);
    var cont = nextItem(), lvl = itemsIn(cont ? cont.level : lv), from = cont ? lvl.indexOf(cont) + 1 : 0;
    var up = [];
    if (up.length) html += '<section aria-labelledby="upnext-h"><div class="card-h"><h3 id="upnext-h">' + icon("play") + "Up next in " + esc(levelName(cont ? cont.level : lv)) + '</h3><a class="more link" href="#/level/' + (cont ? cont.level : lv) + '">Open level ' + icon("chevRight") + '</a></div><div class="legend-row">' + checkLegend() + '</div><div class="clist card">' + up.map(function (d) { return compactRow(d); }).join("") + "</div></section>";
    html += quizPicker();
    if (!viewHome.busy) { viewHome.busy = true; setTimeout(function () { loadReview().then(function () { viewHome.busy = false; }); }, 0); }
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }

  function viewLevels() {
    var html = '<div class="page"><div class="col"><div><div class="eyebrow">Levels</div><div class="hero"><div><h1>Your path, level by level</h1><p>Every exercise sits in one level, ordered from easy to hard, with any exercise it builds on placed first. Finish a level and the next one becomes your current level.</p></div></div></div>';
    html += '<div class="levels-grid">' + S.levels.map(levelCard).join("") + "</div>";
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }

  function viewLevel(n) {
    n = Number(n);
    var L = levelOf(n);
    if (!L) { location.hash = "#/levels"; return; }
    if (lockedLevel(n)) {
      var prev = itemsIn(n - 1), pd = prev.filter(isDone).length;
      view.innerHTML = '<div class="page"><div class="col"><div class="crumbs"><a href="#/levels">Levels</a>' + icon("chevRight") + "<span>Level " + n + '</span></div><section class="card card-pad locked-level">' + icon("lock") + "<div><h1>Level " + n + " · " + esc(L.title) + ' is locked</h1><p class="muted">It opens when 70% of Level ' + (n - 1) + " is done: you have " + pd + " of " + prev.length + " (" + pct(pd, prev.length) + '%). You can turn level locks off in Settings.</p><a class="btn primary" href="#/level/' + (n - 1) + '">Go to Level ' + (n - 1) + "</a></div></section></div>" + rail() + "</div>";
      return;
    }
    var list = itemsIn(n), done = list.filter(isDone).length, sp = levelSplit(list), quiz = mcqsIn([n]), tab = route.tab || "ex";
    var f = S.levelFilter || (S.levelFilter = { diff: "all", section: "all", page: 0 });
    if (f.n !== n) { f.n = n; f.diff = "all"; f.section = "all"; f.page = 0; }
    var qs = route.q && route.q.get("section");
    if (qs && L.sections && L.sections.some(function (s) { return s.key === qs; }) && f.fromLink !== qs + n) { f.section = qs; f.page = 0; f.fromLink = qs + n; }
    var html = '<div class="page"><div class="col"><div class="crumbs"><a href="#/levels">Levels</a>' + icon("chevRight") + "<span>Level " + n + "</span></div>";
    html += '<div class="level-head card card-pad">' + ring(list.length ? done / list.length : 0, 96, 10, pct(done, list.length) + "%") +
      '<div><div class="eyebrow">Level ' + n + " of " + S.levels.length + "</div><h1>" + esc(L.title) + '</h1><p class="muted">' + esc(L.blurb) + '</p><div class="lc-split"><span class="e">' + sp.easy + ' easy</span><span class="m">' + sp.medium + ' medium</span><span class="h">' + sp.hard + " hard</span></div>" + levelSummary(list) + "</div>" +
      '<div class="acts">' + (list.filter(function (i) { return !isDone(i); })[0] ? '<a class="btn primary" href="' + href(list.filter(function (i) { return !isDone(i); })[0]) + '">' + icon("play") + (done ? "Continue" : "Start") + "</a>" : "") + (n > 1 ? '<a class="btn" href="#/level/' + (n - 1) + '">' + icon("chevLeft") + "</a>" : "") + (n < S.levels.length ? '<a class="btn" href="#/level/' + (n + 1) + '">' + icon("chevRight") + "</a>" : "") + "</div></div>";
    html += levelComplete(n, list, done, quiz) || '<div id="lvComplete"></div>';
    html += levelConceptsHtml(n);
    html += '<div class="tabs"><button data-ltab="ex" class="' + (tab === "ex" ? "on" : "") + '">' + icon("list") + "Exercises (" + list.length + ")</button>" + (quiz.length ? '<button data-ltab="quiz" class="' + (tab === "quiz" ? "on" : "") + '">' + icon("checkCircle") + "Multiple choice (" + quiz.length + ")</button>" : "") + "</div>";
    if (tab === "quiz") {
      html += '<section class="card card-pad quiz-intro"><div><h3>Test yourself on ' + esc(L.title) + '</h3><p class="muted">' + plural(quiz.length, "multiple-choice question") + " · " + quiz.filter(isDone).length + ' answered correctly. A quiz picks up to 10.</p></div><a class="btn primary" href="#/quiz/level-' + n + '">' + icon("play") + "Start quiz</a></section>";
      html += '<div class="dlist">' + quiz.map(function (m) { return row(m); }).join("") + "</div>";
    } else {
      var inSection = L.sections && f.section !== "all" ? list.filter(function (i) { return i.section === f.section; }) : list;
      var shownAll = f.diff === "all" ? inSection : inSection.filter(function (i) { return i.diff === f.diff; });
      if (f.hideSelf) shownAll = shownAll.filter(function (i) { return i.check !== "self"; });
      if (f.notDone) shownAll = shownAll.filter(function (i) { return !isDone(i); });
      if (L.sections) {
        html += '<div class="f-chips section-chips"><button class="chip' + (f.section === "all" ? " on" : "") + '" data-lsection="all">All sections</button>' +
          L.sections.map(function (s) { return '<button class="chip' + (f.section === s.key ? " on" : "") + '" data-lsection="' + s.key + '">' + esc(s.title) + " (" + list.filter(function (i) { return i.section === s.key; }).length + ")</button>"; }).join("") + "</div>";
        sp = levelSplit(inSection);
      }
      var size = 25, pages = Math.max(1, Math.ceil(shownAll.length / size));
      if (f.page >= pages) f.page = pages - 1;
      html += '<div class="f-chips">' + ["all"].concat(DIFF).map(function (d) { return '<button class="chip' + (d !== "all" ? " " + d : "") + (f.diff === d ? " on" : "") + '" data-ldiff="' + d + '">' + (d === "all" ? "All (" + inSection.length + ")" : DIFF_LABEL[d] + " (" + sp[d] + ")") + "</button>"; }).join("") +
        '<span class="chip-sep" aria-hidden="true"></span><button class="chip tog' + (f.hideSelf ? " on" : "") + '" data-ltoggle="hideSelf" aria-pressed="' + !!f.hideSelf + '">Hide self-check</button><button class="chip tog' + (f.notDone ? " on" : "") + '" data-ltoggle="notDone" aria-pressed="' + !!f.notDone + '">Only not done</button></div>' +
        (!shownAll.length ? '<div class="card empty">' + icon("check") + "<div><p>Nothing left with these filters" + (f.notDone ? ": every exercise here is done." : ".") + '</p><button type="button" class="btn sm" data-lclear>Show all exercises</button></div></div>' : "");
      var lastSection = null;
      html += '<div class="legend-row">' + checkLegend() + "</div>";
      html += '<div class="dlist">' + shownAll.slice(f.page * size, f.page * size + size).map(function (d) {
        var head = "";
        if (L.sections && d.section !== lastSection) {
          lastSection = d.section;
          var sec = L.sections.filter(function (s) { return s.key === d.section; })[0];
          if (sec) head = '<div class="section-head"><h3>' + esc(sec.title) + '</h3><p class="muted small">' + esc(sec.blurb) + "</p></div>";
        }
        return head + row(d, d.seq, true);
      }).join("") + "</div>";
      if (pages > 1) html += '<div class="pager">' + '<button data-lpage="' + (f.page - 1) + '"' + (f.page <= 0 ? " disabled" : "") + ">" + icon("chevLeft") + "</button>" +
        Array.from({ length: pages }, function (_, i) { return '<button data-lpage="' + i + '" class="' + (i === f.page ? "on" : "") + '">' + (i + 1) + "</button>"; }).join("") +
        '<button data-lpage="' + (f.page + 1) + '"' + (f.page >= pages - 1 ? " disabled" : "") + ">" + icon("chevRight") + '</button><span class="info">' + (f.page * size + 1) + "–" + Math.min(shownAll.length, (f.page + 1) * size) + " of " + shownAll.length + "</span></div>";
      if (quiz.length) html += '<section class="card card-pad quiz-intro level-quiz" aria-labelledby="lq-h"><div><h3 id="lq-h">' + icon("checkCircle") + "Level quiz</h3>" +
        '<p class="muted">' + Math.min(10, quiz.length) + " multiple-choice questions from Level " + n + (quiz.length < 10 ? " (all of this level's questions)" : "") + ". Score 70% or more to pass" + (S.quizPassed && S.quizPassed[n] ? '. <b class="ok-txt">Passed ✓</b>' : ".") + '</p></div><a class="btn primary" href="#/quiz/level-' + n + '">' + icon("play") + (S.quizPassed && S.quizPassed[n] ? "Take it again" : "Start the level quiz") + "</a></section>";
    }
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }
  function levelSummary(list) {
    var done = list.filter(isDone).length;
    return '<div class="lv-sum" aria-label="Progress in this level"><span><b class="mono">' + done + "</b> / " + list.length + " done</span>" +
      DIFF.map(function (k) { var all = list.filter(function (i) { return i.diff === k; }), dk = all.filter(isDone).length; return all.length ? '<span class="lv-d ' + k + '">' + DIFF_LABEL[k] + ' <b class="mono">' + dk + "</b>/" + all.length + "</span>" : ""; }).join("") + "</div>";
  }
  // a level counts as complete at 80% of its concepts mastered, or with every exercise done and the level quiz passed
  // (a level without multiple-choice questions has no quiz: every exercise done is enough)
  function levelComplete(n, list, done, quiz) {
    if (!list.length) return "";
    var allDone = done === list.length && (!quiz.length || !!(S.quizPassed && S.quizPassed[n]));
    var LL = S.learn && S.learn.levels[n], viaConcepts = !allDone && LL && LL.complete && LL.complete.via === "concepts";
    if (!allDone && !viaConcepts) return "";
    var next = levelOf(n + 1);
    return '<section class="card level-complete" id="lvComplete" role="status" aria-labelledby="lc-h">' + icon("trophy") + '<div><h2 id="lc-h">Level ' + n + " complete</h2><p>" + (allDone ? "You finished all " + list.length + " exercises" + (quiz.length ? " and passed the level quiz." : ".") : "You mastered " + LL.masteredCount + " of " + LL.total + " concepts (80% or more).") + "</p>" +
      (next ? '<a class="btn primary" href="#/level/' + next.n + '">Go to Level ' + next.n + " · " + esc(next.title) + " " + icon("chevRight") + "</a>" : '<p class="muted">That was the last level. Congratulations!</p>') + "</div></section>";
  }

  // --- review mistakes: what you failed or solved with a hint comes back after 1, 3 and 7 days
  function viewReviewMistakes() {
    var R = S.review || { due: [], upcoming: [] }, days = R.days || [1, 3, 7];
    var rowOf = function (e, isDue) {
      var d = S.byId[e.id];
      if (!d && e.qc) return '<a class="crow rv-qc" href="' + esc(e.qc.href) + '"><div class="cmain"><span class="rv-meta">Review ' + e.stage + " of " + e.of + " · quick check from Learn · " + esc(e.reason) + " · " + (isDue ? "due now" : "due " + new Date(e.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })) + '</span><span class="ctitle">' + esc(e.qc.title) + '</span></div><span class="chev" aria-hidden="true">' + icon("chevRight") + "</span></a>";
      if (!d) return "";
      var when = isDue ? "due now" : "due " + new Date(e.due_at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
      return compactRow(d).replace('<div class="cmain">', '<div class="cmain"><span class="rv-meta">Review ' + e.stage + " of " + e.of + " · " + esc(e.reason) + " · " + when + "</span>");
    };
    var html = '<div class="page"><div class="col"><div><div class="eyebrow">Review mistakes</div><div class="hero"><div><h1>Review mistakes</h1><p>Exercises you got wrong, or solved with a hint, come back after ' + days.join(", ").replace(/, (\d+)$/, " and $1") + " days. Solve one without a hint when it is due to move it on; the clean solve at the " + days[days.length - 1] + "-day review takes it off this list.</p></div></div></div>";
    html += '<section aria-labelledby="rv-due"><div class="card-h"><h3 id="rv-due">' + icon("reset") + "Due now <span class=\"mono muted\">" + R.due.length + "</span></h3></div>" +
      (R.due.length ? '<div class="clist card">' + R.due.map(function (e) { return rowOf(e, true); }).join("") + "</div>" : '<div class="card empty">' + icon("check") + "<div><p>Nothing to review right now." + (R.upcoming.length ? " The next one is due " + new Date(R.upcoming[0].due_at).toLocaleDateString(undefined, { day: "numeric", month: "long" }) + "." : " Exercises you get wrong, or solve with a hint, appear here.") + '</p><a class="btn sm" href="#/home">Practise from today\'s plan ' + icon("chevRight") + "</a></div></div>") + "</section>";
    if (R.upcoming.length) html += '<section aria-labelledby="rv-up"><div class="card-h"><h3 id="rv-up">' + icon("clock") + "Coming up <span class=\"mono muted\">" + R.upcoming.length + '</span></h3></div><div class="clist card">' + R.upcoming.map(function (e) { return rowOf(e, false); }).join("") + "</div></section>";
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
    if (!viewReviewMistakes.busy) { viewReviewMistakes.busy = true; loadReview().then(function () { viewReviewMistakes.busy = false; }); }
  }

  // --- the full list (All Exercises / MCQ Practice / Interview)
  function applyFilters(list, f) {
    var q = (f.q || "").trim().toLowerCase();
    return list.filter(function (d) {
      return (f.diff === "all" || d.diff === f.diff) && (f.level === "all" || d.level === Number(f.level)) && (f.status === "all" || statusOf(d) === f.status) &&
        (f.check === "all" || (f.check === "self" ? d.check === "self" : d.check !== "self")) && (!q || d.hay.indexOf(q) > -1);
    });
  }
  function sortList(list, sort) {
    var l = list.slice(), byPath = function (a, b) { return a.level - b.level || (a.seq || a.n) - (b.seq || b.n); };
    if (sort === "path") l.sort(byPath);
    if (sort === "easy") l.sort(function (a, b) { return DIFF.indexOf(a.diff) - DIFF.indexOf(b.diff) || byPath(a, b); });
    if (sort === "hard") l.sort(function (a, b) { return DIFF.indexOf(b.diff) - DIFF.indexOf(a.diff) || byPath(a, b); });
    if (sort === "todo") l.sort(function (a, b) { return (isDone(a) ? 1 : 0) - (isDone(b) ? 1 : 0) || byPath(a, b); });
    if (sort === "new") l.sort(function (a, b) { return (a.added_at < b.added_at ? 1 : a.added_at > b.added_at ? -1 : 0) || byPath(a, b); });
    return l;
  }
  function viewList(opts) {
    opts = opts || {};
    var f = S.filters;
    var qs = new URLSearchParams((location.hash.split("?")[1]) || "");
    ["diff", "level", "status", "check"].forEach(function (k) { if (qs.get(k)) { f[k] = qs.get(k); f.page = 0; } });
    if (qs.toString()) history.replaceState(null, "", "#/" + route.name);
    var base = opts.base || S.items;
    var list = sortList(applyFilters(base, f), f.sort);
    var pages = Math.max(1, Math.ceil(list.length / f.size));
    if (f.page >= pages) f.page = pages - 1;
    var shown = list.slice(f.page * f.size, f.page * f.size + f.size);
    var noun = opts.mcq ? "questions" : "exercises";
    var html = '<div class="page"><div class="col">';
    html += '<div class="hero"><div><div class="eyebrow">' + esc(opts.eyebrow || "All Exercises") + "</div><h1>" + esc(opts.title || "Practice SQL Like a Pro") + "</h1><p>" + esc(opts.sub || "") + "</p></div>" + (opts.stats || "") + "</div>";
    if (opts.top) html += opts.top;
    var levelsHere = S.levels.filter(function (L) { return base.some(function (d) { return d.level === L.n; }); });
    html += '<section class="card filters"><div class="f-group"><div class="f-label">' + icon("gauge") + 'Difficulty</div><div class="f-chips">' +
      chip("diff", "all", "All", f.diff) + chip("diff", "easy", "Easy", f.diff, "easy") + chip("diff", "medium", "Medium", f.diff, "medium") + chip("diff", "hard", "Hard", f.diff, "hard") + "</div></div>" +
      '<div class="f-group"><div class="f-label">' + icon("checkCircle") + 'Status</div><div class="f-chips">' + chip("status", "all", "All", f.status) + chip("status", "done", opts.mcq ? "Answered correctly" : "Completed", f.status) + chip("status", "prog", opts.mcq ? "Got wrong" : "In Progress", f.status) + chip("status", "todo", "Not started", f.status) +
      (opts.mcq ? "" : chip("check", "all", "Any check", f.check) + chip("check", "auto", "Auto-checked", f.check) + chip("check", "self", "Self-check", f.check)) + "</div></div>" +
      '<div class="f-group f-wide"><div class="f-label">' + icon("levels") + 'Level</div><div class="f-chips">' + chip("level", "all", "All levels", String(f.level)) +
      levelsHere.map(function (L) { return chip("level", String(L.n), L.n + " · " + L.title, String(f.level)); }).join("") + "</div></div></section>";
    html += '<div class="listbar"><label class="search-inline">' + icon("search") + '<input data-act="filter-q" value="' + esc(f.q) + '" placeholder="Search ' + noun + '…" aria-label="Filter"></label>' +
      '<label class="sortsel">Sort by <select data-act="sort">' + [["path", "Level order"], ["todo", "Not done first"], ["easy", "Easiest first"], ["hard", "Hardest first"], ["new", "Newest first"]].map(function (o) { return '<option value="' + o[0] + '"' + (f.sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></label>" +
      '<div class="viewtog"><button class="' + (f.view === "list" ? "on" : "") + '" data-act="view" data-v="list" aria-label="List view">' + icon("list") + '</button><button class="' + (f.view === "grid" ? "on" : "") + '" data-act="view" data-v="grid" aria-label="Grid view">' + icon("grid") + "</button></div></div>";
    if (!shown.length) html += '<div class="card empty">' + icon("search") + "<div>Nothing matches these filters.</div><p><button class=\"btn\" data-act=\"clear-filters\">Clear filters</button></p></div>";
    else html += (opts.mcq ? "" : '<div class="legend-row">' + checkLegend() + "</div>") + (f.view === "grid" ? '<div class="dgrid">' + shown.map(card).join("") + "</div>" : '<div class="dlist">' + shown.map(function (d) { return row(d); }).join("") + "</div>");
    html += pager(f.page, pages, list.length, f.size, noun);
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
    S.lastList = list;
  }
  function chip(group, value, label, current, extra) {
    return '<button class="chip' + (extra ? " " + extra : "") + (String(current) === value ? " on" : "") + '" data-filter="' + group + '" data-value="' + value + '">' + (extra === "medium" ? "◆ " : extra === "hard" ? "★ " : "") + esc(label) + "</button>";
  }
  function pager(page, pages, total, size, noun) {
    var out = '<div class="pager"><button data-page="' + (page - 1) + '"' + (page <= 0 ? " disabled" : "") + ' aria-label="Previous page">' + icon("chevLeft") + "</button>";
    var nums = [];
    for (var i = 0; i < pages; i++) if (i < 1 || i >= pages - 1 || Math.abs(i - page) <= 2) nums.push(i); else if (nums[nums.length - 1] !== -1) nums.push(-1);
    nums.forEach(function (i) { out += i < 0 ? "<button disabled>…</button>" : '<button data-page="' + i + '" class="' + (i === page ? "on" : "") + '">' + (i + 1) + "</button>"; });
    out += '<button data-page="' + (page + 1) + '"' + (page >= pages - 1 ? " disabled" : "") + ' aria-label="Next page">' + icon("chevRight") + "</button>";
    out += '<span class="info">Showing ' + (total ? page * size + 1 : 0) + "–" + Math.min(total, (page + 1) * size) + " of " + total.toLocaleString() + " " + noun + '</span><select data-act="size" aria-label="Per page">' +
      [10, 25, 50, 100].map(function (n) { return '<option value="' + n + '"' + (n === size ? " selected" : "") + ">" + n + " / page</option>"; }).join("") + "</select></div>";
    return out;
  }
  function saveFilters() {
    if (route.name === "mcqs") { S.mf = S.filters; store("sqldrills.mcqFilters.v3", S.filters); }
    else { S.df = S.filters; store("sqldrills.filters.v3", S.filters); }
  }
  function viewDrills() {
    var done = doneCount(), st = streak(), rk = rankInfo(), self = S.items.filter(function (i) { return i.check === "self"; }).length;
    viewList({
      eyebrow: "All Exercises", title: "Practice SQL Like a Pro",
      sub: S.items.length.toLocaleString() + " exercises in " + S.levels.length + " levels. Most are checked automatically; " + self + " are Self-check, with the solution to compare against.",
      stats: '<div class="stat-row">' +
        '<a class="card stat" href="#/progress"><span class="ic green">' + icon("check") + '</span><div class="s-body"><div class="s-l">Completed</div><div class="s-v">' + done + " <small>/ " + S.items.length.toLocaleString() + '</small></div><div class="s-bar"><span class="bar green"><span style="width:' + pct(done, S.items.length) + '%"></span></span>' + pct(done, S.items.length) + "%</div></div></a>" +
        '<a class="card stat" href="#/progress"><span class="ic orange">' + icon("flame") + '</span><div class="s-body"><div class="s-l">Current Streak</div><div class="s-v">' + plural(st.days, "day") + '</div><div class="s-sub">' + (st.days ? "Keep going!" : "Do one today") + "</div></div></a>" +
        '<a class="card stat" href="#/progress"><span class="ic blue">' + icon("trophy") + '</span><div class="s-body"><div class="s-l">Rank</div><div class="s-v" style="font-size:20px">' + esc(rk.name) + '</div><div class="s-sub">' + (rk.next ? rk.toNext + " to " + esc(rk.next) : "top rank") + "</div></div></a></div>",
    });
  }
  function viewInterview() {
    var base = S.items.filter(function (d) { return d.diff !== "easy" && d.check !== "self" && [5, 6, 7, 8, 9].indexOf(d.level) > -1; });
    viewList({ base: base, eyebrow: "Interview Practice", title: "Interview-style exercises", sub: "The medium and hard, auto-checked exercises on what SQL interviews focus on: aggregation, joins, subqueries, set operators and window functions. Try each without hints first." });
  }
  function viewMcqs() {
    var right = S.mcqs.filter(isDone).length, wrong = S.mcqs.filter(isStarted).length;
    viewList({
      base: S.mcqs, mcq: true, eyebrow: "MCQ Practice", title: "Multiple-choice questions",
      sub: S.mcqs.length + " questions across the levels, each with an explanation. Answer them one by one, or take a 10-question quiz.",
      stats: '<div class="stat-row"><div class="card stat"><span class="ic green">' + icon("check") + '</span><div class="s-body"><div class="s-l">Answered correctly</div><div class="s-v">' + right + " <small>/ " + S.mcqs.length + '</small></div><div class="s-bar"><span class="bar green"><span style="width:' + pct(right, S.mcqs.length) + '%"></span></span>' + pct(right, S.mcqs.length) + "%</div></div></div>" +
        '<div class="card stat"><span class="ic orange">' + icon("target") + '</span><div class="s-body"><div class="s-l">Still to get right</div><div class="s-v">' + wrong + '</div><div class="s-sub">answered wrong so far</div></div></div>' +
        '<div class="card stat"><span class="ic purple">' + icon("levels") + '</span><div class="s-body"><div class="s-l">Levels covered</div><div class="s-v">' + S.levels.filter(function (L) { return mcqsIn([L.n]).length; }).length + '</div><div class="s-sub">of ' + S.levels.length + "</div></div></div></div>",
      top: quizPicker(),
    });
  }

  // --- recently added
  // the library imported on 12-13 Oct is the baseline: only content added after it is "new"
  function recentItems(days) {
    var since = new Date(Date.now() - days * 864e5).toISOString();
    if (S.baselineAt > since) since = S.baselineAt;
    return S.items.concat(S.mcqs).filter(function (d) { return d.added_at && d.added_at > since; });
  }
  function viewRecent() {
    var days = Number(route.args[0]) || 30;
    var list = recentItems(days).sort(function (a, b) { return a.added_at < b.added_at ? 1 : a.added_at > b.added_at ? -1 : a.level - b.level || (a.seq || a.n) - (b.seq || b.n); });
    var groups = [], cur = null;
    list.forEach(function (d) { var k = localDay(d.added_at); if (!cur || cur.k !== k) groups.push(cur = { k: k, at: d.added_at, items: [] }); cur.items.push(d); });
    var html = '<div class="page"><div class="col"><div><div class="eyebrow">Recently Added</div><div class="hero"><div><h1>' + plural(list.length, "new item") + '</h1><p>Exercises and multiple-choice questions added in the last ' + days + " days, newest first. New exercises go straight into their level. The starting library (" + S.items.filter(function (d) { return d.added_at <= S.baselineAt; }).length.toLocaleString() + " exercises and " + S.mcqs.filter(function (d) { return d.added_at <= S.baselineAt; }).length + " MCQs) isn't counted as new.</p></div></div></div>";
    html += '<div class="f-chips">' + [7, 30, 90, 365].map(function (n) { return '<a class="chip' + (n === days ? " on" : "") + '" href="#/recent/' + n + '">Last ' + (n === 365 ? "year" : n + " days") + "</a>"; }).join("") + "</div>";
    if (!list.length) html += '<div class="card empty">' + icon("new") + "<div>Nothing new yet.</div><p class=\"muted small\">Exercises and multiple-choice questions added from now on appear here, with the date they were added.</p></div>";
    groups.forEach(function (g) {
      var byLevel = {};
      g.items.forEach(function (d) { byLevel[d.level] = (byLevel[d.level] || 0) + 1; });
      var shown = g.items.slice(0, 50);
      html += '<section class="recent-day"><div class="card-h"><h3>' + icon("new") + fmtDate(g.at) + ' <span class="muted small">' + plural(g.items.length, "item") + " · " + g.items.filter(function (d) { return d.kind === "mcq"; }).length + " MCQs</span></h3></div>" +
        '<div class="f-chips" style="margin-bottom:10px">' + Object.keys(byLevel).map(Number).sort(function (a, b) { return a - b; }).map(function (n) { return '<a class="chip" href="#/level/' + n + '">Level ' + n + " · " + byLevel[n] + "</a>"; }).join("") + "</div>" +
        '<div class="dlist">' + shown.map(function (d) { return row(d); }).join("") + "</div>" + (g.items.length > shown.length ? '<p class="muted small">…and ' + (g.items.length - shown.length) + ' more: open a level above, or use All Exercises sorted by "Newest first".</p>' : "") + "</section>";
    });
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }

  // --- one exercise
  function viewDrill(id) {
    var d = S.byId[id];
    if (!d) { view.innerHTML = '<div class="page full"><div class="card empty">That exercise doesn\'t exist any more. <a href="#/drills">Back to all exercises</a></div></div>'; return; }
    store("sqldrills.lastItem", d.id);
    var ctx = (S.lastList && S.lastList.indexOf(d) > -1) ? S.lastList : itemsIn(d.level);
    var i = ctx.indexOf(d), prev = ctx[i - 1], next = ctx[i + 1];
    var server = d.engine === "server";
    var html = '<div class="page full"><div class="col">';
    var secOf = levelOf(d.level).sections && levelOf(d.level).sections.filter(function (s) { return s.key === d.section; })[0];
    html += '<div class="crumbs"><a href="#/levels">Levels</a>' + icon("chevRight") + '<a href="#/level/' + d.level + '">' + esc(levelName(d.level)) + "</a>" + icon("chevRight") + (secOf ? "<span>" + esc(secOf.title) + "</span>" + icon("chevRight") : "") + "<span>Exercise " + d.seq + " of " + itemsIn(d.level).length + "</span></div>";
    html += '<div class="dhead"><div><h1>' + esc(d.title) + '</h1><div class="dmeta">' + diffBadge(d.diff) + statusHtml(d) +
      (d.check === "self" ? '<span class="tag self-tag">' + icon("selfcheck") + "Self-check</span>" : '<span class="tag plain">' + esc(CHECK_LABEL[d.check] || "Auto-checked") + "</span>") +
      (d.tables && d.tables.length ? '<span class="dset" title="' + esc(S.datasets[d.dataset] || "") + '">' + icon("table") + '<span class="mono">' + d.tables.map(esc).join(", ") + "</span></span>" : S.datasets[d.dataset] ? '<span class="dset">' + icon(server ? "server" : "db") + esc(S.datasets[d.dataset]) + "</span>" : "") + "</div></div>" +
      '<div class="acts"><button class="btn' + (S.bookmarks[d.key] ? " ghost-accent" : "") + '" data-bm-btn="' + d.key + '">' + icon("bookmark") + (S.bookmarks[d.key] ? "Bookmarked" : "Bookmark") + "</button>" +
      (prev ? '<a class="btn" href="' + href(prev) + '" id="exPrev" aria-label="Previous exercise" aria-keyshortcuts="Alt+ArrowLeft" title="Previous (Alt+←)">' + icon("chevLeft") + "</a>" : "") + (next ? '<a class="btn" href="' + href(next) + '" id="exNext" aria-keyshortcuts="Alt+ArrowRight" title="Next (Alt+→)">Next ' + icon("chevRight") + "</a>" : "") + "</div></div>";
    var lvlS = itemsIn(d.level), atS = lvlS.indexOf(d), fromS = Math.max(0, atS - 6), nearS = lvlS.slice(fromS, fromS + 14);
    html += '<div class="ex-split"><div class="ws-left">';
    html += '<section class="card card-pad ws-task" id="task"><div class="card-h"><h3>' + icon("target") + 'Your task</h3></div><div class="dq"><p class="muted">Loading…</p></div></section>';
    if (d.clock) html += '<div class="self-note clock-note">' + icon("bulb") + "<div><strong>Today is " + new Date(d.clock + "T12:00:00").toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" }) + " in this exercise.</strong> Queries that use the current date (date('now'), CURRENT_DATE …) all see this day, so your answer and the solution are compared on the same date.</div></div>";
    if (d.sample) html += '<div class="self-note clock-note">' + icon("bulb") + "<div><strong>A random sample.</strong> Any " + (d.sample === true ? "" : d.sample + " ") + "rows of the right set count as correct: they don't have to be the solution's rows.</div></div>";
    if (d.check === "run") html += '<div class="self-note nc-note">' + icon("bulb") + "<div><strong>Practice · not checked.</strong> This drill doesn't have a reference answer yet, so your result isn't compared with anything: it counts as done as soon as your query runs without an error. Read your result against the task to judge it yourself.</div></div>";
    if (d.check === "self") html += '<div class="self-note">' + icon("selfcheck") + "<div><strong>Self-check exercise.</strong> This one can't be marked automatically (it changes structure, needs judgement, or is about understanding). Do it, compare with the expected result and the solution, then press <b>Mark as done</b>.</div></div>";
    html += schemaPanel(server ? { kind: "server", item: d.id, dialect: dialect() } : { kind: "sqlite", key: d.dataset }, { insert: true, open: !spIsPhone(), cls: "ws-schema", hint: "click a name to insert it" }) +
      '<section class="card card-pad ws-levels"><div class="card-h"><h3>' + icon("levels") + esc(levelName(d.level)) + '</h3></div><div class="mini-list">' +
      nearS.map(function (x) { return '<a href="' + href(x) + '" class="' + (x === d ? "on" : "") + '"' + (x === d ? ' aria-current="page"' : "") + '><span class="mn' + (isDone(x) ? " done" : "") + '">' + (isDone(x) ? icon("check") : x.seq) + "</span><span>" + esc(x.title) + "</span></a>"; }).join("") +
      '</div><a class="link" href="#/level/' + d.level + '" style="margin-top:8px">Whole level (' + lvlS.length + ") " + icon("chevRight") + "</a></section>";
    html += '</div><div class="ws-right">';
    if (server) html += '<div id="dbBanner"></div>';
    html += '<section class="card editor-card"><div class="ed-bar"><button class="btn primary" data-act="run">' + icon("play") + 'Run <kbd style="background:transparent;color:inherit;border-color:rgb(255 255 255 / .4)">Ctrl+Enter</kbd></button>' +
      (d.check === "self" ? '<button class="btn ok" data-act="mark-done">' + icon("check") + (isDone(d) ? "Done ✓" : "Mark as done") + "</button>"
        : server || d.check === "solution" || d.check === "state" ? '<button class="btn ok" data-act="check" aria-keyshortcuts="Control+Shift+Enter">' + icon("checkCircle") + 'Submit <kbd class="kbd-in">Ctrl+Shift+Enter</kbd></button>' : "") +
      '<button class="btn" data-act="hint" aria-keyshortcuts="Control+I">' + icon("bulb") + "<span>" + hintLabel(d) + "</span></button>" + '<button class="btn" data-act="format">' + icon("wand") + "Format</button>" +
      (server || d.check === "solution" || d.check === "state" ? '<button class="btn" data-act="solution">' + icon("eye") + "Show solution</button>" : d.check === "self" && d.model ? '<button class="btn" data-act="solution">' + icon("eye") + "Show answer</button>" : "") +
      '<span class="grow"></span>' +
      (server ? '<button class="eng eng-btn" data-open-settings title="Runs on this computer\'s ' + engineName(d) + ' server. Change it in Settings">' + icon("server") + engineName(d) + "</button>"
        : d.check === "state" ? '<span class="eng" title="Runs on a fresh scratch copy of the dataset on this computer\'s MySQL server; nothing is kept">' + icon("server") + "MySQL</span>"
        : '<span class="eng" title="Runs in your browser">SQLite</span>') +
      (d.check === "state" ? "" : '<button class="btn" data-act="reset-data" title="' + (server ? "Reload this exercise's database to its original data" : "Undo any changes your queries made") + '">' + icon("reset") + "Reset data</button>") + "</div>" +
      '<div class="editor"><div class="gutter" id="gutter">1</div><div class="ed-inner"><pre id="hl" aria-hidden="true"></pre><textarea id="sql" spellcheck="false" aria-label="Your SQL"></textarea></div></div>' +
      '<div class="hints" id="hints"></div>' +
      '<div class="out-h"><span class="status" id="status">Run your query to see results</span><span class="muted small" id="meta"></span></div><div class="out-b" id="out"><p class="muted small">' +
      (d.check === "self" ? "Ctrl+Enter runs your SQL on the exercise's database. Compare with the expected result, then Mark as done."
        : server ? "Ctrl+Enter runs your SQL on the exercise's database (changes are kept, like a real database; Undo / Reset data restore it). Submit (Ctrl+Shift+Enter) checks it without keeping any changes."
        : d.check === "state" ? "Ctrl+Enter runs your SQL on a fresh MySQL copy of the dataset (nothing is kept, so every run starts from the original data). Submit (Ctrl+Shift+Enter) compares the database you end up with against the reference answer's."
        : d.check === "solution" ? "Ctrl+Enter runs your query and shows the result. Submit (Ctrl+Shift+Enter) checks it against the answer."
        : "Ctrl+Enter runs the query (select text to run just that part). Running it marks the exercise done.") + " Ctrl+I asks for a hint.</p></div></section>";
    html += '<div id="extra"></div>';
    html += quickCheck(d);
    html += "</div></div></div></div>";
    view.innerHTML = html;
    schemaMount(view);
    var draft = store("sqldrills.draft." + d.id);
    $("#sql").value = draft || "-- " + d.title + "\n";
    // from the Today plan: a reflection on an exercise you just tried
    var rq = route.q && route.q.get("reflect");
    if (rq) reflectBox(d, rq === "pass");
    wireEditor(d);
    if (server) { loadServerExercise(d, !draft); checkDb(d); }
    else {
      // the list only carries a short description: fetch the full text (with links to other exercises)
      (d.body != null ? Promise.resolve(d) : api("/api/library/item/" + d.id)).then(function (full) {
        d.body = full.body || "";
        if (full.hints) d.hints = full.hints;
        if (route.name !== "drill" || route.args[0] !== d.id) return;
        $("#task .dq").innerHTML = exerciseText(d.body || d.title);
        return Engine.schema(d.dataset).then(function (tables) { if (!draft) fillStarter(d, tables); });
      }).catch(function (e) { $("#task .dq").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
    }
  }
  // course / SQL Exercises items: details from the server checker
  function loadServerExercise(d, fresh) {
    api("/api/library/item/" + d.id + "/course?dialect=" + dialect()).then(function (ex) {
      if (route.name !== "drill" || route.args[0] !== d.id) return;
      d.ex = ex;
      var task = '<div class="dq">' + exerciseText(ex.question) + "</div>";
      if (ex.objective) task = '<p class="objective"><b>Objective:</b> ' + esc(ex.objective) + "</p>" + task;
      if (ex.auto_setup) task += '<p class="muted small setup-note">' + icon("db") + "The tables this exercise uses are set up automatically the first time you run or check it.</p>";
      if (ex.prereq_text) task += '<div class="course-box prereq-box"><strong>Builds on earlier exercises:</strong> ' + esc(ex.prereq_text.replace(/\bD\d+-[CP]\d+\b/g, "an earlier exercise")) + '<div><button class="btn sm" data-act="prereqs">' + icon("play") + "Run them for me</button></div></div>";
      var more = "";
      if (ex.idea) more += "<details><summary>The idea in plain English</summary><pre class=\"course-pre\">" + esc(ex.idea) + "</pre></details>";
      if (ex.example_sql) more += "<details><summary>Worked example</summary>" + (ex.example_intro ? '<pre class="course-pre">' + esc(ex.example_intro) + "</pre>" : "") + '<pre class="mcq-code">' + highlight(ex.example_sql) + "</pre>" + (ex.example_output ? '<pre class="course-pre mono">' + esc(ex.example_output) + "</pre>" : "") + "</details>";
      if (more) task += '<div class="course-more">' + more + "</div>";
      $("#task").innerHTML = '<div class="card-h"><h3>' + icon("target") + "Your task</h3></div>" + task;
      // the course's own table notes stand in when the schema can't be read (database offline)
      Object.keys(SP).forEach(function (k) { if (SP[k].src.item === d.id) SP[k].fallback = ex.tables_text || ""; });
      var extra = "";
      var hints = [ex.hint1, ex.hint2, ex.hint3].filter(Boolean);
      if (hints.length) extra += '<section class="card card-pad"><div class="card-h"><h3>' + icon("bulb") + 'Hints</h3></div><div id="courseHints"></div><button class="btn sm" data-act="course-hint" data-n="0">Show hint 1 of ' + hints.length + "</button></section>";
      if (ex.expected_text) extra += '<section class="card card-pad"><details' + (d.check === "self" ? " open" : "") + '><summary class="card-h" style="margin:0"><h3 style="display:inline-flex">' + icon("table") + 'Expected result</h3></summary><pre class="course-pre mono">' + esc(ex.expected_text) + "</pre></details></section>";
      if (ex.after_text) extra += '<section class="card card-pad"><details><summary class="card-h" style="margin:0"><h3 style="display:inline-flex">' + icon("tips") + 'Common mistakes & checklist</h3></summary><pre class="course-pre">' + esc(ex.after_text) + "</pre></details></section>";
      if (ex.has_cleanup) extra += '<div class="actions-row"><button class="btn sm" data-act="cleanup">' + icon("reset") + "Undo this exercise's changes</button></div>";
      $("#extra").innerHTML = extra;
      d.courseHints = hints;
      var ta = $("#sql");
      if (fresh && !ta.dataset.touched) { ta.value = "-- " + d.title + "\n" + (ex.starter ? ex.starter + "\n" : ""); syncEditor(); }
    }).catch(function (e) { $("#task").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
  }
  function engineName(d) { return dialect() === "postgres" && d.dialects && d.dialects.indexOf("postgres") > -1 ? "PostgreSQL" : "MySQL"; }
  // MySQL / PostgreSQL not running: say so plainly, with how to fix it
  function offlineHtml(e) {
    return '<div class="offline-note" role="alert">' + icon("server") + "<div><strong>Database server is offline — start " + esc(e.engine || "MySQL") + " and retry</strong><p>" + esc(e.message) + '</p><button class="btn sm" data-act="db-retry">' + icon("reset") + "Retry</button></div></div>";
  }
  function showFailure(e, label) {
    if (e && e.offline) { setStatus("bad", "Database server is offline"); $("#out").innerHTML = offlineHtml(e); checkDbResult(e); return; }
    setStatus("bad", label || "Error");
    $("#out").innerHTML = '<div class="err">' + esc(e.message) + "</div>";
  }
  function checkDbResult(e) { var b = $("#dbBanner"); if (b) b.innerHTML = e ? offlineHtml(e) : ""; }
  function checkDb(d, announce) {
    api("/api/library/item/" + d.id + "/db-status?dialect=" + dialect()).then(function (r) {
      if (route.name !== "drill" || route.args[0] !== d.id) return;
      if (r.online === false) checkDbResult({ message: r.message });
      else { checkDbResult(null); if (announce) { toast(r.engine + " is running again"); setStatus("", "Run your query to see results"); $("#out").innerHTML = '<p class="muted small">' + r.engine + " is running. Run or check your SQL.</p>"; } }
    }).catch(function (e) {
      if (!e.offline || route.name !== "drill" || route.args[0] !== d.id) return;
      checkDbResult(e);
      if (announce) toast(e.engine + " is still not running");
    });
  }
  function fillStarter(d, tables) {
    var ta = $("#sql");
    if (!ta || ta.dataset.touched) return;
    var t = tables.filter(function (x) { return new RegExp("\\b" + x.name + "\\b", "i").test(d.body + " " + d.title); })[0] || tables[0];
    ta.value = "-- " + d.title + "\nSELECT *\nFROM " + (t ? t.name : "") + "\nLIMIT 10;";
    syncEditor();
  }
  function renderTree(tables) {
    var el = $("#tree");
    if (!el) return;
    el.innerHTML = tables.map(function (t, i) {
      return '<div><button class="tree-t" data-act="toggle-table" aria-expanded="' + (i === 0) + '">' + icon("table") + esc(t.name) + '<span class="ct">' + t.rows.toLocaleString() + " rows</span></button>" +
        "<ul" + (i === 0 ? "" : " hidden") + ">" + t.cols.map(function (c) { return '<li><button data-insert="' + esc(c.name) + '" title="Insert column name">' + esc(c.name) + "<small>" + esc(c.type.toLowerCase()) + "</small></button></li>"; }).join("") +
        '<li><button data-query-table="' + esc(t.name) + '" title="Preview this table">SELECT * FROM ' + esc(t.name) + " …</button></li></ul></div>";
    }).join("") || '<p class="muted small">No tables.</p>';
  }
  // ---------- schema browser: exercise page, predict cards, transfer tasks ----------
  // src: { kind: "sqlite", key } (the dataset in the browser engine) or { kind: "server", item, dialect } (the course
  // exercise's schema, read on the server by a read-only user). Tables, columns, types, PK / FK, a 5-row preview;
  // clicking a name inserts it into the editor when there is one. Phones (<= 720px): the panel opens as a drawer.
  var SP = {}, spSeq = 0;
  function schemaPanel(src, opts) {
    var id = "sp" + (++spSeq);
    SP[id] = { src: src, insert: !!(opts && opts.insert), loaded: false, sql: (opts && opts.sql) || "" };
    var open = !!(opts && opts.open);
    return '<section class="card schema-panel' + (opts && opts.cls ? " " + opts.cls : "") + '" data-sp="' + id + '"><button type="button" class="sp-toggle" aria-expanded="' + open + '" aria-controls="' + id + '-body">' + icon("db") + '<span class="sp-title">' + esc((opts && opts.title) || "Schema") + '<span class="sp-used"></span></span><span class="sp-hint">' + esc((opts && opts.hint) || "tables, keys, 5-row preview") + "</span>" + icon("chevDown", "sp-chev") + "</button>" +
      '<div class="sp-body" id="' + id + '-body"' + (open ? "" : " hidden") + ' aria-label="Schema"><div class="sp-head"><h2 class="sp-h">' + icon("db") + esc((opts && opts.title) || "Schema") + '<span class="sp-used"></span></h2><button type="button" class="btn sm sp-close" aria-label="Close the schema">' + icon("x") + "</button></div>" +
      '<div class="sp-tables"><p class="muted small">Loading…</p></div></div></section>';
  }
  /** Loads and renders every panel in `root` that is open and not loaded yet. */
  function schemaMount(root) { (root || document).querySelectorAll(".schema-panel").forEach(function (el) { var b = el.querySelector(".sp-body"); if (!b.hidden) spLoad(el); }); }
  function spTables(src) {
    if (src.kind === "sqlite") return Engine.schema(src.key);
    return api("/api/library/item/" + encodeURIComponent(src.item) + "/schema?dialect=" + src.dialect).then(function (r) { return r.tables; });
  }
  function spPreview(src, table) {
    if (src.kind === "sqlite") return Engine.preview(src.key, table);
    return api("/api/library/item/" + encodeURIComponent(src.item) + "/schema/preview?dialect=" + src.dialect + "&table=" + encodeURIComponent(table));
  }
  function spLoad(el) {
    var st = SP[el.getAttribute("data-sp")];
    if (!st || st.loaded) return;
    st.loaded = true;
    var box = el.querySelector(".sp-tables");
    spTables(st.src).then(function (tables) {
      // a panel for a piece of SQL: the tables it names first, and open
      var used = st.sql ? tables.filter(function (t) { return new RegExp("(^|[^\\w])" + t.name.replace(/[^\w]/g, "") + "([^\\w]|$)", "i").test(st.sql); }).map(function (t) { return t.name; }) : [];
      if (used.length) tables = tables.filter(function (t) { return used.indexOf(t.name) > -1; }).concat(tables.filter(function (t) { return used.indexOf(t.name) < 0; }));
      st.tables = tables; box.innerHTML = spRender(el.getAttribute("data-sp"), tables, st.insert, used);
      [].forEach.call(el.querySelectorAll(".sp-used"), function (u) { u.textContent = used.length ? " (" + used.join(", ") + ")" : ""; });
    })
      .catch(function (e) { st.loaded = false; box.innerHTML = '<p class="err small">' + esc(e.message || "Couldn't read the tables.") + "</p>" + (st.fallback ? '<pre class="course-pre mono small">' + esc(st.fallback) + "</pre>" : ""); });
  }
  function spRender(id, tables, insert, used) {
    var opened = function (t, i) { return used && used.length ? used.indexOf(t.name) > -1 : i === 0; };
    if (!tables.length) return '<p class="muted small">No tables.</p>';
    return '<ul class="sp-list">' + tables.map(function (t, i) {
      var cid = id + "-t" + i;
      var name = insert ? '<button type="button" class="sp-name" data-sp-insert="' + esc(t.name) + '" title="Insert the table name into the editor">' + icon("table") + '<span class="mono">' + esc(t.name) + "</span></button>"
        : '<span class="sp-name">' + icon("table") + '<span class="mono">' + esc(t.name) + "</span></span>";
      return '<li class="sp-table"><div class="sp-trow"><button type="button" class="sp-caret" aria-expanded="' + opened(t, i) + '" aria-controls="' + cid + '" aria-label="Columns of ' + esc(t.name) + '">' + icon("chevDown") + "</button>" + name +
        '<span class="sp-ct">' + (t.view ? "view" : t.rows == null ? "" : Number(t.rows).toLocaleString() + (t.rows === 1 ? " row" : " rows")) + "</span></div>" +
        '<ul class="sp-cols" id="' + cid + '"' + (opened(t, i) ? "" : " hidden") + ">" + t.cols.map(function (c) {
          var badges = (c.pk ? '<span class="sp-badge pk" title="Primary key">PK</span>' : "") + (c.fk ? '<span class="sp-badge fk" title="Foreign key to ' + esc(c.fk.table + "." + c.fk.column) + '">FK → ' + esc(c.fk.table + "." + c.fk.column) + "</span>" : "");
          var inner = '<span class="mono sp-col">' + esc(c.name) + '</span><span class="sp-type">' + esc(String(c.type || "").toLowerCase()) + "</span>" + badges;
          return "<li>" + (insert ? '<button type="button" class="sp-colbtn" data-sp-insert="' + esc(c.name) + '" title="Insert the column name into the editor">' + inner + "</button>" : '<span class="sp-colbtn">' + inner + "</span>") + "</li>";
        }).join("") + '<li class="sp-prev-row"><button type="button" class="btn sm" data-sp-preview="' + esc(t.name) + '">' + icon("eye") + "Preview 5 rows</button></li></ul>" +
        '<div class="sp-out" aria-live="polite"></div></li>';
    }).join("") + "</ul>";
  }
  // the drawer (phones): a dialog over the page with a backdrop; Escape, the close button or the backdrop close it
  var spDrawer = null;
  function spIsPhone() { return window.matchMedia("(max-width: 720px)").matches; }
  function spOpen(el, toggle) {
    var body = el.querySelector(".sp-body");
    body.hidden = false; toggle.setAttribute("aria-expanded", "true");
    spLoad(el);
    if (!spIsPhone()) return;
    body.classList.add("sp-drawer"); body.setAttribute("role", "dialog"); body.setAttribute("aria-modal", "true");
    var bd = document.createElement("div"); bd.className = "sp-backdrop"; document.body.appendChild(bd); document.body.classList.add("sp-locked");
    spDrawer = { el: el, body: body, toggle: toggle, backdrop: bd };
    body.querySelector(".sp-close").focus();
  }
  function spClose(el) {
    var body = el.querySelector(".sp-body"), toggle = el.querySelector(".sp-toggle");
    body.hidden = true; toggle.setAttribute("aria-expanded", "false");
    if (spDrawer && spDrawer.el === el) {
      body.classList.remove("sp-drawer"); body.removeAttribute("role"); body.removeAttribute("aria-modal");
      spDrawer.backdrop.remove(); document.body.classList.remove("sp-locked"); spDrawer = null;
    }
    toggle.focus();
  }
  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains("sp-backdrop") && spDrawer) { spClose(spDrawer.el); return; }
    var panel = t.closest && t.closest(".schema-panel");
    if (!panel) return;
    var tg = t.closest(".sp-toggle");
    if (tg) { if (tg.getAttribute("aria-expanded") === "true") spClose(panel); else spOpen(panel, tg); return; }
    if (t.closest(".sp-close")) { spClose(panel); return; }
    var caret = t.closest(".sp-caret");
    if (caret) { var ul = document.getElementById(caret.getAttribute("aria-controls")); ul.hidden = !ul.hidden; caret.setAttribute("aria-expanded", String(!ul.hidden)); return; }
    var ins = t.closest("[data-sp-insert]");
    if (ins && $("#sql")) { var name = ins.getAttribute("data-sp-insert"); if (spDrawer) spClose(spDrawer.el); var ta = $("#sql"), before = ta.value.slice(0, ta.selectionStart);
      // a space between two names ("FROM authors" then a column: "authors author_id" -> the learner adds the comma)
      insertAtCursor((/[A-Za-z0-9_"]$/.test(before) ? " " : "") + (/^[A-Za-z_][A-Za-z0-9_]*$/.test(name) ? name : '"' + name.replace(/"/g, '""') + '"')); return; }
    var pv = t.closest("[data-sp-preview]");
    if (pv) {
      var st = SP[panel.getAttribute("data-sp")], out = pv.closest(".sp-table").querySelector(".sp-out"), table = pv.getAttribute("data-sp-preview");
      out.innerHTML = '<p class="muted small">Loading…</p>';
      spPreview(st.src, table).then(function (r) { out.innerHTML = '<div class="muted small">First rows of <b class="mono">' + esc(table) + "</b></div>" + miniTable(r); })
        .catch(function (err) { out.innerHTML = '<p class="err small">' + esc(err.message || "Couldn't read that table.") + "</p>"; });
    }
  });
  document.addEventListener("keydown", function (e) {
    if (!spDrawer) return;
    if (e.key === "Escape") { e.preventDefault(); spClose(spDrawer.el); return; }
    if (e.key !== "Tab") return;
    // keep the focus inside the drawer
    var f = [].slice.call(spDrawer.body.querySelectorAll("button:not([disabled]), [href], input, [tabindex]:not([tabindex='-1'])")).filter(function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
    else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
  });
  // the drawer only exists on a phone-sized screen: turning the phone / widening the window closes it
  window.addEventListener("resize", function () { if (spDrawer && !spIsPhone()) spClose(spDrawer.el); });
  window.addEventListener("hashchange", function () { if (spDrawer) { spDrawer.backdrop.remove(); document.body.classList.remove("sp-locked"); spDrawer = null; } });
  function syncEditor() {
    var ta = $("#sql");
    if (!ta) return;
    $("#hl").innerHTML = highlight(ta.value);
    var n = ta.value.split("\n").length, nums = [];
    for (var i = 1; i <= n; i++) nums.push(i);
    $("#gutter").textContent = nums.join("\n");
    ta.style.height = "0px";
    ta.style.height = Math.max($("#hl").scrollHeight, 150) + "px";
    ta.style.width = Math.max($("#hl").scrollWidth, ta.parentNode.clientWidth) + "px";
  }
  function wireEditor(d) {
    var ta = $("#sql");
    syncEditor();
    ta.addEventListener("input", function () { ta.dataset.touched = "1"; if (!isDone(d)) store("sqldrills.draft." + d.id, ta.value); syncEditor(); });
    ta.addEventListener("keydown", function (e) {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Enter") { e.preventDefault(); submitItem(d); }
      else if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runItem(d); }
      else if ((e.ctrlKey || e.metaKey) && (e.key === "i" || e.key === "I")) { e.preventDefault(); hintStep(d); }
      else if (e.key === "Tab") { e.preventDefault(); var s = ta.selectionStart; ta.value = ta.value.slice(0, s) + "  " + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = s + 2; ta.dispatchEvent(new Event("input")); }
    });
  }
  function insertAtCursor(text) {
    var ta = $("#sql"), s = ta.selectionStart, e = ta.selectionEnd;
    ta.value = ta.value.slice(0, s) + text + ta.value.slice(e);
    ta.focus();
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.dispatchEvent(new Event("input"));
  }
  function resultTable(r) {
    var rows = r.values.slice(0, 500);
    return '<div class="grid-wrap"><table class="grid"><thead><tr>' + r.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      rows.map(function (row) { return "<tr>" + row.map(function (v) { return v === null ? '<td class="null">NULL</td>' : "<td>" + esc(typeof v === "object" ? JSON.stringify(v) : v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>" +
      ((r.total || r.values.length) > rows.length ? '<p class="muted small">Showing the first ' + rows.length + " of " + (r.total || r.values.length).toLocaleString() + " rows.</p>" : "");
  }
  function selectedSql() { var ta = $("#sql"); return ta.selectionEnd > ta.selectionStart ? ta.value.slice(ta.selectionStart, ta.selectionEnd) : ta.value; }
  function setStatus(cls, html, meta) { var s = $("#status"); s.className = "status" + (cls ? " " + cls : ""); s.innerHTML = html; $("#meta").textContent = meta || ""; }
  function runItem(d) {
    var sql = selectedSql();
    if (!sql.replace(/--[^\n]*/g, "").trim()) { $("#out").innerHTML = '<p class="muted">Nothing to run: write a query first.</p>'; return; }
    var btn = $('[data-act="run"]');
    setStatus("", "Running…");
    btn.disabled = true;
    if (d.check === "state") {
      api("/api/library/item/" + d.id + "/state-run", { sql: sql }).then(function (res) {
        btn.disabled = false;
        if (!res.ok) { setStatus("bad", "Query failed"); $("#out").innerHTML = '<div class="err">' + esc(res.error) + "</div>"; return; }
        setStatus("ok", icon("checkCircle") + "Ran on MySQL", res.ms + " ms · nothing kept");
        $("#out").innerHTML = (res.changes.length ? '<p class="muted" style="margin:0 0 8px">What changed: ' + esc(res.changes.join("; ")) + ".</p>" : '<p class="muted" style="margin:0 0 8px">Nothing in the database changed.</p>') +
          (res.result && res.result.columns ? resultTable({ columns: res.result.columns, values: res.result.rows, total: res.result.count }) : "") + '<p class="muted small">Use Check answer to verify.</p>';
      }).catch(function (e) { btn.disabled = false; showFailure(e, "Query failed"); });
      return;
    }
    if (d.engine === "server") {
      api("/api/library/item/" + d.id + "/run", { sql: sql, dialect: dialect() }).then(function (res) {
        btn.disabled = false;
        if (!res.ok) { setStatus("bad", "Query failed"); $("#out").innerHTML = '<div class="err">' + esc(res.error) + "</div>"; return; }
        setStatus("ok", icon("checkCircle") + "Query executed successfully", (res.columns ? plural(res.count, "row") : plural(res.affected || 0, "row") + " affected") + " · " + res.ms + " ms");
        $("#out").innerHTML = res.columns ? resultTable({ columns: res.columns, values: res.rows, total: res.count }) : '<p class="muted">Done: ' + plural(res.statements, "statement") + " ran, " + plural(res.affected || 0, "row") + " affected. " + (d.check === "self" ? "Compare with the expected result, then Mark as done." : "Use Check answer to verify.") + "</p>";
      }).catch(function (e) { btn.disabled = false; showFailure(e, "Query failed"); });
      return;
    }
    // drills with added rows: a fresh copy each run, the rows first, then the learner's query
    if (d.prep) Engine.reset(d.dataset);
    var asRun = d.clock ? SqlCompare.freezeClock(sql) : sql;
    Engine.run(d.dataset, d.prep ? d.prep + ";\n" + asRun : asRun).then(function (res) {
      btn.disabled = false;
      if (d.prep) Engine.reset(d.dataset);
      Engine.forget(d.dataset);
      if (!res.ok) { setStatus("bad", "Query failed"); $("#out").innerHTML = '<div class="err">' + esc(res.error) + "</div>"; return; }
      var wasDone = isDone(d), completes = d.check === "run";
      if (completes) markDone(d);
      var last = res.results[res.results.length - 1];
      S.lastRun = S.lastRun || {};
      if (last) S.lastRun[d.id] = last;
      setStatus("ok", icon("checkCircle") + "Query executed successfully", (last ? plural(last.values.length, "row") : res.changes ? plural(res.changes, "row") + " changed" : "no rows") + " · " + res.ms + " ms" + (completes && !wasDone ? " · exercise done" : ""));
      $("#out").innerHTML = last ? resultTable(last) : '<p class="muted">The query ran and returned no rows' + (res.changes ? " (" + plural(res.changes, "row") + " changed; Reset data undoes it)" : "") + ".</p>";
      if (completes && !wasDone) refreshDone(d);
    });
  }
  // Expected and Your result side by side: rows missing from yours / extra in yours marked, column differences named
  function diffTables(exp, got) {
    var key = function (r) { return JSON.stringify(r.map(SqlCompare.cell)); };
    var mark = function (from, against) {
      var bag = {};
      against.forEach(function (r) { var k = key(r); bag[k] = (bag[k] || 0) + 1; });
      return from.map(function (r) { var k = key(r); if (bag[k]) { bag[k]--; return false; } return true; });
    };
    var miss = mark(exp.rows, got.rows), extra = mark(got.rows, exp.rows);
    var nMiss = miss.filter(Boolean).length, nExtra = extra.filter(Boolean).length;
    var colNote = exp.columns.length !== got.columns.length ? "Columns: the expected result has " + exp.columns.length + " (" + exp.columns.join(", ") + "), yours has " + got.columns.length + " (" + got.columns.join(", ") + ")."
      : exp.columns.some(function (c, k) { return String(c).toLowerCase() !== String(got.columns[k]).toLowerCase(); }) ? "Column names differ (" + got.columns.join(", ") + " vs " + exp.columns.join(", ") + "): names don't count, only the values in each column." : "";
    var table = function (r, marks, cls, label) {
      var rows = r.rows.slice(0, 50);
      return '<div class="grid-wrap"><table class="grid rdiff" aria-label="' + label + '"><thead><tr>' + r.columns.map(function (c) { return '<th scope="col">' + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
        rows.map(function (row, k) { var note = marks[k] ? '<span class="sr-only">' + (cls === "miss" ? "Missing from yours: " : "Not in the expected result: ") + "</span>" : ""; return "<tr" + (marks[k] ? ' class="' + cls + '"' : "") + ">" + row.map(function (v, j) { return (v === null ? '<td class="null">' + (j ? "" : note) + "NULL</td>" : "<td>" + (j ? "" : note) + esc(typeof v === "object" ? JSON.stringify(v) : v) + "</td>"); }).join("") + "</tr>"; }).join("") + "</tbody></table></div>" +
        ((r.count || r.rows.length) > rows.length ? '<p class="muted small">First ' + rows.length + " of " + (r.count || r.rows.length).toLocaleString() + " rows.</p>" : "");
    };
    return '<div class="diff-legend small">' + (nMiss ? '<span class="lg miss">' + plural(nMiss, "expected row") + " missing from yours</span>" : "") + (nExtra ? '<span class="lg extra">' + plural(nExtra, "row") + " of yours not expected</span>" : "") + (colNote ? '<span class="lg cols">' + esc(colNote) + "</span>" : "") + "</div>" +
      '<div class="compare"><div><h4>Expected (' + plural(exp.count || exp.rows.length, "row") + ")</h4>" + table(exp, miss, "miss", "Expected result") + "</div><div><h4>Your result (" + plural(got.count || got.rows.length, "row") + ")</h4>" + table(got, extra, "extra", "Your result") + "</div></div>";
  }
  function canonCell(v) {
    if (v === null || v === undefined) return "NULL";
    if (typeof v === "number") return String(Number(v.toFixed(6)));
    var t = String(v).trim();
    return /^-?\d+(\.\d+)?$/.test(t) ? String(Number(Number(t).toFixed(6))) : t;
  }
  function checkItem(d) {
    var sql = selectedSql(), out = $("#out");
    if (!sql.replace(/--[^\n]*/g, "").trim()) { out.innerHTML = '<p class="muted">Write your answer first.</p>'; return; }
    var btn = $('[data-act="check"]');
    btn.disabled = true;
    setStatus("", "Checking…");
    if (d.check === "state") {
      api("/api/library/item/" + d.id + "/state-check", { sql: sql }).then(function (r) {
        btn.disabled = false;
        var ok = r.verdict === "correct";
        d.lastAttempt = !ok && r.details && r.details.expected && r.details.got ? { sql: sql, expected: r.details.expected, got: r.details.got } : null;
        if (r.verdict === "correct" || r.verdict === "incorrect") recordAttempt(d, ok);
        setStatus(ok ? "ok" : r.verdict === "unavailable" ? "" : "bad", icon(ok ? "checkCircle" : "target") + ({ correct: "Correct", incorrect: "Not yet", error: "Error", unavailable: "Can't check right now" }[r.verdict] || "Not yet"));
        out.innerHTML = '<p style="margin:0 0 12px">' + esc(r.message) + "</p>" +
          (r.why && r.why.length ? '<ul class="why-list">' + r.why.map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + "</ul>" : "") +
          (r.changes && r.changes.length ? '<p class="muted small">Your SQL: ' + esc(r.changes.join("; ")) + ".</p>" : "");
        if (ok && !isDone(d)) { markDone(d); refreshDone(d); }
      }).catch(function (e) { btn.disabled = false; showFailure(e, "Error"); });
      return;
    }
    if (d.engine === "server") {
      api("/api/library/item/" + d.id + "/check", { sql: sql, dialect: dialect() }).then(function (r) {
        btn.disabled = false;
        var ok = r.verdict === "correct";
        d.lastAttempt = !ok && r.details && r.details.expected && r.details.got ? { sql: sql, expected: r.details.expected, got: r.details.got } : null;
        if (r.verdict === "correct" || r.verdict === "incorrect") recordAttempt(d, ok);
        setStatus(ok ? "ok" : r.verdict === "incorrect" || r.verdict === "error" ? "bad" : "", icon(ok ? "checkCircle" : "target") + ({ correct: "Correct", incorrect: "Not yet", error: "Error", "needs-prereq": "Needs earlier exercises", unavailable: "Can't check right now" }[r.verdict] || "Check by eye"));
        var det = r.details && !ok ? diffTables({ columns: r.details.expected.columns, rows: r.details.expected.rows, count: r.details.expected.count }, { columns: r.details.got.columns, rows: r.details.got.rows, count: r.details.got.count }) : "";
        out.innerHTML = '<p style="margin:0 0 12px">' + esc(r.message) + "</p>" + det + (r.verdict === "needs-prereq" ? '<button class="btn sm" data-act="prereqs">Run the earlier exercises for me</button>' : "");
        if (ok && !isDone(d)) { markDone(d, true); refreshDone(d); }
      }).catch(function (e) { btn.disabled = false; showFailure(e, "Error"); });
      return;
    }
    // drills with a solution (added in the admin): compare results in the browser
    api("/api/library/item/" + d.id + "/solution").then(function (s) {
      var prep = d.prep ? d.prep + ";\n" : "";
      // "today" is the same moment for both; a random sample is compared with the rows it is drawn from
      var sp = d.sample ? SqlCompare.samplePool(s.solution_sql) : null;
      var ref = sp ? sp.pool : s.solution_sql, mine = sql;
      if (d.clock) { ref = SqlCompare.freezeClock(ref); mine = SqlCompare.freezeClock(mine); }
      // several accepted answers: run each (fresh copy each time), compare with all of them
      var others = (s.accepted || []).slice(1);
      var runOne = function (q) { Engine.reset(d.dataset); return Engine.run(d.dataset, prep + (d.clock ? SqlCompare.freezeClock(q) : q)); };
      var extra = [];
      var chain = others.reduce(function (p, a) { return p.then(function () { return runOne(a.sql).then(function (x) { var last = x.ok && x.results[x.results.length - 1]; if (last) extra.push({ columns: last.columns, rows: last.values, label: a.label }); }); }); }, Promise.resolve());
      return chain.then(function () { Engine.reset(d.dataset); return Engine.run(d.dataset, prep + ref); }).then(function (sol) {
        if (prep) Engine.reset(d.dataset);
        return Engine.run(d.dataset, prep + mine).then(function (got) {
          Engine.reset(d.dataset);
          btn.disabled = false;
          var exp = sol.ok && sol.results[sol.results.length - 1], res = got.ok && got.results[got.results.length - 1], verdict, ok = false;
          if (!exp) verdict = "The solution couldn't run, so this exercise can't be checked right now.";
          else if (!got.ok) verdict = "Your query failed: " + got.error;
          else if (!res) verdict = "Your query ran but returned no result table.";
          else {
            // shared with the server (compare.js): names ignored, numbers to 2 decimals, NULL is not "",
            // order only when the exercise asks for one
            var ordered = d.ordered != null ? !!d.ordered : SqlCompare.asksForOrder(d.title + " " + (d.body || ""));
            var expList = [{ columns: exp.columns, rows: exp.values, label: (s.accepted || [])[0] && s.accepted[0].label }].concat(extra);
            var cmp = sp ? SqlCompare.compareSample({ columns: exp.columns, rows: exp.values }, sp.limit, { columns: res.columns, rows: res.values })
              : SqlCompare.compareBest(expList, { columns: res.columns, rows: res.values }, ordered);
            var closest = !sp && !cmp.ok ? expList[cmp.closest || 0] : null;
            ok = cmp.ok; verdict = cmp.reason;
          }
          setStatus(ok ? "ok" : "bad", icon(ok ? "checkCircle" : "target") + (ok ? "Correct" : "Not yet"));
          d.lastAttempt = exp && !ok && !sp ? { sql: mine, expected: typeof closest !== "undefined" && closest ? closest : { columns: exp.columns, rows: exp.values }, got: res ? { columns: res.columns, rows: res.values } : null, error: got.ok ? (res ? null : "no result table") : got.error } : null;
          if (exp) recordAttempt(d, ok);
          out.innerHTML = '<p style="margin:0 0 12px" class="verdict">' + esc(verdict) + "</p>" + (res && typeof closest !== "undefined" && closest ? diffTables(closest, { columns: res.columns, rows: res.values }) : res ? resultTable(res) : "");
          if (ok && !isDone(d)) { markDone(d); refreshDone(d); }
        });
      });
    }).catch(function (e) { btn.disabled = false; out.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
  }
  function refreshDone(d) {
    var a = view.querySelector(".mini-list a.on .mn");
    if (a) { a.classList.add("done"); a.innerHTML = icon("check"); }
    var pill = view.querySelector(".dhead .pill");
    if (pill) pill.outerHTML = statusHtml(d);
    var mb = $('[data-act="mark-done"]');
    if (mb) mb.innerHTML = icon("check") + (isDone(d) ? "Done ✓" : "Mark as done");
  }
  function hintAsComment(h) {
    var body = h.text.split("\n").filter(function (l) { return !/^\s*```/.test(l); }).map(function (l) { return l.replace(/\*\*([^*]+)\*\*/g, "$1").replace(/`([^`]+)`/g, "$1").replace(/\s+$/, ""); });
    while (body.length && !body[body.length - 1]) body.pop();
    var lines = [];
    body.forEach(function (l) {
      if (l.length <= 76) { lines.push(l); return; }
      var cur = "";
      l.split(/\s+/).forEach(function (w) { if (cur && (cur + " " + w).length > 76) { lines.push(cur); cur = "   " + w; } else cur = cur ? cur + " " + w : w; });
      if (cur) lines.push(cur);
    });
    return ["Hint " + h.level + " of 3 (" + h.label + "):"].concat(lines).map(function (l) { return ("-- " + l).replace(/\s+$/, ""); }).join("\n") + "\n\n";
  }
  function hasSolution(d) { return d.engine === "server" || d.check === "solution" || d.check === "state" || (d.check === "self" && d.model); }
  function hintsOf(d) { if (d.hintsUsed == null) d.hintsUsed = Number(store("sqldrills.hints." + d.id)) || 0; return d.hintsUsed; }
  function hintLabel(d) { var n = hintsOf(d); return n >= 3 && hasSolution(d) ? "Solution shown" : n >= 2 && hasSolution(d) ? "Show solution" : "Hint " + Math.min(n + 1, 3); }
  function countHint(d, n) { d.hintsUsed = Math.max(hintsOf(d), n); store("sqldrills.hints." + d.id, String(d.hintsUsed)); var b = $('[data-act="hint"] span'); if (b) b.textContent = hintLabel(d); }
  function hintStep(d) {
    if (hintsOf(d) >= 2 && hasSolution(d)) { var sb = $('[data-act="solution"]'); if (sb) sb.click(); return; }
    askHint(d);
  }
  function submitItem(d) {
    var b = $('[data-act="check"]'), m = $('[data-act="mark-done"]'), s = $('[data-act="solution"]');
    if (b && !b.disabled) b.click(); else if (d.check === "self" && s) s.click(); else if (m) m.click();
  }
  function askHint(d) {
    var btn = $('[data-act="hint"]'), box = $("#hints");
    if (!btn || btn.disabled) return;
    var level = Math.min(3, box.querySelectorAll(".hint").length + 1), err = $("#out .err");
    // hints written with the exercise come first, without asking an AI
    if (d.hints && level <= d.hints.length) {
      var own = document.createElement("div"); own.className = "hint";
      own.innerHTML = '<div class="hint-meta">Hint ' + level + " of " + Math.max(3, d.hints.length) + " · from the exercise</div><div class=\"md\">" + renderMarkdown(d.hints[level - 1]) + "</div>";
      box.appendChild(own); countHint(d, level); return;
    }
    btn.disabled = true;
    btn.querySelector("span").textContent = "Thinking…";
    var task = d.title + "\n" + (d.ex ? d.ex.question : d.body || "");
    api("/api/hint", { provider: hintProvider(), itemId: d.id, dialect: dialect(), task: task.replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”"), sql: $("#sql").value, error: err ? err.textContent : "", level: level })
      .then(function (h) {
        var c = document.createElement("div");
        c.className = "hint";
        var fb = h.fellBackFrom || [];
        c.innerHTML = '<div class="hint-meta">Hint ' + h.level + " of 3 · " + esc(h.label) + " <span>" + esc(h.model) + '</span><button class="btn sm" data-act="hint-insert">Insert into editor</button></div>' +
          (fb.length ? '<div class="hint-fb">' + esc(fb.map(function (x) { return x.label; }).join(", ")) + " failed, so " + esc(h.label) + " answered instead.</div>" : "") + '<div class="md">' + renderMarkdown(h.text) + "</div>";
        c.hintData = h;
        box.appendChild(c);
        countHint(d, level);
      })
      .catch(function (e) { var f = document.createElement("div"); f.className = "err"; f.textContent = e.message; box.appendChild(f); btn.querySelector("span").textContent = hintLabel(d); })
      .then(function () { btn.disabled = false; });
  }

  // --- bookmarks, progress, guide
  function viewBookmarks() {
    var list = Object.keys(S.bookmarks).sort(function (a, b) { return S.bookmarks[b] < S.bookmarks[a] ? -1 : 1; })
      .map(function (k) { return k.indexOf("mcq:") === 0 ? S.byMcq[k.slice(4)] : S.byId[k]; }).filter(Boolean);
    var html = '<div class="page"><div class="col"><div><div class="eyebrow">Bookmarks</div><div class="hero"><div><h1>Saved exercises</h1><p>Exercises and questions you bookmarked to come back to.</p></div></div></div>';
    html += list.length ? '<div class="dlist">' + list.map(function (d) { return row(d); }).join("") + "</div>" : '<div class="card empty">' + icon("bookmark") + '<div>No bookmarks yet.</div><p><a class="btn primary" href="#/levels">Browse the levels</a></p></div>';
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }
  function viewProgress() {
    var rk = rankInfo(), st = streak(), days = activeDays(), total = S.items.length;
    var html = '<div class="page"><div class="col"><div><div class="eyebrow">My Progress</div><div class="hero"><div><h1>Rank: ' + esc(rk.name) + "</h1><p>You're on Level " + currentLevel() + " · " + esc(levelOf(currentLevel()).title) + ". " + (rk.next ? plural(rk.toNext, "more exercise") + " to the next rank (" + esc(rk.next) + ")." : "Top rank reached.") + "</p></div></div></div>";
    html += '<div class="stat-row four">' + statCard("green", "check", "Completed", rk.done.toLocaleString() + " / " + total.toLocaleString(), null, "#/drills?status=done", pct(rk.done, total)) +
      statCard("purple", "flame", "Current Streak", plural(st.days, "day"), "best: " + plural(bestStreak(days), "day"), "#/progress") +
      statCard("blue", "target", "Today", st.today + " / " + dailyGoal(), "completed today (daily goal)", "#/progress") +
      statCard("orange", "clock", "In Progress", S.items.filter(isStarted).length.toString(), "started, not finished", "#/drills?status=prog") + "</div>";
    var cells = [], today = new Date(), start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - 7 * 17);
    for (var i = 0; i < 7 * 17 + today.getDay() + 1; i++) {
      var dd = new Date(start); dd.setDate(start.getDate() + i);
      var n = days[localDay(dd)] || 0;
      cells.push('<i class="' + (n ? "l" + Math.min(4, Math.ceil(n / 2)) : "") + '" title="' + dd.toDateString() + ": " + plural(n, "completion") + '"></i>');
    }
    html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("chart") + 'Activity <span class="muted small">(last 18 weeks)</span></h3></div><div class="heat">' + cells.join("") + '</div><div class="heat-legend">Less <i style="background:var(--soft)"></i><i style="background:#bcd3ff"></i><i style="background:#7fa9ff"></i><i style="background:#3d7cff"></i><i style="background:#1453d6"></i> More</div></section>';
    html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("levels") + "By level</h3></div>" + S.levels.map(function (L) { var l = itemsIn(L.n); return progRow("Level " + L.n + " · " + L.title, l.filter(isDone).length, l.length, "#/level/" + L.n); }).join("") + "</section>";
    html += '<div class="two"><section class="card card-pad"><div class="card-h"><h3>' + icon("gauge") + "By difficulty</h3></div>" + DIFF.map(function (df) { var l = S.items.filter(function (d) { return d.diff === df; }); return progRow(DIFF_LABEL[df], l.filter(isDone).length, l.length, "#/drills?diff=" + df); }).join("") + "</section>";
    html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("checkCircle") + "Multiple choice</h3></div>" + S.levels.map(function (L) { var l = mcqsIn([L.n]); return l.length ? progRow("Level " + L.n, l.filter(isDone).length, l.length, "#/quiz/level-" + L.n) : ""; }).join("") + "</section></div>";
    var recent = S.activity.slice(-10).reverse().map(function (a) { var it = a.id && (a.id.indexOf("mcq:") === 0 ? S.byMcq[a.id.slice(4)] : S.byId[a.id]); return it ? { d: it, at: a.at } : null; }).filter(Boolean);
    if (recent.length) html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("clock") + 'Recently completed</h3></div><div class="mini-list">' + recent.map(function (r) { return '<a href="' + href(r.d) + '"><span class="mn done">' + icon("check") + "</span><span>" + esc(r.d.title) + ' <span class="muted small">· ' + esc(levelName(r.d.level)) + " · " + fmtDate(r.at) + "</span></span></a>"; }).join("") + "</div></section>";
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }
  function progRow(label, a, b, link) { return '<a class="prow" href="' + link + '" style="color:inherit"><span>' + esc(label) + '</span><span class="bar"><span style="width:' + pct(a, b) + '%"></span></span><span class="pv">' + a + "/" + b + "</span></a>"; }
  function bestStreak(days) {
    var keys = Object.keys(days).sort(), best = 0, run = 0, prev = null;
    keys.forEach(function (k) { var d = new Date(k + "T12:00:00"); run = prev && (d - prev) / 864e5 < 1.5 ? run + 1 : 1; best = Math.max(best, run); prev = d; });
    return best;
  }
  var guideList = null;
  function viewGuide(section, item) {
    section = section || "commands";
    view.innerHTML = '<div class="page full"><div class="col"><div><div class="eyebrow">SQL Guide</div><div class="hero"><div><h1>SQL reference</h1><p>Common commands with examples, practice tips, and the "Start Here" guides.</p></div></div></div><div class="guide"><nav class="card guide-nav" id="guideNav"></nav><div class="col" id="guideBody"></div></div></div></div>';
    function nav() {
      $("#guideNav").innerHTML = "<h4>Reference</h4>" + '<a href="#/guide/commands" class="' + (section === "commands" ? "on" : "") + '">Common SQL commands</a><a href="#/guide/tips" class="' + (section === "tips" ? "on" : "") + '">Practice tips</a>' +
        (guideList && guideList.length ? "<h4>Start here</h4>" + guideList.map(function (g) { return '<a href="#/guide/doc/' + encodeURIComponent(g.name) + '" class="' + (section === "doc" && item === g.name ? "on" : "") + '">' + esc(g.title) + "</a>"; }).join("") : "");
    }
    if (!guideList) api("/api/course/guides").then(function (l) { guideList = l; nav(); }).catch(function () { guideList = []; });
    nav();
    var body = $("#guideBody");
    if (section === "tips") body.innerHTML = '<section class="card card-pad"><div class="card-h"><h3>' + icon("tips") + 'Practice tips</h3></div><ol class="tips">' + TIPS.map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("") + "</ol></section>";
    else if (section === "doc") {
      body.innerHTML = '<section class="card card-pad"><p class="muted">Loading…</p></section>';
      api("/api/course/guides/" + encodeURIComponent(item)).then(function (g) { body.innerHTML = '<section class="card card-pad"><h2 style="margin-bottom:12px">' + esc(g.title) + '</h2><div class="md">' + renderMarkdown(g.markdown) + "</div></section>"; }).catch(function (e) { body.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
    } else {
      body.innerHTML = CONCEPTS.map(function (c) { return '<section class="card cmd" id="cmd-' + c.id + '"><h3>' + esc(c.name) + "</h3><p>" + esc(c.text) + "</p><pre>" + highlight(c.sql) + "</pre></section>"; }).join("");
      if (item) { var el = $("#cmd-" + item); if (el) { el.scrollIntoView({ block: "start" }); el.classList.add("flash"); setTimeout(function () { el.classList.remove("flash"); }, 1800); } }
    }
  }

  // --- multiple choice: quick check, one question, quizzes
  function quizPicker() {
    return '<section class="card card-pad"><div class="card-h"><h3>' + icon("checkCircle") + 'Quick quiz</h3>' + (route.name === "mcqs" ? '<span class="muted small">Pick a level</span>' : '<a class="more link" href="#/mcqs">All ' + S.mcqs.length + " MCQs " + icon("chevRight") + "</a>") + "</div>" +
      '<div class="f-chips"><a class="chip on" href="#/quiz/mixed">' + icon("spark") + "Mixed (10 questions)</a>" + S.levels.filter(function (L) { return mcqsIn([L.n]).length; }).map(function (L) { return '<a class="chip" href="#/quiz/level-' + L.n + '">' + L.n + " · " + esc(L.title) + "</a>"; }).join("") + "</div></section>";
  }
  function quickCheck(d) {
    var pool = mcqsIn([d.level]);
    if (!pool.length) return "";
    var rnd = seeded(d.id), mixed = pool.slice();
    for (var i = mixed.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = mixed[i]; mixed[i] = mixed[j]; mixed[j] = t; }
    var pick = mixed.filter(function (m) { return !isDone(m); }).concat(mixed.filter(isDone)).slice(0, 3);
    return '<section class="card card-pad quick-check" id="quick-check"><div class="card-h"><h3>' + icon("checkCircle") + 'Quick check <span class="tag plain mcq-tag">Multiple choice</span></h3><a class="more link" href="#/quiz/level-' + d.level + '">Full quiz ' + icon("chevRight") + "</a></div>" +
      '<p class="muted small" style="margin:-4px 0 14px">' + pick.length + " questions on " + esc(levelOf(d.level).title) + ".</p>" +
      pick.map(function (m, k) { return '<div class="qc-item"><div class="qc-n">Question ' + (k + 1) + " of " + pick.length + "</div>" + mcqBlock(m, false, true) + "</div>"; }).join("") + "</section>";
  }
  function mcqBlock(m, quiz, inline) {
    return '<div class="mcq" data-mcq="' + m.id + '"' + (quiz ? ' data-quiz="1"' : "") + '><div class="mcq-q">' + esc(m.title) + "</div>" + (m.code ? '<pre class="mcq-code">' + highlight(m.code) + "</pre>" : "") +
      '<div class="opts" role="radiogroup" aria-label="Answers">' + m.options.map(function (o, k) { return '<button class="opt" role="radio" aria-checked="false" data-opt="' + k + '"><span class="key">' + "ABCDE".charAt(k) + "</span><span>" + esc(o) + "</span></button>"; }).join("") + "</div>" +
      '<div class="mcq-actions"><button class="btn primary" data-act="mcq-check" disabled>Check answer</button>' + (inline ? "" : '<span class="muted small">Keys A–' + "ABCDE".charAt(m.options.length - 1) + ' choose, Enter checks</span>') + '</div><div class="mcq-fb" hidden></div></div>';
  }
  function viewMcq(id) {
    var m = S.byMcq[id];
    if (!m) { view.innerHTML = '<div class="page full"><div class="card empty">That question doesn\'t exist. <a href="#/mcqs">All questions</a></div></div>'; return; }
    var ctx = S.lastList && S.lastList.indexOf(m) > -1 ? S.lastList : mcqsIn([m.level]), i = ctx.indexOf(m), prev = ctx[i - 1], next = ctx[i + 1];
    var html = '<div class="page"><div class="col"><div class="crumbs"><a href="#/mcqs">MCQ Practice</a>' + icon("chevRight") + '<a href="#/level/' + m.level + '">' + esc(levelName(m.level)) + "</a></div>";
    html += '<div class="dhead"><div><h1>Question ' + (i + 1) + ' <span class="muted" style="font-weight:600;font-size:16px">of ' + ctx.length + '</span></h1><div class="dmeta">' + diffBadge(m.diff) + statusHtml(m) + '<span class="tag">' + esc(levelName(m.level)) + '</span><span class="tag plain mcq-tag">Multiple choice</span></div></div>' +
      '<div class="acts"><button class="btn' + (S.bookmarks[m.key] ? " ghost-accent" : "") + '" data-bm-btn="' + m.key + '">' + icon("bookmark") + (S.bookmarks[m.key] ? "Bookmarked" : "Bookmark") + "</button>" +
      (prev ? '<a class="btn" href="' + href(prev) + '" aria-label="Previous question">' + icon("chevLeft") + "</a>" : "") + (next ? '<a class="btn" href="' + href(next) + '">Next ' + icon("chevRight") + "</a>" : "") + "</div></div>";
    html += '<section class="card card-pad">' + mcqBlock(m, false) + "</section>";
    html += '<section class="card card-pad quiz-intro"><div><h3>Quiz yourself on ' + esc(levelOf(m.level).title) + '</h3><p class="muted">Up to 10 questions in a row, with a score at the end.</p></div><a class="btn" href="#/quiz/level-' + m.level + '">' + icon("play") + "Start quiz</a></section>";
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }
  function shuffled(list) { var a = list.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function quizTitle(key) { var m = /^level-(\d+)$/.exec(key); return m ? levelName(Number(m[1])) : "Mixed levels"; }
  function newQuiz(key) {
    var m = /^level-(\d+)$/.exec(key), pool = m ? mcqsIn([Number(m[1])]) : S.mcqs;
    var fresh = shuffled(pool.filter(function (q) { return !isDone(q); })), seen = shuffled(pool.filter(isDone));
    S.quiz = { key: key, items: fresh.concat(seen).slice(0, 10), i: 0, results: [] };
  }
  function viewQuiz(key) {
    if (!S.quiz || S.quiz.key !== key) newQuiz(key);
    var Q = S.quiz, title = quizTitle(key);
    var html = '<div class="page"><div class="col"><div class="crumbs"><a href="#/mcqs">MCQ Practice</a>' + icon("chevRight") + "<span>Quiz</span></div>";
    if (!Q.items.length) html += '<div class="card empty">No questions for this quiz yet. <a href="#/mcqs">All multiple-choice questions</a></div>';
    else if (Q.i >= Q.items.length) {
      var right = Q.results.filter(Boolean).length, n = Q.items.length;
      var lvQuiz = /^level-(\d+)$/.exec(key);
      if (lvQuiz && n && right / n >= 0.7 && !(S.quizPassed && S.quizPassed[lvQuiz[1]])) {
        S.quizPassed = S.quizPassed || {}; S.quizPassed[lvQuiz[1]] = true;
        api("/api/progress", { qid: "quiz:level-" + lvQuiz[1], done: true }).catch(function () {});
      }
      html += '<div><div class="eyebrow">Quiz complete</div><h1 style="font-size:28px;margin:4px 0 0">' + esc(title) + "</h1></div>";
      html += '<section class="card card-pad quiz-score">' + ring(right / n, 132, 12, right + "/" + n, "correct") + "<div><h3>" + (right === n ? "Perfect score!" : right / n >= 0.7 ? "Well done!" : "Keep practising") + '</h3><p class="muted">You answered ' + right + " of " + n + " correctly (" + pct(right, n) + "%).</p>" +
        '<div class="f-chips"><button class="btn primary" data-act="quiz-again">' + icon("reset") + 'New quiz</button><a class="btn" href="#/mcqs">All questions</a></div></div></section>';
      html += '<div class="dlist">' + Q.items.map(function (m, k) { return '<a class="card drow quiz-res" href="' + href(m) + '"><span class="num ' + (Q.results[k] ? "done" : "bad") + '">' + icon(Q.results[k] ? "check" : "x") + '</span><div class="dmain"><div class="dtitle">' + esc(m.title) + '</div><div class="ddesc">Answer: ' + esc(m.options[m.answer]) + "</div></div>" + diffBadge(m.diff) + '<span class="tag">Level ' + m.level + '</span><span class="chev">' + icon("chevRight") + "</span></a>"; }).join("") + "</div>";
    } else {
      var m = Q.items[Q.i];
      html += '<div class="quiz-top"><div><div class="eyebrow">Quiz</div><h1 style="font-size:24px;margin:4px 0 0">' + esc(title) + '</h1></div><div class="quiz-meta"><span>Question <b>' + (Q.i + 1) + "</b> of " + Q.items.length + "</span><span>Score <b>" + Q.results.filter(Boolean).length + "</b></span></div></div>";
      html += '<span class="bar quiz-bar"><span style="width:' + pct(Q.i, Q.items.length) + '%"></span></span><section class="card card-pad">' + mcqBlock(m, true) + "</section>";
    }
    html += "</div>" + rail() + "</div>";
    view.innerHTML = html;
  }
  function mcqAnswer(block, k) {
    var m = S.byMcq[block.getAttribute("data-mcq")], quiz = block.hasAttribute("data-quiz");
    var opts = block.querySelectorAll(".opt"), fb = block.querySelector(".mcq-fb"), checkBtn = block.querySelector('[data-act="mcq-check"]');
    var right = k === m.answer, reveal = right || quiz;
    learnAnswered("mcq", m.id, right);
    opts[k].classList.add(right ? "right" : "wrong");
    if (reveal) { block.classList.add("locked"); opts[m.answer].classList.add("right"); checkBtn.hidden = true; }
    if (right) markDone(m); else store("sqldrills.mcqTried." + m.id, 1);
    fb.hidden = false;
    fb.className = "mcq-fb " + (right ? "ok" : "bad");
    var nextBtn = "";
    if (quiz) { S.quiz.results[S.quiz.i] = right; nextBtn = '<button class="btn primary" data-act="quiz-next">' + (S.quiz.i + 1 < S.quiz.items.length ? "Next question " + icon("chevRight") : "See results") + "</button>"; }
    fb.innerHTML = "<strong>" + icon(right ? "checkCircle" : "target") + (right ? "Correct!" : quiz ? "Not quite: the answer is " + "ABCDE".charAt(m.answer) + "." : "Not quite.") + "</strong>" +
      (!right && m.whyWrong && m.whyWrong[k] ? '<p class="why-wrong"><b>Why not ' + "ABCDE".charAt(k) + ":</b> " + esc(m.whyWrong[k]) + "</p>" : "") +
      (reveal ? "<p>" + esc(m.why) + "</p>" : '<p>Have another look, or reveal the answer.</p><div class="f-chips"><button class="btn sm" data-act="mcq-retry">Try again</button><button class="btn sm" data-act="mcq-reveal">Show answer</button></div>') +
      (nextBtn ? '<div class="f-chips">' + nextBtn + "</div>" : "");
    if (quiz && nextBtn) fb.querySelector('[data-act="quiz-next"]').focus();
    var pill = view.querySelector(".dhead .pill");
    if (pill && route.name === "mcq") pill.outerHTML = statusHtml(m);
  }
  function mcqSelect(block, k) {
    if (block.classList.contains("locked") || !block.querySelector(".mcq-fb").hidden) return;
    block.querySelectorAll(".opt").forEach(function (o, i) { o.classList.toggle("sel", i === k); o.setAttribute("aria-checked", String(i === k)); });
    block.querySelector('[data-act="mcq-check"]').disabled = false;
  }
  view.addEventListener("click", function (e) {
    var block = e.target.closest(".mcq");
    if (!block) { if (e.target.closest('[data-act="quiz-again"]')) { newQuiz(S.quiz.key); render(); } return; }
    var opt = e.target.closest(".opt");
    if (opt) { mcqSelect(block, Number(opt.getAttribute("data-opt"))); return; }
    var a = e.target.closest("[data-act]");
    a = a && a.getAttribute("data-act");
    var sel = block.querySelector(".opt.sel");
    if (a === "mcq-check" && sel) mcqAnswer(block, Number(sel.getAttribute("data-opt")));
    else if (a === "mcq-retry") { block.querySelectorAll(".opt").forEach(function (o) { o.classList.remove("wrong", "sel"); o.setAttribute("aria-checked", "false"); }); block.querySelector(".mcq-fb").hidden = true; block.querySelector('[data-act="mcq-check"]').disabled = true; }
    else if (a === "mcq-reveal") {
      var m = S.byMcq[block.getAttribute("data-mcq")];
      block.classList.add("locked");
      block.querySelectorAll(".opt")[m.answer].classList.add("right");
      block.querySelector('[data-act="mcq-check"]').hidden = true;
      var fb = block.querySelector(".mcq-fb");
      fb.className = "mcq-fb bad";
      fb.innerHTML = "<strong>" + icon("target") + "The answer is " + "ABCDE".charAt(m.answer) + ".</strong><p>" + esc(m.why) + "</p>";
    } else if (a === "quiz-next") { S.quiz.i++; render(); }
  });
  document.addEventListener("keydown", function (e) {
    if (!/^(mcq|quiz)$/.test(route.name) || e.ctrlKey || e.metaKey || e.altKey || e.target.closest("input,textarea,select")) return;
    var block = view.querySelector(".mcq");
    if (!block) return;
    var k = "abcde".indexOf(e.key.toLowerCase());
    if (k < 0 && /^[1-4]$/.test(e.key)) k = Number(e.key) - 1;
    if (k > -1) { mcqSelect(block, k); return; }
    if (e.key === "Enter" && (!e.target.closest("button,a") || e.target.closest(".opt"))) {
      e.preventDefault();
      var next = block.querySelector('[data-act="quiz-next"]');
      if (next) { next.click(); return; }
      var check = block.querySelector('[data-act="mcq-check"]');
      if (check && !check.disabled && !check.hidden) check.click();
    }
  });

  // ---------- router ----------
  // ---------- the 5-stage learning model: MEMORIZE → UNDERSTAND → PRACTISE → REFLECT → TRANSFER ----------
  // Numbers come from /api/learn (library/learn.js); only approved (published) content reaches this page.
  var STAGES = ["memorize", "understand", "practise", "reflect", "transfer"];
  var STAGE_LABEL = { memorize: "Memorize", understand: "Understand", practise: "Practise", reflect: "Reflect", transfer: "Transfer" };
  var STAGE_ICON = { memorize: "cards", understand: "bulb", practise: "play", reflect: "note", transfer: "compass" };
  // the concept page's tabs: the optional Study step, then the five stages (only the stages count for mastery)
  var CTABS = ["study"].concat(["memorize", "understand", "practise", "reflect", "transfer"]);
  var STAGE_STATUS = { done: "done", started: "in progress", todo: "not started", locked: "locked", na: "not part of this concept" };
  S.learn = { levels: {}, concept: {}, today: null, notesQ: "" };
  function learnApi(path, body) { return api("/api/learn" + path, body); }
  function learnEvent(kind, ref) { S.activity.push({ id: "learn:" + kind + ":" + ref, at: new Date().toISOString() }); renderChrome(); }
  function reflectAiOn() { return store("sqldrills.reflectAi") === "1"; }
  // a ring of 5 segments, one per stage; the same information is always given in text next to it
  function stageRing(st, size, center) {
    size = size || 44;
    var stroke = size >= 80 ? 9 : 6, r = (size - stroke) / 2, c = 2 * Math.PI * r, seg = c / 5, gap = Math.min(5, seg * 0.14), h = size / 2;
    var label = STAGES.map(function (k) { return STAGE_LABEL[k] + ": " + STAGE_STATUS[st[k]]; }).join(", ");
    return '<svg class="sring" width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + " " + size + '" role="img" aria-label="' + esc(label) + '">' +
      STAGES.map(function (k, i) {
        return '<circle class="sr-seg ' + st[k] + '" cx="' + h + '" cy="' + h + '" r="' + r + '" fill="none" stroke-width="' + stroke + '" stroke-dasharray="' + (seg - gap).toFixed(2) + " " + (c - seg + gap).toFixed(2) + '" stroke-dashoffset="' + (-i * seg).toFixed(2) + '" transform="rotate(-90 ' + h + " " + h + ')"/>';
      }).join("") + (center ? '<text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" class="ring-txt" font-size="' + Math.round(size / 4.2) + '">' + esc(center) + "</text>" : "") + "</svg>";
  }
  // a mastered concept keeps its mastery; items approved later show as new
  var NEW_LABEL = { flashcards: "flashcards", practise: "practise exercises", transfer: "a transfer task" };
  function newItemsHtml(c) { return (c.newItems || []).map(function (k) { return ' <span class="pill prog new-pill">New: ' + NEW_LABEL[k] + " available</span>"; }).join(""); }
  function stagesDone(st) { return STAGES.filter(function (k) { return st[k] === "done"; }).length; }
  function stagesUsed(st) { return STAGES.filter(function (k) { return st[k] !== "na"; }).length; }
  function stageMark(s) { return s === "done" ? icon("check") : s === "locked" ? icon("lock") : s === "started" ? '<span class="sm-dot half" aria-hidden="true"></span>' : s === "na" ? '<span class="sm-dot na" aria-hidden="true"></span>' : '<span class="sm-dot" aria-hidden="true"></span>'; }
  function loadLevelLearn(n, then) {
    return learnApi("/levels/" + n).then(function (L) { S.learn.levels[n] = L; if (then) then(L); }).catch(function (e) { S.learn.levels[n] = { error: e.message }; if (then) then(null); });
  }
  // level page: the concepts with their stage rings
  function levelConceptsHtml(n) {
    var L = S.learn.levels[n];
    if (!L) { loadLevelLearn(n, function () { if (route.name === "level" && Number(route.args[0]) === n) { var box = $("#lvConcepts"); if (box) box.outerHTML = levelConceptsHtml(n); var lc = $("#lvComplete"); if (lc) lc.outerHTML = levelComplete(n, itemsIn(n), itemsIn(n).filter(isDone).length, mcqsIn([n])) || '<div id="lvComplete"></div>'; } }); return '<section class="card card-pad" id="lvConcepts" aria-busy="true"><p class="muted small">Loading concepts…</p></section>'; }
    if (L.error) return '<section class="card card-pad" id="lvConcepts"><div class="err">Couldn\'t load the concepts: ' + esc(L.error) + "</div></section>";
    var need = Math.ceil(L.total * 0.8);
    return '<section class="card card-pad lv-concepts" id="lvConcepts" aria-labelledby="lvc-h"><div class="card-h"><h3 id="lvc-h">' + icon("layers") + "Concepts</h3>" +
      '<span class="muted small lvc-sum"><b class="mono">' + L.masteredCount + "</b> of " + L.total + " mastered · " + need + " needed to complete the level</span></div>" +
      '<p class="muted small lvc-legend">Each ring has five parts: ' + STAGES.map(function (k) { return STAGE_LABEL[k]; }).join(" → ") + ". Open a concept to work through them.</p>" +
      '<ol class="concept-list">' + L.concepts.map(function (c) {
        var done = stagesDone(c.stages), used = stagesUsed(c.stages);
        return '<li><a class="concept-row" href="#/concept/' + esc(c.slug) + '">' + stageRing(c.stages, 46, c.mastered ? "✓" : String(done)) +
          '<span class="cr-main"><span class="cr-name">' + esc(c.name) + (c.mastered ? ' <span class="pill done">' + icon("checkCircle") + "Mastered</span>" + newItemsHtml(c) : "") + '</span><span class="cr-sum">' + esc(c.summary || "") + "</span>" +
          '<span class="cr-stages">' + STAGES.map(function (k) { return '<span class="cr-st ' + c.stages[k] + '">' + stageMark(c.stages[k]) + STAGE_LABEL[k] + '<span class="sr-only">: ' + STAGE_STATUS[c.stages[k]] + "</span></span>"; }).join("") + "</span></span>" +
          '<span class="cr-count mono" aria-hidden="true">' + done + "/" + used + '</span><span class="chev" aria-hidden="true">' + icon("chevRight") + "</span></a></li>";
      }).join("") + "</ol></section>";
  }

  // ---------- concept page ----------
  // A card the learner has started (typed in, chosen, flipped, checked) is never re-rendered by a background refresh:
  // the fresh data waits in the cache and shows when they switch tabs or leave the page.
  function markStarted(e) {
    var t = e.target;
    if (!t.closest || t.closest("[data-ctab], [data-concept-seen], a[href]")) return;
    if (e.type === "click" && !t.closest("input, select, textarea, button, label, summary")) return;
    var card = t.closest(".card, .predict, .xcard");
    if (card && view.contains(card)) card.setAttribute("data-started", "1");
  }
  ["input", "change", "click"].forEach(function (ev) { view.addEventListener(ev, markStarted, true); });
  function cardsInProgress() { return !!view.querySelector("[data-started]"); }
  /** Reload a concept in the background; re-render only when no card on the page has been started. */
  function refreshConcept(slug) {
    return loadConcept(slug).then(function () {
      if (route.name !== "concept" || route.args[0] !== slug) return;
      if (cardsInProgress()) { S.deferredConcept = slug; return; }
      viewConcept(slug);
    });
  }
  function loadConcept(slug) { return learnApi("/concept/" + encodeURIComponent(slug)).then(function (c) { S.learn.concept[slug] = c; return c; }); }
  function viewConcept(slug) {
    var c = S.learn.concept[slug];
    if (!c || c.slug !== slug || viewConcept.stale) {
      viewConcept.stale = false;
      if (!c) view.innerHTML = '<div class="page full"><div class="col"><div class="card card-pad" aria-busy="true"><p class="muted">Loading the concept…</p></div></div></div>';
      (c ? refreshConcept(slug) : loadConcept(slug).then(function () { if (route.name === "concept" && route.args[0] === slug) viewConcept(slug); })).catch(function (e) {
        view.innerHTML = '<div class="page full"><div class="col"><div class="card empty">' + icon("x") + "<div>" + esc(e.message) + ' · <a href="#/levels">Back to the levels</a></div></div></div></div>';
      });
      if (!c) return;
    }
    var tab = (route.q && route.q.get("tab")) || STAGES.filter(function (k) { return c.stages[k] !== "done" && c.stages[k] !== "na" && c.stages[k] !== "locked"; })[0] || "understand";
    if (CTABS.indexOf(tab) < 0) tab = "understand";
    var L = levelOf(c.level), idx = c.siblings.map(function (x) { return x.slug; }).indexOf(c.slug), prev = c.siblings[idx - 1], next = c.siblings[idx + 1];
    var html = '<div class="page full"><div class="col concept-page">';
    html += '<div class="crumbs"><a href="#/levels">Levels</a>' + icon("chevRight") + '<a href="#/level/' + c.level + '">Level ' + c.level + " · " + esc(L ? L.title : "") + "</a>" + icon("chevRight") + "<span>" + esc(c.name) + "</span></div>";
    html += '<section class="card card-pad concept-head">' + stageRing(c.stages, 92, stagesDone(c.stages) + "/" + stagesUsed(c.stages)) +
      '<div class="ch-body"><div class="eyebrow">Concept ' + (idx + 1) + " of " + c.siblings.length + " · Level " + c.level + "</div><h1>" + esc(c.name) + (c.mastered ? ' <span class="pill done">' + icon("checkCircle") + "Mastered</span>" + newItemsHtml(c) : "") + '</h1><p class="muted">' + esc(c.summary || "") + "</p>" + masteryList(c) + "</div>" +
      '<div class="acts">' + (prev ? '<a class="btn" href="#/concept/' + esc(prev.slug) + '" aria-label="Previous concept: ' + esc(prev.name) + '">' + icon("chevLeft") + "</a>" : "") + (next ? '<a class="btn" href="#/concept/' + esc(next.slug) + '">Next concept ' + icon("chevRight") + "</a>" : "") + "</div></section>";
    html += '<div class="tabs stage-tabs" role="tablist" aria-label="Stages">' + CTABS.map(function (k) {
      if (k === "study") return '<button role="tab" id="tab-study" aria-controls="panel-study" aria-selected="' + (tab === k) + '" tabindex="' + (tab === k ? 0 : -1) + '" class="st-tab study' + (tab === k ? " on" : "") + '" data-ctab="study"><span class="st-mark">' + icon("file") + "</span>Study" + '<span class="sr-only"> (optional reading' + ((c.lessons || []).length ? "" : ", no lesson yet") + ")</span></button>";
      var s = c.stages[k];
      return '<button role="tab" id="tab-' + k + '" aria-controls="panel-' + k + '" aria-selected="' + (tab === k) + '" tabindex="' + (tab === k ? 0 : -1) + '" class="st-tab ' + s + (tab === k ? " on" : "") + '" data-ctab="' + k + '">' +
        '<span class="st-mark">' + stageMark(s) + "</span>" + STAGE_LABEL[k] + '<span class="sr-only"> (' + STAGE_STATUS[s] + ")</span></button>";
    }).join("") + "</div>";
    html += '<section class="stage-panel" role="tabpanel" id="panel-' + tab + '" aria-labelledby="tab-' + tab + '" tabindex="0">' + stagePanel(c, tab) + "</section>";
    html += "</div></div>";
    view.innerHTML = html;
    schemaMount(view);
  }
  function masteryList(c) {
    var k = c.counts, l14 = c.level === 14, rows;
    if (l14) rows = [
      [k.reflections > 0, "A reflection written"],
      [k.transfer.total > 0 && k.transfer.passed >= Math.min(2, k.transfer.total), "2 project tasks passed (" + Math.min(k.transfer.passed, 2) + "/" + Math.min(2, k.transfer.total || 2) + ")"],
    ];
    else rows = [
      [!k.flash.total || k.flash.atLeast3 >= k.flash.total, k.flash.total ? "Flashcards at the 3-day gap or better (" + k.flash.atLeast3 + "/" + k.flash.total + ")" : "Flashcards: none approved yet (not required)"],
      [!k.practise.set || k.practise.setDone >= k.practise.set, "Practise set solved" + (k.practise.hardInSet ? ", with 1 Hard" : "") + " (" + k.practise.setDone + "/" + k.practise.set + ")"],
      [k.reflections > 0, "A reflection written"],
      [!k.transfer.total || k.transfer.passed >= 1, k.transfer.total ? "A transfer task passed (" + Math.min(k.transfer.passed, 1) + "/1)" : "Transfer: none approved yet (not required)"],
    ];
    return '<ul class="mastery-list" aria-label="Mastery">' + rows.map(function (r) { return '<li class="' + (r[0] ? "ok" : "") + '">' + (r[0] ? icon("check") : '<span class="sm-dot" aria-hidden="true"></span>') + "<span>" + esc(r[1]) + '<span class="sr-only">' + (r[0] ? " (met)" : " (not yet)") + "</span></span></li>"; }).join("") + "</ul>";
  }
  function itemRows(ids) { return ids.map(function (id) { return S.byId[id]; }).filter(Boolean).map(function (d) { return compactRow(d); }).join(""); }
  function viewLicenses() {
    view.innerHTML = '<div class="page full"><div class="col"><div class="crumbs"><a href="#/home">Home</a>' + icon("chevRight") + "<span>Licenses</span></div>" +
      '<section class="card card-pad licenses"><h1>Licenses</h1><p class="muted">Some lessons in this app are based on open material published under the MIT License. Its notice:</p>' +
      '<pre class="license-text">MIT License\n\nCopyright (c) 2024 s-shemmee\n\nPermission is hereby granted, free of charge, to any person obtaining a copy\nof this software and associated documentation files (the "Software"), to deal\nin the Software without restriction, including without limitation the rights\nto use, copy, modify, merge, publish, distribute, sublicense, and/or sell\ncopies of the Software, and to permit persons to whom the Software is\nfurnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all\ncopies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR\nIMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,\nFITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE\nAUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER\nLIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,\nOUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE\nSOFTWARE.</pre></section></div></div>';
  }
  // the tables a piece of SQL runs on (the schema panel), unless the SQL creates its own tables
  function tablesPanel(dataset, sql, open) {
    if (!dataset || /\bCREATE\s+(TEMP(ORARY)?\s+)?TABLE\b/i.test(String(sql || ""))) return "";
    return schemaPanel({ kind: "sqlite", key: dataset }, { open: !!open, hint: "its tables first", sql: String(sql || "") });
  }
  // a lesson's example: the query, its real result and the explanation (or the special formats, via lessonExample)
  function exampleBox(l) {
    var ex = l.example || {};
    return (ex.format ? '<h3 class="ls-sub">Example</h3>' + lessonExample(ex) + (l.explain ? '<p class="ls-explain">' + lessonText(l.explain) + "</p>" : "") : "") +
      (ex.sql && !ex.format ? '<h3 class="ls-sub">Example</h3><pre class="mcq-code">' + highlight(ex.sql) + '</pre><div class="muted small">The real result' + (ex.engine ? " (" + esc(ex.engine) + ")" : "") + "</div>" + miniTable({ columns: ex.columns, rows: ex.rows }) + (ex.total > (ex.rows || []).length ? '<div class="muted small">… and ' + (ex.total - ex.rows.length) + " more rows</div>" : "") + (l.explain ? '<p class="ls-explain">' + lessonText(l.explain) + "</p>" : "") : "");
  }
  function lessonCard(l, opts) {
    var ex = l.example || {}, withTables = !(opts && typeof opts === "object" && opts.noTables);
    return '<article class="card card-pad lesson" aria-labelledby="ls-' + esc(l.id) + '"><h2 class="ls-h" id="ls-' + esc(l.id) + '">' + icon("file") + esc(l.title) + "</h2>" +
      '<h3 class="ls-sub">What it is</h3><p>' + lessonText(l.what) + "</p>" +
      ((l.when || []).length ? '<h3 class="ls-sub">When to use it</h3><ul class="ls-when">' + l.when.map(function (w) { return "<li>" + lessonText(w) + "</li>"; }).join("") + "</ul>" : "") +
      exampleBox(l) +
      (l.tip ? '<div class="self-note ls-tip">' + icon("bulb") + "<div><strong>Watch out.</strong> " + lessonText(l.tip) + "</div></div>" : "") +
      (withTables ? tablesPanel(l.dataset, ex.sql || (ex.before && ex.before.sql), true) : "") + "</article>";
  }
  // the extra example formats: a script whose failing statement is the point, wrong vs fixed (or run once vs twice),
  // and an illustrative snippet that is not run here (no output shown)
  function lessonExample(ex) {
    var more = function (r) { return r.total > (r.rows || []).length ? '<div class="muted small">… and ' + (r.total - r.rows.length) + " more rows</div>" : ""; };
    if (ex.format === "notrun") return '<pre class="mcq-code">' + highlight(ex.sql) + '</pre><p class="ls-notrun">' + icon("lock") + "<span><b>Not run here</b> (" + esc(ex.notRun) + "): an illustration only, so no result is shown.</span></p>";
    if (ex.format === "error") return '<pre class="mcq-code">' + highlight(numberedScript(ex.sql)) + '</pre><div class="muted small">What really happens (' + esc(ex.engine || "MySQL") + ")</div>" + outcomeHtml({ kind: "error", failsAt: ex.error.failsAt, error: ex.error.message });
    var block = function (b, sql) { return '<div class="ls-ba"><div class="ls-ba-h">' + esc(b.label) + "</div>" + (sql ? '<pre class="mcq-code">' + highlight(sql) + "</pre>" : "") + miniTable({ columns: b.columns, rows: b.rows }) + more(b) + "</div>"; };
    return '<details class="ls-setup"><summary class="small">The small table it uses</summary><pre class="mcq-code">' + highlight(ex.setup || "") + "</pre></details>" +
      (ex.format === "twice" ? '<div class="muted small">The pipeline (run once, then again)</div><pre class="mcq-code">' + highlight(ex.sql) + '</pre><div class="muted small">Then: <span class="mono">' + esc(ex.check) + "</span></div>" : "") +
      '<div class="ls-ba-grid">' + block(ex.before, ex.format === "twice" ? "" : ex.before.sql) + block(ex.after, ex.format === "twice" ? "" : ex.after.sql) + "</div>";
  }
  // lesson text: plain, with `code` spans
  function lessonText(t) { return esc(t || "").replace(/`([^`]+)`/g, '<code class="mono">$1</code>'); }
  function stagePanel(c, tab) {
    var k = c.counts;
    if (tab === "study") {
      var ls = c.lessons || [];
      return '<p class="muted small study-note">' + icon("file") + "Optional reading: a short lesson before you practise. It doesn't count towards mastery.</p>" +
        (ls.length ? ls.map(lessonCard).join("") : emptyStage("file", "No lesson for this concept yet: it appears here once it is approved.", tabAction(c, c.level === 14 ? "understand" : "memorize", c.level === 14 ? "Go to Understand" : "Go to Memorize")));
    }
    if (tab === "memorize") {
      if (c.level === 14) return emptyStage("cards", "Level 14 has no flashcards: its concepts are learned through the projects (Understand, Reflect and Transfer).", tabAction(c, "understand", "Go to Understand"));
      var mc = (c.mcqs.memorize || []).filter(function (id) { return S.byMcq[id]; });
      if (!c.flashcards.length) return emptyStage("cards", "No flashcards for this concept yet: they appear here once they are approved.", mc.length ? null : tabAction(c, "understand", "Go to Understand")) + mcqLinks(mc, "Quick check");
      var due = c.flashcards.filter(function (f) { return f.state && f.state.due_at <= new Date().toISOString(); }).length, fresh = c.flashcards.filter(function (f) { return !f.state; }).length;
      return '<div class="card card-pad"><div class="card-h"><h3>' + icon("cards") + "Flashcards</h3></div>" +
        '<p class="muted">Cards come back after 1, 3, 7 and 14 days; a wrong answer brings a card back tomorrow. Mastery needs every card at the 3-day gap or better.</p>' +
        '<div class="fc-stats"><span><b class="mono">' + c.flashcards.length + "</b> cards</span><span><b class=\"mono\">" + k.flash.atLeast3 + "</b> at 3 days or more</span><span><b class=\"mono\">" + due + "</b> due</span><span><b class=\"mono\">" + fresh + "</b> new</span></div>" +
        '<div class="actions"><a class="btn primary" href="#/flashcards?concept=' + esc(c.slug) + '"' + (due + fresh ? "" : ' aria-disabled="true"') + ">" + icon("play") + (due + fresh ? "Start a session (" + (due + fresh) + " cards)" : "Nothing due: practise anyway") + "</a></div>" +
        '<ul class="fc-list">' + c.flashcards.map(function (f) {
          return "<li><span>" + esc(cardFront(f)) + '</span><span class="muted small">' + (f.state ? "next " + fmtDate(f.state.due_at) + " · " + f.state.interval + "-day gap" : "new") + "</span></li>";
        }).join("") + "</ul></div>" + mcqLinks(mc, "Quick check");
    }
    if (tab === "understand") {
      var seen = k.understand.seen, mu = (c.mcqs.understand || []).filter(function (id) { return S.byMcq[id]; });
      var html = '<div class="card card-pad concept-card"><div class="card-h"><h3>' + icon("bulb") + "Concept card</h3>" + (seen ? '<span class="pill done">' + icon("check") + "Read</span>" : "") + "</div>" +
        '<p class="cc-sum">' + esc(c.summary || "") + "</p>" + (keywordsOf(c).length ? '<div class="cc-keys">' + keywordsOf(c).map(function (w) { return '<span class="tag mono">' + esc(w) + "</span>"; }).join("") + "</div>" : "") +
        exampleOf(c) + (seen ? "" : '<div class="actions"><button class="btn ok" data-concept-seen="' + esc(c.slug) + '">' + icon("check") + "I've read this</button></div>") + "</div>";
      html += '<div class="card-h"><h3>' + icon("target") + "Predict the output</h3><span class=\"muted small\">" + k.understand.correct + " of " + c.predicts.length + " right" + (c.predicts.length ? " · " + Math.min(2, c.predicts.length) + " needed" : "") + "</span></div>";
      html += c.predicts.length ? c.predicts.map(predictCard).join("") : emptyStage("target", "No predict-the-output items for this concept yet: they appear here once they are approved.", tabAction(c, c.level === 14 ? "transfer" : "practise", c.level === 14 ? "Go to Transfer" : "Go to Practise"));
      var xcs = (c.cards || []).filter(function (x) { return window.Cards && Cards.STANDALONE.indexOf(x.card_type) > -1; });
      return html + mcqLinks(mu, "Why and what happens") + (xcs.length ? '<div class="card-h xc-sec"><h3>' + icon("layers") + 'More practice</h3><span class="muted small">Optional: doesn\'t count towards mastery</span></div>' + xcs.map(function (x) { return xcardHtml(x); }).join("") : "");
    }
    if (tab === "practise") {
      if (c.level === 14) return emptyStage("play", "Level 14 has no separate practise: its exercises are project tasks, under Transfer.", tabAction(c, "transfer", "Go to Transfer"));
      if (!c.practiseSet.length) return emptyStage("play", "No exercises are tagged with this concept yet.", ["#/level/" + c.level, "Open the Level " + c.level + " exercises"]);
      return '<section class="card card-pad"><div class="card-h"><h3>' + icon("play") + 'Practise set</h3><span class="muted small">Easy → Medium → Hard · ' + k.practise.setDone + " of " + k.practise.set + " done</span></div>" +
        '<p class="muted small">Solve these ' + c.practiseSet.length + (k.practise.hardInSet ? " (one of them Hard)" : "") + " for mastery; finishing them unlocks Transfer.</p>" +
        '<div class="clist">' + itemRows(c.practiseSet) + "</div></section>" +
        (c.practiseMore.length ? '<section class="card card-pad"><div class="card-h"><h3>' + icon("list") + 'More practice</h3><span class="muted small">' + c.practiseMore.length + " exercises, easiest first</span></div><div class=\"clist\">" + itemRows(c.practiseMore.slice(0, S.morePractice === c.slug ? 1e4 : 10)) + "</div>" +
          (c.practiseMore.length > 10 && S.morePractice !== c.slug ? '<div class="actions"><button class="btn sm" data-more-practice="' + esc(c.slug) + '">Show all ' + c.practiseMore.length + "</button></div>" : "") + "</section>" : "");
    }
    if (tab === "reflect") {
      return reflectForm({ concept: c.slug, title: "Reflect on " + c.name, prompt: "Explain " + c.name + " in one sentence, in your own words" }) +
        '<div class="card-h"><h3>' + icon("note") + 'Your reflections</h3><a class="more link" href="#/notes">All my notes ' + icon("chevRight") + "</a></div>" +
        (c.reflections.length ? c.reflections.map(noteCard).join("") : emptyStage("note", "Nothing yet. Write one sentence in the box above, or solve an exercise: a short Reflect box then asks for one, and it lands here and in My notes.", c.level === 14 ? tabAction(c, "transfer", "Go to Transfer") : tabAction(c, "practise", "Go to Practise")));
    }
    // transfer
    var nextC = c.siblings[c.siblings.map(function (x) { return x.slug; }).indexOf(c.slug) + 1];
    if (!c.transferItems.length) return emptyStage("compass", c.level === 14 ? "No project tasks are tagged with this concept." : "No transfer task for this concept yet: one appears here once it is approved.", nextC ? ["#/concept/" + encodeURIComponent(nextC.slug), "Next concept: " + nextC.name] : ["#/level/" + c.level, "Back to Level " + c.level]);
    if (!c.transferUnlocked) return '<section class="card card-pad locked-stage">' + icon("lock") + "<div><h3>Transfer is locked</h3><p class=\"muted\">It unlocks when you finish the practise set: " + k.practise.setDone + " of " + k.practise.set + ' done.</p><a class="btn primary" href="#/concept/' + esc(c.slug) + '?tab=practise">Go to the practise set</a></div></section>';
    return '<section class="card card-pad"><div class="card-h"><h3>' + icon("compass") + (c.level === 14 ? "Project tasks" : "Transfer tasks") + '</h3><span class="muted small">' + k.transfer.passed + " passed" + (c.level === 14 ? " · 2 needed for mastery" : " · 1 needed for mastery") + "</span></div>" +
      '<p class="muted small">' + (c.level === 14 ? "Use the concept inside a realistic project." : "The concept on a new dataset, as a business question. If one fails, this concept's practise set comes back in Review mistakes.") + '</p><div class="clist">' + itemRows(c.transferItems.slice(0, 60)) + "</div>" +
      transferSchemas(c.transferItems) +
      (c.transferItems.length > 60 ? '<p class="muted small">' + (c.transferItems.length - 60) + ' more in <a href="#/level/' + c.level + '">the level list</a>.</p>' : "") + "</section>";
  }
  function transferSchemas(ids) {
    // one panel per dataset: a SQLite dataset in the browser, or a course schema read on the server (via its first task)
    var seen = {}, srcs = [];
    ids.slice(0, 60).forEach(function (id) { var d = S.byId[id]; if (!d || !d.dataset) return; var k = (d.engine === "server" ? "s:" : "l:") + d.dataset; if (seen[k]) return; seen[k] = 1; srcs.push(d.engine === "server" ? { kind: "server", item: d.id, dialect: dialect() } : { kind: "sqlite", key: d.dataset }); });
    return srcs.slice(0, 3).map(function (src) { return schemaPanel(src, { hint: srcs.length > 1 ? "a dataset of these tasks" : "the dataset of these tasks" }); }).join("");
  }
  function keywordsOf(c) { var k = c.keywords; try { k = JSON.parse(k); } catch (e) {} return (Array.isArray(k) ? k : String(k || "").split(/,\s*/)).filter(Boolean); }
  function emptyStage(ic, text, action) { return '<div class="card empty">' + icon(ic) + "<div><p>" + esc(text) + "</p>" + (action ? '<a class="btn sm" href="' + action[0] + '">' + esc(action[1]) + " " + icon("chevRight") + "</a>" : "") + "</div></div>"; }
  // the next step on a concept page: another tab of the same concept
  function tabAction(c, tab, label) { return ["#/concept/" + encodeURIComponent(c.slug) + "?tab=" + tab, label]; }
  function mcqLinks(ids, label) {
    if (!ids.length) return "";
    return '<section class="card card-pad"><div class="card-h"><h3>' + icon("checkCircle") + esc(label) + '</h3><span class="muted small">' + plural(ids.length, "multiple-choice question") + '</span></div><div class="clist">' + ids.map(function (id) { return compactRow(S.byMcq[id]); }).join("") + "</div></section>";
  }
  function cardFront(f) { return f.type === "keyword" ? f.front : f.type === "blank" ? (f.prompt || "Fill in the blank") + ": " + f.sql : f.type === "order" ? (f.prompt || "Put the clauses in order") + " (" + f.parts.length + " parts)" : (f.prompt || "Spot the error") + ": " + String(f.wrong_sql || "").split("\n")[0]; }
  function exampleOf(c) {
    var f = (c.flashcards || []).filter(function (x) { return x.type === "blank" || x.type === "order"; })[0];
    var sql = f ? (f.type === "blank" ? String(f.sql).replace("___", f.answer) : f.parts.join(" ")) : c.predicts && c.predicts[0] ? c.predicts[0].sql : "";
    return sql ? '<div class="cc-ex"><div class="muted small">Example</div><pre class="mcq-code">' + highlight(formatSql(sql)) + "</pre></div>" : "";
  }

  // ---------- predict the output ----------
  function miniTable(r) {
    if (!r || !r.columns) return "";
    return '<div class="tbl-wrap po-tbl"><table class="grid"><thead><tr>' + r.columns.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      (r.rows.length ? r.rows.map(function (row) { return "<tr>" + row.map(function (v) { return "<td" + (v == null ? ' class="null"' : "") + ">" + (v == null ? "NULL" : esc(v)) + "</td>"; }).join("") + "</tr>"; }).join("") : '<tr><td colspan="' + r.columns.length + '" class="muted">(no rows)</td></tr>') + "</tbody></table></div>";
  }
  // the input: every table the query reads, limited to the rows it uses
  function inputsHtml(p) {
    if (!p.shows || !p.shows.length) return '<div class="muted small">Input rows</div>' + miniTable(p.show);
    return p.shows.map(function (s) { return '<div class="muted small">Input: <b class="mono">' + esc(s.table) + "</b> (" + plural(s.rows.length, "row") + ")</div>" + miniTable(s); }).join("");
  }
  // predict the end state: an outcome is final rows, "statement N fails: error", or "no statement fails"
  function outcomeHtml(o) {
    if (!o) return "";
    if (o.kind === "rows") return miniTable(o.rows);
    if (o.kind === "error") return '<p class="po-outcome"><b>Statement ' + o.failsAt + " fails:</b> <span class=\"mono\">" + esc(String(o.error).replace(/\b(?:sqlscratch_[a-z0-9_]+|es_[0-9a-f]{10})\./gi, "")) + "</span></p>";
    return '<p class="po-outcome"><b>No statement fails:</b> the script runs to the end.</p>';
  }
  function predictOptions(p) {
    var opts = [p.answer].concat(p.distractors || []), rnd = seeded(p.id), order = opts.map(function (_, i) { return i; });
    for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; }
    return order.map(function (k) { return { table: opts[k], right: k === 0 }; });
  }
  // the script one statement per line, numbered, so "Statement 3 fails" is easy to find (quotes respected)
  function scriptStatements(sql) {
    var out = [], cur = "", q = null;
    for (var i = 0; i < sql.length; i++) {
      var ch = sql[i];
      if (q) { if (ch === q) q = null; cur += ch; continue; }
      if (ch === "'" || ch === '"' || ch === "`") { q = ch; cur += ch; continue; }
      if (ch === ";") { if (cur.trim()) out.push(cur.trim()); cur = ""; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  function numberedScript(sql) { return scriptStatements(String(sql || "")).map(function (st, i) { return "-- " + (i + 1) + "\n" + st.replace(/\s+/g, " ") + ";"; }).join("\n"); }
  function endStateCard(p) {
    var opts = predictOptions(p);
    return '<section class="card card-pad predict" data-predict="' + esc(p.id) + '"><div class="pq">' + esc(p.question) + (p.right ? ' <span class="pill done">' + icon("check") + "Got it</span>" : p.tried ? ' <span class="pill prog">Tried</span>' : "") + "</div>" +
      '<div class="muted small">The script (' + esc(p.engine || "MySQL") + ')</div><pre class="mcq-code">' + highlight(numberedScript(p.script)) + "</pre>" + (p.check_sql && p.mode !== "error" ? '<div class="muted small">Then this query runs</div><pre class="mcq-code">' + highlight(p.check_sql) + "</pre>" : "") +
      '<fieldset class="po-opts"><legend>' + (p.mode === "error" ? "What happens?" : "What does the query return?") + "</legend>" + opts.map(function (o, i) {
        return '<label class="po-opt"><input type="radio" name="po-' + esc(p.id) + '" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + String.fromCharCode(65 + i) + '</span><span class="po-body">' + outcomeHtml(o.table) + "</span></label>";
      }).join("") + "</fieldset>" +
      '<div class="actions"><button class="btn primary sm" data-po-check="' + esc(p.id) + '">' + icon("checkCircle") + 'Check</button><button class="btn sm" data-po-reveal="' + esc(p.id) + '">' + icon("eye") + 'Show what really happens</button></div><div class="po-out" aria-live="polite"></div></section>';
  }
  function predictCard(p) {
    if (p.variant === "endstate") return endStateCard(p);
    var opts = (p.distractors || []).length ? predictOptions(p) : null;
    var dataPanel = p.dataset ? schemaPanel({ kind: "sqlite", key: p.dataset }, { hint: "the dataset this query runs on" }) : "";
    var body = '<section class="card card-pad predict" data-predict="' + esc(p.id) + '"><div class="pq">' + esc(p.question) + (p.right ? ' <span class="pill done">' + icon("check") + "Got it</span>" : p.tried ? ' <span class="pill prog">Tried</span>' : "") + "</div>" +
      inputsHtml(p) + '<pre class="mcq-code">' + highlight(p.sql) + "</pre>" + dataPanel;
    if (opts) body += '<fieldset class="po-opts"><legend>Which result does it return?</legend>' + opts.map(function (o, i) {
      return '<label class="po-opt"><input type="radio" name="po-' + esc(p.id) + '" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + String.fromCharCode(65 + i) + "</span>" + miniTable(o.table) + "</label>";
    }).join("") + "</fieldset>";
    else body += '<label class="po-type"><span>Type the result: one row per line, values separated by commas' + (p.answer.rows.length ? "" : " (leave it empty for no rows)") + '</span><textarea rows="3" class="po-text" spellcheck="false"></textarea></label>';
    return body + '<div class="actions"><button class="btn primary sm" data-po-check="' + esc(p.id) + '">' + icon("checkCircle") + 'Check</button><button class="btn sm" data-po-reveal="' + esc(p.id) + '">' + icon("eye") + 'Show the real output</button></div><div class="po-out" aria-live="polite"></div></section>';
  }
  function normCell(v) { var s = String(v == null ? "null" : v).trim().replace(/^['"]|['"]$/g, "").toLowerCase(); var n = Number(s); return s !== "" && !isNaN(n) ? String(Math.round(n * 100) / 100) : s; }
  function typedMatches(text, answer) {
    var lines = String(text || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length !== answer.rows.length) return false;
    var mine = lines.map(function (l) { return l.split(",").map(normCell).join("|"); }).sort(), exp = answer.rows.map(function (r) { return r.map(normCell).join("|"); }).sort();
    return mine.join("\n") === exp.join("\n");
  }
  function predictCheck(id, reveal) {
    var box = $('[data-predict="' + id + '"]'), c = S.learn.concept[route.args[0]], p = c && c.predicts.filter(function (x) { return x.id === id; })[0];
    if (!box || !p) return;
    var out = box.querySelector(".po-out"), right;
    var shown = p.variant === "endstate" ? outcomeHtml(p.answer) : miniTable(p.answer);
    if (reveal) { out.innerHTML = '<div class="muted small">' + (p.variant === "endstate" ? "What really happens" : "Real output") + "</div>" + shown; return; }
    var pick = box.querySelector("input[type=radio]:checked"), ta = box.querySelector(".po-text");
    if (pick) right = pick.getAttribute("data-right") === "1";
    else if (ta) right = typedMatches(ta.value, p.answer);
    else { out.innerHTML = '<p class="muted small">Pick a result first.</p>'; return; }
    out.innerHTML = '<p class="verdict ' + (right ? "ok-txt" : "bad-txt") + '">' + icon(right ? "checkCircle" : "x") + (right ? (p.variant === "endstate" ? "Right: that is what happens." : "Right: that is what the query returns.") : (p.variant === "endstate" ? "Not quite. Here is what really happens:" : "Not quite. Here is the real output:")) + "</p>" + (right ? "" : shown);
    learnAnswered("predict", id, right);
    learnApi("/predict/" + id, { correct: right }).then(function () { learnEvent("predict", id); p.tried = true; if (right) p.right = true; viewConcept.stale = true; }).catch(function (e) { toast("Couldn't save: " + e.message); });
  }

  // ---------- reflections ----------
  function reflectForm(o) {
    var id = "rf" + Math.random().toString(36).slice(2, 7);
    return '<section class="card card-pad reflect" data-reflect="' + esc(o.item || "") + '" data-rconcept="' + esc(o.concept || "") + '" data-result="' + esc(o.result || "") + '" aria-labelledby="' + id + '-h">' +
      '<div class="card-h"><h3 id="' + id + '-h">' + icon("note") + esc(o.title || "Reflect") + '</h3><span class="muted small">Optional · saved in My notes</span>' + (o.item ? '<button class="more link" data-reflect-skip aria-label="Skip the reflection">' + icon("x") + "</button>" : "") + "</div>" +
      '<label class="rf-field"><span>' + esc(o.prompt || "Explain your query in one sentence") + '</span><textarea rows="2" class="rf-explain" maxlength="1000"></textarea></label>' +
      (o.result === "fail" ? '<label class="rf-field"><span>What was your mistake?</span><textarea rows="2" class="rf-mistake" maxlength="1000"></textarea></label>' : "") +
      '<fieldset class="rf-conf"><legend>How confident are you?</legend>' + [1, 2, 3, 4, 5].map(function (n) { return '<label><input type="radio" name="' + id + '-conf" value="' + n + '"><span>' + n + "</span></label>"; }).join("") + '<span class="muted small">1 = guessing · 5 = could teach it</span></fieldset>' +
      (o.compare ? '<div class="rf-compare"></div>' : "") +
      '<div class="actions"><button class="btn primary sm" data-reflect-save>' + icon("check") + "Save to My notes</button>" + (o.compare ? '<button class="btn sm" data-reflect-compare>' + icon("eye") + "Compare with the other accepted answers</button>" : "") +
      '<span class="muted small">' + (reflectAiOn() ? "AI feedback is on (Settings)" : "AI feedback is off (Settings)") + '</span></div><div class="rf-out" aria-live="polite"></div></section>';
  }
  /** After a solve or a fail on the exercise page: an optional quick reflection under the result. */
  function reflectBox(d, pass) {
    var host = $("#extra");
    if (!host || d.kind === "mcq") return;
    host.innerHTML = (!pass && d.lastAttempt ? mistakeCardHtml(d) : "") + reflectForm({ item: d.id, result: pass ? "pass" : "fail", title: pass ? "Reflect: you solved it" : "Reflect: not yet", compare: pass && hasSolution(d) });
  }
  // #19 Mistake reflection: what went wrong in the learner's real last attempt, from the same result comparison (no AI)
  function mistakeCardHtml(d) {
    var a = d.lastAttempt, g = Cards.diagnoseAttempt(a, d.id + ":" + (a.sql || "")), id = "mr-" + String(d.id).replace(/[^\w-]/g, "");
    MR[d.id] = { attempt: a, diag: g };
    return '<section class="card card-pad xcard mr-card" data-mr="' + esc(d.id) + '" aria-labelledby="' + id + '-h"><div class="xc-head"><span class="tag">' + esc(Cards.TYPES.mistake_reflection.label) + '</span><span class="muted small">Optional · saved in My notes · not part of mastery</span></div>' +
      '<h3 class="pq" id="' + id + '-h">What went wrong in your last attempt?</h3><div class="muted small">What the comparison found</div><ul class="small mr-facts">' + g.facts.map(function (f) { return "<li>" + esc(f) + "</li>"; }).join("") + "</ul>" +
      (a.sql ? '<details class="xc-setup"><summary class="small">Your query</summary><pre class="mcq-code">' + highlight(a.sql) + "</pre></details>" : "") +
      '<fieldset class="po-opts xc-opts"><legend>My mistake was…</legend>' + g.options.map(function (o, i) { return '<label class="po-opt"><input type="radio" name="' + id + '-opt" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + "ABCD".charAt(i) + '</span><span class="po-body">' + esc(o.text) + "</span></label>"; }).join("") + "</fieldset>" +
      confHtml(id) + '<div class="actions"><button type="button" class="btn primary sm" data-mr-save>' + icon("check") + 'Check and save to My notes</button></div><div class="xc-out" aria-live="polite"></div></section>';
  }
  var MR = {};
  function mistakeSave(sec) {
    var itemId = sec.getAttribute("data-mr"), m = MR[itemId], id = "mr-" + String(itemId).replace(/[^\w-]/g, ""), out = sec.querySelector(".xc-out");
    var o = sec.querySelector('[name="' + id + '-opt"]:checked');
    if (!o) { out.innerHTML = '<p class="small bad-txt">Choose what went wrong first.</p>'; return; }
    var right = o.getAttribute("data-right") === "1", chosen = o.closest("label").querySelector(".po-body").textContent, conf = confOf(sec, id);
    sec.querySelectorAll("input, [data-mr-save]").forEach(function (x) { x.disabled = true; });
    out.innerHTML = verdictHtml(right) + (right ? "" : '<p class="small">The comparison points to: <b>' + esc(m.diag.misconception) + "</b>.</p>") + '<p class="muted small">Saving…</p>';
    var v = out.querySelector(".verdict"); if (v) { v.setAttribute("tabindex", "-1"); v.focus(); }
    learnApi("/reflections", { item_id: itemId, result: "fail", source: "mistake_card", mistake: "Misconception: " + m.diag.misconception + ". What happened: " + m.diag.facts.join(" "), explain: right ? "" : "I first thought: " + chosen, confidence: conf, sql: m.attempt.sql || undefined })
      .then(function () { out.lastElementChild.outerHTML = '<p class="small ok-txt">' + icon("checkCircle") + 'Saved to <a href="#/notes">My notes</a> as a misconception note.</p>'; })
      .catch(function (e) { out.lastElementChild.outerHTML = '<p class="small bad-txt">' + esc(e.message) + "</p>"; });
  }
  view.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-mr-save]"); if (b) mistakeSave(b.closest("[data-mr]")); });
  function saveReflection(box) {
    var explain = (box.querySelector(".rf-explain") || {}).value || "", mistake = (box.querySelector(".rf-mistake") || {}).value || "";
    var conf = box.querySelector(".rf-conf input:checked"), out = box.querySelector(".rf-out"), btn = box.querySelector("[data-reflect-save]");
    if (!explain.trim() && !mistake.trim()) { out.innerHTML = '<p class="bad-txt small">Write one sentence first.</p>'; box.querySelector("textarea").focus(); return; }
    btn.disabled = true; out.innerHTML = '<p class="muted small">Saving…</p>';
    var item = box.getAttribute("data-reflect"), concept = box.getAttribute("data-rconcept");
    learnApi("/reflections", { item_id: item || undefined, concept: concept || undefined, result: box.getAttribute("data-result") || undefined, explain: explain, mistake: mistake, confidence: conf ? Number(conf.value) : null, sql: item && $("#sql") ? $("#sql").value : undefined, ai: reflectAiOn() })
      .then(function (r) {
        learnEvent("reflection", r.id);
        viewConcept.stale = true; S.learn.levels = {};
        box.innerHTML = '<div class="card-h"><h3>' + icon("checkCircle") + 'Saved to My notes</h3><a class="more link" href="#/notes">My notes ' + icon("chevRight") + "</a></div>" +
          '<p class="muted small">' + (r.concepts.length ? "Counts as the reflection for " + plural(r.concepts.length, "concept") + "." : "") + "</p>" +
          (r.feedback ? '<div class="rf-feedback"><div class="muted small">AI feedback</div><p>' + esc(r.feedback) + "</p></div>" : r.feedbackError ? '<p class="muted small">' + esc(r.feedbackError) + "</p>" : "");
        if (route.name === "concept") refreshConcept(route.args[0]);
      }).catch(function (e) { btn.disabled = false; out.innerHTML = '<p class="bad-txt small">' + esc(e.message) + "</p>"; });
  }
  function compareAccepted(box) {
    var d = S.byId[box.getAttribute("data-reflect")], cmp = box.querySelector(".rf-compare");
    if (!d || !cmp) return;
    api("/api/library/item/" + d.id + "/solution?dialect=" + dialect()).then(function (s) {
      var list = s.accepted && s.accepted.length ? s.accepted : s.solution_sql ? [{ sql: s.solution_sql }] : [];
      cmp.innerHTML = list.length ? '<div class="muted small">' + (list.length > 1 ? list.length + " accepted answers" : "The reference answer") + "</div>" + list.map(function (a, i) { return (a.label ? '<div class="small"><b>' + esc(a.label) + "</b></div>" : list.length > 1 ? '<div class="small"><b>Answer ' + (i + 1) + "</b></div>" : "") + '<pre class="mcq-code">' + highlight(a.sql) + "</pre>"; }).join("") : '<p class="muted small">No accepted answer to compare with.</p>';
    }).catch(function (e) { cmp.innerHTML = '<p class="bad-txt small">' + esc(e.message) + "</p>"; });
  }
  function noteCard(r) {
    var when = new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
    var it = r.item_id && S.byId[r.item_id];
    var concepts = (r.conceptList || []).map(function (x) { return '<a class="tag" href="#/concept/' + esc(x.slug) + '">' + esc(x.name) + "</a>"; }).join("");
    return '<article class="card card-pad note"><div class="note-h"><span class="muted small">' + esc(when) + "</span>" + (r.source === "mistake_card" ? '<span class="tag plain">Misconception</span>' : "") + (r.result ? '<span class="pill ' + (r.result === "pass" ? "done" : "fail") + '">' + (r.result === "pass" ? "Solved" : "Not yet") + "</span>" : "") +
      (r.confidence ? '<span class="small note-conf">Confidence <b class="mono">' + r.confidence + "</b>/5</span>" : "") + '<button class="more link" data-note-del="' + r.id + '" aria-label="Delete this note">' + icon("x") + "</button></div>" +
      (it ? '<a class="note-item" href="' + href(it) + '">' + esc(it.title) + "</a>" : r.itemTitle ? '<span class="note-item">' + esc(r.itemTitle) + "</span>" : "") + (concepts ? '<div class="note-tags">' + concepts + "</div>" : "") +
      (r.explain ? '<p class="note-text">' + esc(r.explain) + "</p>" : "") + (r.mistake ? '<p class="note-text"><b>Mistake:</b> ' + esc(r.mistake) + "</p>" : "") +
      (r.feedback ? '<div class="rf-feedback"><div class="muted small">AI feedback</div><p>' + esc(r.feedback) + "</p></div>" : "") + "</article>";
  }
  function viewNotes() {
    var q = S.learn.notesQ || "";
    var html = '<div class="page"><div class="col"><div><div class="eyebrow">My notes</div><div class="hero"><div><h1>My notes</h1><p>Your reflections: what you explained, the mistakes you named and how confident you felt. Search them to revise.</p></div></div></div>' +
      '<label class="notes-search"><span class="sr-only">Search my notes</span>' + icon("search") + '<input type="search" class="inp" data-act="notes-q" placeholder="Search notes, exercises, concepts…" value="' + esc(q) + '"></label><div id="notesList" aria-live="polite"><p class="muted small">Loading…</p></div></div>' + rail() + "</div>";
    view.innerHTML = html;
    loadNotes();
  }
  view.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest('[data-act="notes-clear"]')) return;
    S.learn.notesQ = ""; var inp = $('[data-act="notes-q"]'); if (inp) { inp.value = ""; inp.focus(); } loadNotes();
  });
  function loadNotes() {
    var q = S.learn.notesQ || "";
    learnApi("/reflections?q=" + encodeURIComponent(q)).then(function (r) {
      var box = $("#notesList");
      if (!box) return;
      r.notes.forEach(function (n) { n.conceptList = n.concepts; });
      box.innerHTML = '<p class="muted small">' + (q ? r.notes.length + " of " + plural(r.total, "note") + " match “" + esc(q) + "”" : plural(r.total, "note")) + "</p>" +
        (r.notes.length ? r.notes.map(noteCard).join("") : (r.total ? '<div class="card empty">' + icon("note") + '<div><p>No note matches “' + esc(q) + '”.</p><button type="button" class="btn sm" data-act="notes-clear">Clear the search</button></div></div>' : emptyStage("note", "No notes yet: a note is saved when you write a reflection. After an exercise the Reflect box asks for one sentence; every concept page has one too.", ["#/home", "Reflect from today's plan"])));
    }).catch(function (e) { var box = $("#notesList"); if (box) box.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
  }

  // ---------- flashcard catalogue and session ----------
  function flashTypeLabel(t) { return { keyword: "Keyword", blank: "Fill in the blank", order: "Clause order", error: "Spot the error" }[t] || t || "Flashcard"; }
  function flashLibraryCard(c) {
    var front = c.type === "keyword" ? c.front : c.prompt || flashTypeLabel(c.type), detail = c.type === "keyword" ? c.back : c.type === "blank" ? c.sql : c.type === "order" ? (c.parts || []).join("  →  ") : c.wrong_sql;
    var answer = c.type === "blank" ? "Answer: " + (c.answer || "") : c.type === "error" ? "Fixed: " + (c.fixed_sql || "") : c.type === "keyword" ? c.back : c.type === "order" ? "Correct order: " + (c.parts || []).join("  →  ") : "";
    var go = '#/flashcards?concept=' + encodeURIComponent(c.concept) + '&card=' + encodeURIComponent(c.id);
    return '<article class="card fc-lib-card" data-go="' + esc(go) + '" tabindex="0" role="link" aria-label="Open flashcard: ' + esc(front) + '"><div class="fc-lib-head"><span class="tag">' + esc(flashTypeLabel(c.type)) + '</span><span class="tag plain">Level ' + c.level + '</span><span class="tag plain">' + esc(c.conceptName) + '</span><span class="grow"></span><a class="btn sm" href="' + go + '">' + icon("play") + 'Study this card</a></div><h3>' + esc(front) + '</h3>' + (detail ? '<pre class="fc-lib-code">' + esc(detail) + '</pre>' : '') + (answer && c.type !== "keyword" ? '<details><summary class="small">Show answer</summary><p class="small">' + esc(answer) + '</p></details>' : '') + '</article>';
  }
  function flashLibraryPager(page, pages, total, size) {
    var out = '<div class="pager"><button data-fc-page="' + (page - 1) + '"' + (page <= 0 ? " disabled" : "") + ' aria-label="Previous page">' + icon("chevLeft") + '</button>';
    var nums = [];
    for (var i = 0; i < pages; i++) if (i < 1 || i >= pages - 1 || Math.abs(i - page) <= 2) nums.push(i); else if (nums[nums.length - 1] !== -1) nums.push(-1);
    nums.forEach(function (i) { out += i < 0 ? "<button disabled>…</button>" : '<button data-fc-page="' + i + '" class="' + (i === page ? "on" : "") + '">' + (i + 1) + '</button>'; });
    out += '<button data-fc-page="' + (page + 1) + '"' + (page >= pages - 1 ? " disabled" : "") + ' aria-label="Next page">' + icon("chevRight") + '</button><span class="info">Showing ' + (total ? page * size + 1 : 0) + "–" + Math.min(total, (page + 1) * size) + " of " + total.toLocaleString() + ' flashcards</span><select data-fc-size aria-label="Per page">' + [10, 25, 50, 100].map(function (n) { return '<option value="' + n + '"' + (n === size ? " selected" : "") + '>' + n + ' / page</option>'; }).join("") + '</select></div>';
    return out;
  }
  function viewFlashcardLibrary() {
    var q = route.q, params = new URLSearchParams();
    ["q", "type", "level", "concept", "sort", "page", "size"].forEach(function (k) { if (q.get(k)) params.set(k, q.get(k)); });
    learnApi("/flashcards" + (params.toString() ? "?" + params : "")).then(function (r) {
      if (route.name !== "flashcards" || route.q.get("study") === "1" || route.q.get("concept")) return;
      var type = q.get("type") || "all", level = q.get("level") || "all", concept = q.get("concept") || "all", sort = q.get("sort") || "path", size = Number(q.get("size")) || 25;
      var types = [["all", "All types"], ["keyword", "Keyword"], ["blank", "Fill in the blank"], ["order", "Clause order"], ["error", "Spot the error"]];
      var levels = r.levels || [], concepts = r.concepts || [];
      var chip2 = function (key, value, label, current) { var n = new URLSearchParams(q); if (value === "all") n.delete(key); else n.set(key, value); n.delete("page"); n.delete("study"); return '<a class="chip' + (String(current) === value ? " on" : "") + '" href="#/flashcards' + (n.toString() ? "?" + n : "") + '">' + esc(label) + '</a>'; };
      var html = '<div class="page"><div class="col"><div class="hero"><div><div class="eyebrow">Flashcards</div><h1>SQL Flashcard Library</h1><p>' + r.total.toLocaleString() + ' published flashcards. Browse the full bank, filter by level or card type, then study a concept.</p></div><div class="acts"><a class="btn primary" href="#/flashcards?study=1">' + icon("play") + 'Start today\'s review</a></div></div>';
      html += '<section class="card filters fc-filters"><div class="f-group"><div class="f-label">' + icon("cards") + 'Card type</div><div class="f-chips">' + types.map(function (x) { return chip2("type", x[0], x[1], type); }).join("") + '</div></div><div class="f-group"><div class="f-label">' + icon("levels") + 'Level</div><div class="f-chips">' + chip2("level", "all", "All levels", level) + levels.map(function (x) { return chip2("level", String(x.level), "Level " + x.level, level); }).join("") + '</div></div><div class="f-group f-wide"><div class="f-label">' + icon("search") + 'Concept</div><select class="inp fc-concept-select" data-fc-concept><option value="all">All concepts</option>' + concepts.map(function (x) { return '<option value="' + esc(x.slug) + '"' + (concept === x.slug ? ' selected' : '') + '>Level ' + x.level + ' · ' + esc(x.name) + ' (' + x.count.toLocaleString() + ')</option>'; }).join("") + '</select></div></section>';
      html += '<div class="listbar"><label class="search-inline">' + icon("search") + '<input data-fc-search value="' + esc(q.get("q") || "") + '" placeholder="Search flashcards…" aria-label="Search flashcards"></label><label class="sortsel">Sort by <select data-fc-sort><option value="path"' + (sort === "path" ? " selected" : "") + '>Level order</option><option value="new"' + (sort === "new" ? " selected" : "") + '>Newest first</option></select></label></div>';
      html += r.items.length ? '<div class="dlist fc-lib-list">' + r.items.map(flashLibraryCard).join("") + '</div>' : '<div class="card empty">' + icon("search") + '<div>Nothing matches these filters.</div><p><a class="btn" href="#/flashcards">Clear filters</a></p></div>';
      html += flashLibraryPager(r.page, r.pages, r.total, r.size) + '</div>' + rail() + '</div>';
      view.innerHTML = html;
      // the search re-renders the page: keep the learner typing (what they typed, including keys pressed while the
      // results loaded, and where the cursor was)
      var typing = viewFlashcardLibrary._typing;
      if (typing && Date.now() - typing.at < 3000) {
        var box = view.querySelector("[data-fc-search]");
        if (box) { box.value = typing.value; box.focus(); box.selectionStart = box.selectionEnd = Math.min(typing.pos, typing.value.length); }
      }
    }).catch(function (e) { view.innerHTML = '<div class="page full"><div class="card empty"><div class="bad-txt">' + esc(e.message) + '</div></div></div>'; });
  }
  function viewFlashcards() {
    var slug = route.q && route.q.get("concept");
    var selectedCard = route.q && route.q.get("card");
    if (!slug && route.q.get("study") !== "1") { viewFlashcardLibrary(); return; }
    view.innerHTML = '<div class="page full"><div class="col fc-page"><div class="card card-pad" aria-busy="true"><p class="muted">Loading cards…</p></div></div></div>';
    var sessionQ = []; if (slug) sessionQ.push("concept=" + encodeURIComponent(slug)); if (selectedCard) sessionQ.push("card=" + encodeURIComponent(selectedCard));
    learnApi("/flash/session" + (sessionQ.length ? "?" + sessionQ.join("&") : "")).then(function (s) {
      if (route.name !== "flashcards") return;
      S.fc = { slug: slug, cards: s.cards, i: 0, right: 0, wrong: 0, later: s.later, results: [] };
      if (!s.cards.length && slug) {
        // nothing due: practise the concept's cards anyway (the schedule only moves when a card is due)
        return loadConcept(slug).then(function (c) { S.fc.cards = c.flashcards.map(function (f) { return Object.assign({ conceptName: c.name }, f); }); S.fc.extra = true; flashStep(); });
      }
      flashStep();
    }).catch(function (e) { view.innerHTML = '<div class="page full"><div class="card empty">' + esc(e.message) + "</div></div>"; });
  }
  function flashShell(inner) {
    var F = S.fc, c = F.cards[F.i];
    var back = F.slug ? '<a href="#/concept/' + esc(F.slug) + '?tab=memorize">' + esc((c && c.conceptName) || "Concept") + "</a>" : '<a href="#/flashcards">Flashcard library</a>';
    return '<div class="page full"><div class="col fc-page"><div class="crumbs">' + back + icon("chevRight") + "<span>Flashcards</span></div>" +
      '<div class="fc-top"><span class="mono">' + (F.i < F.cards.length ? "Card " + (F.i + 1) + " of " + F.cards.length : "Done") + '</span><span class="bar" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="' + F.cards.length + '" aria-valuenow="' + F.i + '"><span style="width:' + pct(F.i, F.cards.length) + '%"></span></span><span class="small"><b class="ok-txt">' + F.right + '</b> right · <b class="bad-txt">' + F.wrong + "</b> to review</span></div>" + inner + "</div></div>";
  }
  /** Flashcards, all concepts, nothing due: new cards from the next concept, when the next review is, how reviews work. */
  function flashNothingDue() {
    var lv = currentLevel();
    view.innerHTML = flashShell('<section class="card card-pad fc-done fc-empty" role="status" aria-busy="true"><h2 tabindex="-1">No cards due</h2><p class="muted">Looking for new cards…</p></section>');
    var h0 = view.querySelector(".fc-empty h2"); if (h0) h0.focus();
    // the next review: the earliest due date of the cards already studied (concepts with reviewed cards, every level)
    var nextDue = Promise.all(S.levels.map(function (L) { return learnApi("/levels/" + L.n).catch(function () { return { concepts: [] }; }); })).then(function (ls) {
      var slugs = [].concat.apply([], ls.map(function (x) { return (x.concepts || []).filter(function (c) { return c.counts && c.counts.flash && c.counts.flash.reviewed; }).map(function (c) { return c.slug; }); }));
      return Promise.all(slugs.map(function (sl) { return loadConcept(sl).catch(function () { return null; }); })).then(function (cs) {
        var due = []; cs.forEach(function (c) { (c && c.flashcards || []).forEach(function (f) { if (f.state && f.state.due_at) due.push(f.state.due_at); }); });
        return due.sort()[0] || null;
      });
    });
    Promise.all([learnApi("/today?level=" + lv), nextDue]).then(function (r) {
      if (route.name !== "flashcards" || (route.q && route.q.get("concept"))) return;
      var nc = r[0] && r[0].flashcards && r[0].flashcards.newConcept, when = r[1];
      var whenTxt = when ? new Date(when).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" }) : null;
      var box = view.querySelector(".fc-empty");
      if (!box) return;
      box.removeAttribute("aria-busy");
      box.innerHTML = icon("cards") + '<h2 tabindex="-1">No cards due</h2>' +
        "<p>" + (when ? "Your next review is on <b>" + esc(whenTxt) + "</b>." : "You haven't studied any flashcards yet, so none is due for review.") + "</p>" +
        '<p class="muted small">How reviews work: a card you answer comes back after 1, 3, 7 and 14 days; a wrong answer brings it back tomorrow. New cards start from a concept.</p>' +
        '<div class="actions">' + (nc ? '<a class="btn primary" href="#/flashcards?concept=' + encodeURIComponent(nc.slug) + '">' + icon("play") + "Start new cards: " + esc(nc.name) + " (" + nc.fresh + " " + (nc.fresh === 1 ? "card" : "cards") + ")</a>"
          : '<a class="btn primary" href="#/level/' + lv + '">' + icon("levels") + "Open Level " + lv + "</a>") + "</div>" +
        (nc ? "" : '<p class="muted small">Every flashcard in Level ' + lv + " is started. The next level's cards appear as you move on.</p>");
      var h = box.querySelector("h2"); if (h) h.focus();
    }).catch(function (e) { var box = view.querySelector(".fc-empty"); if (box) box.innerHTML = '<h2 tabindex="-1">No cards due</h2><p class="bad-txt">' + esc(e.message) + '</p><div class="actions"><a class="btn" href="#/home">Back to Home</a></div>'; });
  }
  function flashStep() {
    var F = S.fc;
    if (!F) return;
    if (F.i >= F.cards.length) {
      if (!F.cards.length && !F.slug) { flashNothingDue(); return; }
      view.innerHTML = flashShell('<section class="card card-pad fc-done" role="status">' + icon("trophy") + "<h2>" + (F.cards.length ? "Session done" : "No cards due") + "</h2><p>" +
        (F.cards.length ? F.right + " right, " + F.wrong + " to review again tomorrow." + (F.extra ? " These were extra practice: only a card that is due moves on in the schedule." : "") : "Nothing is due right now" + (F.later ? ": " + plural(F.later, "card") + " come back later." : ".")) + "</p>" +
        '<div class="actions">' + (F.slug ? '<a class="btn primary" href="#/concept/' + esc(F.slug) + '?tab=understand">Next: Understand ' + icon("chevRight") + "</a>" : "") + '<a class="btn" href="#/home">Dashboard</a></div></section>');
      var h = view.querySelector(".fc-done h2"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
      viewConcept.stale = true; S.learn.levels = {}; S.learn.today = null;
      return;
    }
    var c = F.cards[F.i], face = "";
    var meta = '<div class="fc-meta"><span class="tag">' + esc({ keyword: "Keyword", blank: "Fill in the blank", order: "Clause order", error: "Spot the error" }[c.type] || c.type) + "</span>" + (F.slug ? "" : '<span class="muted small">' + esc(c.conceptName || "") + "</span>") + (c.state ? '<span class="muted small">' + c.state.interval + "-day gap</span>" : '<span class="muted small">new card</span>') + "</div>";
    if (c.type === "keyword") face = '<div class="fc-front">' + esc(c.front) + '</div><div class="fc-back" hidden>' + esc(c.back) + "</div>" + revealBar();
    else if (c.type === "blank") face = '<div class="fc-q">' + esc(c.prompt || "Fill in the blank") + '</div><pre class="mcq-code">' + highlight(c.sql) + '</pre><label class="fc-in"><span>Your answer for ___</span><input class="inp mono" id="fcAnswer" autocomplete="off" spellcheck="false"></label><div class="actions"><button class="btn primary" data-fc="check">Check <kbd class="kbd-in">Enter</kbd></button></div><div class="fc-res" aria-live="polite"></div>';
    else if (c.type === "order") {
      var rnd = seeded(c.id + F.i), parts = c.parts.map(function (p, i) { return { p: p, i: i }; });
      for (var k = parts.length - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)); var t = parts[k]; parts[k] = parts[j]; parts[j] = t; }
      F.order = []; F.shuffled = parts;
      face = '<div class="fc-q">' + esc(c.prompt || "Put the clauses in the right order") + '</div><p class="muted small">Press the parts in order (Tab to move, Enter to pick). Backspace undoes the last one.</p><ol class="fc-built mono" aria-live="polite"></ol><div class="fc-parts">' +
        parts.map(function (x, n) { return '<button class="btn sm mono" data-fc-part="' + n + '">' + esc(x.p) + "</button>"; }).join("") + '</div><div class="actions"><button class="btn sm" data-fc="undo">Undo</button></div><div class="fc-res" aria-live="polite"></div>';
    } else if (spotBugUsable(c)) face = spotBugHtml(c, "fc") + '<div class="actions"><button class="btn primary" data-fc="fix-check">' + icon("checkCircle") + 'Check</button><button class="btn sm" data-fc="fix-reveal">Show the answer</button></div><div class="fc-res" aria-live="polite"></div>';
    else face = '<div class="fc-q">' + esc(c.prompt || "Spot the error") + '</div><pre class="mcq-code">' + highlight(c.wrong_sql) + '</pre><div class="fc-back" hidden><div class="muted small">Fixed</div><pre class="mcq-code">' + highlight(c.fixed_sql) + "</pre><p>" + esc(c.explanation || "") + "</p></div>" + revealBar();
    view.innerHTML = flashShell('<section class="card card-pad fc-card" aria-label="Flashcard">' + meta + face + "</section>" + (c.type !== "keyword" ? tablesPanel(c.dataset, c.sql || c.fixed_sql || (c.parts || []).join(" "), false) : ""));
    var first = view.querySelector("#fcAnswer") || view.querySelector(".sb-fix") || view.querySelector('[data-fc="reveal"]') || view.querySelector("[data-fc-part]");
    if (first) first.focus();
  }
  function revealBar() {
    return '<div class="actions fc-reveal"><button class="btn primary" data-fc="reveal">Show the answer <kbd class="kbd-in">Space</kbd></button></div>' +
      '<div class="actions fc-grade" hidden><button class="btn ok" data-fc="right">' + icon("check") + 'I knew it <kbd class="kbd-in">Y</kbd></button><button class="btn" data-fc="wrong">' + icon("x") + 'I didn\'t <kbd class="kbd-in">N</kbd></button></div>';
  }
  function flashGrade(right) {
    var F = S.fc, c = F.cards[F.i];
    if (!c || F.busy) return;
    F.busy = true;
    learnApi("/flash/" + c.id, { correct: right }).then(function () {
      F.busy = false; learnEvent("flashcard", c.id);
      if (right) F.right++; else F.wrong++;
      F.i++; flashStep();
    }).catch(function (e) { F.busy = false; toast("Couldn't save: " + e.message); });
  }
  function normAns(s) { return String(s || "").trim().replace(/;$/, "").replace(/\s+/g, " ").toLowerCase(); }
  function flashShowResult(right, html, checked) {
    var res = view.querySelector(".fc-res");
    res.innerHTML = '<p class="verdict ' + (right ? "ok-txt" : "bad-txt") + '">' + icon(right ? "checkCircle" : "x") + (right ? "Right" : "Not quite") + "</p>" + html +
      '<div class="actions"><button class="btn primary" data-fc="' + (right ? "right" : "wrong") + '">Next card <kbd class="kbd-in">Enter</kbd></button>' + (right || checked ? "" : '<button class="btn sm" data-fc="right">I was right (typo)</button>') + "</div>";
    res.querySelector("button").focus();
  }
  view.addEventListener("click", function (e) {
    var t = e.target;
    var ct = t.closest("[data-ctab]");
    if (ct) { var q = new URLSearchParams(route.q); q.set("tab", ct.getAttribute("data-ctab")); history.replaceState(null, "", "#/concept/" + route.args[0] + "?" + q); route.q = q; viewConcept(route.args[0]); var nt = $("#tab-" + ct.getAttribute("data-ctab")); if (nt) nt.focus(); return; }
    var cs = t.closest("[data-concept-seen]");
    if (cs) { cs.disabled = true; learnApi("/concept/" + cs.getAttribute("data-concept-seen") + "/seen", {}).then(function (r) { if (r.first) learnEvent("card", cs.getAttribute("data-concept-seen")); return loadConcept(route.args[0]); }).then(function () { S.learn.levels = {}; if (cardsInProgress()) cs.outerHTML = '<span class="pill done">' + icon("check") + "Read</span>"; else viewConcept(route.args[0]); toast("Marked as read"); }).catch(function (er) { cs.disabled = false; toast(er.message); }); return; }
    var mp = t.closest("[data-more-practice]");
    if (mp) { S.morePractice = mp.getAttribute("data-more-practice"); viewConcept(route.args[0]); return; }
    var pc = t.closest("[data-po-check]");
    if (pc) { predictCheck(pc.getAttribute("data-po-check")); return; }
    var pr = t.closest("[data-po-reveal]");
    if (pr) { predictCheck(pr.getAttribute("data-po-reveal"), true); return; }
    var rs = t.closest("[data-reflect-save]");
    if (rs) { saveReflection(rs.closest(".reflect")); return; }
    var rc = t.closest("[data-reflect-compare]");
    if (rc) { rc.disabled = true; compareAccepted(rc.closest(".reflect")); return; }
    if (t.closest("[data-reflect-skip]")) { var box = t.closest(".reflect"); box.remove(); return; }
    var nd = t.closest("[data-note-del]");
    if (nd) {
      if (!confirmClick(nd, "Delete this note? It can't be undone.", "Delete note")) return;
      fetch("/api/learn/reflections/" + nd.getAttribute("data-note-del"), { method: "DELETE", headers: versionHeaders() }).then(watchVersion).then(function () { viewConcept.stale = true; S.learn.levels = {}; if (route.name === "notes") loadNotes(); else if (route.name === "concept") refreshConcept(route.args[0]); });
      return;
    }
    var fc = t.closest("[data-fc]");
    if (fc && S.fc) {
      var a = fc.getAttribute("data-fc"), c = S.fc.cards[S.fc.i];
      if (a === "reveal") { view.querySelectorAll(".fc-back").forEach(function (b) { b.hidden = false; }); view.querySelector(".fc-reveal").hidden = true; var g = view.querySelector(".fc-grade"); g.hidden = false; g.querySelector("button").focus(); }
      else if (a === "right" || a === "wrong") flashGrade(a === "right");
      else if (a === "check" && c) { var v = $("#fcAnswer").value, ok = window.Cards ? Cards.checkBlank(v, c) : normAns(v) === normAns(c.answer); $("#fcAnswer").readOnly = true; fc.hidden = true; flashShowResult(ok, '<pre class="mcq-code">' + highlight(String(c.sql).replace("___", c.answer)) + "</pre>"); }
      else if (a === "undo" && S.fc.order) { S.fc.order.pop(); flashOrderSync(); }
      else if ((a === "fix-check" || a === "fix-reveal") && c) {
        // a wrong fix (or showing the answer) counts as wrong: the card comes back tomorrow, like any flashcard
        var root = view.querySelector(".fc-page"), done = function (r) { root.querySelectorAll(".sb-fix, .sb-diag input, [data-fc=fix-check], [data-fc=fix-reveal]").forEach(function (x) { x.disabled = true; }); flashShowResult(r.right, r.html, true); };
        if (a === "fix-reveal") Engine.run(c.dataset, c.fixed_sql).then(function (x) { var exp = lastResult(x); done({ right: false, html: '<div class="muted small">A corrected query</div><pre class="mcq-code">' + highlight(c.fixed_sql) + "</pre>" + (c.explanation ? "<p>" + esc(c.explanation) + "</p>" : "") + (exp ? '<div class="muted small">Its real result</div>' + miniTable(exp) : "") }); });
        else spotBugCheck(root, c, "fc").then(function (r) { if (r.msg) root.querySelector(".fc-res").innerHTML = '<p class="small bad-txt">' + esc(r.msg) + "</p>"; else if (r.fallback) done({ right: false, html: '<pre class="mcq-code">' + highlight(c.fixed_sql) + "</pre>" }); else done(r); });
      }
      return;
    }
    var fp = t.closest("[data-fc-part]");
    if (fp && S.fc && S.fc.order) { S.fc.order.push(Number(fp.getAttribute("data-fc-part"))); flashOrderSync(); }
  });
  function flashOrderSync() {
    var F = S.fc, c = F.cards[F.i];
    view.querySelector(".fc-built").innerHTML = F.order.map(function (n) { return "<li>" + esc(F.shuffled[n].p) + "</li>"; }).join("");
    view.querySelectorAll("[data-fc-part]").forEach(function (b) { b.disabled = F.order.indexOf(Number(b.getAttribute("data-fc-part"))) > -1; });
    if (F.order.length === F.shuffled.length) {
      var ok = F.order.every(function (n, i) { return F.shuffled[n].p === c.parts[i]; });
      view.querySelectorAll("[data-fc-part],[data-fc=undo]").forEach(function (b) { b.disabled = true; });
      flashShowResult(ok, ok ? "" : '<div class="muted small">The right order</div><pre class="mcq-code">' + highlight(c.parts.join("\n")) + "</pre>");
    } else { var nextBtn = view.querySelector("[data-fc-part]:not(:disabled)"); if (nextBtn) nextBtn.focus(); }
  }
  document.addEventListener("keydown", function (e) {
    if (route.name === "concept" && e.target.closest && e.target.closest("[data-ctab]") && (e.key === "ArrowRight" || e.key === "ArrowLeft" || e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      var i = CTABS.indexOf(e.target.getAttribute("data-ctab")), N = CTABS.length, n = e.key === "Home" ? 0 : e.key === "End" ? N - 1 : (i + (e.key === "ArrowRight" ? 1 : N - 1)) % N;
      var b = $('[data-ctab="' + CTABS[n] + '"]'); if (b) b.click();
      return;
    }
    if (route.name !== "flashcards" || !S.fc || e.ctrlKey || e.metaKey || e.altKey) return;
    var typing = e.target.closest && e.target.closest("input,textarea");
    if (typing) { if (e.key === "Enter" && e.target.id === "fcAnswer" && !e.target.readOnly) { e.preventDefault(); var ck = view.querySelector('[data-fc="check"]'); if (ck) ck.click(); } return; }
    var grade = view.querySelector(".fc-grade");
    if ((e.key === " " || e.key === "Enter") && view.querySelector(".fc-reveal") && !view.querySelector(".fc-reveal").hidden) { e.preventDefault(); view.querySelector('[data-fc="reveal"]').click(); }
    else if (grade && !grade.hidden && (e.key === "y" || e.key === "Y")) { e.preventDefault(); flashGrade(true); }
    else if (grade && !grade.hidden && (e.key === "n" || e.key === "N")) { e.preventDefault(); flashGrade(false); }
    else if (e.key === "Backspace" && S.fc.order && S.fc.order.length && !view.querySelector(".fc-res").innerHTML) { e.preventDefault(); S.fc.order.pop(); flashOrderSync(); }
  });
  view.addEventListener("input", function (e) {
    if (e.target.matches('[data-act="notes-q"]')) { S.learn.notesQ = e.target.value; clearTimeout(loadNotes._t); loadNotes._t = setTimeout(loadNotes, 200); }
  });

  // ---------- the shared card engine (renderers) ----------
  // The rules (card types, checks, answer options) live in cards.js (window.Cards), shared with the server and the
  // tests. Renderers: recall (reveal / choose), code (type or fix SQL), result (tables, joins, predictions). The
  // existing flashcard, predict and MCQ views keep their own code paths; the engine adds Spot the bug (a fix that
  // really runs), the extra card types (Join mapper, Compare two queries: optional practice) and the Challenge.
  var XC = {};
  function verdictHtml(right) { return '<p class="verdict ' + (right ? "ok-txt" : "bad-txt") + '">' + icon(right ? "checkCircle" : "x") + (right ? "Right" : "Not quite") + "</p>"; }
  // the same 1-5 scale as the Reflect box
  function confHtml(id) {
    return '<fieldset class="rf-conf xc-conf"><legend>How sure are you? <span class="muted small">(optional)</span></legend>' + [1, 2, 3, 4, 5].map(function (n) { return '<label><input type="radio" name="' + id + '-conf" value="' + n + '"><span>' + n + "</span></label>"; }).join("") + '<span class="muted small">1 = guessing · 5 = could teach it</span></fieldset>';
  }
  function confOf(root, id) { var c = root.querySelector('[name="' + id + '-conf"]:checked'); return c ? Number(c.value) : null; }
  function xTable(t) { return '<div class="xc-t"><div class="muted small mono">' + esc(t.name) + "</div>" + miniTable({ columns: t.columns, rows: t.rows }) + "</div>"; }
  // Spot the bug (code renderer): the learner fixes the query and picks what was wrong; the fix really runs
  function spotBugUsable(c) { return !!(window.Cards && c && c.type === "error" && c.dataset && c.fixed_sql && Cards.isReadOnlySql(c.fixed_sql)); }
  function spotBugHtml(c, idp) {
    return '<div class="fc-q">' + esc(c.prompt && c.prompt !== "Spot the error" ? c.prompt : "Find the bug, fix the query and say what was wrong") + '</div><pre class="mcq-code">' + highlight(c.wrong_sql) + "</pre>" +
      '<label class="fc-in"><span>Your fixed query (it runs on your copy of the dataset)</span><textarea class="inp mono sb-fix" rows="3" spellcheck="false">' + esc(c.wrong_sql) + "</textarea></label>" +
      (c.diagnosis ? '<fieldset class="po-opts sb-diag"><legend>What was wrong?</legend>' + c.diagnosis.map(function (o, i) { return '<label class="po-opt"><input type="radio" name="' + idp + '-diag" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + "ABCD".charAt(i) + '</span><span class="po-body">' + esc(o.text) + "</span></label>"; }).join("") + "</fieldset>" : "");
  }
  function lastResult(x) { var res = x && x.ok && x.results && x.results[x.results.length - 1]; return res ? { columns: res.columns, rows: res.values } : null; }
  /** { msg } (not checked yet), { fallback } (the fixed query doesn't run here) or { right, html }. */
  function spotBugCheck(root, c, idp) {
    var sql = root.querySelector(".sb-fix").value;
    if (!Cards.isReadOnlySql(sql)) return Promise.resolve({ msg: "Write one SELECT statement: it runs on your copy of the dataset." });
    var d = root.querySelector('[name="' + idp + '-diag"]:checked');
    if (c.diagnosis && !d) return Promise.resolve({ msg: "Choose what was wrong first." });
    return Promise.all([Engine.run(c.dataset, c.fixed_sql), Engine.run(c.dataset, sql)]).then(function (r) {
      var exp = lastResult(r[0]);
      if (!exp) return { fallback: true };
      var got = lastResult(r[1]);
      var fixOk = !!got && Cards.checkFix(got, exp, Cards.sortsRows(c.fixed_sql)).ok, diagOk = !c.diagnosis || d.getAttribute("data-right") === "1";
      return {
        right: fixOk && diagOk,
        html: (r[1].ok ? (fixOk ? '<p class="small ok-txt">Your fix returns the same result as a correct query.</p>' : '<p class="small bad-txt">Your fix returns a different result.</p>') : '<p class="small bad-txt">Your query doesn\'t run: ' + esc(r[1].error || "") + "</p>") +
          (c.diagnosis && !diagOk ? '<p class="small bad-txt">That isn\'t the bug.</p>' : "") +
          '<div class="muted small">A corrected query</div><pre class="mcq-code">' + highlight(c.fixed_sql) + "</pre>" + (c.explanation ? "<p>" + esc(c.explanation) + "</p>" : "") + '<div class="muted small">Its real result</div>' + miniTable(exp),
      };
    });
  }
  // the extra card types (result renderer): Join mapper and Compare two queries
  function xcardHtml(c, opts) {
    opts = opts || {};
    XC[c.id] = c;
    var T = (window.Cards && Cards.TYPES[c.card_type]) || {}, id = "xc-" + c.id.replace(/[^\w-]/g, ""), body = "";
    var choose = function (cols, t) { return '<option value="">Choose…</option>' + cols.map(function (x) { return '<option value="' + esc(t + "." + x) + '">' + esc(t + "." + x) + "</option>"; }).join(""); };
    if (c.card_type === "join_mapper") {
      body = '<div class="xc-tables">' + xTable(c.left) + xTable(c.right) + "</div>" +
        '<div class="xc-pick"><label><span>Key in ' + esc(c.left.name) + '</span><select class="inp" data-xc="left">' + choose(c.left.columns, c.left.name) + '</select></label><label><span>Key in ' + esc(c.right.name) + '</span><select class="inp" data-xc="right">' + choose(c.right.columns, c.right.name) + "</select></label></div>" +
        '<fieldset class="xc-join"><legend>Join type</legend>' + ["INNER", "LEFT", "RIGHT", "FULL"].map(function (j) { return '<label class="opt-chip"><input type="radio" name="' + id + '-join" value="' + j + '"><span>' + j + " JOIN</span></label>"; }).join("") + "</fieldset>";
    } else if (c.card_type === "compare_queries") {
      body = '<details class="xc-setup"><summary class="small">The table' + (c.tables.length > 1 ? "s" : "") + " (" + c.tables.map(function (t) { return esc(t.name); }).join(", ") + ')</summary><div class="xc-tables">' + c.tables.map(xTable).join("") + "</div></details>" +
        '<div class="xc-q2"><div><div class="muted small">Query A</div><pre class="mcq-code">' + highlight(c.query_a) + '</pre></div><div><div class="muted small">Query B</div><pre class="mcq-code">' + highlight(c.query_b) + "</pre></div></div>" +
        '<fieldset class="po-opts xc-opts"><legend>What do they return?</legend>' + Cards.compareOptions(c).map(function (o, i) { return '<label class="po-opt"><input type="radio" name="' + id + '-opt" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + "ABCD".charAt(i) + '</span><span class="po-body">' + esc(o.text) + "</span></label>"; }).join("") + "</fieldset>";
    } else { body = xcard2Body(c, id); if (!body) return ""; }
    return '<section class="card card-pad xcard" data-xcard="' + esc(c.id) + '"' + (opts.challenge ? ' data-challenge="1"' : "") + '><div class="xc-head"><span class="tag">' + esc(T.label || c.card_type) + "</span>" + (opts.challenge ? "" : '<span class="muted small">Optional practice · not part of mastery</span>') + "</div>" +
      '<p class="pq">' + esc(c.question) + "</p>" + body + confHtml(id) + '<div class="actions"><button type="button" class="btn primary sm" data-xc-check>' + icon("checkCircle") + 'Check</button></div><div class="xc-out" aria-live="polite"></div></section>';
  }
  function xcardCheck(sec) {
    var c = XC[sec.getAttribute("data-xcard")], id = "xc-" + c.id.replace(/[^\w-]/g, ""), out = sec.querySelector(".xc-out"), right, html, after = null;
    if (c.card_type === "join_mapper") {
      var L = sec.querySelector('[data-xc="left"]').value, Rr = sec.querySelector('[data-xc="right"]').value, j = sec.querySelector('[name="' + id + '-join"]:checked');
      if (!L || !Rr || !j) { out.innerHTML = '<p class="small bad-txt">Choose both keys and a join type first.</p>'; return; }
      var r = Cards.checkJoinMapper({ left: L, right: Rr, join: j.value }, c); right = r.right;
      html = (r.keyRight ? "" : '<p class="small">The tables match on <b class="mono">' + esc(c.key.left) + " = " + esc(c.key.right) + "</b>.</p>") + (r.typeRight ? "" : '<p class="small">The join type is <b>' + esc(c.join_type) + " JOIN</b>.</p>") +
        '<div class="muted small">The real result</div>' + miniTable(c.result) + (c.why ? '<p class="small">' + esc(c.why) + "</p>" : "");
    } else if (c.card_type !== "compare_queries") {
      var r2 = xcard2Check(sec, c, id);
      if (r2.msg) { out.innerHTML = '<p class="small bad-txt">' + esc(r2.msg) + "</p>"; return; }
      if (r2.pending) {
        // the learner's query really runs first (sort and filter)
        var cb = sec.querySelector("[data-xc-check]"); cb.disabled = true; out.innerHTML = '<p class="muted small">Running your query…</p>';
        r2.pending.then(function (x) { cb.disabled = false; if (x.msg) { out.innerHTML = '<p class="small bad-txt">' + esc(x.msg) + "</p>"; return; } xcardFinish(sec, c, id, x.right, x.html, x.after); });
        return;
      }
      right = r2.right; html = r2.html; after = r2.after || null;
    } else {
      var o = sec.querySelector('[name="' + id + '-opt"]:checked');
      if (!o) { out.innerHTML = '<p class="small bad-txt">Choose an answer first.</p>'; return; }
      right = o.getAttribute("data-right") === "1";
      html = '<div class="xc-q2"><div><div class="muted small">Query A · real result</div><div class="xc-ra">' + miniTable(c.result_a) + '</div></div><div><div class="muted small">Query B · real result</div><div class="xc-rb">' + miniTable(c.result_b) + "</div></div></div>" + (c.why ? '<p class="small">' + esc(c.why) + "</p>" : "");
    }
    xcardFinish(sec, c, id, right, html, after);
  }
  function xcardFinish(sec, c, id, right, html, after) {
    learnAnswered("card", c.id, right);
    var out = sec.querySelector(".xc-out");
    out.innerHTML = verdictHtml(right) + html;
    if (after) after();
    if (c.card_type === "compare_queries") {
      // rows that only one query returns are marked (text, not only colour)
      var d = Cards.rowDiff(c.result_a.rows, c.result_b.rows);
      [[".xc-ra", d.onlyA, "only in A"], [".xc-rb", d.onlyB, "only in B"]].forEach(function (x) { var trs = out.querySelectorAll(x[0] + " tbody tr"); x[1].forEach(function (i) { if (trs[i]) { trs[i].classList.add("xc-only"); trs[i].lastElementChild.insertAdjacentHTML("beforeend", ' <span class="xc-mark">' + x[2] + "</span>"); } }); });
    }
    sec.querySelectorAll("input, select, [data-xc-check]").forEach(function (x) { x.disabled = true; });
    var conf = confOf(sec, id), challenge = sec.hasAttribute("data-challenge");
    (challenge ? learnApi("/challenge", { ref: c.id, kind: "card", correct: right, confidence: conf }) : learnApi("/card/" + encodeURIComponent(c.id), { correct: right, confidence: conf })).then(function () { if (challenge) challengeDone(right); }).catch(function (e) { toast(e.message); });
    var v = out.querySelector(".verdict"); if (v) { v.setAttribute("tabindex", "-1"); v.focus(); }
  }
  // ---------- Phase 2 renderers (result renderer): pick rows, compare joins, find the difference, a timeline, a key ----------
  // a table whose rows can be ticked (the first column is the row's key); the same look as the result tables
  function pickTable(t, id, caption) {
    return '<div class="tbl-wrap po-tbl"><table class="grid xc-pick-t"><caption class="sr-only">' + esc(caption || t.name) + "</caption><thead><tr><th scope=\"col\"><span class=\"sr-only\">Pick</span></th>" + t.columns.map(function (h) { return '<th scope="col">' + esc(h) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      t.rows.map(function (row) { var k = String(row[0]); return '<tr data-key="' + esc(k) + '"><td><input type="checkbox" name="' + id + '-pick" value="' + esc(k) + '" aria-label="' + esc(t.columns[0] + " " + k) + '"></td>' + row.map(function (v) { return "<td" + (v == null ? ' class="null"' : "") + ">" + (v == null ? "NULL" : esc(v)) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function picked(sec, id) { return [].slice.call(sec.querySelectorAll('[name="' + id + '-pick"]:checked')).map(function (x) { return x.value; }); }
  // after a check: every row says whether it should have been ticked (text, not only colour)
  function markPicks(sec, id, right) {
    var want = {}; right.forEach(function (k) { want[String(k)] = 1; });
    sec.querySelectorAll('[name="' + id + '-pick"]').forEach(function (x) {
      var tr = x.closest("tr"), should = !!want[x.value], ok = should === x.checked;
      tr.classList.add(should ? "xc-in" : "xc-out-row"); if (!ok) tr.classList.add("xc-wrongpick");
      x.parentNode.insertAdjacentHTML("beforeend", '<span class="xc-mark">' + (should ? (x.checked ? "✓ yes" : "missed") : (x.checked ? "✗ no" : "")) + "</span>");
    });
  }
  function diffSql(tokens) { return tokens.map(function (t) { return t.changed ? '<mark class="xc-chg">' + esc(t.t) + '<span class="sr-only"> (changed)</span></mark>' : esc(t.t); }).join(" ").replace(/ ([,;)])/g, "$1").replace(/\( /g, "("); }
  function xcard2Body(c, id) {
    if (c.card_type === "result_set") return '<pre class="mcq-code">' + highlight(c.query) + '</pre><div class="muted small">Tick the rows it returns</div>' + pickTable(c.table, id, c.table.name);
    if (c.card_type === "join_compare") {
      var S = c.side === "left" ? c.left : c.right, O = c.side === "left" ? c.right : c.left;
      return '<div class="muted small">They join on <span class="mono">' + esc(c.key.left) + " = " + esc(c.key.right) + "</span></div>" + '<div class="xc-tables"><div class="xc-t"><div class="muted small mono">' + esc(O.name) + "</div>" + miniTable(O) + '</div><div class="xc-t"><div class="muted small">Tick the <b class="mono">' + esc(S.name) + "</b> rows</div>" + pickTable(S, id, S.name) + "</div></div>";
    }
    if (c.card_type === "find_difference") { var d = Cards.tokenDiff(c.query_a, c.query_b); return '<div class="xc-q2"><div><div class="muted small">Query A</div><pre class="mcq-code xc-diff">' + diffSql(d.a) + '</pre></div><div><div class="muted small">Query B</div><pre class="mcq-code xc-diff">' + diffSql(d.b) + '</pre></div></div><div class="muted small">Tick the rows only ONE of the queries returns</div>' + pickTable(c.table, id, c.table.name); }
    if (c.card_type === "exec_timeline") return '<pre class="mcq-code">' + highlight(numberedScript(c.script)) + '</pre><div class="muted small">Then: <span class="mono">' + esc(c.check_sql) + '</span></div><fieldset class="po-opts xc-opts"><legend>The table after statement ' + c.ask_step + "</legend>" +
      Cards.timelineOptions(c, c.ask_step).map(function (o, i) { return '<label class="po-opt"><input type="radio" name="' + id + '-opt" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + "ABCD".charAt(i) + '</span><span class="po-body">' + miniTable(o.snap) + "</span></label>"; }).join("") + "</fieldset>";
    if (c.card_type === "schema_detective") return miniTable(c.table) + '<fieldset class="xc-join"><legend>The key column</legend>' + c.candidates.map(function (col) { return '<label class="opt-chip"><input type="radio" name="' + id + '-key" value="' + esc(col) + '"><span class="mono">' + esc(col) + "</span></label>"; }).join("") + "</fieldset>";
    return xcard3Body(c, id);
  }
  /** { msg } when nothing is chosen yet, else { right, html } (and the rows marked afterwards). */
  function xcard2Check(sec, c, id) {
    var t = c.card_type, r, html = "";
    if (t === "result_set" || t === "join_compare" || t === "find_difference") {
      var got = picked(sec, id);
      if (!got.length) return { msg: "Tick at least one row first." };
      r = Cards.checkRowPick(got, c.answer_ids);
      if (t === "result_set") html = '<div class="muted small">The real result</div>' + miniTable(c.result);
      else if (t === "find_difference") html = '<div class="xc-q2"><div><div class="muted small">Query A · real result</div>' + miniTable(c.result_a) + '</div><div><div class="muted small">Query B · real result</div>' + miniTable(c.result_b) + "</div></div>";
      else html = '<div class="xc-toggle" role="group" aria-label="Show the real result of a join type">' + ["INNER", "LEFT", "RIGHT", "FULL"].map(function (j) { return '<button type="button" class="btn sm" data-jc="' + j + '" aria-pressed="' + (j === c.pair[1]) + '">' + j + "</button>"; }).join("") + '</div><div class="xc-jres" aria-live="polite">' + jcResult(c, c.pair[1]) + "</div>";
      return { right: r.right, html: html + (c.why ? '<p class="small">' + esc(c.why) + "</p>" : ""), after: function () { markPicks(sec, id, c.answer_ids); } };
    }
    if (t === "exec_timeline") {
      var o = sec.querySelector('[name="' + id + '-opt"]:checked');
      if (!o) return { msg: "Choose a table first." };
      return { right: o.getAttribute("data-right") === "1", html: '<div class="xc-step" data-step="' + c.ask_step + '">' + stepHtml(c, c.ask_step) + "</div>" + (c.why ? '<p class="small">' + esc(c.why) + "</p>" : "") };
    }
    if (t === "schema_detective") {
      var k = sec.querySelector('[name="' + id + '-key"]:checked');
      if (!k) return { msg: "Choose a column first." };
      var s = Cards.checkSchemaPick(k.value, c);
      html = '<div class="muted small">The proof: real counts on these rows</div>' + miniTable({ columns: ["column", "rows", "distinct values", "NULLs", "can be the key"], rows: c.stats.map(function (x) { return [x.column, x.rows, x.distinct, x.nulls, x.column === s.key ? "yes" : "no"]; }) }) + (c.why ? '<p class="small">' + esc(c.why) + "</p>" : "");
      return { right: s.right, html: html };
    }
    return xcard3Check(sec, c, id);
  }
  function jcResult(c, j) { var r = c.results_by_type[j]; return '<div class="muted small">' + esc(j) + " JOIN · real result (" + plural(r.rows.length, "row") + ")</div>" + miniTable(r); }
  function stepHtml(c, k) {
    var s = c.snapshots[k - 1], n = c.snapshots.length;
    return '<div class="xc-stepbar"><button type="button" class="btn sm" data-step-go="-1"' + (k <= 1 ? " disabled" : "") + ' aria-label="Previous statement">' + icon("chevLeft") + '</button><span class="mono small" aria-live="polite">After statement ' + k + " of " + n + '</span><button type="button" class="btn sm" data-step-go="1"' + (k >= n ? " disabled" : "") + ' aria-label="Next statement">' + icon("chevRight") + "</button></div>" +
      '<pre class="mcq-code">' + highlight(s.statement + ";") + "</pre>" + miniTable(s);
  }
  view.addEventListener("click", function (e) {
    var t = e.target;
    var jb = t.closest && t.closest("[data-jc]");
    if (jb) { var sec = jb.closest(".xcard"), c = XC[sec.getAttribute("data-xcard")]; sec.querySelectorAll("[data-jc]").forEach(function (b) { b.setAttribute("aria-pressed", String(b === jb)); }); sec.querySelector(".xc-jres").innerHTML = jcResult(c, jb.getAttribute("data-jc")); return; }
    var sg = t.closest && t.closest("[data-step-go]");
    if (sg) { var box = sg.closest(".xc-step"), sec2 = sg.closest(".xcard"), c2 = XC[sec2.getAttribute("data-xcard")], k = Number(box.getAttribute("data-step")) + Number(sg.getAttribute("data-step-go")); k = Math.max(1, Math.min(c2.snapshots.length, k)); box.setAttribute("data-step", k); box.innerHTML = stepHtml(c2, k); var nb = box.querySelector('[data-step-go="' + sg.getAttribute("data-step-go") + '"]:not([disabled])') || box.querySelector("[data-step-go]:not([disabled])"); if (nb) nb.focus(); }
  });
  // ---------- Phase 3 renderers: sort and filter (scenario), query optimizer (result) ----------
  function sfPick(sec, id) {
    var f = [].slice.call(sec.querySelectorAll('[name="' + id + '-f"]:checked')).map(function (x) { return Number(x.value); }), s = sec.querySelector('[name="' + id + '-s"]:checked');
    return { filters: f, sort: s ? Number(s.value) : null };
  }
  function planHtml(details) { return '<ol class="xc-plan">' + details.map(function (d) { return '<li><span class="mono small">' + esc(d) + "</span><br>" + esc(Cards.planStep(d)) + "</li>"; }).join("") + "</ol>"; }
  function xcard3Body(c, id) {
    if (c.card_type === "sort_filter") return '<div class="muted small mono">' + esc(c.table.name) + "</div>" + miniTable(c.table) +
      '<fieldset class="xc-sf"><legend>Conditions <span class="muted small">(the ones you tick are joined by AND)</span></legend>' + c.filters.map(function (f, i) { return '<label class="opt-chip"><input type="checkbox" name="' + id + '-f" value="' + i + '" data-sf><span class="mono">' + esc(f) + "</span></label>"; }).join("") + "</fieldset>" +
      '<fieldset class="xc-sf"><legend>Order by</legend>' + c.sorts.map(function (s, i) { return '<label class="opt-chip"><input type="radio" name="' + id + '-s" value="' + i + '" data-sf><span class="mono">' + esc(s) + "</span></label>"; }).join("") + "</fieldset>" +
      '<div class="muted small">Your query</div><pre class="mcq-code xc-sql" aria-live="polite">' + highlight(Cards.assembleQuery(c, { filters: [], sort: null })) + "</pre>";
    if (c.card_type === "query_optimizer") return '<details class="xc-setup"><summary class="small">The table (' + esc(c.table) + ')</summary><pre class="mcq-code">' + highlight(c.schema) + "</pre></details>" +
      '<div class="muted small">The index</div><pre class="mcq-code">' + highlight(c.index) + '</pre><div class="muted small">The query</div><pre class="mcq-code">' + highlight(c.query) + "</pre>" +
      '<fieldset class="po-opts xc-opts"><legend>With the index in place, SQLite…</legend>' + Cards.optimizerOptions(c).map(function (o, i) { return '<label class="po-opt"><input type="radio" name="' + id + '-opt" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + "ABCD".charAt(i) + '</span><span class="po-body">' + esc(o.text) + "</span></label>"; }).join("") + "</fieldset>";
    return "";
  }
  function xcard3Check(sec, c, id) {
    if (c.card_type === "sort_filter") {
      var pick = sfPick(sec, id);
      if (pick.sort == null) return { msg: "Choose an order first." };
      var mine = Cards.assembleQuery(c, pick), ref = Cards.assembleQuery(c, c.answer);
      return { pending: Promise.all([Engine.scratch(c.setup_sql, mine), Engine.scratch(c.setup_sql, ref)]).then(function (r) {
        var got = lastResult(r[0]), exp = lastResult(r[1]);
        if (!exp) return { msg: "This card can't be checked right now." };
        var right = !!got && Cards.checkFix(got, exp, true).ok;
        return { right: right, html: '<div class="muted small">Your query · real result</div><pre class="mcq-code">' + highlight(mine) + "</pre>" + (r[0].ok ? (got ? miniTable(got) : '<p class="small">No rows.</p>') : '<p class="small bad-txt">It doesn\'t run: ' + esc(r[0].error || "") + "</p>") +
          (right ? "" : '<div class="muted small">A right query · real result</div><pre class="mcq-code">' + highlight(ref) + "</pre>" + miniTable(exp)) + (c.why ? '<p class="small">' + esc(c.why) + "</p>" : "") };
      }) };
    }
    if (c.card_type === "query_optimizer") {
      var o = sec.querySelector('[name="' + id + '-opt"]:checked');
      if (!o) return { msg: "Choose an answer first." };
      return { right: o.getAttribute("data-right") === "1", html: '<div class="xc-q2"><div><div class="muted small">Real plan without the index</div>' + planHtml(c.plan_before) + '</div><div><div class="muted small">Real plan with the index</div>' + planHtml(c.plan_after) + "</div></div>" +
        '<p class="small"><b>' + (c.helps ? "Here the planner uses the index." : "Here the index exists, but the planner can't use it for this query.") + "</b> An index only helps when the planner can use it for the query; it also costs space and slows down writes.</p>" +
        (c.why ? '<p class="small">' + esc(c.why) + "</p>" : "") + '<p class="muted small">Plans from SQLite\'s EXPLAIN QUERY PLAN. MySQL or PostgreSQL, and real table sizes, can lead to a different plan.</p>' };
    }
    return { msg: "" };
  }
  // the assembled query follows the learner's picks
  view.addEventListener("change", function (e) {
    var t = e.target;
    if (!t.hasAttribute || !t.hasAttribute("data-sf")) return;
    var sec = t.closest(".xcard"), c = XC[sec.getAttribute("data-xcard")], id = "xc-" + c.id.replace(/[^\w-]/g, "");
    sec.querySelector(".xc-sql").innerHTML = highlight(Cards.assembleQuery(c, sfPick(sec, id)));
  });
  // ---------- the admin's live preview: one item, rendered by the learner renderers ----------
  window.addEventListener("message", function (e) {
    if (e.origin !== location.origin || !e.data || e.data.type !== "sqld-preview") return;
    S.previewItem = e.data.item;
    if (route.name === "preview") viewPreview();
  });
  function viewPreview() {
    PREVIEW_MODE = true;
    // inside the admin page: never pull focus out of the form (a learner renderer focuses its first control)
    if (!viewPreview.noFocus) { viewPreview.noFocus = true; HTMLElement.prototype.focus = function () {}; }
    document.body.classList.add("preview-mode");
    var it = S.previewItem;
    if (!it) { view.innerHTML = '<div class="page full"><div class="card empty">' + icon("eye") + "<div><p>The item appears here once it passes its checks.</p></div></div></div>"; return; }
    var wrap = function (inner) { return '<div class="page full"><div class="col preview-col">' + inner + "</div></div>"; };
    if (it.kind === "drill") {
      view.innerHTML = wrap('<section class="card card-pad"><div class="dmeta">' + diffBadge(it.diff || "medium") + '<span class="tag">' + esc(levelName(it.level || 1)) + "</span></div><h1>" + esc(it.title) + '</h1><div class="dq">' + exerciseText(it.body || "") + "</div>" +
        (it.hints && it.hints.length ? '<p class="muted small">' + plural(it.hints.length, "hint") + " written with the exercise come first in the hint ladder.</p>" : "") + "</section>" + (it.dataset ? schemaPanel({ kind: "sqlite", key: it.dataset }, { hint: "the dataset of this exercise" }) : ""));
      return;
    }
    if (it.kind === "mcq") { S.byMcq[it.m.id] = it.m; view.innerHTML = wrap('<section class="card card-pad">' + mcqBlock(it.m, false) + "</section>"); return; }
    if (it.kind === "predict") { route.args = ["__preview"]; S.learn.concept.__preview = { slug: "__preview", predicts: [it.p], flashcards: [], cards: [] }; view.innerHTML = wrap(predictCard(it.p)); return; }
    if (it.kind === "lesson") { view.innerHTML = wrap(lessonCard(it.l)); return; }
    if (it.kind === "card") { view.innerHTML = wrap(xcardHtml(it.c)); return; }
    if (it.kind === "flashcard") { S.fc = { slug: null, cards: [Object.assign({ conceptName: "Preview" }, it.f)], i: 0, right: 0, wrong: 0, later: 0, results: [], extra: true }; flashStep(); }
  }
  // ---------- the SQL workspace (Learn step 2, Docs): the course editor (line numbers, highlighting), run, results ----------
  // SQLite examples run in the browser; MySQL ones on a scratch copy (/api/learn/docs/run). Nothing else changes.
  S.learnDraft = S.learnDraft || {};
  function exampleSqlOf(l) { var ex = (l && l.example) || {}; return ex.sql || (ex.before && ex.before.sql) || ""; }
  function exampleLocal(l) { var ex = (l && l.example) || {}; return !!(l && l.dataset) && (!ex.engine || ex.engine === "SQLite") && !ex.format; }
  function sqlWorkspace(l, slug, opts) {
    opts = opts || {};
    var orig = exampleSqlOf(l);
    if (!orig) return emptyStage("code", "This lesson has no example to run.", null);
    var local = exampleLocal(l), engine = local ? "SQLite" : "MySQL", id = "ex-" + String(slug).replace(/[^\w-]/g, ""), sql = S.learnDraft[slug] != null ? S.learnDraft[slug] : orig;
    return '<section class="card ws-card ln-try" data-ex="' + esc(slug) + '" data-ex-mode="' + (local ? "local" : "server") + '" data-dataset="' + esc(l.dataset || "") + '" aria-labelledby="' + id + '-h">' +
      '<div class="ws-head"><div><h3 id="' + id + '-h">' + icon("code") + "Try the example</h3><p class=\"muted small\">Edit and run the SQL query. Check the results below.</p></div></div>" +
      '<div class="ws-ed"><div class="ws-ed-bar"><span class="ws-dialect" title="Where this query runs">' + icon("db") + esc(engine) + '</span><button type="button" class="ws-copy" data-ex-copy aria-label="Copy the query">' + icon("copy") + "<span>Copy</span></button></div>" +
      '<div class="editor ide"><div class="gutter" aria-hidden="true">1</div><div class="ed-inner"><pre class="hl" aria-hidden="true"></pre><label class="sr-only" for="' + id + '">The example query (' + engine + ")</label>" +
      '<textarea id="' + id + '" class="ln-sql" spellcheck="false" autocomplete="off" data-orig="' + esc(orig) + '">' + esc(sql) + "</textarea></div></div></div>" +
      '<div class="ws-ctl"><button type="button" class="btn primary" data-ex-run>' + icon("play") + 'Run</button><button type="button" class="btn" data-ex-reset>' + icon("reset") + 'Back to the example</button><span class="grow"></span><span class="muted small ws-kbd"><kbd>Ctrl</kbd> <kbd>Enter</kbd> to run</span></div>' +
      '<div class="ws-res" aria-live="polite"><p class="muted small ws-idle">Run the query to see its result here.</p></div></section>';
  }
  // the course editor, as on the exercise page: highlighted text under a transparent textarea, line numbers alongside
  function wsSync(ta) {
    var ed = ta.closest(".editor"), hl = ed.querySelector(".hl"), n = ta.value.split("\n").length, nums = [];
    hl.innerHTML = highlight(ta.value) + "\n";
    for (var i = 1; i <= n; i++) nums.push(i);
    ed.querySelector(".gutter").textContent = nums.join("\n");
    ta.style.height = "0px"; ta.style.height = Math.max(hl.scrollHeight, 120) + "px";
    ta.style.width = Math.max(hl.scrollWidth, ta.parentNode.clientWidth) + "px";
  }
  function wsMount(root) { [].forEach.call((root || view).querySelectorAll(".ws-card .ln-sql"), wsSync); }
  function wsResult(r, res, engine, sql) {
    if (!r.ok) return '<div class="ws-status bad" role="status">' + icon("x") + "<b>Error</b><span>" + esc(r.error || "It didn't run.") + "</span></div>";
    // the browser engine returns nothing for a SELECT without rows: that is an empty result, not "no table"
    var lastStmt = String(sql || "").replace(/--[^\n]*/g, "").trim().replace(/;\s*$/, "").split(";").pop();
    if (!res && /^\s*(select|with)\b/i.test(lastStmt)) return '<div class="ws-status ok" role="status">' + icon("checkCircle") + "<b>Result</b><span>0 rows · " + esc(engine) + '</span></div><p class="muted small ws-empty">No rows came back: the query ran but nothing matches.</p>';
    if (!res) return '<div class="ws-status ok" role="status">' + icon("checkCircle") + "<b>Ran</b><span>" + esc(engine) + " · it returns no table</span></div>";
    var shown = res.rows.slice(0, 100);
    var head = '<div class="ws-status ok" role="status">' + icon("checkCircle") + "<b>Result</b><span>" + (res.rows.length > shown.length ? "first " + shown.length + " of " : "") + plural(res.rows.length, "row") + " · " + esc(engine) + "</span>" +
      (res.rows.length > 8 ? '<button type="button" class="btn sm ws-expand" data-ex-expand aria-expanded="false">' + icon("expand") + "<span>Expand</span></button>" : "") + "</div>";
    if (!res.rows.length) return head + '<p class="muted small ws-empty">No rows came back: the query ran but nothing matches.</p>';
    return head + '<div class="ws-table"><table class="ws-grid"><caption class="sr-only">Query result</caption><thead><tr><th scope="col" class="ws-n">#</th>' + res.columns.map(function (c) { return '<th scope="col">' + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      shown.map(function (row, k) { return '<tr><th scope="row" class="ws-n">' + (k + 1) + "</th>" + row.map(function (v) { return v === null ? '<td class="null">NULL</td>' : "<td>" + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function exampleRun(box) {
    var ta = box.querySelector(".ln-sql"), out = box.querySelector(".ws-res"), btn = box.querySelector("[data-ex-run]"), key = box.getAttribute("data-dataset"), local = box.getAttribute("data-ex-mode") === "local", slug = box.getAttribute("data-ex");
    if (btn.disabled) return;
    if (!ta.value.replace(/--[^\n]*/g, "").trim()) { out.innerHTML = '<div class="ws-status bad" role="status">' + icon("x") + "<b>Nothing to run</b><span>Write a query first.</span></div>"; return; }
    btn.disabled = true; out.setAttribute("aria-busy", "true");
    out.innerHTML = '<div class="ws-status" role="status">' + icon("clock") + "<b>Running…</b><span>" + (local ? "SQLite, in your browser" : "a MySQL scratch copy") + "</span></div>";
    var done = function (r, res) {
      btn.disabled = false; out.removeAttribute("aria-busy");
      out.innerHTML = wsResult(r, res, r.engine || (local ? "SQLite" : "MySQL"), ta.value);
      if (r.ok && route.name === "learn") learnStepDone(slug, 2);
    };
    if (local) Engine.run(key, ta.value).then(function (r) { Engine.reset(key); done(r, lastResult(r)); });
    else learnApi("/docs/run", { slug: slug, sql: ta.value }).then(function (r) { done(r, r.result); }).catch(function (e) { done({ ok: false, error: e.message }); });
  }
  view.addEventListener("click", function (e) {
    var t = e.target; if (!t.closest) return;
    var run = t.closest("[data-ex-run]"); if (run) { exampleRun(run.closest("[data-ex]")); return; }
    var rs = t.closest("[data-ex-reset]");
    if (rs) { var box = rs.closest("[data-ex]"), ta = box.querySelector(".ln-sql"); ta.value = ta.getAttribute("data-orig"); delete S.learnDraft[box.getAttribute("data-ex")]; wsSync(ta); box.querySelector(".ws-res").innerHTML = '<p class="muted small ws-idle">Run the query to see its result here.</p>'; ta.focus(); return; }
    var cp = t.closest("[data-ex-copy]");
    if (cp) { var q = cp.closest("[data-ex]").querySelector(".ln-sql").value; (navigator.clipboard ? navigator.clipboard.writeText(q) : Promise.reject()).then(function () { toast("Query copied"); }).catch(function () { toast("Couldn't copy: select the text and press Ctrl+C"); }); return; }
    var xp = t.closest("[data-ex-expand]");
    if (xp) { var tb = xp.closest(".ws-res"), on = !tb.classList.contains("expanded"); tb.classList.toggle("expanded", on); xp.setAttribute("aria-expanded", String(on)); xp.querySelector("span").textContent = on ? "Collapse" : "Expand"; }
  });
  view.addEventListener("input", function (e) { if (e.target.classList && e.target.classList.contains("ln-sql")) { S.learnDraft[e.target.closest("[data-ex]").getAttribute("data-ex")] = e.target.value; wsSync(e.target); } });
  view.addEventListener("keydown", function (e) { if (e.target.classList && e.target.classList.contains("ln-sql") && e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); exampleRun(e.target.closest("[data-ex]")); } });
  // ---------- How to use: the learner and admin guides (public/help.js), numbers from /api/help/numbers ----------
  function helpNumbers() { return S.helpNums ? Promise.resolve(S.helpNums) : api("/api/help/numbers").then(function (n) { S.helpNums = n; return n; }); }
  function helpSectionHtml(s, nums) {
    return '<section class="card card-pad help-sec" id="h-' + s.id + '" aria-labelledby="hh-' + s.id + '"><h2 class="h3" id="hh-' + s.id + '" tabindex="-1">' + esc(s.title) + "</h2>" + Help.textHtml(s.text, nums) +
      (s.shot ? '<figure class="help-shot"><img src="/help/' + esc(s.shot) + '" alt="' + esc(s.alt) + '" loading="lazy" width="1200" height="750"><figcaption class="muted small">' + esc(s.alt) + " (from the app)</figcaption></figure>" : "") + "</section>";
  }
  function viewHelp() {
    var g = route.q && route.q.get("g") === "admin" ? "admin" : "learner", sec = route.q && route.q.get("s");
    view.innerHTML = '<div class="page"><div class="col"><div class="card card-pad" aria-busy="true"><p class="muted">Loading…</p></div></div></div>';
    helpNumbers().then(function (nums) {
      if (route.name !== "help") return;
      var list = g === "admin" ? Help.ADMIN : Help.LEARNER;
      var html = '<div class="page"><div class="col help-page"><div><div class="eyebrow">How to use</div><div class="hero"><div><h1>How to use SQL Drills</h1><p>Two guides: one for learning, one for the admin where content is made and reviewed. Every number on this page comes from the app as it is now.</p></div></div></div>' +
        '<div class="tabs" role="tablist"><a role="tab" href="#/help" class="' + (g === "learner" ? "on" : "") + '" aria-selected="' + (g === "learner") + '">' + icon("graduation") + 'Learner guide</a><a role="tab" href="#/help?g=admin" class="' + (g === "admin" ? "on" : "") + '" aria-selected="' + (g === "admin") + '">' + icon("gear") + "Admin guide</a></div>" +
        '<nav class="card card-pad help-toc" aria-label="Sections"><ol>' + list.map(function (s) { return '<li><a href="#/help?' + (g === "admin" ? "g=admin&" : "") + "s=" + s.id + '">' + esc(s.title) + "</a></li>"; }).join("") + "</ol>" + (g === "admin" ? '<p class="small"><a href="/admin">Open the admin</a></p>' : "") + "</nav>" +
        list.map(function (s) { return helpSectionHtml(s, nums); }).join("") + "</div>" + rail() + "</div>";
      view.innerHTML = html;
      var h = sec && $("#hh-" + sec);
      if (h) { h.scrollIntoView(); h.focus(); }
    }).catch(function (e) { view.innerHTML = '<div class="page"><div class="card empty">' + esc(e.message) + "</div></div>"; });
  }

  // ---------- Docs: the SQL reference (every lesson A-Z and searchable, a cheat sheet per level, engine differences) ----------
  function docsLoad() { return S.docs ? Promise.resolve(S.docs) : learnApi("/docs").then(function (d) { S.docs = d; return d; }); }
  function firstSentence(t) { var m = String(t || "").match(/^[^.!?]*[.!?]/); return (m ? m[0] : String(t || "")).replace(/`([^`]+)`/g, "$1").trim(); }
  function viewDocs() {
    var tab = (route.q && route.q.get("t")) || "az";
    view.innerHTML = '<div class="page"><div class="col"><div class="card card-pad" aria-busy="true"><p class="muted">Loading the reference…</p></div></div></div>';
    docsLoad().then(function (all) {
      if (route.name !== "docs") return;
      var tabs = [["az", "Concepts A-Z", "search"], ["sheets", "Cheat sheets", "file"], ["engines", "MySQL · PostgreSQL · SQLite", "db"]];
      var html = '<div class="page"><div class="col docs-page"><div><div class="eyebrow">Docs</div><div class="hero"><div><h1>SQL reference</h1><p>Every concept\'s lesson, a cheat sheet per level, and how the three course databases differ.</p></div></div></div>' +
        '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<a role="tab" href="#/docs?t=' + t[0] + '" class="' + (tab === t[0] ? "on" : "") + '" aria-selected="' + (tab === t[0]) + '">' + icon(t[2]) + esc(t[1]) + "</a>"; }).join("") + "</div>";
      if (tab === "sheets") {
        var lv = Number(route.q && route.q.get("l")) || 1;
        html += '<div class="f-chips" role="group" aria-label="Level">' + S.levels.map(function (L) { return '<a class="chip' + (L.n === lv ? " on" : "") + '" href="#/docs?t=sheets&l=' + L.n + '"' + (L.n === lv ? ' aria-current="page"' : "") + ">Level " + L.n + "</a>"; }).join("") + "</div>";
        var rows = all.filter(function (c) { return c.level === lv; });
        html += '<section class="card card-pad sheet" aria-labelledby="sh-h"><h2 class="h3" id="sh-h">Level ' + lv + " · " + esc(levelOf(lv) ? levelOf(lv).title : "") + ' cheat sheet</h2><div class="tbl-wrap"><table class="grid sheet-t"><caption class="sr-only">The concepts of Level ' + lv + '</caption><thead><tr><th scope="col">Concept</th><th scope="col">In one line</th><th scope="col">Example</th></tr></thead><tbody>' +
          rows.map(function (c) { var ex = c.lesson && c.lesson.example, sql = ex && (ex.sql || (ex.before && ex.before.sql)); return '<tr><th scope="row"><a href="#/docs?t=az&c=' + encodeURIComponent(c.slug) + '">' + esc(c.name) + "</a>" + (c.keywords.length ? '<div class="sheet-k">' + c.keywords.slice(0, 4).map(function (k) { return '<code>' + esc(k) + "</code>"; }).join(" ") + "</div>" : "") + "</th><td>" + esc(firstSentence(c.lesson ? c.lesson.what : c.summary)) + "</td><td>" + (sql ? '<pre class="mcq-code">' + highlight(sql) + "</pre>" : "") + "</td></tr>"; }).join("") + "</tbody></table></div><p class=\"muted small\">Open a concept to run its example.</p></section>";
      } else if (tab === "engines") {
        html += '<section class="card card-pad" aria-labelledby="en-h"><h2 class="h3" id="en-h">The same thing in MySQL, PostgreSQL and SQLite</h2><p class="muted small">The course runs exercises on SQLite in your browser and on MySQL 8 and PostgreSQL on this computer. These are the differences you meet most.</p><div class="tbl-wrap"><table class="grid eng-t"><caption class="sr-only">Differences between MySQL, PostgreSQL and SQLite</caption><thead><tr><th scope="col">Task</th><th scope="col">MySQL 8</th><th scope="col">PostgreSQL</th><th scope="col">SQLite</th></tr></thead><tbody>' +
          Help.DIFFS.map(function (r) { return '<tr><th scope="row">' + esc(r[0]) + "</th>" + r.slice(1).map(function (v) { return '<td class="mono">' + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div></section>";
      } else {
        var q = (route.q && route.q.get("q")) || "", open = route.q && route.q.get("c");
        var hay = function (c) { return [c.name, c.summary, c.keywords.join(" "), c.lesson ? c.lesson.what : ""].join(" ").toLowerCase(); };
        var list = all.filter(function (c) { return !q || hay(c).indexOf(q.toLowerCase()) > -1; }).sort(function (a, b) { return a.name.localeCompare(b.name, undefined, { sensitivity: "base" }); });
        var letterOf = function (c) { var ch = c.name.replace(/^[^A-Za-z]+/, "").charAt(0).toUpperCase(); return ch || "#"; };
        var letters = []; list.forEach(function (c) { if (letters.indexOf(letterOf(c)) < 0) letters.push(letterOf(c)); });
        html += '<label class="notes-search"><span class="sr-only">Search the reference</span>' + icon("search") + '<input type="search" class="inp" data-docs-q placeholder="Search ' + all.length + ' concepts: names, keywords, lessons…" value="' + esc(q) + '"></label>' +
          '<p class="muted small" aria-live="polite">' + (q ? list.length + " of " + all.length + " concepts match “" + esc(q) + "”" : all.length + " concepts, A-Z") + "</p>" +
          '<nav class="az-index" aria-label="Jump to a letter">' + letters.map(function (L) { return '<a href="#az-' + L + '" data-az="' + L + '">' + L + "</a>"; }).join("") + "</nav>";
        if (!list.length) html += emptyStage("search", "No concept matches that search.", ["#/docs?t=az", "Show every concept"]);
        letters.forEach(function (L) {
          html += '<section class="az-group" id="az-' + L + '" aria-labelledby="azh-' + L + '"><h2 class="h3 az-h" id="azh-' + L + '">' + L + "</h2>" + list.filter(function (c) { return letterOf(c) === L; }).map(function (c) {
            return '<details class="card card-pad doc-c" data-doc="' + esc(c.slug) + '"' + (c.slug === open ? " open" : "") + '><summary><span class="doc-n">' + esc(c.name) + '</span><span class="muted small">Level ' + c.level + "</span></summary><div class=\"doc-body\"></div></details>";
          }).join("") + "</section>";
        });
      }
      view.innerHTML = html + "</div>" + rail() + "</div>";
      [].forEach.call(view.querySelectorAll("details.doc-c[open]"), docFill);
      // typing in the search re-renders the list: the cursor stays in the search box
      if (S.docsTyping) { S.docsTyping = false; var si = $("[data-docs-q]"); if (si) { si.focus(); si.setSelectionRange(si.value.length, si.value.length); } }
      var o = open && view.querySelector('details[data-doc="' + open + '"]'); if (o) { o.scrollIntoView(); o.querySelector("summary").focus(); }
    }).catch(function (e) { view.innerHTML = '<div class="page"><div class="card empty">' + esc(e.message) + "</div></div>"; });
  }
  // a concept's lesson and runnable example, filled when it is opened (161 at once would be slow)
  function docFill(d) {
    var body = d.querySelector(".doc-body"); if (!body || body.childElementCount) return;
    var c = (S.docs || []).filter(function (x) { return x.slug === d.getAttribute("data-doc"); })[0];
    setTimeout(function () { schemaMount(body); wsMount(body); }, 0);
    body.innerHTML = c && c.lesson ? lessonCard(c.lesson, { noTables: true }) + sqlWorkspace(c.lesson, c.slug) + tablesPanel(c.lesson.dataset, exampleSqlOf(c.lesson), true) + '<p class="small"><a href="#/learn/' + encodeURIComponent(c.slug) + '?s=1">Learn it step by step</a> · <a href="#/concept/' + encodeURIComponent(c.slug) + '">Practise it</a></p>' : emptyStage("file", "No lesson for this concept yet.", ["#/concept/" + encodeURIComponent(d.getAttribute("data-doc")), "Open the concept page"]);
  }
  view.addEventListener("toggle", function (e) { if (e.target.matches && e.target.matches("details.doc-c") && e.target.open) docFill(e.target); }, true);
  view.addEventListener("input", function (e) {
    if (!e.target.hasAttribute || !e.target.hasAttribute("data-docs-q")) return;
    clearTimeout(viewDocs.t); var v = e.target.value;
    viewDocs.t = setTimeout(function () { history.replaceState(null, "", "#/docs?t=az" + (v ? "&q=" + encodeURIComponent(v) : "")); route.q = new URLSearchParams("t=az" + (v ? "&q=" + encodeURIComponent(v) : "")); S.docsTyping = true; viewDocs(); }, 250);
  });
  // A-Z letters move to their group in the page (the hash holds the route)
  view.addEventListener("click", function (e) { var a = e.target.closest && e.target.closest("[data-az]"); if (!a) return; e.preventDefault(); var g = $("#azh-" + a.getAttribute("data-az")); if (g) { g.setAttribute("tabindex", "-1"); g.scrollIntoView(); g.focus(); } });
  // ---------- Learn: the guided path, one concept per step (lesson → try the example → quick check), in course order ----------
  // Finishing a step marks the concept's lesson as read; mastery rules don't change. Quick-check mistakes go to Review mistakes.
  var LEARN_STEPS = [["file", "Lesson"], ["code", "Try the example"], ["checkCircle", "Quick check"]];
  function learnFlat(p) { return [].concat.apply([], p.levels.map(function (L) { return L.concepts.map(function (c) { return Object.assign({ level: L.n }, c); }); })); }
  function learnPathLoad(fresh) { return S.learnPath && !fresh ? Promise.resolve(S.learnPath) : learnApi("/path").then(function (p) { S.learnPath = p; return p; }); }
  function learnBar(read, total, label) {
    var pc = total ? Math.round((100 * read) / total) : 0;
    return '<div class="ln-bar"><span class="bar" role="progressbar" aria-label="' + esc(label) + '" aria-valuemin="0" aria-valuemax="' + total + '" aria-valuenow="' + read + '"><span style="width:' + pc + '%"></span></span><span class="small mono">' + read + "/" + total + "</span></div>";
  }
  // where "Continue" goes: the last screen opened, else the first concept whose lesson isn't read
  function learnContinue(p) {
    var flat = learnFlat(p), at = String(store("sqldrills.learnAt") || "").split("|"), last = flat.filter(function (c) { return c.slug === at[0]; })[0];
    if (last) return { c: last, s: Number(at[1]) || 1, resume: true };
    var next = flat.filter(function (c) { return !c.read; })[0];
    return next ? { c: next, s: 1, resume: false } : { c: flat[0], s: 1, done: true };
  }
  function learnJump(p, current) {
    return '<label class="ln-jump"><span>Jump to a concept</span><select class="inp" data-learn-jump>' + (current ? "" : '<option value="">Choose…</option>') +
      p.levels.map(function (L) { return '<optgroup label="Level ' + L.n + " · " + esc(L.title) + '">' + L.concepts.map(function (c) { return '<option value="' + esc(c.slug) + '"' + (c.slug === current ? " selected" : "") + ">" + (c.read ? "✓ " : "") + esc(c.name) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></label>";
  }
  function viewLearn() {
    view.innerHTML = '<div class="page"><div class="col"><div class="card card-pad" aria-busy="true"><p class="muted">Loading the path…</p></div></div>' + rail() + "</div>";
    learnPathLoad(true).then(function (p) {
      if (route.name !== "learn" || route.args[0]) return;
      var go = learnContinue(p), cur = go.c.level;
      var html = '<div class="page"><div class="col"><div><div class="eyebrow">Learn</div><div class="hero"><div><h1>Learn step by step</h1><p>All ' + p.total + " concepts in course order. Each step is a short lesson, its example to edit and run, then a quick check. Levels and exercises stay where they are; this is the guided way through them.</p></div></div></div>" +
        '<section class="card card-pad ln-start"><div class="ln-start-h"><div><div class="eyebrow">' + (go.done ? "Every lesson read" : go.resume ? "Continue where you left off" : "Start") + '</div><h2 class="h3">' + esc(go.c.name) + '</h2><p class="muted small">Level ' + go.c.level + " · step " + go.s + " of 3: " + LEARN_STEPS[go.s - 1][1] + "</p></div>" +
        '<a class="btn primary" href="#/learn/' + encodeURIComponent(go.c.slug) + "?s=" + go.s + '">' + icon("play") + (go.done ? "Start again" : go.resume ? "Continue" : "Start") + "</a></div>" +
        learnBar(p.read, p.total, "Lessons read across all levels") + learnJump(p, "") + "</section>";
      html += '<section aria-labelledby="ln-lv"><h2 class="h3" id="ln-lv">Levels</h2>' + p.levels.map(function (L) {
        return '<details class="card card-pad ln-level"' + (L.n === cur ? " open" : "") + '><summary><span class="ln-lt">Level ' + L.n + " · " + esc(L.title) + "</span>" + learnBar(L.read, L.total, "Level " + L.n + " lessons read") + "</summary>" +
          '<ol class="ln-list">' + L.concepts.map(function (c) { return '<li><a href="#/learn/' + encodeURIComponent(c.slug) + '?s=1"><span class="ln-mark" aria-hidden="true">' + (c.read ? icon("check") : "") + "</span><span>" + esc(c.name) + "</span>" + (c.read ? '<span class="sr-only"> (read)</span>' : "") + "</a></li>"; }).join("") + "</ol></details>";
      }).join("") + "</section>";
      view.innerHTML = html + "</div>" + rail() + "</div>";
    }).catch(function (e) { view.innerHTML = '<div class="page"><div class="card empty">' + esc(e.message) + "</div></div>"; });
  }
  // the quick check: up to 2 approved questions of the concept (a predict item, then an MCQ, else a card)
  function learnChecks(c) {
    var preds = (c.predicts || []).slice(), mcqs = (c.mcqs.understand || []).concat(c.mcqs.memorize || []).map(function (id) { return S.byMcq[id]; }).filter(Boolean), cards = (c.cards || []).filter(function (x) { return window.Cards && Cards.STANDALONE.indexOf(x.card_type) > -1; });
    var out = [], p = preds.filter(function (x) { return !x.right; })[0] || preds[0], m = mcqs.filter(function (x) { return !isDone(x); })[0] || mcqs[0];
    if (p) out.push({ kind: "predict", item: p });
    if (m) out.push({ kind: "mcq", item: m });
    if (out.length < 2 && preds.length > 1) out.push({ kind: "predict", item: preds.filter(function (x) { return x !== p; })[0] });
    if (out.length < 2 && cards.length) out.push({ kind: "card", item: cards[0] });
    return out.slice(0, 2);
  }
  // which steps of a concept are done: the lesson (moved on from it), the example (ran it), the quick check (every
  // question answered); "Done" (the lesson marked read on the server) means all three
  function learnStepsOf(slug) { try { return JSON.parse(store("sqldrills.learnSteps." + slug) || "{}"); } catch (e) { return {}; } }
  function learnStepDone(slug, n) { var s = learnStepsOf(slug); if (s[n]) return; s[n] = 1; store("sqldrills.learnSteps." + slug, JSON.stringify(s)); learnSideRefresh(); }
  function learnCheckAnswered(c, qs) {
    return qs.length > 0 && qs.every(function (q) {
      if (q.kind === "predict") return !!(q.item.tried || q.item.right);
      if (q.kind === "mcq") return isDone(q.item) || !!store("sqldrills.mcqTried." + q.item.id);
      return !!q.item.state || !!(S.learnAnswered && S.learnAnswered["card:" + q.item.id]);
    });
  }
  function learnStepState(c, slug) {
    var s = learnStepsOf(slug), all = !!c.lessonRead;
    return { 1: all || !!s[1], 2: all || !!s[2], 3: all || !!s[3] };
  }
  // the guidance column: the concept's goal, real progress through its three steps, its key points and its tip
  function learnSide(c, slug, s) {
    var l = (c.lessons || [])[0], st = learnStepState(c, slug), n = [1, 2, 3].filter(function (k) { return st[k]; }).length;
    var points = l ? String(l.what || "").replace(/`([^`]+)`/g, "$1").match(/[^.!?]+[.!?]/g) || [] : [];
    var desc = { 1: "Read the concept and its key points", 2: "Run and change the example", 3: "Answer the quick check" };
    var ring = '<svg class="lw-ring" viewBox="0 0 44 44" aria-hidden="true"><circle cx="22" cy="22" r="18" class="lw-ring-bg"/><circle cx="22" cy="22" r="18" class="lw-ring-fg" stroke-dasharray="' + (113.1 * n / 3).toFixed(1) + ' 113.1"/></svg>';
    return '<section class="card card-pad lw-side-card" aria-labelledby="lw-goal"><h2 class="lw-side-h" id="lw-goal">' + icon("target") + "Learning goal</h2><p>" + esc(c.summary || "") + "</p></section>" +
      '<section class="card card-pad lw-side-card" aria-labelledby="lw-prog"><h2 class="lw-side-h" id="lw-prog">' + icon("chart") + 'Your progress</h2><div class="lw-prog-top">' + ring + '<div><b class="mono">' + n + "/3</b> steps done<br><span class=\"muted small\">" + (c.lessonRead ? "Lesson finished" : "This concept") + "</span></div></div>" +
      '<ol class="lw-prog-list">' + LEARN_STEPS.map(function (x, k) { var i = k + 1, now = i === s; return '<li class="' + (st[i] ? "done" : now ? "now" : "") + '"' + (now ? ' aria-current="step"' : "") + '><span class="lw-dot" aria-hidden="true">' + (st[i] ? icon("check") : "") + '</span><a href="#/learn/' + encodeURIComponent(slug) + "?s=" + i + '"><b>' + i + ". " + x[1] + '</b><span class="muted small">' + desc[i] + '</span><span class="sr-only"> (' + (st[i] ? "done" : now ? "current step" : "to do") + ")</span></a></li>"; }).join("") + "</ol></section>" +
      (s !== 1 && points.length ? '<section class="card card-pad lw-side-card" aria-labelledby="lw-keys"><h2 class="lw-side-h" id="lw-keys">' + icon("bulb") + 'Key points</h2><ul class="lw-keys">' + points.slice(0, 4).map(function (p) { return "<li>" + esc(p.trim()) + "</li>"; }).join("") + "</ul></section>" : "") +
      (s !== 1 && l && l.tip ? '<section class="lw-tip" aria-labelledby="lw-tip"><h2 class="lw-side-h" id="lw-tip">' + icon("code") + "Watch out</h2><p>" + lessonText(l.tip) + "</p></section>" : "");
  }
  function learnSideRefresh() {
    var box = view.querySelector(".lw-side"); if (!box || route.name !== "learn" || !route.args[0]) return;
    var c = S.learn.concept[route.args[0]]; if (!c) return;
    // only on the quick-check screen: the questions it shows, answered there
    var onCheck = Number(route.q && route.q.get("s")) === 3, shown = onCheck && S.learnQs && S.learnQs[route.args[0]];
    if (shown && learnCheckAnswered(c, shown) && !learnStepsOf(route.args[0])[3]) { learnStepDone(route.args[0], 3); return; }
    box.innerHTML = learnSide(c, route.args[0], Math.min(3, Math.max(1, Number(route.q && route.q.get("s")) || 1)));
  }
  // the schema column: the dataset's tables, the example's own first and open; an example with its own tables says so
  function learnSchema(l) {
    var sql = exampleSqlOf(l);
    if (!l || !l.dataset) return "";
    if (/\bCREATE\s+(TEMP(ORARY)?\s+)?TABLE\b/i.test(sql)) return '<section class="card card-pad lw-own" aria-label="Tables">' + icon("db") + "<p>This example creates its own tables: they are in its script.</p></section>";
    return schemaPanel({ kind: "sqlite", key: l.dataset }, { open: true, hint: "its tables first", sql: sql, title: "Database schema", cls: "lw-schema" });
  }
  function viewLearnStep(slug) {
    var s = Math.min(3, Math.max(1, Number(route.q && route.q.get("s")) || 1));
    view.innerHTML = '<div class="page full"><div class="col"><div class="card card-pad" aria-busy="true"><p class="muted">Loading…</p></div></div></div>';
    Promise.all([learnPathLoad(), loadConcept(slug)]).then(function (r) {
      if (route.name !== "learn" || route.args[0] !== slug) return;
      var p = r[0], c = r[1], flat = learnFlat(p), i = flat.map(function (x) { return x.slug; }).indexOf(slug), L = p.levels.filter(function (x) { return x.n === c.level; })[0];
      store("sqldrills.learnAt", slug + "|" + s);
      var l = (c.lessons || [])[0], prev = flat[i - 1], next = flat[i + 1], st = learnStepState(c, slug), ex = (l && l.example) || {};
      var dialect = l && exampleSqlOf(l) ? (exampleLocal(l) ? "SQLite" : "MySQL") : "";
      var head = '<nav class="crumbs" aria-label="Breadcrumb"><a href="#/learn">Learn</a>' + icon("chevRight") + '<a href="#/level/' + c.level + '">Level ' + c.level + "</a>" + icon("chevRight") + "<span>" + esc(L ? L.title : "") + "</span></nav>" +
        '<section class="card card-pad lw-over ln-head" aria-labelledby="lw-title"><div class="lw-over-top"><div class="lw-over-txt"><div class="eyebrow">Concept ' + (i + 1) + " of " + flat.length + " · Level " + c.level + '</div><h1 id="lw-title">' + esc(c.name) + '</h1><p class="lw-obj">' + esc(c.summary || "") + "</p></div>" +
        '<div class="lw-over-meta">' + (dialect ? '<span class="ws-dialect" title="Where the example runs">' + icon("db") + esc(dialect) + "</span>" : "") + (L ? learnBar(L.read, L.total, "Level " + c.level + " lessons read") : "") + "</div></div>" +
        '<ol class="lw-steps" aria-label="Steps">' + LEARN_STEPS.map(function (x, k) { var n = k + 1, cls = n === s ? "on" : st[n] ? "done" : ""; return '<li class="' + cls + '"' + (n === s ? ' aria-current="step"' : "") + '><a href="#/learn/' + encodeURIComponent(slug) + "?s=" + n + '"><span class="lw-stepi" aria-hidden="true">' + (st[n] && n !== s ? icon("check") : n) + "</span><span>" + x[1] + '</span><span class="sr-only"> (' + (n === s ? "current" : st[n] ? "done" : "to do") + ")</span></a></li>"; }).join("") + "</ol>" + learnJump(p, slug) + "</section>";
      var main = "";
      if (s === 1) main = l ? lessonCard(l, { noTables: true }) : emptyStage("file", "No lesson for this concept yet.", ["#/concept/" + encodeURIComponent(slug), "Open the concept page"]);
      if (s === 2) main = l ? sqlWorkspace(l, slug) : emptyStage("code", "No lesson for this concept yet.", ["#/concept/" + encodeURIComponent(slug), "Open the concept page"]);
      if (s === 3) {
        var qs = learnChecks(c);
        S.learnQs = S.learnQs || {}; S.learnQs[slug] = qs;
        main = '<p class="muted small ln-qnote">' + (qs.length ? "Answer " + (qs.length === 1 ? "this question" : "these " + qs.length + " questions") + ". A wrong answer comes back in Review mistakes." : "") + "</p>" +
          (qs.length ? qs.map(function (q) { return q.kind === "predict" ? predictCard(q.item) : q.kind === "mcq" ? '<section class="card card-pad">' + mcqBlock(q.item, false, true) + "</section>" : xcardHtml(q.item); }).join("")
            : emptyStage("checkCircle", "No quick-check question for this concept yet: they appear once they are approved.", ["#/concept/" + encodeURIComponent(slug) + "?tab=understand", "Open the concept page"]));
      }
      var back = s > 1 ? "#/learn/" + encodeURIComponent(slug) + "?s=" + (s - 1) : prev ? "#/learn/" + encodeURIComponent(prev.slug) + "?s=3" : null;
      var navHtml = '<nav class="ln-nav" aria-label="Step navigation">' + (back ? '<a class="btn" href="' + back + '">' + icon("chevLeft") + "Back</a>" : "<span></span>") +
        (s < 3 ? '<a class="btn primary" href="#/learn/' + encodeURIComponent(slug) + "?s=" + (s + 1) + '"' + (s === 1 ? ' data-learn-step-done="1"' : "") + ">Next: " + LEARN_STEPS[s][1] + " " + icon("chevRight") + "</a>"
          : '<button type="button" class="btn primary" data-learn-finish="' + esc(slug) + '" data-next="' + esc(next ? next.slug : "") + '">' + (next ? "Done · next concept " : "Done · back to Learn ") + icon("chevRight") + "</button>") + "</nav>";
      var schema = learnSchema(l), open = !window.matchMedia || window.matchMedia("(min-width: 900px)").matches;
      view.innerHTML = '<div class="page full lw-page"><div class="lw' + (schema ? "" : " no-schema") + '"><div class="lw-head">' + head + '</div><div class="lw-main">' + main + navHtml + "</div>" +
        (schema ? '<div class="lw-schema-col">' + schema + "</div>" : "") +
        '<aside class="lw-side" aria-label="Learning guidance">' + (open ? learnSide(c, slug, s) : '<details class="card card-pad lw-side-fold"><summary>Learning goal, progress and key points</summary>' + learnSide(c, slug, s) + "</details>") + "</aside></div></div>";
      schemaMount(view); wsMount(view);
      var h = view.querySelector("#lw-title"); if (h) { h.setAttribute("tabindex", "-1"); h.focus(); }
    }).catch(function (e) { view.innerHTML = '<div class="page full"><div class="card empty">' + esc(e.message) + ' <a href="#/learn">Back to Learn</a></div></div>'; });
  }
  // a quick-check answer in Learn: a mistake goes into Review mistakes (the same 1, 3, 7-day steps as exercises)
  function learnAnswered(kind, ref, right) { if (route.name === "learn" && ref) { S.learnAnswered = S.learnAnswered || {}; S.learnAnswered[kind + ":" + ref] = 1; learnApi("/quickcheck", { kind: kind, ref: ref, correct: !!right }).catch(function () {}); setTimeout(learnSideRefresh, 700); } }
  view.addEventListener("click", function (e) {
    var t = e.target;
    if (!t.closest) return;
    var sd = t.closest("[data-learn-step-done]"); if (sd && route.name === "learn") learnStepDone(route.args[0], Number(sd.getAttribute("data-learn-step-done")));
    var fin = t.closest("[data-learn-finish]");
    if (fin) {
      fin.disabled = true;
      var slug = fin.getAttribute("data-learn-finish"), nx = fin.getAttribute("data-next");
      learnApi("/lesson/" + encodeURIComponent(slug) + "/read", {}).then(function () { S.learnPath = null; location.hash = nx ? "#/learn/" + encodeURIComponent(nx) + "?s=1" : "#/learn"; })
        .catch(function (er) { fin.disabled = false; toast("Couldn't save: " + er.message); });
    }
  });
  view.addEventListener("change", function (e) { if (e.target.matches && e.target.matches("[data-learn-jump]") && e.target.value) location.hash = "#/learn/" + encodeURIComponent(e.target.value) + "?s=1"; });
  // ---------- the Today plan's Challenge (one item: due for review, or from the weakest concept) ----------
  function viewChallenge() {
    var lv = Number(route.q && route.q.get("level")) || 1;
    view.innerHTML = '<div class="page full"><div class="col"><div class="card card-pad" aria-busy="true"><p class="muted">Finding your challenge…</p></div></div></div>';
    learnApi("/today?level=" + lv).then(function (t) {
      var ch = t.challenge;
      var html = '<div class="page full"><div class="col challenge-page"><div class="crumbs"><a href="#/home">Home</a>' + icon("chevRight") + "<span>Challenge</span></div>";
      if (!ch) { view.innerHTML = html + '<div class="card empty">' + icon("trophy") + '<div><p>Nothing to challenge you with right now: nothing is due and this level\'s concepts are going well.</p><a class="btn sm" href="#/home">Back to today\'s plan ' + icon("chevRight") + "</a></div></div></div></div>"; return; }
      S.challenge = ch;
      html += '<section class="card card-pad ch-intro"><div class="eyebrow">' + (ch.why === "due" ? "Due for review" : "Your weakest concept in this level") + "</div><h1 class=\"h3\">" + esc(ch.name) + '</h1><p class="muted small">Answer it, say how sure you are, and it is scheduled for the right day.</p></section>';
      html += challengeItemHtml(ch);
      view.innerHTML = html + '<div class="ch-done" aria-live="polite"></div></div></div>';
      schemaMount(view);
      var first = view.querySelector(".challenge-page input, .challenge-page textarea, .challenge-page select, .challenge-page [data-ch]"); if (first) first.focus();
    }).catch(function (e) { view.innerHTML = '<div class="page full"><div class="card empty">' + esc(e.message) + "</div></div>"; });
  }
  function challengeItemHtml(ch) {
    var it = ch.item, id = "ch";
    if (ch.kind === "card") return xcardHtml(it, { challenge: true });
    var body = "";
    if (ch.kind === "predict") {
      var opts = predictOptions(it);
      body = '<div class="pq">' + esc(it.question) + "</div>" + (it.variant === "endstate" ? '<pre class="mcq-code">' + highlight(numberedScript(it.script)) + "</pre>" + (it.check_sql && it.mode !== "error" ? '<pre class="mcq-code">' + highlight(it.check_sql) + "</pre>" : "") : inputsHtml(it) + '<pre class="mcq-code">' + highlight(it.sql) + "</pre>") +
        '<fieldset class="po-opts"><legend>Which result is right?</legend>' + opts.map(function (o, i) { return '<label class="po-opt"><input type="radio" name="ch-opt" value="' + i + '" data-right="' + (o.right ? 1 : 0) + '"><span class="po-l">' + "ABCD".charAt(i) + '</span><span class="po-body">' + (it.variant === "endstate" ? outcomeHtml(o.table) : miniTable(o.table)) + "</span></label>"; }).join("") + "</fieldset>";
    } else if (it.type === "error" && spotBugUsable(it)) body = spotBugHtml(it, id);
    else if (it.type === "blank") body = '<div class="fc-q">' + esc(it.prompt || "Fill in the blank") + '</div><pre class="mcq-code">' + highlight(it.sql) + '</pre><label class="fc-in"><span>Your answer for ___</span><input class="inp mono ch-blank" autocomplete="off" spellcheck="false"></label>';
    else body = '<div class="fc-q">' + esc(it.front || it.prompt || "") + "</div>" + (it.wrong_sql ? '<pre class="mcq-code">' + highlight(it.wrong_sql) + "</pre>" : "") + '<div class="ch-back" hidden>' + (it.back ? "<p>" + esc(it.back) + "</p>" : "") + (it.parts ? '<pre class="mcq-code">' + highlight(it.parts.join("\n")) + "</pre>" : "") + (it.fixed_sql ? '<pre class="mcq-code">' + highlight(it.fixed_sql) + "</pre><p>" + esc(it.explanation || "") + "</p>" : "") + "</div>";
    var self = ch.kind === "flashcard" && !(it.type === "blank" || (it.type === "error" && spotBugUsable(it)));
    return '<section class="card card-pad ch-item" data-ch-kind="' + ch.kind + '">' + body + (it.type !== "keyword" ? tablesPanel(it.dataset, it.sql || it.fixed_sql || it.wrong_sql, false) : "") + confHtml(id) +
      '<div class="actions">' + (self ? '<button type="button" class="btn primary" data-ch="reveal">Show the answer</button><span class="ch-grade" hidden><button type="button" class="btn ok" data-ch="right">' + icon("check") + 'I knew it</button><button type="button" class="btn" data-ch="wrong">' + icon("x") + "I didn't</button></span>" : '<button type="button" class="btn primary" data-ch="check">' + icon("checkCircle") + "Check</button>") +
      '</div><div class="ch-out" aria-live="polite"></div></section>';
  }
  function challengeAnswer(right, html) {
    var ch = S.challenge, sec = view.querySelector(".ch-item"), out = sec.querySelector(".ch-out");
    sec.querySelectorAll("input, textarea, select, [data-ch]").forEach(function (x) { x.disabled = true; });
    out.innerHTML = verdictHtml(right) + (html || "");
    learnApi("/challenge", { ref: ch.ref, kind: ch.kind, correct: right, confidence: confOf(sec, "ch") }).then(function () { challengeDone(right); }).catch(function (e) { toast(e.message); });
  }
  function challengeDone(right) {
    S.learn.today = null; viewConcept.stale = true;
    var box = view.querySelector(".ch-done");
    if (box) { box.innerHTML = '<section class="card card-pad"><p>' + (right ? "Saved. It comes back when it is due." : "Saved. It comes back tomorrow.") + '</p><div class="actions"><a class="btn primary" href="#/home">Back to Today</a></div></section>'; box.querySelector("a").focus(); }
  }
  view.addEventListener("click", function (e) {
    var t = e.target;
    var xb = t.closest && t.closest("[data-xc-check]");
    if (xb) { xcardCheck(xb.closest(".xcard")); return; }
    var cb = t.closest && t.closest("[data-ch]");
    if (!cb || route.name !== "challenge" || !S.challenge) return;
    var a = cb.getAttribute("data-ch"), ch = S.challenge, it = ch.item, sec = view.querySelector(".ch-item");
    if (a === "reveal") { sec.querySelector(".ch-back").hidden = false; cb.hidden = true; var g = sec.querySelector(".ch-grade"); g.hidden = false; g.querySelector("button").focus(); return; }
    if (a === "right" || a === "wrong") { challengeAnswer(a === "right"); return; }
    if (a !== "check") return;
    if (ch.kind === "predict") {
      var o = sec.querySelector('[name="ch-opt"]:checked');
      if (!o) { sec.querySelector(".ch-out").innerHTML = '<p class="small bad-txt">Choose an answer first.</p>'; return; }
      challengeAnswer(o.getAttribute("data-right") === "1", '<div class="muted small">The real output</div>' + (it.variant === "endstate" ? outcomeHtml(it.answer) : miniTable(it.answer)));
    } else if (it.type === "blank") {
      var v = sec.querySelector(".ch-blank").value, ok = Cards.checkBlank(v, it);
      challengeAnswer(ok, '<pre class="mcq-code">' + highlight(String(it.sql).replace("___", it.answer)) + "</pre>" + (it.explanation ? "<p>" + esc(it.explanation) + "</p>" : ""));
    } else if (it.type === "error") {
      spotBugCheck(sec, it, "ch").then(function (r) { if (r.msg) sec.querySelector(".ch-out").innerHTML = '<p class="small bad-txt">' + esc(r.msg) + "</p>"; else if (!r.fallback) challengeAnswer(r.right, r.html); });
    }
  });

  // ---------- the dashboard's Today plan ----------
  function isWeekend() { var d = new Date().getDay(); return d === 0 || d === 6; }
  function todayHtml(lv) {
    var T = S.learn.today;
    if (!T || T.level !== lv) {
      learnApi("/today?level=" + lv + "&weekend=" + (isWeekend() ? 1 : 0)).then(function (t) { S.learn.today = t; S.flashDue = t.flashcards.due; renderNav(); var box = $("#todayPlan"); if (box && route.name === "home") box.outerHTML = todayHtml(lv); }).catch(function (e) { var box = $("#todayPlan"); if (box) box.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
      return '<section class="card card-pad today" id="todayPlan" aria-busy="true"><div class="card-h"><h2 class="h3">' + icon("target") + 'Today</h2></div><p class="muted small">Loading your plan…</p></section>';
    }
    var st = streak(), goal = dailyGoal(), steps = [];
    var fcRow = T.flashcards.due ? ["cards", "Memorize", plural(T.flashcards.due, "flashcard") + " due", "#/flashcards?study=1", "Review"]
      : T.flashcards.newConcept ? ["cards", "Memorize", "New cards: " + T.flashcards.newConcept.name, "#/flashcards?concept=" + T.flashcards.newConcept.slug, "Start"]
      : ["cards", "Memorize", "No flashcards due" + (T.flashcards.newConcept === null ? " (cards appear once approved)" : ""), null, null];
    steps.push(fcRow);
    steps.push(T.understand ? ["bulb", "Understand", "Next concept: " + T.understand.name, "#/concept/" + T.understand.slug + "?tab=understand", T.understand.stage === "started" ? "Continue" : "Open"] : ["bulb", "Understand", "Every concept of this level is understood", null, null]);
    var rf = T.reflection;
    steps.push(rf && rf.item && S.byId[rf.item] ? ["note", "Reflect", "One sentence on “" + S.byId[rf.item].title + "” (you " + (rf.result === "pass" ? "solved it" : "didn't solve it yet") + ")", "#/drill/" + rf.item + "?reflect=" + rf.result, "Reflect"]
      : rf && rf.concept ? ["note", "Reflect", "Explain " + rf.name + " in one sentence", "#/concept/" + rf.concept + "?tab=reflect", "Reflect"] : ["note", "Reflect", "Nothing to reflect on yet", null, null]);
    if (T.challenge) steps.push(["spark", "Challenge", (T.challenge.why === "due" ? "Due for review: " : "Your weakest concept: ") + T.challenge.name, "#/challenge?level=" + lv, "Start"]);
    if (T.weekend) steps.push(T.transfer && T.transfer.id && S.byId[T.transfer.id] ? ["compass", "Transfer · weekend", S.byId[T.transfer.id].title + " (" + T.transfer.name + ")", href(S.byId[T.transfer.id]), "Try it"] : ["compass", "Transfer · weekend", "Finish a concept's practise set to unlock a transfer challenge", null, null]);
    var html = '<section class="card card-pad today" id="todayPlan" aria-labelledby="today-h"><div class="card-h"><h2 class="h3" id="today-h">' + icon("target") + "Today</h2>" +
      '<span class="muted small">Daily goal <b class="mono">' + Math.min(st.today, 99) + "/" + goal + '</b> · every stage counts</span><a class="more link" href="#/level/' + lv + '">Level ' + lv + " " + icon("chevRight") + "</a></div>" +
      '<ul class="today-list">' + steps.map(function (s) {
        return '<li><span class="ic">' + icon(s[0]) + '</span><span class="tl-main"><span class="eyebrow">' + esc(s[1]) + "</span><span>" + esc(s[2]) + "</span></span>" + (s[3] ? '<a class="btn sm" href="' + s[3] + '">' + esc(s[4]) + "</a>" : "") + "</li>";
      }).join("") + "</ul>";
    var prac = T.practise.map(function (id) { return S.byId[id]; }).filter(Boolean);
    html += '<h3 class="today-sub">' + icon("play") + "Practise · " + plural(prac.length, "exercise") + '</h3>' + (prac.length ? '<div class="clist">' + prac.map(function (d) { return compactRow(d); }).join("") + "</div>" : '<p class="muted small">Every practise set in this level is done.</p>');
    return html + "</section>";
  }

  function parseRoute() {
    var h = (location.hash || "").replace(/^#\/?/, "").split("?")[0];
    var parts = h.split("/").filter(Boolean).map(decodeURIComponent);
    var name = parts[0] || "home";
    // links from before the levels: tracks and chapters now live in levels
    if (name === "paths" || name === "track" || name === "chapter") { location.replace("#/levels"); return null; }
    if (/^[a-z0-9]+\.\d+/.test(name)) { location.replace("#/levels"); return null; }
    return { name: name, args: parts.slice(1), q: new URLSearchParams((location.hash.split("?")[1]) || "") };
  }
  function render() {
    var r = parseRoute();
    if (!r) return;
    var same = route.name === r.name && route.args.join("/") === r.args.join("/");
    if (!(r.name === "level" && route.name === "level" && route.args[0] === r.args[0])) r.tab = null; else r.tab = route.tab;
    route = r;
    S.filters = r.name === "mcqs" ? S.mf : S.df;
    renderChrome();
    $("#side").classList.remove("open"); $("#scrim").classList.remove("open");
    var V = { drills: viewDrills, drill: function () { viewDrill(r.args[0]); }, levels: viewLevels, level: function () { viewLevel(r.args[0]); }, mcqs: viewMcqs, mcq: function () { viewMcq(r.args[0]); },
      quiz: function () { viewQuiz(r.args[0] || "mixed"); }, recent: viewRecent, interview: viewInterview, bookmarks: viewBookmarks, review: viewReviewMistakes, progress: viewProgress, concept: function () { viewConcept(r.args[0]); }, learn: function () { if (r.args[0]) viewLearnStep(r.args[0]); else viewLearn(); }, docs: viewDocs, help: viewHelp, flashcards: viewFlashcards, notes: viewNotes, licenses: viewLicenses, challenge: viewChallenge, preview: viewPreview, guide: function () { viewGuide(r.args[0], r.args[1]); } };
    // React pages (web/, the Waffles front end) take the routes they own; every other route stays here
    var R = window.SQLDrillsReact;
    if (R) R.unmount();
    if (R && R.has(r.name, "learner")) R.mount(r.name, view, { app: "learner", route: r, icon: icon });
    else (V[r.name] || viewHome)();
    if (!same && !(r.name === "guide" && r.args[1])) view.scrollTop = 0;
  }

  // ---------- events ----------
  view.addEventListener("click", function (e) {
    var t = e.target;
    var bm = t.closest("[data-bm]");
    if (bm) { e.stopPropagation(); var on = toggleBookmark(bm.getAttribute("data-bm")); bm.classList.toggle("on", on); toast(on ? "Bookmarked" : "Bookmark removed"); if (route.name === "bookmarks") render(); return; }
    var bmBtn = t.closest("[data-bm-btn]");
    if (bmBtn) { var on2 = toggleBookmark(bmBtn.getAttribute("data-bm-btn")); bmBtn.innerHTML = icon("bookmark") + (on2 ? "Bookmarked" : "Bookmark"); bmBtn.classList.toggle("ghost-accent", on2); return; }
    var go = t.closest("[data-go]");
    if (go && !t.closest("a,button")) { location.hash = go.getAttribute("data-go"); return; }
    var fcp = t.closest("[data-fc-page]");
    if (fcp && !fcp.disabled) { var fp = new URLSearchParams(route.q); fp.set("page", fcp.getAttribute("data-fc-page")); location.hash = "#/flashcards?" + fp; return; }
    var fl = t.closest("[data-filter]");
    if (fl) { S.filters[fl.getAttribute("data-filter")] = fl.getAttribute("data-value"); S.filters.page = 0; saveFilters(); render(); return; }
    var pg = t.closest("[data-page]");
    if (pg && !pg.disabled) { S.filters.page = Number(pg.getAttribute("data-page")); saveFilters(); render(); view.scrollTop = 0; return; }
    var lt = t.closest("[data-ltab]");
    if (lt) { route.tab = lt.getAttribute("data-ltab"); viewLevel(route.args[0]); return; }
    var ls = t.closest("[data-lsection]");
    if (ls) { S.levelFilter.section = ls.getAttribute("data-lsection"); S.levelFilter.diff = "all"; S.levelFilter.page = 0; viewLevel(route.args[0]); return; }
    var lt2 = t.closest("[data-ltoggle]");
    if (lt2) { var tk = lt2.getAttribute("data-ltoggle"); S.levelFilter[tk] = !S.levelFilter[tk]; S.levelFilter.page = 0; viewLevel(route.args[0]); var again = $('[data-ltoggle="' + tk + '"]'); if (again) again.focus(); return; }
    if (t.closest("[data-lclear]")) { S.levelFilter.diff = "all"; S.levelFilter.section = "all"; S.levelFilter.hideSelf = false; S.levelFilter.notDone = false; S.levelFilter.page = 0; viewLevel(route.args[0]); var fc = $('[data-ldiff="all"]'); if (fc) fc.focus(); return; }
    var ld = t.closest("[data-ldiff]");
    if (ld) { S.levelFilter.diff = ld.getAttribute("data-ldiff"); S.levelFilter.page = 0; viewLevel(route.args[0]); return; }
    var lp = t.closest("[data-lpage]");
    if (lp && !lp.disabled) { S.levelFilter.page = Number(lp.getAttribute("data-lpage")); viewLevel(route.args[0]); view.scrollTop = 0; return; }
    var act = t.closest("[data-act]"), a = act && act.getAttribute("data-act");
    var d = route.name === "drill" ? S.byId[route.args[0]] : null;
    if (a === "view") { S.filters.view = act.getAttribute("data-v"); saveFilters(); render(); }
    else if (a === "clear-filters") { S.filters = { diff: "all", level: "all", status: "all", check: "all", q: "", sort: S.filters.sort, view: S.filters.view, page: 0, size: S.filters.size }; saveFilters(); render(); }
    else if (a === "run" && d) runItem(d);
    else if (a === "check" && d) checkItem(d);
    else if (a === "mark-done" && d) {
      var to = !isDone(d);
      api("/api/library/item/" + d.id + "/done", { done: to, dialect: dialect() }).then(function () {
        if (to) { markDone(d, true); reflectBox(d, true); } else { d.done = false; renderChrome(); }
        refreshDone(d);
        toast(to ? "Marked as done" : "Marked as not done");
      });
    } else if (a === "solution" && d) {
      if (!confirmClick(act, d.check === "self" && d.engine !== "server" ? "Show the model answer? Write your own first." : "Show the solution? Try a hint first if you haven't.", d.check === "self" && d.engine !== "server" ? "Show answer" : "Show solution")) return;
      countHint(d, 3);
      api("/api/library/item/" + d.id + "/solution?dialect=" + dialect()).then(function (s) {
        // self-check drills: a model answer in words and/or a model solution, then Mark as done
        if (s.model) {
          $("#out").innerHTML = (s.why ? '<p class="muted small" style="margin:0 0 8px">Model answer:</p><div class="model-answer">' + esc(s.why) + "</div>" : "") +
            (s.solution_sql ? '<p class="muted small" style="margin:12px 0 8px">Model solution' + (d.check === "self" ? " (for reading: it may not run on the practice database)" : "") + ':</p><pre class="mcq-code">' + highlight(s.solution_sql) + "</pre>" : "") +
            '<p class="muted small" style="margin:12px 0 0">Compare it with yours, then press <b>Mark as done</b>.</p>';
          var mine = S.lastRun && S.lastRun[d.id];
          var runnable = s.solution_sql && /^\s*(with|select)\b/i.test(s.solution_sql) && d.engine !== "server";
          if (runnable) {
            if (d.prep) Engine.reset(d.dataset);
            Engine.run(d.dataset, (d.prep ? d.prep + ";\n" : "") + s.solution_sql).then(function (x) {
              if (d.prep) Engine.reset(d.dataset);
              var last = x.ok && x.results[x.results.length - 1];
              if (!last) return;
              $("#out").insertAdjacentHTML("beforeend", '<div class="compare"><div><h4>Model answer\'s result</h4>' + resultTable(last) + "</div><div><h4>Your last result</h4>" + (mine ? resultTable(mine) : '<p class="muted small">Run your query (Ctrl+Enter) to see it here.</p>') + "</div></div>" +
                '<div class="actions" style="margin-top:10px"><button class="btn ok" data-act="mark-done">' + icon("check") + (isDone(d) ? "Done ✓" : "Mark as done") + "</button></div>");
            });
          }
          return;
        }
        $("#out").innerHTML = '<p class="muted small" style="margin:0 0 8px">Solution:</p><pre class="mcq-code">' + highlight(s.solution_sql || "") + "</pre>" + (s.why ? '<pre class="course-pre">' + esc(s.why) + "</pre>" : "");
      });
    } else if (a === "hint" && d) hintStep(d);
    else if (a === "course-hint" && d) {
      var n = Number(act.getAttribute("data-n"));
      $("#courseHints").insertAdjacentHTML("beforeend", '<div class="course-hint"><span>Hint ' + (n + 1) + '</span><pre class="course-pre">' + esc(d.courseHints[n]) + "</pre></div>");
      if (n + 1 < d.courseHints.length) { act.setAttribute("data-n", n + 1); act.textContent = "Show hint " + (n + 2) + " of " + d.courseHints.length; } else act.remove();
    } else if (a === "format" && d) { var ta = $("#sql"); ta.value = formatSql(ta.value); ta.dispatchEvent(new Event("input")); }
    else if (a === "reset-data" && d) {
      if (d.engine === "server") {
        if (!confirmClick(act, "Reload this exercise's database to its original data? Tables you created in it are removed.", "Reset data")) return;
        setStatus("", "Resetting…");
        api("/api/library/item/" + d.id + "/reset-db", { dialect: dialect() }).then(function (r) { setStatus(r.ok ? "ok" : "bad", r.ok ? "Database reset" : "Reset failed"); $("#out").innerHTML = '<p class="muted">' + esc(r.message || r.error) + "</p>"; }).catch(function (e) { showFailure(e, "Reset failed"); });
      } else { Engine.reset(d.dataset); setStatus("", "Data reset"); $("#out").innerHTML = '<p class="muted">The practice data is back to its original rows.</p>'; Engine.schema(d.dataset).then(renderTree); }
    } else if (a === "prereqs" && d) {
      act.disabled = true;
      api("/api/library/item/" + d.id + "/prereqs", { dialect: dialect() }).then(function (r) { $("#out").innerHTML = '<p class="muted">' + esc(r.message) + "</p>"; act.disabled = false; }).catch(function (e) { act.disabled = false; showFailure(e); });
    } else if (a === "cleanup" && d) {
      if (!confirmClick(act, "Undo what this exercise changes in the database?", "Undo changes")) return;
      api("/api/library/item/" + d.id + "/cleanup", { dialect: dialect() }).then(function (r) { $("#out").innerHTML = '<p class="muted">' + esc(r.message) + "</p>"; }).catch(function (e) { showFailure(e); });
    } else if (a === "hint-insert") { var ta2 = $("#sql"); ta2.value = hintAsComment(act.closest(".hint").hintData) + ta2.value; ta2.dispatchEvent(new Event("input")); ta2.focus(); }
    else if (a === "toggle-table") { var ul = act.nextElementSibling; ul.hidden = !ul.hidden; act.setAttribute("aria-expanded", String(!ul.hidden)); }
    else if (a === "db-retry" && d) checkDb(d, true);
    else if (a === "set-goal") { var g = window.prompt("Daily goal: how many exercises a day?", String(dailyGoal())); if (g && Number(g) > 0 && Number(g) < 100) { store("sqldrills.goal", Math.round(Number(g))); render(); } }
    var ins = t.closest("[data-insert]");
    if (ins) insertAtCursor(ins.getAttribute("data-insert"));
    var qt = t.closest("[data-query-table]");
    if (qt && d) {
      var ta3 = $("#sql"); ta3.value = "SELECT *\nFROM " + qt.getAttribute("data-query-table") + "\nLIMIT 10;"; ta3.dispatchEvent(new Event("input"));
      Engine.run(d.dataset, ta3.value).then(function (res) { var last = res.ok && res.results[res.results.length - 1]; setStatus(res.ok ? "ok" : "bad", res.ok ? "Table preview" : "Query failed"); $("#out").innerHTML = !res.ok ? '<div class="err">' + esc(res.error) + "</div>" : last ? resultTable(last) : '<p class="muted">No rows.</p>'; });
    }
  });
  view.addEventListener("keydown", function (e) { var go = e.target.closest && e.target.closest("[data-go]"); if (go && e.target === go && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); location.hash = go.getAttribute("data-go"); } });
  view.addEventListener("input", function (e) {
    if (e.target.matches('[data-act="filter-q"]')) {
      S.filters.q = e.target.value; S.filters.page = 0; saveFilters();
      clearTimeout(viewList._t);
      viewList._t = setTimeout(function () { var pos = e.target.selectionStart; render(); var inp = view.querySelector('[data-act="filter-q"]'); if (inp) { inp.focus(); inp.selectionStart = inp.selectionEnd = pos; } }, 250);
    }
    if (e.target.matches('[data-fc-search]')) { var fq = new URLSearchParams(route.q); if (e.target.value) fq.set("q", e.target.value); else fq.delete("q"); fq.delete("page"); viewFlashcardLibrary._typing = { value: e.target.value, pos: e.target.selectionStart, at: Date.now() }; clearTimeout(viewFlashcardLibrary._t); viewFlashcardLibrary._t = setTimeout(function () { location.hash = "#/flashcards?" + fq; }, 250); }
  });
  view.addEventListener("change", function (e) {
    if (e.target.matches('[data-act="sort"]')) { S.filters.sort = e.target.value; S.filters.page = 0; saveFilters(); render(); }
    if (e.target.matches('[data-act="size"]')) { S.filters.size = Number(e.target.value); S.filters.page = 0; saveFilters(); render(); }
    if (e.target.matches('[data-fc-concept], [data-fc-sort], [data-fc-size]')) { var fq = new URLSearchParams(route.q), key = e.target.matches('[data-fc-concept]') ? "concept" : e.target.matches('[data-fc-sort]') ? "sort" : "size", value = e.target.value; if (!value || value === "all" || (key === "sort" && value === "path") || (key === "size" && value === "25")) fq.delete(key); else fq.set(key, value); fq.delete("page"); location.hash = "#/flashcards" + (fq.toString() ? "?" + fq : ""); }
  });

  // settings menu (header gear)
  var setBtn = $("#settingsBtn"), setMenu = $("#settingsMenu");
  function renderSettings() {
    setMenu.innerHTML = '<div class="sm-h">' + icon("gear") + "Settings</div>" +
      '<fieldset class="sm-group"><legend>Database for server-checked exercises</legend>' +
      [["mysql", "MySQL", "Default"], ["postgres", "PostgreSQL", "The same exercises in PostgreSQL where a version exists"]].map(function (o) {
        return '<label class="sm-opt"><input type="radio" name="dialect" value="' + o[0] + '"' + (dialect() === o[0] ? " checked" : "") + "><span><b>" + o[1] + "</b><small>" + o[2] + "</small></span></label>";
      }).join("") + "</fieldset>" +
      '<label class="sm-row">Daily goal <input type="number" min="1" max="99" id="goalInput" value="' + dailyGoal() + '"> exercises</label>' +
      '<label class="sm-row sm-check"><input type="checkbox" id="lockInput"' + (lockOn() ? " checked" : "") + "> Lock each level until 70% of the previous one is done</label>" +
      '<label class="sm-row sm-check"><input type="checkbox" id="reflectAiInput"' + (reflectAiOn() ? " checked" : "") + "> AI feedback on my reflections (uses AI credits)</label>";
  }
  function toggleSettings(open) {
    if (open === undefined) open = setMenu.hidden;
    if (open) renderSettings();
    setMenu.hidden = !open;
    setBtn.setAttribute("aria-expanded", String(open));
  }
  setBtn.innerHTML = icon("gear");
  setBtn.addEventListener("click", function (e) { e.stopPropagation(); toggleSettings(); });
  setMenu.addEventListener("click", function (e) { e.stopPropagation(); });
  setMenu.addEventListener("change", function (e) {
    if (e.target.id === "reflectAiInput") { store("sqldrills.reflectAi", e.target.checked ? "1" : "0"); toast(e.target.checked ? "Reflections get AI feedback when you save them" : "AI feedback on reflections is off"); }
    if (e.target.id === "lockInput") { store("sqldrills.lockLevels", e.target.checked ? "1" : "0"); toast(e.target.checked ? "Levels now open at 70% of the previous one" : "All levels are open"); render(); }
    if (e.target.name === "dialect") {
      store("sqldrills.dialect", e.target.value);
      toast("Server-checked exercises now run on " + (e.target.value === "postgres" ? "PostgreSQL" : "MySQL"));
      if (route.name === "drill") render();
    }
    if (e.target.id === "goalInput") { var g = Math.round(Number(e.target.value)); if (g > 0 && g < 100) { store("sqldrills.goal", g); render(); } }
  });
  document.addEventListener("click", function (e) {
    var lockedNode = e.target.closest("[data-locked]");
    if (lockedNode) { e.preventDefault(); var ln = Number(lockedNode.getAttribute("data-locked")); toast("Level " + ln + " opens when 70% of Level " + (ln - 1) + " is done (Settings → level locks)."); return; }
    if (e.target.closest("[data-open-settings]")) { e.stopPropagation(); toggleSettings(true); return; }
    if (!setMenu.hidden && !e.target.closest("#settingsMenu")) toggleSettings(false);
  });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !setMenu.hidden) { toggleSettings(false); setBtn.focus(); } });

  // top search
  var sIn = $("#searchInput"), sOut = $("#searchResults"), sActive = 0, sHits = [];
  function search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) { sOut.hidden = true; return; }
    sHits = S.items.concat(S.mcqs).filter(function (d) { return d.hay.indexOf(q) > -1; }).slice(0, 30);
    sActive = 0;
    sOut.innerHTML = sHits.length ? sHits.map(function (d, i) { return '<button data-i="' + i + '" class="' + (i ? "" : "on") + '"><div class="sr-path">' + esc(levelName(d.level)) + (d.kind === "mcq" ? " › Multiple choice" : "") + '</div><div class="sr-t">' + esc(d.title) + "</div></button>"; }).join("") : '<div class="sr-empty">Nothing matches “' + esc(q) + "”.</div>";
    sOut.hidden = false;
  }
  function pick(i) { var d = sHits[i]; if (!d) return; sOut.hidden = true; sIn.value = ""; sIn.blur(); location.hash = href(d); }
  sIn.addEventListener("input", function () { search(sIn.value); });
  sIn.addEventListener("focus", function () { search(sIn.value); });
  sIn.addEventListener("keydown", function (e) {
    var items = sOut.querySelectorAll("button");
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); sActive = Math.max(0, Math.min(items.length - 1, sActive + (e.key === "ArrowDown" ? 1 : -1))); items.forEach(function (b, i) { b.classList.toggle("on", i === sActive); }); if (items[sActive]) items[sActive].scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") pick(sActive);
    else if (e.key === "Escape") { sOut.hidden = true; sIn.blur(); }
  });
  sOut.addEventListener("mousedown", function (e) { var b = e.target.closest("button"); if (b) { e.preventDefault(); pick(Number(b.getAttribute("data-i"))); } });
  document.addEventListener("click", function (e) { if (!e.target.closest("#searchWrap")) sOut.hidden = true; });
  document.addEventListener("keydown", function (e) { if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !e.target.closest("input,textarea,select"))) { e.preventDefault(); sIn.focus(); sIn.select(); } });
  $("#menuBtn").addEventListener("click", function () { $("#side").classList.add("open"); $("#scrim").classList.add("open"); });
  $("#scrim").addEventListener("click", function () { $("#side").classList.remove("open"); $("#scrim").classList.remove("open"); });

  // exercise page: Alt+← / Alt+→ go to the previous / next exercise
  document.addEventListener("keydown", function (e) {
    if (route.name !== "drill" || !e.altKey || e.ctrlKey || e.metaKey) return;
    var link = e.key === "ArrowLeft" ? $("#exPrev") : e.key === "ArrowRight" ? $("#exNext") : null;
    if (link) { e.preventDefault(); location.hash = link.getAttribute("href"); }
  });

  // ---------- shared pieces for the React pages (web/src/shared/) ----------
  // The one copy of each piece stays here; the React wrappers render through these same functions inside #view,
  // so the delegated handlers above (schema panel, workspace, cards, confirm) and their API calls apply unchanged.
  window.SQLDrillsShared = {
    askConfirm: askConfirm, confirmClick: confirmClick,
    schemaPanel: schemaPanel, schemaMount: schemaMount, tablesPanel: tablesPanel,
    sqlWorkspace: sqlWorkspace, wsMount: wsMount, exampleBox: exampleBox, lessonExample: lessonExample, lessonCard: lessonCard,
    resultTable: resultTable, diffTables: diffTables, miniTable: miniTable,
    xcardHtml: xcardHtml, cardsInProgress: cardsInProgress,
    highlight: highlight, icon: icon, esc: esc,
    api: api, rail: rail, emptyStage: emptyStage, levelOf: levelOf, levels: function () { return S.levels; },
    get booted() { return booted; },
  };

  // ---------- boot ----------
  // the React bundle loads after this script: if it owns the page already on screen, hand that page over
  var booted = false;
  window.addEventListener("sqldrills:react-ready", function () { if (booted && window.SQLDrillsReact.has(route.name)) render(); });
  Promise.all([api("/api/library"), api("/api/mcqs").catch(function () { return []; }), api("/api/progress").catch(function () { return {}; }), api("/api/library/activity").catch(function () { return []; }), api("/api/bookmarks").catch(function () { return []; }), api("/api/library/review").catch(function () { return null; }), api("/api/learn/activity").catch(function () { return []; })])
    .then(function (r) {
      buildModel(r[0], r[1], r[2]);
      S.review = r[5] || { due: [], upcoming: [] };
      S.quizPassed = {};
      Object.keys(r[2] || {}).forEach(function (k) { var m = /^quiz:level-(\d+)$/.exec(k); if (m && r[2][k]) S.quizPassed[m[1]] = true; });
      S.activity = (r[3] || []).filter(function (a) { return a.id; }).concat(r[6] || []).sort(function (a, b) { return a.at < b.at ? -1 : 1; });
      (r[4] || []).forEach(function (b) { S.bookmarks[b.qid] = b.at; });
      recentCount = recentItems(30).length;
      window.addEventListener("hashchange", render);
      if (!location.hash) history.replaceState(null, "", "#/home");
      booted = true;
      window.dispatchEvent(new Event("sqldrills:booted"));
      render();
    })
    .catch(function (e) { view.innerHTML = '<div class="page full"><div class="err">Could not load the exercises: ' + esc(e.message) + ". Is sql-drills-server running (npm start)?</div></div>"; });
})();
