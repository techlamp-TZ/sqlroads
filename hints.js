// AI hints for drills and the SQLPad playground. API keys stay on this server (.env);
// browsers only ever see the hint text.
const { DatabaseSync } = require("node:sqlite");
const fs = require("node:fs");
const path = require("node:path");

const PROVIDERS = {
  claude: {
    label: "Claude",
    keyVar: "ANTHROPIC_API_KEY",
    // Cheapest models confirmed available on this account (2026-10-12); override in .env.
    model: () => process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
    async ask({ system, user, key, model, maxTokens, onUsage }) {
      const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
      const body = await post(`${base}/v1/messages`, {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      }, {
        model,
        max_tokens: maxTokens || 700,
        system,
        messages: [{ role: "user", content: user }],
        ...(/^claude-(sonnet|opus|haiku)-5/.test(model) ? { output_config: { effort: "low" } } : {}),
      });
      if (onUsage && body.usage) onUsage({ input: body.usage.input_tokens || 0, output: body.usage.output_tokens || 0 });
      return (body.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
    },
  },
  openai: {
    label: "OpenAI",
    keyVar: "OPENAI_API_KEY",
    model: () => process.env.OPENAI_MODEL || "gpt-5-nano",
    async ask({ system, user, key, model, maxTokens, onUsage, images }) {
      const base = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
      // max_completion_tokens (not max_tokens): reasoning models reject max_tokens, and the
      // budget covers their hidden reasoning too. "minimal" effort keeps gpt-5 hints cheap and fast.
      const payload = {
        model,
        max_completion_tokens: Math.max(2000, (maxTokens || 0) * 2),
        // images (data: URLs) go with the text in one user message (vision models, e.g. gpt-4.1-mini)
        messages: [{ role: "system", content: system }, { role: "user", content: images && images.length ? [{ type: "text", text: user }].concat(images.map((url) => ({ type: "image_url", image_url: { url, detail: "high" } }))) : user }],
      };
      if (/^gpt-5(-|$)/.test(model)) payload.reasoning_effort = "minimal";
      const body = await post(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, payload);
      if (onUsage && body.usage) onUsage({ input: body.usage.prompt_tokens || 0, output: body.usage.completion_tokens || 0 });
      return body.choices?.[0]?.message?.content || "";
    },
  },
  deepseek: {
    label: "DeepSeek",
    keyVar: "DEEPSEEK_API_KEY",
    model: () => process.env.DEEPSEEK_MODEL || "deepseek-flash",
    async ask({ system, user, key, model, maxTokens, onUsage }) {
      const base = process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com";
      // DeepSeek reasons before it answers and the reasoning counts against max_tokens: a small budget can be used up
      // with nothing left for the answer. So the budget is at least 12,000, and an empty answer is retried once with double.
      let budget = Math.max(DEEPSEEK_MIN_TOKENS, (maxTokens || 700) * 3);
      for (let attempt = 0; attempt < 2; attempt++) {
        const body = await post(`${base}/chat/completions`, { authorization: `Bearer ${key}` }, {
          model,
          max_tokens: budget,
          messages: [{ role: "system", content: system }, { role: "user", content: user }],
        });
        if (onUsage && body.usage) onUsage({ input: body.usage.prompt_tokens || 0, output: body.usage.completion_tokens || 0 });
        const text = body.choices?.[0]?.message?.content || "";
        if (text.trim()) return text;
        budget *= 2;
      }
      return "";
    },
  },
};

const DEEPSEEK_MIN_TOKENS = 12000;

// ---- roles for content generation (the learning model, generated drafts, reference answers) ----
// One provider generates, a different one reviews; Claude Sonnet breaks ties. Learner hints keep their own default models.
const ROLES = {
  generator: { provider: "openai", model: process.env.GENERATOR_MODEL || "gpt-4.1-mini" },
  // pinned (not overridable by DEEPSEEK_MODEL): checked 2026-10-14, GET /models lists only deepseek-flash and
  // deepseek-v4-pro, and "deepseek-v4-flash" is answered by deepseek-flash too. deepseek-flash is DeepSeek-V4.1-Flash.
  reviewer: { provider: "deepseek", model: "deepseek-flash" },
  tieBreaker: { provider: "claude", model: "claude-sonnet-5-5" },
};
// list prices per million tokens (USD): [input, output]. DeepSeek bills by time of day: the peak rate is used so
// estimates are never low (off-peak is half). gpt-4o-mini is the fallback for a key without gpt-4.1-mini.
const PRICE = {
  "gpt-4.1-mini": [0.4, 1.6], "gpt-4o-mini": [0.15, 0.6], "gpt-5-nano": [0.05, 0.4],
  "deepseek-flash": [0.3, 1.2], // DeepSeek-V4.1-Flash, peak rate (V4 Flash was $0.14 / $0.28)
  "claude-haiku-4-5-20251001": [1, 5], "claude-sonnet-5-5": [2, 10],
};
const costOf = (usage) => Object.entries(usage || {}).reduce((sum, [m, u]) => sum + (PRICE[m] ? (u.input * PRICE[m][0] + u.output * PRICE[m][1]) / 1e6 : 0), 0);

// ---- AI spend log: every billed call of every provider (hints, generation, reviews, tie-breaks) is one ai_spend row ----
// The providers' ask() report tokens through onUsage; each ask is wrapped once so the call is logged whether or not the
// caller asked for usage. A failed log never fails the call.
let spendDb = null;
function logSpend(provider, model, purpose, u) {
  try {
    spendDb = spendDb || require("./db.js");
    const p = PRICE[model], input = Math.max(0, Number(u.input) || 0), output = Math.max(0, Number(u.output) || 0);
    spendDb.prepare("INSERT INTO ai_spend (at, provider, model, purpose, input, output, cost) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .run(new Date().toISOString(), provider, String(model || ""), purpose || null, input, output, p ? (input * p[0] + output * p[1]) / 1e6 : null);
  } catch (e) { console.warn("[ai_spend] not logged: " + e.message); }
}
for (const [id, p] of Object.entries(PROVIDERS)) {
  const ask = p.ask;
  p.ask = function (o) { const cb = o.onUsage; return ask.call(this, { ...o, onUsage: (u) => { logSpend(id, o.model, o.purpose, u); if (cb) cb(u); } }); };
}
/** The model content generation uses for a provider: the generator's or reviewer's model, else the provider's default. */
const generationModel = (id) => ([ROLES.generator, ROLES.reviewer].find((r) => r.provider === id) || {}).model || PROVIDERS[id].model();

async function post(url, headers, payload) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90000),
    });
  } catch (e) {
    throw new Error(e.name === "TimeoutError" ? "The AI provider took too long to answer." : `Could not reach the AI provider (${e.message}).`);
  }
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }
  if (!res.ok) {
    const msg = body?.error?.message || body?.message || text.slice(0, 300) || res.statusText;
    throw new Error(`${res.status}: ${msg}`);
  }
  return body || {};
}

// the last real call to each provider (hints or generation): shown as Ready / failing in admin
const lastCall = {};
const note = (id, ok, error) => { lastCall[id] = { ok, at: new Date().toISOString(), error: error ? String(error).slice(0, 200) : undefined }; };

function listProviders() {
  const list = fallbackOrder().map((id) => ({
    id,
    label: `${PROVIDERS[id].label} only`,
    model: PROVIDERS[id].model(),
    configured: !!process.env[PROVIDERS[id].keyVar],
    last: lastCall[id] || null,
  }));
  const order = fallbackOrder().filter((id) => process.env[PROVIDERS[id].keyVar]).map((id) => PROVIDERS[id].label);
  const auto = {
    id: "auto",
    label: order.length ? `Auto: ${order.join(" → ")}` : `Auto: ${fallbackOrder().map((id) => PROVIDERS[id].label).join(" → ")}`,
    model: "",
    configured: order.length > 0,
  };
  return [auto, ...list];
}

const DATASETS = path.join(__dirname, "datasets");
const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

// The live MySQL/PostgreSQL connections (see start-all.js): the 30-day course (practice, manual,
// sqlbolt) and the SQL Exercises (one database / schema per set).
const COURSE_SCHEMAS = ["practice", "manual", "sqlbolt"];
const EXERCISE_SCHEMAS = require("./exercises/load-exercises.js").SETS.map((s) => s.schema);
const LIVE = {
  coursemysql: { engine: "mysql", schemas: COURSE_SCHEMAS, primary: "practice", dialect: "MySQL 8",
    note: "Tables are in the practice schema unless prefixed; the learner may switch schema with USE / SET search_path." },
  coursepg: { engine: "postgres", database: "sql_course", schemas: COURSE_SCHEMAS, primary: "practice", dialect: "PostgreSQL",
    note: "Tables are in the practice schema unless prefixed; the learner may switch schema with USE / SET search_path." },
  exmysql: { engine: "mysql", schemas: EXERCISE_SCHEMAS, sampleAll: true, dialect: "MySQL 8",
    note: "Each exercise set is its own database (ex01_computer_store ... ex10_people_addresses); the learner's USE line picks the set, so write table names without the database prefix." },
  expg: { engine: "postgres", database: "sql_exercises", schemas: EXERCISE_SCHEMAS, sampleAll: true, dialect: "PostgreSQL",
    note: "Each exercise set is its own schema (ex01_computer_store ... ex10_people_addresses); the learner's SET search_path line picks the set, so write table names without the schema prefix." },
};

/** Schema from the live MySQL/PostgreSQL server: columns of every table, plus 2 sample rows (primary schema, or all). */
async function describeCourseSchema(siteId) {
  const cfg = LIVE[siteId];
  const lines = [];
  const name = (r) => (cfg.primary && r.s === cfg.primary ? r.t : `${r.s}.${r.t}`);
  const sampled = (r) => cfg.sampleAll || r.s === cfg.primary;
  if (cfg.engine === "mysql") {
    const mysql = require("mysql2/promise");
    const c = await mysql.createConnection({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || 3306),
      user: process.env.MYSQL_USER || "root",
      password: process.env.MYSQL_ROOT_PASSWORD,
      dateStrings: true, // dates as stored, not shifted into the local time zone
    });
    try {
      const [cols] = await c.query(
        "SELECT table_schema AS s, table_name AS t, GROUP_CONCAT(CONCAT(column_name, ' ', column_type) ORDER BY ordinal_position SEPARATOR ', ') AS cols " +
          "FROM information_schema.columns WHERE table_schema IN (?) GROUP BY table_schema, table_name ORDER BY table_schema <> ?, table_schema, table_name",
        [cfg.schemas, cfg.primary || ""]
      );
      for (const r of cols) {
        let sample = "";
        if (sampled(r)) {
          const [rows] = await c.query(`SELECT * FROM \`${r.s}\`.\`${r.t.replace(/`/g, "``")}\` LIMIT 2`);
          sample = `; e.g. ${rows.map((x) => JSON.stringify(Object.values(x))).join(" ")}`;
        }
        lines.push(`TABLE ${name(r)} (${r.cols})${sample}`);
      }
    } finally {
      await c.end();
    }
  } else {
    const { Client } = require("pg");
    const c = new Client({
      host: process.env.POSTGRES_HOST || "127.0.0.1",
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || "postgres",
      password: process.env.POSTGRES_PASSWORD,
      database: cfg.database,
      // dates/timestamps as stored, not shifted into the local time zone
      types: { getTypeParser: (oid, fmt) => ([1082, 1114, 1184].includes(oid) ? (v) => v : require("pg").types.getTypeParser(oid, fmt)) },
    });
    await c.connect();
    try {
      const { rows: cols } = await c.query(
        "SELECT table_schema AS s, table_name AS t, string_agg(column_name || ' ' || data_type, ', ' ORDER BY ordinal_position) AS cols " +
          "FROM information_schema.columns WHERE table_schema = ANY($1) GROUP BY table_schema, table_name ORDER BY table_schema <> $2, table_schema, table_name",
        [cfg.schemas, cfg.primary || ""]
      );
      for (const r of cols) {
        let sample = "";
        if (sampled(r)) {
          const { rows } = await c.query(`SELECT * FROM "${r.s}"."${r.t.replace(/"/g, '""')}" LIMIT 2`);
          sample = `; e.g. ${rows.map((x) => JSON.stringify(Object.values(x))).join(" ")}`;
        }
        lines.push(`TABLE ${name(r)} (${r.cols})${sample}`);
      }
    } finally {
      await c.end();
    }
  }
  return lines.length ? `${cfg.note}\n${lines.join("\n")}`.slice(0, 9000) : "";
}

const DIALECTS = Object.fromEntries(Object.entries(LIVE).map(([id, cfg]) => [id, cfg.dialect]));

/** Schema text and SQL dialect for a track or course connection. */
async function describeContext(siteId) {
  if (DIALECTS[siteId]) {
    const schema = await describeCourseSchema(siteId).catch((e) => {
      console.warn(`[hints] could not read ${siteId} schema: ${e.message}`);
      return "";
    });
    return { schema, dialect: DIALECTS[siteId] };
  }
  return { schema: describeSchema(siteId), dialect: "SQLite" };
}

/** Schema + 3 sample rows per table of a track's live database (includes imported tables). */
function describeSchema(siteId) {
  const file = path.join(DATASETS, `${siteId}.db`);
  if (!/^[a-z0-9_-]+$/i.test(siteId) || !fs.existsSync(file)) return "";
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();
    const parts = tables.map(({ name }) => {
      const cols = db.prepare(`PRAGMA table_info(${q(name)})`).all().map((c) => `${c.name} ${c.type}`.trim());
      const rows = db.prepare(`SELECT * FROM ${q(name)} LIMIT 3`).all().map((r) => JSON.stringify(Object.values(r)));
      const count = db.prepare(`SELECT COUNT(*) AS n FROM ${q(name)}`).get().n;
      return `TABLE ${name} (${cols.join(", ")}) -- ${count} rows; e.g. ${rows.join(" ")}`;
    });
    return parts.join("\n").slice(0, 8000);
  } finally {
    db.close();
  }
}

const LEVELS = {
  1: "Level 1 of 3 (a nudge): name the idea or clause they need (e.g. GROUP BY, a JOIN, a subquery) and why. No SQL code at all.",
  2: "Level 2 of 3 (a stronger hint): name the exact tables, columns and clauses to use and the order to build them in. A short fragment such as one clause is fine, but not the full query.",
  3: "Level 3 of 3 (almost there): give a query skeleton with ___ blanks for the key parts and say what goes in each blank. Still leave the blanks for them to fill.",
};

function buildPrompt({ task, sql, error, level, schema, dialect = "SQLite" }) {
  const system = [
    `You are a patient SQL tutor helping a learner practise SQL on a ${dialect} database.`,
    "Give a HINT, never the complete working query, even if asked. Never write a SELECT statement that would run and solve the task.",
    LEVELS[level] || LEVELS[1],
    "If their SQL has an error, first explain in plain words what the error means and where it comes from.",
    "If their SQL already solves the task, say so and suggest one way to double-check the result.",
    `Only mention tables and columns that exist in the schema. Use ${dialect} syntax.`,
    "Be brief: at most 120 words. Use Markdown, with any SQL inside ```sql code blocks.",
  ].join("\n");
  const user = [
    `Database schema (${dialect}):\n${schema || "(schema unavailable)"}`,
    `Task: ${task?.trim() || "(no task given; work out what they are trying to do from their SQL)"}`,
    `My SQL so far:\n\`\`\`sql\n${sql?.trim() || "-- nothing written yet"}\n\`\`\``,
    error ? `Running it gave this error: ${error}` : "",
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

// "auto" tries providers in this order and falls back to the next one on any failure
// (bad key, rate limit, outage, timeout, empty answer). Override with HINT_PROVIDER_ORDER.
function fallbackOrder() {
  const order = (process.env.HINT_PROVIDER_ORDER || "openai,claude,deepseek")
    .split(",").map((s) => s.trim().toLowerCase()).filter((id) => PROVIDERS[id]);
  return [...new Set([...order, ...Object.keys(PROVIDERS)])];
}

// Cheap models sometimes ignore "hint, not answer". A hint "leaks" when a code block holds
// a runnable query (SELECT ... FROM with no ___ blanks), or, at level 1, has any code block.
const FENCE = /```[a-zA-Z]*\n?([\s\S]*?)```/g;
function leakingBlocks(text, level) {
  const blocks = [...text.matchAll(FENCE)].map((m) => ({ whole: m[0], code: m[1] }));
  return blocks.filter((b) => level === 1 || (/\bselect\b[\s\S]*\bfrom\b/i.test(b.code) && !/_{3,}/.test(b.code)));
}
function stripLeaks(text, level) {
  let out = text;
  for (const b of leakingBlocks(text, level)) {
    out = out.replace(b.whole, "_(Code removed so you can write it yourself. Ask for the next hint if you're stuck.)_");
  }
  return out;
}

async function askOne(id, prompt, level) {
  const p = PROVIDERS[id];
  const model = p.model();
  const key = process.env[p.keyVar];
  let text = (await p.ask({ ...prompt, key, model, purpose: "hint" })).trim();
  if (!text) throw new Error("returned an empty answer");
  if (leakingBlocks(text, level).length) {
    const stricter = {
      ...prompt,
      user:
        prompt.user +
        "\n\nIMPORTANT: Do not include a runnable query." +
        (level === 1 ? " At this level, write no SQL code at all." : " Any SQL you show must use ___ blanks for the key parts."),
    };
    const retry = (await p.ask({ ...stricter, key, model, purpose: "hint" }).catch(() => "")).trim();
    if (retry) text = retry;
    text = stripLeaks(text, level);
  }
  return { text, provider: id, label: p.label, model };
}

async function getHint({ provider = "auto", siteId, task, sql, error, level }) {
  if (provider !== "auto" && !PROVIDERS[provider]) {
    throw Object.assign(new Error(`Unknown provider "${provider}"`), { status: 400 });
  }
  const candidates = (provider === "auto" ? fallbackOrder() : [provider]).filter((id) => process.env[PROVIDERS[id].keyVar]);
  if (!candidates.length) {
    const need = provider === "auto" ? "OPENAI_API_KEY (or ANTHROPIC_API_KEY / DEEPSEEK_API_KEY)" : PROVIDERS[provider].keyVar;
    const who = provider === "auto" ? "No AI provider is" : `${PROVIDERS[provider].label} isn't`;
    throw Object.assign(new Error(`${who} set up yet: add ${need} to sql-drills-server/.env and restart.`), { status: 400 });
  }

  const lvl = Math.min(3, Math.max(1, Number(level) || 1));
  const { schema, dialect } = await describeContext(String(siteId || ""));
  const prompt = buildPrompt({
    task: String(task || "").slice(0, 2000),
    sql: String(sql || "").slice(0, 6000),
    error: String(error || "").slice(0, 1000),
    level: lvl,
    schema,
    dialect,
  });

  const failed = [];
  for (const id of candidates) {
    try {
      const answer = await askOne(id, prompt, lvl);
      note(id, true);
      return { ...answer, level: lvl, fellBackFrom: failed };
    } catch (e) {
      failed.push({ provider: id, label: PROVIDERS[id].label, error: e.message });
      note(id, false, e.message);
      console.warn(`[hints] ${PROVIDERS[id].label} failed: ${e.message}`);
    }
  }
  throw new Error(failed.map((f) => `${f.label}: ${f.error}`).join(" | "));
}

/**
 * A plain completion (content generation): the chosen provider, or "auto" with the same
 * fallback order as hints. Returns { text, provider, label, model, fellBackFrom }.
 */
async function complete({ provider = "auto", model, order, system, user, maxTokens = 4000, onUsage, forGeneration = false, images, purpose }) {
  if (images && images.length && provider !== "openai") throw Object.assign(new Error("Images need the OpenAI provider (a vision model)."), { status: 400 });
  if (provider !== "auto" && !PROVIDERS[provider]) throw Object.assign(new Error(`Unknown provider "${provider}"`), { status: 400 });
  const candidates = (provider === "auto" ? (order && order.length ? order : fallbackOrder()) : [provider]).filter((id) => PROVIDERS[id] && process.env[PROVIDERS[id].keyVar]);
  if (!candidates.length) throw Object.assign(new Error("No AI provider is set up: add an API key to sql-drills-server/.env and restart."), { status: 400 });
  const failed = [];
  for (const id of candidates) {
    const p = PROVIDERS[id];
    try {
      const m = (provider !== "auto" && model) || (forGeneration ? generationModel(id) : p.model());
      const text = (await p.ask({ system, user, images, key: process.env[p.keyVar], model: m, maxTokens, purpose: purpose || (forGeneration ? "generation" : "completion"), onUsage: onUsage && ((u) => onUsage({ provider: id, model: m, ...u })) })).trim();
      if (!text) throw new Error("returned an empty answer");
      note(id, true);
      return { text, provider: id, label: p.label, model: m, fellBackFrom: failed };
    } catch (e) {
      failed.push({ provider: id, label: p.label, error: e.message });
      note(id, false, e.message);
    }
  }
  throw new Error(failed.map((f) => `${f.label}: ${f.error}`).join(" | "));
}

module.exports = { listProviders, getHint, buildPrompt, describeSchema, describeContext, complete, ROLES, PRICE, costOf, generationModel };
