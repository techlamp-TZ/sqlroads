// Storybook's own Vite config (not the app build in ../vite.config.js, which writes into public/app/)
import react from "@vitejs/plugin-react";
export default { plugins: [react()] };
