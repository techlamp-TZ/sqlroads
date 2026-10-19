// Storybook: the Waffles component catalog. Development only: it builds into web/storybook-static/ (ignored by
// git), never into public/, and the running app does not load it.
import { mergeConfig } from "vite";
import { wafflesAlias, wafflesEmotionJsx } from "../vite.config.js";

export default {
  stories: ["../src/waffles/catalog/**/*.stories.@(jsx|tsx)", "../src/shared/catalog/**/*.stories.@(jsx|tsx)"],
  framework: { name: "@storybook/react-vite", options: { builder: { viteConfigPath: ".storybook/vite.storybook.mjs" } } },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  async viteFinal(config) {
    // the "Shared pieces" stories boot the real old front end: its files and /api come from the server on the
    // test copy (:4100, a database copy), never from :4000
    const legacy = process.env.LEGACY_APP || "http://localhost:4100";
    const proxy = Object.fromEntries(["/api", "/app.css", "/app.js", "/compare.js", "/cards.js", "/help.js", "/help/"].map((p) => [p, { target: legacy, changeOrigin: true }]));
    return mergeConfig(config, { base: "./", resolve: { alias: wafflesAlias }, plugins: [wafflesEmotionJsx], server: { proxy } });
  },
};
