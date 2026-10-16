// Builds the React + Waffles front end into ../public/app/ as plain static files with hashed names.
// The server only serves them; it never runs Vite or Sass. tools/inject.mjs then writes the hashed
// names into public/index.html (and admin.html once the admin moves over).
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const W = here("./src/waffles");

// The Waffles sources import each other as packages; here they resolve to the copies in src/waffles/.
export const wafflesAlias = [
  { find: /^@waffles\/tokens\/future-tokens$/, replacement: W + "/tokens/future-tokens.js" },
  { find: /^@waffles\/tokens$/, replacement: W + "/tokens/core-tokens.js" },
  { find: /^@waffles\/icons$/, replacement: W + "/react/icons/index.ts" },
  { find: /^@waffles\/([a-z-]+)$/, replacement: W + "/react/$1/src/index" },
];

// Waffles styles its components with Emotion's css prop (its Babel preset switched it on for every file).
// Only the Waffles React files get Emotion's JSX; the rest of the app does not load Emotion.
export const wafflesEmotionJsx = {
  name: "waffles-emotion-jsx",
  enforce: "pre",
  transform(code, id) {
    if (/[\\/]src[\\/]waffles[\\/]react[\\/][^?]*\.tsx$/.test(id) && !code.includes("@jsxImportSource")) {
      return { code: "/** @jsxImportSource @emotion/react */\n" + code, map: null };
    }
    return null;
  },
};

export default defineConfig({
  root: here("./"),
  base: "/app/",
  plugins: [wafflesEmotionJsx, react()],
  resolve: { alias: wafflesAlias },
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
  test: { environment: "jsdom", include: ["src/**/*.test.{js,jsx,ts,tsx}"], setupFiles: ["./src/test-setup.js"] },
});
