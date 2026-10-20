// The learner app (public/index.html). The old app's code (moved from public/ into src/legacy/: the shell, the
// router, the shared pieces, the pages not yet rebuilt), then the tokens, Waffles' base and the React pages; the old
// app's stylesheet is its own CSS entry, written into the page first (tools/inject.mjs), as before. Imports run in this order, so the old app boots first and the bridge then hands React the
// routes it owns (bridge.jsx). cards.js, compare.js and help.js stay classic scripts in public/ (the server and the
// tests use them too) and run before this module.
import "./tokens/tokens.css";
import "./styles/base.scss";
import "./legacy/app.js";
import { installBridge } from "./bridge.jsx";

installBridge(window);
