// The AI spend log (hints.js → ai_spend): every billed provider call is one row with tokens and its cost at the list
// price. Runs on a temporary database with a stubbed fetch: no network, no real keys, no real data.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const DBF = path.join(os.tmpdir(), "sqldrills-spend-test-" + process.pid + ".sqlite");
process.env.SQLDRILLS_DB = DBF;
process.env.OPENAI_API_KEY = "test-key";
process.env.DEEPSEEK_API_KEY = "test-key";
const db = require("../db.js");
const hints = require("../hints.js");

test.after(() => { db.close(); for (const f of [DBF, DBF + "-wal", DBF + "-shm"]) fs.rmSync(f, { force: true }); });

const reply = (body) => async () => ({ ok: true, status: 200, statusText: "OK", text: async () => JSON.stringify(body) });

test("a generation call is logged with provider, model, tokens, purpose and its cost at the list price", async () => {
  global.fetch = reply({ choices: [{ message: { content: "hello" } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } });
  let seen = null;
  const r = await hints.complete({ provider: "openai", system: "s", user: "u", forGeneration: true, onUsage: (u) => { seen = u; } });
  assert.strictEqual(r.text, "hello");
  assert.deepStrictEqual(seen, { provider: "openai", model: "gpt-4.1-mini", input: 1000, output: 500 }, "the caller's own usage callback still works");
  const row = db.prepare("SELECT provider, model, purpose, input, output, cost FROM ai_spend ORDER BY id DESC LIMIT 1").get();
  assert.deepStrictEqual({ ...row }, { provider: "openai", model: "gpt-4.1-mini", purpose: "generation", input: 1000, output: 500, cost: (1000 * 0.4 + 500 * 1.6) / 1e6 });
});

test("every billed attempt is a row (DeepSeek's empty answer is retried, both are billed); unpriced models cost NULL", async () => {
  const before = db.prepare("SELECT COUNT(*) n FROM ai_spend").get().n;
  let k = 0;
  global.fetch = async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ choices: [{ message: { content: k++ ? "ok" : "" } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }) });
  await hints.complete({ provider: "deepseek", system: "s", user: "u", forGeneration: true });
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM ai_spend").get().n - before, 2);
  global.fetch = reply({ choices: [{ message: { content: "x" } }], usage: { prompt_tokens: 5, completion_tokens: 5 } });
  await hints.complete({ provider: "openai", model: "some-new-model", system: "s", user: "u" });
  const row = db.prepare("SELECT model, purpose, cost FROM ai_spend ORDER BY id DESC LIMIT 1").get();
  assert.deepStrictEqual({ ...row }, { model: "some-new-model", purpose: "completion", cost: null });
});

test("a failed call without usage logs nothing and the error still reaches the caller", async () => {
  const before = db.prepare("SELECT COUNT(*) n FROM ai_spend").get().n;
  global.fetch = async () => ({ ok: false, status: 401, statusText: "Unauthorized", text: async () => JSON.stringify({ error: { message: "bad key" } }) });
  await assert.rejects(hints.complete({ provider: "openai", system: "s", user: "u" }), /bad key/);
  assert.strictEqual(db.prepare("SELECT COUNT(*) n FROM ai_spend").get().n, before);
});
