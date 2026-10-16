// Storybook: the Waffles component catalog. Development only: it builds into web/storybook-static/ (ignored by
// git), never into public/, and the running app does not load it.
import { mergeConfig } from "vite";
import { wafflesAlias, wafflesEmotionJsx } from "../vite.config.js";

export default {
  stories: ["../src/waffles/catalog/**/*.stories.@(jsx|tsx)"],
  framework: { name: "@storybook/react-vite", options: { builder: { viteConfigPath: ".storybook/vite.storybook.mjs" } } },
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  async viteFinal(config) {
    return mergeConfig(config, { base: "./", resolve: { alias: wafflesAlias }, plugins: [wafflesEmotionJsx] });
  },
};
