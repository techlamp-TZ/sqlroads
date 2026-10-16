// The shared pieces for React pages: wrappers around the one copy in app.js, plus Waffles-based helpers.
import Button from "@waffles/button";
import Loader from "./Loader.jsx";
import { useBooted, useConfirm } from "./shared.jsx";

export { default as Loader } from "./Loader.jsx";
export {
  ExampleBox, InteractionCard, LegacyHtml, MiniTable, ResultDiff, ResultTable, SchemaPanel, SharedProvider,
  SqlWorkspace, TablesPanel, useBooted, useConfirm, useShared,
} from "./shared.jsx";

/** Shows the loader until app.js has loaded the library, then the children (for pieces that read it, like cards). */
export function WhenBooted({ children, label = "Loading" }) {
  return useBooted() ? children : <Loader label={label} showLabel />;
}

/**
 * A Waffles Button that asks first, with the same in-page confirm as the old pages (askConfirm:
 * <dialog id="confirmDlg">, OK is [data-confirm=ok]); onConfirm runs only after OK.
 */
export function ConfirmButton({ message, okLabel, onConfirm, children, ...buttonProps }) {
  const { askConfirm } = useConfirm();
  return (
    <Button {...buttonProps} onClick={() => askConfirm(message, okLabel).then((ok) => { if (ok) onConfirm(); })}>
      {children}
    </Button>
  );
}
