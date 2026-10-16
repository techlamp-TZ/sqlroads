// Builds the React + Waffles front end into ../public/app/ as plain static files with hashed names.
// The server only serves them; it never runs Vite or Sass. tools/inject.mjs then writes the hashed
// names into public/index.html (and admin.html once the admin moves over).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("./"),
  base: "/app/",
  plugins: [react()],
  build: {
    outDir: here("../public/app"),
    emptyOutDir: true,
    manifest: "manifest.json",
    sourcemap: false,
    rollupOptions: {
      input: { main: here("./src/main.jsx") },
      output: { entryFileNames: "assets/[name]-[hash].js", chunkFileNames: "assets/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" },
    },
  },
  test: { environment: "jsdom", include: ["src/**/*.test.{js,jsx}"] },
});
