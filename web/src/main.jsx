// Entry of the React + Waffles front end. Loaded as a deferred module after the old app's scripts;
// it registers the pages React owns with the old hash router (bridge.jsx).
import "./tokens/tokens.css";
import "./styles/base.scss";
import { installBridge } from "./bridge.jsx";

installBridge(window);
