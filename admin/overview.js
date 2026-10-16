// Overview data for the admin dashboard, live System status and exercise import.
// Every number comes from the library build, the content tables or the progress table.
const db = require("../db.js");
const library = require("../library/library.js");
const content = require("./content.js");
const health = require("./health.js");
const backup = require("./backup.js");
const { listProviders } = require("../hints.js");
const { ping } = require("../course/check.js");

const DAY = 864e5;
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

/** Level flags, all that apply, in this order: very large, mostly self-check, few easy. */
function flagsOf(L, total) {
  const share = pct(L.total, total), self = pct(L.selfCheck, L.total), easy = pct(L.easy, L.total);
  // the rules compare exact shares; the labels show rounded ones
  const raw = (a, b) => (b ? (100 * a) / b : 0);
  const out = [];
  if (raw(L.total, total) > 20) out.push({ kind: "large", text: `Very large: ${share}% of library`, value: share });
  if (raw(L.selfCheck, L.total) >= 50) out.push({ kind: "self", text: `Mostly self-check (${self}%)`, value: self });
  if (raw(L.easy, L.total) < 10) out.push({ kind: "easy", text: `Few easy exercises (${L.easy})`, value: easy });
  return out;
}

function originOf(src) {
  src = String(src || "");
  if (src.startsWith("ai:") || src === "generated") return "generated";
  if (src === "imported") return "imported";
  if (src === "mine") return "mine";
  return "manual";
}

function dashboard() {
  const s = library.summary();
  const levels = s.levels.map((L) => ({ ...L, flags: flagsOf(L, s.total), easyPct: pct(L.easy, L.total), selfPct: pct(L.selfCheck, L.total), donePct: pct(L.done, L.total) }));

  // content gaps: one card per kind of flag, the strongest level for each (max 3)
  const gaps = [];
  const pick = (kind, better) => levels.filter((L) => L.flags.some((f) => f.kind === kind)).sort(better)[0];
  const easy = pick("easy", (a, b) => a.easyPct - b.easyPct);
  if (easy) gaps.push({ kind: "easy", level: easy.n, title: `Level ${easy.n} · ${easy.title}`, text: `Only ${easy.easy} of ${easy.total} exercises are easy (${easy.easyPct}%): beginners hit medium and hard ones straight away.`, action: "Generate easy drills", href: `#/generate?level=${easy.n}&difficulty=easy` });
  const self = pick("self", (a, b) => b.selfPct - a.selfPct);
  if (self) gaps.push({ kind: "self", level: self.n, title: `Level ${self.n} · ${self.title}`, text: `${self.selfCheck} of ${self.total} exercises (${self.selfPct}%) can't be checked automatically, so learners get no feedback on them.`, action: "Generate checkable drills", href: `#/generate?level=${self.n}&checkable=1` });
  const large = pick("large", (a, b) => b.total - a.total);
  if (large) gaps.push({ kind: "large", level: large.n, title: `Level ${large.n} · ${large.title}`, text: `${large.total} exercises, ${pct(large.total, s.total)}% of the library: consider splitting it or trimming its practice sets.`, action: `Open level ${large.n}`, href: `#/library?level=${large.n}` });

  // MCQs, review queue, completions
  const live = content.allMcqs().filter((m) => m.status === "published");
  const mcq = { total: live.length, easy: 0, medium: 0, hard: 0 };
  live.forEach((m) => { if (mcq[m.diff] != null) mcq[m.diff]++; });
  // the same count as the sidebar (admin/insights.js queueCounts)
  const queue = { length: require("./insights.js").queueCounts().total };
  const since30 = new Date(Date.now() - 30 * DAY).toISOString();
  const done = db.prepare("SELECT qid, updated_at FROM progress WHERE done = 1 AND updated_at >= ?").all(since30);
  const days = {};
  done.forEach((p) => { const d = p.updated_at.slice(0, 10); days[d] = (days[d] || 0) + 1; });

  // recently added (after the baseline library)
  const c = library.get();
  const newEx = c.active.filter((i) => i.added_at > library.BASELINE_AT).map((i) => ({ kind: "exercise", id: i.id, title: i.title, level: i.level, diff: i.diff, origin: originOf(i.origin || i.source), added_at: i.added_at }));
  const newMcq = content.allMcqs().filter((m) => m.added_at > library.BASELINE_AT && m.status === "published").map((m) => ({ kind: "mcq", id: m.id, title: m.q, level: Number(m.level) || null, diff: m.diff, origin: m.origin === "generated" ? "generated" : "manual", added_at: m.added_at }));
  const recent = newEx.concat(newMcq).sort((a, b) => (a.added_at < b.added_at ? 1 : -1));

  // AI generation this week
  const weekAgo = new Date(Date.now() - 7 * DAY).toISOString();
  const runs = db.prepare("SELECT id FROM generation_jobs WHERE created_at >= ?").all(weekAgo).map((r) => r.id);
  const drafts = content.allItems("mcq").concat(content.allItems("drill")).filter((i) => runs.includes(i.job_id));
  const gen = runs.length
    ? { runs: runs.length, drafts: drafts.length, passedPct: drafts.length ? pct(drafts.filter((d) => d.verify && d.verify.status === "pass").length, drafts.length) : null, approvedPct: drafts.length ? pct(drafts.filter((d) => d.status === "published").length, drafts.length) : null }
    : { runs: 0, drafts: 0, passedPct: null, approvedPct: null };

  // AI spend, as logged per call (ai_spend, written by hints.js): the total since logging began, per provider and model
  const spendBy = db.prepare("SELECT provider, model, COUNT(*) calls, SUM(input) input, SUM(output) output, SUM(cost) cost, SUM(cost IS NULL) unpriced FROM ai_spend GROUP BY provider, model ORDER BY SUM(cost) DESC").all();
  const spendAll = db.prepare("SELECT COUNT(*) calls, SUM(cost) cost, MIN(at) since FROM ai_spend").get();
  const spend = { total: +(spendAll.cost || 0).toFixed(4), calls: spendAll.calls, since: spendAll.since || null, last30: +(db.prepare("SELECT SUM(cost) c FROM ai_spend WHERE at >= ?").get(since30).c || 0).toFixed(4), unpriced: spendBy.reduce((k, r) => k + r.unpriced, 0), byModel: spendBy.map((r) => ({ provider: r.provider, model: r.model, calls: r.calls, input: r.input, output: r.output, cost: +(r.cost || 0).toFixed(4) })) };

  const backups = backup.list();
  return {
    spend,
    summary: { ...s, levels },
    kpis: {
      exercises: s.total, browser: s.browser, server: s.server,
      selfCheck: s.selfCheck, selfPct: pct(s.selfCheck, s.total),
      mcq, queue: queue.length, completed30: done.length,
    },
    gaps: gaps.slice(0, 3),
    recent: { count: recent.length, items: recent.slice(0, 5), baseline: c.active.filter((i) => i.added_at <= library.BASELINE_AT).length, baselineAt: library.BASELINE_AT },
    gen,
    health: health.summary(),
    activity: days,
    // cross-links inside exercises learners can see (links inside removed duplicates do not count)
    footer: { links: c.active.reduce((k, i) => k + (String(i.body || "").match(/\[\[ref:/g) || []).length, 0), duplicates: c.dups.length, bookmarks: db.prepare("SELECT COUNT(*) AS n FROM bookmarks").get().n, setups: c.setups.length },
    lastBackup: backups[0] ? backups[0].created_at : null,
  };
}

/** Live status: AI providers, the MySQL / PostgreSQL checkers, the in-browser datasets. */
async function system() {
  const c = library.get();
  const provs = listProviders().filter((p) => p.id !== "auto").map((p) => ({
    id: p.id, label: p.label.replace(/ only$/, ""), model: p.model,
    state: !p.configured ? "missing" : p.last && !p.last.ok ? "failing" : "ready",
    detail: !p.configured ? "key missing" : p.last && !p.last.ok ? `failing: ${p.last.error}` : p.last ? `ready · last call ${p.last.at}` : "ready · key set, not used since start",
  }));
  const engine = async (track) => { try { await ping(track); return "online"; } catch { return "offline"; } };
  const [mysql, pg] = await Promise.all([engine("mysql"), engine("postgres")]);
  const server = c.active.filter((i) => i.kind === "server");
  const datasets = Object.values(library.DATASETS).map((d) => ({ key: d.key, ok: (library.datasetSql(d.key) || []).length > 0 }));
  return {
    checkedAt: new Date().toISOString(),
    providers: provs,
    mysql: { state: mysql, serves: server.length },
    postgres: { state: pg, serves: server.filter((i) => i.ref.postgres).length },
    browser: { state: datasets.every((d) => d.ok) ? "ready" : "missing", datasets: datasets.length, serves: c.active.filter((i) => i.kind !== "server").length },
  };
}

// ---- import: rows from CSV / JSON -> verified drills (failures go to the review queue)
const LEVEL_NAMES = library.LEVELS.map((L) => L.title.toLowerCase());
function normalise(row, defaults = {}) {
  const get = (...names) => { for (const n of names) for (const k of Object.keys(row)) if (k.trim().toLowerCase() === n) return String(row[k] == null ? "" : row[k]).trim(); return ""; };
  let level = Number(get("level")) || 0;
  if (!level) { const name = get("level").toLowerCase(); const k = LEVEL_NAMES.findIndex((t) => t === name || t.startsWith(name)); level = k + 1 || Number(defaults.level) || 0; }
  const diff = (get("difficulty", "diff") || defaults.diff || "").toLowerCase();
  const dataset = get("dataset", "database") || defaults.dataset || "";
  return {
    title: get("title"), task: get("prompt", "task", "question"), solution_sql: get("solution", "solution_sql", "answer"),
    level, diff, dataset, site: content.DATASETS[dataset] ? content.DATASETS[dataset].site : "", topic: content.LEVEL_TOPIC[level] || "select", summary: get("summary"),
  };
}
function importPreview(rows, defaults) {
  if (!Array.isArray(rows) || !rows.length) throw Object.assign(new Error("No rows to import"), { status: 400 });
  if (rows.length > 500) throw Object.assign(new Error("Import at most 500 rows at a time"), { status: 400 });
  const datasets = Object.values(library.DATASETS).map((d) => d.key);
  return rows.map((raw, k) => {
    const d = normalise(raw, defaults);
    const problems = [];
    if (!d.title) problems.push("no title");
    if (!d.task) problems.push("no prompt");
    if (!d.solution_sql) problems.push("no solution");
    if (!(d.level >= 1 && d.level <= 14)) problems.push("level must be 1-14");
    if (!["easy", "medium", "hard"].includes(d.diff)) problems.push("difficulty must be easy, medium or hard");
    if (!datasets.includes(d.dataset)) problems.push(`dataset must be one of ${datasets.join(", ")}`);
    const v = problems.length ? null : content.verifyDrill(d);
    const status = problems.length ? "invalid" : v.status;
    return { row: k + 1, data: d, status, problems, checks: v ? v.checks.filter((c) => !c.ok).map((c) => c.label + (c.detail ? ": " + c.detail : "")) : [], rows: v && v.result && v.result.ok ? v.result.count : null };
  });
}
function importCommit(rows, defaults) {
  const preview = importPreview(rows, defaults);
  let published = 0, queued = 0, skipped = 0;
  for (const p of preview) {
    if (p.status === "invalid") { skipped++; continue; }
    const pass = p.status !== "fail";
    content.saveItem({ kind: "drill", status: pass ? "published" : "draft", data: p.data, source: "imported" });
    if (pass) published++; else queued++;
  }
  library.build();
  return { published, queued, skipped, preview };
}

module.exports = { dashboard, system, importPreview, importCommit, flagsOf, originOf };
