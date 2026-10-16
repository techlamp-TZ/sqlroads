// Contrast audit of the design tokens, light and dark (WCAG 2 ratios):
//   every text role and every colour family's text variant on every surface   ≥ 4.5:1
//   text on each filled colour (accent, ok, bad)                              ≥ 4.5:1
//   focus ring and strong borders on every surface (non-text UI)             ≥ 3:1
// Prints each failure and exits with 1 if there is any. Run after `npm run tokens`.
import fs from "node:fs";
import { fileURLToPath } from "node:url";

export function luminance(c) {
  const m = /^#([0-9a-f]{6})$/i.exec(c);
  if (!m) throw new Error("not a hex colour: " + c);
  const ch = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function ratio(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }

export function audit(T) {
  const rows = [];
  for (const name of ["light", "dark"]) {
    const t = T[name], surfaces = T.roles.surfaces;
    const check = (fg, bg, min, kind) => rows.push({ theme: name, fg, bg, kind, min, ratio: ratio(t[fg], t[bg]) });
    const texts = [...T.roles.text, ...T.families.map((f) => "color-" + f.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase() + "-text")];
    for (const fg of texts) for (const bg of surfaces) check(fg, bg, 4.5, "text");
    for (const [fill, on] of T.roles.fills) check(on, fill, 4.5, "text on fill");
    for (const bg of surfaces) { check("focus", bg, 3, "focus ring"); check("border-strong", bg, 3, "UI border"); }
  }
  return rows;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const T = JSON.parse(fs.readFileSync(new URL("../src/tokens/tokens.json", import.meta.url), "utf8"));
  const rows = audit(T), bad = rows.filter((r) => r.ratio < r.min);
  for (const th of ["light", "dark"]) {
    const mine = rows.filter((r) => r.theme === th), low = mine.reduce((a, r) => (r.ratio / r.min < a.ratio / a.min ? r : a));
    console.log(th + ": " + mine.length + " pairs checked, lowest " + low.ratio.toFixed(2) + ":1 (" + low.fg + " on " + low.bg + ", needs " + low.min + ")");
  }
  for (const r of bad) console.log("FAIL " + r.theme + ": " + r.fg + " " + T[r.theme][r.fg] + " on " + r.bg + " " + T[r.theme][r.bg] + " = " + r.ratio.toFixed(2) + ":1 (needs " + r.min + ", " + r.kind + ")");
  console.log(bad.length ? bad.length + " failures" : "contrast audit: all pass");
  process.exit(bad.length ? 1 : 0);
}
