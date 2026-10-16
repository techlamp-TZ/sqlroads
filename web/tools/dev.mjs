// `npm run dev`: rebuild on every change and serve the app on :4100 with a database copy.
// public/ is read live, so this only runs in a test copy of the project (a folder holding the
// .sqldrills-copy marker), never in the live project that :4000 serves.
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const db = process.env.SQLDRILLS_DB;
const stop = (m) => { console.error("dev: " + m); process.exit(1); };
if (!fs.existsSync(path.join(root, ".sqldrills-copy"))) stop("not a test copy (no .sqldrills-copy marker). Run this in a copy of the project, never in the live one.");
if (!db || path.resolve(db) === path.join(root, "data.sqlite")) stop("set SQLDRILLS_DB to a database copy (made with VACUUM INTO).");

const run = (cmd, args, opts) => spawn(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts });
const web = fileURLToPath(new URL("../", import.meta.url));
run("node", ["tools/build-tokens.mjs"], { cwd: web }).on("exit", () => {
  // vite build --watch, then write the new hashed names into the page after each build
  const watch = spawn("npx", ["vite", "build", "--watch"], { cwd: web, shell: process.platform === "win32" });
  watch.stdout.on("data", (d) => { process.stdout.write(d); if (/built in/.test(String(d))) run("node", ["tools/inject.mjs"], { cwd: web }); });
  watch.stderr.on("data", (d) => process.stderr.write(d));
  run("node", ["server.js"], { cwd: root, env: { ...process.env, PORT: "4100", SQLDRILLS_DB: db } });
});
