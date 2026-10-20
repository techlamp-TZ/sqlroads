// The admin app (public/admin.html): the old admin's code (src/legacy/), the tokens, Waffles' base and the React
// pages (see main.jsx); app.css and admin.css are CSS entries, written into the page first and in that order. help.js stays a classic script in public/.
import "./tokens/tokens.css";
import "./styles/base.scss";
import "./legacy/admin.js";
import { installBridge } from "./bridge.jsx";

installBridge(window);
