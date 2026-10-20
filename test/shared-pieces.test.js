// The shared pieces: one copy each (cards.js, compare.js and the pieces in app.js), the React wrappers use them,
// and the side-by-side test page never reaches the live app.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const ROOT = path.join(__dirname, "..");
const files = (d) => (fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === "node_modules" || e.name === "storybook-static" ? [] : files(path.join(d, e.name))) : [path.join(d, e.name)])) : []);

test("public/cards.js and public/compare.js exist once: no copy in web/ or in the build", () => {
  for (const f of ["cards.js", "compare.js"]) assert.ok(fs.existsSync(path.join(ROOT, "public", f)), f);
  const all = files(path.join(ROOT, "web")).concat(files(path.join(ROOT, "public", "app")));
  assert.deepStrictEqual(all.filter((f) => /[\\/](cards|compare)\.js$/.test(f)).map((f) => path.relative(ROOT, f)), []);
  // their code is not bundled into the React build either (it reads them from the page)
  for (const f of files(path.join(ROOT, "public", "app")).filter((f) => f.endsWith(".js"))) {
    const js = fs.readFileSync(f, "utf8");
    // (the old app, bundled since Phase 6, calls Cards.diagnoseAttempt and friends: only a definition is a copy)
    assert.ok(!/function diagnoseAttempt\(|function checkJoinMapper\(|diagnoseAttempt:function|\bSqlCompare\s*=[^=]/.test(js), "card engine code inside " + path.basename(f));
  }
});

test("app.js exposes the shared pieces the wrappers use, as the one copy", () => {
  const app = fs.readFileSync(path.join(ROOT, "web", "src", "legacy", "app.js"), "utf8");
  const block = /window\.SQLDrillsShared = \{([\s\S]*?)\n  \};/.exec(app);
  assert.ok(block, "window.SQLDrillsShared in app.js");
  const names = [...block[1].matchAll(/(\w+): \1\b/g)].map((m) => m[1]).sort();
  const shared = fs.readFileSync(path.join(ROOT, "web", "src", "shared", "shared.jsx"), "utf8");
  const used = [...new Set([...shared.matchAll(/\bs\.(\w+)\(/g)].map((m) => m[1]))].sort();
  for (const u of used) assert.ok(names.includes(u), "the wrappers call " + u + ", which app.js does not expose");
  // each is a function, or a value (Engine, LEARN_STEPS), defined once in app.js
  const defs = (fn) => (app.match(new RegExp("function " + fn + "\\(|\\n  var " + fn + " = ", "g")) || []).length; // top-level vars only
  for (const fn of names) assert.strictEqual(defs(fn), 1, fn + " is defined once in app.js (found " + defs(fn) + ")");
  // the wrappers render through app.js, never their own copies of the old markup builders
  const code = shared.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(code, /<(section|dialog|table|textarea)\b|class(Name)?=["'{][^"'}]*\b(schema-panel|ws-card|xcard|sp-|grid rdiff)/, "a wrapper builds old markup itself");
});

test("exampleBox: the lesson card still renders its example through it", () => {
  const app = fs.readFileSync(path.join(ROOT, "web", "src", "legacy", "app.js"), "utf8");
  const card = /function lessonCard\(l, opts\) \{[\s\S]*?\n  \}/.exec(app)[0];
  assert.match(card, /exampleBox\(l\)/);
  assert.doesNotMatch(card, /lessonExample\(|The real result/);
});

test("the side-by-side test page is never part of the project", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "public", "index.html")) || !/wf-test/.test(fs.readFileSync(path.join(ROOT, "public", "index.html"), "utf8")));
  let tracked = "";
  try { tracked = execSync("git ls-files", { cwd: ROOT, encoding: "utf8" }); } catch { return; } // not a git checkout
  assert.ok(!/(^|\n)(public\/wf-test|web\/test-page)\//.test(tracked), "the test page is tracked by git");
  const bridge = fs.readFileSync(path.join(ROOT, "web", "src", "bridge.jsx"), "utf8");
  assert.doesNotMatch(bridge, /wf-test|pairs\.jsx|catalog\//, "a test page route in the live router");
});
