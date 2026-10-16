// After `vite build`: write the hashed bundle names into the pages, between the waffles markers.
// The module script is deferred, so it runs after the old app's classic scripts; the old router
// then hands the routes React owns to it (see public/app.js, "React pages").
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const pub = fileURLToPath(new URL("../../public/", import.meta.url));
const manifest = JSON.parse(fs.readFileSync(pub + "app/manifest.json", "utf8"));
const entry = manifest["src/main.jsx"];
if (!entry) throw new Error("manifest has no src/main.jsx entry");
const tags = [
  ...(entry.css || []).map((f) => `<link rel="stylesheet" href="/app/${f}">`),
  `<script type="module" src="/app/${entry.file}"></script>`,
].join("\n");
const START = "<!-- waffles:start -->", END = "<!-- waffles:end -->";
for (const page of ["index.html"]) {
  const file = pub + page;
  let html = fs.readFileSync(file, "utf8");
  const eol = html.includes("\r\n") ? "\r\n" : "\n";
  const block = START + eol + tags.replace(/\n/g, eol) + eol + END;
  const a = html.indexOf(START), b = html.indexOf(END);
  if (a >= 0 && b > a) html = html.slice(0, a) + block + html.slice(b + END.length);
  else if (html.includes("</head>")) html = html.replace("</head>", block + eol + "</head>");
  else throw new Error(page + " has no </head>");
  fs.writeFileSync(file, html);
  console.log("inject:", page, "→", entry.file, (entry.css || []).join(" "));
}
