// After `vite build`: write each page's bundle into it, between the waffles markers. public/index.html gets the
// old app's stylesheet (src/legacy/app.css, a CSS entry) and the learner module (src/main.jsx); public/admin.html
// gets app.css, admin.css and the admin module (src/admin-main.jsx). Stylesheets come first and in the old order,
// then the CSS of the module and the chunks it imports. The module runs after the page's classic scripts
// (cards.js, compare.js, help.js), which stay in public/ because the server and the tests use them too.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../../public/", import.meta.url));
const manifest = JSON.parse(fs.readFileSync(pub + "app/manifest.json", "utf8"));
const PAGES = {
  "index.html": ["src/legacy/app.css", "src/main.jsx"],
  "admin.html": ["src/legacy/app.css", "src/legacy/admin.css", "src/admin-main.jsx"],
};
const isCss = (k) => k.endsWith(".css");
// the CSS a module brings: its imported chunks' first, then its own
const cssOf = (key, seen = new Set()) => {
  if (seen.has(key)) return [];
  seen.add(key);
  const e = manifest[key] || {};
  return [...(e.imports || []).flatMap((k) => cssOf(k, seen)), ...(e.css || [])];
};
const START = "<!-- waffles:start -->", END = "<!-- waffles:end -->";
for (const [page, keys] of Object.entries(PAGES)) {
  for (const k of keys) if (!manifest[k]) throw new Error("manifest has no " + k + " entry");
  const entry = manifest[keys[keys.length - 1]];
  const css = [...new Set(keys.flatMap((k) => (isCss(k) ? [manifest[k].file] : cssOf(k))))];
  const tags = [
    ...css.map((f) => `<link rel="stylesheet" href="/app/${f}">`),
    // onerror: says at once that the bundle could not load
    `<script type="module" src="/app/${entry.file}" onerror="window.SQLDrillsReactFailed=true;dispatchEvent(new Event('sqldrills:react-failed'))"></script>`,
  ].join("\n");
  const file = pub + page;
  let html = fs.readFileSync(file, "utf8");
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const block = START + eol + tags.replace(/\n/g, eol) + eol + END;
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
  else if (html.includes("</head>")) html = html.replace("</head>", block + eol + "</head>");
  else throw new Error(page + " has no </head>");
  fs.writeFileSync(file, html);
  console.log("inject:", page, "→", entry.file, css.join(" "));
}
