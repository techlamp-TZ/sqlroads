// The Waffles design tokens (web/tokens → web/src/tokens) and the React build in public/app/.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const ROOT = path.join(__dirname, "..");
const WEB = path.join(ROOT, "web");
const T = JSON.parse(fs.readFileSync(path.join(WEB, "src/tokens/tokens.json"), "utf8"));
const kebab = (s) => s.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

test("every colour family has a text variant, in light and in dark", () => {
  assert.deepStrictEqual(T.families.slice().sort(), ["blue", "green", "navy", "orange", "pink", "purple", "red", "yellow"]);
  for (const theme of ["light", "dark"]) for (const f of T.families) {
    const v = T[theme]["color-" + kebab(f) + "-text"];
    assert.match(v || "", /^#[0-9A-F]{6}$/, theme + " " + f + "-text");
  }
  for (const f of T.families) for (const s of ["", "-dark", "-light"]) assert.ok(T.static["color-" + kebab(f) + s], f + s);
});

test("light and dark define the same roles, and every theme colour is a hex value", () => {
  assert.deepStrictEqual(Object.keys(T.light).sort(), Object.keys(T.dark).sort());
  for (const theme of ["light", "dark"]) for (const [k, v] of Object.entries(T[theme])) {
    if (k === "shadow-color") continue;
    assert.match(v, /^#[0-9A-F]{6}$/, theme + " " + k);
  }
});

test("the Waffles scales are all there (spacing, radii, shadows, type, breakpoints)", () => {
  for (const n of [0, 2, 4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128]) assert.ok(T.static["space-" + n] !== undefined, "space-" + n);
  assert.strictEqual(T.static["radius-small"], "4px");
  assert.strictEqual(T.static["radius-large"], "8px");
  for (const s of ["sm", "md", "lg", "xl"]) assert.match(T.static["shadow-" + s], /var\(--wf-shadow-color\)/);
  assert.strictEqual(T.static["font-size-base"], "16px");
  assert.deepStrictEqual(["xs", "sm", "md", "lg", "xl", "ws"].map((b) => T.static["breakpoint-" + b]), ["480px", "768px", "992px", "1200px", "1366px", "1680px"]);
  assert.match(T.static["font-sans"], /^"IBM Plex Sans"/);
  assert.match(T.static["font-mono"], /^"IBM Plex Mono"/);
});

test("the generated files are up to date with web/tokens", () => {
  const css = fs.readFileSync(path.join(WEB, "src/tokens/tokens.css"), "utf8");
  for (const [k, v] of Object.entries(T.light)) assert.ok(css.includes("--wf-" + k + ": " + v + ";"), "light " + k);
  for (const [k, v] of Object.entries(T.dark)) assert.ok(css.includes("--wf-" + k + ": " + v + ";"), "dark " + k);
  const ours = JSON.parse(fs.readFileSync(path.join(WEB, "tokens/sqldrills.json"), "utf8"));
  for (const theme of ["light", "dark"]) assert.deepStrictEqual(Object.keys(ours.themes[theme]).sort(), Object.keys(T[theme]).filter((k) => !/^color-/.test(k)).sort());
});

test("no hard-coded colour in web/src outside the generated tokens", () => {
  const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? (e.name === "tokens" ? [] : files(path.join(d, e.name))) : [path.join(d, e.name)]);
  // a literal colour: hex, rgb()/hsl() with a number, or a bare colour keyword used as a value (not part of a name)
  const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|\bhsla?\(\s*[\d.]|(?<![-\w$.'"])(white|black)(?=\s*[;,)])|['"](white|black)['"]/;
  const hits = [];
  // (tests are left out: they feed literal colours to the colour utilities on purpose)
  for (const f of files(path.join(WEB, "src")).filter((f) => /\.(js|jsx|ts|tsx|scss|css)$/.test(f) && !/[\\/]__tests__[\\/]|\.test\./.test(f))) {
    fs.readFileSync(f, "utf8").split("\n").forEach((line, i) => { if (COLOUR.test(line.replace(/\/\/.*$/, ""))) hits.push(path.relative(ROOT, f) + ":" + (i + 1) + "  " + line.trim()); });
  }
  assert.deepStrictEqual(hits, []);
});

test("no brand font, logo or name: copied files, and what the browser loads", () => {
  const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
  const copied = files(path.join(WEB, "tokens")).concat(files(path.join(WEB, "src")));
  for (const f of copied) {
    assert.ok(!/\.(woff2?|ttf|otf|eot|svg|png|jpe?g|gif|lottie)$/i.test(f), "asset file copied: " + f);
    // LICENSE and WAFFLES-SOURCE.txt are the attribution the MIT licence asks for
    if (!["LICENSE", "WAFFLES-SOURCE.txt"].includes(path.basename(f))) assert.ok(!/Feixen|DataCamp/i.test(fs.readFileSync(f, "utf8")), "brand name in " + f);
  }
  assert.ok(!fs.existsSync(path.join(WEB, "tokens/waffles/asset")), "the Waffles font token is not copied");
  for (const f of files(path.join(ROOT, "public/app"))) assert.ok(!/Feixen|DataCamp|waffles/i.test(fs.readFileSync(f, "utf8")), "brand name in the built " + path.basename(f));
  assert.ok(fs.existsSync(path.join(ROOT, "LICENSE-waffles.txt")));
  assert.ok(fs.existsSync(path.join(WEB, "tokens/waffles/LICENSE")));
  // icon SVG sources: the standard (155) and inverted (43) sets only; the 29 brand icons were never copied
  if (fs.existsSync(path.join(WEB, "icons"))) {
    const svgs = ["standard", "inverted"].flatMap((d) => fs.readdirSync(path.join(WEB, "icons", d)));
    assert.strictEqual(svgs.length, 198);
    assert.ok(!svgs.some((n) => /data-camp|datacamp|facebook|google|linkedin|twitter|youtube|instagram|github|slack|kaggle|apple|paypal|figma|leanpub|python|scala|^r\.svg$/i.test(n)), "brand icon");
    assert.deepStrictEqual(fs.readdirSync(path.join(WEB, "icons")).sort(), ["LICENSE", "inverted", "standard"]);
  }
  // the Waffles parts left out stay out (logos, course-loop graphics, logo spinner, social buttons, font files)
  for (const p of ["asset-components", "loaders", "heading", "button/src/SocialMediaButtons", "text/src/fontFaces"]) assert.ok(!fs.existsSync(path.join(WEB, "src/waffles/react", p)), p);
  assert.ok(!fs.existsSync(path.join(WEB, "src/waffles/stylesheets/core/scss/design/vendor/_feixen-font.scss")));
});

test("Storybook is development only: never in public/, never loaded by the pages", () => {
  const files = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
  for (const f of files(path.join(ROOT, "public"))) assert.ok(!/storybook|iframe\.html|sb-|\.stories\./i.test(path.relative(ROOT, f)), f);
  for (const page of ["index.html", "admin.html"]) assert.ok(!/storybook/i.test(fs.readFileSync(path.join(ROOT, "public", page), "utf8")), page);
  assert.ok(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8").includes("storybook-static/"));
});

test("contrast audit: every text and UI colour passes, light and dark", async () => {
  const { audit } = await import(pathToFileURL(path.join(WEB, "tools/contrast-audit.mjs")).href);
  const rows = audit(T);
  assert.ok(rows.length >= 100, "pairs checked: " + rows.length);
  assert.deepStrictEqual(rows.filter((r) => r.ratio < r.min).map((r) => r.theme + " " + r.fg + " on " + r.bg + " " + r.ratio.toFixed(2)), []);
});

test("public/index.html loads the built bundle, and the files exist", () => {
  const html = fs.readFileSync(path.join(ROOT, "public/index.html"), "utf8");
  const block = /<!-- waffles:start -->([\s\S]*?)<!-- waffles:end -->/.exec(html);
  assert.ok(block, "waffles markers in index.html");
  const refs = [...block[1].matchAll(/(?:href|src)="\/app\/([^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.some((r) => /^assets\/main-[\w-]+\.js$/.test(r)) && refs.some((r) => /^assets\/main-[\w-]+\.css$/.test(r)), refs.join(" "));
  for (const r of refs) assert.ok(fs.existsSync(path.join(ROOT, "public/app", r)), r);
  assert.match(block[1], /<script type="module"/);
  // the old app's scripts still load first (the bundle is a deferred module)
  assert.ok(html.indexOf('src="app.js"') > 0);
});
