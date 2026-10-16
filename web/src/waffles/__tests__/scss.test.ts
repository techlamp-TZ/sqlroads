// @vitest-environment node
// The Waffles SCSS on the module system: every entry compiles with no errors and no deprecation warnings,
// and the CSS it produces takes every colour from the tokens.
import { test, expect } from "vitest";
import { compileAll, ENTRIES } from "../../../tools/check-scss.mjs";

const results = compileAll();

test("all 13 stylesheet entry points compile with no warnings", () => {
  expect(ENTRIES.length).toBe(13);
  expect(results.filter((r) => !r.ok).map((r) => r.entry + ": " + r.error)).toEqual([]);
  expect(results.flatMap((r) => r.warnings.map((w) => r.entry + ": " + w))).toEqual([]);
});

test("no @import, lighten() or darken() left in the sources", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const root = new URL("../", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
  const files = (d: string): string[] => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? files(path.join(d, e.name)) : [path.join(d, e.name)]);
  const bad = files(root).filter((f) => f.endsWith(".scss")).flatMap((f) => fs.readFileSync(f, "utf8").split("\n").map((l, i) => [f, i + 1, l] as const))
    .filter(([, , l]) => /^\s*@import\b|\b(lighten|darken)\(/.test(l.replace(/\/\/.*$/, "")));
  expect(bad.map(([f, n]) => f + ":" + n)).toEqual([]);
});

test("the compiled CSS has no literal colours (only tokens; inline SVG data excepted)", () => {
  const literal = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]|(?<![-\w])(white|black)(?=\s*[;,)}!])/;
  const hits = results.flatMap((r) => (r.css || "").split("\n").filter((l) => !l.includes("data:image/svg+xml") && literal.test(l)).map((l) => r.entry + ": " + l.trim()));
  expect(hits).toEqual([]);
});
