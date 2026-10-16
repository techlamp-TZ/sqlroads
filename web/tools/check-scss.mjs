// Compiles every Waffles SCSS entry point (dev check, also used by the tests): no errors, no deprecation warnings.
import * as sass from "sass";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const web = fileURLToPath(new URL("../", import.meta.url));
export const ENTRIES = [
  "src/waffles/stylesheets/core/scss/ingredients.scss",
  "src/waffles/stylesheets/core/scss/normalize.scss",
  ...fs.readdirSync(web + "src/waffles/stylesheets").filter((d) => d !== "core").map((d) => `src/waffles/stylesheets/${d}/_${d}.scss`),
  ...["button", "card", "tag"].map((p) => `src/waffles/react/${p}/legacy/_${p}.scss`),
];
export function compileAll() {
  return ENTRIES.map((e) => {
    const warnings = [];
    try {
      const r = sass.compile(web + e, { logger: { warn: (m, o) => warnings.push(((o.deprecationType && o.deprecationType.id) || "warn") + ": " + m.split("\n")[0] + (o.span ? " @ " + o.span.url?.pathname.split("/waffles/")[1] + ":" + (o.span.start.line + 1) : "")) } });
      return { entry: e, ok: true, bytes: r.css.length, css: r.css, warnings };
    } catch (err) { return { entry: e, ok: false, error: err.message.split("\n").slice(0, 8).join(" | "), warnings }; }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  let bad = 0;
  for (const r of compileAll()) {
    console.log((r.ok ? "ok  " : "ERR ") + r.entry.replace("src/waffles/", "") + (r.ok ? " " + (r.bytes / 1024).toFixed(1) + "KB" : "  " + r.error));
    for (const w of r.warnings) console.log("    " + w);
    if (!r.ok || r.warnings.length) bad++;
  }
  process.exit(bad ? 1 : 0);
}
