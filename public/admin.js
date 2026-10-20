// SQL Drills admin: overview, content generation machine, review queue, MCQ bank, extra drills,
// learner progress and AI settings. Talks to /api/admin/* on this server (no login: the server
// only listens on 127.0.0.1).
(function () {
  "use strict";

  var P = {
    wand: '<path d="m15 4 5 5L9 20H4v-5z"/><path d="m13 6 5 5"/>',
    server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
    db: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
    spark: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>', checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
    code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>', users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/>',
    cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>', sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', play: '<path d="M7 4v16l13-8z"/>', edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z"/><circle cx="12" cy="12" r="3"/>', eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c7 0 11 7 11 7a18 18 0 0 1-3.2 4.2M6.6 6.6A18 18 0 0 0 1 12s4 7 11 7a10 10 0 0 0 5.4-1.6"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', download: '<path d="M12 4v12M7 11l5 5 5-5M4 20h16"/>', reset: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
    chart: '<path d="M4 20V4"/><path d="M4 20h16"/><path d="M8 16v-5"/><path d="M12 16V8"/><path d="M16 16v-3"/><path d="M20 16V6"/>',
    warn: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17h.01"/>', external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>', heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/><path d="M8 11h2l1-2 2 4 1-2h2"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.6"/><path d="M12 17h.01"/>', graduation: '<path d="m2 9 10-5 10 5-10 5z"/><path d="M6 11v5c3 2 9 2 12 0v-5"/>',
    archive: '<rect x="3" y="4" width="18" height="5" rx="1"/><path d="M5 9v10h14V9M10 13h4"/>', chevRight: '<path d="m9 6 6 6-6 6"/>', chevLeft: '<path d="m15 6-6 6 6 6"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', levels: '<path d="M4 20h4v-6H4zM10 20h4V10h-4zM16 20h4V4h-4z"/>', layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>',
  };
  function icon(n) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[n] || "") + "</svg>"; }
  document.querySelectorAll("[data-icon]").forEach(function (el) { el.innerHTML = icon(el.getAttribute("data-icon")); });
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
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
  function api(path, method, body) {
    return fetch("/api/admin" + path, { method: method || "GET", headers: versionHeaders(body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined })
      .then(watchVersion)
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (b) { if (b && b.stale) { staleBanner(); toast(b.error); throw staleError(b.error); } if (!r.ok) throw new Error(b.error || "Request failed (" + r.status + ")"); return b; }); });
  }
  function toast(t) { var el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 2600); }
  function plural(n, w) { return n.toLocaleString() + " " + w + (n === 1 ? "" : "s"); }
  function ago(iso) {
    if (!iso) return "";
    var s = (Date.now() - new Date(iso)) / 1000;
    return s < 60 ? "just now" : s < 3600 ? Math.round(s / 60) + " min ago" : s < 86400 ? Math.round(s / 3600) + " h ago" : new Date(iso).toLocaleDateString();
  }

  var META = null; // topics, difficulties, tracks
  var view = $("#view"), viewRoot = view; // view: where the current page draws (a React host box, or #view)
  var route = { name: "overview", args: [], q: new URLSearchParams() };
  // [route, label, icon, badge key] - a string entry starts a group
  var NAV = [["overview", "Overview", "home"],
    "Content", ["generate", "Generate", "spark"], ["create", "Create", "plus"], ["review", "Review queue", "inbox", "queue"], ["library", "Library", "book", "library"], ["concepts", "Concepts", "layers"], ["mcqs", "MCQ bank", "checkCircle", "mcqs"],
    ["recent", "Recently added", "clock"], ["health", "Library health", "heart", "health"],
    "Manage", ["learners", "Learners", "users"], ["backups", "Backups", "archive"], ["settings", "AI & settings", "cog"], ["help", "How to use", "help"], ["docs", "Docs (SQL reference)", "book", null, "/#/docs"]];
  var TITLES = { item: "Exercise", drills: "Drills added in admin" };
  var counts = { queue: 0 };
  var queueCount = 0;
  // pages that belong to a nav entry
  var NAV_OF = { item: "library", drills: "library" };

  function renderNav() {
    var current = NAV_OF[route.name] || route.name;
    $("#nav").innerHTML = NAV.map(function (n) {
      if (typeof n === "string") return '<div class="grp" role="presentation">' + n + "</div>";
      var c = n[3] ? counts[n[3]] : null, on = current === n[0];
      var badge = c ? '<span class="count' + (n[3] === "health" ? " warn" : "") + '"><span class="sr-only">' + (n[3] === "health" ? "open issues: " : n[3] === "queue" ? "waiting: " : "") + "</span>" + c.toLocaleString() + "</span>" : "";
      // an entry with its own address (n[4]) opens that page: Docs lives in the learner app
      return '<a href="' + (n[4] || "#/" + n[0]) + '" class="' + (on ? "on" : "") + '"' + (on ? ' aria-current="page"' : "") + ">" + icon(n[2]) + "<span>" + n[1] + "</span>" + badge + "</a>";
    }).join("");
    var hb = $("#helpBtn"), sec = route.name === "generate" && route.q.get("kind") === "stage" ? "fill-gaps" : window.Help && Help.ROUTE_HELP.admin[route.name];
    if (hb) hb.setAttribute("href", "#/help" + (sec ? "?s=" + sec : ""));
    var t = NAV.filter(function (n) { return typeof n !== "string" && n[0] === route.name; })[0];
    var title = t ? t[1] : TITLES[route.name] || "Admin";
    $("#pageTitle").textContent = title;
    document.title = title + " · SQL Drills Admin";
  }
  function refreshCounts() {
    return api("/nav-counts").then(function (c) { counts = Object.assign(counts, c); queueCount = c.queue; renderNav(); return c; }).catch(function () {});
  }
  function refreshQueueCount() { return refreshCounts(); }

  // ---------- theme / mobile ----------
  function applyTheme(m) { if (m === "dark") document.documentElement.setAttribute("data-theme", "dark"); else document.documentElement.removeAttribute("data-theme"); $("#themeBtn").innerHTML = icon(m === "dark" ? "sun" : "moon"); }
  applyTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
  $("#themeBtn").addEventListener("click", function () { var n = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark"; applyTheme(n); try { localStorage.setItem("sqldrills.theme.v2", n); } catch (e) {} });
  $("#menuBtn").addEventListener("click", function () { $("#side").classList.add("open"); $("#scrim").classList.add("open"); });
  $("#scrim").addEventListener("click", function () { $("#side").classList.remove("open"); $("#scrim").classList.remove("open"); });

  // ---------- shared bits ----------
  function topicLabel(t) { return (META && META.topics[t]) ? META.topics[t].replace(/ \(.*\)$/, "") : t; }
  function siteName(id) { var s = META && META.sites.filter(function (x) { return x.id === id; })[0]; return s ? s.name : id; }
  // drafts an AI rewrote in a repair round: who, what, and the version before (when it was kept)
  function rwBadge(v) {
    var r = v && v.rewritten;
    if (!r) return "";
    return '<span class="vbadge rw" title="' + esc(r.by + " rewrote the " + r.what) + '">' + icon("edit") + "Rewritten · " + esc(r.by.replace("Claude ", "")) + "</span>";
  }
  function rwBefore(v) {
    var r = v && v.rewritten;
    if (!r) return "";
    var b = r.before, txt = "";
    if (typeof b === "string") txt = b;
    else if (b && b.sql) txt = (b.question ? b.question + "\n" : "") + (b.show_sql ? "-- input rows\n" + b.show_sql + "\n" : "") + "-- query\n" + b.sql;
    else if (b) txt = JSON.stringify(b, null, 2);
    var rc = v.recheck;
    var rcHtml = rc ? '<p class="small ' + (rc.ok ? "ok-txt" : "bad-n") + '" style="margin:4px 0">Re-checked ' + esc(fmtDate(rc.at, true)) + ": " + (rc.ok ? "every check passed" : "failed: " + esc(rc.checks.filter(function (c) { return !c.ok; }).map(function (c) { return c.label + (c.detail ? " (" + c.detail + ")" : ""); }).join("; "))) + "</p>" : "";
    return '<details class="rw-before"' + (rc && !rc.ok ? " open" : "") + '><summary class="qmeta">Rewritten by ' + esc(r.by) + ": " + esc(r.what) + (rc ? (rc.ok ? " · re-checked OK" : " · re-check failed") : "") + "</summary>" + rcHtml +
      (txt ? '<div class="muted small">Before</div><pre>' + esc(txt) + "</pre>" : '<p class="muted small" style="margin:4px 0">The version before wasn\'t kept (it was rewritten before this record existed): check the item as it is.</p>') + "</details>";
  }
  function vbadge(v) {
    if (!v) return "";
    var label = { pass: "Verified", warn: "Check warnings", fail: "Failed checks" }[v.status];
    return '<span class="vbadge ' + v.status + '">' + icon(v.status === "pass" ? "check" : v.status === "warn" ? "warn" : "x") + label + "</span>";
  }
  function checksList(v) {
    if (!v) return "";
    return '<ul class="checks">' + v.checks.map(function (c) { return '<li class="' + (c.ok ? "" : c.warn ? "wa" : "no") + '">' + esc(c.label) + (c.detail ? " <span>· " + esc(c.detail) + "</span>" : "") + "</li>"; }).join("") + "</ul>";
  }
  function resultTable(r) {
    if (!r) return "";
    if (!r.ok) return '<div class="err">' + esc(r.error) + "</div>";
    if (r.write) return '<p class="small"><b>Changes on MySQL (scratch copy):</b> ' + esc(r.changes.join(", ") || "nothing") + "</p>";
    return '<div class="result-box"><table><thead><tr>' + r.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      r.rows.map(function (row) { return "<tr>" + row.map(function (v) { return "<td>" + (v === null ? '<i class="muted">NULL</i>' : esc(v)) + "</td>"; }).join("") + "</tr>"; }).join("") +
      '</tbody></table></div><div class="kpi-note">' + plural(r.count, "row") + (r.count > r.rows.length ? ", first " + r.rows.length + " shown" : "") + "</div>";
  }
  function selectHtml(name, options, value, all) {
    return '<select name="' + name + '">' + (all ? '<option value="">' + all + "</option>" : "") + options.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(value) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>";
  }
  function topicOptions() { return Object.keys(META.topics).map(function (k) { return [k, topicLabel(k)]; }); }
  function diffOptions() { return META.diffs.map(function (d) { return [d, d.charAt(0).toUpperCase() + d.slice(1)]; }); }
  function siteOptions() { return META.sites.map(function (s) { return [s.id, s.name]; }); }
  var LEVEL_TOPIC = { 1: "select", 2: "where", 3: "order", 4: "functions", 5: "group", 6: "join", 7: "subquery", 8: "set", 9: "window", 10: "modify", 11: "ddl", 12: "views", 13: "tx", 14: "group" };
  var TOPIC_LEVEL = { select: 1, where: 2, order: 3, functions: 4, dates: 4, group: 5, aggregates: 5, join: 6, subquery: 7, set: 8, window: 9, modify: 10, ddl: 11, views: 12, tx: 13, security: 13 };
  function siteOfDataset(key) { for (var k in DATASET_OF_SITE) if (DATASET_OF_SITE[k] === key) return k; return key; }
  function levelOptions() { return META.levels.map(function (L) { return [L.n, L.n + " · " + L.title]; }); }
  function levelLabel(n) { var L = META.levels[Number(n) - 1]; return L ? "Level " + L.n + " · " + L.title : "Level ?"; }
  function itemLevel(d) { return Number(d.level) || TOPIC_LEVEL[d.topic] || 1; }
  function datasetOptions() { return META.datasets.map(function (x) { return [x.key, x.label]; }); }
  var DATASET_OF_SITE = { sqlzoo: "world", w3schools: "library", sqltutorialorg: "hr", tpointtech: "shop", geeksforgeeks: "streaming", tutorialspoint: "clinic", sqlcourse: "games", tutorialrepublic: "hotels" };
  function datasetLabel(d) { var key = d.dataset || DATASET_OF_SITE[d.site]; var x = META.datasets.filter(function (y) { return y.key === key; })[0]; return x ? x.label : key || ""; }
  function originLabel(src) { src = String(src || ""); return src.indexOf("drills:") === 0 ? "Built-in drills" : src === "course30" ? "30-day course" : src === "exercises" ? "SQL Exercises set" : src.indexOf("ai:") === 0 ? "Generated (" + src.slice(3).split(" ")[0] + ")" : src === "built-in" ? "Built-in MCQs" : src === "generated" ? "Generated" : src === "added" || src === "manual" ? "Added in admin" : src; }

  // MCQ / drill preview card (review queue)
  function itemCard(it) {
    var d = it.data, isMcq = it.kind === "mcq";
    var head = '<div class="qcard-h"><span class="tag ' + (isMcq ? "mcq-tag" : "") + '">' + (isMcq ? "MCQ" : "SQL drill") + '</span>' + (it.source === "mine" ? '<span class="tag plain">Mine</span>' : "") + '<span class="tag plain">' + esc(levelLabel(itemLevel(d))) + '</span><span class="tag plain">' + esc(d.diff) + "</span>" +
      (isMcq ? "" : '<span class="tag plain">' + esc(datasetLabel(d)) + "</span>") + (d.stage ? '<span class="tag plain">' + esc({ practise: "Practise", transfer: "Transfer" }[d.stage] || d.stage) + (d.concepts ? " · " + esc(d.concepts.join(", ")) : "") + "</span>" : "") + '<span class="grow"></span>' + rwBadge(it.verify) + vbadge(it.verify) + "</div>";
    var body = isMcq
      ? '<div class="qq">' + esc(d.q) + "</div>" + (d.code ? "<pre>" + esc(d.code) + "</pre>" : "") +
        '<ul class="qopts">' + d.options.map(function (o, k) { return '<li class="' + (k === d.answer ? "right" : "") + '"><b>' + "ABCDE".charAt(k) + "</b>" + esc(o) + "</li>"; }).join("") + "</ul>" +
        '<div class="qwhy"><b>Why:</b> ' + esc(d.why) + "</div>" + (d.check ? "<pre>-- check (SQLite)\n" + esc(d.check) + "</pre>" : "")
      : '<div class="qq">' + esc(d.title) + '</div><div class="qwhy">' + esc(d.task) + "</div><pre>" + esc(d.solution_sql) + "</pre>" + (it.verify && it.verify.result ? resultTable(it.verify.result) : "");
    head = head.replace('<div class="qcard-h">', '<div class="qcard-h">' + selBox(it.id, "draft", d.title || d.q || it.id));
    body = unblocksHtml(it.id) + body + rwBefore(it.verify);
    return '<section class="card qcard" data-id="' + esc(it.id) + '" data-kind="' + it.kind + '" data-cat="draft" data-level="' + itemLevel(d) + '" data-type="' + (isMcq ? "mcq" : "draft") + '">' + head + body +
      "<details><summary class=\"qmeta\">Verification details · " + esc(it.source) + " · " + ago(it.created_at) + "</summary>" + checksList(it.verify) + "</details>" +
      '<div class="actions"><button class="btn ok sm" data-act="approve">' + icon("check") + 'Approve & publish</button><button class="btn sm" data-act="edit">' + icon("edit") + 'Edit</button><span class="grow"></span><button class="btn sm danger" data-act="reject">' + icon("x") + "Reject</button></div></section>";
  }

  // ---------- editor (modal) ----------
  var modal = $("#modal");
  function openEditor(kind, item, onSaved, opts) {
    opts = opts || {};
    var d = item ? item.data || item : {};
    if (kind === "mcq") d = { q: d.q || "", code: d.code || "", options: d.options || ["", "", "", ""], answer: d.answer == null ? 0 : d.answer, why: d.why || "", topic: d.topic || "select", level: itemLevel(d), diff: d.diff || "easy", check: d.check || "" };
    else d = { dataset: d.dataset || DATASET_OF_SITE[d.site] || META.datasets[0].key, topic: d.topic || "select", level: itemLevel(d), diff: d.diff || "easy", title: d.title || "", task: d.task || "", solution_sql: d.solution_sql || "", summary: d.summary || "" };
    var origTopic = d.topic, origLevel = d.level;
    var isBuiltin = item && item.origin === "built-in";
    var title = opts.write ? "Write an exercise" : (item ? "Edit " : "New ") + (kind === "mcq" ? "multiple-choice question" : "SQL drill");
    var form = kind === "mcq"
      ? '<div class="row2"><label>Level' + selectHtml("level", levelOptions(), d.level) + "</label><label>Difficulty" + selectHtml("diff", diffOptions(), d.diff) + "</label></div>" +
        '<label>Question<textarea name="q" rows="2">' + esc(d.q) + "</textarea></label>" +
        '<label>Code shown with the question <span class="hint-txt">(optional)</span><textarea name="code" class="mono" rows="2">' + esc(d.code) + "</textarea></label>" +
        '<div class="field">Options <span class="hint-txt">(tick the right one)</span>' + d.options.map(function (o, k) {
          return '<div class="opt-edit"><input type="radio" name="answer" value="' + k + '"' + (k === d.answer ? " checked" : "") + ' aria-label="Option ' + "ABCD".charAt(k) + ' is right"><input name="opt' + k + '" value="' + esc(o) + '" placeholder="Option ' + "ABCD".charAt(k) + '"></div>';
        }).join("") + "</div>" +
        '<label>Explanation (shown after answering)<textarea name="why" rows="2">' + esc(d.why) + "</textarea></label>" +
        '<label>Check query <span class="hint-txt">(optional: a self-contained SQLite query whose result must equal the right option)</span><textarea name="check" class="mono" rows="2">' + esc(d.check) + "</textarea></label>"
      : '<div class="row3"><label>Level' + selectHtml("level", levelOptions(), d.level) + "</label><label>Difficulty" + selectHtml("diff", diffOptions(), d.diff) + "</label><label>Dataset · engine" + selectHtml("dataset", datasetOptions().map(function (o) { return [o[0], o[1] + " · browser (SQLite)"]; }), d.dataset) + "</label></div>" +
        '<label>Title<input name="title" value="' + esc(d.title) + '" required></label>' +
        '<label>Prompt (what the learner reads)<textarea name="task" rows="3" required>' + esc(d.task) + "</textarea></label>" +
        '<label>One-line summary <span class="hint-txt">(shown in the lists, at most 110 characters)</span><input name="summary" maxlength="110" value="' + esc(d.summary) + '"></label>' +
        '<label>Solution SQL <span class="hint-txt">(one SELECT; learners\' answers are compared with its result)</span><textarea name="solution_sql" class="mono" rows="5">' + esc(d.solution_sql) + "</textarea></label>" +
        '<div class="actions"><button type="button" class="btn sm" data-act="run-sol">' + icon("play") + 'Run solution</button><a class="link" data-act="show-schema" href="#">Show the schema</a></div><div id="solOut"></div><pre id="schemaOut" hidden></pre>';
    $("#modalBody").innerHTML = '<div class="modal-h"><h2>' + title + "</h2>" + (isBuiltin ? '<span class="tag plain">built-in</span>' : "") + '<button class="icon-btn" data-act="close" aria-label="Close">' + icon("x") + '</button></div><form class="modal-b form" id="edForm">' + form +
      '<div id="vOut" aria-live="polite"></div><div class="actions"><button type="button" class="btn" data-act="verify">' + icon("checkCircle") + (kind === "drill" ? "Validate" : "Verify") + '</button><span class="grow"></span>' +
      (isBuiltin ? '<button type="button" class="btn ok" data-act="save-pub">Save changes (live)</button>'
        : '<button type="button" class="btn" data-act="save-draft">Save as draft</button><button type="button" class="btn ok" data-act="save-pub">Save & publish</button>') + "</div></form>";
    modal.showModal();
    function collect() {
      var f = $("#edForm"), v = function (n) { return f.elements[n] ? f.elements[n].value : ""; };
      if (kind === "mcq") {
        var ans = f.querySelector('input[name="answer"]:checked');
        var lvlM = Number(v("level"));
        return { q: v("q"), code: v("code"), options: [v("opt0"), v("opt1"), v("opt2"), v("opt3")], answer: ans ? Number(ans.value) : -1, why: v("why"), level: lvlM, topic: lvlM === origLevel ? origTopic : LEVEL_TOPIC[lvlM], diff: v("diff"), check: v("check") };
      }
      var lvl = Number(v("level"));
      return { dataset: v("dataset"), level: lvl, topic: lvl === origLevel ? origTopic : LEVEL_TOPIC[lvl], diff: v("diff"), title: v("title"), task: v("task"), solution_sql: v("solution_sql"), summary: v("summary") };
    }
    function save(status) {
      var data = collect();
      var req = item && item.id ? api("/items/" + encodeURIComponent(item.id), "PUT", { kind: kind, status: status, data: data }) : api("/items", "POST", { kind: kind, status: status, data: data });
      req.then(function (saved) {
        if (status === "published" && saved.verify && saved.verify.status === "fail") toast("Saved and published, but some checks fail: please look again.");
        else toast(status === "published" ? "Saved and published" : "Saved as a draft");
        modal.close();
        if (onSaved) onSaved(saved);
      }).catch(function (e) { toast(e.message); });
    }
    modal.onclick = function (e) {
      var a = e.target.closest("[data-act]");
      if (!a) return;
      var act = a.getAttribute("data-act");
      if (act === "close") modal.close();
      else if (act === "verify") api("/verify", "POST", { kind: kind, id: item && item.id, data: collect() }).then(function (v) { $("#vOut").innerHTML = '<div class="card card-pad" style="box-shadow:none">' + vbadge(v) + '<div style="margin-top:10px">' + checksList(v) + "</div>" + (v.result ? '<div style="margin-top:10px">' + resultTable(v.result) + "</div>" : "") + "</div>"; }).catch(function (er) { toast(er.message); });
      else if (act === "save-draft") save("draft");
      else if (act === "save-pub") {
        if (kind !== "drill") return save("published");
        api("/verify", "POST", { kind: kind, id: item && item.id, data: collect() }).then(function (v) {
          $("#vOut").innerHTML = '<div class="card card-pad" style="box-shadow:none">' + vbadge(v) + '<div style="margin-top:10px">' + checksList(v) + "</div>" + (v.result ? '<div style="margin-top:10px">' + resultTable(v.result) + "</div>" : "") + "</div>";
          if (v.status === "fail") toast("The solution didn't pass validation: fix it, or save as a draft.");
          else save("published");
        }).catch(function (er) { toast(er.message); });
      }
      else if (act === "run-sol") { var c = collect(); api("/run-sql", "POST", { site: siteOfDataset(c.dataset), sql: c.solution_sql }).then(function (r) { $("#solOut").innerHTML = resultTable(r); }); }
      else if (act === "show-schema") { e.preventDefault(); var so = $("#schemaOut"); if (!so.hidden) { so.hidden = true; return; } api("/schema/" + encodeURIComponent(siteOfDataset(collect().dataset))).then(function (r) { so.textContent = r.schema; so.hidden = false; }); }
    };
  }

  // ---------- pages ----------
  function levelsTable(lib) {
    return '<table class="admin-t"><thead><tr><th>Level</th><th>Exercises</th><th>Easy</th><th>Medium</th><th>Hard</th><th>Done</th></tr></thead><tbody>' +
      lib.levels.map(function (L) { return "<tr><td><b>" + L.n + " · " + esc(L.title) + "</b></td><td>" + L.total + "</td><td>" + L.easy + "</td><td>" + L.medium + "</td><td>" + L.hard + "</td><td>" + L.done + "</td></tr>"; }).join("") +
      "<tr><td><b>Total</b></td><td><b>" + lib.total + "</b></td><td>" + lib.levels.reduce(function (a, L) { return a + L.easy; }, 0) + "</td><td>" + lib.levels.reduce(function (a, L) { return a + L.medium; }, 0) + "</td><td>" + lib.levels.reduce(function (a, L) { return a + L.hard; }, 0) + "</td><td>" + lib.levels.reduce(function (a, L) { return a + L.done; }, 0) + "</td></tr></tbody></table>";
  }
  function stat(color, ic, label, value, sub, href) {
    return '<a class="card stat" href="' + href + '"><span class="ic ' + color + '">' + icon(ic) + '</span><div class="s-body"><div class="s-l">' + label + '</div><div class="s-v">' + value + '</div><div class="s-sub">' + esc(sub) + "</div></div></a>";
  }
  function barChart(days) {
    var W = 640, H = 190, pad = 26, n = 30, list = [];
    for (var i = n - 1; i >= 0; i--) { var d = new Date(); d.setDate(d.getDate() - i); var k = d.toISOString().slice(0, 10); list.push({ k: k, v: days[k] || 0 }); }
    var max = Math.max(4, Math.max.apply(null, list.map(function (x) { return x.v; })));
    var bw = (W - pad) / n;
    var bars = list.map(function (x, i) { var h = (H - 30) * x.v / max; return '<rect class="b" x="' + (pad + i * bw + 2) + '" y="' + (H - 18 - h) + '" width="' + (bw - 4) + '" height="' + Math.max(h, x.v ? 2 : 0) + '" rx="3"><title>' + x.k + ": " + x.v + "</title></rect>"; }).join("");
    var axis = [0, Math.round(max / 2), max].map(function (v) { var y = H - 18 - (H - 30) * v / max; return '<line class="gl" x1="' + pad + '" x2="' + W + '" y1="' + y + '" y2="' + y + '"/><text class="ax" x="0" y="' + (y + 4) + '">' + v + "</text>"; }).join("");
    var labels = [0, 10, 20, 29].map(function (i) { return '<text class="ax" x="' + (pad + i * bw) + '" y="' + (H - 2) + '">' + list[i].k.slice(5) + "</text>"; }).join("");
    var total = list.reduce(function (a, x) { return a + x.v; }, 0);
    return '<svg class="chart" viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" role="img" aria-label="Completions per day">' + axis + bars + labels + '</svg><div class="kpi-note">' + plural(total, "completion") + " in the last 30 days (drills, MCQs and course exercises)</div>";
  }
  var ROLE_LABEL = { generator: "Generates", reviewer: "Reviews", tieBreaker: "Breaks ties" };
  var PROV_LABEL = { openai: "OpenAI", deepseek: "DeepSeek", claude: "Claude" };
  /** The roles for content generation (GET /ai-roles). full: the Settings card; otherwise one line (Generate page). */
  function loadRoles(box, full) {
    if (!box) return;
    api("/ai-roles").then(function (roles) {
      var price = function (p) { return p ? "$" + p[0] + " in / $" + p[1] + " out per million tokens" : "price unknown"; };
      if (!full) { box.innerHTML = roles.map(function (r) { return ROLE_LABEL[r.role] + ": <b>" + esc(PROV_LABEL[r.provider]) + "</b> <span class=\"mono\">" + esc(r.model) + "</span>"; }).join(" · "); return; }
      box.innerHTML = '<div class="card-h"><h3 id="roles-h">' + icon("spark") + 'Content generation roles</h3></div><p class="muted small" style="margin:-4px 0 10px">One provider generates, a different one reviews, Claude Sonnet breaks ties. If the tie-breaker can\'t run (e.g. no Anthropic credit), the item is flagged for manual review instead.</p>' +
        '<table class="admin-t"><thead><tr><th scope="col">Role</th><th scope="col">Provider</th><th scope="col">Model</th><th scope="col">Price</th><th scope="col">Key</th></tr></thead><tbody>' +
        roles.map(function (r) { return "<tr><td>" + ROLE_LABEL[r.role] + "</td><td>" + esc(PROV_LABEL[r.provider]) + '</td><td class="mono">' + esc(r.model) + '</td><td class="small">' + price(r.price) + "</td><td>" + (r.configured ? '<span class="ok-txt">set</span>' : '<span class="bad-n">missing</span>') + "</td></tr>"; }).join("") + "</tbody></table>";
    }).catch(function (e) { box.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
  }
  function providersList(list) {
    return list.map(function (p) { return '<div class="prov"><span class="st' + (p.configured ? " on" : "") + '"></span><div><b>' + esc(p.label) + "</b>" + (p.model ? ' <span class="muted small">' + esc(p.model) + "</span>" : "") + '</div><span class="muted small">' + (p.configured ? "ready" : "no API key") + "</span></div>"; }).join("");
  }
  // --- generate: numbered steps, live summary, checks, the selected level, generation runs
  var pollTimer = null;
  var TOPIC_SHORT = { select: "SELECT", where: "WHERE", order: "ORDER BY", join: "JOIN", group: "GROUP BY", aggregates: "aggregate", subquery: "subquery", window: "window-function", set: "set-operator", functions: "function & CASE", dates: "date-function", modify: "INSERT / UPDATE / DELETE", ddl: "schema", views: "view & index", tx: "transaction", security: "SQL-security" };
  function topicsFor(level) {
    var keys = Object.keys(META.topics).filter(function (k) { return TOPIC_LEVEL[k] === Number(level); });
    return keys.length ? keys : Object.keys(META.topics); // Level 14 (projects) mixes every topic
  }
  var GEN_CHECKS = {
    drill: [["Shape", "A title, a task of at least 20 characters, a topic and a difficulty."], ["The solution runs", "It is run on the practice database: it must succeed and return rows (stored, so learners' answers can be compared)."], ["No duplicates", "No exact copy of any exercise in the library; no near-duplicate in the chosen level."], ["Independent AI review", "A different AI provider checks that the solution does exactly what the task asks."]],
    mcq: [["Shape", "A question, four different options, exactly one marked right, and an explanation."], ["No trick options", "No \"all / none of the above\"; when the AI gives a check query, SQLite must return the marked answer."], ["No duplicates", "No exact copy anywhere in the bank; no near-duplicate in the chosen level."], ["Independent AI review", "A different AI provider checks that the marked answer is the only defensible one."]],
  };
  function viewGenerate() {
    if (route.q.get("kind") === "stage") return viewStageGen();
    if (route.q.get("kind") === "images") return viewImageGen();
    var q = route.q;
    var saved = {};
    try { saved = JSON.parse(localStorage.getItem("sqldrills.admin.gen") || "{}"); } catch (e) {}
    var st = {
      kind: q.get("kind") === "mcq" ? "mcq" : q.get("kind") === "drill" || q.get("checkable") ? "drill" : saved.kind || "drill",
      level: Number(q.get("level")) || Number(saved.level) || 6,
      diff: ["easy", "medium", "hard"].indexOf(q.get("difficulty")) > -1 ? q.get("difficulty") : saved.diff || "medium",
      count: Math.min(10, Math.max(1, Number(saved.count) || 5)),
      provider: saved.provider || "auto",
      dataset: saved.dataset || "shop",
      notes: saved.notes || "",
      topic: "",
    };
    st.topic = topicsFor(st.level).indexOf(saved.topic) > -1 && !q.get("level") ? saved.topic : topicsFor(st.level)[0];
    var checkable = !!q.get("checkable");
    Promise.all([api("/library"), api("/providers"), api("/mcqs"), api("/queue")]).then(function (r) {
      var lib = r[0], providers = r[1], mcqs = r[2], queue = r[3];
      var mcqBy = {};
      provNames = {}; providers.forEach(function (p) { provNames[p.id] = p.id === "auto" ? "Auto" : p.label.replace(/ only$/, ""); });
      mcqs.forEach(function (m) { if (m.status === "published") { var l = itemLevel(m); mcqBy[l] = (mcqBy[l] || 0) + 1; } });
      var step = function (n, title, body, hint) { return '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">' + n + "</span>" + title + (hint ? ' <span class="hint-txt">' + hint + "</span>" : "") + "</legend>" + body + "</fieldset>"; };
      var radio = function (name, value, label, checked, extra) { return '<label class="opt-chip' + (extra ? " " + extra : "") + '"><input type="radio" name="' + name + '" value="' + esc(value) + '"' + (checked ? " checked" : "") + "><span>" + label + "</span></label>"; };
      var html = '<div class="page admin gen"><div class="col"><div class="hero"><div><div class="eyebrow">Content generation machine</div><h2 class="h1">Generate practice content</h2><p>The AI drafts it, every draft is checked automatically, and nothing goes live until you approve it in the review queue. Approved items go straight into the chosen level.</p></div></div>';
      html += genTabs(st.kind);
      html += '<div class="gen-grid" role="tabpanel" aria-labelledby="tab-' + st.kind + '"><form class="gen-form" id="genForm">';
      if (checkable && st.kind === "drill") html += '<div class="note-box">' + icon("check") + "<div>Generated drills are always auto-checkable: each one has a solution that is run on its dataset (a single SELECT in SQLite, or for Levels 10–13 statements run on a scratch MySQL copy and compared by end state), so learners get Correct / Not yet feedback. None of them are self-check.</div></div>";
      html += step(1, "Level", '<div class="lvl-cards">' + lib.levels.map(function (L) {
        return '<label class="lvl-card"><input type="radio" name="level" value="' + L.n + '"' + (L.n === st.level ? " checked" : "") + '><span class="lc-n mono">' + L.n + '</span><span class="lc-t">' + esc(L.title) + '</span><span class="lc-c mono">' + L.total + " · " + L.easy + "/" + L.medium + "/" + L.hard + (mcqBy[L.n] ? " · " + mcqBy[L.n] + " MCQ" : "") + "</span></label>";
      }).join("") + "</div>", "(approved items go into this level)");
      html += step(2, "Topic", '<div class="chips" id="topicChips"></div><div id="topicWarn" aria-live="polite"></div>');
      html += step(3, "Difficulty", '<div class="seg-radio">' + ["easy", "medium", "hard"].map(function (d) { return radio("diff", d, d.charAt(0).toUpperCase() + d.slice(1), d === st.diff, "d-" + d); }).join("") + "</div>");
      html += step(4, "How many", '<div class="stepper"><button type="button" class="btn sm" data-act="dec" aria-label="One fewer">−</button><input type="number" name="count" id="genCount" min="1" max="10" value="' + st.count + '" aria-label="How many to generate (1 to 10)"><button type="button" class="btn sm" data-act="inc" aria-label="One more">+</button><span class="muted small">1–10 per run</span></div>');
      html += step(5, "AI provider", '<div class="chips">' + providers.map(function (p) {
        var name = p.id === "auto" ? "Auto" : p.label.replace(/ only$/, "");
        return '<label class="opt-chip' + (p.configured ? "" : " off") + '"><input type="radio" name="provider" value="' + esc(p.id) + '"' + (p.id === st.provider ? " checked" : "") + (p.configured ? "" : " disabled") + "><span>" + esc(name) + (p.configured ? "" : " · no key") + "</span></label>";
      }).join("") + '</div><p class="hint-txt" style="margin:6px 0 0">' + esc(providers[0].label) + " — the next one takes over when one fails.</p><p class=\"hint-txt\" id=\"genRoles\" style=\"margin:4px 0 0\"></p>");
      if (st.kind === "drill") html += step(6, "Practice database", '<div class="chips">' + META.datasets.map(function (dset) { return radio("dataset", dset.key, esc(dset.label), dset.key === st.dataset); }).join("") + '</div><p class="hint-txt" style="margin:6px 0 0">The drills are written for, and verified on, its tables (in the browser, SQLite).</p>');
      html += step(st.kind === "drill" ? 7 : 6, "Extra instructions", '<label class="sr-only" for="genNotes">Extra instructions</label><textarea name="notes" id="genNotes" rows="3" placeholder="Optional, e.g. &quot;focus on LEFT JOIN pitfalls&quot;, &quot;use the orders and customers tables&quot;">' + esc(st.notes) + "</textarea>");
      html += '<div class="gen-bar" role="region" aria-label="Generate"><span class="gen-sum" id="genSum" aria-live="polite"></span><a class="link small" href="#/review">Review queue (' + queue.length + ')</a><button class="btn primary" type="submit" id="genBtn">' + icon("spark") + "Generate</button></div></form>";
      // right column
      html += '<aside class="gen-side"><section class="card card-pad"><div class="card-h"><h3>' + icon("checkCircle") + "Every draft is checked</h3></div><ol class=\"gchecks\">" + GEN_CHECKS[st.kind].map(function (c) { return "<li><b>" + c[0] + "</b><span>" + c[1] + "</span></li>"; }).join("") + '</ol><p class="muted small" style="margin:10px 0 0">Drafts that fail a check stay in the queue marked red: fix them in the editor or reject them.</p></section>' +
        '<section class="card card-pad" id="lvlCard" aria-live="polite"></section>' +
        '<section class="card card-pad"><div class="card-h"><h3>' + icon("inbox") + 'Review queue</h3></div><p style="margin:0 0 10px"><span class="mono">' + queue.length + "</span> " + (queue.length === 1 ? "draft is" : "drafts are") + ' waiting.</p><a class="btn sm" href="#/review">Open the review queue</a></section></aside></div>';
      html += '<section class="card card-pad" aria-labelledby="runs-h"><div class="card-h"><h3 id="runs-h">' + icon("layers") + 'Generation runs</h3></div><div class="table-wrap" id="jobs"><div class="empty-sm">Loading…</div></div></section></div></div>';
      view.innerHTML = html;

      var form = $("#genForm");
      function readForm() {
        var v = function (n) { var el = form.querySelector('[name="' + n + '"]:checked') || form.elements[n]; return el ? el.value : ""; };
        st.level = Number(v("level")); st.diff = v("diff"); st.provider = v("provider") || "auto"; st.notes = $("#genNotes").value;
        st.count = Math.min(10, Math.max(1, Number($("#genCount").value) || 1));
        if (st.kind === "drill") st.dataset = v("dataset");
        var t = form.querySelector('[name="topic"]:checked'); st.topic = t ? t.value : topicsFor(st.level)[0];
      }
      function paintTopics() {
        var keys = topicsFor(st.level);
        if (keys.indexOf(st.topic) < 0) st.topic = keys[0];
        $("#topicChips").innerHTML = keys.map(function (k) { return '<label class="opt-chip"><input type="radio" name="topic" value="' + k + '"' + (k === st.topic ? " checked" : "") + "><span>" + esc(topicLabel(k)) + "</span></label>"; }).join("");
      }
      function paintSide() {
        var L = lib.levels[st.level - 1];
        $("#lvlCard").innerHTML = '<div class="card-h"><h3>' + icon("levels") + "Level " + L.n + " · " + esc(L.title) + '</h3></div><dl class="kv3"><div><dt>Exercises</dt><dd class="mono">' + L.total + '</dd></div><div><dt>Easy / Med / Hard</dt><dd class="mono">' + L.easy + "/" + L.medium + "/" + L.hard + '</dd></div><div><dt>Self-check</dt><dd class="mono">' + L.selfCheck + '</dd></div></dl><p class="muted small" style="margin:10px 0 0"><span class="mono">' + (mcqBy[L.n] || 0) + '</span> live MCQs · <a href="#/library?level=' + L.n + '">open the level</a></p>';
      }
      function paintSummary() {
        readForm();
        var warn = $("#topicWarn");
        if (warn) warn.innerHTML = st.kind === "drill" && ["modify", "ddl", "views", "tx"].indexOf(st.topic) > -1 ? '<div class="note-box">' + icon("server") + "<div>Write drill: each solution runs on a fresh scratch copy of the dataset on MySQL, and learners are checked by the end state (rows, columns, keys, constraints, indexes).</div></div>"
          : st.kind === "drill" && st.topic === "security" ? '<div class="note-box">' + icon("warn") + "<div>A drill can't practise <b>" + esc(topicLabel(st.topic)) + '</b> (users, privileges and injection don\'t run on the scratch copy): drafts will be flagged. <a href="#/generate?kind=mcq&level=' + st.level + '">Generate multiple-choice questions</a> for it instead.</div></div>' : "";
        var what = st.kind === "mcq" ? "multiple-choice question" : "drill";
        $("#genSum").innerHTML = '<b class="mono">' + st.count + "</b> " + st.diff + " " + esc(TOPIC_SHORT[st.topic] || topicLabel(st.topic)) + " " + what + (st.count === 1 ? "" : "s") + " · Level " + st.level + (st.kind === "drill" ? " · " + esc(datasetLabel({ dataset: st.dataset }).split(" (")[0]) : "") + " · " + esc(provName(st.provider));
        try { localStorage.setItem("sqldrills.admin.gen", JSON.stringify({ kind: st.kind, level: st.level, diff: st.diff, count: st.count, provider: st.provider, dataset: st.dataset, notes: st.notes, topic: st.topic })); } catch (e) {}
      }
      paintTopics(); paintSide(); paintSummary();
      loadRoles($("#genRoles"), false);
      form.addEventListener("change", function (e) {
        if (e.target.name === "level") { st.level = Number(e.target.value); paintTopics(); paintSide(); }
        paintSummary();
      });
      form.addEventListener("input", function (e) { if (e.target.id === "genCount" || e.target.id === "genNotes") paintSummary(); });
      view.onclick = function (e) {
        var k = e.target.closest("[data-kind]");
        if (k) { st.kind = k.getAttribute("data-kind"); var p = new URLSearchParams(); p.set("kind", st.kind); p.set("level", st.level); p.set("difficulty", st.diff); location.hash = "#/generate?" + p; return; }
        var a = e.target.closest("[data-act]");
        if (!a) return;
        var c = $("#genCount");
        if (a.getAttribute("data-act") === "dec") c.value = Math.max(1, Number(c.value) - 1);
        if (a.getAttribute("data-act") === "inc") c.value = Math.min(10, Number(c.value) + 1);
        paintSummary();
      };
      // arrow keys move between the tabs
      wireGenTabs(false);
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        readForm();
        var params = { level: st.level, topic: st.topic, diff: st.diff, count: st.count, provider: st.provider, notes: st.notes };
        if (st.kind === "drill") params.dataset = st.dataset;
        $("#genBtn").disabled = true;
        api("/generate", "POST", { kind: st.kind, params: params }).then(function () { toast("Generating… you can leave this page"); loadJobs(); })
          .catch(function (er) { toast(er.message); }).then(function () { $("#genBtn").disabled = false; });
      });
      loadJobs();
    }).catch(fail);
  }
  var provNames = { auto: "Auto", openai: "OpenAI", claude: "Claude", deepseek: "DeepSeek" };
  function provName(id) { return provNames[id] || id || "Auto"; }
  function jobsTable(jobs) {
    if (!jobs.length) return '<div class="empty-sm">No generation runs yet. Pick a level and press Generate: runs appear here with their progress.</div>';
    return '<table class="admin-t runs"><thead><tr><th scope="col">Started</th><th scope="col">Level</th><th scope="col">Topic</th><th scope="col">Difficulty</th><th scope="col">Provider</th><th scope="col" class="n">Passed checks</th><th scope="col">Status</th></tr></thead><tbody>' + jobs.map(function (j) {
      var p = j.params, status = j.status === "running" ? '<span class="run-st running"><span class="spin" aria-hidden="true"></span>Generating</span><div class="muted small">' + esc(j.progress || "") + "</div>"
        : j.status === "failed" ? '<span class="run-st failed">Failed</span><div class="muted small">' + esc(String(j.error || "").slice(0, 140)) + "</div>"
        : '<span class="run-st done">Done</span>' + (j.produced ? ' <a class="link small" href="#/review?job=' + j.id + '">Review</a>' : "");
      return '<tr><td class="mono small nowrap">' + new Date(j.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "</td><td>" + itemLevel(p) + " · " + esc((META.levels[itemLevel(p) - 1] || {}).title || "") + "</td><td>" + esc(topicLabel(p.topic)) + " <span class=\"muted small\">· " + (j.kind === "mcq" ? "MCQ" : "drill") + "</span></td><td>" + (p.diff ? diffBadge(p.diff) : "") + '</td><td class="small">' + esc(j.provider ? j.provider.split(",")[0] : provName(p.provider)) + '</td><td class="n">' + (j.status === "done" ? j.verified + " / " + j.produced : "–") + "</td><td>" + status + "</td></tr>";
    }).join("") + "</tbody></table>";
  }
  function loadJobs() {
    clearTimeout(pollTimer);
    api("/jobs").then(function (jobs) {
      var el = $("#jobs");
      if (!el) return;
      el.innerHTML = jobsTable(jobs);
      if (jobs.some(function (j) { return j.status === "running"; })) pollTimer = setTimeout(loadJobs, 1500);
      else refreshQueueCount();
    });
  }

  // --- review queue: generated drafts + built-in drills whose two reference answers disagree
  function refTable(r) {
    if (!r) return "";
    return '<div class="result-box"><table><thead><tr>' + r.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" +
      r.rows.map(function (row) { return "<tr>" + row.map(function (v) { return "<td>" + (v === null ? '<i class="muted">NULL</i>' : esc(v)) + "</td>"; }).join("") + "</tr>"; }).join("") +
      '</tbody></table></div><div class="kpi-note">' + plural(r.count, "row") + (r.count > r.rows.length ? ", first " + r.rows.length + " shown" : "") + "</div>";
  }
  function refSide(s, label) {
    var name = provName(s.provider) + (s.model ? ' <span class="muted small mono">' + esc(s.model) + "</span>" : "");
    var body = s.kind === "select" && s.changes != null ? (s.setup ? '<div class="muted small">Set up first (from an earlier exercise):</div><pre class="sol">' + esc(s.setup) + "</pre>" : "") + '<pre class="sol">' + esc(s.sql) + '</pre><p class="small"><b>Changes on MySQL:</b> ' + esc(s.changes || "nothing") + (s.free ? " · values are the learner's choice" : "") + "</p>"
      : s.kind === "select" ? '<pre class="sol">' + esc(s.sql) + "</pre>" + refTable(s.result)
      : s.kind === "not_a_query" ? '<p class="small">Says one SELECT can\'t answer it' + (s.why ? ": " + esc(s.why) : ".") + "</p>"
      : (s.sql ? '<pre class="sol">' + esc(s.sql) + "</pre>" : "") + '<p class="small bad-txt">' + esc(s.why || "no answer") + "</p>";
    return '<div class="pair-side"><div class="muted small">' + label + " · " + name + "</div>" + body + "</div>";
  }
  function historyHtml(h) {
    if (!h || !h.length) return "";
    var line = function (e) {
      var d = e.detail || {};
      if (e.step === "retry") return "<b>Retry</b> " + esc(provName(d.provider)) + ": " + esc(d.problem || "") + (d.after ? ' → <span class="mono">' + esc(String(d.after).slice(0, 160)) + "</span>" + (d.ok ? " (worked)" : " (still not usable)") : d.error ? " → " + esc(d.error) : "");
      if (e.step === "prompt_rewrite") return d.failed ? "<b>Prompt rewrite</b> failed: " + esc(d.failed) : "<b>Prompt rewritten</b> by " + esc(d.by) + ", kept " + String(d.keep).toUpperCase() + ' (columns <span class="mono">' + esc((d.columns || []).join(", ")) + "</span>)";
      if (e.step === "tiebreak") return "<b>Tie-breaker</b> " + esc(d.by) + ": " + (d.matches ? "matched " + d.matches.toUpperCase() : d.kind === "select" ? "a third, different answer" : esc(d.why || d.kind));
      if (e.step === "decision") return "<b>Decision</b> by admin: " + esc(d.choice);
      return esc(e.step);
    };
    return '<details class="ref-hist"><summary class="small">History · ' + h.length + (h.length === 1 ? " step" : " steps") + '</summary><ol class="small">' + h.map(function (e) { return "<li>" + line(e) + ' <span class="muted mono">' + new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + "</span></li>"; }).join("") + "</ol></details>";
  }
  // keyboard review: one current card. J/K move, S skips; reference cards: 1/2/3 tick A/B/C, Shift+A ticks every
  // solution that ran, Enter saves the choice, U leaves the drill unchecked; drafts: Y approve, R reject
  var qIndex = 0, qKeyHandler = null;
  function reviewKeys() {
    var cards = function () { return $$(".qcard"); };
    function focusCard(i, scroll) {
      var list = cards();
      if (!list.length) return;
      qIndex = Math.max(0, Math.min(list.length - 1, i));
      list.forEach(function (c, k) { c.classList.toggle("current", k === qIndex); c.setAttribute("aria-current", k === qIndex ? "true" : "false"); c.tabIndex = -1; });
      if (scroll !== false) list[qIndex].scrollIntoView({ block: "start", behavior: "smooth" });
      var pos = $("#qPos");
      if (pos) pos.textContent = (qIndex + 1) + " of " + list.length;
    }
    focusCard(qIndex, false);
    cards().forEach(function (c, k) { c.addEventListener("focusin", function () { if (qIndex !== k) focusCard(k, false); }); });
    if (qKeyHandler) document.removeEventListener("keydown", qKeyHandler);
    qKeyHandler = function (e) {
      if (route.name !== "review" || route.q.get("view") === "history" || e.ctrlKey || e.metaKey || e.altKey || $("#modal").open || ($("#confirmDlg") && $("#confirmDlg").open)) return;
      if (e.target.closest("input, textarea, select, [contenteditable], button, a, summary")) return;
      var key = e.key, card = cards()[qIndex];
      if (!card) return;
      var isRef = card.classList.contains("ref-card");
      var press = function (sel) { var b = card.querySelector(sel); if (b && !b.disabled) { e.preventDefault(); b.click(); return true; } return false; };
      if (key === "j" || key === "J") { e.preventDefault(); focusCard(qIndex + 1); }
      else if (key === "k" || key === "K") { e.preventDefault(); focusCard(qIndex - 1); }
      else if (key === "s" || key === "S") { e.preventDefault(); focusCard(qIndex + 1); toast("Skipped"); }
      else if (key === "1" || key === "2" || key === "3") {
        if (!isRef) return;
        var box = card.querySelector('[data-pick="' + "abc".charAt(Number(key) - 1) + '"]');
        e.preventDefault();
        if (!box) toast("There is no solution " + "ABC".charAt(Number(key) - 1) + " here");
        else if (box.disabled) toast("Solution " + "ABC".charAt(Number(key) - 1) + " failed, so it can't be accepted");
        else { box.checked = !box.checked; pickCount(card); }
      }
      else if (key === "A" && e.shiftKey) { if (isRef) press('[data-ref="all"]'); }
      else if (key === "Enter") { if (isRef) press('[data-ref="save"]'); }
      else if (key === "u" || key === "U") { if (isRef) press('[data-ref="none"]'); }
      else if (key === "y" || key === "Y") press('[data-act="approve"], [data-stage-act="approve"]');
      else if (key === "r" || key === "R") press('[data-act="reject"], [data-stage-act="reject"]');
    };
    document.addEventListener("keydown", qKeyHandler);
  }
  // the ticked solutions of a reference card: the count and the Save button follow them
  function pickCount(card) {
    var n = $$("[data-pick]:checked", card).length, out = card.querySelector(".pick-n"), save = card.querySelector('[data-ref="save"]');
    if (out) out.textContent = n ? plural(n, "accepted answer") : "Tick one or more solutions";
    if (save) save.disabled = !n;
  }
  // a drill the pipeline resolved on its own, for audit
  function resolvedCard(r) {
    var rewritten = r.prompt_rewritten ? '<div class="pair-body"><div class="pair-side"><div class="muted small">Original prompt</div><p class="small">' + esc(r.prompt_original) + '</p></div><div class="pair-side rew"><div class="muted small">Rewritten prompt (now shown to learners)</div><p class="small">' + esc(r.prompt_rewritten) + "</p></div></div>" : "";
    return '<section class="card qcard ref-card" data-item="' + esc(r.item_id) + '"><div class="qcard-h"><span class="tag">Reference answer</span><span class="tag plain">Level ' + r.level + '</span><span class="tag plain mono">' + esc(r.tables.join(", ") || r.dataset) + '</span><span class="grow"></span><span class="vbadge pass">' + icon("check") + esc(r.resolution || "matched") + "</span></div>" +
      '<div class="qq"><a href="#/item/' + esc(r.item_id) + '">' + esc(r.title) + "</a></div>" + rewritten +
      (r.accepted && r.accepted.length > 1 ? '<div class="small muted">' + r.accepted.length + " accepted answers now used to check learners (a learner is correct when they match any):</div>" + r.accepted.map(function (x) { return '<pre class="sol">' + esc(x.sql) + "</pre>"; }).join("") : '<div class="small muted">Reference now used to check learners:</div><pre class="sol">' + esc(r.sql) + "</pre>") + historyHtml(r.history) +
      '<div class="actions"><span class="grow"></span><button type="button" class="btn sm" data-ref="reopen">Send back to review</button></div></section>';
  }
  function bulkBar(fx) {
    var last = fx.last, html = '<div class="bulk-bar" id="bulkBar" aria-live="polite">';
    html += '<button type="button" class="btn sm ok" data-bulk="text" data-n="' + fx.text + '"' + (fx.text && !fx.running ? "" : " disabled") + ">" + icon("wand") + "Apply all text fixes (" + fx.text + ")</button>" +
      '<button type="button" class="btn sm ok" data-bulk="setup" data-n="' + fx.setup + '"' + (fx.setup && !fx.running ? "" : " disabled") + ">" + icon("server") + "Apply all setup fixes (" + fx.setup + ")</button>";
    if (fx.running && last) html += '<span class="small mono" id="bulkProg">' + esc(last.progress || "Running…") + "</span>";
    else if (last) {
      var shrink = last.queue_before != null && last.queue_after != null ? "queue " + last.queue_before + " → " + last.queue_after : "";
      html += '<span class="small">Last bulk run (' + (last.mode === "fix-text" ? "text" : "setup") + ' fixes, <span class="mono">' + fmtDate(last.finished_at || last.started_at, true) + "</span>): " +
        '<b class="mono">' + last.matched + "</b> matched and left the queue · <b class=\"mono\">" + last.review + "</b> still in review" + (last.not_query ? " · " + last.not_query + " not a query" : "") + (last.errors ? " · " + last.errors + " errors" : "") +
        (shrink ? ' · <b class="mono">' + shrink + "</b>" : "") + ' · <span class="mono">$' + last.cost.toFixed(2) + "</span></span>" +
        '<button type="button" class="btn sm" data-bulk="undo" data-batch="' + last.id + '">Undo this run</button>';
    }
    return html + '<span class="muted small"><a href="#/review?view=history">History</a> keeps every change with Undo.</span></div>';
  }
  var bulkTimer = null;
  function pollBulk() {
    clearTimeout(bulkTimer);
    bulkTimer = setTimeout(function () {
      if (route.name !== "review" || !$("#bulkBar")) return;
      api("/refs/fixes").then(function (fx) {
        if (fx.running) { var p = $("#bulkProg"); if (p) p.textContent = (fx.last && fx.last.progress) || "Running…"; else $("#bulkBar").outerHTML = bulkBar(fx); pollBulk(); }
        else { toast("Bulk run finished"); render(); }
      });
    }, 3000);
  }
  function fixBox(r) {
    var f = r.fix;
    if (!f || !f.fault) return "";
    if (f.status !== "open") return '<p class="small muted" style="margin:0">Suggested fix ' + esc(f.status) + (f.result ? " · the drill was re-run: " + esc(f.result) : "") + "</p>";
    return '<div class="fix-box" role="group" aria-label="Suggested fix"><div class="fix-h">' + icon("wand") + "<b>Suggested fix</b>" + '<span class="tag plain">' + (f.kind === "setup" ? "setup for this drill" : f.kind === "server" ? "MySQL server setting" : "drill text") + '</span><span class="muted small">by ' + esc(f.by || "") + "</span></div>" +
      '<p class="small" style="margin:0">' + esc(f.why) + "</p>" +
      (f.kind === "text" ? '<div class="pair-body"><div class="pair-side"><div class="muted small">Now</div><p class="small">' + esc(r.prompt_rewritten || r.body) + '</p></div><div class="pair-side rew"><div class="muted small">Suggested</div><p class="small">' + esc(f.new_prompt) + "</p></div></div>"
        : '<pre class="sol">' + esc(f.dataset_sql) + '</pre><p class="small muted" style="margin:0">' + (f.kind === "server" ? "This changes a setting of your MySQL server, so it can't be applied from here. Decide it outside the app; Ignore hides it." : "Runs on this drill's own MySQL copy before the learner's SQL (and before the reference). Other drills and the dataset aren't changed.") + "</p>") +
      '<div class="actions">' + (f.kind === "server" ? "" : '<button type="button" class="btn sm ok" data-fix="apply">Apply</button>') + '<button type="button" class="btn sm" data-fix="ignore">Ignore</button><span class="muted small">' + (f.kind === "server" ? "" : "Apply re-runs the drill through the pipeline with the fix in place.") + "</span></div></div>";
  }
  var STAGE_LABEL = { memorize: "Memorize", understand: "Understand", practise: "Practise", reflect: "Reflect", transfer: "Transfer" };
  function tagSide(p, label) {
    if (!p) return '<div class="pair-side"><div class="muted small">' + label + '</div><p class="small">no proposal</p></div>';
    return '<div class="pair-side"><div class="muted small">' + label + '</div><p class="small" style="margin:4px 0"><b>Stage:</b> ' + esc(STAGE_LABEL[p.stage] || p.stage || "—") + '</p><ul class="small tag-concepts">' + p.concepts.map(function (c) { return "<li>" + esc(c.name) + ' <span class="mono muted">' + esc(c.slug) + "</span></li>"; }).join("") + "</ul></div>";
  }
  function miniTable(r) {
    if (!r || !r.columns) return "";
    return '<div class="result-box"><table><thead><tr>' + r.columns.map(function (c) { return "<th>" + esc(c) + "</th>"; }).join("") + "</tr></thead><tbody>" + r.rows.slice(0, 8).map(function (row) { return "<tr>" + row.map(function (v) { return v === null ? '<td class="muted">NULL</td>' : "<td>" + esc(v) + "</td>"; }).join("") + "</tr>"; }).join("") + "</tbody></table></div>";
  }
  function adminOutcome(o) {
    if (!o) return "";
    if (o.kind === "rows") return miniTable(o.rows);
    return '<p class="small" style="margin:4px 0">' + (o.kind === "error" ? "<b>Statement " + o.failsAt + " fails:</b> " + esc(String(o.error).replace(/\b(?:sqlscratch_[a-z0-9_]+|es_[0-9a-f]{10})\./gi, "")) :"<b>No statement fails</b>") + "</p>";
  }
  // the extra card types and the upgrades (kind "card"): what the learner will see, with the real results
  var CARD_LABEL = { join_mapper: "Join mapper", compare_queries: "Compare two queries", syntax_upgrade: "Syntax builder upgrade", mcq_upgrade: "MCQ upgrade", result_set: "Result-set reasoning", join_compare: "Join comparison", find_difference: "Find the difference", exec_timeline: "Execution timeline", schema_detective: "Schema detective", sort_filter: "Sort and filter", query_optimizer: "Query optimizer" };
  function cardReviewHtml(d) {
    var tag = '<span class="tag plain">' + esc(CARD_LABEL[d.card_type] || d.card_type) + (!d.base_id ? " · optional practice, not part of mastery" : " · enriches " + esc(d.base_id || "")) + "</span>";
    var tbl = function (t) { return '<div class="pair-side"><div class="muted small mono">' + esc(t.name) + "</div>" + miniTable({ columns: t.columns, rows: t.rows }) + "</div>"; };
    if (d.card_type === "join_mapper") return '<div class="qq">' + esc(d.question) + " " + tag + '</div><div class="pair-body">' + tbl(d.left) + tbl(d.right) + '</div><p class="small"><b>Answer:</b> <span class="mono">' + esc(d.key.left) + " = " + esc(d.key.right) + "</span> · <b>" + esc(d.join_type) + ' JOIN</b></p><div class="small muted">Real result</div>' + miniTable(d.result) + (d.why ? '<p class="small">' + esc(d.why) + "</p>" : "");
    if (d.card_type === "compare_queries") return '<div class="qq">' + esc(d.question) + " " + tag + '</div><div class="pair-body">' + d.tables.map(tbl).join("") + '</div><div class="pair-body"><div class="pair-side"><div class="muted small">Query A · real result</div><pre class="sol">' + esc(d.query_a) + "</pre>" + miniTable(d.result_a) + '</div><div class="pair-side"><div class="muted small">Query B · real result</div><pre class="sol">' + esc(d.query_b) + "</pre>" + miniTable(d.result_b) + "</div></div>" + (d.why ? '<p class="small">' + esc(d.why) + "</p>" : "");
    if (d.card_type === "syntax_upgrade") return '<div class="qq">' + esc(d.base_prompt || "") + " " + tag + '</div><pre class="sol">' + esc(d.base_sql || "") + '</pre><p class="small"><b>Answer:</b> <span class="mono">' + esc(d.base_answer || "") + "</span>" + (d.accepted && d.accepted.length ? " · <b>Also accepted</b> (same real result): " + d.accepted.map(function (a) { return '<span class="mono">' + esc(a) + "</span>"; }).join(", ") : "") + '</p><p class="small"><b>Explanation:</b> ' + esc(d.explanation || "") + "</p>";
    if (d.card_type === "mcq_upgrade") return '<div class="qq">' + esc(d.base_q || "") + " " + tag + '</div><ol class="small" type="A">' + (d.base_options || []).map(function (o, i) { return "<li>" + esc(o) + (i === d.base_answer ? " <b>(right)</b>" : '<br><span class="muted">Why not: ' + esc((d.why_wrong || [])[i] || "") + "</span>") + "</li>"; }).join("") + "</ol>";
    var why = d.why ? '<p class="small">' + esc(d.why) + "</p>" : "", ids = function (a) { return '<span class="mono">' + esc((a || []).join(", ") || "none") + "</span>"; };
    if (d.card_type === "result_set") return '<div class="qq">' + esc(d.question || "Which rows does it return?") + " " + tag + '</div><pre class="sol">' + esc(d.query) + "</pre>" + tbl(d.table) + '<p class="small"><b>Answer (rows by ' + esc(d.table.columns[0]) + "):</b> " + ids(d.answer_ids) + '</p><div class="small muted">Real result</div>' + miniTable(d.result) + why;
    if (d.card_type === "join_compare") return '<div class="qq">' + esc(d.question || "") + " " + tag + '</div><div class="pair-body">' + tbl(d.left) + tbl(d.right) + '</div><p class="small">' + esc(d.pair[0]) + " vs " + esc(d.pair[1]) + " JOIN on <span class=\"mono\">" + esc(d.key.left) + " = " + esc(d.key.right) + "</span> · <b>Answer (" + esc(d.side) + " rows):</b> " + ids(d.answer_ids) + "</p>" +
      ["INNER", "LEFT", "RIGHT", "FULL"].map(function (j) { return '<div class="small muted">' + j + " JOIN · real result</div>" + miniTable(d.results_by_type[j]); }).join("") + why;
    if (d.card_type === "find_difference") return '<div class="qq">' + esc(d.question || "") + " " + tag + '</div><div class="pair-body"><div class="pair-side"><div class="muted small">Query A</div><pre class="sol">' + esc(d.query_a) + '</pre>' + miniTable(d.result_a) + '</div><div class="pair-side"><div class="muted small">Query B</div><pre class="sol">' + esc(d.query_b) + "</pre>" + miniTable(d.result_b) + "</div></div>" + tbl(d.table) + '<p class="small"><b>Answer (rows in only one):</b> ' + ids(d.answer_ids) + "</p>" + why;
    if (d.card_type === "exec_timeline") return '<div class="qq">' + esc(d.question || "") + " " + tag + '</div><pre class="sol">' + esc(d.script) + '</pre><p class="small"><b>Asked:</b> the table after statement ' + esc(d.ask_step) + " · checked with <span class=\"mono\">" + esc(d.check_sql) + "</span></p>" +
      d.snapshots.map(function (s, k) { return '<div class="small muted">After ' + (k + 1) + ": <span class=\"mono\">" + esc(s.statement) + "</span>" + (k + 1 === d.ask_step ? " <b>(answer)</b>" : "") + "</div>" + miniTable(s); }).join("") + why;
    if (d.card_type === "schema_detective") return '<div class="qq">' + esc(d.question || "Which column is the key?") + " " + tag + "</div>" + tbl(d.table) + '<div class="small muted">Real counts</div>' + miniTable({ columns: ["column", "rows", "distinct", "NULLs"], rows: d.stats.map(function (x) { return [x.column, x.rows, x.distinct, x.nulls]; }) }) + '<p class="small"><b>Answer:</b> <span class="mono">' + esc(d.key) + "</span> · choices: " + esc(d.candidates.join(", ")) + "</p>" + why;
    if (d.card_type === "sort_filter") return '<div class="qq">' + esc(d.question) + " " + tag + "</div>" + tbl(d.table) +
      '<p class="small"><b>Conditions</b> (right ones marked):</p><ul class="small mono">' + d.filters.map(function (f, i) { return "<li>" + esc(f) + (d.answer.filters.indexOf(i) > -1 ? " <b>(right)</b>" : "") + "</li>"; }).join("") + "</ul>" +
      '<p class="small"><b>Order by</b>:</p><ul class="small mono">' + d.sorts.map(function (x, i) { return "<li>" + esc(x) + (i === d.answer.sort ? " <b>(right)</b>" : "") + "</li>"; }).join("") + "</ul>" +
      '<div class="small muted">Right query · real result (SQLite)</div><pre class="sol">' + esc("SELECT " + d.select + " FROM " + d.from + " WHERE " + d.answer.filters.map(function (i) { return d.filters[i]; }).join(" AND ") + " ORDER BY " + d.sorts[d.answer.sort]) + "</pre>" + miniTable(d.result) + why;
    if (d.card_type === "query_optimizer") return '<div class="qq">' + esc(d.question) + " " + tag + ' <span class="tag plain">' + (d.helps ? "index used" : "index not used") + '</span></div><pre class="sol">' + esc([d.schema, d.index, d.query].join(";\n") + ";") + "</pre>" +
      '<p class="small"><b>Real plan without the index:</b> <span class="mono">' + esc(d.plan_before.join(" / ")) + '</span><br><b>With the index (the answer):</b> <span class="mono">' + esc(d.plan_after.join(" / ")) + "</span></p>" + why;
    return '<pre class="sol">' + esc(JSON.stringify(d, null, 1)) + "</pre>";
  }
  function stageCard(s) {
    var d = s.data, body;
    if (s.kind === "predict" && d.variant === "endstate") body = '<div class="qq">' + esc(d.question) + ' <span class="tag plain">Predict the end state · ' + esc(d.engine || "MySQL") + '</span></div><div class="small muted">Script (' + (d.mode === "error" ? "the learner predicts which statement fails" : "the learner predicts the final rows") + ')</div><pre class="sol">' + esc(d.script) + "</pre>" + (d.check_sql && d.mode !== "error" ?'<div class="small muted">Then</div><pre class="sol">' + esc(d.check_sql) + "</pre>" : "") +
      '<div class="pair-body"><div class="pair-side rew"><div class="muted small">Answer (real outcome)</div>' + adminOutcome(d.answer) + "</div>" + (d.distractors || []).map(function (x, k) { return '<div class="pair-side"><div class="muted small">Wrong choice ' + (k + 1) + " (a real run)</div>" + adminOutcome(x) + "</div>"; }).join("") + "</div>";
    else if (s.kind === "card") body = cardReviewHtml(d);
    else if (s.kind === "lesson") { var ex = d.example || {}; body = '<div class="qq">' + esc(d.title) + ' <span class="tag plain">Lesson · Study step</span> <span class="tag ' + (d.origin === "source" ? "ok" : "plain") + '">' + (d.origin === "source" ? "Based on the reference notes" : "Generated: not in the reference notes") + '</span></div><div class="small muted">What it is</div><p class="small" style="margin:2px 0 8px">' + esc(d.what) + '</p><div class="small muted">When to use it</div><ul class="small" style="margin:2px 0 8px">' + (d.when || []).map(function (w) { return "<li>" + esc(w) + "</li>"; }).join("") + '</ul><div class="small muted">Example' + (ex.format ? " · " + esc({ error: "script with error", beforeafter: "before / after", twice: "run it twice", notrun: "not run here (" + (ex.notRun || "") + ")" }[ex.format] || ex.format) : "") + (ex.engine ? " (" + esc(ex.engine) + ", real)" : "") + '</div>' + (ex.setup ? '<pre class="sol">' + esc(ex.setup) + "</pre>" : "") + (ex.sql ? '<pre class="sol">' + esc(ex.sql) + "</pre>" : "") + (ex.columns ? miniTable({ columns: ex.columns, rows: ex.rows }) : "") + (ex.error ? '<p class="small"><b>Statement ' + ex.error.failsAt + " fails:</b> " + esc(ex.error.message) + "</p>" : "") + (ex.before ? '<div class="pair-body"><div class="pair-side"><div class="muted small">' + esc(ex.before.label) + "</div>" + (ex.before.sql ? '<pre class="sol">' + esc(ex.before.sql) + "</pre>" : "") + miniTable(ex.before) + '</div><div class="pair-side rew"><div class="muted small">' + esc(ex.after.label) + "</div>" + (ex.after.sql ? '<pre class="sol">' + esc(ex.after.sql) + "</pre>" : "") + miniTable(ex.after) + "</div></div>" : "") + '<p class="small" style="margin:6px 0">' + esc(d.explain || "") + '</p><p class="small"><b>Watch out:</b> ' + esc(d.tip || "") + "</p>"; }
    else if (s.kind === "predict") body = '<div class="qq">' + esc(d.question) + '</div>' + (d.shows && d.shows.length ? d.shows.map(function (x) { return '<div class="small muted">Input: <b class="mono">' + esc(x.table) + "</b> · WHERE " + esc(x.where) + "</div>" + miniTable(x); }).join("") : '<div class="small muted">Input rows</div>' + miniTable(d.show)) + '<pre class="sol">' + esc(d.sql) + '</pre><div class="pair-body"><div class="pair-side rew"><div class="muted small">Answer (real output)</div>' + miniTable(d.answer) + "</div>" + (d.distractors || []).map(function (x, k) { return '<div class="pair-side"><div class="muted small">Wrong choice ' + (k + 1) + " (a mistaken query's real output)</div>" + miniTable(x) + "</div>"; }).join("") + "</div>";
    else if (d.type === "keyword") body = '<div class="qq">' + esc(d.front) + '</div><div class="qwhy">' + esc(d.back) + "</div>";
    else if (d.type === "blank") body = '<div class="qq">' + esc(d.prompt || "Fill in the blank") + '</div><pre class="sol">' + esc(d.sql) + '</pre><div class="small"><b>Answer:</b> <span class="mono">' + esc(d.answer) + "</span></div>";
    else if (d.type === "order") body = '<div class="qq">' + esc(d.prompt || "Put the clauses in order") + '</div><ol class="small mono">' + d.parts.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>";
    else body = '<div class="qq">' + esc(d.prompt || "Spot the error") + '</div><pre class="sol">' + esc(d.wrong_sql) + '</pre><div class="small muted">Fixed</div><pre class="sol">' + esc(d.fixed_sql) + '</pre><div class="qwhy">' + esc(d.explanation) + "</div>";
    var kindLabel = s.kind === "predict" ? "Predict the output" : "Flashcard · " + ({ keyword: "keyword", blank: "fill in the blank", order: "clause order", error: "spot the error" }[d.type] || d.type);
    return '<section class="card qcard" data-stageid="' + esc(s.id) + '" data-cat="draft" data-level="' + s.level + '" data-type="' + s.kind + '"><div class="qcard-h">' + selBox(s.id, "stage", kindLabel) + '<span class="tag">' + esc(kindLabel) + '</span>' + (s.source === "mine" ? '<span class="tag plain">Mine</span>' : "") + '<span class="tag plain">Level ' + s.level + '</span><span class="tag plain">' + esc(s.conceptName) + '</span><span class="tag plain">' + (s.kind === "predict" ? "Understand" : "Memorize") + '</span><span class="grow"></span>' + rwBadge(s.verify) + vbadge(s.verify) + "</div>" + unblocksHtml(s.id) + body + rwBefore(s.verify) +
      "<details><summary class=\"qmeta\">Verification · " + esc((d.engine || "no SQL")) + " · " + esc(d.site || "") + "</summary>" + checksList(s.verify) + "</details>" +
      '<div class="actions"><button type="button" class="btn ok sm" data-stage-act="approve">' + icon("check") + 'Approve</button><span class="grow"></span><button type="button" class="btn sm danger" data-stage-act="reject">Reject</button></div></section>';
  }
  var TAG_STAGE_OPTS = { item: ["practise", "transfer", "reflect"], mcq: ["memorize", "understand"] };
  var STAGE_NAME = { memorize: "Memorize", understand: "Understand", practise: "Practise", reflect: "Reflect", transfer: "Transfer" };
  function stagePicker(key, kind, current, label) {
    var id = "st-" + key.replace(/[^a-z0-9]/gi, "");
    return '<label class="stage-pick-one" for="' + id + '"><span class="' + (label ? "" : "sr-only") + '">' + (label || "Stage of this item") + '</span><select class="inp" id="' + id + '" data-tagstage="' + esc(key) + '">' +
      (TAG_STAGE_OPTS[kind] || []).map(function (st) { return '<option value="' + st + '"' + (st === current ? " selected" : "") + ">" + STAGE_NAME[st] + "</option>"; }).join("") + "</select></label>";
  }
  function setTagStage(sel, then) {
    var key = sel.getAttribute("data-tagstage"), stage = sel.value;
    sel.disabled = true;
    api("/tags/" + encodeURIComponent(key) + "/stage", "POST", { stage: stage }).then(function (r) {
      sel.disabled = false;
      toast(r.unchanged ? "No change" : "Stage set: " + STAGE_NAME[r.was] + " → " + STAGE_NAME[r.stage] + " (undo in Review → History)");
      if (then) then(r);
    }).catch(function (er) { sel.disabled = false; toast(er.message); });
  }
  function tagCard(t) {
    return '<section class="card qcard tag-card" data-tagkey="' + esc(t.key) + '" data-cat="tag" data-level="' + t.level + '" data-type="tag"><div class="qcard-h">' + selBox(t.key, "tag", t.title) + '<span class="tag">Tag</span><span class="tag plain">' + (t.kind === "mcq" ? "MCQ" : "Exercise") + '</span><span class="tag plain">Level ' + t.level + '</span><span class="grow"></span><span class="vbadge warn">' + icon("warn") + "Uncertain</span></div>" +
      '<div class="qq">' + esc(t.title) + "</div>" + (t.task ? '<div class="qwhy">' + esc(t.task.slice(0, 400)) + "</div>" : "") + (t.sql ? '<pre class="sol">' + esc(t.sql) + "</pre>" : "") +
      '<p class="small" style="margin:0"><b>Why it is here:</b> ' + esc(t.why) + "</p>" +
      '<div class="pair-body">' + tagSide(t.a, "A · proposed (Claude)") + tagSide(t.b, "B · reviewer (OpenAI)") + "</div>" +
      '<div class="actions"><button type="button" class="btn sm ok" data-tag="a">Use A</button><button type="button" class="btn sm ok" data-tag="b"' + (t.b && t.b.concepts.length ? "" : " disabled") + ">Use B</button><span class=\"grow\"></span>" + stagePicker(t.key, t.kind, t.stage, "Or set only its stage") + "</div></section>";
  }
  var REASON = { tag: "Uncertain tag", disagree: "Answers disagree", date: "Depends on the date", setup: "Needs a starting state", textfix: "Drill text fix", draft: "Generated draft", rewritten: "Rewritten by AI", manual: "Needs manual check" };
  // "Needs manual check": drafts a person should look at before approving (an item can be in several groups)
  var MANUAL = [["warn", "With warnings"], ["deepseek", "Generated by DeepSeek"], ["typed", "Typed answer only"], ["rewritten", "Rewritten by AI"], ["rewritten-ok", "Rewritten — re-checked OK"], ["blocks", "Blocks coverage"]];
  // drafts a concept still needs after a bulk Approve (GET /learning/blockers): id -> [{ slug, name, level, stage }]
  var BLOCK = {};
  function unblocksHtml(id) {
    var b = BLOCK[id];
    if (!b || !b.length) return "";
    return '<p class="unblocks small">' + icon("levels") + "<span><b>Blocks coverage.</b> Approving it unblocks " + b.map(function (x) { return '<a href="#/concepts?level=' + x.level + '">' + esc(x.name) + "</a> (L" + x.level + ", " + x.stage + ")"; }).join(", ") + "</span></p>";
  }
  function manualGroups(x) {
    var v = x.verify || {}, checks = v.checks || [], g = [];
    if (v.status && v.status !== "pass") g.push("warn");
    if (checks.some(function (c) { return /generated by DeepSeek/i.test(c.label || ""); })) g.push("deepseek");
    if (x.kind === "predict" && checks.some(function (c) { return /Wrong choices/.test(c.label || "") && !c.ok; })) g.push("typed");
    if (v.rewritten) g.push("rewritten");
    // rewritten, then every check run again (SQL, rows shown, DeepSeek review) and all passed, with no warning
    if (v.rewritten && v.status === "pass" && v.recheck && v.recheck.ok) g.push("rewritten-ok");
    if (BLOCK[x.id]) g.push("blocks");
    return g;
  }
  var usableSide = function (s) { return !!(s && s.sql && s.kind === "select" && (s.changes != null || (s.result && s.result.count > 0))); };
  function selBox(id, type, title) {
    return '<label class="sel"><input type="checkbox" data-sel="' + esc(id) + '" data-type="' + type + '"><span class="sr-only">Select ' + esc(title) + "</span></label>";
  }
  function refCard(r) {
    var sides = [["a", r.a, "A"], ["b", r.b, "B"], ["c", r.c, "C"]].filter(function (x) { return x[1]; });
    var pick = '<fieldset class="pick"><legend class="sr-only">Accepted answers for ' + esc(r.title) + "</legend>" +
      sides.map(function (x) {
        var ok = usableSide(x[1]);
        return '<label class="pick-opt' + (ok ? "" : " off") + '"' + (ok ? "" : ' title="Solution ' + x[2] + ': ' + esc(x[1].why || x[1].error || (x[1].result && !x[1].result.count ? "returns no rows" : "no usable answer")) + '"') + '><input type="checkbox" data-pick="' + x[0] + '"' + (ok ? "" : " disabled") + ">Use " + x[2] + (ok ? "" : ' <span class="small">(' + (x[1].result && x[1].kind === "select" && !x[1].result.count ? "no rows" : "failed") + ")</span>") + "</label>";
      }).join("") +
      '<button type="button" class="btn sm" data-ref="all"' + (sides.some(function (x) { return usableSide(x[1]); }) ? "" : " disabled") + ">Use all</button>" +
      '<button type="button" class="btn sm ok" data-ref="save" disabled>Save choice</button><span class="pick-n small" aria-live="polite">Tick one or more solutions</span></fieldset>';
    return '<section class="card qcard ref-card" data-item="' + esc(r.item_id) + '" data-cat="' + esc(r.category || "disagree") + '" data-level="' + r.level + '" data-type="drill"><div class="qcard-h">' + selBox(r.item_id, "ref", r.title) + '<span class="tag">Reference answer</span><span class="tag plain">Level ' + r.level + '</span><span class="tag plain">' + esc(REASON[r.category] || "Answers disagree") + '</span><span class="tag plain mono">' + esc(r.tables.join(", ") || r.dataset) + '</span><span class="grow"></span><span class="vbadge warn">' + icon("warn") + "Needs review</span></div>" +
      '<div class="qq"><a href="#/item/' + esc(r.item_id) + '">' + esc(r.title) + '</a></div><div class="qwhy">' + esc(r.body) + "</div>" +
      '<p class="small" style="margin:0"><b>Why it is here:</b> ' + esc(r.reason) + ((r.a && r.a.changes !== undefined) || (r.b && r.b.changes !== undefined) ? " · write drill: each answer ran on a scratch MySQL copy and the end states were compared" : r.ordered ? " · the exercise asks for an order, so row order counts" : " · row order is ignored") + "</p>" + fixBox(r) +
      '<div class="pair-body' + (r.c ? " three" : "") + '">' + sides.map(function (x) { return refSide(x[1], x[2] + (x[0] === "c" ? " · tie-breaker" : "")).replace('class="pair-side"', 'class="pair-side' + (usableSide(x[1]) ? "" : " failed") + '"'); }).join("") + "</div>" + historyHtml(r.history) +
      '<details class="own-sql"><summary class="small">Write the reference yourself</summary><label class="sr-only" for="own-' + esc(r.item_id) + '">Your reference SQL</label><textarea class="inp mono" rows="3" id="own-' + esc(r.item_id) + '" placeholder="SELECT …">' + esc(((sides.filter(function (x) { return usableSide(x[1]); })[0] || [0, {}])[1].sql) || "") + '</textarea><button type="button" class="btn sm" data-ref="own">Run and use this SQL</button></details>' +
      '<div class="actions">' + pick + '<span class="grow"></span><button type="button" class="btn sm" data-ref="none">Leave unchecked (self-check)</button></div></section>';
  }
  // while a bulk action or an Undo is running, every bulk control is disabled (the server refuses a second one too)
  var bulkBusy = false;
  function paintBusy() {
    $$("[data-bulkact], [data-bulk], #selAll, #selHidden, #inclRw, [data-act='approve-pass']").forEach(function (b) { if (bulkBusy) b.disabled = true; });
    var bar = $(".sel-bar");
    if (bar) bar.setAttribute("aria-busy", bulkBusy ? "true" : "false");
    var st = $("#bulkState");
    if (st) st.textContent = bulkBusy ? "Working… the bulk buttons come back when it is done." : "";
  }
  function setBusy(on) { bulkBusy = on; paintBusy(); }
  var lastBulk = null; // the result of the latest bulk action, shown at the top until the next one
  var BULK_ACTIONS = [["approve", "Approve"], ["use-a", "Use A"], ["use-b", "Use B"], ["use-c", "Use C"], ["use-all", "Use all"], ["fix", "Apply suggested fix"], ["self", "Leave unchecked (self-check)"], ["reject", "Reject"]];
  function viewReview() {
    var job = route.q.get("job");
    if (route.q.get("view") === "history") return viewRefHistory();
    Promise.all([api("/queue"), api("/refs/review"), api("/refs/fixes"), api("/tags/review").catch(function () { return []; }), api("/stage/queue").catch(function () { return []; }), api("/learning/blockers").catch(function () { return { items: {}, concepts: [] }; })]).then(function (r) {
      BLOCK = (r[5] && r[5].items) || {};
      var items = r[0], refsList = job ? [] : r[1], fx = r[2], tagList = job ? [] : r[3], stageList = job ? [] : r[4];
      refreshCounts();
      if (job) items = items.filter(function (i) { return i.job_id === job; });
      // filters (kept in the address): reason, level, type
      var fr = route.q.get("reason") || "all", fl = route.q.get("level") || "all", ft = route.q.get("type") || "all";
      var levelsHere = {};
      items.forEach(function (i) { levelsHere[itemLevel(i.data)] = 1; });
      refsList.forEach(function (x) { levelsHere[x.level] = 1; });
      tagList.forEach(function (x) { levelsHere[x.level] = 1; });
      stageList.forEach(function (x) { levelsHere[x.level] = 1; });
      var keep = function (cat, level, type) { return (fr === "all" || fr === cat) && (fl === "all" || String(level) === fl) && (ft === "all" || ft === type); };
      var allItems = items, allRefs = refsList, allTags = tagList;
      tagList = tagList.filter(function (x) { return keep("tag", x.level, "tag"); });
      var allStage = stageList;
      // "Rewritten" is a reason of its own: drafts an AI rewrote during a repair round
      var fg = route.q.get("group") || "";
      var catOf = function (x) {
        if (fr === "manual") { var g = manualGroups(x); return (fg ? g.indexOf(fg) > -1 : g.length) ? "manual" : "draft"; }
        return fr === "rewritten" && x.verify && x.verify.rewritten ? "rewritten" : "draft";
      };
      stageList = stageList.filter(function (x) { return keep(catOf(x), x.level, x.kind); });
      items = items.filter(function (i) { return keep(catOf(i), itemLevel(i.data), i.kind === "mcq" ? "mcq" : "draft"); });
      refsList = refsList.filter(function (x) { return keep(x.category || "disagree", x.level, "drill"); });
      // Large imports can put tens of thousands of drafts in the queue. Keep all
      // filtered data for counts and actions, but only put one page into the DOM.
      var draftPageSize = 100;
      var draftPage = Math.max(0, Number(route.q.get("page")) || 0);
      var draftPages = Math.max(1, Math.ceil(items.length / draftPageSize));
      draftPage = Math.min(draftPages - 1, draftPage);
      var pageItems = items.slice(draftPage * draftPageSize, (draftPage + 1) * draftPageSize);
      var passing = pageItems.filter(function (i) { return i.verify && i.verify.status === "pass"; });
      var total = allItems.length + allRefs.length + allTags.length + allStage.length, shown = items.length + refsList.length + tagList.length + stageList.length;
      var draftPager = "";
      if (draftPages > 1) {
        var pageLink = function (n, label, aria) {
          var q = new URLSearchParams(route.q);
          if (n) q.set("page", String(n)); else q.delete("page");
          return '<a class="btn sm" href="#/review' + (q.toString() ? "?" + q : "") + '" aria-label="' + aria + '">' + label + "</a>";
        };
        draftPager = '<div class="pager-row"><span class="mono">' + (draftPage * draftPageSize + 1) + "–" + Math.min(items.length, (draftPage + 1) * draftPageSize) + ' of ' + items.length.toLocaleString() + ' drafts</span><span class="grow"></span>' +
          (draftPage ? pageLink(draftPage - 1, icon("chevLeft"), "Previous draft page") : "") +
          (draftPage < draftPages - 1 ? pageLink(draftPage + 1, icon("chevRight"), "Next draft page") : "") + "</div>";
      }
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Review queue</div><h2 class="h1">' + plural(total, "item") + " to review</h2><p>" + (job ? 'From one generation run. <a href="#/review">Show everything</a>' : plural(allItems.length, "generated draft") + " · " + plural(allRefs.length, "reference answer") + " where the providers disagree · " + plural(allTags.length, "uncertain tag") + " · " + plural(allStage.length, "new flashcard or predict item", "new flashcard or predict items") + ".") + "</p></div></div>";
      if (lastBulk) html += bulkResultHtml(lastBulk);
      var opt = function (v, label, cur) { return '<option value="' + v + '"' + (cur === v ? " selected" : "") + ">" + label + "</option>"; };
      html += '<div class="q-filters" role="group" aria-label="Filter the queue">' +
        '<label>Reason <select class="inp" data-qf="reason">' + opt("all", "All reasons", fr) + Object.keys(REASON).map(function (k) { return opt(k, REASON[k], fr); }).join("") + "</select></label>" +
        '<label>Level <select class="inp" data-qf="level">' + opt("all", "All levels", fl) + Object.keys(levelsHere).sort(function (a, b) { return a - b; }).map(function (n) { return opt(String(n), "Level " + n, fl); }).join("") + "</select></label>" +
        '<label>Type <select class="inp" data-qf="type">' + opt("all", "All types", ft) + opt("drill", "Built-in drill", ft) + opt("mcq", "MCQ draft", ft) + opt("draft", "Drill draft", ft) + opt("tag", "Tag", ft) + opt("flashcard", "Flashcard", ft) + opt("predict", "Predict the output", ft) + opt("lesson", "Lesson", ft) + opt("card", "Card (new types / upgrades)", ft) + "</select></label>" +
        '<span class="muted small" aria-live="polite">' + (shown === total ? "Showing all " + total : "Showing " + shown + " of " + total) + "</span></div>";
      if (fr === "manual") {
        var pool = allStage.concat(allItems), cnt = {}, any = 0;
        pool.forEach(function (x) { var g = manualGroups(x); if (g.length) any++; g.forEach(function (k) { cnt[k] = (cnt[k] || 0) + 1; }); });
        var link = function (k, label, n) { return '<a class="seg' + (fg === k ? " on" : "") + '" href="#/review?reason=manual' + (k ? "&group=" + k : "") + '"' + (fg === k ? ' aria-current="true"' : "") + ">" + label + ' <b class="mono">' + n + "</b></a>"; };
        html += '<div class="manual-groups" role="group" aria-label="Needs manual check: groups"><span class="muted small">' + plural(any, "draft") + " need a manual check (an item can be in several groups):</span><div class=\"segs\">" + link("", "All", any) + MANUAL.map(function (m) { return link(m[0], m[1], cnt[m[0]] || 0); }).join("") + "</div></div>";
      }
      if (shown) {
        html += '<div class="kbd-bar" role="status" aria-live="polite"><span class="mono" id="qPos">1 of ' + shown + '</span><span class="muted small">Keys: <kbd>J</kbd>/<kbd>K</kbd> next / previous · <kbd>S</kbd> skip · reference answers: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> tick A / B / C, <kbd>Shift</kbd>+<kbd>A</kbd> use all, <kbd>Enter</kbd> save, <kbd>U</kbd> leave unchecked · drafts: <kbd>Y</kbd> approve, <kbd>R</kbd> reject</span></div>';
        html += '<div class="sel-bar" role="group" aria-label="Selected items"><label class="sel-all"><input type="checkbox" id="selAll"> Select all on this page</label>' + (stageList.length > 120 ? '<label class="sel-all"><input type="checkbox" id="selHidden"> Also the ' + (stageList.length - 120) + " flashcard / predict items not shown</label>" : "") + '<label class="sel-all"><input type="checkbox" id="inclRw"> Include rewritten items</label><span class="small muted" id="bulkState" role="status"></span><span class="mono small" id="selN" aria-live="polite">0 selected</span><span class="sel-acts">' +
          BULK_ACTIONS.map(function (a) { return '<button type="button" class="btn sm' + (a[0] === "reject" ? " danger" : "") + '" data-bulkact="' + a[0] + '" disabled>' + a[1] + "</button>"; }).join("") + "</span></div>";
      }
      html += '<h3 class="q-sec">Generated drafts <span class="mono muted">' + items.length + "</span></h3>";
      if (items.length) html += '<div class="actions"><button class="btn ok" data-act="approve-pass"' + (passing.length ? "" : " disabled") + ">" + icon("check") + "Approve all " + passing.length + " verified on this page</button><span class=\"muted small\">Drafts with warnings or failed checks need a look first.</span></div>";
      html += items.length ? pageItems.map(itemCard).join("") + draftPager : '<div class="card empty">' + icon("inbox") + "<div>" + (allItems.length ? "No drafts match these filters." : 'No drafts waiting. <a href="#/generate">Generate some content</a>.') + "</div></div>";
      if (!job) {
        html += '<h3 class="q-sec">Reference answers to check <span class="mono muted">' + refsList.length + '</span></h3><p class="muted small" style="margin:-6px 0 4px">Built-in drills where the pipeline couldn\'t settle on one answer. Tick every solution that is right (a learner is correct when they match any of them) and save, write your own, or leave the drill unchecked (it becomes a self-check). <a href="#/review?view=history">History</a></p>';
        html += bulkBar(fx);
        html += refsList.length ? refsList.map(refCard).join("") : '<div class="card empty">' + icon("check") + "<div>" + (allRefs.length ? "No reference answers match these filters." : "No reference answers waiting.") + "</div></div>";
      }
      if (!job && (allStage.length || ft === "flashcard" || ft === "predict" || ft === "lesson" || ft === "card")) {
        html += '<h3 class="q-sec">New flashcards, predict-the-output and lessons <span class="mono muted">' + stageList.length + '</span></h3><p class="muted small" style="margin:-6px 0 4px">Generated for the learning model (memorize / understand). Every SQL was run; the answers and wrong choices are real outputs. Approve to publish.</p>';
        html += stageList.slice(0, 120).map(stageCard).join("") + (stageList.length > 120 ? '<p class="muted small">Showing the first 120 of ' + stageList.length + ': filter by level to see the rest, or select and bulk-approve.</p>' : "");
      }
      if (!job && (allTags.length || ft === "tag" || fr === "tag")) {
        html += '<h3 class="q-sec">Tags to check <span class="mono muted">' + tagList.length + '</span></h3><p class="muted small" style="margin:-6px 0 4px">Exercises and MCQs where the two providers disagreed on the concepts or the learning stage. Pick the better proposal (a stage fixed by a rule stays).</p>';
        html += tagList.length ? tagList.map(tagCard).join("") : '<div class="card empty">' + icon("check") + "<div>" + (allTags.length ? "No tags match these filters." : "No uncertain tags.") + "</div></div>";
      }
      html += "</div></div>";
      view.innerHTML = html;
      reviewKeys();
      paintBusy();
      if (fx.running) pollBulk();
      // stage items past the first 120 aren't rendered; "Also the ... not shown" adds them to the selection
      var verifyOf = {};
      var rewrittenOf = {};
      allStage.concat(allItems).forEach(function (x) { verifyOf[x.id] = x.verify && x.verify.status; rewrittenOf[x.id] = !!(x.verify && x.verify.rewritten && !(x.verify.recheck && x.verify.recheck.ok)); });
      var hiddenStage = stageList.slice(120).map(function (s) { return { id: s.id, type: "stage" }; });
      var selected = function () { return $$("[data-sel]:checked").map(function (b) { return { id: b.getAttribute("data-sel"), type: b.getAttribute("data-type") }; }).concat($("#selHidden") && $("#selHidden").checked ? hiddenStage : []); };
      var selSync = function () {
        var n = selected().length, all = $$("[data-sel]"), onPage = $$("[data-sel]:checked").length;
        if ($("#selN")) $("#selN").textContent = n + " selected";
        if ($("#selAll")) { $("#selAll").checked = !!all.length && onPage === all.length; $("#selAll").indeterminate = onPage > 0 && onPage < all.length; }
        $$("[data-bulkact]").forEach(function (b) { b.disabled = !n || bulkBusy; });
      };
      view.onchange = function (e) {
        var qf = e.target.closest("[data-qf]");
        if (qf) { var q = new URLSearchParams(route.q); q.set(qf.getAttribute("data-qf"), qf.value); q.delete("page"); if (qf.value === "all") q.delete(qf.getAttribute("data-qf")); location.hash = "#/review" + (q.toString() ? "?" + q : ""); return; }
        if (e.target.id === "selAll") { $$("[data-sel]").forEach(function (b) { b.checked = e.target.checked; }); selSync(); return; }
        if (e.target.matches("[data-sel]") || e.target.id === "selHidden") { selSync(); return; }
        if (e.target.matches("[data-tagstage]")) { setTagStage(e.target); return; }
        if (e.target.matches("[data-pick]")) pickCount(e.target.closest(".ref-card"));
      };
      view.onclick = function (e) {
        var ba = e.target.closest("[data-bulkact]");
        if (ba) {
          var act = ba.getAttribute("data-bulkact"), sel = selected(), label = ba.textContent;
          var refsN = sel.filter(function (x) { return x.type === "ref"; }).length, tagN = sel.filter(function (x) { return x.type === "tag"; }).length, newN = sel.filter(function (x) { return x.type === "draft" || x.type === "stage"; }).length;
          var applies = act === "approve" ? newN : act === "reject" ? newN : act === "use-a" || act === "use-b" ? refsN + tagN : refsN;
          // bulk Approve skips anything with warnings (the server enforces it too): those are approved one at a time
          var warnedN = act === "approve" ? sel.filter(function (x) { return (x.type === "draft" || x.type === "stage") && verifyOf[x.id] !== "pass"; }).length : 0;
          // ... and, unless "Include rewritten items" is ticked, anything an AI rewrote in a repair round
          var inclRw = !!($("#inclRw") && $("#inclRw").checked);
          var rewrittenN = act === "approve" && !inclRw ? sel.filter(function (x) { return (x.type === "draft" || x.type === "stage") && verifyOf[x.id] === "pass" && rewrittenOf[x.id]; }).length : 0;
          applies -= warnedN + rewrittenN;
          var skipWhy = [warnedN ? plural(warnedN, "item") + " with warnings must be approved one at a time" : "", rewrittenN ? plural(rewrittenN, "item") + " rewritten by AI are skipped (tick Include rewritten items to approve them too)" : ""].filter(Boolean).join("; ");
          if (!confirmClick(ba, label + " on " + plural(sel.length, "selected item") + "?\n\n" + (applies === sel.length ? "It applies to all of them." : "It applies to " + applies + " of them (" + (act === "approve" || act === "reject" ? label + " is for drafts and new items" + (skipWhy ? "; " + skipWhy : "") : label + " is for reference answers" + (act === "use-a" || act === "use-b" ? " and tags" : "")) + "); the others are skipped.") + (act === "fix" ? " Each fix re-runs its drill through the pipeline." : "") + "\nThe whole action can be undone in one step from History.", label + " (" + applies + ")")) return;
          setBusy(true);
          ba.textContent = "Working…";
          api("/refs/bulk", "POST", { items: sel, action: act, includeRewritten: inclRw }).then(function (res) { bulkBusy = false; lastBulk = res; render(); }).catch(function (er) { bulkBusy = false; toast(er.message); render(); });
          return;
        }
        var bulk = e.target.closest("[data-bulk]");
        if (bulk) {
          var kind = bulk.getAttribute("data-bulk");
          if (kind === "undo") {
            if (!confirmClick(bulk, "Undo the whole bulk action? Every item it changed goes back to exactly how it was before.", "Undo it")) return;
            setBusy(true);
            api("/refs/undo", "POST", { batch: Number(bulk.getAttribute("data-batch")) }).then(function (u) { bulkBusy = false; lastBulk = null; toast("Undone: " + plural(u.undone, "item") + (u.skipped.length ? " · " + u.skipped.length + " skipped (changed again later: undo those in History first)" : "")); render(); }).catch(function (er) { setBusy(false); render(); toast(er.message); });
            return;
          }
          var n = Number(bulk.getAttribute("data-n"));
          if (!confirmClick(bulk, "Apply all " + n + " " + (kind === "text" ? "drill-text" : "setup") + " fixes?\n\nEach drill is changed and re-run through the full pipeline (two providers, retry, tie-breaker): about " + Math.max(1, Math.round(n * 12 / 4 / 60)) + " minutes and roughly $" + (n * 0.006).toFixed(2) + ". Drills that match leave the queue; the rest stay with their new result. Every change is kept in History and can be undone, one by one or as a whole run.", "Apply " + n + " fixes")) return;
          $$("[data-bulk]").forEach(function (b) { b.disabled = true; });
          api("/refs/fix-all", "POST", { kind: kind }).then(function (res) { if (!res.started) { toast(res.message); render(); return; } toast("Applying " + res.total + " " + kind + (res.total === 1 ? " fix" : " fixes") + "…"); pollBulk(); }).catch(function (er) { toast(er.message); render(); });
          return;
        }
        var fb = e.target.closest("[data-fix]");
        if (fb) {
          var fcard = fb.closest("[data-item]"), action = fb.getAttribute("data-fix");
          if (action === "apply" && !confirmClick(fb, "Apply this fix? The drill is changed and re-run through the pipeline (about 10 seconds).", "Apply")) return;
          $$("[data-fix]", fcard).forEach(function (b) { b.disabled = true; });
          if (action === "apply") fb.textContent = "Applying…";
          api("/refs/fix", "POST", { item_id: fcard.getAttribute("data-item"), action: action }).then(function (res) {
            toast(action === "ignore" ? "Fix ignored" : "Fix applied: the drill is now " + ({ matched: "checked automatically", review: "still in review", not_query: "not a single query", self: "self-check" }[res.status] || res.status));
            render();
          }).catch(function (er) { $$("[data-fix]", fcard).forEach(function (b) { b.disabled = false; }); fb.textContent = action === "apply" ? "Apply" : "Ignore"; toast(er.message); });
          return;
        }
        var sb = e.target.closest("[data-stage-act]");
        if (sb) {
          sb.disabled = true;
          api("/stage/" + encodeURIComponent(sb.closest("[data-stageid]").getAttribute("data-stageid")) + "/status", "POST", { status: sb.getAttribute("data-stage-act") === "approve" ? "published" : "rejected" }).then(function () { toast(sb.getAttribute("data-stage-act") === "approve" ? "Approved" : "Rejected"); render(); }).catch(function (er) { sb.disabled = false; toast(er.message); });
          return;
        }
        var tb = e.target.closest("[data-tag]");
        if (tb) {
          tb.disabled = true;
          api("/tags/decide", "POST", { key: tb.closest("[data-tagkey]").getAttribute("data-tagkey"), use: tb.getAttribute("data-tag") }).then(function () { toast("Tagged"); render(); }).catch(function (er) { tb.disabled = false; toast(er.message); });
          return;
        }
        var rb = e.target.closest("[data-ref]");
        if (rb) {
          var card = rb.closest("[data-item]"), id = card.getAttribute("data-item"), use = rb.getAttribute("data-ref");
          if (use === "all") { $$("[data-pick]", card).forEach(function (b) { if (!b.disabled) b.checked = true; }); pickCount(card); return; }
          var body = { item_id: id, use: use };
          if (use === "save") body.use = $$("[data-pick]:checked", card).map(function (b) { return b.getAttribute("data-pick"); });
          if (use === "own") body.sql = card.querySelector("textarea").value;
          if (use === "none" && !confirmClick(rb, "Leave this drill unchecked? It becomes a self-check: learners see the best available solution as the model answer and mark it done themselves.", "Leave unchecked")) return;
          rb.disabled = true;
          api("/refs/decide", "POST", body).then(function (res) {
            toast(use === "none" ? "Left unchecked: now a self-check" : res.accepted > 1 ? res.accepted + " accepted answers saved: the drill is checked from now on" : "Reference saved: the drill is checked from now on");
            render();
          }).catch(function (er) { rb.disabled = false; toast(er.message); });
          return;
        }
        var a = e.target.closest("[data-act]");
        if (!a) return;
        var act2 = a.getAttribute("data-act"), qcard = a.closest("[data-id]");
        if (act2 === "approve-pass") {
          Promise.all(passing.map(function (i) { return api("/items/" + encodeURIComponent(i.id) + "/status", "POST", { status: "published" }); })).then(function () { toast(plural(passing.length, "item") + " published"); render(); });
          return;
        }
        if (!qcard) return;
        var qid = qcard.getAttribute("data-id"), item = items.filter(function (i) { return i.id === qid; })[0];
        if (act2 === "approve") api("/items/" + encodeURIComponent(qid) + "/status", "POST", { status: "published" }).then(function () { toast("Published"); render(); });
        else if (act2 === "reject") api("/items/" + encodeURIComponent(qid) + "/status", "POST", { status: "rejected" }).then(function () { toast("Rejected"); render(); });
        else if (act2 === "edit") openEditor(item.kind, item, render);
      };
    }).catch(fail);
  }
  function bulkResultHtml(res) {
    var counts = Object.keys(res.counts || {}).map(function (k) { return '<span class="mono">' + res.counts[k] + "</span> " + ({ matched: "now checked automatically", review: "still in review", self: "now self-check", rejected: "rejected" }[k] || k); }).join(" · ");
    return '<section class="card card-pad bulk-result" role="status"><div class="card-h"><h3>' + icon("check") + esc(res.action) + ": " + plural(res.done, "item") + " done" + (res.skipped.length ? ", " + res.skipped.length + " skipped" : "") + '</h3><button type="button" class="btn sm" data-bulk="undo" data-batch="' + res.batch + '">Undo this action</button></div>' +
      (counts ? '<p class="small" style="margin:0 0 6px">' + counts + "</p>" : "") +
      (res.skipped.length ? '<ul class="small skipped">' + res.skipped.map(function (x) { return "<li><b>" + esc(x.title) + "</b>: " + esc(x.why) + "</li>"; }).join("") + "</ul>" : "") + "</section>";
  }

  function changesHtml(ch) {
    if (!ch.length) return '<section class="card card-pad"><div class="card-h"><h3>' + icon("reset") + "Changes you made</h3></div><div class=\"empty-sm\">No changes yet. Applying or ignoring a fix, Use A / B / C, Leave unchecked and Send back to review all appear here with Undo.</div></section>";
    var batches = {};
    ch.forEach(function (c) { if (c.batch && !c.undone_at) batches[c.batch] = c.job; });
    var html = '<section class="card card-pad"><div class="card-h"><h3>' + icon("reset") + 'Changes you made</h3><span class="muted small">' + plural(ch.length, "change") + "</span></div>";
    html += Object.keys(batches).map(function (b) { var j = batches[b]; return '<div class="actions"><span class="small">Bulk ' + (j && /^bulk-/.test(j.mode) ? "action: <b>" + esc({ "bulk-use-a": "Use A", "bulk-use-b": "Use B", "bulk-use-c": "Use C", "bulk-use-all": "Use all", "bulk-fix": "Apply suggested fix", "bulk-self": "Leave unchecked (self-check)", "bulk-reject": "Reject" }[j.mode] || j.mode) + "</b>" : "run of <b>" + (j && j.mode === "fix-setup" ? "setup" : "text") + " fixes</b>") + (j ? ' · <span class="mono">' + fmtDate(j.started_at, true) + "</span>" + (j.queue_after != null ? ' · queue <span class="mono">' + j.queue_before + " → " + j.queue_after + "</span>" : "") : "") + '</span><button type="button" class="btn sm" data-undo-batch="' + b + '">Undo the whole run</button></div>'; }).join("");
    html += '<div class="table-wrap"><table class="admin-t"><caption class="sr-only">Changes, newest first</caption><thead><tr><th scope="col">When</th><th scope="col">Drill</th><th scope="col">Change</th><th scope="col">Result</th><th scope="col"><span class="sr-only">Undo</span></th></tr></thead><tbody>' +
      ch.map(function (c) {
        return "<tr" + (c.undone_at ? ' class="undone"' : "") + '><td class="mono small nowrap">' + fmtDate(c.at, true) + '</td><td><a href="#/item/' + esc(c.item_id) + '">' + esc(c.title) + '</a> <span class="muted small">L' + (c.level || "?") + "</span></td><td class=\"small\">" + esc(c.label) + (c.batch ? ' <span class="tag plain">bulk</span>' : "") + (c.summary ? '<div class="muted">' + esc(c.summary.slice(0, 140)) + "</div>" : "") +
          '</td><td class="small nowrap">' + esc(c.before_status) + " → " + esc(c.after_status || "?") + (c.undone_at ? '<div class="muted">undone ' + fmtDate(c.undone_at, true) + "</div>" : "") + "</td><td>" +
          (c.canUndo ? '<button type="button" class="btn sm" data-undo="' + c.id + '">Undo</button>' : c.undone_at ? "" : '<span class="muted small" title="A later change to this drill comes first">later change first</span>') + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
    return html;
  }
  function viewRefHistory() {
    Promise.all([api("/refs/history"), api("/refs/changes")]).then(function (both) {
      var list = both[0], changes = both[1];
      var kinds = {};
      list.forEach(function (r) { var k = r.prompt_rewritten ? "prompt rewritten" : r.resolution; kinds[k] = (kinds[k] || 0) + 1; });
      var html = '<div class="page admin"><div class="col"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/review">Review queue</a>' + icon("chevRight") + '<span>History</span></nav><div class="hero"><div><div class="eyebrow">Review queue · history</div><h2 class="h1">' + plural(list.length, "drill") + " resolved without you</h2><p>After a retry, a prompt rewrite or a tie-breaker. Audit them here; send any back to review.</p></div></div>";
      html += '<p class="small">' + Object.keys(kinds).map(function (k) { return '<span class="mono">' + kinds[k] + "</span> " + esc(k); }).join(" · ") + "</p>";
      html += changesHtml(changes);
      html += '<h3 class="q-sec">Resolved by the pipeline</h3>';
      html += list.length ? list.map(resolvedCard).join("") : '<div class="card empty">' + icon("check") + "<div>Nothing resolved automatically yet.</div></div>";
      view.innerHTML = html + "</div></div>";
      view.onclick = function (e) {
        var u = e.target.closest("[data-undo], [data-undo-batch]");
        if (u) {
          var batch = u.getAttribute("data-undo-batch");
          if (!confirmClick(u, batch ? "Undo the whole bulk run? Every drill it changed goes back to exactly how it was." : "Undo this change? The drill goes back to exactly how it was before it.", "Undo")) return;
          u.disabled = true;
          api("/refs/undo", "POST", batch ? { batch: Number(batch) } : { id: Number(u.getAttribute("data-undo")) }).then(function (r) { toast(batch ? "Undone: " + plural(r.undone, "item") : r.kind === "tag-stage" ? "Undone: the item's stage is " + r.status + " again" : "Undone: the drill is " + r.status + " again"); viewRefHistory(); refreshCounts(); }).catch(function (er) { u.disabled = false; toast(er.message); });
          return;
        }
        var b = e.target.closest('[data-ref="reopen"]');
        if (!b) return;
        if (!confirmClick(b, "Send this drill back to review? Its reference is removed (and a rewritten prompt goes back to the original) until you decide.", "Send back")) return;
        b.disabled = true;
        api("/refs/decide", "POST", { item_id: b.closest("[data-item]").getAttribute("data-item"), use: "reopen" }).then(function () { toast("Sent back to review"); viewRefHistory(); refreshCounts(); }).catch(function (er) { b.disabled = false; toast(er.message); });
      };
    }).catch(fail);
  }

  // --- reference answers card (Library health)
  var refsTimer = null;
  function refsCardHtml(s) {
    var t = s.total, last = s.last;
    var seg = function (k, n) { return n ? '<span class="' + k + '" style="flex:' + n + '"></span>' : ""; };
    var lvls = s.levels.map(function (L) { return L.level; });
    var html = '<div class="card-h"><h3>' + icon("check") + 'Reference answers for built-in drills</h3></div><p class="muted small" style="margin:0 0 12px">Claude and OpenAI each write a solution for a drill on their own; both are run on its dataset. Matching results become the drill\'s reference and the drill is checked from then on. Disagreements go to the <a href="#/review">review queue</a>.</p>';
    html += '<div class="outcome refs-out" role="img" aria-label="' + t.drills + " built-in drills: " + t.matched + " have a reference, " + t.self + " are self-check, " + t.review + " need review, " + t.not_query + " are not a single query, " + t.todo + ' not started"><div class="ob">' + seg("ok", t.matched) + seg("selfchk", t.self) + seg("self", t.review) + seg("noref", t.not_query) + seg("todo", t.todo) + '</div><ul class="ol"><li><i class="ok"></i><span class="mono">' + t.matched + '</span> matched</li><li><i class="selfchk"></i><span class="mono">' + t.self + '</span> self-check</li><li><i class="self"></i><span class="mono">' + t.review + '</span> need review</li><li><i class="noref"></i><span class="mono">' + t.not_query + '</span> not a single query</li><li><i class="todo"></i><span class="mono">' + t.todo + '</span> not started</li><li class="tot"><span class="mono">= ' + t.drills + "</span> built-in drills</li></ul></div>";
    html += '<fieldset class="ref-levels"><legend class="small">Levels to run</legend>' + lvls.map(function (n) { return '<label class="opt-chip"><input type="checkbox" name="rl" value="' + n + '"' + (n <= 3 ? " checked" : "") + "><span>Level " + n + "</span></label>"; }).join("") + "</fieldset>";
    html += '<div class="h-run">' + (s.running ? '<button type="button" class="btn sm danger" data-refs="stop">Stop</button>' : '<button type="button" class="btn sm primary" data-refs="run">' + icon("play") + (last && last.status === "stopped" ? "Resume" : "Run") + ' for the chosen levels</button><button type="button" class="btn sm" data-refs="review"' + (t.review ? "" : " disabled") + ">" + icon("reset") + "Re-run the " + t.review + " waiting for review</button>" + '<button type="button" class="btn sm" data-refs="write"' + (t.write_todo ? "" : " disabled") + ' title="Statements that change data or structure: each side runs on a scratch MySQL copy and the end states are compared">' + icon("server") + "Write drills on MySQL (" + t.write_todo + " not tried)</button>") +
      '<span class="muted small" aria-live="polite">' + (last ? (s.running ? esc(last.progress || "Running…") : (last.status === "done" ? "Last run finished " : last.status === "stopped" ? "Stopped " : "Last run " + last.status + " ") + '<span class="mono">' + fmtDate(last.finished_at || last.started_at, true) + "</span>") : "Not run yet") + "</span></div>";
    if (last) {
      var usage = Object.keys(last.usage).map(function (m) { var u = last.usage[m]; return esc(provName(u.provider)) + ' <span class="muted">' + esc(m) + '</span> <span class="mono">' + u.calls + " calls · " + u.input.toLocaleString() + " in / " + u.output.toLocaleString() + " out tokens</span>"; }).join("<br>");
      html += '<dl class="kv3 ref-last"><div><dt>Processed</dt><dd class="mono">' + last.processed + " / " + last.total + '</dd></div><div><dt>Time</dt><dd class="mono">' + Math.floor(last.seconds / 60) + "m " + (last.seconds % 60) + 's</dd></div><div><dt>Estimated cost</dt><dd class="mono">$' + last.cost.toFixed(4) + '</dd></div></dl><p class="small muted" style="margin:8px 0 0">This run: <span class="mono">' + last.matched + "</span> matched · <span class=\"mono\">" + last.review + "</span> to review · <span class=\"mono\">" + last.not_query + "</span> not a query · <span class=\"mono\">" + last.errors + "</span> errors · levels " + last.levels.join(", ") + "<br>" + usage + "<br>Cost uses list prices per million input / output tokens: Claude Haiku 4.5 $1 / $5, gpt-5-nano $0.05 / $0.40, Claude Sonnet 5.5 (tie-breaker) $2 / $10.</p>";
    }
    if (s.jobs && s.jobs.length) html += '<div class="table-wrap" style="margin-top:12px" tabindex="0" role="group" aria-label="Recent runs"><table class="admin-t"><caption class="sr-only">Recent runs</caption><thead><tr><th scope="col">Run</th><th scope="col">Levels</th><th scope="col" class="n">Drills</th><th scope="col" class="n">Matched</th><th scope="col" class="n">Review</th><th scope="col" class="n">Not a query</th><th scope="col">Resolved by</th><th scope="col" class="n">Time</th><th scope="col" class="n">Cost</th></tr></thead><tbody>' +
      s.jobs.map(function (j) { return '<tr><td class="mono small nowrap">' + fmtDate(j.started_at, true) + "<br>" + (j.mode === "review" ? "re-run of review" : j.mode === "write" ? "write drills (MySQL)" : j.mode === "write-review" ? "re-run of write reviews" : j.mode === "fix-text" ? "bulk text fixes" : j.mode === "fix-setup" ? "bulk setup fixes" : "new drills") + " · " + esc(j.status) + "</td><td>" + j.levels.join(", ") + '</td><td class="n">' + j.processed + " / " + j.total + '</td><td class="n">' + j.matched + '</td><td class="n">' + j.review + '</td><td class="n">' + j.not_query + '</td><td class="small">' + Object.keys(j.resolutions).map(function (k) { return '<span class="mono">' + j.resolutions[k] + "</span> " + esc(k); }).join("<br>") + '</td><td class="n">' + Math.floor(j.seconds / 60) + "m " + (j.seconds % 60) + 's</td><td class="n">$' + j.cost.toFixed(4) + "</td></tr>"; }).join("") + "</tbody></table></div>";
    html += '<div class="table-wrap" style="margin-top:12px" tabindex="0" role="group" aria-label="Reference answers per level"><table class="admin-t"><thead><tr><th scope="col">Level</th><th scope="col" class="n">Drills</th><th scope="col" class="n">Matched</th><th scope="col" class="n">Need review</th><th scope="col" class="n">Not a query</th><th scope="col" class="n">Not started</th><th scope="col" class="n">Write: matched</th><th scope="col" class="n">Write: review</th><th scope="col" class="n">Write: not tried</th></tr></thead><tbody>' +
      s.levels.map(function (L) { return "<tr><td>" + L.level + " · " + esc((META.levels[L.level - 1] || {}).title || "") + '</td><td class="n">' + L.drills + '</td><td class="n">' + L.matched + '</td><td class="n">' + L.review + '</td><td class="n">' + L.not_query + '</td><td class="n">' + L.todo + '</td><td class="n">' + L.write_matched + '</td><td class="n">' + L.write_review + '</td><td class="n">' + L.write_todo + "</td></tr>"; }).join("") + "</tbody></table></div>";
    return html;
  }
  function loadRefs() {
    clearTimeout(refsTimer);
    var card = $("#refsCard");
    if (!card) return;
    api("/refs").then(function (s) {
      if (!$("#refsCard")) return;
      var keep = $$('#refsCard input[name="rl"]').map(function (x) { return x.value + ":" + x.checked; });
      card.innerHTML = refsCardHtml(s);
      keep.forEach(function (k) { var p = k.split(":"), el = card.querySelector('input[name="rl"][value="' + p[0] + '"]'); if (el) el.checked = p[1] === "true"; });
      if (s.running) refsTimer = setTimeout(loadRefs, 2000);
      else refreshCounts();
    });
    card.onclick = function (e) {
      var b = e.target.closest("[data-refs]");
      if (!b) return;
      b.disabled = true;
      if (b.getAttribute("data-refs") === "stop") return api("/refs/stop", "POST").then(function () { toast("Stopping after the drills in progress…"); loadRefs(); });
      if (b.getAttribute("data-refs") === "write") return api("/refs/run", "POST", { levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], mode: "write" }).then(function (r) { toast(r.started ? "Write drills: " + plural(r.total, "drill") : r.message); loadRefs(); });
      if (b.getAttribute("data-refs") === "review") return api("/refs/run", "POST", { levels: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14], mode: "review" }).then(function (r) { toast(r.started ? "Re-running " + plural(r.total, "drill") : r.message); loadRefs(); });
      var levels = $$('#refsCard input[name="rl"]:checked').map(function (x) { return Number(x.value); });
      if (!levels.length) { b.disabled = false; return toast("Choose at least one level."); }
      api("/refs/run", "POST", { levels: levels }).then(function (r) { toast(r.started ? "Started: " + plural(r.total, "drill") + " to do" : r.message); loadRefs(); }).catch(function (er) { b.disabled = false; toast(er.message); });
    };
  }

  // --- MCQ bank
  var mcqF = { q: "", level: "", status: "", origin: "" };
  function viewMcqs() {
    api("/mcqs").then(function (all) {
      var q = mcqF.q.toLowerCase();
      var list = all.filter(function (m) {
        return (!mcqF.level || itemLevel(m) === Number(mcqF.level)) && (!mcqF.status || m.status === mcqF.status) && (!mcqF.origin || m.origin === mcqF.origin) &&
          (!q || (m.q + " " + m.options.join(" ") + " " + m.id).toLowerCase().indexOf(q) > -1);
      });
      var live = all.filter(function (m) { return m.status === "published"; }).length;
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">MCQ bank</div><h2 class="h1">' + live + " live questions</h2><p>" + all.length + " in total: built-in, generated and added. Edit any of them, hide the ones you don't want, or add your own.</p></div></div>";
      html += '<div class="toolbar"><label class="search-inline">' + icon("search") + '<input id="mq" value="' + esc(mcqF.q) + '" placeholder="Search questions and options…"></label>' +
        '<select class="inp" id="mt" aria-label="Level"><option value="">All levels</option>' + levelOptions().map(function (o) { return '<option value="' + o[0] + '"' + (String(mcqF.level) === String(o[0]) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>" +
        '<select class="inp" id="ms" aria-label="Status">' + [["", "Any status"], ["published", "Live"], ["hidden", "Hidden"], ["draft", "Draft"], ["rejected", "Rejected"]].map(function (o) { return '<option value="' + o[0] + '"' + (mcqF.status === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
        '<select class="inp" id="mo" aria-label="Origin">' + [["", "Any origin"], ["built-in", "Built-in"], ["generated", "Generated"], ["mine", "Mine (created by hand)"], ["added", "Added by hand"]].map(function (o) { return '<option value="' + o[0] + '"' + (mcqF.origin === o[0] ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select>" +
        '<button class="btn primary" data-act="new">' + icon("plus") + "New question</button></div>";
      html += '<section class="card"><table class="admin-t"><thead><tr><th>Question</th><th class="hide-sm">Level</th><th class="hide-sm">Difficulty</th><th class="hide-sm">Origin</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        (list.length ? list.map(function (m) {
          var isB = m.origin === "built-in";
          return '<tr data-id="' + esc(m.id) + '"><td class="q"><div><b>' + esc(m.q) + '</b></div><div class="muted small">Answer: ' + esc(m.options[m.answer]) + "</div></td><td class=\"hide-sm\">" + esc(levelLabel(itemLevel(m))) + '</td><td class="hide-sm">' + esc(m.diff) + '</td><td class="hide-sm">' + esc(originLabel(m.origin)) + (m.edited ? ' <span class="muted small">(edited)</span>' : "") + '</td><td><span class="sbadge ' + m.status + '">' + (m.status === "published" ? "live" : m.status) + '</span></td><td class="acts">' +
            '<button class="btn sm" data-act="edit" title="Edit">' + icon("edit") + "</button> " +
            (m.status === "published" ? '<button class="btn sm" data-act="hide" title="Hide from learners">' + icon("eyeOff") + "</button> " : '<button class="btn sm" data-act="show" title="Publish">' + icon("eye") + "</button> ") +
            (isB ? (m.edited || m.status === "hidden" ? '<button class="btn sm" data-act="restore" title="Restore the original">' + icon("reset") + "</button>" : "") : '<button class="btn sm danger" data-act="delete" title="Delete">' + icon("trash") + "</button>") + "</td></tr>";
        }).join("") : '<tr><td colspan="6" class="empty-sm">No questions match.</td></tr>') + "</tbody></table></section></div></div>";
      view.innerHTML = html;
      var re = function () { mcqF.q = $("#mq").value; mcqF.level = $("#mt").value; mcqF.status = $("#ms").value; mcqF.origin = $("#mo").value; viewMcqs(); };
      $("#mq").addEventListener("input", function () { clearTimeout(re.t); re.t = setTimeout(function () { var pos = $("#mq").selectionStart; re(); setTimeout(function () { var i = $("#mq"); if (i) { i.focus(); i.selectionStart = i.selectionEnd = pos; } }, 60); }, 300); });
      ["#mt", "#ms", "#mo"].forEach(function (s) { $(s).addEventListener("change", re); });
      var openId = route.q.get("open"), openM = openId && all.filter(function (x) { return x.id === openId; })[0];
      if (openM) { history.replaceState(null, "", "#/mcqs"); route.q.delete("open"); openEditor("mcq", Object.assign({}, openM, { data: openM }), viewMcqs); }
      view.onclick = function (e) {
        var a = e.target.closest("[data-act]");
        if (!a) return;
        var act = a.getAttribute("data-act");
        if (act === "new") return openEditor("mcq", null, viewMcqs);
        var row = a.closest("[data-id]"), id = row && row.getAttribute("data-id"), m = all.filter(function (x) { return x.id === id; })[0];
        if (act === "edit") openEditor("mcq", Object.assign({}, m, { data: m }), viewMcqs);
        else if (act === "hide") api("/items/" + encodeURIComponent(id) + "/status", "POST", { status: "hidden" }).then(function () { toast("Hidden from learners"); viewMcqs(); });
        else if (act === "show") api("/items/" + encodeURIComponent(id) + "/status", "POST", { status: "published" }).then(function () { toast("Live"); viewMcqs(); });
        else if (act === "restore") api("/items/" + encodeURIComponent(id), "DELETE").then(function () { toast("Original restored"); viewMcqs(); });
        else if (act === "delete" && confirmClick(a, "Delete this question?", "Delete")) api("/items/" + encodeURIComponent(id), "DELETE").then(function () { toast("Deleted"); viewMcqs(); });
      };
    }).catch(fail);
  }

  // --- extra drills
  function viewDrills() {
    Promise.all([api("/drills"), api("/library")]).then(function (r) {
      var list = r[0], lib = r[1];
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Extra drills</div><h2 class="h1">' + plural(list.filter(function (d) { return d.status === "published"; }).length, "live extra drill") + "</h2><p>Drills you add or generate go into the level you choose, ordered by difficulty, and learners' answers are checked against the solution. The built-in exercises (read-only here) are summarised by level below.</p></div></div>";
      html += '<div class="actions"><button class="btn primary" data-act="new">' + icon("plus") + 'New drill</button><a class="btn" href="#/generate?kind=drill">' + icon("spark") + "Generate drills</a></div>";
      html += '<section class="card"><div class="card-pad" style="padding-bottom:0"><div class="card-h"><h3>' + icon("code") + "Extra drills (" + list.length + ')</h3></div></div><table class="admin-t"><thead><tr><th>Drill</th><th class="hide-sm">Level</th><th class="hide-sm">Practice database</th><th class="hide-sm">Checks</th><th>Status</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        (list.length ? list.map(function (d) {
          return '<tr data-id="' + esc(d.id) + '"><td class="q"><div><b>' + esc(d.data.title) + '</b></div><div class="muted small">' + esc(d.data.task) + '</div></td><td class="hide-sm">' + esc(levelLabel(itemLevel(d.data))) + " · " + esc(d.data.diff) + '</td><td class="hide-sm">' + esc(datasetLabel(d.data)) + '</td><td class="hide-sm">' + vbadge(d.verify) + '</td><td><span class="sbadge ' + d.status + '">' + (d.status === "published" ? "live" : d.status) + '</span></td><td class="acts">' +
            '<button class="btn sm" data-act="edit" aria-label="Edit" title="Edit">' + icon("edit") + "</button> " + (d.status === "published" ? '<button class="btn sm" data-act="unpublish" title="Take offline">' + icon("eyeOff") + "</button> " : '<button class="btn sm" data-act="publish" title="Publish">' + icon("eye") + "</button> ") +
            '<button class="btn sm danger" data-act="delete" aria-label="Delete" title="Delete">' + icon("trash") + "</button></td></tr>";
        }).join("") : '<tr><td colspan="6" class="empty-sm">No extra drills yet.</td></tr>') + "</tbody></table></section>";
      html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("levels") + "All exercises by level</h3></div>" + levelsTable(lib) + "</section></div></div>";
      view.innerHTML = html;
      view.onclick = function (e) {
        var a = e.target.closest("[data-act]");
        if (!a) return;
        var act = a.getAttribute("data-act");
        if (act === "new") return openEditor("drill", null, viewDrills);
        var id = a.closest("[data-id]").getAttribute("data-id"), d = list.filter(function (x) { return x.id === id; })[0];
        if (act === "edit") openEditor("drill", d, viewDrills);
        else if (act === "publish") api("/items/" + encodeURIComponent(id) + "/status", "POST", { status: "published" }).then(function () { toast("Live"); viewDrills(); });
        else if (act === "unpublish") api("/items/" + encodeURIComponent(id) + "/status", "POST", { status: "draft" }).then(function () { toast("Taken offline (back to draft)"); viewDrills(); });
        else if (act === "delete" && confirmClick(a, "Delete this drill?", "Delete")) api("/items/" + encodeURIComponent(id), "DELETE").then(function () { toast("Deleted"); viewDrills(); });
      };
    }).catch(fail);
  }

  // --- learners
  function viewLearners() {
    Promise.all([api("/overview"), api("/library")]).then(function (both) {
      var o = both[0], lib = both[1], d = o.done;
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Learners</div><h2 class="h1">Progress and activity</h2><p>Progress is stored on this computer (data.sqlite). Export it before resetting anything.</p></div></div>';
      html += '<div class="stat-row four">' + stat("blue", "db", "Drills completed", d.drill + d.extra, d.extra ? d.extra + " extra drills" : "built-in drills", "#/learners") + stat("purple", "checkCircle", "MCQs answered right", d.mcq, "", "#/learners") +
        stat("green", "check", "30-day course", d.course, "exercises checked correct", "#/learners") + stat("orange", "check", "SQL Exercises set", d.exercises, "exercises checked correct", "#/learners") + "</div>";
      html += '<div class="grid2"><section class="card card-pad"><div class="card-h"><h3>' + icon("chart") + "Completions, last 30 days</h3></div>" + barChart(o.activity) + "</section>" +
        '<section class="card card-pad"><div class="card-h"><h3>' + icon("levels") + 'Progress by level</h3></div><table class="admin-t"><tbody>' + lib.levels.map(function (L) { return "<tr><td>" + L.n + " · " + esc(L.title) + "</td><td>" + L.done + " / " + L.total + "</td></tr>"; }).join("") + "</tbody></table></section></div>";
      html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("download") + 'Export and reset</h3></div><div class="actions"><button class="btn" data-act="export">' + icon("download") + 'Download progress (JSON)</button><span class="grow"></span>' +
        '<button class="btn danger" data-act="reset" data-scope="drills">' + icon("reset") + 'Reset drill progress</button><button class="btn danger" data-act="reset" data-scope="mcq">Reset MCQ progress</button><button class="btn danger" data-act="reset" data-scope="course">Reset course progress</button><button class="btn danger" data-act="reset" data-scope="all">Reset everything</button></div></section></div></div>';
      view.innerHTML = html;
      view.onclick = function (e) {
        var a = e.target.closest("[data-act]");
        if (!a) return;
        if (a.getAttribute("data-act") === "export") {
          api("/progress/export").then(function (data) {
            var url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
            var link = document.createElement("a"); link.href = url; link.download = "sql-drills-progress-" + new Date().toISOString().slice(0, 10) + ".json"; link.click(); URL.revokeObjectURL(url);
          });
        } else if (a.getAttribute("data-act") === "reset") {
          var scope = a.getAttribute("data-scope");
          var words = { drills: "all drill progress", mcq: "all MCQ progress", course: "all course progress (30-day course and SQL Exercises)", all: "ALL progress" }[scope];
          if (prompt("This deletes " + words + " and can't be undone. Type RESET to confirm.") !== "RESET") return;
          api("/progress/reset", "POST", { scope: scope }).then(function (r) { toast(plural(r.removed, "record") + " removed"); viewLearners(); });
        }
      };
    }).catch(fail);
  }

  // --- provider order for Generate and Review
  var orderState = null;
  function orderList(kind, title, help) {
    var names = { claude: "Claude", openai: "OpenAI", deepseek: "DeepSeek" };
    return '<div class="order-col"><h4>' + title + '</h4><p class="muted small">' + help + '</p><ol class="order-list" aria-label="' + title + '">' + orderState[kind].map(function (id, k, all) {
      return '<li><span class="mono muted">' + (k + 1) + "</span><b>" + names[id] + '</b><span class="grow"></span><button type="button" class="btn sm" data-ord="' + kind + '" data-id="' + id + '" data-dir="-1" aria-label="Move ' + names[id] + ' up in ' + title + '"' + (k === 0 ? " disabled" : "") + '>↑</button><button type="button" class="btn sm" data-ord="' + kind + '" data-id="' + id + '" data-dir="1" aria-label="Move ' + names[id] + ' down in ' + title + '"' + (k === all.length - 1 ? " disabled" : "") + ">↓</button></li>";
    }).join("") + "</ol></div>";
  }
  function paintOrder() {
    var card = $("#orderCard");
    if (!card) return;
    card.innerHTML = '<div class="card-h"><h3>' + icon("layers") + 'Provider order</h3></div><div class="order-grid">' +
      orderList("generate", "Generate", "Who drafts new content. Auto tries them in this order and moves on when one fails.") +
      orderList("review", "Review", "Who checks a draft independently: the first in this list that did not generate it.") +
      '</div><div class="actions"><button type="button" class="btn primary sm" data-ord-save>Save order</button><button type="button" class="btn sm" data-ord-reset>Back to the defaults</button><span class="muted small" id="ordMsg" aria-live="polite"></span></div>';
  }
  function loadOrder() {
    api("/settings/providers").then(function (o) { orderState = o; paintOrder(); });
    var card = $("#orderCard");
    card.onclick = function (e) {
      var b = e.target.closest("[data-ord]");
      if (b) {
        var list = orderState[b.getAttribute("data-ord")], i = list.indexOf(b.getAttribute("data-id")), j = i + Number(b.getAttribute("data-dir"));
        if (j < 0 || j >= list.length) return;
        list.splice(j, 0, list.splice(i, 1)[0]);
        paintOrder();
        var again = card.querySelector('[data-ord="' + b.getAttribute("data-ord") + '"][data-id="' + b.getAttribute("data-id") + '"][data-dir="' + b.getAttribute("data-dir") + '"]');
        if (again && !again.disabled) again.focus();
        $("#ordMsg").textContent = "Not saved yet";
        return;
      }
      if (e.target.closest("[data-ord-reset]")) { orderState.generate = orderState.defaults["order.generate"].slice(); orderState.review = orderState.defaults["order.review"].slice(); paintOrder(); $("#ordMsg").textContent = "Defaults restored: not saved yet"; return; }
      if (e.target.closest("[data-ord-save]")) api("/settings/providers", "PUT", { generate: orderState.generate, review: orderState.review }).then(function (o) { orderState = o; paintOrder(); $("#ordMsg").textContent = "Saved"; toast("Provider order saved"); });
    };
  }

  // --- settings
  function viewSettings() {
    api("/providers").then(function (list) {
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">AI & settings</div><h2 class="h1">AI providers</h2><p>Used for learners\' hints and for the content generation machine. Keys live in sql-drills-server/.env (never in the browser).</p></div></div>';
      html += '<section class="card card-pad">' + providersList(list) + '<div class="actions" style="margin-top:14px"><select class="inp" id="tp" style="width:auto">' + list.filter(function (p) { return p.configured; }).map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.label) + "</option>"; }).join("") + '</select><button class="btn" data-act="test">' + icon("play") + 'Send a test prompt</button><span id="tpOut" class="muted small"></span></div></section>';
      html += '<section class="card card-pad" id="rolesCard" aria-labelledby="roles-h"><div class="empty-sm">Loading…</div></section>';
      html += '<section class="card card-pad" id="orderCard"><div class="empty-sm">Loading…</div></section>';
      html += '<section class="card card-pad" id="sysChanges" aria-labelledby="sc-h"><div class="card-h"><h3 id="sc-h">' + icon("server") + 'System</h3><span class="muted small">changes made to this computer\'s MySQL server for SQL Drills</span></div><div class="empty-sm">Checking…</div></section>';
      html += '<section class="card card-pad"><div class="card-h"><h3>' + icon("cog") + 'Configuration (.env)</h3></div><table class="admin-t"><tbody>' +
        [["OPENAI_API_KEY / OPENAI_MODEL", "OpenAI key, and the model for learners' hints (default gpt-5-nano)"], ["GENERATOR_MODEL", "OpenAI model for content generation (default gpt-4.1-mini)"], ["ANTHROPIC_API_KEY / ANTHROPIC_MODEL", "Claude key and model (default claude-haiku-4-5)"], ["DEEPSEEK_API_KEY / DEEPSEEK_MODEL", "DeepSeek key and model (default deepseek-flash; the reviewer)"], ["HINT_PROVIDER_ORDER", "Fallback order for Auto, e.g. openai,claude,deepseek"]]
          .map(function (r) { return "<tr><td><code>" + r[0] + "</code></td><td class=\"muted\">" + r[1] + "</td></tr>"; }).join("") + '</tbody></table><p class="muted small" style="margin:12px 0 0">Edit .env, then restart with npm start.</p></section></div></div>';
      view.innerHTML = html;
      loadRoles($("#rolesCard"), true);
      loadOrder();
      api("/settings/system").then(function (list) {
        var card = $("#sysChanges");
        if (!card) return;
        var labels = { now: "Now", persisted: "Persisted by MySQL", myIni: "In my.ini", exists: "User exists", scratchNow: "Scratch databases right now", error: "Status" };
        card.querySelector(".empty-sm").outerHTML = list.map(function (c) {
          return '<div class="sys-change"><div class="sys-change-h"><b class="mono">' + esc(c.what) + '</b><span class="muted small mono">' + esc(c.at) + "</span></div>" +
            '<p class="small" style="margin:4px 0">' + esc(c.why) + '</p><p class="small muted" style="margin:0 0 6px">' + esc(c.how) + "</p>" +
            (c.live ? '<dl class="kv-inline">' + Object.keys(c.live).map(function (k) { var info = (c.info || []).indexOf(k) > -1; return '<div' + (info ? ' class="info"' : "") + "><dt>" + esc(labels[k] || k) + '</dt><dd class="mono">' + (info ? '<span class="info-dot" aria-hidden="true">i</span>' : "") + esc(String(c.live[k])) + "</dd></div>"; }).join("") + "</dl>" : "") + "</div>";
        }).join("");
      }).catch(function (er) { var card = $("#sysChanges"); if (card) card.querySelector(".empty-sm").textContent = er.message; });
      // course databases: reset to the clean starting state (a backup is made first)
      var courseBox = function (st) {
        var last = st && st.last;
        return '<div class="sys-change" id="courseDb"><div class="sys-change-h"><b>Course databases</b><span class="muted small">MySQL practice, manual, sqlbolt · PostgreSQL sql_course</span></div>' +
          '<p class="small" style="margin:4px 0">Resetting reloads them from the course\x27s own seed scripts, as on day 1: every change made in course exercises is undone, and the hidden setup exercises run again the next time they are needed. A full backup (SQL files) is made first.</p>' +
          '<p class="small muted" style="margin:0 0 8px">' + (last ? "Last reset " + fmtDate(last.at, true) + " · backup in <span class=\"mono\">" + esc(last.backup) + "</span>" : "Not reset from here yet.") + "</p>" +
          '<button type="button" class="btn sm danger" data-course-reset>Reset course database</button> <span class="small" id="courseMsg" aria-live="polite"></span></div>';
      };
      api("/settings/course-db").then(function (st) { var card = $("#sysChanges"); if (card) card.insertAdjacentHTML("beforeend", courseBox(st)); });
      $("#sysChanges").addEventListener("click", function (e) {
        var b = e.target.closest("[data-course-reset]");
        if (!b) return;
        if (!confirmClick(b, "Reset the course databases?\n\nMySQL practice, manual and sqlbolt and the PostgreSQL sql_course schemas are reloaded from the course's seed scripts. Everything changed in course exercises is undone.\n\nA full backup is saved first (backups/course-<time>/).", "Back up and reset")) return;
        b.disabled = true;
        $("#courseMsg").textContent = "Backing up, then resetting… (a few seconds)";
        api("/settings/course-db/reset", "POST").then(function (r) {
          $("#courseMsg").innerHTML = "Done in " + r.seconds + " s. Backup: <span class=\"mono\">" + esc(r.backup.dir) + "</span> (" + r.backup.files.length + " files).";
          toast("Course databases reset; backup saved");
          b.disabled = false;
        }).catch(function (er) { $("#courseMsg").textContent = er.message; b.disabled = false; });
      });
      view.onclick = function (e) {
        var a = e.target.closest('[data-act="test"]');
        if (!a) return;
        $("#tpOut").textContent = "Asking…";
        api("/providers/test", "POST", { provider: $("#tp").value }).then(function (r) { $("#tpOut").textContent = r.label + " (" + r.model + ") answered in " + r.ms + " ms: " + r.text; }).catch(function (er) { $("#tpOut").textContent = er.message; });
      };
    }).catch(fail);
  }

  // ================= phase 2: overview, health, backups, recently added, write, import =================
  var DIFF_COLORS = { easy: "#4ADE80", medium: "#F59E0B", hard: "#9F1239" };
  function fmtDate(iso, withTime) { if (!iso) return "–"; var d = new Date(iso); return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) + (withTime ? ", " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : ""); }
  function n(v) { return '<span class="mono">' + (v == null ? "–" : Number(v).toLocaleString()) + "</span>"; }
  function pctTxt(v) { return v == null ? "–" : v + "%"; }
  function stateDot(state) {
    var ok = state === "online" || state === "ready", bad = state === "offline" || state === "failing" || state === "missing";
    var label = { online: "Online", offline: "Offline", ready: "Ready", failing: "Failing", missing: "Key missing" }[state] || "Unknown";
    return '<span class="st-pill ' + (ok ? "ok" : bad ? "bad" : "unk") + '"><span class="d" aria-hidden="true"></span>' + label + "</span>";
  }
  var sysTimer = null, healthTimer = null;

  // --- overview
  var lvlState = { sort: "level", attention: false };
  // AI spend logged per call (every provider call: hints, generation, reviews, tie-breaks), at the prices in hints.js
  function spendHtml(s) {
    if (!s) return "";
    var usd = function (x) { return "$" + (x < 1 ? x.toFixed(3) : x.toFixed(2)); };
    if (!s.calls) return '<div class="spend"><h4 class="small">AI spend</h4><p class="muted small">Nothing logged yet. Every AI call is logged from now on (provider, model, tokens, cost).</p></div>';
    return '<div class="spend"><h4 class="small">AI spend</h4><p class="big-n mono">' + usd(s.total) + '</p><p class="muted small spend-sub">Since ' + fmtDate(s.since, true) + " · " + n(s.calls) + (s.calls === 1 ? " call · " : " calls · ") + usd(s.last30) + " in the last 30 days</p>" +
      '<ul class="spend-list" aria-label="AI spend per model">' + s.byModel.map(function (r) { return '<li><span class="spend-m">' + esc(r.model) + ' <span class="muted small">' + esc(r.provider) + '</span></span><span class="mono spend-c">' + usd(r.cost) + '</span><span class="muted small spend-d">' + n(r.calls) + (r.calls === 1 ? " call · " : " calls · ") + n(r.input) + " in / " + n(r.output) + " out tokens</span></li>"; }).join("") + "</ul>" +
      (s.unpriced ? '<p class="muted small">' + n(s.unpriced) + " calls used a model with no price in hints.js and count as $0.</p>" : "") + "</div>";
  }
  function viewOverview() {
    view.innerHTML = '<div class="page admin"><div class="loading">Loading…</div></div>';
    api("/dashboard").then(function (d) {
      if (route.name !== "overview" && route.name !== "") return; // left the page while it loaded
      var k = d.kpis, s = d.summary;
      var html = '<div class="page admin ov"><div class="col">';
      html += '<div class="hero"><div><div class="eyebrow">Overview</div><h2 class="h1">Content &amp; learning</h2><p>' + n(k.exercises) + " exercises in " + s.levels.length + " levels, " + n(k.mcq.total) + ' live MCQs. Library built <span class="mono">' + fmtDate(s.builtAt, true) + '</span>.</p></div><div class="muted small">Last backup: <span class="mono">' + fmtDate(d.lastBackup, true) + "</span></div></div>";
      // KPI strip
      var cell = function (label, value, sub, href) { return '<a class="kpi" href="' + href + '"><span class="kpi-l">' + label + '</span><span class="kpi-v mono">' + value + '</span><span class="kpi-s">' + sub + "</span></a>"; };
      html += '<section class="card kpis" aria-label="Key numbers">' +
        cell("Exercises", k.exercises.toLocaleString(), n(k.browser) + " in browser · " + n(k.server) + " on server", "#/library") +
        cell("Self-check", k.selfCheck.toLocaleString(), k.selfPct + "% can't be auto-checked", "#/library?check=self") +
        cell("MCQs", k.mcq.total.toLocaleString(), n(k.mcq.easy) + " easy · " + n(k.mcq.medium) + " medium · " + n(k.mcq.hard) + " hard", "#/mcqs") +
        cell("Review queue", k.queue.toLocaleString(), k.queue ? n(k.queue) + " waiting" : "nothing waiting", "#/review") +
        cell("Completed by learners", k.completed30.toLocaleString(), "last 30 days", "#/learners") + "</section>";
      // quick actions
      var tile = function (ic, title, text, attrs) { return '<' + (attrs.indexOf("href") === 0 ? "a " : 'button type="button" ') + attrs + ' class="qa">' + '<span class="qa-ic">' + icon(ic) + '</span><span class="qa-t">' + title + '</span><span class="qa-s">' + text + "</span></" + (attrs.indexOf("href") === 0 ? "a" : "button") + ">"; };
      html += '<div class="qas">' + tile("spark", "Generate drills", "AI drafts, checked, then reviewed", 'href="#/generate?kind=drill"') +
        tile("edit", "Write an exercise", "Level, prompt, solution; validated first", 'data-act="write"') +
        tile("download", "Import exercises", "CSV or JSON, every solution is run", 'data-act="import"') +
        tile("archive", "Back up library", 'Last backup: <span class="mono" id="lastBk">' + fmtDate(d.lastBackup, true) + "</span>", 'data-act="backup"') + "</div>";
      html += '<div class="ov-grid"><div class="ov-main">';
      html += '<section class="card card-pad" aria-labelledby="lm-h"><div class="card-h"><h3 id="lm-h">' + icon("layers") + 'Learning model coverage</h3><a class="more link" href="#/concepts">Concepts</a></div><div id="lmCard" aria-live="polite"><div class="empty-sm">Loading…</div></div></section>';
      html += '<section class="card card-pad" aria-labelledby="lvl-h"><div class="card-h"><h3 id="lvl-h">' + icon("levels") + 'Library by level</h3><a class="more link" href="#/library">Open the library</a></div><div id="lvlTools"></div><div class="table-wrap" id="lvlTable"></div></section>';
      html += '</div><div class="ov-side">';
      // content gaps
      html += '<section class="card card-pad" aria-labelledby="gap-h"><div class="card-h"><h3 id="gap-h">' + icon("warn") + "Content gaps</h3></div>" +
        (d.gaps.length ? '<div class="gaps">' + d.gaps.map(function (g) { return '<div class="gap ' + g.kind + '"><b>' + esc(g.title) + "</b><p>" + esc(g.text) + '</p><a class="btn sm" href="' + g.href + '">' + esc(g.action) + "</a></div>"; }).join("") + "</div>" : '<div class="empty-sm">No level is flagged.</div>') + "</section>";
      html += '<section class="card card-pad" aria-labelledby="h-h"><div class="card-h"><h3 id="h-h">' + icon("heart") + 'Library health</h3><a class="more link" href="#/health">Open</a></div><div id="healthCard">' + healthList(d.health) + "</div></section>";
      // recently added
      html += '<section class="card card-pad" aria-labelledby="r-h"><div class="card-h"><h3 id="r-h">' + icon("clock") + 'Recently added</h3><a class="more link" href="#/recent">Open</a></div>' +
        (d.recent.count ? '<p class="big-n">' + n(d.recent.count) + ' <span class="muted small">new since the starting library</span></p><ul class="mini">' + d.recent.items.map(function (i) { return "<li>" + (i.kind === "exercise" ? '<a href="#/item/' + i.id + '">' + esc(i.title) + "</a>" : esc(i.title)) + ' <span class="muted small">· ' + (i.level ? "L" + i.level + " · " : "") + esc(i.diff || "") + " · " + i.origin + " · " + fmtDate(i.added_at) + "</span></li>"; }).join("") + "</ul>"
          : '<p class="muted" style="margin:0">' + n(0) + " new since the starting library (" + n(d.recent.baseline) + " imported 12–13 Oct).</p>") + "</section>";
      // AI generation
      html += '<section class="card card-pad" aria-labelledby="g-h"><div class="card-h"><h3 id="g-h">' + icon("spark") + 'AI generation</h3><a class="more link" href="#/generate">Generate</a></div><dl class="kv3">' +
        "<div><dt>Runs this week</dt><dd>" + n(d.gen.runs) + "</dd></div><div><dt>Drafts passed all checks</dt><dd class=\"mono\">" + pctTxt(d.gen.passedPct) + "</dd></div><div><dt>Drafts approved</dt><dd class=\"mono\">" + pctTxt(d.gen.approvedPct) + "</dd></div></dl>" + spendHtml(d.spend) + "</section>";
      // system
      html += '<section class="card card-pad" aria-labelledby="s-h"><div class="card-h"><h3 id="s-h">' + icon("cog") + 'System</h3><span class="muted small" id="sysAt">checking…</span></div><div id="sysBody" aria-live="polite"><div class="empty-sm">Checking…</div></div>' +
        '<p class="sys-foot">' + n(d.footer.links) + " cross-links · " + n(d.footer.duplicates) + " duplicates removed · " + n(d.footer.bookmarks) + " bookmarks</p></section>";
      var total30 = Object.keys(d.activity).reduce(function (a, x) { return a + d.activity[x]; }, 0);
      html += '<section class="card card-pad wide" aria-labelledby="act-h"><div class="card-h"><h3 id="act-h">' + icon("chart") + "Learner activity</h3></div>" + (total30 ? barChart(d.activity) : '<div class="empty-sm">No completions yet. The 30-day chart appears once learners complete exercises.</div>') + "</section>";
      html += "</div></div></div></div>";
      view.innerHTML = html;
      renderLevels(s);
      loadLearningCard();
      loadSystem();
      sysTimer = setInterval(loadSystem, 60000);
      if (d.health.running) pollHealth();
      view.onclick = function (e) {
        var a = e.target.closest("[data-act]");
        if (!a) return;
        var act = a.getAttribute("data-act");
        if (act === "write") openEditor("drill", null, function () { refreshCounts(); viewOverview(); }, { write: true });
        else if (act === "import") openImport();
        else if (act === "backup") makeBackup(a);
        else if (act === "health-run") runHealth(a);
        else if (act === "lvl-sort") { lvlState.sort = a.getAttribute("data-v"); renderLevels(s); }
      };
      view.onchange = function (e) { if (e.target.id === "attn") { lvlState.attention = e.target.checked; renderLevels(s); } };
    }).catch(fail);
  }
  function renderLevels(s) {
    var max = Math.max.apply(null, s.levels.map(function (L) { return L.total; }));
    var rows = s.levels.slice();
    if (lvlState.attention) rows = rows.filter(function (L) { return L.flags.length; });
    var by = { level: function (a, b) { return a.n - b.n; }, largest: function (a, b) { return b.total - a.total; }, easy: function (a, b) { return a.easy / a.total - b.easy / b.total; }, self: function (a, b) { return b.selfCheck / b.total - a.selfCheck / a.total; } }[lvlState.sort];
    rows.sort(by);
    var sortBtn = function (v, label) { return '<button type="button" class="seg' + (lvlState.sort === v ? " on" : "") + '" data-act="lvl-sort" data-v="' + v + '" aria-pressed="' + (lvlState.sort === v) + '">' + label + "</button>"; };
    $("#lvlTools").innerHTML = '<div class="lvl-tools"><div class="segs" role="group" aria-label="Sort levels">' + sortBtn("level", "Level order") + sortBtn("largest", "Largest") + sortBtn("easy", "Fewest easy (by %)") + sortBtn("self", "Most self-check (by %)") + "</div>" +
      '<label class="switch"><input type="checkbox" role="switch" id="attn"' + (lvlState.attention ? " checked" : "") + '><span class="sw" aria-hidden="true"></span>Only levels that need attention</label></div>';
    var sum = function (k) { return rows.reduce(function (a, L) { return a + L[k]; }, 0); };
    var totals = { total: sum("total"), easy: sum("easy"), medium: sum("medium"), hard: sum("hard"), self: sum("selfCheck"), done: sum("done") };
    $("#lvlTable").innerHTML = '<table class="admin-t lvl-t"><caption class="sr-only">Library by level</caption><thead><tr><th scope="col">Level</th><th scope="col">Size &amp; mix</th><th scope="col" class="n">Total</th><th scope="col" class="n">E / M / H</th><th scope="col" class="n">Self-check</th><th scope="col" class="n">Done %</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
      (rows.length ? rows.map(function (L) {
        var w = max ? (100 * L.total / max) : 0;
        var seg = function (k) { return L[k] ? '<span style="flex:' + L[k] + ";background:" + DIFF_COLORS[k] + '"></span>' : ""; };
        return '<tr><th scope="row" class="lvl-name"><span class="mono muted">' + L.n + "</span> " + esc(L.title) + (L.flags.length ? '<span class="flags">' + L.flags.map(function (f) { return '<span class="flag ' + f.kind + '">' + esc(f.text) + "</span>"; }).join("") + "</span>" : "") + "</th>" +
          '<td class="mix-cell"><div class="mix" role="img" aria-label="' + L.total + " exercises: " + L.easy + " easy, " + L.medium + " medium, " + L.hard + ' hard"><div class="mix-bar" style="width:' + w.toFixed(1) + '%">' + seg("easy") + seg("medium") + seg("hard") + "</div></div></td>" +
          '<td class="n">' + L.total.toLocaleString() + '</td><td class="n">' + L.easy + " / " + L.medium + " / " + L.hard + '</td><td class="n">' + L.selfCheck + ' <span class="muted">(' + L.selfPct + '%)</span></td><td class="n">' + L.donePct + "%</td>" +
          '<td class="acts"><a class="btn sm" href="#/library?level=' + L.n + '" aria-label="Open level ' + L.n + '">Open</a> <a class="btn sm" href="#/generate?level=' + L.n + '" aria-label="Add exercises to level ' + L.n + '">' + icon("plus") + "Add</a></td></tr>";
      }).join("") : '<tr><td colspan="7" class="empty-sm">No level needs attention.</td></tr>') +
      '</tbody><tfoot><tr><th scope="row">' + (rows.length === s.levels.length ? "All " + rows.length + " levels" : rows.length + " levels shown") + '</th><td></td><td class="n">' + totals.total.toLocaleString() + '</td><td class="n">' + totals.easy + " / " + totals.medium + " / " + totals.hard + '</td><td class="n">' + totals.self + '</td><td class="n">' + (totals.total ? Math.round(100 * totals.done / totals.total) : 0) + "%</td><td></td></tr></tfoot></table>" +
      '<div class="mix-key" aria-hidden="true"><span><i style="background:' + DIFF_COLORS.easy + '"></i>Easy</span><span><i style="background:' + DIFF_COLORS.medium + '"></i>Medium</span><span><i style="background:' + DIFF_COLORS.hard + '"></i>Hard</span></div>';
  }
  function loadSystem() {
    if (!$("#sysBody")) { clearInterval(sysTimer); return; }
    api("/system").then(function (s) {
      if (!$("#sysBody")) return;
      var row = function (name, state, sub) { return '<div class="sys-row"><div><b>' + name + "</b>" + (sub ? '<span class="muted small">' + sub + "</span>" : "") + "</div>" + stateDot(state) + "</div>"; };
      var ready = s.providers.filter(function (p) { return p.state === "ready"; }).length;
      $("#sysBody").innerHTML = '<div class="sys-row"><div><b>AI providers (Auto chain)</b><span class="muted small">' + s.providers.map(function (p) { return esc(p.label) + ": " + esc(p.detail.split(" · ")[0]); }).join(" · ") + "</span></div>" + stateDot(ready === s.providers.length ? "ready" : ready ? "failing" : "missing") + "</div>" +
        '<div class="sys-sub">' + s.providers.map(function (p) { return '<div class="sys-row sm"><span>' + esc(p.label) + ' <span class="muted mono small">' + esc(p.model || "") + "</span></span>" + stateDot(p.state) + "</div>"; }).join("") + "</div>" +
        row("MySQL checker", s.mysql.state, "serves " + s.mysql.serves.toLocaleString() + " exercises") +
        row("PostgreSQL checker", s.postgres.state, s.postgres.serves.toLocaleString() + " exercises have a PostgreSQL version") +
        row("Browser datasets", s.browser.state, s.browser.datasets + " datasets · " + s.browser.serves.toLocaleString() + " exercises");
      $("#sysAt").innerHTML = 'checked <span class="mono">' + new Date(s.checkedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) + "</span>";
    }).catch(function () { if ($("#sysBody")) $("#sysBody").innerHTML = '<div class="sys-row"><b>Status</b>' + stateDot("unknown") + "</div>"; });
  }
  function healthList(h) {
    var head = '<div class="h-run"><button type="button" class="btn sm" data-act="health-run"' + (h.running ? " disabled" : "") + ">" + icon("play") + (h.running ? "Running…" : "Run health check") + '</button><span class="muted small" id="hProg">' + (h.running ? esc(h.progress || "Running…") : h.lastRun ? 'Last run: <span class="mono">' + fmtDate(h.lastRun, true) + "</span>" : "Not run yet") + "</span></div>";
    if (h.lastError) head += '<div class="err">' + esc(h.lastError) + "</div>";
    if (!h.checks.length) return head + '<div class="empty-sm">Run the check to see near-duplicates, failing solutions, leftover text, missing summaries and broken links.</div>';
    var o = h.outcome;
    if (o) head += '<div class="outcome" role="img" aria-label="Every exercise counted once: ' + o.ok + " ran OK, " + o.failed + " failed, " + o.self + " self-check, " + o.dependent + " depend on an earlier exercise, " + o.noref + " have no reference answer, " + o.total + ' in total"><div class="ob">' +
      [["ok", o.ok], ["failed", o.failed], ["self", o.self], ["dependent", o.dependent], ["noref", o.noref]].map(function (x) { return x[1] ? '<span class="' + x[0] + '" style="flex:' + x[1] + '"></span>' : ""; }).join("") + '</div><ul class="ol">' +
      [["ok", "ran OK", o.ok], ["failed", "failed", o.failed], ["self", "self-check", o.self], ["dependent", "depend on an earlier exercise", o.dependent], ["noref", "no reference answer", o.noref]].map(function (x) { return '<li><i class="' + x[0] + '"></i><span class="mono">' + x[2].toLocaleString() + "</span> " + x[1] + "</li>"; }).join("") +
      '<li class="tot"><span class="mono">= ' + o.total.toLocaleString() + "</span> exercises, each counted once</li></ul></div>";
    var dr = h.drills;
    if (dr) head += '<div class="outcome" role="img" aria-label="Built-in drills: ' + dr.auto + " auto-checked, " + dr.self + " self-check, " + dr.review + " in review, " + dr.unchecked + " still unchecked, of " + dr.total + '"><div class="ob">' +
      [["ok", dr.auto], ["selfchk", dr.self], ["self", dr.review], ["noref", dr.unchecked]].map(function (x) { return x[1] ? '<span class="' + x[0] + '" style="flex:' + x[1] + '"></span>' : ""; }).join("") + '</div><ul class="ol">' +
      [["ok", "auto-checked", dr.auto], ["selfchk", "self-check", dr.self], ["self", "in review", dr.review], ["noref", "still unchecked", dr.unchecked]].map(function (x) { return '<li><i class="' + x[0] + '"></i><span class="mono">' + x[2].toLocaleString() + "</span> " + x[1] + "</li>"; }).join("") +
      '<li class="tot"><span class="mono">= ' + dr.total.toLocaleString() + '</span> built-in drills · <a href="#/review">review queue</a></li></ul></div>';
    return head + '<ul class="h-list">' + h.checks.map(function (c) {
      return '<li><a href="#/health?check=' + c.key + '"><span>' + esc(c.label) + '</span><span class="h-n mono ' + (c.issue ? (c.count ? "bad" : "ok") : "info") + '">' + c.count.toLocaleString() + "</span></a></li>";
    }).join("") + "</ul>";
  }
  function runHealth(btn) {
    btn.disabled = true;
    api("/health/run", "POST").then(function (r) { toast(r.started ? "Health check started: it runs in the background" : r.message); pollHealth(); }).catch(function (e) { btn.disabled = false; toast(e.message); });
  }
  function pollHealth() {
    clearTimeout(healthTimer);
    api("/health").then(function (h) {
      var card = $("#healthCard");
      if (card) card.innerHTML = healthList(h);
      counts.health = h.open; renderNav();
      if (h.running) healthTimer = setTimeout(pollHealth, 2000);
      else if (route.name === "health") viewHealth();
    });
  }
  function makeBackup(btn) {
    btn.disabled = true;
    api("/backups", "POST").then(function (b) {
      btn.disabled = false;
      if ($("#lastBk")) $("#lastBk").textContent = fmtDate(b.created_at, true);
      toast("Backup saved: " + b.name);
      var link = document.createElement("a"); link.href = "/api/admin/backups/" + encodeURIComponent(b.name) + "/download"; link.download = b.name; document.body.appendChild(link); link.click(); link.remove();
      if (route.name === "backups") viewBackups();
    }).catch(function (e) { btn.disabled = false; toast(e.message); });
  }

  // --- library health page
  var HEALTH_HELP = {
    near_dups: "In-browser drills whose prompts share at least 55% of their words. Many are the same task on different datasets: keep both, merge (progress carries over), or delete one.",
    failing: "Solutions that don't pass their own check: server exercises are run through the MySQL checker (rolled back), drills added in admin on their dataset.",
    leftover: "Titles or summaries that still contain text from the original source.",
    no_summary: "Exercises with a short title and no one-line summary, so the list says little about them.",
    broken_links: "Links inside a prompt to an exercise that is no longer in the library.",
    auto_setup: "Setup exercises hidden from learners: the checker runs them silently before the exercises listed under each one.",
  };
  function viewHealth() {
    var key = route.q.get("check");
    Promise.all([api("/health"), key ? api("/health/" + key) : Promise.resolve(null)]).then(function (r) {
      var h = r[0], det = r[1];
      counts.health = h.open; renderNav();
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Library health</div><h2 class="h1">' + (h.checks.length ? n(h.open) + " open issues" : "Not checked yet") + "</h2><p>Checks run in the background; the counts below are from the last run.</p></div></div>";
      html += '<section class="card card-pad" id="healthCard">' + healthList(h) + "</section>";
      html += '<section class="card card-pad" id="refsCard" aria-live="polite"><div class="empty-sm">Loading…</div></section>';
      if (det) {
        var c = h.checks.filter(function (x) { return x.key === key; })[0];
        html += '<section class="card card-pad"><div class="card-h"><h3>' + esc(c ? c.label : key) + ' <span class="mono muted">' + (c ? c.count : det.rows.length) + '</span></h3><a class="more link" href="#/health">Close</a></div><p class="muted small" style="margin:0 0 12px">' + esc(HEALTH_HELP[key] || "") + (c && c.note ? " " + esc(c.note) + "." : "") + "</p>";
        if (!det.rows.length) html += '<div class="empty-sm">Nothing here.</div>';
        else if (key === "near_dups") {
          var page = Number(route.q.get("page")) || 0, size = 15, rows = det.rows.slice(page * size, page * size + size);
          var side = function (x, label) { return '<div class="pair-side"><div class="muted small">' + label + " · Level " + x.level + " · " + esc(x.diff) + ' · <span class="mono">' + esc(x.tables.join(", ") || x.dataset) + '</span></div><a href="#/item/' + x.id + '"><b>' + esc(x.title) + '</b></a><p class="small">' + esc(x.body.slice(0, 260)) + "</p></div>"; };
          html += rows.map(function (p) {
            return '<div class="pair" data-a="' + p.a + '" data-b="' + p.b + '"><div class="pair-h"><span class="mono">' + p.sim + "% similar</span>" + (p.sameDataset ? '<span class="flag self">same dataset</span>' : '<span class="muted small">different datasets</span>') + '</div><div class="pair-body">' + side(p.left, "A") + side(p.right, "B") + "</div>" +
              '<div class="actions"><button type="button" class="btn sm" data-dec="keep_both">Keep both</button><button type="button" class="btn sm" data-dec="merge" data-keep="' + p.a + '">Merge, keep A</button><button type="button" class="btn sm" data-dec="merge" data-keep="' + p.b + '">Merge, keep B</button><span class="grow"></span><button type="button" class="btn sm danger" data-dec="delete" data-keep="' + p.b + '">Delete A</button><button type="button" class="btn sm danger" data-dec="delete" data-keep="' + p.a + '">Delete B</button></div></div>';
          }).join("");
          var pages = Math.ceil(det.rows.length / size);
          if (pages > 1) html += '<div class="pager-row"><span class="mono">' + (page * size + 1) + "–" + Math.min(det.rows.length, (page + 1) * size) + " of " + det.rows.length + '</span><span class="grow"></span>' + (page ? '<a class="btn sm" href="#/health?check=near_dups&page=' + (page - 1) + '" aria-label="Previous page">' + icon("chevLeft") + "</a>" : "") + (page < pages - 1 ? '<a class="btn sm" href="#/health?check=near_dups&page=' + (page + 1) + '" aria-label="Next page">' + icon("chevRight") + "</a>" : "") + "</div>";
        } else if (key === "auto_setup") {
          html += det.rows.map(function (x) { return '<div class="setup"><a href="#/item/' + x.id + '"><b>' + esc(x.title) + '</b></a> <span class="muted small">' + esc(x.detail) + '</span><ul class="mini">' + x.supports.map(function (p) { return '<li><a href="#/item/' + p.id + '">' + esc(p.title) + '</a> <span class="muted small">· Level ' + p.level + "</span></li>"; }).join("") + "</ul></div>"; }).join("");
        } else {
          html += '<div class="table-wrap"><table class="admin-t"><thead><tr><th scope="col">Exercise</th><th scope="col">Level</th><th scope="col">Detail</th></tr></thead><tbody>' + det.rows.map(function (x) { return '<tr><td class="q"><a class="t-link" href="#/item/' + x.id + '"><b>' + esc(x.title) + "</b></a></td><td>" + x.level + '</td><td class="small">' + esc(x.detail || "") + "</td></tr>"; }).join("") + "</tbody></table></div>";
        }
        html += "</section>";
      }
      html += "</div></div>";
      view.innerHTML = html;
      if (h.running) pollHealth();
      loadRefs();
      view.onclick = function (e) {
        var run = e.target.closest('[data-act="health-run"]');
        if (run) return runHealth(run);
        var b = e.target.closest("[data-dec]");
        if (!b) return;
        var pair = b.closest(".pair"), dec = b.getAttribute("data-dec"), keep = b.getAttribute("data-keep");
        var words = { keep_both: "Keep both exercises?", merge: "Merge: keep the chosen one and move the other's progress to it?", delete: "Delete the other exercise from the library? (Its source text stays on disk.)" }[dec];
        if (!confirmClick(b, words)) return;
        api("/health/decide", "POST", { a: pair.getAttribute("data-a"), b: pair.getAttribute("data-b"), decision: dec, keep: keep }).then(function () { toast(dec === "keep_both" ? "Kept both" : dec === "merge" ? "Merged" : "Deleted"); refreshCounts(); viewHealth(); }).catch(function (er) { toast(er.message); });
      };
    }).catch(fail);
  }

  // --- backups page
  function viewBackups() {
    api("/backups").then(function (list) {
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Backups</div><h2 class="h1">' + plural(list.length, "backup") + '</h2><p>Each backup is a .zip with a copy of the database (exercises, MCQs, progress, settings tables) and the non-secret settings. API keys and passwords are never included.</p></div><div class="actions"><button type="button" class="btn primary" data-act="backup">' + icon("archive") + 'Back up now</button></div></div>';
      html += '<p class="muted">Last backup: <span class="mono" id="lastBk">' + fmtDate(list[0] && list[0].created_at, true) + "</span> · stored in sql-drills-server/backups</p>";
      html += '<section class="card"><div class="table-wrap"><table class="admin-t"><thead><tr><th scope="col">Created</th><th scope="col" class="n">Size</th><th scope="col" class="n">Exercises</th><th scope="col">Note</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
        (list.length ? list.map(function (b) {
          return '<tr data-name="' + esc(b.name) + '"><td class="mono">' + fmtDate(b.created_at, true) + '</td><td class="n">' + (b.bytes / 1048576).toFixed(1) + ' MB</td><td class="n">' + (b.exercises != null ? b.exercises.toLocaleString() : "–") + "</td><td>" + (b.label === "before-restore" ? "Automatic, before a restore" : b.label === "manual" ? "Backed up from admin" : esc(b.label)) + '</td><td class="acts"><a class="btn sm" href="/api/admin/backups/' + encodeURIComponent(b.name) + '/download" download>' + icon("download") + 'Download</a> <button type="button" class="btn sm danger" data-act="restore">' + icon("reset") + "Restore</button></td></tr>";
        }).join("") : '<tr><td colspan="5" class="empty-sm">No backups yet.</td></tr>') + "</tbody></table></div></section></div></div>";
      view.innerHTML = html;
      view.onclick = function (e) {
        var a = e.target.closest("[data-act]");
        if (!a) return;
        if (a.getAttribute("data-act") === "backup") return makeBackup(a);
        var name = a.closest("[data-name]").getAttribute("data-name");
        if (prompt("Restore " + name + "?\n\nThe current database (exercises, progress, settings tables) is replaced by the backup. A backup of the current state is taken first.\n\nType RESTORE to confirm.") !== "RESTORE") return;
        a.disabled = true;
        api("/backups/" + encodeURIComponent(name) + "/restore", "POST", { confirm: "RESTORE" }).then(function (r) { toast("Restored " + r.rows.toLocaleString() + " rows. Safety backup: " + r.safety); refreshCounts(); viewBackups(); }).catch(function (er) { a.disabled = false; toast(er.message); });
      };
    }).catch(fail);
  }

  // --- recently added
  function viewRecent() {
    api("/recent?days=365").then(function (r) {
      var drafts = r.items.filter(function (i) { return i.status !== "live"; });
      r.items = r.items.filter(function (i) { return i.status === "live"; });
      r.count = r.items.length;
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Recently added</div><h2 class="h1">' + n(r.count) + " new since the starting library</h2><p>The " + n(r.baseline) + " exercises imported 12–13 Oct are the starting library. Everything added after it is listed here by date, with its level, difficulty and source.</p></div></div>";
      if (drafts.length) html += '<p class="muted">Not counted: ' + n(drafts.length) + " " + (drafts.length === 1 ? "draft" : "drafts") + ' still in the <a href="#/review">review queue</a> or rejected.</p>';
      if (!r.items.length) html += '<section class="card card-pad"><p style="margin:0">' + n(0) + " new since the starting library (" + n(r.baseline) + " imported 12–13 Oct).</p></section>";
      else {
        var byDay = {};
        r.items.forEach(function (i) { var k = i.added_at.slice(0, 10); (byDay[k] = byDay[k] || []).push(i); });
        html += '<section class="card"><div class="table-wrap"><table class="admin-t"><thead><tr><th scope="col">Time</th><th scope="col">Item</th><th scope="col">Kind</th><th scope="col">Level</th><th scope="col">Difficulty</th><th scope="col">Source</th><th scope="col">Status</th></tr></thead>' +
          Object.keys(byDay).map(function (k) {
            var list = byDay[k];
            return '<tbody><tr class="day"><th colspan="7" scope="rowgroup">' + fmtDate(list[0].added_at) + ' · <span class="mono">' + list.length + "</span> " + (list.length === 1 ? "item" : "items") + "</th></tr>" + list.map(function (i) {
              var src = i.origin || (String(i.source || "").indexOf("ai:") === 0 || i.source === "generated" ? "generated" : i.source === "imported" ? "imported" : "manual");
              return '<tr><td class="mono small">' + new Date(i.added_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) + '</td><td class="q">' + (i.kind.indexOf("exercise") === 0 ? '<a class="t-link" href="#/item/' + i.id + '">' + esc(i.title) + "</a>" : esc(i.title)) + "</td><td>" + esc(i.kind) + "</td><td>" + (i.level ? esc(levelLabel(i.level)) : "–") + "</td><td>" + (i.diff ? diffBadge(i.diff) : "–") + "</td><td>" + src + '</td><td><span class="sbadge ' + (i.status === "live" ? "published" : i.status) + '">' + esc(i.status) + "</span></td></tr>";
            }).join("") + "</tbody>";
          }).join("") + "</table></div></section>";
      }
      html += "</div></div>";
      view.innerHTML = html;
    }).catch(fail);
  }

  // --- import
  function parseCsv(text) {
    var rows = [], row = [], cell = "", q = false;
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (q) { if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch; }
      else if (ch === '"') q = true;
      else if (ch === ",") { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); cell = ""; if (row.some(function (c) { return c.trim(); })) rows.push(row); row = []; }
      else cell += ch;
    }
    row.push(cell); if (row.some(function (c) { return c.trim(); })) rows.push(row);
    if (!rows.length) return [];
    var head = rows[0];
    return rows.slice(1).map(function (r) { var o = {}; head.forEach(function (h, k) { o[h] = r[k] == null ? "" : r[k]; }); return o; });
  }
  function openImport() {
    var rows = null;
    $("#modalBody").innerHTML = '<div class="modal-h"><h2>Import exercises</h2><button class="icon-btn" data-act="close" aria-label="Close">' + icon("x") + "</button></div>" +
      '<div class="modal-b form"><p class="muted small" style="margin:0">A CSV (with a header row) or a JSON array. Columns: <span class="mono">title, prompt, solution, level, difficulty, dataset, summary</span>. Every solution is run on its dataset first; rows that fail go to the review queue marked red, the rest go live in their level.</p>' +
      '<label>File<input type="file" id="impFile" accept=".csv,.json,text/csv,application/json"></label>' +
      '<div class="row3"><label>Level when missing' + selectHtml("ilevel", [["", "– none –"]].concat(levelOptions()), "") + "</label><label>Difficulty when missing" + selectHtml("idiff", [["", "– none –"]].concat(diffOptions()), "") + "</label><label>Dataset when missing" + selectHtml("idataset", [["", "– none –"]].concat(datasetOptions()), "") + "</label></div>" +
      '<div id="impOut"></div><div class="actions"><button type="button" class="btn" data-act="preview" disabled>' + icon("play") + 'Preview and run solutions</button><span class="grow"></span><button type="button" class="btn ok" data-act="commit" disabled>Import</button></div></div>';
    modal.showModal();
    var defaults = function () { return { level: modal.querySelector('[name="ilevel"]').value, diff: modal.querySelector('[name="idiff"]').value, dataset: modal.querySelector('[name="idataset"]').value }; };
    $("#impFile").addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (!f) return;
      f.text().then(function (t) {
        try { rows = /\.json$/i.test(f.name) || /^\s*[[{]/.test(t) ? JSON.parse(t) : parseCsv(t); if (!Array.isArray(rows)) rows = rows.rows || []; }
        catch (er) { rows = null; $("#impOut").innerHTML = '<div class="err">Could not read the file: ' + esc(er.message) + "</div>"; return; }
        $("#impOut").innerHTML = '<p class="muted small">' + plural(rows.length, "row") + " read. Press Preview.</p>";
        modal.querySelector('[data-act="preview"]').disabled = !rows.length;
      });
    });
    modal.onclick = function (e) {
      var a = e.target.closest("[data-act]");
      if (!a) return;
      var act = a.getAttribute("data-act");
      if (act === "close") return modal.close();
      if (act === "preview") {
        a.disabled = true; $("#impOut").innerHTML = '<p class="muted small">Running ' + plural(rows.length, "solution") + "…</p>";
        api("/import/preview", "POST", { rows: rows, defaults: defaults() }).then(function (p) {
          a.disabled = false;
          var ok = p.filter(function (x) { return x.status === "pass" || x.status === "warn"; }).length, bad = p.filter(function (x) { return x.status === "fail"; }).length, inv = p.filter(function (x) { return x.status === "invalid"; }).length;
          $("#impOut").innerHTML = '<p class="small"><b>' + ok + "</b> will go live · <b>" + bad + "</b> go to the review queue (solution failed) · <b>" + inv + '</b> skipped (missing fields)</p><div class="result-box"><table><thead><tr><th>#</th><th>Title</th><th>Level</th><th>Diff.</th><th>Dataset</th><th>Result</th></tr></thead><tbody>' +
            p.map(function (x) { return "<tr><td class=\"mono\">" + x.row + "</td><td>" + esc(x.data.title) + '</td><td class="mono">' + (x.data.level || "–") + "</td><td>" + esc(x.data.diff) + "</td><td>" + esc(x.data.dataset) + "</td><td>" + (x.status === "invalid" ? '<span class="vbadge fail">Skipped</span> ' + esc(x.problems.join("; ")) : vbadge({ status: x.status }) + (x.rows != null ? ' <span class="muted small">' + x.rows + " rows</span>" : "") + (x.checks.length ? '<div class="muted small">' + esc(x.checks.join("; ")) + "</div>" : "")) + "</td></tr>"; }).join("") + "</tbody></table></div>";
          modal.querySelector('[data-act="commit"]').disabled = !(ok + bad);
        }).catch(function (er) { a.disabled = false; $("#impOut").innerHTML = '<div class="err">' + esc(er.message) + "</div>"; });
      }
      if (act === "commit") {
        a.disabled = true;
        api("/import/commit", "POST", { rows: rows, defaults: defaults() }).then(function (r) { modal.close(); toast(r.published + " imported live · " + r.queued + " to the review queue · " + r.skipped + " skipped"); refreshCounts(); render(); }).catch(function (er) { a.disabled = false; toast(er.message); });
      }
    };
  }

  // --- library: every exercise, filterable
  function diffBadge(d) { return '<span class="dbadge ' + d + '">' + d.charAt(0).toUpperCase() + d.slice(1) + "</span>"; }
  function viewLibrary() {
    var q = route.q, f = { level: q.get("level") || "", diff: q.get("diff") || "", check: q.get("check") || "", engine: q.get("engine") || "", origin: q.get("origin") || "", q: q.get("q") || "", page: Number(q.get("page")) || 0, section: q.get("section") || "" };
    var qs = function (over) { var o = Object.assign({}, f, over), p = new URLSearchParams(); Object.keys(o).forEach(function (k) { if (o[k] !== "" && o[k] != null && !(k === "page" && !o[k])) p.set(k, o[k]); }); return "#/library" + (p.toString() ? "?" + p : ""); };
    Promise.all([api("/library/items?" + new URLSearchParams(f)), api("/library"), api("/drills")]).then(function (r) {
      var res = r[0], lib = r[1], extra = r[2];
      var html = '<div class="page admin"><div class="col"><div class="hero"><div><div class="eyebrow">Library</div><h2 class="h1">' + plural(lib.total, "exercise") + " in " + lib.levels.length + ' levels</h2><p>Every exercise learners can practise. Filter, search, and open one to see its prompt, solution and where it came from.</p></div>' +
        '<div class="actions"><a class="btn" href="#/drills">' + icon("code") + "Drills added in admin (" + extra.length + ')</a><a class="btn primary" href="#/generate">' + icon("spark") + "Generate</a></div></div>";
      var sel = function (id, label, opts, val) { return '<label class="sr-only" for="' + id + '">' + label + '</label><select class="inp" id="' + id + '" data-f="' + id.slice(2) + '">' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(val) ? " selected" : "") + ">" + esc(o[1]) + "</option>"; }).join("") + "</select>"; };
      html += '<form class="toolbar" id="libForm" role="search" aria-label="Search the library"><label class="search-inline"><span class="sr-only">Search the library</span>' + icon("search") + '<input id="lfq" name="q" value="' + esc(f.q) + '" placeholder="Search titles, prompts, tables…"></label>' +
        sel("lflevel", "Level", [["", "All levels"]].concat(lib.levels.map(function (L) { return [L.n, L.n + " · " + L.title + " (" + L.total + ")"]; })), f.level) +
        sel("lfdiff", "Difficulty", [["", "Any difficulty"], ["easy", "Easy"], ["medium", "Medium"], ["hard", "Hard"]], f.diff) +
        sel("lfcheck", "Checking", [["", "Any checking"], ["auto", "Auto-checked"], ["self", "Self-check"]], f.check) +
        sel("lfengine", "Runs", [["", "Browser + server"], ["browser", "In the browser"], ["server", "On the server"]], f.engine) +
        sel("lforigin", "Origin", [["", "Any origin"]].concat(res.origins.map(function (o) { return [o, o.charAt(0).toUpperCase() + o.slice(1)]; })), f.origin) +
        '<button class="btn" type="submit">' + icon("search") + "Search</button></form>";
      html += '<section class="card"><div class="table-wrap"><table class="admin-t"><caption class="sr-only">Exercises</caption><thead><tr><th scope="col">Exercise</th><th scope="col">Level</th><th scope="col">Difficulty</th><th scope="col">Tables</th><th scope="col">Checking</th><th scope="col">Origin</th></tr></thead><tbody>' +
        (res.items.length ? res.items.map(function (i) {
          return '<tr><td class="q"><a class="t-link" href="#/item/' + i.id + '"><b>' + esc(i.title) + "</b></a>" + (i.summary ? '<div class="muted small">' + esc(i.summary) + "</div>" : "") + '</td><td class="nowrap">' + i.level + ' · <span class="mono">#' + i.seq + "</span></td><td>" + diffBadge(i.diff) + '</td><td class="mono small">' + esc(i.tables.join(", ")) + "</td><td>" + (i.check === "self" ? "Self-check" : "Auto") + " · " + (i.engine === "server" ? "server" : "browser") + "</td><td>" + esc(i.origin) + "</td></tr>";
        }).join("") : '<tr><td colspan="6" class="empty-sm">Nothing matches these filters.</td></tr>') + "</tbody></table></div>" +
        '<div class="pager-row"><span><span class="mono">' + (res.total ? res.page * res.size + 1 : 0) + "–" + Math.min(res.total, (res.page + 1) * res.size) + '</span> of <span class="mono">' + res.total.toLocaleString() + '</span></span><span class="grow"></span>' +
        (res.page > 0 ? '<a class="btn sm" href="' + qs({ page: res.page - 1 }) + '" aria-label="Previous page">' + icon("chevLeft") + "</a>" : "") + '<span class="mono">' + (res.page + 1) + " / " + res.pages + "</span>" +
        (res.page < res.pages - 1 ? '<a class="btn sm" href="' + qs({ page: res.page + 1 }) + '" aria-label="Next page">' + icon("chevRight") + "</a>" : "") + "</div></section></div></div>";
      view.innerHTML = html;
      $("#libForm").addEventListener("submit", function (e) { e.preventDefault(); location.hash = qs({ q: $("#lfq").value.trim(), page: 0 }); });
      $$("#libForm select").forEach(function (el) { el.addEventListener("change", function () { var o = { page: 0 }; o[el.getAttribute("data-f")] = el.value; location.hash = qs(o); }); });
    }).catch(fail);
  }

  // --- one exercise
  function viewItem() {
    api("/item/" + encodeURIComponent(route.args[0])).then(function (it) {
      var html = '<div class="page admin"><div class="col"><nav class="crumbs" aria-label="Breadcrumb"><a href="#/library">Library</a>' + icon("chevRight") + '<a href="#/library?level=' + it.level + '">Level ' + it.level + "</a>" + icon("chevRight") + "<span>#" + it.seq + "</span></nav>";
      if (it.auto_setup) html += '<div class="note-box">' + icon("db") + "<div><b>Setup exercise (auto_setup).</b> Hidden from learners and not counted: the checker runs it silently before the " + it.supports.length + " exercises listed under Supports.</div></div>";
      html += '<div class="hero"><div><div class="eyebrow">Level ' + it.level + " · " + esc(it.level_title) + '</div><h2 class="h1">' + esc(it.title) + "</h2>" + (it.summary ? "<p>" + esc(it.summary) + "</p>" : "") + '</div><div class="actions"><a class="btn" href="/#/drill/' + it.id + '" target="_blank" rel="noopener">' + icon("external") + "Open in the learner app</a></div></div>";
      html += '<div class="grid2"><section class="card card-pad"><div class="card-h"><h3>Prompt</h3></div><pre class="item-body">' + esc(String(it.body).replace(/\[\[ref:[^|]+\|([^\]]+)\]\]/g, "“$1”")) + "</pre>" +
        (it.solution ? '<div class="card-h" style="margin-top:16px"><h3>Solution</h3></div><pre class="sol">' + esc(it.solution) + "</pre>" : '<p class="muted small" style="margin-top:14px">No stored solution: this exercise is done when the query runs.</p>') + "</section>" +
        '<section class="card card-pad"><div class="card-h"><h3>Details</h3></div><dl class="kv">' +
        "<dt>Difficulty</dt><dd>" + diffBadge(it.diff) + "</dd><dt>Checking</dt><dd>" + (it.check === "self" ? "Self-check (can't be checked automatically)" : "Auto-checked") + " · runs " + (it.engine === "server" ? "on the server (MySQL / PostgreSQL)" : "in the browser (SQLite)") + "</dd>" +
        '<dt>Tables</dt><dd class="mono">' + (esc(it.tables.join(", ")) || "–") + "</dd><dt>Origin</dt><dd>" + esc(it.origin) + ' <span class="muted mono small">' + esc(it.source_ref) + "</span></dd>" +
        '<dt>Added</dt><dd class="mono">' + new Date(it.added_at).toLocaleString() + "</dd>" + (it.original_title !== it.title ? "<dt>Original title</dt><dd>" + esc(it.original_title) + "</dd>" : "") +
        "<dt>Builds on</dt><dd>" + (it.prereqs.length ? it.prereqs.map(function (p) { return '<a href="#/item/' + p.id + '">' + esc(p.title) + "</a>" + (p.auto ? ' <span class="flag info">setup · runs automatically</span>' : ""); }).join("<br>") : "–") + "</dd>" +
        (it.auto_setup ? "<dt>Supports</dt><dd>" + it.supports.map(function (p) { return '<a href="#/item/' + p.id + '">' + esc(p.title) + '</a> <span class="muted small">· Level ' + p.level + "</span>"; }).join("<br>") + "</dd>" : "") +
        "<dt>Links to</dt><dd>" + (it.refs.length ? it.refs.map(function (p) { return p.ok ? '<a href="#/item/' + p.id + '">' + esc(p.title) + "</a>" : '<span class="bad-txt">' + esc(p.title) + " (broken)</span>"; }).join("<br>") : "–") + "</dd></dl></section></div></div></div>";
      view.innerHTML = html;
    }).catch(fail);
  }

  // ---------- global search (Ctrl+K) ----------
  var sIn = $("#searchInput"), sOut = $("#searchResults"), sHits = [], sActive = 0, sTimer = null;
  function hrefOf(g, it) { return g === "exercises" ? "#/item/" + it.id : g === "mcqs" ? "#/mcqs?open=" + encodeURIComponent(it.id) : "#/library?level=" + it.id; }
  function closeSearch() { sOut.hidden = true; sIn.setAttribute("aria-expanded", "false"); sIn.removeAttribute("aria-activedescendant"); }
  function paintActive() {
    $$('[role="option"]', sOut).forEach(function (b, i) { b.classList.toggle("on", i === sActive); b.setAttribute("aria-selected", String(i === sActive)); });
    if (sHits[sActive]) { sIn.setAttribute("aria-activedescendant", "sr-" + sActive); var el = $("#sr-" + sActive); if (el) el.scrollIntoView({ block: "nearest" }); }
  }
  function runSearch() {
    var q = sIn.value.trim();
    if (q.length < 2) { closeSearch(); return; }
    api("/search?q=" + encodeURIComponent(q)).then(function (r) {
      if (sIn.value.trim() !== q) return;
      sHits = []; var html = "";
      r.groups.forEach(function (g) {
        html += '<div class="sr-grp" role="presentation">' + g.label + "<span>" + g.total.toLocaleString() + "</span></div>";
        g.items.forEach(function (it) { var k = sHits.length; sHits.push(hrefOf(g.key, it)); html += '<button type="button" role="option" id="sr-' + k + '" data-k="' + k + '" aria-selected="false"><div class="sr-t">' + esc(it.title) + '</div><div class="sr-s">' + esc(it.sub) + "</div></button>"; });
        if (g.key === "exercises" && g.total > g.items.length) html += '<a class="sr-all" href="#/library?q=' + encodeURIComponent(q) + '">See all ' + g.total.toLocaleString() + " exercises in the Library</a>";
      });
      sOut.innerHTML = html || '<div class="sr-empty">Nothing matches “' + esc(q) + "”.</div>";
      sActive = 0; sOut.hidden = false; sIn.setAttribute("aria-expanded", "true"); paintActive();
    }).catch(function () {});
  }
  function openHit(k) { if (!sHits[k]) return; location.hash = sHits[k]; closeSearch(); sIn.blur(); }
  sIn.addEventListener("input", function () { clearTimeout(sTimer); sTimer = setTimeout(runSearch, 160); });
  sIn.addEventListener("focus", function () { if (sIn.value.trim().length >= 2) runSearch(); });
  sIn.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!sHits.length) return; sActive = (sActive + (e.key === "ArrowDown" ? 1 : -1) + sHits.length) % sHits.length; paintActive(); }
    else if (e.key === "Enter") { e.preventDefault(); if (sHits.length && !sOut.hidden) openHit(sActive); else if (sIn.value.trim()) { location.hash = "#/library?q=" + encodeURIComponent(sIn.value.trim()); closeSearch(); } }
    else if (e.key === "Escape") { e.preventDefault(); closeSearch(); } // the list closes; focus stays in the box
  });
  sOut.addEventListener("mousedown", function (e) { var b = e.target.closest('[role="option"]'); if (b) { e.preventDefault(); openHit(Number(b.getAttribute("data-k"))); } });
  document.addEventListener("click", function (e) { if (!e.target.closest("#searchWrap")) closeSearch(); });
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); sIn.focus(); sIn.select(); }
  });

  function fail(e) { view.innerHTML = '<div class="page admin"><div class="err">' + esc(e.message) + "</div></div>"; }

  // ---------- router ----------
  // ---------- learning model: concepts, coverage, fill gaps (admin/learning.js) ----------
  var LSTAGES = ["memorize", "understand", "practise", "reflect", "transfer"];
  var LSTAGE_LABEL = { memorize: "Memorize", understand: "Understand", practise: "Practise", reflect: "Reflect", transfer: "Transfer" };
  var GEN_STAGES = [["flashcard", "Flashcards", "memorize · 5–10 per concept (not Level 14)"], ["predict", "Predict the output", "understand · 2–3 per concept"], ["practise", "Practise", "3+ exercises for thin concepts (not Level 14)"], ["transfer", "Transfer", "1–2 tasks on another dataset (not Level 14)"]];
  function kwList(k) { try { k = JSON.parse(k); } catch (e) {} return Array.isArray(k) ? k : String(k || "").split(/,\s*/).filter(Boolean); }
  function stageCell(c, stage) {
    if (c.na.indexOf(stage) > -1) return '<td class="n lc-na"><span aria-hidden="true">—</span><span class="sr-only">' + esc(c.naWhy || "not used") + '</span>' + (c.level !== 14 ? '<span class="lc-sub">Exception: ' + esc(c.naWhy || "") + "</span>" : "") + "</td>";
    var gap = c.gaps.indexOf(stage) > -1, live = c.live, d = c.drafts, main, sub = "";
    if (stage === "memorize") { main = live.flashcards + " cards"; sub = (d.flashcards ? "+" + d.flashcards + " draft" : "") + (live.memorizeMcq ? (d.flashcards ? " · " : "") + live.memorizeMcq + " MCQ" : ""); }
    else if (stage === "understand" && c.understandRule === "project") { main = "Concept card + " + live.transfer + (live.transfer === 1 ? " project task" : " project tasks"); sub = "Exception: " + c.understandNote; }
    else if (stage === "understand" && c.understandRule === "flashcards") { main = live.flashcards + " cards · " + (live.memorizeMcq + live.understandMcq) + " MCQ"; sub = (d.mcqs ? "+" + d.mcqs + " MCQ draft · " : "") + "Exception: " + c.understandNote; }
    else if (stage === "understand") { main = live.predicts + " predict"; sub = (d.predicts ? "+" + d.predicts + " draft" : "") + (live.understandMcq ? (d.predicts ? " · " : "") + live.understandMcq + " MCQ" : ""); }
    else if (stage === "practise") { main = live.practise + " exercises"; sub = d.practise ? "+" + d.practise + " draft" : ""; }
    else if (stage === "reflect") { return '<td class="n"><span class="lc-ok">Reflect box</span></td>'; }
    else { main = live.transfer + (live.transfer === 1 ? " task" : " tasks"); sub = d.transfer ? "+" + d.transfer + " draft" : ""; }
    var fixedByDrafts = gap && c.gapsWithDrafts.indexOf(stage) < 0;
    return '<td class="n' + (gap ? " lc-gap" : "") + '"><span class="mono">' + esc(main) + "</span>" + (gap ? '<span class="lc-flag">' + (fixedByDrafts ? "Gap · drafts waiting" : "Gap") + "</span>" : "") + (sub ? '<span class="lc-sub">' + esc(sub) + "</span>" : "") + "</td>";
  }
  function viewConcepts() {
    var lvq = Number(route.q.get("level")) || 0;
    view.innerHTML = '<div class="page admin"><div class="loading">Loading…</div></div>';
    api("/learning/coverage").then(function (cov) {
      var html = '<div class="page admin lconcepts"><div class="col"><div class="hero"><div><div class="eyebrow">Learning model</div><h2 class="h1">Concepts</h2><p>' + n(cov.total) + " concepts in 14 levels. A stage is covered when its live (approved) items reach the target: " +
        cov.target.flashcards + " flashcards, " + cov.target.predicts + " predict-the-output, " + cov.target.practise + " practise exercises and " + cov.target.transfer + " transfer task. Reflect is covered by the learner's reflection box. Level 14 has no flashcards and no practise.</p>" +
        '<p class="small"><b>Understand exceptions:</b> ' + esc(((cov.exceptions && cov.exceptions.flashcards) || []).join(", ")) + ": " + cov.target.flashcards + "+ flashcards and 1+ MCQ (no predict items). Level 14 project concepts: the concept card + project tasks. " + (cov.exceptions && cov.exceptions.noPractiseTransfer && cov.exceptions.noPractiseTransfer.length ? esc(cov.exceptions.noPractiseTransfer.join(", ")) + ": no practise or transfer (random results can't be checked). " : "") + " Predict items for data/structure concepts can be \"predict the end state\" items (a short MySQL or PostgreSQL script: final table or failing statement).</p></div></div>";
      html += '<section class="card kpis" aria-label="Coverage"><div class="kpi"><span class="kpi-l">All 5 stages covered</span><span class="kpi-v mono">' + cov.pct + '%</span><span class="kpi-s">' + cov.covered + " of " + cov.total + " concepts, live</span></div>" +
        '<div class="kpi"><span class="kpi-l">Once drafts are approved</span><span class="kpi-v mono">' + cov.pctWithDrafts + '%</span><span class="kpi-s">' + cov.coveredWithDrafts + " of " + cov.total + ' concepts</span></div>' +
        LSTAGES.filter(function (s) { return s !== "reflect"; }).map(function (s) { return '<div class="kpi"><span class="kpi-l">' + LSTAGE_LABEL[s] + ' gaps</span><span class="kpi-v mono' + (cov.gapCount[s] ? " bad" : "") + '">' + cov.gapCount[s] + '</span><span class="kpi-s">concepts below target</span></div>'; }).join("") + "</section>";
      html += '<div class="segs lvl-pick" role="group" aria-label="Level"><a class="seg' + (!lvq ? " on" : "") + '" href="#/concepts"' + (!lvq ? ' aria-current="true"' : "") + ">All</a>" + cov.levels.map(function (L) { return '<a class="seg' + (lvq === L.level ? " on" : "") + '" href="#/concepts?level=' + L.level + '"' + (lvq === L.level ? ' aria-current="true"' : "") + ">" + L.level + (L.covered < L.total ? ' <span class="seg-gap" aria-label="' + (L.total - L.covered) + ' with gaps">' + (L.total - L.covered) + "</span>" : "") + "</a>"; }).join("") + "</div>";
      cov.levels.filter(function (L) { return !lvq || L.level === lvq; }).forEach(function (L) {
        html += '<section class="card card-pad" aria-labelledby="lc-' + L.level + '"><div class="card-h"><h3 id="lc-' + L.level + '">' + icon("levels") + "Level " + L.level + '</h3><span class="muted small">' + L.covered + " of " + L.total + ' concepts fully covered</span><a class="btn sm" href="#/generate?kind=stage&level=' + L.level + '">' + icon("spark") + "Fill gaps for this level</a></div>" +
          '<div class="table-wrap"><table class="admin-t lcov-t"><caption class="sr-only">Stage coverage of the Level ' + L.level + ' concepts</caption><thead><tr><th scope="col">Concept</th>' + LSTAGES.map(function (s) { return '<th scope="col" class="n">' + LSTAGE_LABEL[s] + "</th>"; }).join("") + '<th scope="col"><span class="sr-only">Actions</span></th></tr></thead><tbody>' +
          L.concepts.map(function (c) {
            return '<tr data-slug="' + esc(c.slug) + '"><th scope="row" class="lc-name"><span class="mono muted">' + c.ord + "</span> <b>" + esc(c.name) + "</b>" + (c.tagsInReview ? ' <a class="flag warn" href="#/review?type=tag">' + c.tagsInReview + " tag" + (c.tagsInReview === 1 ? "" : "s") + " in review</a>" : "") + '<div class="muted small">' + esc(c.summary || "") + "</div></th>" +
              LSTAGES.map(function (s) { return stageCell(c, s); }).join("") +
              '<td class="acts"><button type="button" class="btn sm" data-lc="edit" aria-expanded="false">' + icon("edit") + "Edit</button> <button type=\"button\" class=\"btn sm\" data-lc=\"items\" aria-expanded=\"false\">" + icon("book") + "Items</button> <button type=\"button\" class=\"btn sm\" data-lc=\"retag\">" + icon("reset") + "Re-tag</button></td></tr>";
          }).join("") + "</tbody></table></div></section>";
      });
      html += "</div></div>";
      view.innerHTML = html;
      var byslug = {};
      cov.levels.forEach(function (L) { L.concepts.forEach(function (c) { byslug[c.slug] = c; }); });
      view.onclick = function (e) {
        var b = e.target.closest("[data-lc]");
        if (!b) return;
        var tr = b.closest("tr"), slug = tr && tr.getAttribute("data-slug"), c = byslug[slug], act = b.getAttribute("data-lc");
        if (act === "edit") {
          var open = tr.nextElementSibling && tr.nextElementSibling.classList.contains("lc-edit");
          if (open) { tr.nextElementSibling.remove(); b.setAttribute("aria-expanded", "false"); return; }
          b.setAttribute("aria-expanded", "true");
          tr.insertAdjacentHTML("afterend", '<tr class="lc-edit"><td colspan="7"><form class="lc-form" data-slug="' + esc(slug) + '"><label>Name <input class="inp" name="name" value="' + esc(c.name) + '" required></label><label>One-line summary <input class="inp" name="summary" value="' + esc(c.summary || "") + '"></label>' +
            '<label>Keywords <span class="muted small">(comma separated)</span><input class="inp mono" name="keywords" value="' + esc(kwList(c.keywords).join(", ")) + '"></label><label>Order <input class="inp" name="ord" type="number" min="1" value="' + c.ord + '"></label>' +
            '<div class="actions"><button class="btn sm primary" type="submit">' + icon("check") + 'Save</button><button class="btn sm" type="button" data-lc="cancel">Cancel</button></div></form></td></tr>');
          tr.nextElementSibling.querySelector("input").focus();
        } else if (act === "cancel") { var er = b.closest("tr.lc-edit"); var prevRow = er.previousElementSibling; er.remove(); var eb = prevRow.querySelector('[data-lc="edit"]'); eb.setAttribute("aria-expanded", "false"); eb.focus(); }
        else if (act === "items") {
          var openRow = tr.nextElementSibling && tr.nextElementSibling.classList.contains("lc-items");
          if (openRow) { tr.nextElementSibling.remove(); b.setAttribute("aria-expanded", "false"); return; }
          b.setAttribute("aria-expanded", "true");
          tr.insertAdjacentHTML("afterend", '<tr class="lc-items"><td colspan="7"><div class="empty-sm">Loading…</div></td></tr>');
          api("/learning/concepts/" + slug + "/items").then(function (r) {
            var cell = tr.nextElementSibling.querySelector("td");
            cell.innerHTML = '<p class="muted small" style="margin:0 0 8px">' + r.items.length + " tagged exercises and MCQs. Changing a stage here sets only that item's stage (the concept isn't re-tagged); it is logged in Review → History and can be undone there. An item tagged with several concepts has one stage for all of them.</p>" +
              '<div class="table-wrap"><table class="admin-t"><thead><tr><th scope="col">Item</th><th scope="col">Level</th><th scope="col">Stage</th></tr></thead><tbody>' +
              r.items.map(function (it) { return "<tr><td>" + (it.kind === "mcq" ? '<span class="tag mcq-tag">MCQ</span> ' : "") + esc(it.title) + (it.main ? "" : ' <span class="muted small">(secondary concept)</span>') + (it.status === "review" ? ' <span class="flag warn">tag in review</span>' : "") + (it.source === "admin" ? ' <span class="flag info">set by hand</span>' : "") + '</td><td class="n">' + it.level + "</td><td>" + stagePicker(it.key, it.kind, it.stage) + "</td></tr>"; }).join("") + "</tbody></table></div>" +
              (r.drafts.length ? '<p class="muted small" style="margin:8px 0 0">Generated drafts waiting in the review queue: ' + r.drafts.map(function (x) { return esc(x.title) + " (" + esc(x.stage) + ")"; }).join(", ") + "</p>" : "");
          }).catch(function (er) { tr.nextElementSibling.querySelector("td").innerHTML = '<div class="err">' + esc(er.message) + "</div>"; });
        }
        else if (act === "retag") {
          if (!confirmClick(b, "Re-tag the exercises and MCQs of “" + c.name + "”? The AI proposes their concepts again and a second provider reviews them; disagreements go to the review queue. Each item keeps its learning stage. Costs about $0.01–0.05.", "Re-tag")) return;
          b.disabled = true; b.innerHTML = '<span class="spin" aria-hidden="true"></span>Re-tagging…';
          api("/learning/concepts/" + slug + "/retag", "POST", {}).then(function (r) { toast("Re-tagged " + r.items + " items: " + r.changed + " changed, " + r.review + " to review · $" + r.cost.toFixed(3)); refreshCounts(); viewConcepts(); })
            .catch(function (er2) { b.disabled = false; b.innerHTML = icon("reset") + "Re-tag"; toast(er2.message); });
        }
      };
      view.onchange = function (e) { if (e.target.matches("[data-tagstage]")) setTagStage(e.target); };
      view.onsubmit = function (e) {
        var f = e.target.closest(".lc-form");
        if (!f) return;
        e.preventDefault();
        var body = { name: f.elements.name.value, summary: f.elements.summary.value, keywords: f.elements.keywords.value, ord: f.elements.ord.value };
        api("/learning/concepts/" + f.getAttribute("data-slug"), "POST", body).then(function () { toast("Concept saved"); viewConcepts(); }).catch(function (er) { toast(er.message); });
      };
    }).catch(fail);
  }
  // Overview: "Learning model coverage"
  function loadLearningCard() {
    var box = $("#lmCard");
    if (!box) return;
    api("/learning/coverage").then(function (cov) {
      box.innerHTML = '<div class="lm-big"><span class="mono">' + cov.pct + '%</span><span>of concepts have all 5 stages covered<br><span class="muted small">' + cov.covered + " of " + cov.total + " live · " + cov.pctWithDrafts + "% once drafts are approved</span></span></div>" +
        '<div class="lm-bar" role="img" aria-label="' + cov.pct + '% covered"><span style="width:' + cov.pct + '%"></span></div>' +
        '<ul class="mini lm-gaps">' + LSTAGES.filter(function (s) { return s !== "reflect"; }).map(function (s) { return "<li>" + LSTAGE_LABEL[s] + ': <b class="mono' + (cov.gapCount[s] ? " bad-n" : "") + '">' + cov.gapCount[s] + "</b> " + (cov.gapCount[s] === 1 ? "concept" : "concepts") + " below target</li>"; }).join("") + "<li>Reflect: covered by the reflection box</li></ul>";
    }).catch(function (e) { box.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
  }
  // Generate → Learning stages
  function viewStageGen() {
    var q = route.q, st = { level: Math.min(14, Math.max(1, Number(q.get("level")) || 1)), stage: q.get("stage") || "flashcard" };
    view.innerHTML = '<div class="page admin"><div class="loading">Loading…</div></div>';
    Promise.all([api("/library"), api("/learning/coverage"), api("/learning/fill")]).then(function (r) {
      var lib = r[0], cov = r[1], job = r[2];
      var html = '<div class="page admin gen"><div class="col"><div class="hero"><div><div class="eyebrow">Content generation machine</div><h2 class="h1">Generate practice content</h2><p>Learning-model stages: the AI fills what a level\'s concepts are missing. Every SQL is run, a second provider reviews, items with warnings get one repair round, and everything waits in the review queue.</p><p class="hint-txt" id="stageRoles"></p></div></div>';
      html += genTabs("stage");
      html += '<div class="gen-grid" role="tabpanel" aria-labelledby="tab-stage"><form class="gen-form" id="stageForm">';
      html += '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">1</span>Level</legend><div class="lvl-cards">' + lib.levels.map(function (L) {
        var C = cov.levels.filter(function (x) { return x.level === L.n; })[0] || { covered: 0, total: 0 };
        return '<label class="lvl-card"><input type="radio" name="level" value="' + L.n + '"' + (L.n === st.level ? " checked" : "") + '><span class="lc-n mono">' + L.n + '</span><span class="lc-t">' + esc(L.title) + '</span><span class="lc-c mono">' + C.covered + "/" + C.total + " covered</span></label>";
      }).join("") + "</div></fieldset>";
      html += '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">2</span>Stage</legend><div class="stage-pick">' + GEN_STAGES.map(function (s) {
        return '<label class="opt-chip stage-opt"><input type="radio" name="stage" value="' + s[0] + '"' + (s[0] === st.stage ? " checked" : "") + '><span><b>' + s[1] + '</b><small>' + s[2] + "</small></span></label>";
      }).join("") + "</div></fieldset>";
      html += '<div class="gen-bar" role="region" aria-label="Generate"><span class="gen-sum" id="stageEst" aria-live="polite">Estimating…</span><button class="btn" type="button" id="fillLevel">' + icon("layers") + 'Fill gaps for this level</button><button class="btn primary" type="submit" id="stageBtn">' + icon("spark") + "Generate this stage</button></div></form>";
      html += '<aside class="gen-side"><section class="card card-pad" id="fillJob" aria-live="polite"></section><section class="card card-pad"><div class="card-h"><h3>' + icon("layers") + 'Coverage</h3></div><p style="margin:0 0 10px"><span class="mono">' + cov.pct + "%</span> of concepts fully covered (" + cov.pctWithDrafts + '% with drafts).</p><a class="btn sm" href="#/concepts?level=' + st.level + '">Concepts of this level</a></section></aside></div></div></div>';
      view.innerHTML = html;
      wireGenTabs();
      loadRoles($("#stageRoles"), false);
      var form = $("#stageForm");
      var read = function () { st.level = Number(form.querySelector('[name="level"]:checked').value); st.stage = form.querySelector('[name="stage"]:checked').value; };
      var estimate = function () {
        read();
        $("#stageEst").textContent = "Estimating…";
        Promise.all([api("/learning/estimate?level=" + st.level + "&stages=" + st.stage), api("/learning/estimate?level=" + st.level)]).then(function (e) {
          var one = e[0], all = e[1], k = one.concepts[st.stage];
          var allN = Object.keys(all.concepts).reduce(function (a, x) { return a + all.concepts[x]; }, 0);
          $("#stageEst").innerHTML = "Level " + st.level + ": <b class=\"mono\">" + k + "</b> " + (k === 1 ? "concept needs" : "concepts need") + " " + esc(GEN_STAGES.filter(function (s) { return s[0] === st.stage; })[0][1].toLowerCase()) + " · about <b class=\"mono\">$" + one.estimate.toFixed(2) + "</b>" +
            '<br><span class="muted small">Fill gaps for this level: ' + allN + " concept-stages · about $" + all.estimate.toFixed(2) + "</span>";
          $("#stageBtn").disabled = !k || (job && job.running); $("#fillLevel").disabled = !allN || (job && job.running);
        }).catch(function (er) { $("#stageEst").textContent = er.message; });
      };
      var paintJob = function (j) {
        job = j;
        var box = $("#fillJob");
        if (!box) return;
        if (!j) { box.innerHTML = '<div class="card-h"><h3>' + icon("clock") + 'Fill-gaps runs</h3></div><div class="empty-sm">No run yet in this session of the server.</div>'; return; }
        var res = j.result;
        box.innerHTML = '<div class="card-h"><h3>' + icon("clock") + "Level " + j.level + " · " + esc(j.stages.join(", ")) + "</h3></div>" +
          (j.running ? '<p class="run-st running"><span class="spin" aria-hidden="true"></span>Generating…</p><p class="muted small mono">' + esc(j.progress || "") + "</p>"
            : j.error ? '<div class="err">' + esc(j.error) + "</div>"
            : '<dl class="kv3"><div><dt>Flashcards</dt><dd class="mono">' + res.made.flashcard + '</dd></div><div><dt>Predict</dt><dd class="mono">' + res.made.predict + '</dd></div><div><dt>Drills</dt><dd class="mono">' + res.made.drill + '</dd></div></dl><p class="muted small">Dropped (failed a check): ' + (res.dropped.flashcard + res.dropped.predict + res.dropped.drill) + " · cost $" + res.cost.toFixed(3) + '</p><a class="btn sm" href="#/review">Review the new items</a>');
        if (j.running) pollTimer = setTimeout(function () { api("/learning/fill").then(function (x) { paintJob(x); if (!x.running) { refreshCounts(); estimate(); } }); }, 2000);
      };
      paintJob(job); estimate();
      form.addEventListener("change", estimate);
      var start = function (stages, btn) {
        read();
        if (!confirmClick(btn, "Generate " + (stages.length > 1 ? "all missing stages" : stages[0]) + " for Level " + st.level + "? " + $("#stageEst").innerText.split("\n")[stages.length > 1 ? 1 : 0] + ". New items go to the review queue.", "Generate")) return;
        btn.disabled = true;
        api("/learning/fill", "POST", { level: st.level, stages: stages }).then(function (j) { toast("Generating… you can leave this page"); paintJob(j); }).catch(function (er) { btn.disabled = false; toast(er.message); });
      };
      form.addEventListener("submit", function (e) { e.preventDefault(); read(); start([st.stage], $("#stageBtn")); });
      $("#fillLevel").addEventListener("click", function () { start(["flashcard", "predict", "practise", "transfer"], $("#fillLevel")); });
    }).catch(fail);
  }
  // Generate → From images: paste / drop / pick screenshots, read them (vision model), fix the preview, pick a
  // dataset (or a new one from the rows), generate drafts through the normal checks. Nothing is approved here.
  var IMG = { files: [], batch: null, items: null, job: null };
  var IMG_TYPES = [["auto", "Auto", "the model picks per item"], ["drill", "Exercise", "the learner writes SQL"], ["mcq", "Multiple choice", ""], ["flashcard", "Flashcards", ""], ["predict", "Predict the output", ""]];
  function viewImageGen() {
    view.innerHTML = '<div class="page admin"><div class="loading">Loading…</div></div>';
    api("/images/meta").then(function (meta) {
      var html = '<div class="page admin gen"><div class="col"><div class="hero"><div><div class="eyebrow">Content generation machine</div><h2 class="h1">Generate practice content</h2><p>From screenshots: the images are read by a vision model, you correct what it read, and each item then goes through the same checks as every generated item. Everything lands as a draft in the review queue.</p></div></div>';
      html += genTabs("images");
      html += '<div class="gen-grid" role="tabpanel" aria-labelledby="tab-images"><form class="gen-form" id="imgForm" onsubmit="return false">';
      html += '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">1</span>Screenshots</legend>' +
        '<div class="img-drop" id="imgDrop" tabindex="0" role="button" aria-describedby="imgDropHelp"><b>Paste (Ctrl+V), drop, or choose images</b><span id="imgDropHelp" class="muted small">PNG or JPG, up to 10 at once, 8 MB each</span><input type="file" id="imgPick" accept="image/png,image/jpeg" multiple hidden></div>' +
        '<ul class="img-thumbs" id="imgThumbs" aria-label="Chosen images"></ul><p class="muted small" id="imgReadEst" aria-live="polite"></p></fieldset>';
      html += '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">2</span>Output type</legend><div class="stage-pick">' + IMG_TYPES.map(function (t, i) {
        return '<label class="opt-chip stage-opt"><input type="radio" name="itype" value="' + t[0] + '"' + (i === 0 ? " checked" : "") + "><span><b>" + t[1] + "</b>" + (t[2] ? "<small>" + t[2] + "</small>" : "") + "</span></label>";
      }).join("") + "</div></fieldset>";
      html += '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">3</span>Read the images</legend><p class="muted small">The vision model (' + esc(meta.reader.model) + ") extracts the task text, the tables and rows shown and any expected answer. You can fix everything before generating.</p>" +
        '<button type="button" class="btn primary" id="imgRead" disabled>' + icon("eye") + 'Read the images</button><div id="imgItems" class="img-items" aria-live="polite"></div></fieldset>';
      html += '<fieldset class="gstep"><legend><span class="gnum" aria-hidden="true">4</span>Dataset</legend><label class="fld"><span>Run the items on</span><select id="imgDataset"><option value="new">A new dataset from the rows in the images</option>' +
        meta.datasets.map(function (d) { return '<option value="' + esc(d.key) + '">' + esc(d.label) + "</option>"; }).join("") + "</select></label>" +
        '<div id="imgNew"><label class="fld"><span>Name of the new dataset</span><input id="imgDsName" maxlength="80" placeholder="e.g. Book shop orders"></label><button type="button" class="btn sm" id="imgDsCheck" disabled>' + icon("check") + 'Check the new dataset</button><div id="imgDsOut" aria-live="polite"></div></div></fieldset>';
      html += '<div class="gen-bar" role="region" aria-label="Generate"><span class="gen-sum" id="imgEst" aria-live="polite">Read the images first.</span><button class="btn primary" type="button" id="imgGo" disabled>' + icon("spark") + "Generate drafts</button></div>";
      html += "</form>";
      html += '<aside class="gen-side"><section class="card card-pad" id="imgJob" aria-live="polite"><div class="card-h"><h3>' + icon("inbox") + 'This batch</h3></div><p class="muted small">Nothing yet.</p></section>' +
        '<section class="card card-pad"><div class="card-h"><h3>' + icon("eye") + 'Privacy</h3></div><ul class="mini"><li>Images are kept on this computer only and are never shown to learners.</li><li>Website, book and author names are left out of everything generated.</li><li>Reader: ' + esc(meta.reader.model) + " · review: " + esc(meta.reviewer.model) + ".</li><li>Nothing is approved: every item waits in the review queue.</li></ul></section></aside></div></div></div>";
      view.innerHTML = html;
      wireGenTabs();
      IMG.files = []; IMG.batch = null; IMG.items = null;
      imgWire();
    }).catch(function (e) { view.innerHTML = '<div class="page admin"><div class="err">' + esc(e.message) + "</div></div>"; });
  }
  function imgType() { var r = document.querySelector('[name="itype"]:checked'); return r ? r.value : "auto"; }
  function imgAdd(files) {
    [].slice.call(files || []).forEach(function (f) {
      if (!/^image\/(png|jpeg)$/.test(f.type)) { toast((f.name || "That file") + " isn't a PNG or JPG."); return; }
      if (f.size > 8 * 1024 * 1024) { toast((f.name || "An image") + " is larger than 8 MB."); return; }
      if (IMG.files.length >= 10) { toast("At most 10 images per batch."); return; }
      var entry = { file: f, url: URL.createObjectURL(f), w: 0, h: 0 };
      var im = new Image(); im.onload = function () { entry.w = im.naturalWidth; entry.h = im.naturalHeight; imgEstimateRead(); }; im.src = entry.url;
      IMG.files.push(entry);
    });
    IMG.batch = null; // new images: read again
    imgThumbs();
  }
  function imgThumbs() {
    $("#imgThumbs").innerHTML = IMG.files.map(function (e, i) {
      return '<li class="img-thumb"><img src="' + e.url + '" alt="Screenshot ' + (i + 1) + '"><button type="button" class="btn sm" data-img-remove="' + i + '" aria-label="Remove screenshot ' + (i + 1) + '">' + icon("trash") + "</button></li>";
    }).join("");
    $("#imgRead").disabled = !IMG.files.length;
    imgEstimateRead();
  }
  function imgEstimateRead() {
    var el = $("#imgReadEst"); if (!el) return;
    if (!IMG.files.length) { el.textContent = ""; return; }
    api("/images/estimate", "POST", { dims: IMG.files.map(function (e) { return { w: e.w || 1200, h: e.h || 800 }; }) }).then(function (r) {
      el.innerHTML = "Reading " + plural(IMG.files.length, "image") + ": about <b class=\"mono\">$" + r.extract.dollars.toFixed(4) + "</b>";
    }).catch(function () {});
  }
  function toDataUrl(f) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(f); }); }
  // the editable preview: one card per item; tables as "column | column" lines
  function tableText(t) { return t.name + "\n" + t.columns.join(" | ") + "\n" + t.rows.map(function (r) { return r.map(function (v) { return v === null ? "NULL" : String(v); }).join(" | "); }).join("\n"); }
  function parseTable(txt) {
    var lines = String(txt || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (lines.length < 2) return null;
    var cols = lines[1].split("|").map(function (c) { return c.trim(); });
    return { name: lines[0], columns: cols, rows: lines.slice(2).map(function (l) { return l.split("|").map(function (v) { v = v.trim(); return /^null$/i.test(v) ? null : /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v; }); }) };
  }
  function imgItemsHtml() {
    if (!IMG.items.length) return '<p class="muted small">No SQL exercise, question or table was found in these images.</p>';
    return IMG.items.map(function (it, i) {
      var id = "it" + i;
      return '<section class="img-item" data-item="' + i + '" aria-labelledby="' + id + 'h"><div class="card-h"><h4 id="' + id + 'h">Item ' + (i + 1) + ' <span class="tag plain">' + esc(it.kind) + "</span></h4><button type=\"button\" class=\"btn sm\" data-item-remove=\"" + i + '" aria-label="Remove item ' + (i + 1) + '">' + icon("trash") + "Remove</button></div>" +
        '<label class="fld"><span>Task / question</span><textarea rows="3" data-f="task">' + esc(it.task) + "</textarea></label>" + '<div class="img-acts"><button type="button" class="btn sm" data-enhance="' + i + '">' + icon("wand") + (it.task ? "Enhance the question" : "Write a question") + '</button><span class="muted small" data-enhance-out="' + i + '" aria-live="polite"></span></div>' +
        '<label class="fld"><span>SQL shown (if any)</span><textarea rows="3" class="mono" data-f="query" spellcheck="false">' + esc(it.query) + "</textarea></label>" +
        (it.tables || []).map(function (t, k) {
          var empty = !t.rows.length;
          return '<div class="img-table"><label class="fld"><span>Table ' + (k + 1) + ' (first line: name, then columns, then rows; separate values with |)' + (t.sample ? ' <span class="tag plain">Sample data (generated)</span>' : "") + '</span><textarea rows="' + Math.min(12, 3 + t.rows.length) + '" class="mono" data-table="' + k + '" spellcheck="false">' + esc(tableText(t)) + "</textarea></label>" +
            ((t.types || []).some(Boolean) ? '<p class="muted small img-types">Types shown: ' + t.columns.map(function (c, j) { return esc(c) + " " + esc((t.types || [])[j] || "?"); }).join(", ") + "</p>" : "") +
            (empty ? '<div class="img-empty" role="note">' + icon("warn") + '<span>The screenshot shows only this table\'s structure, with no data rows. Generate sample rows (you can edit them), type a few rows, or pick an existing dataset in step 4.</span><button type="button" class="btn sm primary" data-gen-rows="' + i + ":" + k + '">' + icon("spark") + "Generate sample rows</button></div>" : "") + "</div>";
        }).join("") +
        (it.options && it.options.length ? '<label class="fld"><span>Options (one per line; start the right one with *)</span><textarea rows="' + (it.options.length + 1) + '" data-f="options">' + esc(it.options.map(function (o, k) { return (k === it.answer_index ? "*" : "") + o; }).join("\n")) + "</textarea></label>" : "") +
        '<label class="fld"><span>Expected answer (if shown)</span><input data-f="answer_text" value="' + esc(it.answer_text || "") + '"></label></section>';
    }).join("");
  }
  function imgReadBack() {
    // the preview as the admin edited it
    $$(".img-item").forEach(function (sec) {
      var it = IMG.items[Number(sec.getAttribute("data-item"))];
      sec.querySelectorAll("[data-f]").forEach(function (f) {
        var k = f.getAttribute("data-f");
        if (k === "options") { var lines = f.value.split("\n").map(function (l) { return l.trim(); }).filter(Boolean); it.answer_index = null; it.options = lines.map(function (l, j) { if (l.charAt(0) === "*") { it.answer_index = j; return l.slice(1).trim(); } return l; }); }
        else it[k] = f.value;
      });
      sec.querySelectorAll("[data-table]").forEach(function (f) { var k = Number(f.getAttribute("data-table")), t = parseTable(f.value), old = it.tables[k] || {}; if (t) it.tables[k] = { name: t.name, columns: t.columns, rows: t.rows, types: old.types, sample: old.sample }; });
      it.tables = (it.tables || []).filter(Boolean);
    });
    return IMG.items;
  }
  function imgEstimateGen() {
    if (!IMG.items) return;
    var items = imgReadBack();
    api("/images/estimate", "POST", { items: items, type: imgType() }).then(function (r) {
      $("#imgEst").innerHTML = items.length ? plural(items.length, "item") + ": about <b class=\"mono\">$" + r.generate.dollars.toFixed(3) + "</b> to generate and check" : "No items to generate.";
      $("#imgGo").disabled = !items.length || (IMG.job && IMG.job.running);
    }).catch(function (e) { $("#imgEst").textContent = e.message; });
  }
  function imgPaintJob(j) {
    IMG.job = j;
    var box = $("#imgJob"); if (!box) return;
    var h = '<div class="card-h"><h3>' + icon("inbox") + "This batch</h3></div>";
    if (j.running) h += '<p class="small"><span class="spin" aria-hidden="true"></span> ' + esc(j.progress || "Working…") + "</p>";
    if (j.error) h += '<div class="err">' + esc(j.error) + "</div>";
    if (j.dataset) h += '<p class="small">New dataset: <b>' + esc(j.dataset.label) + "</b> (" + j.dataset.tables.map(function (t) { return esc(t.name) + " " + t.rows + " rows"; }).join(", ") + ")</p>";
    if (!j.running) {
      h += '<p class="small"><b class="mono">' + j.made.length + "</b> draft" + (j.made.length === 1 ? "" : "s") + " made · cost <b class=\"mono\">$" + Number(j.cost || 0).toFixed(4) + "</b></p>";
      if (j.made.length) h += '<ul class="mini">' + j.made.map(function (m) { return "<li><span class=\"mono\">" + esc(m.id) + "</span> " + esc(m.kind) + " · " + esc(m.concept) + ' · <span class="' + (m.status === "pass" ? "ok-txt" : "warn-txt") + '">' + esc(m.status || "") + "</span></li>"; }).join("") + "</ul>";
      if (j.skipped.length) h += '<p class="muted small">Not made: ' + j.skipped.map(function (s) { return "item " + (s.i + 1) + " (" + esc(s.why) + ")"; }).join("; ") + "</p>";
      if (j.made.length) h += '<a class="btn sm" href="#/review">' + icon("inbox") + "Open the review queue</a>";
    }
    box.innerHTML = h;
    $("#imgGo").disabled = j.running || !(IMG.items && IMG.items.length);
  }
  function imgWire() {
    var drop = $("#imgDrop"), pick = $("#imgPick");
    drop.addEventListener("click", function () { pick.click(); });
    drop.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick.click(); } });
    pick.addEventListener("change", function () { imgAdd(pick.files); pick.value = ""; });
    drop.addEventListener("dragover", function (e) { e.preventDefault(); drop.classList.add("over"); });
    drop.addEventListener("dragleave", function () { drop.classList.remove("over"); });
    drop.addEventListener("drop", function (e) { e.preventDefault(); drop.classList.remove("over"); imgAdd(e.dataTransfer.files); });
    // Ctrl+V anywhere on this page (not inside a text field: there a paste is text)
    document.onpaste = function (e) {
      if (route.name !== "generate" || route.q.get("kind") !== "images") { document.onpaste = null; return; }
      var files = [].slice.call((e.clipboardData || {}).items || []).filter(function (x) { return x.kind === "file" && /^image\//.test(x.type); }).map(function (x) { return x.getAsFile(); });
      if (files.length) { e.preventDefault(); imgAdd(files); }
    };
    $("#imgThumbs").addEventListener("click", function (e) {
      var b = e.target.closest("[data-img-remove]"); if (!b) return;
      var i = Number(b.getAttribute("data-img-remove")); URL.revokeObjectURL(IMG.files[i].url); IMG.files.splice(i, 1); IMG.batch = null; imgThumbs();
      var next = $$("[data-img-remove]")[Math.min(i, IMG.files.length - 1)]; (next || drop).focus();
    });
    $("#imgRead").addEventListener("click", function () {
      var btn = $("#imgRead"); btn.disabled = true; $("#imgItems").innerHTML = '<p class="small"><span class="spin" aria-hidden="true"></span> Reading ' + plural(IMG.files.length, "image") + "…</p>";
      Promise.all(IMG.files.map(function (e) { return toDataUrl(e.file).then(function (d) { return { name: e.file.name, data: d }; }); }))
        .then(function (imgs) { return api("/images", "POST", { images: imgs }); })
        .then(function (b) { IMG.batch = b.batch; return api("/images/" + b.batch + "/extract", "POST", {}); })
        .then(function (r) { IMG.items = r.items; $("#imgItems").innerHTML = '<p class="muted small">Read for <b class="mono">$' + r.cost.toFixed(4) + "</b>. Fix anything below before generating.</p>" + imgItemsHtml(); btn.disabled = false; imgEstimateGen(); $("#imgDsCheck").disabled = false; })
        .catch(function (e) { $("#imgItems").innerHTML = '<div class="err">' + esc(e.message) + "</div>"; btn.disabled = false; });
    });
    $("#imgItems").addEventListener("click", function (e) {
      var g = e.target.closest("[data-gen-rows]");
      if (g) {
        imgReadBack();
        var ik = g.getAttribute("data-gen-rows").split(":"), it = IMG.items[Number(ik[0])], k = Number(ik[1]);
        g.disabled = true; g.innerHTML = '<span class="spin" aria-hidden="true"></span> Generating…';
        api("/images/" + IMG.batch + "/sample-rows", "POST", { table: it.tables[k], task: it.task }).then(function (r) {
          it.tables[k] = r.table; $("#imgItems").innerHTML = '<p class="muted small">Sample rows made for <b class="mono">$' + r.cost.toFixed(4) + "</b>: check and edit them before generating.</p>" + imgItemsHtml(); imgEstimateGen();
          var ta = document.querySelector('.img-item[data-item="' + ik[0] + '"] [data-table="' + k + '"]'); if (ta) ta.focus();
        }).catch(function (er) { g.disabled = false; g.textContent = "Generate sample rows"; toast(er.message); });
        return;
      }
      var en = e.target.closest("[data-enhance]");
      if (en) {
        imgReadBack();
        var n = Number(en.getAttribute("data-enhance")), item = IMG.items[n], out = document.querySelector('[data-enhance-out="' + n + '"]');
        en.disabled = true; out.textContent = "Working…";
        api("/images/" + IMG.batch + "/enhance", "POST", { item: item }).then(function (r) {
          item.task = r.task; if (r.answer_text && !item.answer_text) item.answer_text = r.answer_text;
          $("#imgItems").innerHTML = imgItemsHtml(); imgEstimateGen();
          var o2 = document.querySelector('[data-enhance-out="' + n + '"]'); if (o2) o2.textContent = (r.wrote ? "Question written" : "Question enhanced") + " for $" + r.cost.toFixed(4) + ": edit it if needed.";
          var t2 = document.querySelector('.img-item[data-item="' + n + '"] [data-f="task"]'); if (t2) t2.focus();
        }).catch(function (er) { en.disabled = false; out.textContent = ""; toast(er.message); });
        return;
      }
      var b = e.target.closest("[data-item-remove]"); if (!b) return;
      imgReadBack(); IMG.items.splice(Number(b.getAttribute("data-item-remove")), 1); $("#imgItems").innerHTML = imgItemsHtml(); imgEstimateGen();
    });
    $("#imgItems").addEventListener("change", imgEstimateGen);
    $("#imgForm").addEventListener("change", function (e) { if (e.target.name === "itype") imgEstimateGen(); if (e.target.id === "imgDataset") $("#imgNew").hidden = e.target.value !== "new"; });
    $("#imgDsCheck").addEventListener("click", function () {
      var out = $("#imgDsOut"); out.innerHTML = '<p class="small"><span class="spin" aria-hidden="true"></span> Checking on SQLite, MySQL and PostgreSQL…</p>';
      api("/images/" + IMG.batch + "/dataset", "POST", { items: imgReadBack() }).then(function (r) {
        out.innerHTML = '<ul class="mini">' + r.checks.map(function (k) { return '<li class="' + (k.ok ? "ok-txt" : "bad-txt") + '">' + (k.ok ? "✓ " : "✗ ") + esc(k.label) + (k.detail ? ": " + esc(k.detail) : "") + "</li>"; }).join("") + "</ul>" +
          "<details><summary class=\"small\">SQL (" + r.tables.map(function (t) { return esc(t.name) + " · " + t.rows + " rows"; }).join(", ") + ")</summary><pre class=\"sol\">" + esc(r.sql) + "</pre></details>";
      }).catch(function (e) { out.innerHTML = '<div class="err">' + esc(e.message) + "</div>"; });
    });
    $("#imgGo").addEventListener("click", function () {
      if (!IMG.batch || !IMG.items) return;
      var ds = $("#imgDataset").value;
      if (ds === "new") {
        var emptyT = [].concat.apply([], imgReadBack().map(function (it) { return it.tables || []; })).filter(function (t) { return !t.rows.length; });
        if (emptyT.length) { toast("No data rows in " + emptyT.map(function (t) { return t.name; }).join(", ") + ": generate sample rows first, or pick an existing dataset."); var gb = document.querySelector("[data-gen-rows]"); if (gb) gb.focus(); return; }
      }
      api("/images/" + IMG.batch + "/generate", "POST", { items: imgReadBack(), type: imgType(), dataset: ds, newDatasetLabel: ds === "new" ? $("#imgDsName").value : "" }).then(function (j) {
        imgPaintJob(j);
        var poll = function () { if (route.name !== "generate") return; api("/images/job/" + j.id).then(function (x) { imgPaintJob(x); if (x.running) setTimeout(poll, 1500); }).catch(function () {}); };
        setTimeout(poll, 1200);
      }).catch(function (e) { toast(e.message); });
    });
  }
  function genTabs(kind) {
    var t = function (k, ic, label) { return '<button type="button" role="tab" id="tab-' + k + '" aria-selected="' + (kind === k) + '" tabindex="' + (kind === k ? 0 : -1) + '" class="' + (kind === k ? "on" : "") + '" data-kind="' + k + '">' + icon(ic) + label + "</button>"; };
    return '<div class="tabs" role="tablist" aria-label="What to generate">' + t("drill", "code", "SQL drills") + t("mcq", "checkCircle", "Multiple choice") + t("stage", "layers", "Learning stages") + t("images", "inbox", "From images") + "</div>";
  }
  function wireGenTabs(clicks) {
    var tabs = $$('[role="tab"][data-kind]');
    tabs.forEach(function (t, i) {
      t.addEventListener("keydown", function (e) { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); var o = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length]; o.focus(); o.click(); } });
      if (clicks !== false) t.addEventListener("click", function () { var k = t.getAttribute("data-kind"); if (k === "stage") location.hash = "#/generate?kind=stage&level=" + (Number(route.q.get("level")) || 1); else location.hash = "#/generate?kind=" + k + (route.q.get("level") ? "&level=" + route.q.get("level") : ""); });
    });
  }

  // ---------- Create: any item by hand (admin/create.js), the same checks as generated items, a live learner preview ----------
  // [key, label, kind, extra] kinds: text, area, sql, list (one per line), check, num, select (extra: options), table
  // (a name + rows: the first line holds the column names), inputs (predict: the rows to show), whywrong (MCQ)
  var TBL = function (k, label, opt) { return [k, label, "table", opt ? { optional: true } : null]; };
  var CF = {
    exercise: [["title", "Title", "text"], ["task", "Task: what the learner must do", "area"], ["solution_sql", "Reference solution", "sql"], ["accepted", "Accepted alternative answers (one query per line, optional)", "list"], ["hints", "Hints, easiest first (one per line, up to 3, optional)", "list"], ["ordered", "The order of the rows matters", "check"], ["summary", "Short description (optional)", "text"]],
    mcq: [["q", "Question", "area"], ["code", "Code shown with the question (optional)", "sql"], ["options", "Options (one per line, 2-5)", "list"], ["answer", "Right option", "answer"], ["why", "Why the right option is right", "area"], ["why_wrong", "Why each wrong option is wrong", "whywrong"]],
    predict: [["question", "Question", "text"], ["sql", "The query", "sql"], ["inputs", "Rows to show (a table and a WHERE that picks 1-8 rows)", "inputs"], ["mistakes", "Wrong choices: mistaken queries, one per line (each must really give a different result)", "list"]],
    flashcard_keyword: [["front", "Front: a keyword, clause or function", "text"], ["back", "Back: what it means or does", "area"]],
    flashcard_blank: [["prompt", "Instruction (optional)", "text"], ["sql", "Statement with exactly one ___", "sql"], ["answer", "The text that fills ___", "text"]],
    flashcard_order: [["prompt", "Instruction (optional)", "text"], ["parts", "Clauses in the right order (one per line, 3-7)", "list"]],
    flashcard_error: [["prompt", "Instruction (optional)", "text"], ["wrong_sql", "Statement with one mistake", "sql"], ["fixed_sql", "The corrected statement", "sql"], ["explanation", "What was wrong (one sentence)", "text"]],
    lesson: [["title", "Title", "text"], ["what", "What it is", "area"], ["when", "When to use it (one point per line)", "list"], ["example_sql", "Example (runs on the dataset; its real result is stored)", "sql"], ["explain", "What the example shows", "area"], ["tip", "Watch out", "text"]],
    join_mapper: [["question", "Question (don't name the join type)", "text"], TBL("left", "Left table"), TBL("right", "Right table"), ["key_left", "Key in the left table (table.column)", "text"], ["key_right", "Key in the right table (table.column)", "text"], ["join_type", "Join type", "select", ["INNER", "LEFT", "RIGHT", "FULL"]], ["why", "Why (1-2 sentences)", "area"]],
    compare_queries: [["question", "Question", "text"], TBL("table", "Table"), TBL("table2", "Second table (optional)", true), ["query_a", "Query A", "sql"], ["query_b", "Query B", "sql"], ["why", "Why the results differ", "area"]],
    result_set: [["question", "Question", "text"], TBL("table", "Table (first column: a unique id)"), ["query", "Query (returns the id first)", "sql"], ["why", "Why", "area"]],
    join_compare: [["question", "Question", "text"], TBL("left", "Left table"), TBL("right", "Right table"), ["key_left", "Key in the left table (table.column)", "text"], ["key_right", "Key in the right table (table.column)", "text"], ["pair", "Join types compared", "select", ["INNER>LEFT", "INNER>RIGHT", "LEFT>FULL"]], ["why", "Why", "area"]],
    find_difference: [["question", "Question", "text"], TBL("table", "Table (first column: a unique id)"), ["query_a", "Query A", "sql"], ["query_b", "Query B (1-4 tokens changed)", "sql"], ["why", "Why", "area"]],
    exec_timeline: [["question", "Question", "text"], ["script", "Script: 4-8 statements, the first creates a table named es_…", "sql"], ["check_sql", "Check query (SELECT … ORDER BY)", "sql"], ["ask_step", "Ask about the table after statement", "num"], ["why", "Why", "area"]],
    schema_detective: [["question", "Question", "text"], TBL("table", "Table (6-8 rows)"), ["candidates", "Candidate key columns (one per line, 3-4)", "list"], ["why", "Why", "area"]],
    sort_filter: [["question", "Task in words", "text"], TBL("table", "Table (6-8 rows)"), ["select", "Columns returned (e.g. name, marks)", "text"], ["filters", "Conditions to choose from (one per line, 3-5)", "list"], ["sorts", "Sort orders to choose from (one per line, 2-4)", "list"], ["answer_filters", "Right conditions: their numbers (e.g. 1, 3)", "text"], ["answer_sort", "Right sort: its number", "num"], ["why", "Why", "area"]],
    query_optimizer: [["question", "Question", "text"], ["schema", "CREATE TABLE", "sql"], ["index", "CREATE INDEX", "sql"], ["query", "Query (one table)", "sql"], ["why", "Why the planner does what it does (never \"an index always helps\")", "area"]],
  };
  var CM = null, CS = null; // create meta; the form's state { id, src }
  var NEEDS_DATASET = function (t) { return ["exercise", "predict", "lesson", "flashcard_blank", "flashcard_order", "flashcard_error"].indexOf(t) > -1; };
  var HAS_LEVEL = function (t) { return t === "exercise" || t === "mcq"; };
  function cField(f, val) {
    var id = "cf-" + f[0], v = val == null ? "" : val, lab = '<label for="' + id + '">' + esc(f[1]) + "</label>";
    if (f[2] === "check") return '<label class="c-check"><input type="checkbox" id="' + id + '" data-cf="' + f[0] + '"' + (v ? " checked" : "") + "><span>" + esc(f[1]) + "</span></label>";
    if (f[2] === "select") return '<div class="c-f">' + lab + '<select class="inp" id="' + id + '" data-cf="' + f[0] + '">' + f[3].map(function (o) { return '<option' + (o === v ? " selected" : "") + ">" + esc(o) + "</option>"; }).join("") + "</select></div>";
    if (f[2] === "num") return '<div class="c-f c-num">' + lab + '<input class="inp" type="number" min="1" id="' + id + '" data-cf="' + f[0] + '" value="' + esc(v) + '"></div>';
    if (f[2] === "text") return '<div class="c-f">' + lab + '<input class="inp" id="' + id + '" data-cf="' + f[0] + '" value="' + esc(v) + '"></div>';
    if (f[2] === "table") return '<fieldset class="c-f c-table"><legend>' + esc(f[1]) + '</legend><label for="' + id + '-n">Table name</label><input class="inp mono" id="' + id + '-n" data-cf="' + f[0] + '_name" value="' + esc((CS.vals || {})[f[0] + "_name"] || "") + '">' +
      '<label for="' + id + '-c">Rows: the first line holds the column names; comma or tab separated</label><textarea class="inp mono" rows="6" id="' + id + '-c" data-cf="' + f[0] + '_csv" spellcheck="false">' + esc((CS.vals || {})[f[0] + "_csv"] || "") + "</textarea></fieldset>";
    if (f[2] === "inputs") {
      var rows = Array.isArray(v) && v.length ? v : [{ table: "", where: "" }];
      return '<fieldset class="c-f c-inputs"><legend>' + esc(f[1]) + "</legend>" + rows.map(function (r, k) { return '<div class="c-in"><label><span class="sr-only">Table ' + (k + 1) + '</span><input class="inp mono" placeholder="table" data-ci="table" value="' + esc(r.table) + '"></label><label class="grow"><span class="sr-only">WHERE for table ' + (k + 1) + '</span><input class="inp mono" placeholder="WHERE condition, e.g. id <= 4" data-ci="where" value="' + esc(r.where) + '"></label></div>'; }).join("") +
        (rows.length < 3 ? '<button type="button" class="btn sm" data-c="add-input">' + icon("plus") + "Another table</button>" : "") + "</fieldset>";
    }
    if (f[2] === "answer" || f[2] === "whywrong") return '<div class="c-f" data-cdyn="' + f[2] + '"></div>';
    var rowsN = f[2] === "area" ? 3 : f[2] === "list" ? 4 : 5;
    return '<div class="c-f">' + lab + '<textarea class="inp' + (f[2] === "sql" ? " mono" : "") + '" rows="' + rowsN + '" id="' + id + '" data-cf="' + f[0] + '"' + (f[2] === "sql" ? ' spellcheck="false"' : "") + ">" + esc(Array.isArray(v) ? v.join("\n") : v) + "</textarea></div>";
  }
  // MCQ: the right option and a "why not" per wrong option follow the options as they are typed
  function cDyn() {
    var box = $('[data-cdyn="answer"]'), ww = $('[data-cdyn="whywrong"]'), ta = $('[data-cf="options"]');
    if (!box || !ta) return;
    var opts = ta.value.split("\n").map(function (x) { return x.trim(); }).filter(Boolean).slice(0, 5), cur = $('[data-cf="answer"]'), a = cur ? Number(cur.value) : Number((CS.vals || {}).answer || 0);
    var prevWhy = $$("[data-cw]").reduce(function (o, el) { o[el.getAttribute("data-cw")] = el.value; return o; }, (CS.vals && CS.vals.why_wrong ? CS.vals.why_wrong.slice() : []));
    box.innerHTML = '<label for="cf-answer">Right option</label><select class="inp" id="cf-answer" data-cf="answer">' + opts.map(function (o, k) { return '<option value="' + k + '"' + (k === a ? " selected" : "") + ">" + "ABCDE".charAt(k) + ". " + esc(o) + "</option>"; }).join("") + "</select>";
    ww.innerHTML = '<fieldset class="c-why"><legend>Why each wrong option is wrong</legend>' + (opts.length < 2 ? '<p class="muted small">Type at least two options first.</p>' : opts.map(function (o, k) { return k === a ? "" : '<label for="cw-' + k + '">' + "ABCDE".charAt(k) + ". " + esc(o) + '</label><input class="inp" id="cw-' + k + '" data-cw="' + k + '" value="' + esc(prevWhy[k] || "") + '">'; }).join("")) + "</fieldset>";
  }
  function cConceptOf(text) {
    var t = String(text || "").trim().toLowerCase();
    return (CM.concepts.filter(function (c) { return c.slug === t || (c.name + " (Level " + c.level + ")").toLowerCase() === t || c.name.toLowerCase() === t; })[0]) || null;
  }
  function cCommon() {
    var t = CS.type, v = CS.vals || {}, c = CM.concepts.filter(function (x) { return x.slug === CS.concept; })[0];
    var ds = '<div class="c-f"><label for="c-ds">Dataset</label><select class="inp" id="c-ds"><option value="">Choose…</option>' + CM.datasets.map(function (d) { return '<option value="' + esc(d.key) + '"' + (d.key === CS.dataset ? " selected" : "") + ">" + esc(d.label) + "</option>"; }).join("") + '<option value="__new">+ New dataset…</option></select></div>';
    return '<div class="c-grid">' +
      '<div class="c-f c-wide"><label for="c-concept">Concept' + (HAS_LEVEL(t) ? " (optional)" : "") + '</label><input class="inp" id="c-concept" list="c-concepts" autocomplete="off" placeholder="Type to search 161 concepts" value="' + esc(c ? c.name + " (Level " + c.level + ")" : "") + '"><datalist id="c-concepts">' + CM.concepts.map(function (x) { return '<option value="' + esc(x.name + " (Level " + x.level + ")") + '">'; }).join("") + "</datalist></div>" +
      (HAS_LEVEL(t) ? '<div class="c-f"><label for="c-level">Level</label><select class="inp" id="c-level"' + (c ? " disabled" : "") + ">" + CM.levels.map(function (L) { return '<option value="' + L.n + '"' + (L.n === (c ? c.level : CS.level) ? " selected" : "") + ">" + L.n + ". " + esc(L.title) + "</option>"; }).join("") + "</select></div>" +
        '<div class="c-f"><label for="c-diff">Difficulty</label><select class="inp" id="c-diff">' + CM.diffs.map(function (d) { return '<option' + (d === (CS.diff || "medium") ? " selected" : "") + ">" + d + "</option>"; }).join("") + "</select></div>" : "") +
      (t === "exercise" ? '<div class="c-f"><label for="c-stage">Stage</label><select class="inp" id="c-stage"><option value="practise"' + (CS.stage !== "transfer" ? " selected" : "") + '>Practise</option><option value="transfer"' + (CS.stage === "transfer" ? " selected" : "") + ">Transfer</option></select></div>" : "") +
      (t === "mcq" ? '<div class="c-f"><label for="c-stage">Stage</label><select class="inp" id="c-stage"><option value="understand"' + (CS.stage !== "memorize" ? " selected" : "") + '>Understand</option><option value="memorize"' + (CS.stage === "memorize" ? " selected" : "") + ">Memorize</option></select></div>" : "") +
      (NEEDS_DATASET(t) ? ds : "") + "</div>" + (NEEDS_DATASET(t) ? '<div id="c-newds" hidden></div>' : "");
  }
  function viewCreate() {
    var editId = route.q.get("id");
    view.innerHTML = '<div class="page admin"><div class="loading">Loading…</div></div>';
    Promise.all([CM ? Promise.resolve(CM) : api("/create/meta"), editId ? api("/create/item/" + encodeURIComponent(editId)) : Promise.resolve(null)]).then(function (r) {
      CM = r[0];
      var it = r[1];
      CS = it ? { id: it.id, type: it.form.type, concept: it.form.concept, level: Number(it.form.level) || 1, diff: it.form.diff, stage: it.form.stage, dataset: it.form.dataset, vals: it.form.fields || {}, status: it.status, mine: it.mine } : (CS && !CS.id ? CS : { type: route.q.get("type") || "exercise", level: 1, vals: {} });
      var tab = route.q.get("tab") === "import" ? "import" : "one";
      var groups = {};
      CM.types.forEach(function (t) { (groups[t.group] = groups[t.group] || []).push(t); });
      var html = '<div class="page admin c-page"><div class="hero"><div><div class="eyebrow">Content</div><h2 class="h1">' + (CS.id ? "Edit an item" : "Create by hand") + '</h2><p>Every item runs the same checks as generated ones before it is saved, and shows each failure. Saved items are marked <span class="tag plain">Mine</span> and logged in Review → History, with Undo.</p></div></div>' +
        (CS.id ? "" : '<div class="tabs" role="tablist"><a role="tab" href="#/create" class="' + (tab === "one" ? "on" : "") + '" aria-selected="' + (tab === "one") + '">' + icon("plus") + 'One item</a><a role="tab" href="#/create?tab=import" class="' + (tab === "import" ? "on" : "") + '" aria-selected="' + (tab === "import") + '">' + icon("download") + "Bulk import</a></div>");
      if (tab === "import" && !CS.id) { view.innerHTML = html + importHtml() + "</div>"; view.onclick = createClick; return; }
      html += '<div class="c-cols"><form class="card card-pad c-form" id="cForm" novalidate>' +
        '<div class="c-f"><label for="c-type">Type</label><select class="inp" id="c-type"' + (CS.id ? " disabled" : "") + ">" + Object.keys(groups).map(function (g) { return '<optgroup label="' + esc(g) + '">' + groups[g].map(function (t) { return '<option value="' + t.type + '"' + (t.type === CS.type ? " selected" : "") + ">" + esc(t.label) + "</option>"; }).join("") + "</optgroup>"; }).join("") + "</select></div>" +
        '<div id="cCommon">' + cCommon() + '</div><div id="cFields">' + CF[CS.type].map(function (f) { return cField(f, CS.vals[f[0]]); }).join("") + "</div>" +
        '<fieldset class="c-save"><legend>When saved</legend><label class="c-check"><input type="radio" name="c-pub" value="1"' + (CS.id && CS.status === "draft" ? "" : " checked") + '><span>Publish now</span></label><label class="c-check"><input type="radio" name="c-pub" value="0"' + (CS.id && CS.status === "draft" ? " checked" : "") + '><span>Save as draft (review queue)</span></label>' +
        '<label class="c-check"><input type="checkbox" id="c-review"><span>Ask DeepSeek to review (a second opinion, about $0.001)</span></label></fieldset>' +
        '<div class="actions"><button type="button" class="btn" data-c="check">' + icon("checkCircle") + 'Check</button><button type="submit" class="btn primary" data-c="save">' + icon("check") + (CS.id ? "Save changes" : "Save") + '</button><span class="grow"></span>' + (CS.id ? '<a class="btn sm" href="#/create">New item</a>' : "") + "</div>" +
        '<div id="cOut" aria-live="polite"></div></form>' +
        '<section class="card card-pad c-prev" aria-labelledby="cp-h"><div class="card-h"><h3 id="cp-h">' + icon("eye") + 'Learner preview</h3><span class="muted small">the real learner view · answers aren\'t saved</span></div><iframe id="cPrev" src="/#/preview" title="Learner preview of this item" loading="lazy"></iframe><p class="muted small" id="cPrevNote">Press Check to see the item as learners will.</p></section></div></div>';
      view.innerHTML = html;
      cDyn();
      view.onchange = createChange; view.oninput = function (e) { if (e.target.matches('[data-cf="options"]')) cDyn(); };
      view.onclick = createClick;
      view.onsubmit = function (e) { e.preventDefault(); createSave(); };
    }).catch(fail);
  }
  function cCollect() {
    var vals = {};
    $$("[data-cf]").forEach(function (el) { vals[el.getAttribute("data-cf")] = el.type === "checkbox" ? el.checked : el.value; });
    if (CS.type === "mcq") { vals.answer = Number(vals.answer || 0); vals.why_wrong = []; $$("[data-cw]").forEach(function (el) { vals.why_wrong[Number(el.getAttribute("data-cw"))] = el.value; }); }
    if ($(".c-inputs")) vals.inputs = $$(".c-in").map(function (r) { return { table: r.querySelector('[data-ci="table"]').value, where: r.querySelector('[data-ci="where"]').value }; });
    CS.vals = vals;
    var ce = $("#c-concept"), c = ce ? cConceptOf(ce.value) : null;
    CS.concept = c ? c.slug : "";
    if ($("#c-level")) CS.level = Number($("#c-level").value);
    if ($("#c-diff")) CS.diff = $("#c-diff").value;
    if ($("#c-stage")) CS.stage = $("#c-stage").value;
    if ($("#c-ds")) CS.dataset = $("#c-ds").value === "__new" ? "" : $("#c-ds").value;
    return { type: CS.type, concept: CS.concept, level: CS.level, diff: CS.diff, stage: CS.stage, dataset: CS.dataset, fields: vals, review: !!($("#c-review") && $("#c-review").checked), publish: ($('[name="c-pub"]:checked') || {}).value !== "0" };
  }
  function checksHtml(r) {
    var mark = function (c) { return c.ok ? '<span class="ok-txt">' + icon("check") + '<span class="sr-only">passed</span></span>' : c.warn ? '<span class="warn-txt">' + icon("warn") + '<span class="sr-only">warning</span></span>' : '<span class="bad-txt">' + icon("x") + '<span class="sr-only">failed</span></span>'; };
    var failed = r.checks.filter(function (c) { return !c.ok && !c.warn; }).length, warned = r.checks.filter(function (c) { return !c.ok && c.warn; }).length;
    return '<div class="c-res ' + r.status + '" role="status"><p class="c-sum"><b>' + (r.status === "fail" ? plural(failed, "check") + " failed: nothing was saved." : r.status === "warn" ? "Passes, with " + plural(warned, "warning") + "." : "Every check passes.") + "</b></p>" +
      '<ul class="c-checks">' + r.checks.map(function (c) { return '<li class="' + (c.ok ? "ok" : c.warn ? "warn" : "bad") + '">' + mark(c) + "<span>" + esc(c.label) + (c.detail ? ' <span class="muted">' + esc(c.detail) + "</span>" : "") + "</span></li>"; }).join("") + "</ul></div>";
  }
  // the learner app in the iframe renders the item with its own renderers (#/preview: answers there aren't saved)
  function previewItem(r) {
    var d = r.data;
    if (!d) return null;
    if (r.type === "exercise") return { kind: "drill", title: d.title, body: d.task, dataset: d.dataset, diff: d.diff, level: d.level, hints: d.hints };
    if (r.type === "mcq") return { kind: "mcq", m: { id: "mcq-preview", key: "mcq-preview", title: d.q, code: d.code, options: d.options, answer: d.answer, why: d.why, whyWrong: d.why_wrong || null, level: d.level, diff: d.diff } };
    if (r.type === "predict") return { kind: "predict", p: Object.assign({ id: "po-preview" }, d) };
    if (r.type === "lesson") return { kind: "lesson", l: Object.assign({ id: "ls-preview" }, d) };
    if (/^flashcard_/.test(r.type)) return { kind: "flashcard", f: Object.assign({ id: "fc-preview" }, d) };
    return { kind: "card", c: Object.assign({ id: "cd-preview" }, d) };
  }
  function sendPreview(r) {
    var fr = $("#cPrev"), item = previewItem(r);
    $("#cPrevNote").textContent = item ? "" : "The preview appears once the item's own checks pass.";
    if (!fr || !item) return;
    var post = function () { fr.contentWindow.postMessage({ type: "sqld-preview", item: item }, location.origin); };
    post(); fr.onload = post;
  }
  function createRun(save) {
    var body = cCollect(), out = $("#cOut"), btn = $(save ? '[data-c="save"]' : '[data-c="check"]');
    btn.disabled = true; out.innerHTML = '<p class="muted small">' + (save ? "Checking and saving…" : "Checking…") + "</p>";
    var req = save ? (CS.id ? api("/create/item/" + encodeURIComponent(CS.id), "PUT", body) : api("/create", "POST", body)) : api("/create/check", "POST", body);
    return req.then(function (r) {
      btn.disabled = false;
      out.innerHTML = checksHtml(r) + (save && r.ok ? '<p class="c-saved ok-txt" tabindex="-1">' + icon("checkCircle") + (CS.id ? "Saved" : "Saved as ") + (r.status === "published" ? "published" : "a draft") + ' · <span class="tag plain">Mine</span> · <a href="#/create?id=' + encodeURIComponent(r.id) + '">Edit it</a> · <a href="#/review?view=history">History (Undo)</a></p>' : "");
      sendPreview(r);
      var f = out.querySelector(save && r.ok ? ".c-saved" : ".c-sum"); if (f) { f.setAttribute("tabindex", "-1"); f.focus(); }
      if (save && r.ok) { refreshCounts(); if (!CS.id) CS = { type: CS.type, level: CS.level, concept: CS.concept, dataset: CS.dataset, diff: CS.diff, stage: CS.stage, vals: {} }; }
    }).catch(function (e) { btn.disabled = false; out.innerHTML = '<p class="bad-txt" role="alert">' + esc(e.message) + "</p>"; });
  }
  function createSave() { return createRun(true); }
  function createChange(e) {
    var t = e.target;
    if (t.id === "c-type") { cCollect(); CS = { type: t.value, level: CS.level, concept: CS.concept, dataset: CS.dataset, diff: CS.diff, vals: {} }; $("#cCommon").innerHTML = cCommon(); $("#cFields").innerHTML = CF[CS.type].map(function (f) { return cField(f, ""); }).join(""); cDyn(); $("#cOut").innerHTML = ""; return; }
    if (t.id === "c-concept") { var c = cConceptOf(t.value); if (c && $("#c-level")) { $("#c-level").value = c.level; $("#c-level").disabled = true; } else if ($("#c-level")) $("#c-level").disabled = false; return; }
    if (t.matches('[data-cf="answer"]')) { cDyn(); return; }
    if (t.id === "c-ds") { var box = $("#c-newds"); if (t.value === "__new") { box.hidden = false; box.innerHTML = datasetFormHtml(); box.querySelector("input").focus(); } else { box.hidden = true; box.innerHTML = ""; } }
    if (t.name === "c-dsmode") { $("#c-dstables").hidden = t.value !== "tables"; $("#c-dsscript").hidden = t.value !== "script"; }
  }
  function createClick(e) {
    var b = e.target.closest && e.target.closest("[data-c]");
    if (!b) return;
    var a = b.getAttribute("data-c");
    if (a === "check") createRun(false);
    if (a === "add-input") { cCollect(); CS.vals.inputs = (CS.vals.inputs || []).concat([{ table: "", where: "" }]); var fs = b.closest("fieldset"); fs.outerHTML = cField(CF.predict[2], CS.vals.inputs); var ins = $$(".c-in [data-ci='table']"); ins[ins.length - 1].focus(); }
    if (a === "ds-add") { var w = document.createElement("div"); w.innerHTML = dsTableHtml($$(".c-dst").length); b.parentNode.insertBefore(w.firstChild, b); }
    if (a === "ds-check" || a === "ds-save") datasetRun(a === "ds-save");
    if (a === "imp-check" || a === "imp-save") importRun(a === "imp-save");
  }
  // ---------- a new dataset: pasted rows / CSV per table, or a CREATE TABLE + INSERT script ----------
  function dsTableHtml(k) { return '<fieldset class="c-dst"><legend>Table ' + (k + 1) + '</legend><label for="dsn-' + k + '">Name</label><input class="inp mono" id="dsn-' + k + '" data-dsn><label for="dsc-' + k + '">Rows: first line the column names; paste from a sheet or CSV</label><textarea class="inp mono" rows="6" id="dsc-' + k + '" data-dsc spellcheck="false"></textarea></fieldset>'; }
  function datasetFormHtml() {
    return '<section class="c-ds card card-pad" aria-labelledby="ds-h"><h4 id="ds-h">New dataset</h4><p class="muted small">It must run with every row on SQLite, a MySQL scratch schema and PostgreSQL (rolled back) before it is saved.</p>' +
      '<label for="ds-label">Name</label><input class="inp" id="ds-label" placeholder="e.g. Pet clinic">' +
      '<fieldset class="c-save"><legend>From</legend><label class="c-check"><input type="radio" name="c-dsmode" value="tables" checked><span>Rows or CSV</span></label><label class="c-check"><input type="radio" name="c-dsmode" value="script"><span>A CREATE TABLE + INSERT script</span></label></fieldset>' +
      '<div id="c-dstables">' + dsTableHtml(0) + '<button type="button" class="btn sm" data-c="ds-add">' + icon("plus") + "Another table</button></div>" +
      '<div id="c-dsscript" hidden><label for="ds-script">Script</label><textarea class="inp mono" rows="8" id="ds-script" spellcheck="false" placeholder="CREATE TABLE pets (id INT PRIMARY KEY, name VARCHAR(40));\nINSERT INTO pets VALUES (1, \'Rex\');"></textarea></div>' +
      '<div class="actions"><button type="button" class="btn" data-c="ds-check">Check dataset</button><button type="button" class="btn primary" data-c="ds-save">Create dataset</button></div><div id="ds-out" aria-live="polite"></div></section>';
  }
  function datasetRun(save) {
    var mode = ($('[name="c-dsmode"]:checked') || {}).value || "tables", out = $("#ds-out");
    var body = { label: $("#ds-label").value, mode: mode, script: ($("#ds-script") || {}).value, tables: $$(".c-dst").map(function (f) { return { name: f.querySelector("[data-dsn]").value, csv: f.querySelector("[data-dsc]").value }; }) };
    out.innerHTML = '<p class="muted small">Running on SQLite, MySQL and PostgreSQL…</p>';
    api(save ? "/create/dataset" : "/create/dataset/preview", "POST", body).then(function (r) {
      out.innerHTML = '<ul class="c-checks">' + r.checks.map(function (c) { return '<li class="' + (c.ok ? "ok" : "bad") + '">' + (c.ok ? '<span class="ok-txt">' + icon("check") + '</span>' : '<span class="bad-txt">' + icon("x") + "</span>") + "<span>" + esc(c.label) + (c.detail ? ' <span class="muted">' + esc(c.detail) + "</span>" : "") + "</span></li>"; }).join("") + "</ul>" +
        '<p class="small">' + r.tables.map(function (t) { return '<span class="mono">' + esc(t.name) + "</span> (" + t.rows + " rows)"; }).join(", ") + "</p>" +
        (save ? (r.ok ? '<p class="ok-txt" tabindex="-1">Dataset “' + esc(r.label) + '” created and selected.</p>' : '<p class="bad-txt">Not saved: a check failed.</p>') : "");
      if (save && r.ok) {
        CM.datasets.push({ key: r.key, label: r.label }); cCollect(); CS.dataset = r.key; $("#cCommon").innerHTML = cCommon();
        var nb = $("#c-newds"); nb.hidden = false; nb.innerHTML = '<p class="ok-txt" id="ds-out" role="status" tabindex="-1">' + icon("checkCircle") + "Dataset “" + esc(r.label) + "” created (" + r.tables.map(function (t) { return esc(t.name) + ", " + t.rows + " rows"; }).join("; ") + ") and selected.</p>"; nb.querySelector("p").focus();
      }
    }).catch(function (e) { out.innerHTML = '<p class="bad-txt" role="alert">' + esc(e.message) + "</p>"; });
  }
  // ---------- bulk import: exercises, MCQs or flashcards from CSV / JSON, a pass / fail summary first ----------
  function importHtml() {
    return '<section class="card card-pad c-imp" aria-labelledby="imp-h"><div class="card-h"><h3 id="imp-h">' + icon("download") + 'Import exercises, MCQs or flashcards</h3></div>' +
      '<p class="muted small">Choose the row type, then provide flat CSV / JSON fields. Flashcards use: keyword = front, back; blank = prompt, sql, answer; order = prompt, parts (one clause per line or ||); error = prompt, wrong_sql, fixed_sql, explanation. Shared fields are level and concept; SQL-based cards also need dataset. Every row runs the same checks as one item; nothing is saved until you choose.</p>' +
      '<div class="c-grid"><div class="c-f"><label for="imp-kind">Rows are</label><select class="inp" id="imp-kind"><option value="exercise">Exercises</option><option value="mcq">MCQs</option><option value="flashcard_keyword">Flashcards: keyword</option><option value="flashcard_blank">Flashcards: fill in the blank</option><option value="flashcard_order">Flashcards: clause order</option><option value="flashcard_error">Flashcards: spot the error</option></select></div>' +
      '<div class="c-f"><label for="imp-file">CSV or JSON file</label><input type="file" class="inp" id="imp-file" accept=".csv,.json,.txt,text/csv,application/json"></div></div>' +
      '<label for="imp-text">…or paste CSV / JSON</label><textarea class="inp mono" rows="8" id="imp-text" spellcheck="false"></textarea>' +
      '<fieldset class="c-save"><legend>Rows that pass</legend><label class="c-check"><input type="radio" name="imp-pub" value="1" checked><span>Publish</span></label><label class="c-check"><input type="radio" name="imp-pub" value="0"><span>Save as drafts</span></label></fieldset>' +
      '<div class="actions"><button type="button" class="btn" data-c="imp-check">' + icon("checkCircle") + 'Check rows</button><button type="button" class="btn primary" data-c="imp-save" disabled>Save the rows that pass</button></div><div id="imp-out" aria-live="polite"></div></section>';
  }
  function importRows(text) {
    text = String(text || "").trim();
    if (!text) return [];
    if (text.charAt(0) === "[" || text.charAt(0) === "{") { var j = JSON.parse(text); return Array.isArray(j) ? j : j.rows || [j]; }
    var rows = parseCsvText(text), head = rows.shift() || [];
    return rows.filter(function (r) { return r.some(function (v) { return String(v).trim(); }); }).map(function (r) { var o = {}; head.forEach(function (h, k) { o[h] = r[k] == null ? "" : r[k]; }); return o; });
  }
  function parseCsvText(t) {
    t = t.replace(/\r\n?/g, "\n");
    var rows = [], row = [], cur = "", q = false;
    for (var i = 0; i < t.length; i++) {
      var ch = t.charAt(i);
      if (q) { if (ch === '"' && t.charAt(i + 1) === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; continue; }
      if (ch === '"' && cur === "") { q = true; continue; }
      if (ch === ",") { row.push(cur); cur = ""; continue; }
      if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; continue; }
      cur += ch;
    }
    row.push(cur); rows.push(row);
    return rows;
  }
  function importRun(save) {
    var out = $("#imp-out"), f = $("#imp-file").files[0], kind = $("#imp-kind").value;
    var read = f ? f.text() : Promise.resolve($("#imp-text").value);
    read.then(function (text) {
      var rows;
      try { rows = importRows(text); } catch (e) { out.innerHTML = '<p class="bad-txt" role="alert">Couldn\'t read it: ' + esc(e.message) + "</p>"; return; }
      if (!rows.length) { out.innerHTML = '<p class="bad-txt" role="alert">No rows found.</p>'; return; }
      out.innerHTML = '<p class="muted small">Checking ' + plural(rows.length, "row") + " (write drills run on MySQL; this can take a minute)…</p>";
      return api(save ? "/create/import" : "/create/import/preview", "POST", { kind: kind, rows: rows, publish: ($('[name="imp-pub"]:checked') || {}).value !== "0" }).then(function (r) {
        out.innerHTML = '<p class="c-sum" role="status" tabindex="-1"><b>' + r.pass + " pass · " + r.warn + " with warnings · " + r.fail + " fail</b>" + (save ? " · " + plural(r.saved, "row") + " saved" : "") + "</p>" +
          '<div class="table-wrap"><table class="admin-t"><caption class="sr-only">Rows checked</caption><thead><tr><th scope="col">Row</th><th scope="col">Item</th><th scope="col">Result</th></tr></thead><tbody>' +
          r.rows.map(function (x) { return "<tr><td class=\"n mono\">" + x.row + "</td><td>" + esc(x.title || "") + (x.failed.length ? '<ul class="small muted">' + x.failed.map(function (m) { return "<li>" + esc(m) + "</li>"; }).join("") + "</ul>" : "") + '</td><td><span class="' + (x.status === "fail" ? "bad-txt" : x.status === "warn" ? "warn-txt" : "ok-txt") + '">' + x.status + "</span></td></tr>"; }).join("") + "</tbody></table></div>";
        $('[data-c="imp-save"]').disabled = save || !(r.pass + r.warn);
        out.querySelector(".c-sum").focus();
        if (save) refreshCounts();
      });
    }).catch(function (e) { out.innerHTML = '<p class="bad-txt" role="alert">' + esc(e.message) + "</p>"; });
  }
  // ---------- How to use (public/help.js): the admin guide here, the learner guide too; numbers from /api/help/numbers ----------
  var HELPNUM = null;
  function viewHelp() {
    var g = route.q.get("g") === "learner" ? "learner" : "admin", sec = route.q.get("s");
    view.innerHTML = '<div class="page admin"><div class="loading">Loading…</div></div>';
    (HELPNUM ? Promise.resolve(HELPNUM) : fetch("/api/help/numbers").then(function (r) { return r.json(); })).then(function (nums) {
      HELPNUM = nums;
      if (route.name !== "help") return;
      var list = g === "admin" ? Help.ADMIN : Help.LEARNER;
      view.innerHTML = '<div class="page admin help-page"><div class="hero"><div><div class="eyebrow">How to use</div><h2 class="h1">How to use SQL Drills</h2><p>The admin guide (making and reviewing content) and the learner guide. Every number comes from the app as it is now.</p></div></div>' +
        '<div class="tabs" role="tablist"><a role="tab" href="#/help" class="' + (g === "admin" ? "on" : "") + '" aria-selected="' + (g === "admin") + '">' + icon("cog") + 'Admin guide</a><a role="tab" href="#/help?g=learner" class="' + (g === "learner" ? "on" : "") + '" aria-selected="' + (g === "learner") + '">' + icon("graduation") + "Learner guide</a></div>" +
        '<nav class="card card-pad help-toc" aria-label="Sections"><ol>' + list.map(function (s) { return '<li><a href="#/help?' + (g === "learner" ? "g=learner&" : "") + "s=" + s.id + '">' + esc(s.title) + "</a></li>"; }).join("") + "</ol></nav>" +
        list.map(function (s) {
          return '<section class="card card-pad help-sec" aria-labelledby="hh-' + s.id + '"><h3 id="hh-' + s.id + '" tabindex="-1">' + esc(s.title) + "</h3>" + Help.textHtml(s.text, nums) +
            (s.shot ? '<figure class="help-shot"><img src="/help/' + esc(s.shot) + '" alt="' + esc(s.alt) + '" loading="lazy" width="1200" height="750"><figcaption class="muted small">' + esc(s.alt) + " (from the app)</figcaption></figure>" : "") + "</section>";
        }).join("") + "</div>";
      var h = sec && $("#hh-" + sec); if (h) { h.scrollIntoView(); h.focus(); }
    }).catch(fail);
  }
  // the old view for a route (used by the router, and by a React page that hosts an old view)
  function viewFor(name) {
    return ({ overview: viewOverview, generate: viewGenerate, review: viewReview, mcqs: viewMcqs, drills: viewDrills, recent: viewRecent, learners: viewLearners, settings: viewSettings,
      library: viewLibrary, item: viewItem, health: viewHealth, backups: viewBackups, concepts: viewConcepts, create: viewCreate, help: viewHelp }[name] || null);
  }
  function render() {
    view = viewRoot;
    var h = (location.hash || "#/overview").replace(/^#\/?/, "");
    var parts = h.split("?");
    route = { name: parts[0].split("/")[0] || "overview", args: parts[0].split("/").slice(1), q: new URLSearchParams(parts[1] || "") };
    clearTimeout(pollTimer);
    clearInterval(sysTimer); clearTimeout(healthTimer); clearTimeout(refsTimer);
    view.onclick = null; view.onchange = null; view.onsubmit = null;
    renderNav();
    $("#side").classList.remove("open"); $("#scrim").classList.remove("open");
    viewRoot.scrollTop = 0;
    // React pages (web/, the Waffles front end) take the admin routes they own; every other route stays here
    var R = window.SQLDrillsReact;
    if (R) R.unmount();
    var name = viewFor(route.name) ? route.name : "overview"; // an unknown address shows the Overview
    if (R && R.has(name, "admin")) { R.mount(name, view, { app: "admin", route: route, icon: icon }); return; }
    viewFor(name)();
  }
  // ---------- a table box that scrolls sideways can be reached and scrolled by keyboard (WCAG 2.1.1) ----------
  function scrollersFocusable() {
    [].forEach.call(document.querySelectorAll(".tbl-wrap, .table-wrap, .grid-wrap, .result-box"), function (el) {
      if (el.closest('[aria-hidden="true"]')) return; // e.g. the editor's highlight layer behind the text box
      var over = el.scrollWidth > el.clientWidth + 1, ours = el.hasAttribute("data-scroll-focus");
      if (over && !el.hasAttribute("tabindex")) { el.setAttribute("tabindex", "0"); el.setAttribute("data-scroll-focus", el.hasAttribute("role") ? "" : "role"); if (!el.hasAttribute("role")) { el.setAttribute("role", "group"); if (!el.hasAttribute("aria-label")) el.setAttribute("aria-label", "Table, scrolls sideways"); } }
      else if (!over && ours) { el.removeAttribute("tabindex"); if (el.getAttribute("data-scroll-focus") === "role") { el.removeAttribute("role"); if (el.getAttribute("aria-label") === "Table, scrolls sideways") el.removeAttribute("aria-label"); } el.removeAttribute("data-scroll-focus"); }
    });
  }
  (function () { var t; var later = function () { clearTimeout(t); t = setTimeout(scrollersFocusable, 80); }; new MutationObserver(later).observe(document.body, { childList: true, subtree: true }); window.addEventListener("resize", later); })();
  // ---------- keyboard: the skip link (the hash holds the route, so it moves focus, not the address), the phone menu ----------
  (function () {
    var skip = document.querySelector(".skip");
    if (skip) skip.addEventListener("click", function (e) { e.preventDefault(); var v = document.getElementById("view"); v.focus(); v.scrollIntoView({ block: "start" }); });
    var side = $("#side"), scrim = $("#scrim"), mb = $("#menuBtn");
    var closeMenu = function (back) { side.classList.remove("open"); scrim.classList.remove("open"); if (back) mb.focus(); };
    mb.addEventListener("click", function () { setTimeout(function () { var first = side.querySelector("#nav a"); if (side.classList.contains("open") && first) first.focus(); }, 0); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && side.classList.contains("open")) { e.preventDefault(); closeMenu(true); } });
  })();
  // ---------- shared with the React pages (web/src/admin): the one copy of each piece stays here ----------
  window.SQLDrillsAdmin = {
    api: api, toast: toast, askConfirm: askConfirm, confirmClick: confirmClick, esc: esc, icon: icon, fmtDate: fmtDate, plural: plural,
    refreshCounts: refreshCounts, setCount: function (k, v) { counts[k] = v; renderNav(); },
    loadRefs: loadRefs, previewItem: previewItem, importRows: importRows,
    // Phase 4 group 5: Overview and Concepts on React; Review and Generate hosted (the old view draws into a box
    // React gives it; render() takes #view back on every route change)
    openEditor: openEditor, openImport: openImport, barChart: barChart, spendHtml: spendHtml, stateDot: stateDot, DIFF_COLORS: DIFF_COLORS,
    LSTAGES: LSTAGES, LSTAGE_LABEL: LSTAGE_LABEL, stageCellParts: function (c, st) { var t = document.createElement("tr"); t.innerHTML = stageCell(c, st); var td = t.firstChild; return { cls: td.className, html: td.innerHTML }; },
    kwList: kwList, setTagStage: setTagStage, stagePicker: stagePicker,
    hostView: function (name, el) { view = el; (viewFor(name) || viewOverview)(); },
    meta: function () { return META; }, route: function () { return route; },
  };
  // the React bundle (a module script, so it runs after this one) owns some routes: the first render waits for it,
  // so an owned page is not drawn (and fetched) twice; a bundle that fails to load, or takes over 4 s, leaves the old page
  function whenReact(cb) {
    var s = document.querySelector('script[type="module"][src*="/app/assets/"]'), done = false;
    var go = function () { if (!done) { done = true; cb(); } };
    if (window.SQLDrillsReact || window.SQLDrillsReactFailed || !s) return go();
    window.addEventListener("sqldrills:react-ready", go);
    window.addEventListener("sqldrills:react-failed", go);
    setTimeout(go, 4000);
  }
  // the React bundle loads after this script: if it owns the page already on screen, hand that page over
  var booted = false;
  window.addEventListener("sqldrills:react-ready", function () { if (booted && window.SQLDrillsReact.has(route.name, "admin")) render(); });
  api("/topics").then(function (m) {
    META = m;
    window.addEventListener("hashchange", render);
    whenReact(function () {
      booted = true;
      render();
      refreshCounts();
    });
  }).catch(fail);
})();
